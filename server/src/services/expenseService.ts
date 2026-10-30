import { randomUUID } from "crypto";
import { db } from "../db";
import { badRequest, notFound } from "../errors";
import { buildMonthlySeries, pctChange } from "./salesService";

/** Expenses. Ported from src/services/supabase/ledgerService.ts (expenseService). */

export type ExpenseCategory =
  | "Utilities"
  | "Rent"
  | "Salaries"
  | "Transport"
  | "Supplies"
  | "Permits"
  | "Maintenance";

export interface ExpenseInput {
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate?: string;
}

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paidBy: string;
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

export const expenseService = {
  async list(businessId: string, limit = 200): Promise<Expense[]> {
    const rows = await db("expenses")
      .leftJoin("profiles", "profiles.id", "expenses.user_id")
      .where("expenses.business_id", businessId)
      .orderBy("expenses.expense_date", "desc")
      .limit(limit)
      .select("expenses.*", "profiles.full_name as paid_by_name");

    return rows.map((row) => ({
      id: row.id,
      date: toDateOnly(row.expense_date),
      category: row.category,
      description: row.description,
      amount: Number(row.amount),
      paidBy: row.paid_by_name ?? "—",
    }));
  },

  async create(businessId: string, userId: string | null, input: ExpenseInput): Promise<void> {
    if (!input.description?.trim()) throw badRequest("A description is required.");
    if (!(input.amount >= 0)) throw badRequest("Amount must be zero or greater.");

    await db("expenses").insert({
      id: randomUUID(),
      business_id: businessId,
      user_id: userId,
      category: input.category,
      description: input.description.trim(),
      amount: input.amount,
      expense_date: input.expenseDate ?? todayIso(),
    });
  },

  async remove(businessId: string, id: string): Promise<void> {
    const deleted = await db("expenses").where({ business_id: businessId, id }).delete();
    if (!deleted) throw notFound("That expense could not be found.");
  },

  async overview(businessId: string) {
    const rows = await db("expenses")
      .where({ business_id: businessId })
      .where("expense_date", ">=", daysAgoIso(400))
      .select("amount", "expense_date", "category");

    const normalized = rows.map((r) => ({
      amount: Number(r.amount),
      expense_date: toDateOnly(r.expense_date),
      category: r.category as string,
    }));

    const today = todayIso();
    const monthStart = `${today.slice(0, 7)}-01`;
    const prev = new Date();
    prev.setMonth(prev.getMonth() - 1);
    const prevPrefix = prev.toISOString().slice(0, 7);

    const total = (filter: (r: (typeof normalized)[number]) => boolean) =>
      normalized.filter(filter).reduce((t, r) => t + r.amount, 0);

    const todayTotal = total((r) => r.expense_date === today);
    const yesterdayTotal = total((r) => r.expense_date === daysAgoIso(1));
    const monthToDate = total((r) => r.expense_date >= monthStart);
    const prevMonth = total((r) => r.expense_date.startsWith(prevPrefix));

    const byCategoryMap = new Map<string, number>();
    for (const r of normalized.filter((r) => r.expense_date >= monthStart)) {
      byCategoryMap.set(r.category, (byCategoryMap.get(r.category) ?? 0) + r.amount);
    }
    const byCategory = Array.from(byCategoryMap, ([label, value]) => ({ label, value })).sort(
      (a, b) => b.value - a.value,
    );

    return {
      summary: {
        today: todayTotal,
        todayChangePct: pctChange(todayTotal, yesterdayTotal),
        monthToDate,
        monthChangePct: pctChange(monthToDate, prevMonth),
        largestCategory: (byCategory[0]?.label ?? "Utilities") as ExpenseCategory,
        largestCategoryAmount: byCategory[0]?.value ?? 0,
      },
      byCategory,
      last6Months: buildMonthlySeries(
        normalized.map((r) => ({ total_amount: r.amount, sale_date: r.expense_date })),
        6,
      ),
    };
  },
};
