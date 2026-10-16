import { api } from '@/lib/axios';
import type { Activity } from '@/types';

export const activityService = {
  /** Newest first, at most 100. */
  async list(tripId: number): Promise<Activity[]> {
    const res = await api.get<Activity[]>(`/trips/${tripId}/activity`);
    return res.data ?? [];
  },
};
