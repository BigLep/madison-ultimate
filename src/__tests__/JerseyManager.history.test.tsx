// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JerseyManager } from '@/components/jerseys/JerseyManager';

const STATE = {
  success: true,
  players: [
    { playerId: 'p001', fullName: 'TestBlue TestLast', team: 'Blue', gender: 'Girl /Gx/', jerseySize: 'AS' },
    { playerId: 'p002', fullName: 'TestGold TestLast', team: 'Gold', gender: 'Boy /Bx/', jerseySize: 'YL' },
  ],
  loans: [
    { loanId: 'l1', playerId: 'p001', playerName: 'TestBlue TestLast', size: 'AS', checkedOutAt: '', checkedOutBy: 'x', checkedInAt: '', checkedInBy: '', outcome: '', feeIssued: '', feePaidOn: '', notes: '', rowNumber: 2 },
    { loanId: 'l2', playerId: 'p002', playerName: 'TestGold TestLast', size: 'YL', checkedOutAt: '', checkedOutBy: 'x', checkedInAt: '', checkedInBy: '', outcome: '', feeIssued: '', feePaidOn: '', notes: '', rowNumber: 3 },
  ],
  stock: [],
  familyJerseys: [],
  notes: [],
};

function goTo(url: string) {
  window.history.replaceState(null, '', url);
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('mu_jersey_manager_name', 'TestManager');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(STATE))));
  goTo('/jerseys');
});

describe('JerseyManager URL state', () => {
  it('restores filters from the URL when the back button changes only the query', async () => {
    goTo('/jerseys?team=Blue#checkin');
    render(<JerseyManager workbookUrl="" />);
    await screen.findByText('TestBlue TestLast');
    expect(screen.queryByText('TestGold TestLast')).toBeNull();

    // Simulate Back landing on an entry whose query names Gold instead.
    act(() => {
      goTo('/jerseys?team=Gold#checkin');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await screen.findByText('TestGold TestLast');
    expect(screen.queryByText('TestBlue TestLast')).toBeNull();
    expect((screen.getByRole('checkbox', { name: /Gold/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: /Blue/ }) as HTMLInputElement).checked).toBe(false);
    expect(window.location.search).toBe('?team=Gold');
  });

  it('a restored entry with no filters shows everyone, even with saved filters on the device', async () => {
    window.localStorage.setItem('jerseys-filter-teams', JSON.stringify(['Blue']));
    goTo('/jerseys#checkin');
    render(<JerseyManager workbookUrl="" />);
    await screen.findByText('TestBlue TestLast');
    expect(screen.queryByText('TestGold TestLast')).toBeNull(); // first load uses the saved filter

    act(() => {
      goTo('/jerseys#players');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() => expect(screen.getByText('TestGold TestLast')).toBeTruthy());
  });

  it('opens the player named in the hash, and survives a damaged one', async () => {
    goTo('/jerseys#checkin/%');
    render(<JerseyManager workbookUrl="" />);
    await screen.findByText('TestBlue TestLast');
    await userEvent.click(screen.getByRole('button', { name: /TestBlue TestLast/ }));
    await waitFor(() => expect(window.location.hash).toBe('#checkin/p001'));
    await screen.findByRole('button', { name: 'Returned' });
  });
});
