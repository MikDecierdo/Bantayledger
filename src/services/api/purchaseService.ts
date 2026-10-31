import type { Purchase, SeriesPoint } from '../../types';
import type { PurchaseStatus } from '../../types/database';
import { t } from '../../i18n';
import { peso } from '../../utils/format';
import { api, postOrQueue, type SaveResult } from './client';

export interface PurchaseOverview {
  summary: {
    monthToDate: number;
    monthChangePct: number;
    pendingOrders: number;
    pendingValue: number;
    suppliersUsed: number;
    averageOrderValue: number;
  };
  last6Months: SeriesPoint[];
}

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

export const purchaseService = {
  async list(businessId: string, limit = 100): Promise<Purchase[]> {
    return api.get<Purchase[]>(`/businesses/${businessId}/purchases`, { limit });
  },

  /** Sends the purchase, or saves it on the phone when offline (`queued`). */
  async create(businessId: string, _userId: string | null, input: PurchaseInput): Promise<SaveResult<unknown>> {
    const total = input.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
    return postOrQueue(`/businesses/${businessId}/purchases`, { ...input }, {
      kind: 'purchase',
      businessId,
      summary: `${t('Purchase')} · ${peso(total, total % 1 !== 0)}`,
    });
  },

  async setStatus(businessId: string, purchaseId: string, status: PurchaseStatus): Promise<void> {
    await api.patch(`/businesses/${businessId}/purchases/${purchaseId}/status`, { status });
  },

  async remove(businessId: string, purchaseId: string): Promise<void> {
    await api.delete(`/businesses/${businessId}/purchases/${purchaseId}`);
  },

  async overview(businessId: string): Promise<PurchaseOverview> {
    return api.get<PurchaseOverview>(`/businesses/${businessId}/purchases/overview`);
  },
};

export default purchaseService;
