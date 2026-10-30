import type { SeriesPoint, StockStatus } from '../../types';
import { api } from './client';

export interface ReportFilters {
  /** YYYY-MM-DD, inclusive. */
  from: string;
  /** YYYY-MM-DD, inclusive. */
  to: string;
  /** Product category id, or null for all categories. */
  categoryId: string | null;
}

export interface ReportProduct {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  costPrice: number;
  stockValue: number;
  status: StockStatus;
}

export interface Report {
  range: {
    from: string;
    to: string;
    /** Bar size the series use, picked by the server from the range length. */
    granularity: 'day' | 'week' | 'month';
    categoryId: string | null;
    categoryName: string | null;
  };
  summary: {
    revenue: number;
    /** Received purchases only. */
    purchases: number;
    /** Not affected by the product-category filter. */
    expenses: number;
    netPosition: number;
    transactions: number;
  };
  sales: { series: SeriesPoint[]; byCategory: SeriesPoint[] };
  purchases: { series: SeriesPoint[] };
  expenses: { series: SeriesPoint[]; byCategory: SeriesPoint[] };
  /** A current snapshot, not tied to the date range. */
  inventory: { products: ReportProduct[]; totalValue: number };
}

export const reportService = {
  async get(businessId: string, filters: ReportFilters): Promise<Report> {
    return api.get<Report>(`/businesses/${businessId}/reports`, {
      from: filters.from,
      to: filters.to,
      categoryId: filters.categoryId ?? undefined,
    });
  },
};
