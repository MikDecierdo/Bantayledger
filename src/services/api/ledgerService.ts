import type { Expense, SeriesPoint, WasteRecord } from '../../types';
import type { ExpenseCategory, WasteReason } from '../../types';
import { t } from '../../i18n';
import { peso } from '../../utils/format';
import { api, postOrQueue, type SaveResult } from './client';

export interface ExpenseInput {
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate?: string;
}

export interface WasteInput {
  productId: string;
  quantity: number;
  reason: WasteReason;
  estimatedCost?: number;
  wasteDate?: string;
  notes?: string;
}

export interface ExpenseOverview {
  summary: {
    today: number;
    todayChangePct: number;
    monthToDate: number;
    monthChangePct: number;
    largestCategory: ExpenseCategory;
    largestCategoryAmount: number;
    /** This month's sales profit (sales minus capital). */
    profitMonth: number;
    /** Profit not yet spent on expenses this month; the most one more expense may be. */
    availableProfit: number;
  };
  byCategory: SeriesPoint[];
  last6Months: SeriesPoint[];
}

export interface WasteOverview {
  summary: {
    monthToDate: number;
    monthChangePct: number;
    itemsLost: number;
    topReason: WasteReason;
    wasteRatePct: number;
  };
  byReason: SeriesPoint[];
  last6Months: SeriesPoint[];
}

export const expenseService = {
  async list(businessId: string, limit = 200): Promise<Expense[]> {
    return api.get<Expense[]>(`/businesses/${businessId}/expenses`, { limit });
  },

  /** Sends the expense, or saves it on the phone when offline (`queued`). */
  async create(businessId: string, _userId: string | null, input: ExpenseInput): Promise<SaveResult<unknown>> {
    return postOrQueue(`/businesses/${businessId}/expenses`, { ...input }, {
      kind: 'expense',
      businessId,
      summary: `${t('Expense')} · ${input.description || input.category} · ${peso(input.amount, input.amount % 1 !== 0)}`,
    });
  },

  async remove(businessId: string, id: string): Promise<void> {
    await api.delete(`/businesses/${businessId}/expenses/${id}`);
  },

  async overview(businessId: string): Promise<ExpenseOverview> {
    return api.get<ExpenseOverview>(`/businesses/${businessId}/expenses/overview`);
  },
};

export const wasteService = {
  async list(businessId: string, limit = 200): Promise<WasteRecord[]> {
    return api.get<WasteRecord[]>(`/businesses/${businessId}/waste`, { limit });
  },

  /** Sends the record, or saves it on the phone when offline (`queued`). */
  async create(businessId: string, _userId: string | null, input: WasteInput): Promise<SaveResult<unknown>> {
    return postOrQueue(`/businesses/${businessId}/waste`, { ...input }, {
      kind: 'waste',
      businessId,
      summary: `${t('Spoiled & Damaged')} · ${input.quantity}`,
      stockOut: [{ productId: input.productId, quantity: input.quantity }],
    });
  },

  async remove(businessId: string, id: string): Promise<void> {
    await api.delete(`/businesses/${businessId}/waste/${id}`);
  },

  async overview(businessId: string): Promise<WasteOverview> {
    return api.get<WasteOverview>(`/businesses/${businessId}/waste/overview`);
  },
};
