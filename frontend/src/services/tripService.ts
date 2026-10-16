import { api } from '@/lib/axios';
import type { CreateTripRequest, Trip, UpdateTripRequest } from '@/types';
import { normalizeTrip } from './normalize';

export type { CreateTripRequest, UpdateTripRequest } from '@/types';

export const tripService = {
  /** Trips the user owns or is a member of. Archived trips only when asked. */
  async getAllTrips(params: { archived?: boolean } = {}): Promise<Trip[]> {
    const res = await api.get<Trip[]>('/trips', { params: { archived: params.archived ?? false } });
    return (res.data ?? []).map(normalizeTrip);
  },

  async getTripById(tripId: number): Promise<Trip> {
    const res = await api.get<Trip>(`/trips/${tripId}`);
    return normalizeTrip(res.data);
  },

  async createTrip(data: CreateTripRequest): Promise<Trip> {
    const res = await api.post<Trip>('/trips', data);
    return normalizeTrip(res.data);
  },

  /** Partial update; budgetType and isArchived are owner-only. */
  async updateTrip(tripId: number, data: UpdateTripRequest): Promise<Trip> {
    const res = await api.put<Trip>(`/trips/${tripId}`, data);
    return normalizeTrip(res.data);
  },

  async deleteTrip(tripId: number): Promise<void> {
    await api.delete(`/trips/${tripId}`);
  },
};
