import { api } from '@/lib/axios';
import type { PackingItem, PackingPreset } from '@/types';
import { apiPaths } from '@/services/apiPaths';

export type { PackingItem, PackingPreset } from '@/types';

export const packingService = {
  async getItems(tripId: number): Promise<PackingItem[]> {
    const res = await api.get<PackingItem[]>(`/trips/${tripId}/packing`);
    return res.data ?? [];
  },

  async addItem(tripId: number, label: string, category?: string): Promise<PackingItem> {
    const res = await api.post<PackingItem>(`/trips/${tripId}/packing`, { label, category });
    return res.data;
  },

  async toggleItem(tripId: number, itemId: number): Promise<PackingItem> {
    const res = await api.patch<PackingItem>(`/trips/${tripId}/packing/${itemId}/toggle`);
    return res.data;
  },

  async deleteItem(tripId: number, itemId: number): Promise<void> {
    await api.delete(apiPaths.packingItem(tripId, itemId));
  },

  /** Adds a preset list. Sent as ?type= and {preset} so both server variants accept it. */
  async addPreset(tripId: number, preset: PackingPreset | string): Promise<PackingItem[]> {
    const res = await api.post<PackingItem[]>(`/trips/${tripId}/packing/preset`, { preset }, { params: { type: preset } });
    return res.data ?? [];
  },
};
