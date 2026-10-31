import { api } from './client';

/** A store's own yearly event (barangay fiesta…), repeated every year on month/day. */
export interface LocalEvent {
  id: string;
  name: string;
  month: number;
  day: number;
  /** Days before the event that the stock-up list appears. */
  prepDays: number;
}

export const eventService = {
  async list(businessId: string): Promise<LocalEvent[]> {
    return api.get<LocalEvent[]>(`/businesses/${businessId}/events`);
  },

  async add(businessId: string, input: { name: string; month: number; day: number; prepDays: number }): Promise<LocalEvent> {
    return api.post<LocalEvent>(`/businesses/${businessId}/events`, input);
  },

  async remove(businessId: string, eventId: string): Promise<void> {
    await api.delete(`/businesses/${businessId}/events/${eventId}`);
  },
};
