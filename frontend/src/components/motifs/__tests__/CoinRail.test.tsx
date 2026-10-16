import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CoinRail } from '@/components/motifs/CoinRail';

// Money uses a no-break space between prefix and number.
const text = (el: Element, attr: string) => (el.getAttribute(attr) ?? '').replace(/\u00A0/g, ' ');

describe('CoinRail', () => {
  it('is a meter of what is left in the jar', () => {
    render(<CoinRail target={4000} spent={1660} currency="MYR" />);
    const meter = screen.getByRole('meter', { name: 'Left in the jar' });
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '4000');
    expect(meter).toHaveAttribute('aria-valuenow', '2340');
    expect(text(meter, 'aria-valuetext')).toBe('RM 2,340 left of RM 4,000');
    expect(screen.getByText('RM 2,340 left')).toBeInTheDocument();
    expect(screen.getByText('of RM 4,000')).toBeInTheDocument();
  });

  it('over budget: nothing in the jar, the words say over, and the notch shows', () => {
    const { container } = render(<CoinRail target={20000} spent={21500} currency="THB" />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '20000');
    expect(text(meter, 'aria-valuetext')).toBe('฿ 1,500 over a budget of ฿ 20,000');
    expect(screen.getByText('฿ 1,500 over')).toBeInTheDocument();
    expect(container.querySelector('[data-state="over"]')).not.toBeNull();
    expect(container.querySelector('.bg-stamp')).not.toBeNull();
  });

  it('budget 0: no meter (nothing to measure), a dashed track and "No budget set"', () => {
    const { container } = render(<CoinRail target={0} spent={312} currency="MYR" />);
    expect(screen.queryByRole('meter')).toBeNull();
    expect(screen.getByText('No budget set')).toBeInTheDocument();
    expect(screen.getByText('RM 312 spent')).toBeInTheDocument();
    expect(container.querySelector('.border-dashed')).not.toBeNull();
  });

  it('saving mode: the jar holds saved − spent, not target − spent', () => {
    render(<CoinRail target={6000} spent={2400} inJar={1800} currency="MYR" />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '1800');
    expect(text(meter, 'aria-valuetext')).toBe('RM 1,800 left of RM 6,000');
  });

  it('keeps cents under 100 and rounds float noise in aria values', () => {
    render(<CoinRail target={100} spent={17.499999999} currency="MYR" labels={false} />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '82.5');
    expect(text(meter, 'aria-valuetext')).toBe('RM 82.50 left of RM 100');
  });
});
