import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import Landing from '@/pages/Landing';

// The scene and the live board have their own tests; here they are stand-ins.
vi.mock('@/components/frontdoor/HeroDemo', () => ({ HeroDemo: () => <div data-testid="hero-demo" /> }));
vi.mock('@/components/frontdoor/LiveRates', () => ({ LiveRates: () => <div data-testid="live-rates" /> }));
vi.mock('@/iso/svg/MiniBalangSvg', () => ({ MiniBalangSvg: () => null }));
vi.mock('@/services/userService', () => ({
  userService: {
    getMe: vi.fn(async () => ({ id: 1, name: 'Syaqirah', email: 'syaqirah@example.test', authProvider: 'local', onboardingCompleted: true })),
  },
}));

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderLanding() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('Landing', () => {
  it('sends signed-in visitors to /home', () => {
    localStorage.setItem('travelluhh_token', 'access');
    localStorage.setItem('travelluhh_refresh_token', 'refresh');
    localStorage.setItem(
      'travelluhh_user',
      JSON.stringify({ id: 1, name: 'Syaqirah', email: 'syaqirah@example.test', authProvider: 'local', onboardingCompleted: true }),
    );
    renderLanding();
    expect(screen.getByTestId('where')).toHaveTextContent('/home');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('shows the front page to everyone else', () => {
    renderLanding();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Every trip starts as a tabung.');
    expect(screen.getAllByRole('link', { name: 'Start a tabung' })[0]).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'I already have one' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('heading', { name: 'Where did all the ringgit go?' })).toBeInTheDocument();
    // jsdom matches no media query, so this is the phone passbook: five rows, ending on Ichiran's yen spend.
    expect(screen.getAllByText('Ichiran Shinjuku').length).toBeGreaterThan(0);
    expect(screen.queryByText('Gyukatsu Motomura')).toBeNull();
    expect(screen.getAllByText('RM 3,136.96').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /Geng, one pot/ })).toBeInTheDocument();
    expect(screen.getAllByText('Invite your geng by email once the tabung is open.')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /GitHub/ })).toHaveAttribute('href', 'https://github.com/snsyaqirah');
  });
});
