import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { PackingItem } from '@/types';
import { appEvents, type AppEvent } from '@/lib/appEvents';

vi.mock('@/services/packingService', () => ({
  packingService: {
    getItems: vi.fn(),
    toggleItem: vi.fn(),
    addItem: vi.fn(),
    deleteItem: vi.fn(),
    addPreset: vi.fn(),
  },
}));

import { packingService } from '@/services/packingService';
import { usePacking } from './usePacking';

const item = (id: number, label: string, isChecked: boolean): PackingItem =>
  ({ id, tripId: 2, label, category: 'documents', isChecked, createdAt: '', updatedAt: '' }) as PackingItem;
const passport = item(1, 'Passport', false);
const adapter = item(2, 'Plug adapter', true);

let events: AppEvent[] = [];
let off: () => void;

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, wrapper };
}

beforeEach(() => {
  vi.mocked(packingService.getItems).mockResolvedValue([passport, adapter]);
  events = [];
  off = appEvents.on((e) => events.push(e));
});

afterEach(() => {
  off();
  vi.clearAllMocks();
});

describe('usePacking', () => {
  it('counts progress', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => usePacking(2), { wrapper });
    await waitFor(() => expect(result.current.total).toBe(2));
    expect(result.current.packedCount).toBe(1);
    expect(result.current.progress).toBe(0.5);
  });

  it('toggles optimistically and tells the suitcase scene', async () => {
    let resolve!: (v: PackingItem) => void;
    vi.mocked(packingService.toggleItem).mockReturnValue(new Promise((r) => (resolve = r)));
    const { wrapper } = setup();
    const { result } = renderHook(() => usePacking('2'), { wrapper });
    await waitFor(() => expect(result.current.total).toBe(2));

    let done!: Promise<void>;
    act(() => {
      done = result.current.toggleItem(1);
    });
    await waitFor(() => expect(result.current.items.find((i) => i.id === 1)?.isChecked).toBe(true));
    expect(events).toContainEqual({ type: 'packToggled', tripId: 2, itemId: 1, checked: true });

    vi.mocked(packingService.getItems).mockResolvedValue([{ ...passport, isChecked: true }, adapter]);
    await act(async () => {
      resolve({ ...passport, isChecked: true });
      await done;
    });
    expect(result.current.packedCount).toBe(2);
    expect(packingService.toggleItem).toHaveBeenCalledWith(2, 1);
  });

  it('puts the item back when the server refuses (a viewer, or offline)', async () => {
    vi.mocked(packingService.toggleItem).mockRejectedValue(
      Object.assign(new Error('Forbidden'), {
        isAxiosError: true,
        response: { status: 403, data: { message: "Viewers can't change this trip" } },
      }),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => usePacking(2), { wrapper });
    await waitFor(() => expect(result.current.total).toBe(2));

    let error: unknown;
    await act(async () => {
      await result.current.toggleItem(2).catch((e) => (error = e));
    });
    expect((error as Error).message).toBe("Viewers can't change this trip");
    expect(result.current.items.find((i) => i.id === 2)?.isChecked).toBe(true);
    expect(events.filter((e) => e.type === 'packToggled')).toEqual([
      { type: 'packToggled', tripId: 2, itemId: 2, checked: false },
      { type: 'packToggled', tripId: 2, itemId: 2, checked: true },
    ]);
  });
});
