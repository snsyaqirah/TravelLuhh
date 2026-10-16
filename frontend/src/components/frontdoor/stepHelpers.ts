import { useEffect, useRef } from 'react';

/**
 * When the step changes (not on first render), move focus into the new step: its first field marked
 * `data-step-focus`, else its heading. Attach the returned ref to the element wrapping the step.
 */
export function useStepFocus<T>(step: T) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const root = ref.current;
    const target = root?.querySelector<HTMLElement>('[data-step-focus]') ?? root?.querySelector<HTMLElement>('h1');
    target?.focus();
  }, [step]);
  return ref;
}

/** Shared password checks; the server repeats them (8–128 characters). */
export function checkNewPassword(password: string, confirm: string): { password?: string; confirm?: string } {
  const out: { password?: string; confirm?: string } = {};
  if (password.length < 8) out.password = 'Use at least 8 characters.';
  else if (password.length > 128) out.password = 'Keep it under 128 characters.';
  if (!out.password && confirm !== password) out.confirm = "The two passwords don't match.";
  return out;
}
