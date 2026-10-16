import { api } from '@/lib/axios';
import type { FundEntry, FundEntryInput, FundSummary } from '@/types';
import { num } from './normalize';

function normalizeEntry(e: FundEntry): FundEntry {
  return { ...e, amount: num(e.amount) };
}

/** Travel fund (Phase B): money dropped into the tabung before the trip. */
export const fundService = {
  async get(tripId: number): Promise<FundSummary> {
    const res = await api.get<FundSummary>(`/trips/${tripId}/fund`);
    const d = res.data;
    return {
      ...d,
      target: num(d?.target),
      saved: num(d?.saved),
      entries: (d?.entries ?? []).map(normalizeEntry),
    };
  },

  async add(tripId: number, data: FundEntryInput): Promise<FundEntry> {
    const res = await api.post<FundEntry>(`/trips/${tripId}/fund`, data);
    return normalizeEntry(res.data);
  },

  async remove(tripId: number, entryId: number): Promise<void> {
    await api.delete(`/trips/${tripId}/fund/${entryId}`);
  },
};
