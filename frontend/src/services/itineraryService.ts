import { api } from '@/lib/axios';
import type { CreateItineraryItemRequest, ItineraryItem } from '@/types';
import { apiPaths } from '@/services/apiPaths';

export type { CreateItineraryItemRequest, ItineraryItem } from '@/types';

export const itineraryService = {
  async getItems(tripId: number): Promise<ItineraryItem[]> {
    const res = await api.get<ItineraryItem[]>(`/trips/${tripId}/itinerary`);
    return res.data ?? [];
  },

  async addItem(tripId: number, data: CreateItineraryItemRequest): Promise<ItineraryItem> {
    const res = await api.post<ItineraryItem>(`/trips/${tripId}/itinerary`, data);
    return res.data;
  },

  async updateItem(tripId: number, itemId: number, data: CreateItineraryItemRequest): Promise<ItineraryItem> {
    const res = await api.put<ItineraryItem>(`/trips/${tripId}/itinerary/${itemId}`, data);
    return res.data;
  },

  async deleteItem(tripId: number, itemId: number): Promise<void> {
    await api.delete(apiPaths.itineraryItem(tripId, itemId));
  },
};
