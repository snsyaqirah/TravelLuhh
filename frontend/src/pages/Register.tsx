// Register (§9.2): EMAIL ── VERIFY ── PROFILE. The code step uses the split-flap cells and honours the server's
// resend throttle (429 Retry-After); the profile step sends home country + currency with complete-signup, so
// the new account skips onboarding and lands on /home.
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { authService } from '@/services/authService';
import { getErrorMessage, getErrorStatus } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { AuthShell } from '@/components/frontdoor/AuthShell';
import { Field, FormAlert } from '@/components/frontdoor/fields';
import { describedBy } from '@/components/frontdoor/fieldIds';
import { CountryPicker, CurrencySelect } from '@/components/frontdoor/HomeFields';
import { OrDivider } from '@/components/frontdoor/OrDivider';
import { ProgressStrip } from '@/components/frontdoor/ProgressStrip';
import { CodeStep, NewPasswordFields, StepHeading } from '@/components/frontdoor/steps';
import { checkNewPassword, useStepFocus } from '@/components/frontdoor/stepHelpers';
import { currencyForCountry, isEmail, maskEmail, retryAfterSeconds } from '@/components/frontdoor/authHelpers';
import { useCountdown } from '@/components/frontdoor/useCountdown';

type Step = 'email' | 'otp' | 'profile';
const STEPS = ['Email', 'Verify', 'Profile'] as const;
const STEP_INDEX: Record<Step, number> = { email: 0, otp: 1, profile: 2 };
const RESEND_SECONDS = 60;

interface Problem {
  text: string;
  action?: ReactNode;
}

const linkClass = 'text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink';

export default function Register() {
  const { signInWithTokens, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('MY');
  const [currency, setCurrency] = useState('MYR');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [problem, setProblem] = useState<Problem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const busyRef = useRef(false);
  const resend = useCountdown();
  const stepRef = useStepFocus(step);

  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  if (isAuthenticated) return <Navigate to="/home" replace />;

  const go = (next: Step) => {
    setErrors({});
    setProblem(null);
    setStep(next);
  };

  const run = async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  // ── 1. Email → a code ────────────────────────────────────────────────────────────────────────────────
  const onEmailSubmit = (e: FormEvent) => {
    e.preventDefault();
    setProblem(null);
    const trimmed = email.trim();
    const err = !trimmed ? 'Enter your email.' : !isEmail(trimmed) ? "That doesn't look like an email address." : undefined;
    setErrors({ email: err });
    if (err) return emailRef.current?.focus();

    void run(async () => {
      try {
        await authService.initiateSignup(trimmed);
        setNotice(null);
        setCode('');
        resend.start(RESEND_SECONDS);
        go('otp');
      } catch (error) {
        const status = getErrorStatus(error);
        if (status === 429) {
          // A code went out moments ago: it's probably already in the inbox.
          setCode('');
          resend.start(retryAfterSeconds(error));
          go('otp');
          setNotice(getErrorMessage(error));
        } else if (status === 409) {
          setProblem({
            text: getErrorMessage(error),
            action: (
              <Link to="/login" state={{ email: trimmed }} className={linkClass}>
                Go to log in
              </Link>
            ),
          });
        } else {
          setProblem({ text: getErrorMessage(error, "We couldn't send the code. Try again in a minute.") });
        }
      }
    });
  };

  // ── 2. The code ──────────────────────────────────────────────────────────────────────────────────────
  const verify = (value: string) => {
    if (value.length !== 6) {
      setErrors({ code: 'Enter all 6 digits.' });
      return;
    }
    void run(async () => {
      try {
        const res = await authService.verifyEmail(email.trim(), value, 'signup');
        setVerificationToken(res.verificationToken);
        setNotice(null);
        go('profile');
      } catch (error) {
        setErrors({ code: getErrorMessage(error, "That code didn't work. Check the email and try again.") });
        setCode('');
      }
    });
  };

  const onResend = async () => {
    if (resend.seconds > 0 || resending) return;
    setResending(true);
    setErrors({});
    try {
      await authService.initiateSignup(email.trim());
      setCode('');
      resend.start(RESEND_SECONDS);
      setNotice(`New code sent to ${maskEmail(email)}. The old one no longer works.`);
    } catch (error) {
      if (getErrorStatus(error) === 429) resend.start(retryAfterSeconds(error));
      setNotice(getErrorMessage(error, "We couldn't send a new code. Try again in a minute."));
    } finally {
      setResending(false);
    }
  };

  // ── 3. Profile → account ─────────────────────────────────────────────────────────────────────────────
  const restart = () => {
    setCode('');
    setVerificationToken('');
    setNotice(null);
    go('email');
  };

  const onCountry = (code: string) => {
    setCountry(code);
    const implied = currencyForCountry(code);
    if (implied) setCurrency(implied);
  };

  const onProfileSubmit = (e: FormEvent) => {
    e.preventDefault();
    setProblem(null);
    const found: Record<string, string | undefined> = {};
    const n = name.trim();
    if (n.length < 2) found.name = 'Enter your name (at least 2 letters).';
    else if (n.length > 100) found.name = 'Keep your name under 100 characters.';
    if (!country) found.country = 'Pick your home country.';
    if (!currency) found.currency = 'Pick your home currency.';
    Object.assign(found, checkNewPassword(password, confirm));
    setErrors(found);
    if (found.name) return nameRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();
    if (found.confirm) return confirmRef.current?.focus();
    if (found.country || found.currency) return;

    void run(async () => {
      let res;
      try {
        res = await authService.completeSignup(verificationToken, n, password, { country, currency });
      } catch (error) {
        if (getErrorStatus(error) === 401) {
          setProblem({
            text: 'That email check has expired. Start again with your email; it takes a minute.',
            action: (
              <button type="button" onClick={restart} className={linkClass}>
                Start again
              </button>
            ),
          });
        } else {
          setProblem({ text: getErrorMessage(error, "Your account wasn't created. Try again in a moment.") });
        }
        return;
      }
      try {
        await signInWithTokens(res.accessToken, res.refreshToken);
        navigate('/home', { replace: true });
      } catch {
        navigate('/login', {
          replace: true,
          state: { email: email.trim(), notice: 'Your account is ready. Log in with your new password.' },
        });
      }
    });
  };

  return (
    <AuthShell
      line="Let's open your first tabung."
      caseTag={step === 'profile' ? country : undefined}
      luggage={step === 'profile' ? { name, country, currency } : null}
    >
      <ProgressStrip steps={STEPS} current={STEP_INDEX[step]} className="mb-8" />
      <div ref={stepRef}>
        {step === 'email' ? (
          <>
            <StepHeading lead="First, your email. We'll send a 6-digit code to check it's you.">Start a tabung</StepHeading>
            <form noValidate onSubmit={onEmailSubmit} className="mt-8 flex flex-col gap-5">
              <Field id="register-email" label="Email" error={errors.email}>
                <Input
                  ref={emailRef}
                  data-step-focus
                  id="register-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={describedBy('register-email', errors.email)}
                />
              </Field>
              {problem ? <FormAlert action={problem.action}>{problem.text}</FormAlert> : null}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? 'Sending code…' : 'Send code'}
              </Button>
            </form>
            <div className="mt-6 flex flex-col gap-6">
              <OrDivider />
              <GoogleLoginButton label="Sign up with Google" disabled={busy} />
              <p className="type-body-s text-ink-2">
                Already have a tabung?{' '}
                <Link to="/login" className={linkClass}>
                  Log in
                </Link>
              </p>
            </div>
          </>
        ) : null}

        {step === 'otp' ? (
          <>
            <StepHeading
              leadId="otp-lead"
              lead={
                <>
                  We sent a 6-digit code to <span className="font-mono text-[15px] text-ink">{maskEmail(email)}</span>. Not there? Check
                  spam.
                </>
              }
            >
              Check your email
            </StepHeading>
            <CodeStep
              code={code}
              onCodeChange={(v) => {
                setCode(v);
                if (errors.code) setErrors({});
              }}
              onVerify={verify}
              verifying={busy}
              error={errors.code}
              resendIn={resend.seconds}
              resending={resending}
              onResend={onResend}
              onChangeEmail={restart}
              notice={notice}
              leadId="otp-lead"
            />
          </>
        ) : null}

        {step === 'profile' ? (
          <>
            <StepHeading lead="Every trip adds up in your home currency. You can change it later in Me.">About you</StepHeading>
            <form noValidate onSubmit={onProfileSubmit} className="mt-8 flex flex-col gap-5">
              <Field id="register-name" label="Your name" error={errors.name}>
                <Input
                  ref={nameRef}
                  data-step-focus
                  id="register-name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={describedBy('register-name', errors.name)}
                />
              </Field>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <Field id="register-country" label="Home country" error={errors.country}>
                  <CountryPicker
                    id="register-country"
                    value={country}
                    onChange={onCountry}
                    invalid={Boolean(errors.country)}
                    describedBy={describedBy('register-country', errors.country)}
                  />
                </Field>
                <Field id="register-currency" label="Home currency" error={errors.currency}>
                  <CurrencySelect
                    id="register-currency"
                    value={currency}
                    onChange={setCurrency}
                    invalid={Boolean(errors.currency)}
                    describedBy={describedBy('register-currency', errors.currency)}
                  />
                </Field>
              </div>
              <NewPasswordFields
                password={password}
                confirm={confirm}
                onPassword={setPassword}
                onConfirm={setConfirm}
                errors={{ password: errors.password, confirm: errors.confirm }}
                passwordRef={passwordRef}
                confirmRef={confirmRef}
              />
              {problem ? <FormAlert action={problem.action}>{problem.text}</FormAlert> : null}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? 'Opening your account…' : 'Open my account'}
              </Button>
            </form>
          </>
        ) : null}
      </div>
    </AuthShell>
  );
}
