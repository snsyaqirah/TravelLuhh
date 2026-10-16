import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { applyChromeEntry, mergeChrome, useShellChrome, useShellOverrides, type ShellChrome } from '@/components/shell/chrome';
import { ShellProvider } from '@/components/shell/ShellProvider';

describe('chrome entries', () => {
  it('merges field by field, later entries winning, undefined never overriding', () => {
    expect(
      mergeChrome([
        ['a', { title: 'Trips', hideBottomBar: true }],
        ['b', { title: 'Tokyo', hideBottomBar: undefined }],
      ])
    ).toEqual({ title: 'Tokyo', hideBottomBar: true });
  });

  it('replaces in place and removes', () => {
    const one = applyChromeEntry([], 'a', { title: 'A' });
    const two = applyChromeEntry(one, 'b', { title: 'B' });
    const replaced = applyChromeEntry(two, 'a', { title: 'A2' });
    expect(replaced.map(([id]) => id)).toEqual(['a', 'b']);
    expect(mergeChrome(replaced).title).toBe('B');
    expect(applyChromeEntry(replaced, 'b', null).map(([id]) => id)).toEqual(['a']);
    expect(applyChromeEntry(one, 'zz', null)).toBe(one);
  });
});

function Probe() {
  const o = useShellOverrides();
  return <output data-testid="probe">{JSON.stringify(o)}</output>;
}

function Page({ chrome }: { chrome: ShellChrome }) {
  useShellChrome(chrome);
  return null;
}

function Harness() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(true);
  return (
    <ShellProvider>
      {mounted ? <Page chrome={{ title: 'Tokyo', hideBottomBar: open }} /> : null}
      <button onClick={() => setOpen((v) => !v)}>sheet</button>
      <button onClick={() => setMounted(false)}>leave</button>
      <Probe />
    </ShellProvider>
  );
}

describe('useShellChrome', () => {
  it('applies while mounted, follows changes, and cleans up on unmount', () => {
    render(<Harness />);
    const read = () => JSON.parse(screen.getByTestId('probe').textContent || '{}');
    expect(read()).toEqual({ title: 'Tokyo', hideBottomBar: false });
    fireEvent.click(screen.getByText('sheet'));
    expect(read()).toEqual({ title: 'Tokyo', hideBottomBar: true });
    fireEvent.click(screen.getByText('leave'));
    expect(read()).toEqual({});
  });

  it('is a no-op without a provider', () => {
    expect(() => render(<Page chrome={{ title: 'Alone' }} />)).not.toThrow();
  });
});
