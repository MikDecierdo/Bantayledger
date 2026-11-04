import { api } from './client';

export type ActivityCategory = 'price' | 'stock' | 'expense';

export interface ActivityEntry {
  id: number;
  /** ISO date and time. */
  at: string;
  /** Who made the change; empty once that person has deleted their account. */
  actor: string | null;
  category: ActivityCategory;
  action: string;
  subject: string;
  oldValue: number | null;
  newValue: number | null;
  unit: string | null;
  notes: string | null;
  /** The expense's own date, which can differ from when it was logged. */
  recordDate: string | null;
}

export interface ActivityPage {
  items: ActivityEntry[];
  /** Pass as `before` for the next page; null on the last page. */
  nextBefore: number | null;
}

export interface ActivityFilters {
  category?: ActivityCategory;
  q?: string;
  /** YYYY-MM-DD, inclusive. */
  from?: string;
  /** YYYY-MM-DD, inclusive. */
  to?: string;
  before?: number;
}

export const activityService = {
  list(businessId: string, filters: ActivityFilters = {}): Promise<ActivityPage> {
    const { category, q, from, to, before } = filters;
    return api.get<ActivityPage>(`/businesses/${businessId}/activity`, {
      category,
      q: q || undefined,
      from: from || undefined,
      to: to || undefined,
      before,
    });
  },
};
