import { api } from '@/lib/axios';
import type { Settlement } from '@/types';
import { num } from './normalize';

export const settlementService = {
  async get(tripId: number): Promise<Settlement> {
    const res = await api.get<Settlement>(`/trips/${tripId}/settlement`);
    const d = res.data;
    return {
      ...d,
      totalSpent: num(d?.totalSpent),
      perPerson: d?.perPerson == null ? undefined : num(d.perPerson),
      balances: (d?.balances ?? []).map((b) => ({
        ...b,
        paid: num(b.paid),
        share: num(b.share),
        net: num(b.net),
        onTrip: b.onTrip !== false,
      })),
      transactions: (d?.transactions ?? []).map((t) => ({ ...t, amount: num(t.amount) })),
    };
  },
};
