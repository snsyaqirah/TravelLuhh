// Small pure helpers for the front door (login, register, forgot, OAuth). No React, no network.
import { getErrorMessage, getRetryAfter } from '@/lib/axios';
import { getCountryByCode } from '@/data/countries';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** "syaqirah@gmail.com" → "s•••@gmail.com". Anything that isn't an email comes back unchanged. */
export function maskEmail(email: string): string {
  const e = email.trim();
  const at = e.lastIndexOf('@');
  if (at < 1) return e;
  return `${e.charAt(0)}•••${e.slice(at)}`;
}

/**
 * Seconds to wait before asking for another code. The backend sends Retry-After on 429, but the browser only
 * sees it when CORS exposes the header, so the number in the message ("Wait 42 seconds…") is the backup.
 */
export function retryAfterSeconds(err: unknown, fallback = 60): number {
  const header = getRetryAfter(err);
  if (header != null) return Math.max(1, header);
  const m = /(\d+)\s*seconds?/i.exec(getErrorMessage(err, ''));
  if (m) return Math.max(1, Number(m[1]));
  return fallback;
}

export type StrengthLevel = 0 | 1 | 2 | 3;

export interface PasswordStrength {
  /** 0 too short, 1 okay, 2 good, 3 strong. */
  level: StrengthLevel;
  label: string;
  hint: string;
}

/**
 * A plain hint, not a gate: the server only needs 8–128 characters. Length counts most; mixing letter case,
 * digits and symbols adds one step.
 */
export function passwordStrength(pw: string): PasswordStrength {
  if (pw.length < 8) {
    const left = 8 - pw.length;
    return {
      level: 0,
      label: 'Too short',
      hint: pw.length === 0 ? 'At least 8 characters.' : `${left} more character${left === 1 ? '' : 's'} to go.`,
    };
  }
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  let level: StrengthLevel = 1;
  if (pw.length >= 12) level = 2;
  if ((pw.length >= 12 && classes >= 3) || pw.length >= 16) level = 3;
  else if (classes >= 3 && level < 2) level = 2;
  const label = level === 3 ? 'Strong' : level === 2 ? 'Good' : 'Okay';
  const hint =
    level === 3
      ? 'Long and mixed. Nice.'
      : level === 2
        ? 'A few more characters makes it strong.'
        : 'Longer is stronger. A short phrase works well.';
  return { level, label, hint };
}

/** "Syaqirah Osman" → "SO"; one word → first two letters. */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/** The currency a home country implies, or null for codes we don't know. */
export function currencyForCountry(code: string | null | undefined): string | null {
  return getCountryByCode(code)?.currency ?? null;
}
