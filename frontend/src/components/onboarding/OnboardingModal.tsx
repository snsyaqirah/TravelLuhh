// First Google sign-in: a passport data page that asks for home country and home currency (§9.2). It can't be
// dismissed (every total needs a home currency), so both fields start filled: Malaysia and ringgit, or whatever
// the account already has. One tap on Save is enough.
import { useMemo, useState, type FormEvent } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage } from '@/lib/axios';
import { Field, FormAlert } from '@/components/frontdoor/fields';
import { CountryPicker, CurrencySelect } from '@/components/frontdoor/HomeFields';
import { currencyForCountry, initials } from '@/components/frontdoor/authHelpers';
import { getCountryByCode } from '@/data/countries';
import { cn } from '@/lib/utils';

interface OnboardingModalProps {
  open: boolean;
  onComplete: (data: { country: string; currency: string }) => Promise<void>;
}

/** The machine-readable line along the bottom of a passport page. Decorative. */
function mrzLine(name: string, country: string): string {
  const iso3: Record<string, string> = {
    MY: 'MYS',
    SG: 'SGP',
    ID: 'IDN',
    TH: 'THA',
    BN: 'BRN',
    PH: 'PHL',
    VN: 'VNM',
    JP: 'JPN',
    KR: 'KOR',
    GB: 'GBR',
    US: 'USA',
    AU: 'AUS',
  };
  const code = iso3[country] ?? `${country}<`.slice(0, 3);
  const parts = name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[^A-Z\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const surname = parts.length > 1 ? parts[parts.length - 1] : (parts[0] ?? '');
  const given = parts.length > 1 ? parts.slice(0, -1).join('<') : '';
  return `P<${code}${surname}<<${given}`.padEnd(44, '<').slice(0, 44);
}

function PhotoBox({ name, avatar }: { name: string; avatar?: string | null }) {
  const [broken, setBroken] = useState(false);
  const corner = 'pointer-events-none absolute h-2.5 w-2.5 border-ink-2';
  return (
    <div className="relative h-16 w-16 shrink-0 sm:h-[88px] sm:w-[88px]">
      <div className="absolute inset-1 flex items-center justify-center overflow-hidden bg-sunken">
        {avatar && !broken ? (
          <img
            src={avatar}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover grayscale-[30%]"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="font-display text-[26px] font-medium leading-none text-ink-2 sm:text-[34px]">{initials(name) || '··'}</span>
        )}
      </div>
      {/* photo corner mounts */}
      <span aria-hidden="true" className={cn(corner, 'left-0 top-0 border-l-[1.5px] border-t-[1.5px]')} />
      <span aria-hidden="true" className={cn(corner, 'right-0 top-0 border-r-[1.5px] border-t-[1.5px]')} />
      <span aria-hidden="true" className={cn(corner, 'bottom-0 left-0 border-b-[1.5px] border-l-[1.5px]')} />
      <span aria-hidden="true" className={cn(corner, 'bottom-0 right-0 border-b-[1.5px] border-r-[1.5px]')} />
    </div>
  );
}

export function OnboardingModal({ open, onComplete }: OnboardingModalProps) {
  const { user } = useAuth();
  const startCountry = user?.country && getCountryByCode(user.country) ? user.country.toUpperCase() : 'MY';
  const [country, setCountry] = useState(startCountry);
  const [currency, setCurrency] = useState(() => {
    const own = user?.currency?.toUpperCase();
    // Older Google accounts were created with USD as a placeholder; the country is a better guess.
    if (own && own !== 'USD') return own;
    return currencyForCountry(startCountry) ?? 'MYR';
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = user?.name?.trim() || '';
  const mrz = useMemo(() => mrzLine(name || user?.email?.split('@')[0] || '', country), [name, user?.email, country]);

  const onCountry = (code: string) => {
    setCountry(code);
    const implied = currencyForCountry(code);
    if (implied) setCurrency(implied);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      await onComplete({ country, currency });
    } catch (err) {
      setError(getErrorMessage(err, "Your details didn't save. Try again."));
      setSaving(false);
    }
  };

  const keep = (e: Event) => e.preventDefault();

  return (
    <DialogPrimitive.Root open={open}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          onEscapeKeyDown={keep}
          onPointerDownOutside={keep}
          onInteractOutside={keep}
          className="fixed inset-0 z-50 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[520px] overflow-y-auto rounded-lg border border-rule-strong bg-card text-card-foreground shadow-hard duration-ui focus-visible:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          <div className="flex items-center justify-between gap-3 border-b border-rule bg-sunken px-5 py-2.5">
            <span className="type-overline text-ink-2">Pasport · Passport</span>
            <span className="type-overline text-ink-3">TravelLuhh</span>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-5 px-5 pb-4 pt-5">
            <div>
              <DialogPrimitive.Title className="type-display-3 text-ink">Where's home?</DialogPrimitive.Title>
              <DialogPrimitive.Description className="type-body-s mt-1.5 text-ink-2">
                Every trip adds up in your home currency, so your totals make sense. You can change both later in Me.
              </DialogPrimitive.Description>
            </div>

            <div className="flex items-start gap-4">
              <PhotoBox name={name} avatar={user?.avatar} />
              <dl className="grid min-w-0 flex-1 gap-2">
                <div>
                  <dt className="type-overline text-ink-3">Nama · Name</dt>
                  <dd className="type-title truncate text-ink">{name || 'Traveller'}</dd>
                </div>
                {user?.email ? (
                  <div>
                    <dt className="type-overline text-ink-3">Email</dt>
                    <dd className="truncate font-mono text-[13px] text-ink-2">{user.email}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div className="grid grid-cols-1 gap-5 border-t border-dashed border-rule-strong pt-5 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Field id="onboard-country" label="Home country">
                <CountryPicker id="onboard-country" value={country} onChange={onCountry} />
              </Field>
              <Field id="onboard-currency" label="Home currency">
                <CurrencySelect id="onboard-currency" value={currency} onChange={setCurrency} />
              </Field>
            </div>

            {error ? <FormAlert>{error}</FormAlert> : null}

            <Button type="submit" size="lg" className="w-full" disabled={saving}>
              {saving ? 'Saving…' : 'Save and continue'}
            </Button>

            <p
              aria-hidden="true"
              className="select-none overflow-hidden whitespace-nowrap border-t border-rule pt-3 font-mono text-[12px] tracking-[0.12em] text-ink-3"
            >
              {mrz}
            </p>
          </form>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}

export default OnboardingModal;
