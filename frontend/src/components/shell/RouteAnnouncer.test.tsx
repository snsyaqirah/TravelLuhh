import { render, screen } from '@testing-library/react';
import { RouteAnnouncer } from '@/components/shell/RouteAnnouncer';
import { documentTitleFor } from '@/components/shell/routeMeta';

function Frame(props: { title: string; pageKey: string }) {
  return (
    <>
      <RouteAnnouncer {...props} />
      <main id="main" tabIndex={-1}>
        <button type="button">Inside</button>
      </main>
    </>
  );
}

describe('RouteAnnouncer', () => {
  it('builds the tab title', () => {
    expect(documentTitleFor('Tokyo autumn')).toBe('Tokyo autumn · TravelLuhh');
    expect(documentTitleFor('  ')).toBe('TravelLuhh');
  });

  it('keeps document.title in step and stays quiet on first load', () => {
    render(<Frame title="Home" pageKey="/home" />);
    expect(document.title).toBe('Home · TravelLuhh');
    expect(screen.getByRole('status')).toHaveTextContent('');
    expect(document.activeElement).not.toBe(document.getElementById('main'));
  });

  it('on a page change: moves focus to main and announces the title once it is known', () => {
    const { rerender } = render(<Frame title="Trips" pageKey="/trips" />);
    rerender(<Frame title="" pageKey="/trips/2" />);
    expect(document.activeElement).toBe(document.getElementById('main'));
    expect(screen.getByRole('status')).toHaveTextContent('');
    rerender(<Frame title="Tokyo autumn" pageKey="/trips/2" />);
    expect(screen.getByRole('status')).toHaveTextContent('Tokyo autumn');
    expect(document.title).toBe('Tokyo autumn · TravelLuhh');
  });

  it('a tab switch inside the same page neither moves focus nor re-announces', () => {
    const { rerender } = render(<Frame title="Trips" pageKey="/trips" />);
    rerender(<Frame title="Tokyo autumn" pageKey="/trips/2" />);
    screen.getByRole('button', { name: 'Inside' }).focus();
    rerender(<Frame title="Tokyo autumn" pageKey="/trips/2" />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Inside' }));
  });
});
