// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JerseyManager } from '@/components/jerseys/JerseyManager';

const STATE = {
  success: true,
  players: [{ playerId: 'p001', fullName: 'TestBlue TestLast', team: 'Blue', gender: 'Girl /Gx/', jerseySize: 'AS' }],
  loans: [
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
});
