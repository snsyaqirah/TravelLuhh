// Pure text helpers shared by the trip forms (Create steps, Edit sheet, review ticket).
import type { BudgetType, Season } from '@/types';
import { currencyDecimals, parseMoneyInput } from '@/lib/money';
import { getCountryByCode } from '@/data/countries';
import { seasonMeta } from '@/data/seasons';

/** '3000' → '3,000'; '1250.5' → '1,250.50'; unreadable text is left alone for the error to point at. */
export function tidyMoneyText(text: string, currency: string): string {
  const n = parseMoneyInput(text, currency);
  if (n == null || n < 0) return text;
  const whole = Number.isInteger(n);
  const d = whole ? 0 : currencyDecimals(currency);
  return new Intl.NumberFormat('en-MY', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
}

export const PARTY_OPTIONS: readonly { value: BudgetType; title: string; line: string }[] = [
  { value: 'solo', title: 'Just me', line: 'One jar, your money.' },
  { value: 'shared', title: 'Geng, one pot', line: 'One big jar. Everyone drops in, everyone spends from it.' },
  { value: 'separated', title: 'Geng, own money', line: 'A jar each. Everyone keeps track of their own.' },
];

export function partyTitle(type: BudgetType | null | undefined): string {
  return PARTY_OPTIONS.find((o) => o.value === type)?.title ?? '';
}

/** 'Autumn in Japan' · 'Tropical, all year in Thailand'. */
export function seasonPhrase(season: Season, country: string | null): string {
  const name = getCountryByCode(country)?.name;
  const label = seasonMeta(season).label;
  if (!name) return label;
  return season === 'tropical' ? `Tropical, all year in ${name}` : `${label} in ${name}`;
}
