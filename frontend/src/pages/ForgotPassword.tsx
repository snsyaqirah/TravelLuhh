// Forgot password (§9.2), on the backend's reset flow exactly: POST /auth/forgot-password (always 200, 429 when
// throttled) → POST /auth/verify-email with purpose forgot_password → POST /auth/reset-password with the
// verification token. A reset ends every other session, so it finishes on Log in.
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { authService } from '@/services/authService';
import { getErrorMessage, getErrorStatus } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthShell } from '@/components/frontdoor/AuthShell';
import { Field, FormAlert } from '@/components/frontdoor/fields';
import { describedBy } from '@/components/frontdoor/fieldIds';
import { ProgressStrip } from '@/components/frontdoor/ProgressStrip';
import { CodeStep, NewPasswordFields, StepHeading } from '@/components/frontdoor/steps';
import { checkNewPassword, useStepFocus } from '@/components/frontdoor/stepHelpers';
import { isEmail, maskEmail, retryAfterSeconds } from '@/components/frontdoor/authHelpers';
import { useCountdown } from '@/components/frontdoor/useCountdown';

type Step = 'email' | 'otp' | 'password' | 'done';
const STEPS = ['Email', 'Verify', 'Password'] as const;
const STEP_INDEX: Record<Step, number> = { email: 0, otp: 1, password: 2, done: 3 };
const RESEND_SECONDS = 60;
const linkClass = 'text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink';

interface Problem {
  text: string;
  action?: ReactNode;
}

export default function ForgotPassword() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const initialEmail = (location.state as { email?: string } | null)?.email ?? '';

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
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
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  // Signed-in people change their password in Me; this page is for getting back in.
  if (isAuthenticated && step !== 'done') return <Navigate to="/home" replace />;

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

  const restart = () => {
    setCode('');
    setVerificationToken('');
    setNotice(null);
    go('email');
  };

  const onEmailSubmit = (e: FormEvent) => {
    e.preventDefault();
    setProblem(null);
    const trimmed = email.trim();
    const err = !trimmed ? 'Enter your email.' : !isEmail(trimmed) ? "That doesn't look like an email address." : undefined;
    setErrors({ email: err });
    if (err) return emailRef.current?.focus();
    void run(async () => {
      try {
        await authService.forgotPassword(trimmed);
        setNotice(null);
        setCode('');
        resend.start(RESEND_SECONDS);
        go('otp');
      } catch (error) {
        if (getErrorStatus(error) === 429) {
          setCode('');
          resend.start(retryAfterSeconds(error));
          go('otp');
          setNotice(getErrorMessage(error));
        } else {
          setProblem({ text: getErrorMessage(error, "We couldn't send the code. Try again in a minute.") });
        }
      }
    });
  };

  const verify = (value: string) => {
    if (value.length !== 6) {
      setErrors({ code: 'Enter all 6 digits.' });
      return;
    }
    void run(async () => {
      try {
        const res = await authService.verifyEmail(email.trim(), value, 'forgot_password');
        setVerificationToken(res.verificationToken);
        setNotice(null);
        go('password');
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
      await authService.forgotPassword(email.trim());
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

  const onPasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    setProblem(null);
    const found = checkNewPassword(password, confirm);
    setErrors(found);
    if (found.password) return passwordRef.current?.focus();
    if (found.confirm) return confirmRef.current?.focus();
    void run(async () => {
      try {
        await authService.resetPassword(email.trim(), verificationToken, password);
        go('done');
      } catch (error) {
        if (getErrorStatus(error) === 401) {
          setProblem({
            text: 'That code check has expired. Ask for a new code; it takes a minute.',
            action: (
              <button type="button" onClick={restart} className={linkClass}>
                Start again
              </button>
            ),
          });
        } else {
          setProblem({ text: getErrorMessage(error, "Your password wasn't changed. Try again in a moment.") });
        }
      }
    });
  };

  return (
    <AuthShell line="Your tabung's safe. Let's get you back in." caseTag="KUL">
      {step !== 'done' ? <ProgressStrip steps={STEPS} current={STEP_INDEX[step]} className="mb-8" /> : null}
      <div ref={stepRef}>
        {step === 'email' ? (
          <>
            <StepHeading lead="We'll email you a code to set a new password.">Lost your boarding pass?</StepHeading>
            <form noValidate onSubmit={onEmailSubmit} className="mt-8 flex flex-col gap-5">
              <Field id="forgot-email" label="Email you log in with" error={errors.email}>
                <Input
                  ref={emailRef}
                  data-step-focus
                  id="forgot-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={describedBy('forgot-email', errors.email)}
                />
              </Field>
              {problem ? <FormAlert action={problem.action}>{problem.text}</FormAlert> : null}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? 'Sending code…' : 'Email me a code'}
              </Button>
            </form>
            <p className="type-body-s mt-6 text-ink-2">
              Remembered it?{' '}
              <Link to="/login" state={{ email: email.trim() }} className={linkClass}>
                Back to log in
              </Link>
            </p>
          </>
        ) : null}

        {step === 'otp' ? (
          <>
            <StepHeading
              leadId="otp-lead"
              lead={
                <>
                  If an account uses <span className="font-mono text-[15px] text-ink">{maskEmail(email)}</span>, we've sent a 6-digit code
                  to it. Not there? Check spam.
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

        {step === 'password' ? (
          <>
            <StepHeading lead="Saving it logs you out on every other device.">Pick a new password</StepHeading>
            <form noValidate onSubmit={onPasswordSubmit} className="mt-8 flex flex-col gap-5">
              {/* Lets password managers file the new password under the right account. */}
              <input type="email" autoComplete="username" value={email.trim()} readOnly hidden />
              <NewPasswordFields
                password={password}
                confirm={confirm}
                onPassword={setPassword}
                onConfirm={setConfirm}
                errors={{ password: errors.password, confirm: errors.confirm }}
                passwordLabel="New password"
                passwordRef={passwordRef}
                confirmRef={confirmRef}
                stepFocus
              />
              {problem ? <FormAlert action={problem.action}>{problem.text}</FormAlert> : null}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? 'Saving…' : 'Save new password'}
              </Button>
            </form>
          </>
        ) : null}

        {step === 'done' ? (
          <>
            <StepHeading lead="Log in with the new one. Any other device you used will ask too.">Password changed.</StepHeading>
            <Button asChild size="lg" className="mt-8 w-full">
              <Link to="/login" state={{ email: email.trim() }}>
                Log in
              </Link>
            </Button>
          </>
        ) : null}
      </div>
    </AuthShell>
  );
}
