import { api } from '@/lib/axios';
import { sanitizeUser } from '@/lib/session';
import type { ChangePasswordResponse, UpdateProfileRequest, User } from '@/types';

function clean(raw: unknown): User {
  const user = sanitizeUser(raw);
  if (!user) throw new Error('Unexpected user response');
  return user;
}

export const userService = {
  async getMe(): Promise<User> {
    const res = await api.get<User>('/users/me');
    return clean(res.data);
  },

  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    const res = await api.put<User>('/users/profile', data);
    return clean(res.data);
  },

  /** Wrong current password is a 400 (not 401). Store the returned token pair: other sessions are ended. */
  async changePassword(currentPassword: string, newPassword: string): Promise<ChangePasswordResponse> {
    const res = await api.put<ChangePasswordResponse>('/users/change-password', { currentPassword, newPassword });
    return res.data;
  },
};
