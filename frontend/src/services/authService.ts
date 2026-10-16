import { api } from '@/lib/axios';
import { clearSession, saveSession } from '@/lib/session';
import type { LoginResponse, MessageResponse } from '@/types';

/** @deprecated Use LoginResponse from '@/types'. */
export type AuthResponse = LoginResponse;

export type VerifyPurpose = 'signup' | 'forgot_password';

export const authService = {
  // Email signup: initiate → verify code → complete.
  async initiateSignup(email: string): Promise<MessageResponse> {
    const res = await api.post<MessageResponse>('/auth/initiate-signup', { email });
    return res.data;
  },

  async verifyEmail(
    email: string,
    code: string,
    purpose: VerifyPurpose
  ): Promise<{ verificationToken: string; message: string }> {
    const res = await api.post<{ verificationToken: string; message: string }>('/auth/verify-email', {
      email,
      code,
      purpose,
    });
    return res.data;
  },

  async completeSignup(
    verificationToken: string,
    name: string,
    password: string,
    profile: { country?: string; currency?: string } = {}
  ): Promise<LoginResponse> {
    const res = await api.post<LoginResponse>('/auth/complete-signup', {
      verificationToken,
      name,
      password,
      ...profile,
    });
    return res.data;
  },

  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await api.post<LoginResponse>('/auth/login', { email, password });
    return res.data;
  },

  // Forgot password: request code → verify (purpose forgot_password) → reset with the verification token.
  async forgotPassword(email: string): Promise<MessageResponse> {
    const res = await api.post<MessageResponse>('/auth/forgot-password', { email });
    return res.data;
  },

  async resetPassword(email: string, verificationToken: string, newPassword: string): Promise<MessageResponse> {
    const res = await api.post<MessageResponse>('/auth/reset-password', {
      email,
      verificationToken,
      newPassword,
    });
    return res.data;
  },

  /** Rotates the refresh token. Prefer refreshSession() from lib/axios, which is single-flight. */
  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    const res = await api.post<LoginResponse>('/auth/refresh', null, {
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
    return res.data;
  },

  /** Revokes the refresh token server-side. Best effort: never throws. */
  async logout(refreshToken: string | null): Promise<void> {
    if (!refreshToken) return;
    try {
      await api.post('/auth/logout', null, {
        headers: { Authorization: `Bearer ${refreshToken}` },
        timeout: 5000,
      });
    } catch {
      // the token expires on its own; nothing useful to tell the person
    }
  },

  async health(): Promise<boolean> {
    try {
      await api.get('/auth/health', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  },

  saveSession(response: LoginResponse): void {
    saveSession(response);
  },

  clearSession(): void {
    clearSession();
  },
};
