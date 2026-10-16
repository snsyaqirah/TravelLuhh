import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const { loginWithGoogle } = vi.hoisted(() => ({ loginWithGoogle: vi.fn() }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ loginWithGoogle }) }));

import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { takeOAuthFlow, takeOAuthNext } from '@/components/frontdoor/oauthNext';

afterEach(() => {
  sessionStorage.clear();
  loginWithGoogle.mockReset();
});

describe('GoogleLoginButton', () => {
  it('records the flow (nonce + time) and the next path in this tab before leaving for Google', () => {
    loginWithGoogle.mockImplementation(() => {
      // by the time the redirect starts, the callback's checks are already in place
      expect(sessionStorage.getItem('travelluhh_oauth_flow')).not.toBeNull();
    });
    render(<GoogleLoginButton next="/trips/3/fund" />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(loginWithGoogle).toHaveBeenCalledTimes(1);
    expect(takeOAuthFlow()).toBe(true);
    expect(takeOAuthNext()).toBe('/trips/3/fund');
  });
});
