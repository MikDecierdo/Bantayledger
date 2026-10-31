import type { Sale, SeriesPoint } from '../../types';
import type { PaymentMethod } from '../../types/database';
import { t } from '../../i18n';
import { peso } from '../../utils/format';
import { api, postOrQueue, type SaveResult } from './client';

export interface SalesOverview {
  summary: {
    today: number;
    todayChangePct: number;
    yesterday: number;
    week: number;
    weekChangePct: number;
    month: number;
    monthChangePct: number;
    transactionsToday: number;
    averageBasket: number;
    todayCash: number;
    todayGCash: number;
    /** Money spent on the goods sold (buying price locked in at sale time). */
    capitalToday: number;
    profitToday: number;
    capitalWeek: number;
    profitWeek: number;
    capitalMonth: number;
    profitMonth: number;
  };
  last7Days: SeriesPoint[];
  last6Months: SeriesPoint[];
  byCategory: SeriesPoint[];
}

export interface SaleItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface SalePaymentInput {
  method: 'Cash' | 'GCash';
  amount: number;
  /** Required for GCash: the last 4 digits of the GCash reference number. */
  reference?: string;
}

export interface SaleInput {
  items: SaleItemInput[];
  /** One method for the whole sale. Use `payments` instead for a split payment. */
  paymentMethod?: PaymentMethod;
  /** Required for GCash: the last 4 digits of the GCash reference number. */
  paymentReference?: string;
  /** A cash part and a GCash part that together equal the sale total. */
  payments?: SalePaymentInput[];
  saleDate?: string;
  notes?: string;
  reference?: string;
}

export const salesService = {
  async list(businessId: string, limit = 100): Promise<Sale[]> {
    return api.get<Sale[]>(`/businesses/${businessId}/sales`, { limit });
  },

  /** Sends the sale, or saves it on the phone when offline (`queued`). */
  async create(businessId: string, _userId: string | null, input: SaleInput): Promise<SaveResult<Sale>> {
    // userId is inferred server-side from the bearer token, not passed
    // explicitly — kept as a parameter for call-site compatibility with the
    // Supabase/local versions.
    const total = input.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    return postOrQueue<Sale>(`/businesses/${businessId}/sales`, { ...input }, {
      kind: 'sale',
      businessId,
      summary: `${t('Sale')} · ${peso(total, total % 1 !== 0)}`,
      stockOut: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });
  },

  async remove(businessId: string, saleId: string): Promise<void> {
    await api.delete(`/businesses/${businessId}/sales/${saleId}`);
  },

  async overview(businessId: string): Promise<SalesOverview> {
    return api.get<SalesOverview>(`/businesses/${businessId}/sales/overview`);
  },
};

export default salesService;
