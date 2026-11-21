// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { JerseyManager } from '@/components/jerseys/JerseyManager';

const STATE = {
  success: true,
  players: [
    { playerId: 'p001', fullName: 'TestBlue TestLast', team: 'Blue', gender: 'Girl /Gx/', jerseySize: 'AS' },
    { playerId: 'p002', fullName: 'TestGold TestLast', team: 'Gold', gender: 'Boy /Bx/', jerseySize: 'YL' },
  ],
  loans: [
    { loanId: 'l2', playerId: 'p002', playerName: 'TestGold TestLast', size: 'YL', checkedOutAt: '', checkedOutBy: 'x', checkedInAt: '', checkedInBy: '', outcome: '', feeIssued: '', feePaidOn: '', notes: '', rowNumber: 3 },
    { loanId: 'l1', playerId: 'p001', playerName: 'TestBlue TestLast', size: 'AS', checkedOutAt: '', checkedOutBy: 'x', checkedInAt: '', checkedInBy: '', outcome: '', feeIssued: '', feePaidOn: '', notes: '', rowNumber: 2 },
  ],
  stock: [],
  familyJerseys: [],
  notes: [],
};
const CONTACTS = { success: true, contacts: [{ name: 'TestParent TestLast', email: 'parent@example.com' }], cc: ['manager@example.com', 'team@example.com'] };

const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(String(url).includes('/contacts') ? CONTACTS : STATE)));

beforeEach(() => {
  fetchMock.mockClear();
  window.localStorage.clear();
  window.localStorage.setItem('mu_jersey_manager_name', 'TestManager');
  vi.stubGlobal('fetch', fetchMock);
  window.history.replaceState(null, '', '/jerseys#checkin/p001');
});

const contactCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/contacts'));

describe('Parents under More options', () => {
  it('loads parent emails only after More options is opened, then offers a reminder email', async () => {
    render(<JerseyManager workbookUrl="" />);
    await screen.findByRole('button', { name: 'Returned' });
    expect(contactCalls()).toHaveLength(0);

    const details = screen.getByText('More options').closest('details')!;
    details.open = true;
    fireEvent(details, new Event('toggle'));

    const link = await screen.findByRole('link', { name: 'parent@example.com' });
    expect(link.getAttribute('href')).toBe('mailto:parent@example.com');
    expect(contactCalls()).toHaveLength(1);
    expect(String(contactCalls()[0][0])).toBe('/api/jerseys/players/p001/contacts');

    const reminder = screen.getByRole('link', { name: 'Email a jersey reminder' });
    const href = reminder.getAttribute('href')!;
    expect(href.startsWith('mailto:parent@example.com?cc=manager@example.com,team@example.com&subject=')).toBe(true);
    expect(decodeURIComponent(href)).toContain('TestBlue TestLast still has a Madison Ultimate program jersey (Adult Small)');
  });

  it("never shows one family's emails under another player while the new player's contacts load", async () => {
    let releaseSecond: (value: Response) => void = () => {};
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes('/players/p002/contacts')) return new Promise<Response>(resolve => (releaseSecond = resolve));
      return new Response(JSON.stringify(u.includes('/contacts') ? CONTACTS : STATE));
    });

    render(<JerseyManager workbookUrl="" />);
    await screen.findByRole('button', { name: 'Returned' });
    const open = () => {
      const details = screen.getByText('More options').closest('details')!;
      details.open = true;
      fireEvent(details, new Event('toggle'));
    };
    open();
    await screen.findByRole('link', { name: 'parent@example.com' });

    act(() => {
      window.history.replaceState(null, '', '/jerseys#checkin/p002');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await screen.findByRole('heading', { name: 'TestGold TestLast' });
    expect(screen.queryByRole('link', { name: 'parent@example.com' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Email a jersey reminder' })).toBeNull();

    open();
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/players/p002/contacts'))).toBe(true));
    expect(screen.queryByRole('link', { name: 'parent@example.com' })).toBeNull();
    await act(async () => releaseSecond(new Response(JSON.stringify({ success: true, contacts: [{ name: 'TestOther', email: 'other@example.com' }], cc: [] }))));
    await screen.findByRole('link', { name: 'other@example.com' });
    expect(screen.queryByRole('link', { name: 'parent@example.com' })).toBeNull();
  });

  it('shows a malformed sheet address as text, never as a link', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      new Response(JSON.stringify(String(url).includes('/contacts') ? { success: true, contacts: [{ name: 'TestParent', email: 'p@example.com?bcc=x@example.com' }], cc: [] } : STATE))
    );
    render(<JerseyManager workbookUrl="" />);
    await screen.findByRole('button', { name: 'Returned' });
    const details = screen.getByText('More options').closest('details')!;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    await screen.findByText(/not a valid email/);
    expect(screen.queryByRole('link', { name: /p@example\.com/ })).toBeNull();
  });
});
