// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FinalFormsRow } from '@/components/FinalFormsRow';

function jsonResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as Response;
}

describe('FinalFormsRow — not found', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows last-synced plus a refresh action, and a register-now prompt', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ success: true, found: false, dataAsOf: '2026-08-28T05:15:11Z' })
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<FinalFormsRow preferredFirstName="Casey" playerId="p001" />);

    await waitFor(() => expect(screen.getByText(/Three common reasons/)).toBeInTheDocument());
    const reasons = screen.getAllByRole('listitem');
    expect(reasons[0]).toHaveTextContent(/If you haven't, please do so now/);
    expect(reasons[1]).toHaveTextContent(/Our Final Forms data may be stale/);
    expect(reasons[1]).toHaveTextContent(/It was last refreshed on/);
    expect(reasons[2]).toHaveTextContent(/doesn't match school records/);
    expect(screen.getByRole('button', { name: 'Check Final Forms again' })).toBeInTheDocument();
  });

  it('posts a refresh and shows a live status telling the family to reload', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: true, found: false, dataAsOf: '2026-08-28T05:15:11Z' }))
      .mockResolvedValueOnce(
        jsonResponse({
          message: "Great, we're syncing with Final Forms now. Reload this page in a couple of minutes to see if that worked.",
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    render(<FinalFormsRow preferredFirstName="Casey" playerId="p001" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check Final Forms again' })).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Check Final Forms again' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/Reload this page in a couple of minutes/)
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/signup/finalforms-refresh', { method: 'POST' });
  });
});
