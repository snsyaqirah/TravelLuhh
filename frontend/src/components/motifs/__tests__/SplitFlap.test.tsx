import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SplitFlap } from '@/components/motifs/SplitFlap';

describe('SplitFlap', () => {
  it('reads as one value, with the label', () => {
    render(<SplitFlap value={28} label="DAYS" />);
    const flap = screen.getByRole('img', { name: '28 days' });
    expect(flap.querySelectorAll('.bg-ink')).toHaveLength(2);
    expect(flap).toHaveTextContent('28');
  });

  it('takes an explicit accessible name', () => {
    render(<SplitFlap value="482913" ariaLabel="Code 4 8 2 9 1 3" />);
    expect(screen.getByRole('img', { name: 'Code 4 8 2 9 1 3' })).toBeInTheDocument();
  });

  it('only the changed cell remounts when the value changes', () => {
    const { rerender } = render(<SplitFlap value="28" />);
    const before = screen.getByRole('img').querySelectorAll('.font-mono');
    const [tens, ones] = Array.from(before);
    rerender(<SplitFlap value="27" />);
    const after = Array.from(screen.getByRole('img').querySelectorAll('.font-mono'));
    expect(screen.getByRole('img', { name: '27' })).toBeInTheDocument();
    expect(after[0]).toBe(tens); // '2' untouched
    expect(after[1]).not.toBe(ones); // '8' → '7' flipped
    expect(after[1]).toHaveTextContent('7');
  });

  it('grows and shrinks with the number of characters', () => {
    const { rerender } = render(<SplitFlap value={100} />);
    expect(screen.getByRole('img').querySelectorAll('.bg-ink')).toHaveLength(3);
    rerender(<SplitFlap value={9} />);
    expect(screen.getByRole('img', { name: '9' }).querySelectorAll('.bg-ink')).toHaveLength(1);
  });
});
