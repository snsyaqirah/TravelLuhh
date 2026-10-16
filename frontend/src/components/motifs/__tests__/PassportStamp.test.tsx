import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PassportStamp } from '@/components/motifs/PassportStamp';
import { STAMP_ROTATION_MAX, STAMP_ROTATION_MIN, stampRotation } from '@/components/motifs/stampMath';
import { REGION_BY_CODE, regionOf, stampShapeFor } from '@/components/motifs/regions';

describe('stampRotation', () => {
  it('is deterministic for the same seed and text', () => {
    expect(stampRotation(42, 'BALIK')).toBe(stampRotation(42, 'BALIK'));
    expect(stampRotation('trip-7', 'SIAP')).toBe(stampRotation('trip-7', 'SIAP'));
  });

  it('stays within −6° … +8° and actually varies across seeds', () => {
    const angles = Array.from({ length: 500 }, (_, i) => stampRotation(i, 'BALIK'));
    for (const a of angles) {
      expect(a).toBeGreaterThanOrEqual(STAMP_ROTATION_MIN);
      expect(a).toBeLessThanOrEqual(STAMP_ROTATION_MAX);
    }
    expect(new Set(angles).size).toBeGreaterThan(50);
    expect(Math.min(...angles)).toBeLessThan(-4);
    expect(Math.max(...angles)).toBeGreaterThan(6);
  });

  it('depends on the text too (two stamps on one trip land differently)', () => {
    expect(stampRotation(1, 'BALIK')).not.toBe(stampRotation(1, 'SIAP'));
  });
});

describe('regions', () => {
  it('maps the spec examples to their shapes', () => {
    for (const c of ['MY', 'SG', 'TH', 'ID', 'VN', 'PH', 'JP', 'KR', 'CN', 'TW', 'HK', 'IN']) expect(stampShapeFor(regionOf(c))).toBe('circle');
    for (const c of ['EG', 'MA', 'ZA', 'AE']) expect(stampShapeFor(regionOf(c))).toBe('triangle');
    for (const c of ['AU', 'NZ']) expect(stampShapeFor(regionOf(c))).toBe('oval');
    for (const c of ['US', 'CA', 'MX', 'BR', 'CO', 'PE', 'AR', 'CL']) expect(stampShapeFor(regionOf(c))).toBe('octagon');
    for (const c of ['GB', 'FR', 'DE', 'CZ', 'GR']) expect(stampShapeFor(regionOf(c))).toBe('rect');
  });

  it('covers every destination country and falls back for unknown codes', () => {
    expect(Object.keys(REGION_BY_CODE).length).toBeGreaterThan(44);
    expect(regionOf('jp')).toBe('asia');
    expect(regionOf('XX')).toBe('asia');
    expect(regionOf(undefined, 'europe')).toBe('europe');
  });
});

describe('<PassportStamp>', () => {
  it('draws the region shape at the seeded angle, named for screen readers', () => {
    render(<PassportStamp text="BALIK" code="JP" date="2026-11-20" region="asia" seed={1} size={64} />);
    const stamp = screen.getByRole('img', { name: 'BALIK stamp, 20 Nov' });
    expect(stamp).toHaveAttribute('data-shape', 'circle');
    expect(stamp.style.transform).toBe(`rotate(${stampRotation(1, 'BALIK')}deg)`);
    expect(stamp).toHaveTextContent('JP');
    expect(stamp).toHaveTextContent('20 NOV');
  });

  it('the same stamp renders identically twice', () => {
    const { container: a } = render(<PassportStamp text="SETTLED" region="europe" tone="fund" seed="t9" size={96} />);
    const { container: b } = render(<PassportStamp text="SETTLED" region="europe" tone="fund" seed="t9" size={96} />);
    const svgA = a.querySelector('svg')!;
    const svgB = b.querySelector('svg')!;
    expect(svgA.getAttribute('data-rotation')).toBe(svgB.getAttribute('data-rotation'));
    expect(svgA.getAttribute('data-shape')).toBe('rect');
    expect(svgA).toHaveClass('text-fund');
  });

  it('a decorative stamp is hidden from assistive tech', () => {
    const { container } = render(<PassportStamp text="SIAP" region="oceania" seed={3} size={48} decorative />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('svg')).toHaveAttribute('data-shape', 'oval');
  });
});
