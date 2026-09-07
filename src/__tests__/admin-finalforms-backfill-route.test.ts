import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';
import { signupRecord } from './fixtures/signup-record';
import { finalFormsRecord } from './fixtures/final-forms-record';
import type { FinalFormsBackfillOutcome } from '@/lib/final-forms';

vi.mock('@/lib/signups-sheet', () => ({
  listAllSignups: vi.fn(),
}));

vi.mock('@/lib/final-forms', () => ({
  backfillFinalFormsJoin: vi.fn(),
}));

vi.mock('@/lib/buttondown-api', () => ({
  getBlockedSubscriberCount: vi.fn(),
}));

import { listAllSignups } from '@/lib/signups-sheet';
import { backfillFinalFormsJoin } from '@/lib/final-forms';
import { getBlockedSubscriberCount } from '@/lib/buttondown-api';
import { GET, POST } from '@/app/api/admin/finalforms-backfill/route';

const listSignups = vi.mocked(listAllSignups);
const backfill = vi.mocked(backfillFinalFormsJoin);
const blockedCount = vi.mocked(getBlockedSubscriberCount);

describe('GET /api/admin/finalforms-backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports the blocked subscriber count from Buttondown', async () => {
    blockedCount.mockResolvedValue(3);
    const res = await GET();
    expect(await res.json()).toEqual({ success: true, blockedCount: 3 });
  });

  it('reports null when Buttondown cannot be checked', async () => {
    blockedCount.mockResolvedValue(null);
    const res = await GET();
    expect(await res.json()).toEqual({ success: true, blockedCount: null });
  });
});

describe('POST /api/admin/finalforms-backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('buckets each outcome kind into the matching report section', async () => {
    listSignups.mockResolvedValue([
      signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'joined-player' }),
      signupRecord({
        [SIGNUPS_COLUMNS.PLAYER_ID]: 'unmatched-player',
        [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'Afirst',
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Blast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2014-01-15',
      }),
      signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'ambiguous-player' }),
      signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'discrepancy-player' }),
      signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'consistent-player' }),
    ]);

    const outcomes: Record<string, FinalFormsBackfillOutcome> = {
      'joined-player': {
        kind: 'joined',
        match: { record: finalFormsRecord({ studentId: 'FF-001' }), dataAsOf: '2026-08-28' },
        firstJoin: { fieldsCopied: true, photoCarriedOver: false, subscribedEmails: ['ct1@example.com'] },
      },
      'unmatched-player': {
        kind: 'unmatched',
        possibleMatches: [{ studentId: 'FF-002', firstName: 'Bfirst', dateOfBirth: '2014-01-01' }],
      },
      'ambiguous-player': { kind: 'ambiguous', candidateCount: 2 },
      'discrepancy-player': {
        kind: 'already-joined-discrepancy',
        storedStudentId: 'FF-OLD',
        freshMatchStudentId: 'FF-NEW',
      },
      'consistent-player': { kind: 'already-joined-consistent' },
    };
    backfill.mockImplementation(async (playerId: string) => outcomes[playerId]);

    const res = await POST();
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.report.joined).toEqual([
      { playerId: 'joined-player', studentId: 'FF-001', subscribedEmails: ['ct1@example.com'] },
    ]);
    expect(body.report.unmatched).toEqual([
      {
        playerId: 'unmatched-player',
        preferredFirstName: 'Afirst',
        lastName: 'Blast',
        signupDateOfBirth: '2014-01-15',
        possibleMatches: [{ studentId: 'FF-002', firstName: 'Bfirst', dateOfBirth: '2014-01-01' }],
      },
    ]);
    expect(body.report.ambiguous).toEqual([{ playerId: 'ambiguous-player', candidateCount: 2 }]);
    expect(body.report.discrepancies).toEqual([
      { playerId: 'discrepancy-player', storedStudentId: 'FF-OLD', freshMatchStudentId: 'FF-NEW' },
    ]);
    expect(body.report.noSnapshot).toBe(false);
    // "already-joined-consistent" rows are silently skipped: nothing to review.
    expect(backfill).toHaveBeenCalledTimes(5);
  });

  it('flags noSnapshot and stops attempting matches once the export is unavailable', async () => {
    listSignups.mockResolvedValue([
      signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'first-player' }),
      signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'second-player' }),
    ]);
    backfill.mockResolvedValue({ kind: 'no-snapshot' });

    const res = await POST();
    const body = await res.json();

    expect(body.report.noSnapshot).toBe(true);
    expect(body.report.joined).toEqual([]);
    // Every remaining row would fail the same way (missing/unreadable export), so the loop
    // must stop at the first no-snapshot rather than re-attempting Drive for every row.
    expect(backfill).toHaveBeenCalledTimes(1);
    expect(backfill).toHaveBeenCalledWith('first-player', expect.anything());
  });

  it('skips rows with no PlayerID', async () => {
    listSignups.mockResolvedValue([signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: '' })]);

    const res = await POST();
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(backfill).not.toHaveBeenCalled();
  });

  it('returns a 500 with the error message when the sheet read fails', async () => {
    listSignups.mockRejectedValue(new Error('Sheets API down'));

    const res = await POST();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: 'Sheets API down' });
  });
});
