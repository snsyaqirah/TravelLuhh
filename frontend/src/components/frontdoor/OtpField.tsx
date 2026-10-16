// Six split-flap cells for the email code (§9.2), on input-otp: one real input underneath, so typing, paste
// and the phone's one-time-code autofill all work, and screen readers hear a single text field.
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp';
import { cn } from '@/lib/utils';

export const OTP_LENGTH = 6;

export interface OtpFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Fires once all six digits are in (typed or pasted). */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
  /** Mark as the field a multi-step form focuses when this step opens. */
  stepFocus?: boolean;
}

export function OtpField({ id, value, onChange, onComplete, disabled, invalid, describedBy, autoFocus, stepFocus }: OtpFieldProps) {
  const cell = cn('h-14 w-11 dark:border dark:border-rule-strong', invalid && 'shadow-[inset_0_-3px_0_hsl(var(--stamp))]');
  return (
    <InputOTP
      id={id}
      maxLength={OTP_LENGTH}
      value={value}
      onChange={(v) => onChange(v.replace(/\D/g, ''))}
      onComplete={onComplete}
      disabled={disabled}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete="one-time-code"
      // A code field never needs room for a password manager's badge.
      pushPasswordManagerStrategy="none"
      autoFocus={autoFocus}
      data-step-focus={stepFocus || undefined}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      containerClassName="gap-2"
    >
      <InputOTPGroup>
        {[0, 1, 2].map((i) => (
          <InputOTPSlot key={i} index={i} className={cell} />
        ))}
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        {[3, 4, 5].map((i) => (
          <InputOTPSlot key={i} index={i} className={cell} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
