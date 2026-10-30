import { db } from "../db";
import { notFound } from "../errors";

/**
 * Alerts, recommendations, and forecasts. Ported from
 * src/services/supabase/signalService.ts. All three are read-mostly here:
 * nothing writes recommendations or forecasts yet — a future forecasting
 * service will, with elevated access that bypasses per-request
 * authorization the way the Supabase service-role key bypassed RLS. Until
 * then these tables are expected to be empty and the UI's empty states
 * cover that, same as today.
 */

const SEVERITY_LEVEL = { critical: "HIGH", warning: "MEDIUM", info: "WATCH" } as const;

interface AlertRow {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  product_id: string | null;
  type: "Inventory" | "Pricing" | "Sales" | "Supplier" | "Expense";
  created_at: string | Date;
  is_read: number | boolean;
}

function toAlert(row: AlertRow) {
  return {
    id: row.id,
    severity: row.severity,
    level: SEVERITY_LEVEL[row.severity],
    title: row.title,
    detail: row.message,
    productId: row.product_id ?? undefined,
    category: row.type,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    read: Boolean(row.is_read),
  };
}

export const alertService = {
  async list(businessId: string, limit = 100) {
    const rows: AlertRow[] = await db("alerts")
      .where({ business_id: businessId })
      .orderBy("created_at", "desc")
      .limit(limit);
    return rows.map(toAlert);
  },

  async markRead(businessId: string, alertId: string): Promise<void> {
    const updated = await db("alerts").where({ business_id: businessId, id: alertId }).update({ is_read: true });
    if (!updated) throw notFound("That alert could not be found.");
  },

  async markAllRead(businessId: string): Promise<void> {
    await db("alerts").where({ business_id: businessId, is_read: false }).update({ is_read: true });
  },

  async remove(businessId: string, alertId: string): Promise<void> {
    await db("alerts").where({ business_id: businessId, id: alertId }).delete();
  },

  async counts(businessId: string) {
    const rows: { severity: string; is_read: number | boolean }[] = await db("alerts")
      .where({ business_id: businessId })
      .select("severity", "is_read");

    return {
      total: rows.length,
      unread: rows.filter((r) => !r.is_read).length,
      critical: rows.filter((r) => r.severity === "critical").length,
      warning: rows.filter((r) => r.severity === "warning").length,
      info: rows.filter((r) => r.severity === "info").length,
    };
  },
};

const IMPACT_FROM_SEVERITY = { high: "high", medium: "medium", low: "low" } as const;

interface RecommendationRow {
  id: string;
  title: string;
  message: string;
  reason: string | null;
  action: string | null;
  severity: "high" | "medium" | "low";
  type: "Inventory" | "Pricing" | "Purchasing" | "Sales" | "Waste";
  product_id: string | null;
  confidence: number | string | null;
  created_at: string | Date;
}

export const recommendationService = {
  async list(businessId: string, limit = 50) {
    const rows: RecommendationRow[] = await db("recommendations")
      .where({ business_id: businessId })
      .orderBy("created_at", "desc")
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      summary: row.message,
      whyItMatters: row.reason ?? "",
      recommendedAction: row.action ?? "",
      impact: IMPACT_FROM_SEVERITY[row.severity],
      category: row.type,
      productId: row.product_id ?? undefined,
      supportingData: [] as { label: string; value: string }[],
      confidence: Number(row.confidence ?? 0),
      generatedAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    }));
  },

  async markRead(businessId: string, id: string): Promise<void> {
    const updated = await db("recommendations")
      .where({ business_id: businessId, id })
      .update({ read_at: new Date() });
    if (!updated) throw notFound("That recommendation could not be found.");
  },
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export const forecastService = {
  async demand(businessId: string) {
    const rows = await db("demand_forecasts as f")
      .join("products as p", "p.id", "f.product_id")
      .where("f.business_id", businessId)
      .where("f.forecast_date", ">=", todayIso())
      .orderBy("f.forecast_date")
      .select(
        "f.product_id",
        "f.forecast_date",
        "f.predicted_quantity",
        "f.lower_bound",
        "f.upper_bound",
        "f.confidence",
        "p.name as product_name",
        "p.unit as product_unit",
        "p.current_stock",
      );

    const byProduct = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byProduct.get(row.product_id) ?? [];
      list.push(row);
      byProduct.set(row.product_id, list);
    }

    return Array.from(byProduct, ([productId, group]) => {
      const horizon = group.slice(0, 7);
      const total = horizon.reduce((t, r) => t + Number(r.predicted_quantity), 0);
      const low = horizon.reduce((t, r) => t + Number(r.lower_bound ?? r.predicted_quantity), 0);
      const high = horizon.reduce((t, r) => t + Number(r.upper_bound ?? r.predicted_quantity), 0);
      const currentStock = Number(group[0].current_stock ?? 0);
      const dailyAverage = horizon.length > 0 ? total / horizon.length : 0;

      return {
        productId,
        productName: group[0].product_name ?? "Unknown product",
        unit: group[0].product_unit ?? "pcs",
        horizonDays: horizon.length,
        currentStock,
        averageDailyDemand: Math.round(dailyAverage * 10) / 10,
        forecastQuantity: Math.round(total),
        rangeLow: Math.round(low),
        rangeHigh: Math.round(high),
        confidence: Math.round(Number(group[0].confidence ?? 0)),
        daysOfCover: dailyAverage > 0 ? Math.round((currentStock / dailyAverage) * 10) / 10 : 0,
        series: horizon.map((r) => ({
          label: new Date(r.forecast_date).toLocaleDateString("en-PH", { month: "short", day: "2-digit" }),
          forecast: Number(r.predicted_quantity),
          low: r.lower_bound === null ? undefined : Number(r.lower_bound),
          high: r.upper_bound === null ? undefined : Number(r.upper_bound),
        })),
      };
    });
  },

  async price(businessId: string) {
    const rows = await db("price_forecasts as f")
      .join("products as p", "p.id", "f.product_id")
      .leftJoin("suppliers as s", "s.id", "p.supplier_id")
      .where("f.business_id", businessId)
      .where("f.forecast_date", ">=", todayIso())
      .orderBy("f.forecast_date")
      .select(
        "f.product_id",
        "f.forecast_date",
        "f.predicted_price",
        "f.lower_bound",
        "f.upper_bound",
        "p.name as product_name",
        "p.cost_price",
        "s.name as supplier_name",
      );

    const byProduct = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byProduct.get(row.product_id) ?? [];
      list.push(row);
      byProduct.set(row.product_id, list);
    }

    return Array.from(byProduct, ([productId, group]) => {
      const current = Number(group[0].cost_price ?? 0);
      const prices = group.map((r) => Number(r.predicted_price));
      const average = prices.reduce((a, b) => a + b, 0) / prices.length;
      const changePct = current > 0 ? ((average - current) / current) * 100 : 0;

      return {
        productId,
        productName: group[0].product_name ?? "Unknown product",
        currentPrice: current,
        estimatedLow: Math.min(...group.map((r) => Number(r.lower_bound ?? r.predicted_price))),
        estimatedHigh: Math.max(...group.map((r) => Number(r.upper_bound ?? r.predicted_price))),
        estimatedAverage: Math.round(average * 100) / 100,
        trend: changePct > 0.5 ? "up" : changePct < -0.5 ? "down" : "flat",
        changePct: Math.round(changePct * 10) / 10,
        supplierName: group[0].supplier_name ?? "Unassigned",
        series: group.map((r) => ({
          label: new Date(r.forecast_date).toLocaleDateString("en-PH", { month: "short" }),
          forecast: Number(r.predicted_price),
          low: r.lower_bound === null ? undefined : Number(r.lower_bound),
          high: r.upper_bound === null ? undefined : Number(r.upper_bound),
        })),
      };
    });
  },

  async cost(businessId: string) {
    const rows = await db("cost_forecasts as f")
      .join("products as p", "p.id", "f.product_id")
      .where("f.business_id", businessId)
      .where("f.forecast_date", ">=", todayIso())
      .orderBy("f.forecast_date")
      .select(
        "f.product_id",
        "f.forecasted_quantity",
        "f.forecasted_unit_price",
        "f.forecasted_total_cost",
        "p.name as product_name",
        "p.unit as product_unit",
      );

    const byProduct = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byProduct.get(row.product_id) ?? [];
      list.push(row);
      byProduct.set(row.product_id, list);
    }

    return Array.from(byProduct, ([productId, group]) => {
      const quantity = group.reduce((t, r) => t + Number(r.forecasted_quantity), 0);
      const cost = group.reduce((t, r) => t + Number(r.forecasted_total_cost), 0);

      return {
        productId,
        productName: group[0].product_name ?? "Unknown product",
        unit: group[0].product_unit ?? "pcs",
        forecastDemand: Math.round(quantity),
        estimatedUnitPrice: Number(group[0].forecasted_unit_price),
        estimatedCost: Math.round(cost),
        previousCost: 0,
        difference: 0,
        differencePct: 0,
      };
    });
  },
};
