// Details (§9.8): the name, editable; the email, read-only. Saves through useMe().updateProfile and says so
// right under the button.
import { useEffect, useId, useState, type FormEvent } from 'react';
import type { UpdateProfileRequest, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorMessage } from '@/lib/axios';
import { FieldError, FormNote, MeSection } from '@/components/me/MeSection';
import { nameError } from '@/components/me/meMath';

export interface DetailsSectionProps {
  user: User;
  onSave: (data: UpdateProfileRequest) => Promise<User>;
}

export function DetailsSection({ user, onSave }: DetailsSectionProps) {
  const ids = useId();
  const [name, setName] = useState(user.name ?? '');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Follow the server's copy until the person starts typing.
  useEffect(() => {
    if (!touched) setName(user.name ?? '');
  }, [user.name, touched]);

  const dirty = name.trim() !== (user.name ?? '').trim();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err = nameError(name);
    setFieldError(err);
    setFormError(null);
    setSaved(false);
    if (err || !dirty) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim() });
      setTouched(false);
      setSaved(true);
    } catch (x) {
      setFormError(getErrorMessage(x, "Your name didn't save. Try again."));
    } finally {
      setSaving(false);
    }
  };

  const nameId = `${ids}-name`;
  const nameErrId = `${ids}-name-error`;

  return (
    <MeSection id={`${ids}-title`} title="Details">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <div>
          <Label htmlFor={nameId} className="type-label text-ink-2">
            Name
          </Label>
          <Input
            id={nameId}
            autoComplete="name"
            value={name}
            maxLength={120}
            onChange={(e) => {
              setName(e.target.value);
              setTouched(true);
              setSaved(false);
              if (fieldError) setFieldError(nameError(e.target.value));
            }}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? nameErrId : undefined}
            className="mt-2"
          />
          <FieldError id={nameErrId}>{fieldError}</FieldError>
        </div>

        <dl>
          <dt className="type-label text-ink-2">Email</dt>
          <dd className="mt-2 break-all font-mono text-[15px] leading-6 text-ink">{user.email}</dd>
          <dd className="type-body-s mt-1 text-ink-3">Your sign-in email can't be changed here.</dd>
        </dl>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button type="submit" disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save name'}
          </Button>
          {saved ? <FormNote tone="ok">Saved.</FormNote> : null}
          {formError ? <FormNote tone="error">{formError}</FormNote> : null}
        </div>
      </form>
    </MeSection>
  );
}
