// Expense category labels and codes (spec §3.3). Order comes from design/tokens CATEGORY_ORDER.
import { CATEGORY_ORDER, type CategoryKey } from '@/design/tokens';

export { CATEGORY_ORDER };

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  accommodation: 'Stay',
  transportation: 'Transport',
  activities: 'Activities',
  bundle: 'Packages',
  food: 'Food',
  shopping: 'Shopping',
  other: 'Other',
};

/** Three-letter codes for mono labels and scenes. */
export const CATEGORY_CODES: Record<CategoryKey, string> = {
  accommodation: 'STY',
  transportation: 'TRN',
  activities: 'ACT',
  bundle: 'PKG',
  food: 'FNB',
  shopping: 'SHP',
  other: 'MSC',
};

export function isCategoryKey(value: unknown): value is CategoryKey {
  return typeof value === 'string' && (CATEGORY_ORDER as readonly string[]).includes(value);
}

export function categoryLabel(value: string | null | undefined): string {
  return isCategoryKey(value) ? CATEGORY_LABELS[value] : 'Other';
}
