import { randomUUID } from "crypto";
import { db } from "../db";
import { badRequest, notFound } from "../errors";
import { adjustStock, computeStatus } from "./inventoryService";

/**
 * Products and stock. Ported from src/services/supabase/productService.ts.
 *
 * Note what is *not* here: nothing writes current_stock or status directly
 * outside inventoryService.recordMovement. Adjustments go through
 * adjustStock so they always leave an audit trail, exactly as the Postgres
 * adjust_stock RPC did.
 */

export interface ProductInput {
  name: string;
  sku?: string | null;
  categoryId?: string | null;
  supplierId?: string | null;
  unit: string;
  minimumStock: number;
  maximumStock?: number | null;
  reorderQuantity: number;
  costPrice: number;
  sellingPrice: number;
  /** Only honoured on create — afterwards, stock moves through the ledger. */
  openingStock?: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  reorderQuantity: number;
  supplierId: string;
  costPrice: number;
  sellingPrice: number;
  status: "healthy" | "low" | "critical" | "out";
  averageDailyDemand: number;
  lastRestockedAt: string;
  updatedAt: string;
}

interface ProductRowJoined {
  id: string;
  name: string;
  sku: string | null;
  category_name: string | null;
  unit: string;
  current_stock: string | number;
  minimum_stock: string | number;
  reorder_quantity: string | number;
  supplier_id: string | null;
  cost_price: string | number;
  selling_price: string | number;
  status: "healthy" | "low" | "critical" | "out";
  created_at: string | Date;
  updated_at: string | Date;
}

function toIsoDate(value: string | Date): string {
  return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
}

function toProduct(
  row: ProductRowJoined,
  derived?: { averageDailyDemand: number; lastRestockedAt: string },
): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku ?? "",
    category: row.category_name ?? "Uncategorised",
    unit: row.unit,
    currentStock: Number(row.current_stock),
    minimumStock: Number(row.minimum_stock),
    reorderQuantity: Number(row.reorder_quantity),
    supplierId: row.supplier_id ?? "",
    costPrice: Number(row.cost_price),
    sellingPrice: Number(row.selling_price),
    status: row.status,
    averageDailyDemand: derived?.averageDailyDemand ?? 0,
    lastRestockedAt: derived?.lastRestockedAt ?? toIsoDate(row.created_at),
    updatedAt: toIsoDate(row.updated_at),
  };
}

const SELECT_JOINED = (query: ReturnType<typeof db>) =>
  query
    .leftJoin("categories", "categories.id", "products.category_id")
    .select("products.*", "categories.name as category_name");

/**
 * Average daily demand and last restock date for every product in one pass,
 * derived from the inventory ledger. Ported from loadDerived in the
 * Supabase service.
 */
async function loadDerived(
  businessId: string,
  productId?: string,
  windowDays = 30,
): Promise<Record<string, { averageDailyDemand: number; lastRestockedAt: string }>> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  let query = db("inventory_movements")
    .where({ business_id: businessId })
    .where("created_at", ">=", since)
    .select("product_id", "quantity", "movement_type", "created_at");

  if (productId) query = query.where({ product_id: productId });

  const rows = await query;

  const sold = new Map<string, number>();
  const lastRestock = new Map<string, string>();

  for (const row of rows) {
    const qty = Math.abs(Number(row.quantity));
    const at = toIsoDate(row.created_at);

    if (row.movement_type === "SALE") {
      sold.set(row.product_id, (sold.get(row.product_id) ?? 0) + qty);
    }
    if (row.movement_type === "PURCHASE") {
      const current = lastRestock.get(row.product_id);
      if (!current || at > current) lastRestock.set(row.product_id, at);
    }
  }

  const result: Record<string, { averageDailyDemand: number; lastRestockedAt: string }> = {};
  for (const id of new Set([...sold.keys(), ...lastRestock.keys()])) {
    result[id] = {
      averageDailyDemand: Math.round(((sold.get(id) ?? 0) / windowDays) * 10) / 10,
      lastRestockedAt: lastRestock.get(id) ?? "",
    };
  }
  return result;
}

export const productService = {
  async list(businessId: string): Promise<Product[]> {
    const rows: ProductRowJoined[] = await SELECT_JOINED(db("products"))
      .where("products.business_id", businessId)
      .orderBy("products.name");

    if (rows.length === 0) return [];

    const derived = await loadDerived(businessId);
    return rows.map((row) => toProduct(row, derived[row.id]));
  },

  async get(businessId: string, productId: string): Promise<Product> {
    const row: ProductRowJoined | undefined = await SELECT_JOINED(db("products"))
      .where("products.business_id", businessId)
      .andWhere("products.id", productId)
      .first();

    if (!row) throw notFound("That product could not be found.");

    const derived = await loadDerived(businessId, productId);
    return toProduct(row, derived[row.id]);
  },

  async create(businessId: string, userId: string, input: ProductInput): Promise<Product> {
    if (!input.name?.trim()) throw badRequest("A product name is required.");

    const id = randomUUID();
    await db("products").insert({
      id,
      business_id: businessId,
      name: input.name.trim(),
      sku: input.sku?.trim() || null,
      category_id: input.categoryId || null,
      supplier_id: input.supplierId || null,
      unit: input.unit?.trim() || "pcs",
      minimum_stock: input.minimumStock,
      maximum_stock: input.maximumStock ?? null,
      reorder_quantity: input.reorderQuantity,
      cost_price: input.costPrice,
      selling_price: input.sellingPrice,
      // Stock starts at 0 (the DB default) prior to any opening-stock
      // movement below, so compute status the same way any other stock
      // change does.
      status: computeStatus(0, input.minimumStock),
    });

    // Opening stock is recorded as an adjustment so day one has a ledger
    // entry like every other movement, rather than a stock level from
    // nowhere — same reasoning as the Supabase version's adjust_stock call.
    if (input.openingStock && input.openingStock > 0) {
      await adjustStock(businessId, id, input.openingStock, userId, "Opening stock");
    }

    return productService.get(businessId, id);
  },

  async update(
    businessId: string,
    productId: string,
    input: Partial<Omit<ProductInput, "openingStock">>,
  ): Promise<Product> {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.sku !== undefined) patch.sku = input.sku?.trim() || null;
    if (input.categoryId !== undefined) patch.category_id = input.categoryId || null;
    if (input.supplierId !== undefined) patch.supplier_id = input.supplierId || null;
    if (input.unit !== undefined) patch.unit = input.unit.trim();
    if (input.maximumStock !== undefined) patch.maximum_stock = input.maximumStock;
    if (input.reorderQuantity !== undefined) patch.reorder_quantity = input.reorderQuantity;
    if (input.costPrice !== undefined) patch.cost_price = input.costPrice;
    if (input.sellingPrice !== undefined) patch.selling_price = input.sellingPrice;

    await db.transaction(async (trx) => {
      if (input.minimumStock !== undefined) {
        const current = await trx("products")
          .where({ id: productId, business_id: businessId })
          .forUpdate()
          .first("current_stock");
        if (!current) throw notFound("That product could not be found.");

        patch.minimum_stock = input.minimumStock;
        patch.status = computeStatus(Number(current.current_stock), input.minimumStock);
      }

      const updated = await trx("products").where({ business_id: businessId, id: productId }).update(patch);
      if (!updated) throw notFound("That product could not be found.");
    });

    return productService.get(businessId, productId);
  },

  async remove(businessId: string, productId: string): Promise<void> {
    try {
      await db("products").where({ business_id: businessId, id: productId }).delete();
    } catch {
      // ON DELETE RESTRICT on sale_items/purchase_items/waste_records.product_id
      throw badRequest("This product cannot be deleted because it appears in recorded sales or purchases.");
    }
  },

  async adjustStock(businessId: string, userId: string, productId: string, quantity: number, notes?: string) {
    await adjustStock(businessId, productId, quantity, userId, notes);
  },

  /** Day-by-day stock history for the product detail chart. */
  async stockMovement(businessId: string, productId: string, days = 14) {
    const product = await db("products").where({ business_id: businessId, id: productId }).first("current_stock");
    if (!product) throw notFound("That product could not be found.");

    const since = new Date();
    since.setDate(since.getDate() - days);

    const movements = await db("inventory_movements")
      .where({ business_id: businessId, product_id: productId })
      .where("created_at", ">=", since)
      .orderBy("created_at")
      .select("quantity", "created_at");

    const byDay = new Map<string, { in: number; out: number }>();
    for (const m of movements) {
      const day = toIsoDate(m.created_at);
      const bucket = byDay.get(day) ?? { in: 0, out: 0 };
      const q = Number(m.quantity);
      if (q >= 0) bucket.in += q;
      else bucket.out += Math.abs(q);
      byDay.set(day, bucket);
    }

    const labels: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(d.toISOString().slice(0, 10));
    }

    let running = Number(product.current_stock);
    const result: { date: string; stock: number; in: number; out: number }[] = [];

    for (let i = labels.length - 1; i >= 0; i--) {
      const day = labels[i];
      const bucket = byDay.get(day) ?? { in: 0, out: 0 };

      result.unshift({
        date: new Date(day).toLocaleDateString("en-PH", { month: "short", day: "2-digit" }),
        stock: Math.max(0, Math.round(running * 1000) / 1000),
        in: bucket.in,
        out: bucket.out,
      });

      running -= bucket.in - bucket.out;
    }

    return result;
  },

  /** Units sold per day over the recent window, for the product detail chart. */
  async unitSales(businessId: string, productId: string, days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await db("inventory_movements")
      .where({ business_id: businessId, product_id: productId, movement_type: "SALE" })
      .where("created_at", ">=", since)
      .select("quantity", "created_at");

    const byDay = new Map<string, number>();
    for (const row of rows) {
      const day = toIsoDate(row.created_at);
      byDay.set(day, (byDay.get(day) ?? 0) + Math.abs(Number(row.quantity)));
    }

    return Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const key = d.toISOString().slice(0, 10);
      return {
        label: d.toLocaleDateString("en-PH", { month: "short", day: "2-digit" }),
        value: byDay.get(key) ?? 0,
      };
    });
  },
};
