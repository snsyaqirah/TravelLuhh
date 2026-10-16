import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import type { AuthState, UpdateProfileRequest, User } from '@/types';
import { authService } from '@/services/authService';
import { userService } from '@/services/userService';
import { API_BASE_URL, SESSION_EXPIRED_EVENT, getErrorStatus, toAppError } from '@/lib/axios';
import { queryClient as defaultQueryClient, queryKeys } from '@/lib/queryClient';
import {
  STORAGE_KEYS,
  clearSession,
  getRefreshToken,
  hasSession,
  sanitizeUser,
  saveSession,
  scrubStoredUser,
  setStoredUser,
  setTokens,
} from '@/lib/session';

/** Google-only accounts have no password to change. Falls back to authProvider for older responses. */
export function isGoogleOnly(user: User | null | undefined): boolean {
  if (!user) return false;
  if (typeof user.hasPassword === 'boolean') return !user.hasPassword;
  return user.authProvider === 'google';
}

/** What OAuthCallback can build from the JWT before /users/me answers. */
export type SessionUserSeed = Partial<Omit<User, 'id'>> & { id?: number | string; email?: string };

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: () => void;
  /** Revokes the refresh token (best effort), then clears the session and every cached query. */
  logout: () => Promise<void>;
  completeOnboarding: (data: { country: string; currency: string; name?: string }) => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<User>;
  /** Changes the password and keeps this device signed in with the new token pair. Resolves the server message. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<string>;
  /** Merge fields into the signed-in user (local only; persists to storage). */
  updateUser: (patch: Partial<User>) => void;
  /** Re-read /users/me. Resolves null when signed out or unreachable. */
  refreshUser: () => Promise<User | null>;
  /** @deprecated Prefer signInWithTokens. Stores tokens, shows `user` at once, then validates via /users/me. */
  setUserFromSession: (user: SessionUserSeed | null, accessToken: string, refreshToken: string) => void;
  /** OAuth callback: store tokens, load the real user. */
  signInWithTokens: (accessToken: string, refreshToken: string) => Promise<User>;
  needsOnboarding: boolean;
  isGoogleOnly: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SIGNED_OUT: AuthState = { user: null, isAuthenticated: false, isLoading: false };

function initialState(): AuthState {
  // Also rewrites any legacy stored user that still carries a password hash.
  const user = scrubStoredUser();
  if (!hasSession()) return SIGNED_OUT;
  if (user) return { user, isAuthenticated: true, isLoading: false };
  return { user: null, isAuthenticated: false, isLoading: true };
}

function googleLoginUrl(): string {
  try {
    return `${new URL(API_BASE_URL, window.location.origin).origin}/oauth2/authorization/google`;
  } catch {
    return 'http://localhost:8080/oauth2/authorization/google';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(initialState);
  const qc = useContext(QueryClientContext) ?? defaultQueryClient;
  const userRef = useRef(authState.user);
  userRef.current = authState.user;

  const applyUser = useCallback(
    (user: User) => {
      setStoredUser(user);
      qc.setQueryData(queryKeys.me, user);
      setAuthState({ user, isAuthenticated: true, isLoading: false });
    },
    [qc]
  );

  const signOutLocally = useCallback(() => {
    clearSession();
    qc.clear();
    setAuthState(SIGNED_OUT);
  }, [qc]);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    if (!hasSession()) return null;
    try {
      const user = await userService.getMe();
      applyUser(user);
      return user;
    } catch (err) {
      const status = getErrorStatus(err);
      if ((status === 401 || status === 403) && !hasSession()) {
        setAuthState(SIGNED_OUT);
      } else {
        // Offline or server trouble: keep whoever we already showed.
        setAuthState((s) => ({ ...s, isLoading: false, isAuthenticated: Boolean(s.user) }));
      }
      return null;
    }
  }, [applyUser]);

  // Boot: validate the stored session once. 401s go through the refresh interceptor first.
  useEffect(() => {
    if (hasSession()) void refreshUser();
  }, [refreshUser]);

  // Session expired (refresh failed) or logged out in another tab.
  useEffect(() => {
    const onExpired = () => {
      qc.clear();
      setAuthState(SIGNED_OUT);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.accessToken && e.oldValue && !e.newValue) onExpired();
      if (e.key === null) onExpired(); // localStorage.clear() elsewhere
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
      window.removeEventListener('storage', onStorage);
    };
  }, [qc]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authService.login(email.trim(), password);
      qc.clear();
      saveSession(res);
      const user = sanitizeUser(res.user);
      if (!user) throw toAppError(new Error('Login response had no user'));
      applyUser(user);
      return user;
    },
    [qc, applyUser]
  );

  const setUserFromSession = useCallback(
    (seed: SessionUserSeed | null, accessToken: string, refreshToken: string) => {
      qc.clear();
      setTokens(accessToken, refreshToken);
      const user = sanitizeUser(seed);
      if (user) {
        setStoredUser(user);
        setAuthState({ user, isAuthenticated: true, isLoading: false });
      } else {
        setAuthState({ user: null, isAuthenticated: false, isLoading: true });
      }
      void refreshUser();
    },
    [qc, refreshUser]
  );

  const signInWithTokens = useCallback(
    async (accessToken: string, refreshToken: string) => {
      qc.clear();
      setTokens(accessToken, refreshToken);
      setAuthState({ user: null, isAuthenticated: false, isLoading: true });
      try {
        const user = await userService.getMe();
        applyUser(user);
        return user;
      } catch (err) {
        signOutLocally();
        throw toAppError(err);
      }
    },
    [qc, applyUser, signOutLocally]
  );

  const loginWithGoogle = useCallback(() => {
    window.location.href = googleLoginUrl();
  }, []);

  const logout = useCallback(async () => {
    // Fire the revoke with the refresh token in hand, then clear without waiting on the network.
    const pending = authService.logout(getRefreshToken());
    signOutLocally();
    await pending;
  }, [signOutLocally]);

  const updateUser = useCallback(
    (patch: Partial<User>) => {
      const current = userRef.current;
      if (!current) return;
      const next = sanitizeUser({ ...current, ...patch });
      if (next) applyUser(next);
    },
    [applyUser]
  );

  const updateProfile = useCallback(
    async (data: UpdateProfileRequest) => {
      try {
        const user = await userService.updateProfile(data);
        const merged: User = {
          ...user,
          onboardingCompleted: user.onboardingCompleted ?? userRef.current?.onboardingCompleted,
        };
        applyUser(merged);
        return merged;
      } catch (err) {
        throw toAppError(err, "Your details didn't save. Try again.");
      }
    },
    [applyUser]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      try {
        const res = await userService.changePassword(currentPassword, newPassword);
        if (res.accessToken) {
          saveSession({ accessToken: res.accessToken, refreshToken: res.refreshToken ?? getRefreshToken() ?? '', user: res.user });
          const user = sanitizeUser(res.user);
          if (user) applyUser(user);
        }
        return res.message || 'Password changed.';
      } catch (err) {
        throw toAppError(err, "Password wasn't changed. Try again.");
      }
    },
    [applyUser]
  );

  const completeOnboarding = useCallback(
    async (data: { country: string; currency: string; name?: string }) => {
      try {
        const user = await userService.updateProfile({ ...data, onboardingCompleted: true });
        applyUser({ ...user, onboardingCompleted: true });
      } catch (err) {
        throw toAppError(err, "Your details didn't save. Try again.");
      }
    },
    [applyUser]
  );

  const value = useMemo<AuthContextType>(
    () => ({
      ...authState,
      login,
      loginWithGoogle,
      logout,
      completeOnboarding,
      updateProfile,
      changePassword,
      updateUser,
      refreshUser,
      setUserFromSession,
      signInWithTokens,
      needsOnboarding: Boolean(authState.user && !authState.user.onboardingCompleted),
      isGoogleOnly: isGoogleOnly(authState.user),
    }),
    [
      authState,
      login,
      loginWithGoogle,
      logout,
      completeOnboarding,
      updateProfile,
      changePassword,
      updateUser,
      refreshUser,
      setUserFromSession,
      signInWithTokens,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
