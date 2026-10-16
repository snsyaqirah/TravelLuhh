import type { ReactNode } from 'react';

export function fieldIds(id: string) {
  return { error: `${id}-error`, hint: `${id}-hint` };
}

/** The aria-describedby value for a field: its error when there is one, else its hint. */
export function describedBy(id: string, error?: string | null, hint?: ReactNode): string | undefined {
  const ids = fieldIds(id);
  if (error) return ids.error;
  return hint ? ids.hint : undefined;
}
