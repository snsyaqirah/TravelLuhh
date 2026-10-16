import { api } from '@/lib/axios';
import type { AddMemberRequest, Member, Role } from '@/types';

export const memberService = {
  async list(tripId: number): Promise<Member[]> {
    const res = await api.get<Member[]>(`/trips/${tripId}/members`);
    return res.data ?? [];
  },

  /** Owner only. 404 when the email has no account yet, 409 when already a member. */
  async add(tripId: number, data: AddMemberRequest): Promise<Member> {
    const res = await api.post<Member>(`/trips/${tripId}/members`, data);
    return res.data;
  },

  async updateRole(tripId: number, memberId: number, role: Exclude<Role, 'owner'>): Promise<Member> {
    const res = await api.patch<Member>(`/trips/${tripId}/members/${memberId}`, { role });
    return res.data;
  },

  async remove(tripId: number, memberId: number): Promise<void> {
    await api.delete(`/trips/${tripId}/members/${memberId}`);
  },

  /** For non-owner members. */
  async leave(tripId: number): Promise<void> {
    await api.post(`/trips/${tripId}/leave`);
  },
};
