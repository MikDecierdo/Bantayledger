import { randomUUID } from "crypto";
import { db } from "../db";
import { badRequest, notFound } from "../errors";
import { recordMovement, removeMovementsByReference } from "./inventoryService";
import { buildMonthlySeries, pctChange } from "./salesService";

/**
 * Waste. Ported from src/services/supabase/ledgerService.ts (wasteService).
 * Recording waste removes stock through the ledger — ported from
 * handle_waste_record — so it is refused if the quantity written off
 * exceeds what is on hand, same as a sale.
 */

export type WasteReason = "Expired" | "Damaged" | "Spoiled" | "Spillage" | "Customer Return";

export interface WasteInput {
  productId: string;
  quantity: number;
  reason: WasteReason;
  estimatedCost?: number;
  wasteDate?: string;
  notes?: string;
}

export interface WasteRecord {
  id: string;
  date: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  reason: WasteReason;
  estimatedCost: number;
  recordedBy: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function toDateOnly(value: string | Date): string {
  return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
}

export const wasteService = {
  async list(businessId: string, limit = 200): Promise<WasteRecord[]> {
    const rows = await db("waste_records as w")
      .join("products as p", "p.id", "w.product_id")
      .leftJoin("profiles", "profiles.id", "w.user_id")
      .where("w.business_id", businessId)
      .orderBy("w.waste_date", "desc")
      .limit(limit)
      .select("w.*", "p.name as product_name", "p.unit as product_unit", "profiles.full_name as recorded_by_name");

    return rows.map((row) => ({
      id: row.id,
      date: toDateOnly(row.waste_date),
      productId: row.product_id,
      productName: row.product_name,
      quantity: Number(row.quantity),
      unit: row.product_unit,
      reason: row.reason,
      estimatedCost: Number(row.estimated_cost),
      recordedBy: row.recorded_by_name ?? "—",
    }));
  },

  async create(businessId: string, userId: string | null, input: WasteInput): Promise<void> {
    if (!(input.quantity > 0)) throw badRequest("Quantity must be greater than zero.");

    const id = randomUUID();

    await db.transaction(async (trx) => {
      let estimatedCost = input.estimatedCost;

      if (estimatedCost === undefined) {
        const product = await trx("products").where({ id: input.productId }).first("cost_price");
        estimatedCost = Number(product?.cost_price ?? 0) * input.quantity;
      }

      await trx("waste_records").insert({
        id,
        business_id: businessId,
        product_id: input.productId,
        user_id: userId,
        quantity: input.quantity,
        reason: input.reason,
        estimated_cost: Math.round(estimatedCost * 100) / 100,
        waste_date: input.wasteDate ?? todayIso(),
        notes: input.notes ?? null,
      });

      // Ported from handle_waste_record: removes stock, refused (rolling
      // back the whole insert) if that would take the product below zero.
      await recordMovement(trx, {
        businessId,
        productId: input.productId,
        movementType: "WASTE",
        quantity: -input.quantity,
        referenceType: "waste",
        referenceId: id,
        notes: input.reason,
        createdBy: userId,
      });
    });
  },

  /** Deleting a waste record returns its stock to the shelf. */
  async remove(businessId: string, id: string): Promise<void> {
    await db.transaction(async (trx) => {
      const record = await trx("waste_records").where({ business_id: businessId, id }).first("id");
      if (!record) throw notFound("That waste record could not be found.");

      await removeMovementsByReference(trx, {
        businessId,
        referenceType: "waste",
        referenceId: id,
        movementType: "WASTE",
      });

      await trx("waste_records").where({ business_id: businessId, id }).delete();
    });
  },

  async overview(businessId: string) {
    const rows = await db("waste_records")
      .where({ business_id: businessId })
      .where("waste_date", ">=", daysAgoIso(400))
      .select("quantity", "estimated_cost", "reason", "waste_date");

    const normalized = rows.map((r) => ({
      quantity: Number(r.quantity),
      estimated_cost: Number(r.estimated_cost),
      reason: r.reason as string,
      waste_date: toDateOnly(r.waste_date),
    }));

    const today = todayIso();
    const monthStart = `${today.slice(0, 7)}-01`;
    const prev = new Date();
    prev.setMonth(prev.getMonth() - 1);
    const prevPrefix = prev.toISOString().slice(0, 7);

    const thisMonth = normalized.filter((r) => r.waste_date >= monthStart);
    const monthToDate = thisMonth.reduce((t, r) => t + r.estimated_cost, 0);
    const prevMonthTotal = normalized
      .filter((r) => r.waste_date.startsWith(prevPrefix))
      .reduce((t, r) => t + r.estimated_cost, 0);

    const byReasonMap = new Map<string, number>();
    for (const r of thisMonth) {
      byReasonMap.set(r.reason, (byReasonMap.get(r.reason) ?? 0) + r.estimated_cost);
    }
    const byReason = Array.from(byReasonMap, ([label, value]) => ({ label, value })).sort(
      (a, b) => b.value - a.value,
    );

    return {
      summary: {
        monthToDate,
        monthChangePct: pctChange(monthToDate, prevMonthTotal),
        itemsLost: thisMonth.reduce((t, r) => t + r.quantity, 0),
        topReason: (byReason[0]?.label ?? "Expired") as WasteReason,
        wasteRatePct: 0,
      },
      byReason,
      last6Months: buildMonthlySeries(
        normalized.map((r) => ({ total_amount: r.estimated_cost, sale_date: r.waste_date })),
        6,
      ),
    };
  },
};
