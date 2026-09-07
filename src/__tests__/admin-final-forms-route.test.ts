import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';
import { signupRecord } from './fixtures/signup-record';
import { finalFormsRecord } from './fixtures/final-forms-record';
import type { ReconciliationPlan } from '@/lib/final-forms';

vi.mock('@/lib/signups-sheet', () => ({
  listAllSignups: vi.fn(),
}));

vi.mock('@/lib/final-forms', () => ({
  previewFinalFormsReconciliation: vi.fn(),
  applyFinalFormsReconciliation: vi.fn(),
}));

vi.mock('@/lib/buttondown-api', () => ({
  getBlockedSubscriberCount: vi.fn(),
}));

import { listAllSignups } from '@/lib/signups-sheet';
import { previewFinalFormsReconciliation, applyFinalFormsReconciliation } from '@/lib/final-forms';
import { getBlockedSubscriberCount } from '@/lib/buttondown-api';
import { GET, POST } from '@/app/api/admin/final-forms/route';

const listSignups = vi.mocked(listAllSignups);
const preview = vi.mocked(previewFinalFormsReconciliation);
const apply = vi.mocked(applyFinalFormsReconciliation);
const blockedCount = vi.mocked(getBlockedSubscriberCount);

const solo = finalFormsRecord({ studentId: 'FF-SOLO', firstName: 'Casey', lastName: 'Sololast', dateOfBirth: '2013-05-01', grade: '8' });
const twinA = finalFormsRecord({ studentId: 'FF-A', firstName: 'Alex', lastName: 'Twinlast' });
const twinB = finalFormsRecord({ studentId: 'FF-B', firstName: 'Blake', lastName: 'Twinlast' });
const joinSignup = signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-join', [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'Cee', [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast' });
const unmatched = signupRecord({
  [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-typo',
  [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'Tee',
  [SIGNUPS_COLUMNS.LAST_NAME]: 'Typolast',
  [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-01-02',
});

const PLAN: ReconciliationPlan = {
  dataAsOf: '2026-09-07T13:00:00Z',
  entries: [
    { kind: 'skip', record: finalFormsRecord({ studentId: 'FF-DONE' }), playerId: 'p-done' },
    { kind: 'seed', record: solo },
    { kind: 'join', record: twinA, playerId: 'p-join', signup: joinSignup },
    { kind: 'ambiguous', records: [twinA, twinB], playerIds: ['p-x'] },
    { kind: 'duplicate-signups', record: twinB, playerIds: ['p-1', 'p-2'] },
    { kind: 'discrepancy', record: solo, playerId: 'p-wrong', storedStudentId: 'FF-OTHER' },
    { kind: 'unseedable', record: finalFormsRecord({ studentId: 'FF-U', lastName: '' }), reason: 'no last name in Final Forms' },
    { kind: 'unmatched-signup', playerId: 'p-typo', signup: unmatched, possibleMatches: [{ studentId: 'FF-T', firstName: 'Tee', dateOfBirth: '2013-01-01' }] },
  ],
};

const seededRows = [
  signupRecord({
    [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-seeded',
    [SIGNUPS_COLUMNS.SEEDED_AT]: '2026-09-07T13:00:00Z',
    [SIGNUPS_COLUMNS.PROFILE_COMPLETE]: 'FALSE',
    [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: 'Ct1@Example.com',
  }),
];

describe('GET /api/admin/final-forms (Preview)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listSignups.mockResolvedValue(seededRows);
    blockedCount.mockResolvedValue(2);
  });

  it('summarizes every plan entry kind and the blocked count without writing', async () => {
    preview.mockResolvedValue(PLAN);
    const body = await (await GET()).json();

    expect(body.success).toBe(true);
    expect(body.noSnapshot).toBe(false);
    expect(body.blockedCount).toBe(2);
    expect(body.preview.dataAsOf).toBe('2026-09-07T13:00:00Z');
    expect(body.preview.skipped).toBe(1);
    expect(body.preview.seed).toEqual([{ studentId: 'FF-SOLO', firstName: 'Casey', lastName: 'Sololast', grade: '8', dateOfBirth: '2013-05-01' }]);
    expect(body.preview.join).toEqual([expect.objectContaining({ studentId: 'FF-A', playerId: 'p-join', preferredFirstName: 'Cee' })]);
    expect(body.preview.ambiguous).toEqual([{ students: [expect.objectContaining({ studentId: 'FF-A' }), expect.objectContaining({ studentId: 'FF-B' })], playerIds: ['p-x'] }]);
    expect(body.preview.duplicateSignups).toEqual([expect.objectContaining({ studentId: 'FF-B', playerIds: ['p-1', 'p-2'] })]);
    expect(body.preview.discrepancies).toEqual([expect.objectContaining({ studentId: 'FF-SOLO', playerId: 'p-wrong', storedStudentId: 'FF-OTHER' })]);
    expect(body.preview.unseedable).toEqual([expect.objectContaining({ studentId: 'FF-U', reason: 'no last name in Final Forms' })]);
    expect(body.preview.unmatchedSignups).toEqual([
      {
        playerId: 'p-typo',
        preferredFirstName: 'Tee',
        lastName: 'Typolast',
        signupDateOfBirth: '2013-01-02',
        possibleMatches: [{ studentId: 'FF-T', firstName: 'Tee', dateOfBirth: '2013-01-01' }],
      },
    ]);
    expect(apply).not.toHaveBeenCalled();
  });

  it('reports noSnapshot with a null preview when the export cannot be loaded', async () => {
    preview.mockResolvedValue(null);
    const body = await (await GET()).json();
    expect(body.noSnapshot).toBe(true);
    expect(body.preview).toBeNull();
  });

  it('returns a 500 with the message when the sheet read fails', async () => {
    listSignups.mockRejectedValue(new Error('Sheets API down'));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: 'Sheets API down' });
  });
});

describe('POST /api/admin/final-forms (Apply)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listSignups.mockResolvedValue([]);
  });

  it('applies the plan and reports seeded and joined rows plus the recompute count', async () => {
    preview.mockResolvedValue(PLAN);
    apply.mockResolvedValue({
      seeded: [{ playerId: 'p-new', studentId: 'FF-SOLO', firstJoin: { fieldsCopied: true, photoCarriedOver: true, subscribedEmails: ['ct1@example.com'] } }],
      joined: [{ playerId: 'p-join', studentId: 'FF-A', firstJoin: { fieldsCopied: true, photoCarriedOver: false, subscribedEmails: [] } }],
      recomputedProfileComplete: 3,
    });

    const body = await (await POST()).json();
    expect(body.success).toBe(true);
    expect(apply).toHaveBeenCalledWith(PLAN);
    expect(body.applied).toEqual({
      seeded: [{ playerId: 'p-new', studentId: 'FF-SOLO', firstName: 'Casey', lastName: 'Sololast', grade: '8', dateOfBirth: '2013-05-01', subscribedEmails: ['ct1@example.com'], photoCarriedOver: true }],
      joined: [{ playerId: 'p-join', studentId: 'FF-A', firstName: 'Alex', lastName: 'Twinlast', grade: '7', dateOfBirth: '2014-05-12', subscribedEmails: [], photoCarriedOver: false }],
      recomputedProfileComplete: 3,
    });
    expect(body.preview.seed).toHaveLength(1);
  });

  it('writes nothing when the export cannot be loaded', async () => {
    preview.mockResolvedValue(null);
    const body = await (await POST()).json();
    expect(body).toEqual({ success: true, noSnapshot: true, preview: null, applied: null });
    expect(apply).not.toHaveBeenCalled();
  });
});
