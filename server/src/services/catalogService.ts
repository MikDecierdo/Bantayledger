import { randomUUID } from "crypto";
import { db } from "../db";
import { badRequest, notFound } from "../errors";

/**
 * Categories and suppliers. Ported from
 * src/services/supabase/catalogService.ts — same method shapes, same
 * "supplier stats are derived from purchase history, never stored" rule.
 * The derived-stats computation (loadSupplierDerived there) now runs here
 * server-side instead of being pushed back to the client, since that is
 * exactly the kind of aggregation a backend should own.
 */

export interface CategoryRow {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export const categoryService = {
  async list(businessId: string): Promise<CategoryRow[]> {
    return db("categories").where({ business_id: businessId }).orderBy("name");
  },

  async create(businessId: string, name: string, description?: string): Promise<CategoryRow> {
    const trimmed = name.trim();
    if (!trimmed) throw badRequest("A category name is required.");

    const id = randomUUID();
    await db("categories").insert({
      id,
      business_id: businessId,
      name: trimmed,
      description: description ?? null,
    });
    return db("categories").where({ id }).first();
  },

  async remove(businessId: string, id: string): Promise<void> {
    await db("categories").where({ business_id: businessId, id }).delete();
  },
};

export interface SupplierInput {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  status?: "active" | "review" | "inactive";
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  productIds: string[];
  averageUnitPrice: number;
  priceTrend: "up" | "down" | "flat";
  priceChangePct: number;
  reliabilityScore: number;
  status: "active" | "review" | "inactive";
  lastOrderedAt: string;
}

interface SupplierRow {
  id: string;
  business_id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: "active" | "review" | "inactive";
  created_at: string | Date;
  updated_at: string | Date;
}

interface SupplierDerived {
  productIds: string[];
  averageUnitPrice: number;
  priceTrend: "up" | "down" | "flat";
  priceChangePct: number;
  lastOrderedAt: string;
}

function toIsoDate(value: string | Date): string {
  return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function toSupplier(row: SupplierRow, derived?: Partial<SupplierDerived>): Supplier {
  return {
    id: row.id,
    name: row.name,
    contactPerson: row.contact_person ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    productIds: derived?.productIds ?? [],
    averageUnitPrice: derived?.averageUnitPrice ?? 0,
    priceTrend: derived?.priceTrend ?? "flat",
    priceChangePct: derived?.priceChangePct ?? 0,
    reliabilityScore: 0,
    status: row.status,
    lastOrderedAt: derived?.lastOrderedAt ?? toIsoDate(row.created_at),
  };
}

/**
 * Per supplier: which products they supply, their average unit cost, and how
 * that cost moved between the older and newer halves of their most recent
 * 300 purchases. Ported from loadSupplierDerived in the Supabase service.
 */
async function loadSupplierDerived(businessId: string): Promise<Record<string, SupplierDerived>> {
  const rows = await db("purchases as p")
    .join("purchase_items as pi", "pi.purchase_id", "p.id")
    .where("p.business_id", businessId)
    .whereNotNull("p.supplier_id")
    .orderBy("p.purchase_date", "desc")
    .limit(300)
    .select(
      "p.supplier_id as supplierId",
      "p.purchase_date as purchaseDate",
      "pi.product_id as productId",
      "pi.unit_cost as unitCost",
    );

  const bySupplier = new Map<
    string,
    { products: Set<string>; prices: { date: string; unitCost: number }[]; lastOrdered: string }
  >();

  for (const row of rows) {
    const purchaseDate = toIsoDate(row.purchaseDate);
    const entry = bySupplier.get(row.supplierId) ?? {
      products: new Set<string>(),
      prices: [],
      lastOrdered: purchaseDate,
    };

    if (purchaseDate > entry.lastOrdered) entry.lastOrdered = purchaseDate;
    entry.products.add(row.productId);
    entry.prices.push({ date: purchaseDate, unitCost: Number(row.unitCost) });

    bySupplier.set(row.supplierId, entry);
  }

  const result: Record<string, SupplierDerived> = {};

  for (const [supplierId, entry] of bySupplier) {
    const prices = entry.prices;
    const average = prices.length ? avg(prices.map((p) => p.unitCost)) : 0;

    let changePct = 0;
    if (prices.length >= 4) {
      const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));
      const mid = Math.floor(sorted.length / 2);
      const olderAvg = avg(sorted.slice(0, mid).map((p) => p.unitCost));
      const newerAvg = avg(sorted.slice(mid).map((p) => p.unitCost));
      if (olderAvg > 0) changePct = ((newerAvg - olderAvg) / olderAvg) * 100;
    }

    result[supplierId] = {
      productIds: Array.from(entry.products),
      averageUnitPrice: Math.round(average * 100) / 100,
      priceChangePct: Math.round(changePct * 10) / 10,
      priceTrend: changePct > 0.5 ? "up" : changePct < -0.5 ? "down" : "flat",
      lastOrderedAt: entry.lastOrdered,
    };
  }

  return result;
}

export const supplierService = {
  async list(businessId: string): Promise<Supplier[]> {
    const rows: SupplierRow[] = await db("suppliers").where({ business_id: businessId }).orderBy("name");
    if (rows.length === 0) return [];

    const derived = await loadSupplierDerived(businessId);
    return rows.map((row) => toSupplier(row, derived[row.id]));
  },

  async create(businessId: string, input: SupplierInput): Promise<SupplierRow> {
    if (!input.name?.trim()) throw badRequest("A supplier name is required.");

    const id = randomUUID();
    await db("suppliers").insert({
      id,
      business_id: businessId,
      name: input.name.trim(),
      contact_person: input.contactPerson?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      status: input.status ?? "active",
    });
    return db("suppliers").where({ id }).first();
  },

  async update(businessId: string, id: string, input: Partial<SupplierInput>): Promise<SupplierRow> {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.contactPerson !== undefined) patch.contact_person = input.contactPerson || null;
    if (input.phone !== undefined) patch.phone = input.phone || null;
    if (input.email !== undefined) patch.email = input.email || null;
    if (input.address !== undefined) patch.address = input.address || null;
    if (input.status !== undefined) patch.status = input.status;

    const updated = await db("suppliers").where({ business_id: businessId, id }).update(patch);
    if (!updated) throw notFound("That supplier could not be found.");
    return db("suppliers").where({ id }).first();
  },

  async remove(businessId: string, id: string): Promise<void> {
    await db("suppliers").where({ business_id: businessId, id }).delete();
  },
};
