// Currency catalogue: names for the currencies a Malaysian traveller is likely to meet. Formatting lives in
// lib/money; live rates in services/currencyService. Every code here is covered by Frankfurter v2.
import { currencyDecimals, currencyPrefix, formatMoney } from '@/lib/money';

export interface CurrencyMeta {
  code: string;
  name: string;
  /** Display prefix from lib/money ('RM', '¥', or the ISO code). */
  prefix: string;
  decimals: number;
}

const NAMES: Record<string, string> = {
  MYR: 'Malaysian Ringgit',
  SGD: 'Singapore Dollar',
  BND: 'Brunei Dollar',
  THB: 'Thai Baht',
  IDR: 'Indonesian Rupiah',
  VND: 'Vietnamese Dong',
  PHP: 'Philippine Peso',
  KHR: 'Cambodian Riel',
  JPY: 'Japanese Yen',
  KRW: 'South Korean Won',
  CNY: 'Chinese Yuan',
  HKD: 'Hong Kong Dollar',
  TWD: 'New Taiwan Dollar',
  INR: 'Indian Rupee',
  PKR: 'Pakistani Rupee',
  BDT: 'Bangladeshi Taka',
  LKR: 'Sri Lankan Rupee',
  NPR: 'Nepalese Rupee',
  MVR: 'Maldivian Rufiyaa',
  UZS: 'Uzbekistan Som',
  AED: 'UAE Dirham',
  SAR: 'Saudi Riyal',
  QAR: 'Qatari Riyal',
  JOD: 'Jordanian Dinar',
  TRY: 'Turkish Lira',
  EGP: 'Egyptian Pound',
  MAD: 'Moroccan Dirham',
  ZAR: 'South African Rand',
  GBP: 'British Pound',
  EUR: 'Euro',
  CHF: 'Swiss Franc',
  SEK: 'Swedish Krona',
  NOK: 'Norwegian Krone',
  DKK: 'Danish Krone',
  ISK: 'Icelandic Krona',
  PLN: 'Polish Zloty',
  CZK: 'Czech Koruna',
  HUF: 'Hungarian Forint',
  RON: 'Romanian Leu',
  USD: 'US Dollar',
  CAD: 'Canadian Dollar',
  MXN: 'Mexican Peso',
  BRL: 'Brazilian Real',
  ARS: 'Argentine Peso',
  CLP: 'Chilean Peso',
  COP: 'Colombian Peso',
  PEN: 'Peruvian Sol',
  AUD: 'Australian Dollar',
  NZD: 'New Zealand Dollar',
};

export const CURRENCY_CODES: readonly string[] = Object.keys(NAMES);

export function getCurrencyName(code: string | null | undefined): string {
  const c = (code ?? '').toUpperCase();
  return NAMES[c] ?? c;
}

export function getCurrencyMeta(code: string): CurrencyMeta {
  const c = code.toUpperCase();
  return { code: c, name: getCurrencyName(c), prefix: currencyPrefix(c), decimals: currencyDecimals(c) };
}

export const CURRENCIES: readonly CurrencyMeta[] = CURRENCY_CODES.map(getCurrencyMeta);

/** @deprecated Use formatMoney from lib/money. Kept for older imports. */
export function formatCurrency(amount: number, currencyCode: string): string {
  return formatMoney(amount, currencyCode);
}
