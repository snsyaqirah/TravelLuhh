// Pieces shared by Register and Forgot password: the code step (split-flap cells, resend with a countdown that
// honours the server's throttle), the new-password pair, and focus moving to each new step's heading.
import type { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FormAlert, PasswordInput, StrengthHint } from './fields';
import { describedBy } from './fieldIds';
import { OTP_LENGTH, OtpField } from './OtpField';

export function StepHeading({ children, lead, leadId }: { children: ReactNode; lead?: ReactNode; leadId?: string }) {
  return (
    <>
      <h1 tabIndex={-1} className="type-display-2 text-ink outline-none">
        {children}
      </h1>
      {lead ? (
        <p id={leadId} className="type-body mt-2 text-ink-2">
          {lead}
        </p>
      ) : null}
    </>
  );
}

interface CodeStepProps {
  code: string;
  onCodeChange: (v: string) => void;
  onVerify: (code: string) => void;
  verifying: boolean;
  error?: string | null;
  /** Seconds until another code may be requested; 0 = now. */
  resendIn: number;
  resending: boolean;
  onResend: () => void;
  onChangeEmail: () => void;
  /** Info line under the cells, e.g. "New code sent." or the server's throttle sentence. */
  notice?: string | null;
  /** Id of the "We sent a code to s•••@gmail.com" line, read out with the code field. */
  leadId?: string;
  submitLabel?: string;
}

export function CodeStep({
  code,
  onCodeChange,
  onVerify,
  verifying,
  error,
  resendIn,
  resending,
  onResend,
  onChangeEmail,
  notice,
  leadId,
  submitLabel = 'Verify code',
}: CodeStepProps) {
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    onVerify(code);
  };
  return (
    <form noValidate onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
      <Field id="otp-code" label="6-digit code" error={error}>
        <OtpField
          id="otp-code"
          value={code}
          onChange={onCodeChange}
          onComplete={(v) => {
            if (!verifying) onVerify(v);
          }}
          invalid={Boolean(error)}
          describedBy={[describedBy('otp-code', error), leadId].filter(Boolean).join(' ') || undefined}
          stepFocus
        />
      </Field>

      {notice ? <FormAlert tone="info">{notice}</FormAlert> : null}

      <Button type="submit" size="lg" className="w-full" disabled={verifying || code.length !== OTP_LENGTH}>
        {verifying ? 'Checking…' : submitLabel}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={onResend}
          disabled={resendIn > 0 || resending}
          className="type-body-s inline-flex min-h-11 items-center text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink disabled:cursor-not-allowed disabled:text-ink-2 disabled:no-underline"
        >
          {resending ? (
            'Sending…'
          ) : resendIn > 0 ? (
            <>
              Send a new code in <span className="ml-1 font-mono tabular-nums">{resendIn}s</span>
            </>
          ) : (
            'Send a new code'
          )}
        </button>
        <button
          type="button"
          onClick={onChangeEmail}
          className="type-body-s inline-flex min-h-11 items-center text-ink-2 underline decoration-rule-strong underline-offset-[3px] hover:text-ink hover:decoration-ink"
        >
          Use a different email
        </button>
      </div>
    </form>
  );
}

interface NewPasswordFieldsProps {
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
  errors: { password?: string; confirm?: string };
  passwordLabel?: string;
  passwordRef?: React.Ref<HTMLInputElement>;
  confirmRef?: React.Ref<HTMLInputElement>;
  /** The new password is the first field of its step: focus it when the step opens. */
  stepFocus?: boolean;
}

export function NewPasswordFields({
  password,
  confirm,
  onPassword,
  onConfirm,
  errors,
  passwordLabel = 'Password',
  passwordRef,
  confirmRef,
  stepFocus,
}: NewPasswordFieldsProps) {
  const hint = <StrengthHint password={password} />;
  return (
    <>
      <Field id="new-password" label={passwordLabel} error={errors.password} hint={hint}>
        <PasswordInput
          ref={passwordRef}
          id="new-password"
          data-step-focus={stepFocus || undefined}
          autoComplete="new-password"
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          invalid={Boolean(errors.password)}
          aria-describedby={describedBy('new-password', errors.password, hint)}
        />
      </Field>
      <Field id="confirm-password" label="Type it again" error={errors.confirm}>
        <PasswordInput
          ref={confirmRef}
          id="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => onConfirm(e.target.value)}
          invalid={Boolean(errors.confirm)}
          aria-describedby={describedBy('confirm-password', errors.confirm)}
        />
      </Field>
    </>
  );
}
