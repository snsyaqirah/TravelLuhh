import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import Register from '@/pages/Register';
import { apiError } from '@/components/frontdoor/__tests__/testUtils';

const { auth, getMe } = vi.hoisted(() => ({
  auth: {
    initiateSignup: vi.fn(),
    verifyEmail: vi.fn(),
    completeSignup: vi.fn(),
    logout: vi.fn(async () => {}),
  },
  getMe: vi.fn(),
}));
vi.mock('@/services/authService', () => ({ authService: auth }));
vi.mock('@/services/userService', () => ({ userService: { getMe: () => getMe() } }));
vi.mock('@/iso/svg/SuitcaseSvg', () => ({ ClosedSuitcaseSvg: () => null }));

beforeAll(() => {
  // input-otp and Radix measure things jsdom doesn't lay out.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname}</p>;
}

function renderRegister() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/register']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

const codeInput = () => document.getElementById('otp-code') as HTMLInputElement;

async function toCodeStep(email = 'syaqirah@gmail.com') {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
  await screen.findByRole('heading', { name: 'Check your email' });
}

async function typeCode(code: string) {
  await act(async () => {
    fireEvent.change(codeInput(), { target: { value: code } });
  });
}

beforeEach(() => {
  localStorage.clear();
  Object.values(auth).forEach((f) => f.mockReset());
  getMe.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Register: email → code → profile', () => {
  it('walks the three steps and opens the account with home country and currency', async () => {
    auth.initiateSignup.mockResolvedValue({ message: 'sent' });
    auth.verifyEmail.mockRejectedValueOnce(apiError(400, "That code doesn't match. 4 tries left."));
    auth.verifyEmail.mockResolvedValueOnce({ verificationToken: 'vt-1', message: 'ok' });
    auth.completeSignup.mockResolvedValue({ accessToken: 'a', refreshToken: 'r', expiresIn: 1, user: {} });
    getMe.mockResolvedValue({ id: 7, name: 'Syaqirah Osman', email: 'syaqirah@gmail.com', authProvider: 'local', onboardingCompleted: true });
    renderRegister();

    expect(screen.getByRole('heading', { name: 'Start a tabung' })).toBeInTheDocument();
    expect(screen.getByText('Email', { selector: 'span' }).closest('li')).toHaveAttribute('aria-current', 'step');

    await toCodeStep();
    expect(auth.initiateSignup).toHaveBeenCalledWith('syaqirah@gmail.com');
    expect(screen.getByText('s•••@gmail.com')).toBeInTheDocument();
    expect(codeInput()).toHaveAttribute('inputmode', 'numeric');
    expect(codeInput()).toHaveAttribute('autocomplete', 'one-time-code');

    // Wrong code: the server's sentence, and the cells clear for another go.
    await typeCode('111111');
    expect(await screen.findByText("That code doesn't match. 4 tries left.")).toBeInTheDocument();
    expect(auth.verifyEmail).toHaveBeenLastCalledWith('syaqirah@gmail.com', '111111', 'signup');
    await waitFor(() => expect(codeInput().value).toBe(''));

    // Right code (six digits auto-submit).
    await typeCode('123456');
    await screen.findByRole('heading', { name: 'About you' });

    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Syaqirah Osman' } });
    expect(screen.getByRole('combobox', { name: 'Home country' })).toHaveTextContent('Malaysia');
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'teh-tarik-2026' } });
    fireEvent.change(screen.getByLabelText('Type it again'), { target: { value: 'teh-tarik-2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open my account' }));

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/home'));
    expect(auth.completeSignup).toHaveBeenCalledWith('vt-1', 'Syaqirah Osman', 'teh-tarik-2026', { country: 'MY', currency: 'MYR' });
  });

  it('checks the profile before sending it', async () => {
    auth.initiateSignup.mockResolvedValue({ message: 'sent' });
    auth.verifyEmail.mockResolvedValue({ verificationToken: 'vt', message: 'ok' });
    renderRegister();
    await toCodeStep();
    await typeCode('123456');
    await screen.findByRole('heading', { name: 'About you' });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough' } });
    fireEvent.change(screen.getByLabelText('Type it again'), { target: { value: 'different1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open my account' }));
    expect(screen.getByText('Enter your name (at least 2 letters).')).toBeInTheDocument();
    expect(screen.getByText("The two passwords don't match.")).toBeInTheDocument();
    expect(auth.completeSignup).not.toHaveBeenCalled();
  });

  it('shows a 409 with a way to log in, and a 503 inline, without leaving the email step', async () => {
    auth.initiateSignup.mockRejectedValueOnce(apiError(409, 'An account already uses this email. Log in instead.'));
    renderRegister();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'syaqirah@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('An account already uses this email.');
    expect(screen.getByRole('link', { name: 'Go to log in' })).toHaveAttribute('href', '/login');

    auth.initiateSignup.mockRejectedValueOnce(apiError(503, "We couldn't send the email right now. Try again in a minute."));
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent("We couldn't send the email right now."));
    expect(screen.getByRole('heading', { name: 'Start a tabung' })).toBeInTheDocument();
  });
});

describe('Register: resend throttle', () => {
  it('counts down 60s after sending, then honours the server’s Retry-After', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    auth.initiateSignup.mockResolvedValueOnce({ message: 'sent' });
    renderRegister();
    await toCodeStep();

    const resend = () => screen.getByRole('button', { name: /send a new code/i });
    expect(resend()).toBeDisabled();
    expect(resend()).toHaveTextContent('Send a new code in 60s');

    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(resend()).toHaveTextContent('in 40s');

    act(() => {
      vi.advanceTimersByTime(41_000);
    });
    expect(resend()).not.toBeDisabled();
    expect(resend()).toHaveTextContent(/^Send a new code$/);

    auth.initiateSignup.mockRejectedValueOnce(
      apiError(429, 'We just sent a code. Wait 42 seconds before asking for another.', { 'retry-after': '42' }),
    );
    await act(async () => {
      fireEvent.click(resend());
    });
    expect(resend()).toBeDisabled();
    expect(resend()).toHaveTextContent('in 42s');
    expect(screen.getByText('We just sent a code. Wait 42 seconds before asking for another.')).toBeInTheDocument();
  });

  it('a 429 on the email step still moves on to the code, with the wait from the message', async () => {
    auth.initiateSignup.mockRejectedValueOnce(apiError(429, 'We just sent a code. Wait 17 seconds before asking for another.'));
    renderRegister();
    await toCodeStep();
    expect(screen.getByRole('button', { name: /send a new code/i })).toHaveTextContent('in 17s');
    expect(screen.getByText('We just sent a code. Wait 17 seconds before asking for another.')).toBeInTheDocument();
  });
});
