// Security (§9.8): change the password through useMe().changePassword, which stores the fresh token pair
// so this device stays signed in (every other session ends). Google-only accounts have no password to
// change, so they get one line instead of the form.
import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Field, PasswordInput, StrengthHint } from '@/components/frontdoor/fields';
import { describedBy } from '@/components/frontdoor/fieldIds';
import { getErrorMessage } from '@/lib/axios';
import { FormNote, MeSection } from '@/components/me/MeSection';
import { passwordErrors, type PasswordDraft, type PasswordErrors } from '@/components/me/meMath';

export interface SecuritySectionProps {
  googleOnly: boolean;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<string>;
  busy?: boolean;
}

const EMPTY: PasswordDraft = { current: '', next: '', confirm: '' };

export function SecuritySection({ googleOnly, onChangePassword, busy }: SecuritySectionProps) {
  const ids = useId();
  const [draft, setDraft] = useState<PasswordDraft>(EMPTY);
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (googleOnly) {
    return (
      <MeSection id={`${ids}-title`} title="Security">
        <p className="type-body text-ink">You sign in with Google.</p>
        <p className="type-body-s mt-1 text-ink-2">
          Want a password as well? Use{' '}
          <Link to="/forgot-password" className="text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink">
            Forgot password
          </Link>{' '}
          and we'll email you a code to set one.
        </p>
      </MeSection>
    );
  }

  const set = (k: keyof PasswordDraft, v: string) => {
    const next = { ...draft, [k]: v };
    setDraft(next);
    setDone(null);
    setFormError(null);
    // After the first try, re-check as they type so errors clear as soon as they're fixed.
    if (submitted) setErrors(passwordErrors(next));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = passwordErrors(draft);
    setSubmitted(true);
    setErrors(found);
    setDone(null);
    setFormError(null);
    if (Object.keys(found).length) return;
    try {
      const msg = await onChangePassword(draft.current, draft.next);
      setDraft(EMPTY);
      setSubmitted(false);
      setErrors({});
      setDone(`${msg.replace(/\.?$/, '.')} You're still signed in here; other devices have been signed out.`);
    } catch (x) {
      setFormError(getErrorMessage(x, "Password wasn't changed. Try again."));
    }
  };

  const id = (k: string) => `${ids}-${k}`;

  return (
    <MeSection id={`${ids}-title`} title="Security" description="Changing your password signs you out everywhere else.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Field id={id('current')} label="Current password" error={errors.current}>
          <PasswordInput
            id={id('current')}
            autoComplete="current-password"
            value={draft.current}
            onChange={(e) => set('current', e.target.value)}
            invalid={Boolean(errors.current)}
            aria-describedby={describedBy(id('current'), errors.current)}
          />
        </Field>
        <Field id={id('next')} label="New password" error={errors.next} hint={<StrengthHint password={draft.next} />}>
          <PasswordInput
            id={id('next')}
            autoComplete="new-password"
            value={draft.next}
            maxLength={128}
            onChange={(e) => set('next', e.target.value)}
            invalid={Boolean(errors.next)}
            aria-describedby={describedBy(id('next'), errors.next, true)}
          />
        </Field>
        <Field id={id('confirm')} label="New password again" error={errors.confirm}>
          <PasswordInput
            id={id('confirm')}
            autoComplete="new-password"
            value={draft.confirm}
            maxLength={128}
            onChange={(e) => set('confirm', e.target.value)}
            invalid={Boolean(errors.confirm)}
            aria-describedby={describedBy(id('confirm'), errors.confirm)}
          />
        </Field>

        <div className="flex flex-col items-start gap-2">
          <Button type="submit" variant="secondary" disabled={busy}>
            {busy ? 'Changing…' : 'Change password'}
          </Button>
          {done ? <FormNote tone="ok">{done}</FormNote> : null}
          {formError ? <FormNote tone="error">{formError}</FormNote> : null}
        </div>
      </form>
    </MeSection>
  );
}
