import { api } from '@/lib/axios';
import type { MemberBudget, MemberBudgetInput } from '@/types';
import { num } from './normalize';

function normalize(rows: MemberBudget[] | null | undefined): MemberBudget[] {
  return (rows ?? []).map((r) => ({
    ...r,
    allocated: num(r.allocated),
    spent: num(r.spent),
    remaining: num(r.remaining),
  }));
}

/** Separated-mode allocations (one row per member). */
export const budgetService = {
  async list(tripId: number): Promise<MemberBudget[]> {
    const res = await api.get<MemberBudget[]>(`/trips/${tripId}/budgets`);
    return normalize(res.data);
  },

  /** Owner only. allocated 0 removes that member's allocation. */
  async save(tripId: number, rows: MemberBudgetInput[]): Promise<MemberBudget[]> {
    const res = await api.put<MemberBudget[]>(`/trips/${tripId}/budgets`, rows);
    return normalize(res.data);
  },
};
