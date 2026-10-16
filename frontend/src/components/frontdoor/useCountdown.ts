import { useCallback, useEffect, useState } from 'react';

/**
 * A whole-second countdown for "Send a new code in 42s". `start(n)` (re)starts it; it stops at 0 by itself.
 * Uses a deadline, so a throttled background tab still lands on the right number when it wakes up.
 */
export function useCountdown() {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline == null) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= deadline) {
        setDeadline(null);
        window.clearInterval(id);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [deadline]);

  const start = useCallback((seconds: number) => {
    const t = Date.now();
    setNow(t);
    setDeadline(seconds > 0 ? t + seconds * 1000 : null);
  }, []);

  const seconds = deadline == null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
  return { seconds, start };
}
