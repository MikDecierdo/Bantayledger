import { randomUUID } from "crypto";
import { db } from "../db";
import { badRequest, notFound } from "../errors";
import { recordMovement, removeMovementsByReference } from "./inventoryService";
import { buildMonthlySeries, pctChange } from "./salesService";

/**
 * Purchases. Ported from src/services/supabase/purchaseService.ts.
 *
 * A purchase marked `received` adds its items to stock through the ledger; a
 * `pending` one does not, and does so the moment it flips to `received` — see
 * setStatus(), ported from handle_purchase_status_change in 0002. As with
 * sales, everything that used to be spread across triggers (item insert,
 * ledger entry, running total, status-flip stock release) now happens inside
 * one Knex transaction per operation.
 *
 * The UI presents one row per line item; list() flattens accordingly, same
 * as the Supabase version.
 */

export type PurchaseStatus = "received" | "pending" | "cancelled";

export interface PurchaseItemInput {
  productId: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseInput {
  supplierId?: string | null;
  items: PurchaseItemInput[];
  status?: PurchaseStatus;
  purchaseDate?: string;
  notes?: string;
  reference?: string;
}

export interface Purchase {
  id: string;
  /**
   * The purchase header's id, distinct from `id` (the line-item id). The
   * Supabase version's list() only ever exposed the line-item id, which
   * meant setStatus()/remove() — never actually wired to a page — had no
   * correct id to operate on if they had been. Exposing this explicitly
   * fixes that gap rather than reproducing it.
   */
  purchaseId: string;
  reference: string;
  date: string;
  supplierId: string;
  supplierName: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  status: PurchaseStatus;
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

export const purchaseService = {
  async list(businessId: string, limit = 100): Promise<Purchase[]> {
    // Header limit first (matches the Supabase version's semantics: "the N
    // most recent purchases"), then join in their items — a purchase can
    // have several line items, so limiting the joined query directly would
    // silently under-count purchases instead.
    const headerIds = await db("purchases")
      .where({ business_id: businessId })
      .orderBy("purchase_date", "desc")
      .limit(limit)
      .pluck("id");

    if (headerIds.length === 0) return [];

    const rows = await db("purchases as p")
      .leftJoin("suppliers as s", "s.id", "p.supplier_id")
      .join("purchase_items as pi", "pi.purchase_id", "p.id")
      .join("products as prod", "prod.id", "pi.product_id")
      .whereIn("p.id", headerIds)
      .orderBy("p.purchase_date", "desc")
      .select(
        "pi.id as id",
        "p.id as purchase_id",
        "p.reference",
        "p.purchase_date",
        "p.supplier_id",
        "s.name as supplier_name",
        "p.status",
        "pi.product_id",
        "prod.name as product_name",
        "prod.unit",
        "pi.quantity",
        "pi.unit_cost",
        "pi.subtotal",
      );

    return rows.map((row) => ({
      id: row.id,
      purchaseId: row.purchase_id,
      reference: row.reference ?? row.purchase_id.slice(0, 8).toUpperCase(),
      date: toDateOnly(row.purchase_date),
      supplierId: row.supplier_id ?? "",
      supplierName: row.supplier_name ?? "Unassigned",
      productId: row.product_id,
      productName: row.product_name,
      quantity: Number(row.quantity),
      unit: row.unit,
      unitCost: Number(row.unit_cost),
      totalCost: Number(row.subtotal),
      status: row.status,
    }));
  },

  async create(businessId: string, userId: string | null, input: PurchaseInput): Promise<void> {
    if (!input.items || input.items.length === 0) {
      throw badRequest("Add at least one product to the purchase.");
    }

    const purchaseId = randomUUID();
    const status: PurchaseStatus = input.status ?? "received";

    await db.transaction(async (trx) => {
      await trx("purchases").insert({
        id: purchaseId,
        business_id: businessId,
        supplier_id: input.supplierId || null,
        user_id: userId,
        status,
        purchase_date: input.purchaseDate ?? todayIso(),
        notes: input.notes ?? null,
        reference: input.reference ?? null,
      });

      for (const item of input.items) {
        if (item.quantity <= 0) throw badRequest("Quantity must be greater than zero.");

        await trx("purchase_items").insert({
          id: randomUUID(),
          purchase_id: purchaseId,
          product_id: item.productId,
          quantity: item.quantity,
          unit_cost: item.unitCost,
        });

        // Ported from handle_purchase_item: only a received purchase moves
        // stock. A pending order is a commitment, not inventory on the shelf.
        if (status === "received") {
          await recordMovement(trx, {
            businessId,
            productId: item.productId,
            movementType: "PURCHASE",
            quantity: item.quantity,
            referenceType: "purchase",
            referenceId: purchaseId,
            createdBy: userId,
          });
        }
      }

      const { total } = (await trx("purchase_items")
        .where({ purchase_id: purchaseId })
        .sum("subtotal as total")
        .first()) as unknown as { total: string | number | null };

      await trx("purchases")
        .where({ id: purchaseId })
        .update({ total_amount: Number(total ?? 0) });
    });
  },

  /** Flipping to `received` releases the items into stock; flipping away takes them back out. */
  async setStatus(businessId: string, purchaseId: string, status: PurchaseStatus, userId: string | null): Promise<void> {
    await db.transaction(async (trx) => {
      const purchase = await trx("purchases").where({ business_id: businessId, id: purchaseId }).first();
      if (!purchase) throw notFound("That purchase could not be found.");
      if (purchase.status === status) return;

      if (status === "received") {
        const items = await trx("purchase_items").where({ purchase_id: purchaseId }).select("product_id", "quantity");
        for (const item of items) {
          await recordMovement(trx, {
            businessId,
            productId: item.product_id,
            movementType: "PURCHASE",
            quantity: Number(item.quantity),
            referenceType: "purchase",
            referenceId: purchaseId,
            createdBy: userId,
          });
        }
      } else if (purchase.status === "received") {
        await removeMovementsByReference(trx, {
          businessId,
          referenceType: "purchase",
          referenceId: purchaseId,
          movementType: "PURCHASE",
        });
      }

      await trx("purchases").where({ id: purchaseId }).update({ status });
    });
  },

  async remove(businessId: string, purchaseId: string): Promise<void> {
    await db.transaction(async (trx) => {
      const purchase = await trx("purchases").where({ business_id: businessId, id: purchaseId }).first("id");
      if (!purchase) throw notFound("That purchase could not be found.");

      // No-ops cleanly for a purchase that was never 'received' (no ledger
      // rows exist to reverse), same as handle_purchase_item's DELETE branch.
      await removeMovementsByReference(trx, {
        businessId,
        referenceType: "purchase",
        referenceId: purchaseId,
        movementType: "PURCHASE",
      });

      // Cascades to purchase_items via fk_purchase_items_purchase.
      await trx("purchases").where({ business_id: businessId, id: purchaseId }).delete();
    });
  },

  async overview(businessId: string) {
    const rows = await db("purchases")
      .where({ business_id: businessId })
      .where("purchase_date", ">=", daysAgoIso(400))
      .select("total_amount", "purchase_date", "status", "supplier_id");

    const normalized = rows.map((r) => ({
      total_amount: Number(r.total_amount),
      purchase_date: toDateOnly(r.purchase_date),
      status: r.status as PurchaseStatus,
      supplier_id: r.supplier_id as string | null,
    }));

    const today = todayIso();
    const monthStart = `${today.slice(0, 7)}-01`;
    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevMonthPrefix = prevMonth.toISOString().slice(0, 7);

    const monthToDate = normalized
      .filter((r) => r.purchase_date >= monthStart)
      .reduce((t, r) => t + r.total_amount, 0);

    const prevMonthTotal = normalized
      .filter((r) => r.purchase_date.startsWith(prevMonthPrefix))
      .reduce((t, r) => t + r.total_amount, 0);

    const pending = normalized.filter((r) => r.status === "pending");
    const received = normalized.filter((r) => r.status === "received");

    return {
      summary: {
        monthToDate,
        monthChangePct: pctChange(monthToDate, prevMonthTotal),
        pendingOrders: pending.length,
        pendingValue: pending.reduce((t, r) => t + r.total_amount, 0),
        suppliersUsed: new Set(normalized.map((r) => r.supplier_id).filter(Boolean)).size,
        averageOrderValue:
          received.length > 0
            ? Math.round(received.reduce((t, r) => t + r.total_amount, 0) / received.length)
            : 0,
      },
      last6Months: buildMonthlySeries(
        normalized.map((r) => ({ total_amount: r.total_amount, sale_date: r.purchase_date })),
        6,
      ),
    };
  },
};
