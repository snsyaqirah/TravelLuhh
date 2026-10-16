// Owner only: add someone to the trip by the email they signed up with, as an editor or a viewer. When the
// server says nobody uses that email yet (404), its sentence shows inline with "Copy invite text": a short
// message with the sign-up link to paste into WhatsApp. If the clipboard is blocked, the text is shown to copy.
import { useId, useState, type FormEvent } from 'react';
import type { Member, Trip } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage, getErrorStatus } from '@/lib/axios';
import { copyText } from '@/components/trip/clipboard';
import { ROLE_HINT, addedLine, emailError, inviteText, type MemberRole } from '@/components/people/peopleCopy';

export interface InviteFormProps {
  trip: Pick<Trip, 'name' | 'startDate' | 'endDate'>;
  onInvite: (email: string, role: MemberRole) => Promise<Member>;
  /** Defaults to window.location.origin. */
  origin?: string;
}

type Outcome =
  | { kind: 'added'; text: string }
  | { kind: 'noAccount'; text: string }
  | { kind: 'error'; text: string }
  | null;

type CopyState = 'idle' | 'copied' | 'failed';

export function InviteForm({ trip, onInvite, origin }: InviteFormProps) {
  const ids = useId();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('editor');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [copy, setCopy] = useState<CopyState>('idle');
  const [sending, setSending] = useState(false);

  const message = inviteText(trip, origin ?? (typeof window !== 'undefined' ? window.location.origin : ''));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err = emailError(email);
    setFieldError(err);
    setOutcome(null);
    setCopy('idle');
    if (err) return;
    setSending(true);
    try {
      const m = await onInvite(email.trim(), role);
      setEmail('');
      setOutcome({ kind: 'added', text: addedLine(m) });
    } catch (x) {
      const text = getErrorMessage(x, "That invite didn't go through. Try again.");
      setOutcome({ kind: getErrorStatus(x) === 404 ? 'noAccount' : 'error', text });
    } finally {
      setSending(false);
    }
  };

  const doCopy = async () => setCopy((await copyText(message)) ? 'copied' : 'failed');

  const emailId = `${ids}-email`;
  const errId = `${ids}-email-error`;

  return (
    <form onSubmit={submit} noValidate aria-labelledby={`${ids}-title`} className="flex flex-col gap-4">
      <h3 id={`${ids}-title`} className="type-title text-ink">
        Invite someone
      </h3>

      <div>
        <Label htmlFor={emailId} className="type-label text-ink-2">
          Their email
        </Label>
        <Input
          id={emailId}
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="siti@gmail.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldError) setFieldError(emailError(e.target.value));
          }}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? errId : `${ids}-email-hint`}
          className="mt-2"
        />
        {fieldError ? (
          <p id={errId} className="type-body-s mt-1.5 text-stamp">
            {fieldError}
          </p>
        ) : (
          <p id={`${ids}-email-hint`} className="type-body-s mt-1.5 text-ink-3">
            The one they use to log in to TravelLuhh.
          </p>
        )}
      </div>

      <div>
        <Label htmlFor={`${ids}-role`} className="type-label text-ink-2">
          Role
        </Label>
        <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
          <SelectTrigger id={`${ids}-role`} aria-describedby={`${ids}-role-hint`} className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="editor">Editor</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
        <p id={`${ids}-role-hint`} className="type-body-s mt-1.5 text-ink-3">
          {ROLE_HINT[role]}
        </p>
      </div>

      <Button type="submit" disabled={sending} className="self-start">
        {sending ? 'Inviting…' : 'Invite'}
      </Button>

      {outcome?.kind === 'added' ? (
        <p role="status" className="type-body-s text-fund">
          {outcome.text}
        </p>
      ) : null}
      {outcome?.kind === 'error' ? (
        <p role="alert" className="type-body-s text-stamp">
          {outcome.text}
        </p>
      ) : null}
      {outcome?.kind === 'noAccount' ? (
        <div role="alert" className="flex flex-col items-start gap-3 border-l-[3px] border-brass bg-sunken py-3 pl-3 pr-4">
          <p className="type-body-s text-ink">{outcome.text}</p>
          <Button type="button" variant="secondary" size="sm" onClick={() => void doCopy()}>
            Copy invite text
          </Button>
          <p aria-live="polite" className="type-body-s text-ink-2">
            {copy === 'copied' ? 'Copied. Paste it into WhatsApp or wherever you chat.' : null}
            {copy === 'failed' ? "Couldn't copy here. Select the text below and copy it yourself." : null}
          </p>
          {copy === 'failed' ? (
            <Textarea
              readOnly
              value={message}
              rows={4}
              aria-label="Invite text"
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-[13px]"
            />
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
