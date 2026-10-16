import { useEffect, useState } from 'react';

function msToNextMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1000, next.getTime() - now.getTime() + 250);
}

/**
 * Today's date that re-renders just after local midnight, so a trip's phase and day number roll over
 * without a reload. Pass a fixed date (tests, demos) to freeze it.
 */
export function useToday(fixed?: Date): Date {
  const [today, setToday] = useState(() => fixed ?? new Date());
  useEffect(() => {
    if (fixed) return;
    const id = window.setTimeout(() => setToday(new Date()), msToNextMidnight(today));
    return () => window.clearTimeout(id);
  }, [fixed, today]);
  return fixed ?? today;
}
