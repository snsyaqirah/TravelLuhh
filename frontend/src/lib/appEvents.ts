// Tiny typed event bus. Data hooks emit after a successful mutation; iso scenes subscribe so a coin can
// leave the jar or a packed item can hop into the suitcase. Fire-and-forget — nothing depends on a listener.
import type { CategoryKey } from '@/design/tokens';

export type AppEvent =
  | { type: 'coinOut'; tripId: number; date: string; category: CategoryKey; amount: number }
  | { type: 'coinBack'; tripId: number; date: string; category: CategoryKey; amount: number }
  | { type: 'fundIn'; tripId: number; amount: number }
  | { type: 'packToggled'; tripId: number; itemId: number; checked: boolean };

type Listener = (event: AppEvent) => void;

const listeners = new Set<Listener>();

export const appEvents = {
  emit(event: AppEvent) {
    listeners.forEach((fn) => {
      try {
        fn(event);
      } catch {
        // a broken listener must never break a mutation
      }
    });
  },
  on(fn: Listener) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
