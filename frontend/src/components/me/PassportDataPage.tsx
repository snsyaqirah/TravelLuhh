// The Me page header as a passport data page (§9.8): an 88px photo box held by four corner mounts (the
// Google photo, or initials in Newsreader), the name, mono fields HOME COUNTRY · HOME CURRENCY · SINCE ·
// SIGN-IN, and a machine-readable line along the foot that is decoration only (aria-hidden).
import { useState } from 'react';
import type { User } from '@/types';
import { getCountryByCode } from '@/data/countries';
import { cn } from '@/lib/utils';
import { initials, mrzLine, signInLabel, sinceLabel } from '@/components/me/meMath';

const MOUNT = 'pointer-events-none absolute h-3.5 w-3.5 bg-ink-3';
// Photo corners: a right triangle tucked over each corner of the picture.
const CORNERS = [
  { pos: '-left-1 -top-1', clip: 'polygon(0 0, 100% 0, 0 100%)' },
  { pos: '-right-1 -top-1', clip: 'polygon(0 0, 100% 0, 100% 100%)' },
  { pos: '-bottom-1 -left-1', clip: 'polygon(0 0, 100% 100%, 0 100%)' },
  { pos: '-bottom-1 -right-1', clip: 'polygon(100% 0, 100% 100%, 0 100%)' },
];

function PhotoBox({ user }: { user: User }) {
  const [broken, setBroken] = useState<string | null>(null);
  const src = user.avatar && user.avatar !== broken ? user.avatar : null;
  return (
    <div className="relative h-[88px] w-[88px] shrink-0">
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-sm border border-rule-strong bg-sunken">
        {src ? (
          <img
            src={src}
            alt=""
            width={88}
            height={88}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
            onError={() => setBroken(src)}
          />
        ) : (
          <span aria-hidden="true" className="font-display text-[36px] font-medium leading-none text-ink">
            {initials(user)}
          </span>
        )}
      </div>
      {CORNERS.map((c) => (
        <span key={c.pos} aria-hidden="true" className={cn(MOUNT, c.pos)} style={{ clipPath: c.clip }} />
      ))}
    </div>
  );
}

function Field({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="min-w-0">
      <dt className="type-overline text-ink-3">{label}</dt>
      <dd className="mt-0.5 truncate font-mono text-[15px] font-medium leading-6 text-ink" title={title}>
        {value || '—'}
      </dd>
    </div>
  );
}

export interface PassportDataPageProps {
  user: User;
  className?: string;
}

export function PassportDataPage({ user, className }: PassportDataPageProps) {
  const country = (user.country ?? '').toUpperCase();
  const countryName = getCountryByCode(country)?.name;
  const currency = (user.currency ?? '').toUpperCase();
  const since = sinceLabel(user.createdAt);

  return (
    <header className={cn('overflow-hidden rounded-lg border border-rule bg-card', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2 lg:px-5">
        <span className="type-overline text-ink-2">Pasport · Passport</span>
        <span className="type-overline text-ink-3">TravelLuhh</span>
      </div>

      <div className="flex gap-4 px-4 pb-4 pt-5 lg:gap-6 lg:px-5">
        <PhotoBox user={user} />
        <div className="min-w-0 flex-1">
          <p className="type-overline text-ink-3">Name</p>
          <h1 className="type-display-3 mt-0.5 break-words text-ink">{user.name}</h1>
          <p className="mt-1 truncate font-mono text-[13px] leading-5 text-ink-2">{user.email}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 pb-4 sm:grid-cols-4 lg:px-5">
        <Field label="Home country" value={country} title={countryName} />
        <Field label="Home currency" value={currency} />
        <Field label="Since" value={since} />
        <Field label="Sign-in" value={signInLabel(user)} />
      </dl>

      <p
        aria-hidden="true"
        className="select-none overflow-hidden whitespace-nowrap border-t border-rule bg-sunken px-4 py-2 font-mono text-[13px] leading-5 tracking-[0.12em] text-ink-3 lg:px-5"
      >
        {mrzLine(user)}
      </p>
    </header>
  );
}
