import { api } from '@/lib/axios';
import type { CreateExpenseRequest, CreateSubItemInput, Expense } from '@/types';
import { normalizeExpense } from './normalize';
import { apiPaths } from '@/services/apiPaths';

export type { CreateExpenseRequest } from '@/types';
/** @deprecated Use CreateSubItemInput from '@/types'. */
export type CreateSubItemRequest = CreateSubItemInput;

export const expenseService = {
  /** Newest date first. */
  async getExpensesByTrip(tripId: number): Promise<Expense[]> {
    const res = await api.get<Expense[]>(`/expenses/trip/${tripId}`);
    return (res.data ?? []).map(normalizeExpense);
  },

  /** amount/currency must already be in the trip currency (see toTripCurrency in lib/money). */
  async createExpense(data: CreateExpenseRequest): Promise<Expense> {
    const res = await api.post<Expense>('/expenses', data);
    return normalizeExpense(res.data);
  },

  /** Replaces the expense, sub-items included. */
  async updateExpense(expenseId: number, data: CreateExpenseRequest): Promise<Expense> {
    const res = await api.put<Expense>(`/expenses/${expenseId}`, data);
    return normalizeExpense(res.data);
  },

  async deleteExpense(expenseId: number): Promise<void> {
    await api.delete(apiPaths.expense(expenseId));
  },
};
