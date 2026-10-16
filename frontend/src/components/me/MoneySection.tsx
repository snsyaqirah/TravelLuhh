// Money (§9.8): home country and home currency (every cross-trip total is converted into it), saved through
// useMe().updateProfile; then the favourite currencies for the Rates board, at most four, kept on this
// device by currencyService. Picking a country fills in its currency, which can still be changed.
import { useEffect, useId, useState, type FormEvent } from 'react';
import type { UpdateProfileRequest, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CountryPicker, CurrencySelect } from '@/components/frontdoor/HomeFields';
import { currencyService } from '@/services/currencyService';
import { getCountryByCode } from '@/data/countries';
import { CURRENCY_CODES, getCurrencyName } from '@/lib/currency';
import { getErrorMessage } from '@/lib/axios';
import { cn } from '@/lib/utils';
import { FieldError, FormNote, MeSection } from '@/components/me/MeSection';
import { FAVOURITE_CHOICES, MAX_FAVOURITES, toggleFavourite } from '@/components/me/meMath';

export interface MoneySectionProps {
  user: User;
  onSave: (data: UpdateProfileRequest) => Promise<User>;
}

function initialFavourites(home: string): string[] {
  const saved = currencyService.getFavorites().filter((c) => c !== home);
  return saved.length ? saved : currencyService.getFavoritesOrDefault(home, MAX_FAVOURITES);
}

function Favourites({ home }: { home: string }) {
  const ids = useId();
  const [list, setList] = useState(() => initialFavourites(home));
  const [changed, setChanged] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const choices = FAVOURITE_CHOICES.filter((c) => c !== home && CURRENCY_CODES.includes(c));
  const full = list.length >= MAX_FAVOURITES;

  // A new home currency can't also be a favourite.
  useEffect(() => {
    setList((l) => (l.includes(home) ? l.filter((c) => c !== home) : l));
  }, [home]);

  const toggle = (code: string) => {
    if (!list.includes(code) && full) {
      // Nothing changes; say why instead of quietly ignoring the tap.
      setBlocked(code);
      return;
    }
    const next = toggleFavourite(list, code, home);
    setList(next);
    currencyService.saveFavorites(next);
    setChanged(true);
    setBlocked(null);
  };

  return (
    <fieldset aria-describedby={`${ids}-hint`}>
      <legend className="type-label text-ink-2">Favourite currencies for Rates</legend>
      <p id={`${ids}-hint`} className="type-body-s mt-1 text-ink-3">
        Up to {MAX_FAVOURITES}, in the order you pick them. Home's rates board shows the first three. Saved on this device.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {choices.map((code) => {
          const on = list.includes(code);
          const order = list.indexOf(code) + 1;
          return (
            <li key={code}>
              <button
                type="button"
                aria-pressed={on}
                aria-label={`${getCurrencyName(code)} (${code})${on ? `, favourite ${order}` : ''}`}
                onClick={() => toggle(code)}
                className={cn(
                  'pressable inline-flex h-11 min-w-[64px] items-center justify-center gap-1.5 rounded-sm border px-3 font-mono text-[13px] font-medium tracking-[0.04em] transition-colors duration-micro',
                  on ? 'border-ink bg-ink text-paper' : 'border-rule-strong bg-leaf text-ink hover:border-ink',
                )}
              >
                {on ? (
                  <span aria-hidden="true" className="text-[11px] text-paper/70">
                    {order}
                  </span>
                ) : null}
                {code}
              </button>
            </li>
          );
        })}
      </ul>
      <div aria-live="polite" className="mt-2 min-h-5">
        {blocked ? (
          <p className="type-body-s text-stamp">That's four already. Remove one before adding {blocked}.</p>
        ) : changed && full ? (
          <p className="type-body-s text-fund">Saved: {list.join(' · ')}. That's the most you can pick.</p>
        ) : changed && list.length === 0 ? (
          <p className="type-body-s text-ink-2">None picked, so Home shows SGD, JPY and THB.</p>
        ) : changed ? (
          <p className="type-body-s text-fund">Saved: {list.join(' · ')}.</p>
        ) : null}
      </div>
    </fieldset>
  );
}

export function MoneySection({ user, onSave }: MoneySectionProps) {
  const ids = useId();
  const serverCountry = (user.country ?? '').toUpperCase();
  const serverCurrency = (user.currency ?? '').toUpperCase();
  const [country, setCountry] = useState(serverCountry);
  const [currency, setCurrency] = useState(serverCurrency);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ country?: string; currency?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    if (touched) return;
    setCountry(serverCountry);
    setCurrency(serverCurrency);
  }, [serverCountry, serverCurrency, touched]);

  const dirty = country !== serverCountry || currency !== serverCurrency;

  const pickCountry = (code: string) => {
    const before = getCountryByCode(country)?.currency;
    const after = getCountryByCode(code)?.currency;
    setCountry(code);
    // Follow the country's currency unless the person had picked something else on purpose.
    if (after && (!currency || currency === before)) setCurrency(after);
    setTouched(true);
    setSavedNote(null);
    setErrors((e) => ({ ...e, country: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      country: country ? undefined : 'Pick your home country.',
      currency: currency ? undefined : 'Pick your home currency.',
    };
    setErrors(next);
    setFormError(null);
    setSavedNote(null);
    if (next.country || next.currency || !dirty) return;
    setSaving(true);
    try {
      await onSave({ country, currency });
      setTouched(false);
      setSavedNote(`Saved. Totals across trips now show in ${currency}.`);
    } catch (x) {
      setFormError(getErrorMessage(x, "Your home settings didn't save. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <MeSection id={`${ids}-title`} title="Money" description="Home, Trips and Passport add up your trips in your home currency.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
          <div>
            <Label htmlFor={`${ids}-country`} className="type-label text-ink-2">
              Home country
            </Label>
            <div className="mt-2">
              <CountryPicker
                id={`${ids}-country`}
                value={country}
                onChange={pickCountry}
                invalid={Boolean(errors.country)}
                describedBy={errors.country ? `${ids}-country-error` : undefined}
              />
            </div>
            <FieldError id={`${ids}-country-error`}>{errors.country}</FieldError>
          </div>
          <div>
            <Label htmlFor={`${ids}-currency`} className="type-label text-ink-2">
              Home currency
            </Label>
            <div className="mt-2">
              <CurrencySelect
                id={`${ids}-currency`}
                value={currency}
                onChange={(c) => {
                  setCurrency(c);
                  setTouched(true);
                  setSavedNote(null);
                  setErrors((e) => ({ ...e, currency: undefined }));
                }}
                invalid={Boolean(errors.currency)}
                describedBy={errors.currency ? `${ids}-currency-error` : undefined}
              />
            </div>
            <FieldError id={`${ids}-currency-error`}>{errors.currency}</FieldError>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button type="submit" disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save home settings'}
          </Button>
          {savedNote ? <FormNote tone="ok">{savedNote}</FormNote> : null}
          {formError ? <FormNote tone="error">{formError}</FormNote> : null}
        </div>
      </form>

      <div className="mt-8">
        <Favourites home={serverCurrency || 'MYR'} />
      </div>
    </MeSection>
  );
}
