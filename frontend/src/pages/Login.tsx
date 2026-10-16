// Log in (§9.2): email + password, inline errors straight from the server ("Email or password is incorrect.",
// the Google-only account sentence), Continue with Google, and ?next / ?error=oauth handling.
import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage } from '@/lib/axios';
import { safeNextPath } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NoticeSlip } from '@/components/motifs/NoticeSlip';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { AuthShell } from '@/components/frontdoor/AuthShell';
import { Field, FormAlert, PasswordInput } from '@/components/frontdoor/fields';
import { describedBy } from '@/components/frontdoor/fieldIds';
import { OrDivider } from '@/components/frontdoor/OrDivider';
import { isEmail } from '@/components/frontdoor/authHelpers';

interface LoginState {
  email?: string;
  from?: { pathname?: string; search?: string };
  notice?: string;
}

const OAUTH_ERRORS = new Set(['oauth', 'oauth_failed']);

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const state = (location.state ?? {}) as LoginState;

  const fromState = state.from?.pathname ? `${state.from.pathname}${state.from.search ?? ''}` : null;
  const next = safeNextPath(params.get('next') ?? fromState);
  const oauthFailed = OAUTH_ERRORS.has(params.get('error') ?? '');

  const [email, setEmail] = useState(state.email ?? '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  if (isAuthenticated) return <Navigate to={next} replace />;

  const dismissOAuth = () => {
    const p = new URLSearchParams(params);
    p.delete('error');
    setParams(p, { replace: true });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const found: typeof errors = {};
    if (!email.trim()) found.email = 'Enter your email.';
    else if (!isEmail(email)) found.email = "That doesn't look like an email address.";
    if (!password) found.password = 'Enter your password.';
    setErrors(found);
    if (found.email) return emailRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();

    setSubmitting(true);
    try {
      await login(email, password);
      // isAuthenticated flips and <Navigate> above takes over.
    } catch (err) {
      setFormError(getErrorMessage(err, "That didn't work. Try again in a moment."));
      setSubmitting(false);
    }
  };

  return (
    <AuthShell line="Welcome back. Your tabung's where you left it." caseTag="KUL">
      <h1 className="type-display-2 text-ink">Log in</h1>
      <p className="type-body mt-2 text-ink-2">
        New here?{' '}
        <Link to="/register" className="text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink">
          Start a tabung
        </Link>
      </p>

      {oauthFailed ? (
        <NoticeSlip level="warn" onDismiss={dismissOAuth} className="mt-6">
          Google sign-in didn't finish. Try again, or log in with your email and password.
        </NoticeSlip>
      ) : null}
      {state.notice ? (
        <FormAlert tone="info" className="mt-6">
          {state.notice}
        </FormAlert>
      ) : null}

      <form noValidate onSubmit={onSubmit} className="mt-8 flex flex-col gap-5" aria-describedby={formError ? 'login-error' : undefined}>
        <Field id="login-email" label="Email" error={errors.email}>
          <Input
            ref={emailRef}
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy('login-email', errors.email)}
          />
        </Field>

        <Field
          id="login-password"
          label="Password"
          error={errors.password}
          aside={
            <Link
              to="/forgot-password"
              state={{ email }}
              className="type-body-s -my-3 inline-flex min-h-11 items-center text-ink-2 underline decoration-rule-strong underline-offset-[3px] hover:text-ink hover:decoration-ink"
            >
              Forgot password?
            </Link>
          }
        >
          <PasswordInput
            ref={passwordRef}
            id="login-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={Boolean(errors.password)}
            aria-describedby={describedBy('login-password', errors.password)}
          />
        </Field>

        {formError ? (
          <div id="login-error">
            <FormAlert
              action={
                // Google-only accounts: the server suggests adding a password through reset.
                /google/i.test(formError) ? (
                  <Link
                    to="/forgot-password"
                    state={{ email }}
                    className="text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink"
                  >
                    Add a password
                  </Link>
                ) : null
              }
            >
              {formError}
            </FormAlert>
          </div>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      <div className="mt-6 flex flex-col gap-6">
        <OrDivider />
        <GoogleLoginButton next={next} disabled={submitting} />
      </div>
    </AuthShell>
  );
}
