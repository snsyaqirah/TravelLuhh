// /auth/callback: the backend's Google success handler lands here with ?token=&refresh=&newUser=. We store
// the pair, read the real user from /users/me (no JWT decoding), and either open the passport sheet (new or
// unfinished accounts) or go straight on. Anything wrong → /login?error=oauth_failed.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Wordmark } from '@/components/brand/Wordmark';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { StoneHop } from '@/components/frontdoor/StoneHop';
import { takeOAuthNext } from '@/components/frontdoor/oauthNext';

const FAILED = '/login?error=oauth_failed';

export default function OAuthCallback() {
  const [params] = useSearchParams();
  const { signInWithTokens, completeOnboarding } = useAuth();
  const navigate = useNavigate();
  const started = useRef(false);
  const [phase, setPhase] = useState<'checking' | 'onboarding'>('checking');
  const [next, setNext] = useState('/home');

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = params.get('token');
    const refresh = params.get('refresh');
    const newUser = params.get('newUser') === 'true';
    const dest = takeOAuthNext('/home');
    // Keep the tokens out of the address bar and the history entry.
    try {
      window.history.replaceState(window.history.state, '', '/auth/callback');
    } catch {
      // not fatal
    }
    if (!token || !refresh) {
      navigate(FAILED, { replace: true });
      return;
    }
    signInWithTokens(token, refresh)
      .then((user) => {
        if (newUser || !user.onboardingCompleted) {
          setNext(dest);
          setPhase('onboarding');
        } else {
          navigate(dest, { replace: true });
        }
      })
      .catch(() => navigate(FAILED, { replace: true }));
  }, [params, signInWithTokens, navigate]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-16 max-w-[1168px] items-center px-4 lg:px-6">
          <Link to="/" className="inline-flex min-h-11 items-center rounded-sm" aria-label="TravelLuhh, front page">
            <Wordmark size="md" />
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-[1168px] flex-1 flex-col justify-center px-4 pb-24 lg:px-6">
        <div className="max-w-[420px]" role="status" aria-live="polite">
          <StoneHop className="mb-8" />
          <p className="type-overline text-ink-2">Google · {phase === 'checking' ? 'Boarding' : 'Checked in'}</p>
          <h1 className="type-display-2 mt-2 text-ink">{phase === 'checking' ? 'Checking you in…' : 'Checked in.'}</h1>
          <p className="type-body mt-2 text-ink-2">
            {phase === 'checking'
              ? 'Signing you in with your Google account. This takes a second.'
              : 'One page to fill and you are through.'}
          </p>
        </div>
      </main>
      {phase === 'onboarding' ? (
        <OnboardingModal
          open
          onComplete={async (data) => {
            await completeOnboarding(data);
            navigate(next, { replace: true });
          }}
        />
      ) : null}
    </div>
  );
}
