// Me page: Google-only accounts get "You sign in with Google." instead of the change-password form; password
// accounts get the form with inline checks; the data page shows the passport fields; log out goes to /login.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { User } from '@/types';
import Me from '@/pages/Me';

vi.setConfig({ testTimeout: 20_000 });

const state = vi.hoisted(() => ({
  user: null as unknown,
  googleOnly: false,
  changePassword: vi.fn(),
  updateProfile: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('@/hooks/useMe', () => ({
  useMe: () => ({
    user: state.user,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    updateProfile: state.updateProfile,
    changePassword: state.changePassword,
    isChangingPassword: false,
    isGoogleOnly: state.googleOnly,
  }),
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: state.user, logout: state.logout }) }));
vi.mock('@/hooks/useTrips', () => ({ useTrips: () => ({ trips: [], isLoading: false, error: null, refetch: vi.fn() }) }));
vi.mock('@/hooks/useRates', () => ({ useRates: () => ({ rates: null, date: null, isStale: false, isLoading: false, error: null }) }));
vi.mock('@/iso/hooks', () => ({ use3DGate: () => ({ ok: false, reason: 'no-webgl' }) }));

function makeUser(over: Partial<User> = {}): User {
  return {
    id: 3,
    name: 'Syaqirah',
    email: 'syaqirah@example.test',
    avatar: null,
    authProvider: 'local',
    country: 'MY',
    currency: 'MYR',
    onboardingCompleted: true,
    emailVerified: true,
    hasPassword: true,
    createdAt: '2026-10-15T15:18:47',
    updatedAt: '2026-10-15T15:18:47',
    ...over,
  };
}

function renderMe() {
  return render(
    <MemoryRouter initialEntries={['/me']}>
      <Routes>
        <Route path="/me" element={<Me />} />
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.user = makeUser();
  state.googleOnly = false;
  state.changePassword.mockReset();
  state.logout.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('Me', () => {
  it('hides the password form for a Google-only account', () => {
    state.user = makeUser({ authProvider: 'google', hasPassword: false, avatar: null });
    state.googleOnly = true;
    renderMe();
    expect(screen.getByText('You sign in with Google.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change password' })).not.toBeInTheDocument();
    expect(screen.getByText('GOOGLE')).toBeInTheDocument();
  });

  it('shows the passport data page fields', () => {
    renderMe();
    expect(screen.getByRole('heading', { level: 1, name: 'Syaqirah' })).toBeInTheDocument();
    const page = screen.getByRole('banner');
    expect(within(page).getByText('MYR')).toBeInTheDocument();
    expect(within(page).getByText('OCT 2026')).toBeInTheDocument();
    expect(within(page).getByText('EMAIL')).toBeInTheDocument();
  });

  it('checks the new password inline before calling the server', async () => {
    renderMe();
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'Passw0rd!' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('New password again'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(state.changePassword).not.toHaveBeenCalled();

    state.changePassword.mockResolvedValue('Password changed');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'kopiokosong' } });
    fireEvent.change(screen.getByLabelText('New password again'), { target: { value: 'kopiokosong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() => expect(state.changePassword).toHaveBeenCalledWith('Passw0rd!', 'kopiokosong'));
    expect(await screen.findByText(/Password changed\. You're still signed in here/)).toBeInTheDocument();
  });

  it('logs out and lands on /login', async () => {
    renderMe();
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(state.logout).toHaveBeenCalled();
    expect(await screen.findByText('login page')).toBeInTheDocument();
  });
});
