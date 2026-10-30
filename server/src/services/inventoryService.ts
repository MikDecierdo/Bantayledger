import { randomUUID } from "crypto";
import type { Knex } from "knex";
import { db } from "../db";
import { badRequest, notFound } from "../errors";

/**
 * The inventory ledger. Ported from apply_inventory_movement() in
 * supabase/migrations/0002_functions_triggers.sql — the single place stock
 * changes, so every path (sale, purchase, waste, manual adjustment) is
 * accounted for in one audit trail and current_stock is only ever a cached
 * sum of it.
 *
 * Per the migration plan, this business rule moves from a Postgres trigger
 * into application code wrapped in a transaction, not into a MySQL trigger —
 * MySQL triggers can't produce the dynamic "Not enough stock for X" message
 * the way plpgsql can, the same limitation the on-device SQLite port already
 * hit.
 */

export type MovementType = "PURCHASE" | "SALE" | "WASTE" | "ADJUSTMENT" | "RETURN";

export interface RecordMovementInput {
  businessId: string;
  productId: string;
  movementType: MovementType;
  /** Signed: positive adds stock, negative removes it. */
  quantity: number;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}

export function computeStatus(currentStock: number, minimumStock: number): "healthy" | "low" | "critical" | "out" {
  if (currentStock <= 0) return "out";
  if (minimumStock > 0 && currentStock <= minimumStock * 0.5) return "critical";
  if (minimumStock > 0 && currentStock < minimumStock) return "low";
  return "healthy";
}

/**
 * Inserts one ledger row and applies its effect to products.current_stock in
 * the same transaction. Call within an existing `db.transaction(...)` when
 * the movement is one part of a larger write (e.g. a sale); pass `trx` as
 * the database handle.
 */
export async function recordMovement(trx: Knex, input: RecordMovementInput): Promise<void> {
  if (input.quantity === 0) {
    throw badRequest("Enter an adjustment other than zero.");
  }

  const product = await trx("products")
    .where({ id: input.productId, business_id: input.businessId })
    .forUpdate()
    .first("current_stock", "minimum_stock", "name", "unit");

  if (!product) {
    throw notFound("That product no longer exists.");
  }

  const nextStock = Number(product.current_stock) + input.quantity;

  if (nextStock < 0) {
    const available = Number(product.current_stock)
      .toFixed(3)
      .replace(/\.?0+$/, "");
    throw badRequest(`Not enough stock for ${product.name}. Only ${available} ${product.unit} available.`);
  }

  await trx("inventory_movements").insert({
    id: randomUUID(),
    business_id: input.businessId,
    product_id: input.productId,
    movement_type: input.movementType,
    quantity: input.quantity,
    reference_type: input.referenceType ?? null,
    reference_id: input.referenceId ?? null,
    notes: input.notes ?? null,
    created_by: input.createdBy ?? null,
  });

  await trx("products")
    .where({ id: input.productId })
    .update({
      current_stock: nextStock,
      status: computeStatus(nextStock, Number(product.minimum_stock)),
    });
}

/**
 * Reverses and deletes every ledger row for one (reference_type, reference_id,
 * movement_type) triple — used when deleting a sale/purchase/waste record.
 *
 * Postgres got this for free: deleting the parent row cascaded to its line
 * items, whose AFTER DELETE trigger deleted the matching inventory_movements
 * row, whose own AFTER DELETE trigger restored the stock
 * (apply_inventory_movement's DELETE branch: current_stock = GREATEST(
 * current_stock - old.quantity, 0)). There are no triggers here, so the
 * caller must do this explicitly, in the same transaction as the parent
 * delete, before the FK cascade removes the line items.
 */
export async function removeMovementsByReference(
  trx: Knex,
  params: { businessId: string; referenceType: string; referenceId: string; movementType?: MovementType },
): Promise<void> {
  const query = trx("inventory_movements").where({
    business_id: params.businessId,
    reference_type: params.referenceType,
    reference_id: params.referenceId,
  });
  if (params.movementType) query.andWhere({ movement_type: params.movementType });

  const movements = await query.select("id", "product_id", "quantity");

  for (const movement of movements) {
    const product = await trx("products")
      .where({ id: movement.product_id })
      .forUpdate()
      .first("current_stock", "minimum_stock");
    if (!product) continue; // Product itself was removed; nothing left to restore.

    const restored = Math.max(Number(product.current_stock) - Number(movement.quantity), 0);
    await trx("products")
      .where({ id: movement.product_id })
      .update({ current_stock: restored, status: computeStatus(restored, Number(product.minimum_stock)) });
  }

  if (movements.length > 0) {
    await trx("inventory_movements")
      .whereIn(
        "id",
        movements.map((m) => m.id),
      )
      .delete();
  }
}

/** Manual correction, exposed as adjust_stock was in Postgres — member-level, not manager-level. */
export async function adjustStock(
  businessId: string,
  productId: string,
  quantity: number,
  userId: string,
  notes?: string,
): Promise<void> {
  await db.transaction((trx) =>
    recordMovement(trx, {
      businessId,
      productId,
      movementType: "ADJUSTMENT",
      quantity,
      referenceType: "adjustment",
      notes: notes ?? null,
      createdBy: userId,
    }),
  );
}
