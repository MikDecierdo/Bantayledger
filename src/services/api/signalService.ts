import type { AiInsight, Alert, DemandForecast, PriceForecast, PurchasingCostForecast } from '../../types';
import { api } from './client';

export interface AlertCounts {
  total: number;
  unread: number;
  critical: number;
  warning: number;
  info: number;
}

export const alertService = {
  async list(businessId: string, limit = 100): Promise<Alert[]> {
    return api.get<Alert[]>(`/businesses/${businessId}/alerts`, { limit });
  },

  async markRead(businessId: string, alertId: string): Promise<void> {
    await api.post(`/businesses/${businessId}/alerts/${alertId}/read`);
  },

  async markAllRead(businessId: string): Promise<void> {
    await api.post(`/businesses/${businessId}/alerts/read-all`);
  },

  async remove(businessId: string, alertId: string): Promise<void> {
    await api.delete(`/businesses/${businessId}/alerts/${alertId}`);
  },

  async counts(businessId: string): Promise<AlertCounts> {
    return api.get<AlertCounts>(`/businesses/${businessId}/alerts/counts`);
  },
};

export const recommendationService = {
  async list(businessId: string, limit = 50): Promise<AiInsight[]> {
    return api.get<AiInsight[]>(`/businesses/${businessId}/insights`, { limit });
  },

  async markRead(businessId: string, id: string): Promise<void> {
    await api.post(`/businesses/${businessId}/insights/${id}/read`);
  },

  /** Optional AI write-up for a trending insight (needs a key on the server). */
  async explain(businessId: string, id: string): Promise<{ text: string; cached: boolean }> {
    return api.post<{ text: string; cached: boolean }>(`/businesses/${businessId}/insights/${id}/explain`);
  },
};

export interface ForecastBundle {
  demand: DemandForecast[];
  price: PriceForecast[];
  cost: PurchasingCostForecast[];
  /** When the forecasts were last generated, or null if never. */
  generatedAt: string | null;
}

export interface ForecastRefreshResult {
  /** False when `ifStale` was set and the last run was still recent. */
  refreshed: boolean;
  generatedAt: string | null;
}

export const forecastService = {
  async all(businessId: string): Promise<ForecastBundle> {
    return api.get<ForecastBundle>(`/businesses/${businessId}/forecasts`);
  },

  /** Regenerates forecasts, alerts and insights. With `ifStale`, the server
   *  skips it if the last run is under a day old. */
  async refresh(businessId: string, ifStale = false): Promise<ForecastRefreshResult> {
    return api.post<ForecastRefreshResult>(
      `/businesses/${businessId}/forecasts/refresh${ifStale ? '?ifStale=1' : ''}`,
    );
  },
};
