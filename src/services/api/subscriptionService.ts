import { api } from './client';

export type SubscriptionTerm = 'weekly' | 'monthly' | 'yearly';

export interface SubscriptionState {
  plan: 'free' | 'plus';
  expiresAt: string | null;
  term: SubscriptionTerm | null;
  terms: { term: SubscriptionTerm; amount: number }[];
  history: {
    id: string;
    term: SubscriptionTerm;
    amount: number;
    /** Masked by the server: only the last 4 digits are sent. */
    reference: string;
    paidAt: string;
    expiresAt: string;
    cancelled: boolean;
  }[];
}

/** Demo subscription for the project defense: a label only, with no real payment. */
export const subscriptionService = {
  get(businessId: string): Promise<SubscriptionState> {
    return api.get<SubscriptionState>(`/businesses/${businessId}/subscription`);
  },

  activate(businessId: string, term: SubscriptionTerm, reference: string): Promise<SubscriptionState> {
    return api.post<SubscriptionState>(`/businesses/${businessId}/subscription`, { term, reference });
  },

  cancel(businessId: string): Promise<SubscriptionState> {
    return api.delete<SubscriptionState>(`/businesses/${businessId}/subscription`);
  },
};
