import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';

vi.mock('@/lib/signups-sheet', () => ({
  findSignupByIdentity: vi.fn(),
  findNearMatches: vi.fn(),
  createSignupRow: vi.fn(),
}));

vi.mock('@/lib/signup-deadlines', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/signup-deadlines')>();
  return {
    ...actual,
    getDeadlineState: vi.fn(() => 'open'),
  };
});

import { findSignupByIdentity, findNearMatches, createSignupRow } from '@/lib/signups-sheet';
import { getDeadlineState } from '@/lib/signup-deadlines';
import { POST } from '@/app/api/signup/lookup/route';
import { signupRecord } from './fixtures/signup-record';

const findIdentity = vi.mocked(findSignupByIdentity);
const findNear = vi.mocked(findNearMatches);
const createRow = vi.mocked(createSignupRow);
const deadlineState = vi.mocked(getDeadlineState);

function lookupRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/signup/lookup', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const identityBody = {
  preferredFirstName: 'Afirst',
  lastName: 'Blast',
  dateOfBirth: '2014-05-12',
  formRenderedAt: Date.now() - 4_000,
};

describe('POST /api/signup/lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deadlineState.mockReturnValue('open');
    findIdentity.mockResolvedValue(null);
    findNear.mockResolvedValue([]);
    createRow.mockResolvedValue(
      signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'newplayerid' })
    );
  });

  it('returns the existing playerId when identity already matches', async () => {
    findIdentity.mockResolvedValue({
      record: signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'existingid' }),
      rowNumber: 2,
    });
    const res = await POST(lookupRequest(identityBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, found: true, playerId: 'existingid' });
    expect(createRow).not.toHaveBeenCalled();
  });

  it('returns a near-match warning and does not create a row', async () => {
    findNear.mockResolvedValue([signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'otherid' })]);
    const res = await POST(lookupRequest(identityBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, found: false, nearMatch: true });
    expect(createRow).not.toHaveBeenCalled();
  });

  it('creates a row after the family confirms a near-match', async () => {
    findNear.mockResolvedValue([signupRecord()]);
    const res = await POST(lookupRequest({ ...identityBody, confirmNearMatch: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, found: false, created: true, playerId: 'newplayerid' });
    expect(createRow).toHaveBeenCalled();
  });

  it('creates a new row when there is no match and no near-match', async () => {
    const res = await POST(lookupRequest(identityBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ created: true, playerId: 'newplayerid' });
  });

  it('rejects a filled honeypot', async () => {
    const res = await POST(lookupRequest({ ...identityBody, honeypot: 'bot' }));
    expect(res.status).toBe(400);
    expect(createRow).not.toHaveBeenCalled();
  });

  it('rejects a submit faster than 3 seconds', async () => {
    const res = await POST(lookupRequest({ ...identityBody, formRenderedAt: Date.now() - 500 }));
    expect(res.status).toBe(400);
    expect(createRow).not.toHaveBeenCalled();
  });

  it('rejects missing required identity fields', async () => {
    const res = await POST(lookupRequest({ ...identityBody, lastName: '' }));
    expect(res.status).toBe(400);
  });

  it('blocks new-player creation when the season is closed, but still returns an existing lookup', async () => {
    deadlineState.mockReturnValue('closed');
    const createRes = await POST(lookupRequest(identityBody));
    expect(createRes.status).toBe(403);
    expect(createRow).not.toHaveBeenCalled();

    findIdentity.mockResolvedValue({
      record: signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'existingid' }),
      rowNumber: 2,
    });
    const lookupRes = await POST(lookupRequest(identityBody));
    expect(lookupRes.status).toBe(200);
    expect((await lookupRes.json()).playerId).toBe('existingid');
  });
});
