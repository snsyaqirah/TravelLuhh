// Form pieces shared by the auth pages and the onboarding sheet: a labelled field with its error or hint, an
// inline alert, and a password input with a show/hide toggle and an optional strength hint.
import { forwardRef, useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { passwordStrength } from './authHelpers';
import { fieldIds } from './fieldIds';

interface FieldProps {
  id: string;
  label: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  /** Right side of the label row, e.g. "Forgot password?". */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Field({ id, label, error, hint, aside, children, className }: FieldProps) {
  const ids = fieldIds(id);
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex min-h-5 items-end justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={ids.error} className="type-body-s flex gap-1.5 text-stamp">
          <span aria-hidden="true" className="font-mono text-[11px] leading-5">
            ▲
          </span>
          {error}
        </p>
      ) : hint ? (
        <div id={ids.hint} className="type-body-s text-ink-2">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/** Inline form error: stamp-tint slip with a 3px stamp rule. Announced as soon as it appears. */
export function FormAlert({
  children,
  action,
  className,
  tone = 'over',
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  tone?: 'over' | 'info';
}) {
  const info = tone === 'info';
  return (
    <div
      role={info ? 'status' : 'alert'}
      className={cn(
        'flex flex-col gap-1 border-l-[3px] py-2.5 pl-3 pr-4',
        info ? 'border-l-fund bg-fund-tint' : 'border-l-stamp bg-stamp-tint',
        className,
      )}
    >
      <p className="type-body-s text-ink">{children}</p>
      {action ? <div className="type-body-s">{action}</div> : null}
    </div>
  );
}

interface PasswordInputProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  invalid?: boolean;
}

/** Password input with a 44px show/hide toggle inside the field. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(({ invalid, className, ...props }, ref) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={show ? 'text' : 'password'}
        aria-invalid={invalid || undefined}
        className={cn('pr-12', className)}
        autoCapitalize="none"
        spellCheck={false}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        className="absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-sm text-ink-2 transition-colors duration-micro hover:text-ink"
      >
        {show ? (
          <EyeOff className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Eye className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';

/** "▮▮▯ Good · A few more characters makes it strong." The word carries the meaning; the bars only echo it. */
export function StrengthHint({ password }: { password: string }) {
  const s = passwordStrength(password);
  const tone = s.level >= 2 ? 'bg-fund' : s.level === 1 ? 'bg-brass' : 'bg-rule-strong';
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span aria-hidden="true" className="flex gap-0.5">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn('h-1.5 w-4', n <= s.level ? tone : 'bg-sunken outline outline-1 -outline-offset-1 outline-rule-strong')}
          />
        ))}
      </span>
      {password ? <span className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-ink">{s.label}</span> : null}
      <span>{s.hint}</span>
    </span>
  );
}
