import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import Login from '@/pages/Login';
import { apiError } from '@/components/frontdoor/__tests__/testUtils';

const login = vi.fn();
vi.mock('@/services/authService', () => ({
  authService: { login: (...a: unknown[]) => login(...a), logout: vi.fn(async () => {}) },
}));
vi.mock('@/services/userService', () => ({ userService: { getMe: vi.fn() } }));
// The panel's suitcase is a static SVG; it has nothing to do with these tests.
vi.mock('@/iso/svg/SuitcaseSvg', () => ({ ClosedSuitcaseSvg: () => null }));

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function renderAt(url: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

const user = { id: 1, name: 'Syaqirah', email: 'syaqirah@example.test', authProvider: 'local', currency: 'MYR', country: 'MY', onboardingCompleted: true };

beforeEach(() => {
  localStorage.clear();
  login.mockReset();
});
afterEach(cleanup);

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
}

describe('Login', () => {
  it('validates before calling the server', () => {
    renderAt('/login');
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByText('Enter your email.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(login).not.toHaveBeenCalled();
  });

  it("shows the server's sentence inline and stays on the page", async () => {
    login.mockRejectedValueOnce(apiError(401, 'Email or password is incorrect.'));
    renderAt('/login?next=%2Ftrips');
    fill('syaqirah@example.test', 'wrongpass1');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email or password is incorrect.');
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByTestId('where')).toBeNull();
    // The button is usable again for another try.
    expect(screen.getByRole('button', { name: 'Log in' })).not.toBeDisabled();
  });

  it('offers a way to add a password to a Google-only account', async () => {
    login.mockRejectedValueOnce(
      apiError(401, 'This account signs in with Google. Use Continue with Google, or reset your password to add one.'),
    );
    renderAt('/login');
    fill('g@example.test', 'whatever12');
    expect(await screen.findByRole('alert')).toHaveTextContent('This account signs in with Google.');
    expect(screen.getByRole('link', { name: 'Add a password' })).toHaveAttribute('href', '/forgot-password');
  });

  it('treats ?error=oauth and ?error=oauth_failed the same, and the notice can be dismissed', () => {
    renderAt('/login?error=oauth_failed');
    expect(screen.getByText(/Google sign-in didn't finish/)).toBeInTheDocument();
    cleanup();
    renderAt('/login?error=oauth');
    expect(screen.getByText(/Google sign-in didn't finish/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /dismiss|close/i }));
    expect(screen.queryByText(/Google sign-in didn't finish/)).toBeNull();
  });

  it('goes to a safe ?next after logging in', async () => {
    login.mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r', expiresIn: 1, user });
    renderAt('/login?next=%2Ftrips%2F5%2Fledger');
    fill('syaqirah@example.test', 'Passw0rd!');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/trips/5/ledger'));
  });

  it('ignores an unsafe ?next', async () => {
    login.mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r', expiresIn: 1, user });
    renderAt('/login?next=%2F%2Fevil.example');
    fill('syaqirah@example.test', 'Passw0rd!');
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/home'));
  });
});
