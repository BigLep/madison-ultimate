import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';

vi.mock('@/lib/signups-sheet', () => ({
  findSignupsByLastNameAndBirthdate: vi.fn(),
}));

import { findSignupsByLastNameAndBirthdate } from '@/lib/signups-sheet';
import { POST } from '@/app/api/player/lookup/route';
import { signupRecord } from './fixtures/signup-record';

const findCandidates = vi.mocked(findSignupsByLastNameAndBirthdate);

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/player/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const renderedLongAgo = Date.now() - 10_000;

describe('POST /api/player/lookup (Portal Login)', () => {
  beforeEach(() => {
    findCandidates.mockReset();
  });

  it('rejects a filled honeypot without touching the sheet', async () => {
    const res = await POST(makeRequest({ lastName: 'TestLast', dateOfBirth: '2013-05-12', honeypot: 'x' }));
    expect(res.status).toBe(400);
    expect(findCandidates).not.toHaveBeenCalled();
  });

  it('rejects a submit faster than the minimum time', async () => {
    const res = await POST(makeRequest({ lastName: 'TestLast', dateOfBirth: '2013-05-12', formRenderedAt: Date.now() }));
    expect(res.status).toBe(400);
    expect(findCandidates).not.toHaveBeenCalled();
  });

  it('requires last name and birthdate, never a first name', async () => {
    const res = await POST(makeRequest({ lastName: 'TestLast', formRenderedAt: renderedLongAgo }));
    expect(res.status).toBe(400);
  });

  it('returns notFound when no row matches', async () => {
    findCandidates.mockResolvedValue([]);
    const res = await POST(makeRequest({ lastName: 'TestLast', dateOfBirth: '2013-05-12', formRenderedAt: renderedLongAgo }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.notFound).toBe(true);
  });

  it('returns a single match by PlayerID', async () => {
    findCandidates.mockResolvedValue([
      {
        record: signupRecord({
          [SIGNUPS_COLUMNS.PLAYER_ID]: 'p001',
          [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'TestFirst',
          [SIGNUPS_COLUMNS.LAST_NAME]: 'TestLast',
        }),
        rowNumber: 2,
      },
    ]);
    const res = await POST(makeRequest({ lastName: 'testlast ', dateOfBirth: '2013-05-12', formRenderedAt: renderedLongAgo }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches).toEqual([{ playerId: 'p001', preferredFirstName: 'TestFirst', displayName: 'TestFirst TestLast' }]);
    expect(findCandidates).toHaveBeenCalledWith({ lastName: 'testlast', dateOfBirth: '2013-05-12' });
  });

  it('returns every twin so the family can pick, with preferred first names only', async () => {
    findCandidates.mockResolvedValue([
      {
        record: signupRecord({
          [SIGNUPS_COLUMNS.PLAYER_ID]: 'p001',
          [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'TestOne',
          [SIGNUPS_COLUMNS.LAST_NAME]: 'TestLast',
          [SIGNUPS_COLUMNS.GRADE]: '7',
        }),
        rowNumber: 2,
      },
      {
        record: signupRecord({
          [SIGNUPS_COLUMNS.PLAYER_ID]: 'p002',
          [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'TestTwo',
          [SIGNUPS_COLUMNS.LAST_NAME]: 'TestLast',
          [SIGNUPS_COLUMNS.GRADE]: '7',
        }),
        rowNumber: 3,
      },
    ]);
    const res = await POST(makeRequest({ lastName: 'TestLast', dateOfBirth: '2013-05-12', formRenderedAt: renderedLongAgo }));
    const body = await res.json();
    expect(body.matches.map((m: { playerId: string }) => m.playerId)).toEqual(['p001', 'p002']);
    expect(Object.keys(body.matches[0]).sort()).toEqual(['displayName', 'playerId', 'preferredFirstName']);
  });
});
