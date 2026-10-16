import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import OAuthCallback from '@/pages/OAuthCallback';
import { apiError } from '@/components/frontdoor/__tests__/testUtils';

const { users } = vi.hoisted(() => ({ users: { getMe: vi.fn(), updateProfile: vi.fn() } }));
vi.mock('@/services/userService', () => ({ userService: users }));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function renderAt(url: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/auth/callback" element={<OAuthCallback />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

const google = { id: 9, name: 'Aiman Hakim', email: 'aiman@gmail.com', authProvider: 'google', currency: 'USD', onboardingCompleted: false };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  users.getMe.mockReset();
  users.updateProfile.mockReset();
});
afterEach(cleanup);

describe('OAuthCallback', () => {
  it('stores the pair, reads /users/me and goes on for a finished account', async () => {
    users.getMe.mockResolvedValue({ ...google, country: 'MY', currency: 'MYR', onboardingCompleted: true });
    sessionStorage.setItem('travelluhh_oauth_next', '/trips/3/fund');
    renderAt('/auth/callback?token=acc&refresh=ref&newUser=false');
    expect(screen.getByRole('heading', { name: 'Checking you in…' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/trips/3/fund'));
    expect(localStorage.getItem('travelluhh_token')).toBe('acc');
    expect(localStorage.getItem('travelluhh_refresh_token')).toBe('ref');
  });

  it('opens the passport sheet for a new Google account, then lands on /home', async () => {
    users.getMe.mockResolvedValue(google);
    users.updateProfile.mockResolvedValue({ ...google, country: 'MY', currency: 'MYR', onboardingCompleted: true });
    renderAt('/auth/callback?token=acc&refresh=ref&newUser=true');
    expect(await screen.findByRole('dialog', { name: "Where's home?" })).toBeInTheDocument();
    // USD was only a placeholder: the sheet starts on Malaysia and ringgit.
    expect(screen.getByRole('combobox', { name: 'Home country' })).toHaveTextContent('Malaysia');
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/home'));
    expect(users.updateProfile).toHaveBeenCalledWith({ country: 'MY', currency: 'MYR', onboardingCompleted: true });
  });

  it('sends missing or rejected tokens back to Login with the OAuth notice', async () => {
    renderAt('/auth/callback?token=acc');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/login?error=oauth_failed'));
    cleanup();
    users.getMe.mockRejectedValue(apiError(401, 'Your session has ended. Log in again.'));
    renderAt('/auth/callback?token=bad&refresh=bad');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/login?error=oauth_failed'));
    expect(localStorage.getItem('travelluhh_token')).toBeNull();
  });
});
