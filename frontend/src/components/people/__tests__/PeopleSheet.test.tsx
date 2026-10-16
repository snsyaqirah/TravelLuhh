// People sheet: the owner's invite form shows the server's "no account yet" sentence inline with a way to
// share an invite, other errors stay plain, and non-owners get the list and Leave trip, nothing else.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Member, Trip } from '@/types';
import { AppError } from '@/lib/axios';
import { PeopleSheet } from '@/components/trip/sheets/PeopleSheet';

vi.setConfig({ testTimeout: 20_000 });

const NO_ACCOUNT = 'No TravelLuhh account uses that email yet. Ask them to sign up first.';

const members: Member[] = [
  { id: 2, userId: 3, name: 'Syaqirah', email: 'syaqirah@example.test', role: 'owner', joinedAt: '2026-09-01T10:00:00' },
  { id: 3, userId: 4, name: 'Aiman Hakim', email: 'aiman@example.test', role: 'editor', joinedAt: '2026-09-02T10:00:00' },
  { id: 4, userId: 5, name: 'Siti Aisyah', email: 'siti@example.test', role: 'editor', joinedAt: '2026-09-03T10:00:00' },
];

const hook = vi.hoisted(() => ({
  addMember: vi.fn(),
  updateRole: vi.fn(),
  removeMember: vi.fn(),
  leaveTrip: vi.fn(),
  userId: 3,
}));

vi.mock('@/hooks/useMembers', () => ({
  useMembers: () => ({
    members,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    addMember: hook.addMember,
    updateRole: hook.updateRole,
    removeMember: hook.removeMember,
    leaveTrip: hook.leaveTrip,
    isSaving: false,
  }),
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: hook.userId, name: 'Someone' } }) }));
vi.mock('@/components/shell/useMediaQuery', () => ({ useMediaQuery: () => false, DESKTOP_QUERY: '(min-width: 1024px)' }));

function makeTrip(over: Partial<Trip> = {}): Trip {
  return {
    id: 2,
    ownerId: 3,
    name: 'Tokyo autumn',
    destinationCountry: 'JP',
    startDate: '2026-10-12',
    endDate: '2026-10-20',
    budget: 4000,
    currency: 'MYR',
    budgetType: 'shared',
    isArchived: false,
    createdAt: '2026-09-01T10:00:00',
    updatedAt: '2026-09-01T10:00:00',
    members,
    myRole: 'owner',
    ...over,
  };
}

function renderSheet(trip: Trip) {
  return render(
    <MemoryRouter>
      <PeopleSheet trip={trip} open onOpenChange={() => {}} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  hook.addMember.mockReset();
  hook.userId = 3;
});
afterEach(cleanup);

describe('PeopleSheet (owner)', () => {
  it('lists the owner first, with a role chip, and gives the others a role picker and Remove', () => {
    renderSheet(makeTrip());
    const list = screen.getByRole('list', { name: 'People on this trip' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Syaqirah (you)');
    expect(within(rows[0]).getByText('Owner')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Role for Aiman Hakim' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Siti Aisyah' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Leave trip' })).not.toBeInTheDocument();
  });

  it('checks the email before sending anything', () => {
    renderSheet(makeTrip());
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
    expect(screen.getByText('Type their email address.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Their email'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
    expect(screen.getByText("That doesn't look like an email address.")).toBeInTheDocument();
    expect(hook.addMember).not.toHaveBeenCalled();
  });

  it('shows the 404 sentence inline and offers invite text with the sign-up link', async () => {
    hook.addMember.mockRejectedValue(new AppError(NO_ACCOUNT, { status: 404 }));
    renderSheet(makeTrip());
    fireEvent.change(screen.getByLabelText('Their email'), { target: { value: ' farah@gmail.com ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));

    expect(await screen.findByText(NO_ACCOUNT)).toBeInTheDocument();
    expect(hook.addMember).toHaveBeenCalledWith('farah@gmail.com', 'editor');

    // jsdom has no clipboard, so the text is shown to copy by hand.
    fireEvent.click(screen.getByRole('button', { name: 'Copy invite text' }));
    const text = (await screen.findByRole('textbox', { name: 'Invite text' })) as HTMLTextAreaElement;
    expect(text.value).toContain('Tokyo autumn (12–20 Oct)');
    expect(text.value).toContain(`${window.location.origin}/register`);
    expect(screen.getByText(/Couldn't copy here/)).toBeInTheDocument();
  });

  it('shows other errors (already on the trip) without the invite text', async () => {
    hook.addMember.mockRejectedValue(new AppError('Siti Aisyah is already on this trip', { status: 409 }));
    renderSheet(makeTrip());
    fireEvent.change(screen.getByLabelText('Their email'), { target: { value: 'siti@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
    expect(await screen.findByText('Siti Aisyah is already on this trip')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy invite text' })).not.toBeInTheDocument();
  });

  it('confirms a successful invite in words', async () => {
    hook.addMember.mockResolvedValue({ ...members[2], id: 9, role: 'viewer' });
    renderSheet(makeTrip());
    fireEvent.change(screen.getByLabelText('Their email'), { target: { value: 'siti@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
    await waitFor(() => expect(screen.getByText('Siti Aisyah is on the trip as a viewer.')).toBeInTheDocument());
    expect((screen.getByLabelText('Their email') as HTMLInputElement).value).toBe('');
  });
});

describe('PeopleSheet (not the owner)', () => {
  it('editors see the list and Leave trip, but no invite or role controls', () => {
    hook.userId = 4;
    renderSheet(makeTrip({ myRole: 'editor' }));
    expect(screen.getByText(/Only Syaqirah can invite or remove people/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Their email')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave trip' })).toBeInTheDocument();
  });

  it('viewers are read-only and asked to leave only after a confirm', () => {
    hook.userId = 4;
    renderSheet(makeTrip({ myRole: 'viewer' }));
    expect(screen.getByText(/can't change it/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Leave trip' }));
    expect(screen.getByRole('alertdialog', { name: 'Leave Tokyo autumn?' })).toBeInTheDocument();
    expect(hook.leaveTrip).not.toHaveBeenCalled();
  });
});
