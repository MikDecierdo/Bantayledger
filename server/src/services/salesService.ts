import { randomUUID } from "crypto";
import { db } from "../db";
import { badRequest, notFound } from "../errors";
import { recordMovement, removeMovementsByReference } from "./inventoryService";

/**
 * Sales. Ported from src/services/supabase/salesService.ts.
 *
 * The Postgres version relied on triggers for atomicity: insert the header,
 * insert the items, and a trigger on sale_items did the ledger insert + total
 * recalculation as part of the same statement. The client code itself never
 * wrapped header+items in a transaction — worth noting, since it meant a
 * failure between the two inserts (there wasn't one, in practice, because the
 * second insert's own trigger was what could fail) still needed the manual
 * "delete the header" rollback below it. Here, everything — header, items,
 * ledger entries, running total — happens inside one Knex transaction, so a
 * stock-shortage on item 3 of 5 rolls back the whole sale, no items, no
 * header, nothing. That is a strict improvement over the original, not a
 * behavior change: a partially-stocked sale was never supposed to be
 * possible either way.
 */

export type PaymentMethod = "Cash" | "GCash" | "Maya" | "Card" | "Other";

export interface SaleItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface SaleInput {
  items: SaleItemInput[];
  paymentMethod: PaymentMethod;
  saleDate?: string;
  notes?: string;
  reference?: string;
}

export interface Sale {
  id: string;
  reference: string;
  date: string;
  time: string;
  items: { productId: string; productName: string; quantity: number; unitPrice: number }[];
  total: number;
  paymentMethod: "Cash" | "GCash" | "Maya" | "Card";
  cashier: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

async function toSale(saleId: string): Promise<Sale> {
  const header = await db("sales")
    .leftJoin("profiles", "profiles.id", "sales.user_id")
    .where("sales.id", saleId)
    .first("sales.*", "profiles.full_name as cashier_name");

  const items = await db("sale_items")
    .join("products", "products.id", "sale_items.product_id")
    .where("sale_items.sale_id", saleId)
    .select("sale_items.product_id", "sale_items.quantity", "sale_items.unit_price", "products.name as product_name");

  const created = new Date(header.created_at);

  return {
    id: header.id,
    reference: header.reference ?? header.id.slice(0, 8).toUpperCase(),
    date: header.sale_date instanceof Date ? header.sale_date.toISOString().slice(0, 10) : header.sale_date,
    time: created.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true }),
    items: items.map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
    })),
    total: Number(header.total_amount),
    paymentMethod: header.payment_method === "Other" ? "Cash" : header.payment_method,
    cashier: header.cashier_name ?? "—",
  };
}

export const salesService = {
  async list(businessId: string, limit = 100): Promise<Sale[]> {
    const rows = await db("sales")
      .where({ business_id: businessId })
      .orderBy("sale_date", "desc")
      .orderBy("created_at", "desc")
      .limit(limit)
      .select("id");

    return Promise.all(rows.map((row) => toSale(row.id)));
  },

  async create(businessId: string, userId: string | null, input: SaleInput): Promise<Sale> {
    if (!input.items || input.items.length === 0) {
      throw badRequest("Add at least one product to the sale.");
    }

    const saleId = randomUUID();

    await db.transaction(async (trx) => {
      await trx("sales").insert({
        id: saleId,
        business_id: businessId,
        user_id: userId,
        payment_method: input.paymentMethod,
        sale_date: input.saleDate ?? todayIso(),
        notes: input.notes ?? null,
        reference: input.reference ?? null,
      });

      for (const item of input.items) {
        if (item.quantity <= 0) throw badRequest("Quantity must be greater than zero.");

        await trx("sale_items").insert({
          id: randomUUID(),
          sale_id: saleId,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        });

        // Ported from handle_sale_item: a sale removes stock; recordMovement
        // throws (rolling back the whole transaction) if that would take the
        // product below zero.
        await recordMovement(trx, {
          businessId,
          productId: item.productId,
          movementType: "SALE",
          quantity: -item.quantity,
          referenceType: "sale",
          referenceId: saleId,
          createdBy: userId,
        });
      }

      const { total } = (await trx("sale_items")
        .where({ sale_id: saleId })
        .sum("subtotal as total")
        .first()) as unknown as { total: string | number | null };

      await trx("sales")
        .where({ id: saleId })
        .update({ total_amount: Number(total ?? 0) });
    });

    return toSale(saleId);
  },

  /** Deleting a sale returns its stock to the shelf, mirroring the DELETE-cascade behavior in Postgres. */
  async remove(businessId: string, saleId: string): Promise<void> {
    await db.transaction(async (trx) => {
      const sale = await trx("sales").where({ business_id: businessId, id: saleId }).first("id");
      if (!sale) throw notFound("That sale could not be found.");

      await removeMovementsByReference(trx, {
        businessId,
        referenceType: "sale",
        referenceId: saleId,
        movementType: "SALE",
      });

      // Cascades to sale_items via fk_sale_items_sale ON DELETE CASCADE.
      await trx("sales").where({ business_id: businessId, id: saleId }).delete();
    });
  },

  /** Headline figures for the dashboard and sales page. */
  async overview(businessId: string) {
    const rows: { total_amount: string | number; sale_date: string | Date }[] = await db("sales")
      .where({ business_id: businessId })
      .where("sale_date", ">=", daysAgoIso(400))
      .select("total_amount", "sale_date");

    const normalized = rows.map((r) => ({
      total_amount: Number(r.total_amount),
      sale_date: r.sale_date instanceof Date ? r.sale_date.toISOString().slice(0, 10) : r.sale_date,
    }));

    const today = todayIso();
    const yesterday = daysAgoIso(1);

    const sum = (predicate: (d: string) => boolean) =>
      normalized.filter((r) => predicate(r.sale_date)).reduce((t, r) => t + r.total_amount, 0);

    const todayTotal = sum((d) => d === today);
    const yesterdayTotal = sum((d) => d === yesterday);
    const weekTotal = sum((d) => d >= daysAgoIso(6));
    const prevWeekTotal = sum((d) => d >= daysAgoIso(13) && d < daysAgoIso(6));
    const monthStart = `${today.slice(0, 7)}-01`;
    const monthTotal = sum((d) => d >= monthStart);

    const prevMonthDate = new Date();
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const prevMonthPrefix = prevMonthDate.toISOString().slice(0, 7);
    const prevMonthTotal = sum((d) => d.startsWith(prevMonthPrefix));

    const transactionsToday = normalized.filter((r) => r.sale_date === today).length;

    return {
      summary: {
        today: todayTotal,
        todayChangePct: pctChange(todayTotal, yesterdayTotal),
        yesterday: yesterdayTotal,
        week: weekTotal,
        weekChangePct: pctChange(weekTotal, prevWeekTotal),
        month: monthTotal,
        monthChangePct: pctChange(monthTotal, prevMonthTotal),
        transactionsToday,
        averageBasket: transactionsToday > 0 ? Math.round(todayTotal / transactionsToday) : 0,
      },
      last7Days: buildDailySeries(normalized, 7),
      last6Months: buildMonthlySeries(normalized, 6),
      byCategory: await salesByCategory(businessId),
    };
  },
};

async function salesByCategory(businessId: string) {
  const rows = (await db("sale_items as si")
    .join("products as p", "p.id", "si.product_id")
    .leftJoin("categories as c", "c.id", "p.category_id")
    .where("p.business_id", businessId)
    .groupBy("c.name")
    .select(db.raw("COALESCE(c.name, 'Uncategorised') as label"))
    .sum("si.subtotal as value")
    .orderBy("value", "desc")
    .limit(6)) as unknown as { label: string; value: string | number }[];

  return rows.map((r) => ({ label: r.label, value: Number(r.value) }));
}

export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function buildDailySeries(rows: { total_amount: number; sale_date: string }[], days: number) {
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(r.sale_date, (byDay.get(r.sale_date) ?? 0) + r.total_amount);

  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    return { label: d.toLocaleDateString("en-PH", { weekday: "short" }), value: byDay.get(key) ?? 0 };
  });
}

export function buildMonthlySeries(rows: { total_amount: number; sale_date: string }[], months: number) {
  const byMonth = new Map<string, number>();
  for (const r of rows) {
    const key = r.sale_date.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + r.total_amount);
  }

  return Array.from({ length: months }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (months - 1 - i));
    const key = d.toISOString().slice(0, 7);
    return { label: d.toLocaleDateString("en-PH", { month: "short" }), value: byMonth.get(key) ?? 0 };
  });
}
