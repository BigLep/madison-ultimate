import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';
import { signupRecord } from './fixtures/signup-record';
import { finalFormsRecord } from './fixtures/final-forms-record';

vi.mock('@/lib/google-api', () => ({
  getMostRecentFileInfoFromFolder: vi.fn(),
  downloadCsvFromDrive: vi.fn(),
}));

vi.mock('@/lib/signups-sheet', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/signups-sheet')>();
  return {
    ...actual,
    createSignupRow: vi.fn(),
    updateSignupRow: vi.fn(),
    recomputeProfileCompleteForAllRows: vi.fn(),
  };
});

vi.mock('@/lib/photo-carryover', () => ({
  carryOverPhotoFromLastSeason: vi.fn(),
}));

vi.mock('@/lib/buttondown-api', () => ({
  subscribeUnlessUnsubscribed: vi.fn(),
  getSubscriberStatus: vi.fn(),
}));

import { createSignupRow, updateSignupRow, recomputeProfileCompleteForAllRows } from '@/lib/signups-sheet';
import { carryOverPhotoFromLastSeason } from '@/lib/photo-carryover';
import { subscribeUnlessUnsubscribed, getSubscriberStatus } from '@/lib/buttondown-api';
import {
  planFinalFormsReconciliation,
  applyFinalFormsReconciliation,
  seedSignupFromFinalForms,
  ReconciliationEntry,
} from '@/lib/final-forms';

const createRow = vi.mocked(createSignupRow);
const updateRow = vi.mocked(updateSignupRow);
const recompute = vi.mocked(recomputeProfileCompleteForAllRows);
const carryOverPhoto = vi.mocked(carryOverPhotoFromLastSeason);
const subscribeUnlessUnsub = vi.mocked(subscribeUnlessUnsubscribed);
const subscriberStatus = vi.mocked(getSubscriberStatus);

const DATA_AS_OF = '2026-09-07T13:00:00Z';

const solo = finalFormsRecord({ studentId: 'FF-SOLO', firstName: 'Casey', legalFirstName: 'Casey', lastName: 'Sololast', dateOfBirth: '2013-05-01' });
const twinA = finalFormsRecord({ studentId: 'FF-ALEX', firstName: 'Alex', legalFirstName: 'Alex', lastName: 'Twinlast', dateOfBirth: '2014-03-15' });
const twinB = finalFormsRecord({ studentId: 'FF-BLAKE', firstName: 'Blake', legalFirstName: 'Blake', lastName: 'Twinlast', dateOfBirth: '2014-03-15' });

function plan(signups: ReturnType<typeof signupRecord>[], records = [solo, twinA, twinB]) {
  return planFinalFormsReconciliation(signups, { records, fileTimestamp: DATA_AS_OF });
}

function kinds(entries: ReconciliationEntry[]): string[] {
  return entries.map(e => e.kind);
}

describe('planFinalFormsReconciliation', () => {
  it('seeds every record when there are no signups at all', () => {
    const { entries, dataAsOf } = plan([]);
    expect(dataAsOf).toBe(DATA_AS_OF);
    expect(kinds(entries)).toEqual(['seed', 'seed', 'seed']);
  });

  it('skips a record whose student ID is already on a signup row, before any name matching', () => {
    const { entries } = plan([
      signupRecord({
        [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-solo',
        [SIGNUPS_COLUMNS.SPS_STUDENT_ID]: 'FF-SOLO',
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Different', // name does not even match; the ID wins
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2000-01-01',
      }),
    ], [solo]);
    expect(entries).toEqual([{ kind: 'skip', record: solo, playerId: 'p-solo' }]);
  });

  it('joins the single unjoined signup in a one-record group (the Backfill case)', () => {
    const signup = signupRecord({
      [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-solo',
      [SIGNUPS_COLUMNS.LAST_NAME]: 'SOLOLAST ',
      [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '5/1/2013',
    });
    const { entries } = plan([signup], [solo]);
    expect(entries).toEqual([{ kind: 'join', record: solo, playerId: 'p-solo', signup }]);
  });

  it('reports duplicate signups when two unjoined rows share the one record', () => {
    const { entries } = plan([
      signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-1', [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast', [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-01' }),
      signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-2', [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast', [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-01' }),
    ], [solo]);
    expect(entries).toEqual([{ kind: 'duplicate-signups', record: solo, playerIds: ['p-1', 'p-2'] }]);
  });

  it('reports an unjoined row that shares a name and birthdate with an already-joined row as a suspected duplicate, never dropping it', () => {
    // A family created their own row after the student was seeded (or the birthdate was fixed
    // after the seed): the record is claimed by ID, the family row shares its key.
    const { entries } = plan(
      [
        signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-seeded', [SIGNUPS_COLUMNS.SPS_STUDENT_ID]: 'FF-SOLO', [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast', [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-01' }),
        signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-family', [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast', [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-01' }),
      ],
      [solo]
    );
    expect(entries).toEqual([
      { kind: 'skip', record: solo, playerId: 'p-seeded' },
      { kind: 'duplicate-signups', record: solo, playerIds: ['p-seeded', 'p-family'], joinedPlayerId: 'p-seeded' },
    ]);
  });

  it('seeds both twins when neither has a signup', () => {
    const { entries } = plan([], [twinA, twinB]);
    expect(entries).toEqual([
      { kind: 'seed', record: twinA },
      { kind: 'seed', record: twinB },
    ]);
  });

  it('joins a twin the legal first name resolves and seeds the other', () => {
    const signup = signupRecord({
      [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-blake',
      [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'B',
      [SIGNUPS_COLUMNS.LEGAL_FIRST_NAME]: 'Blake',
      [SIGNUPS_COLUMNS.LAST_NAME]: 'Twinlast',
      [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2014-03-15',
    });
    const { entries } = plan([signup], [twinA, twinB]);
    expect(entries).toEqual([
      { kind: 'seed', record: twinA },
      { kind: 'join', record: twinB, playerId: 'p-blake', signup },
    ]);
  });

  it('falls back to preferred first name for twins when legal first name is blank', () => {
    const signup = signupRecord({
      [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-alex',
      [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'alex',
      [SIGNUPS_COLUMNS.LAST_NAME]: 'Twinlast',
      [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2014-03-15',
    });
    const { entries } = plan([signup], [twinA, twinB]);
    expect(kinds(entries)).toEqual(['join', 'seed']);
  });

  it('does nothing in a twin group when a signup cannot be told apart', () => {
    const { entries } = plan([
      signupRecord({
        [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-who',
        [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'Sam',
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Twinlast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2014-03-15',
      }),
    ], [twinA, twinB]);
    expect(entries).toEqual([{ kind: 'ambiguous', records: [twinA, twinB], playerIds: ['p-who'] }]);
  });

  it('does nothing in a twin group when two signups claim the same twin', () => {
    const mk = (id: string) =>
      signupRecord({
        [SIGNUPS_COLUMNS.PLAYER_ID]: id,
        [SIGNUPS_COLUMNS.LEGAL_FIRST_NAME]: 'Alex',
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Twinlast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2014-03-15',
      });
    const { entries } = plan([mk('p-1'), mk('p-2')], [twinA, twinB]);
    expect(kinds(entries)).toEqual(['ambiguous']);
  });

  it('keeps resolving twins when one is already joined by ID and the other signup names the free twin', () => {
    const joined = signupRecord({
      [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-alex',
      [SIGNUPS_COLUMNS.SPS_STUDENT_ID]: 'FF-ALEX',
      [SIGNUPS_COLUMNS.LAST_NAME]: 'Twinlast',
      [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2014-03-15',
    });
    const other = signupRecord({
      [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-blake',
      [SIGNUPS_COLUMNS.LEGAL_FIRST_NAME]: 'Blake',
      [SIGNUPS_COLUMNS.LAST_NAME]: 'Twinlast',
      [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2014-03-15',
    });
    const { entries } = plan([joined, other], [twinA, twinB]);
    expect(entries).toEqual([
      { kind: 'skip', record: twinA, playerId: 'p-alex' },
      { kind: 'join', record: twinB, playerId: 'p-blake', signup: other },
    ]);
  });

  it('flags a discrepancy instead of seeding the free twin when a row is joined to the wrong twin', () => {
    // The row says Blake but was joined to Alex's ID (Blake was not in the export at join time).
    const wrong = signupRecord({
      [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-blake',
      [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'Blake',
      [SIGNUPS_COLUMNS.SPS_STUDENT_ID]: 'FF-ALEX',
      [SIGNUPS_COLUMNS.LAST_NAME]: 'Twinlast',
      [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2014-03-15',
    });
    const { entries } = plan([wrong], [twinA, twinB]);
    expect(entries).toEqual([
      { kind: 'skip', record: twinA, playerId: 'p-blake' },
      { kind: 'discrepancy', record: twinB, playerId: 'p-blake', storedStudentId: 'FF-ALEX' },
    ]);
  });

  it('flags a discrepancy instead of seeding when the group holds a row joined to an outside ID', () => {
    const { entries } = plan([
      signupRecord({
        [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-wrong',
        [SIGNUPS_COLUMNS.SPS_STUDENT_ID]: 'FF-OTHER',
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-01',
      }),
    ], [solo]);
    expect(entries).toEqual([{ kind: 'discrepancy', record: solo, playerId: 'p-wrong', storedStudentId: 'FF-OTHER' }]);
  });

  it('flags a discrepancy even when every record in the group is already claimed by ID', () => {
    const { entries } = plan([
      signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-ok', [SIGNUPS_COLUMNS.SPS_STUDENT_ID]: 'FF-SOLO', [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast', [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-01' }),
      signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-wrong', [SIGNUPS_COLUMNS.SPS_STUDENT_ID]: 'FF-OTHER', [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast', [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-01' }),
    ], [solo]);
    expect(entries).toEqual([
      { kind: 'skip', record: solo, playerId: 'p-ok' },
      { kind: 'discrepancy', record: solo, playerId: 'p-wrong', storedStudentId: 'FF-OTHER' },
    ]);
  });

  it('reports a record with no student ID as unseedable', () => {
    const noId = finalFormsRecord({ studentId: ' ', lastName: 'Noid' });
    const { entries } = plan([], [noId]);
    expect(entries).toEqual([{ kind: 'unseedable', record: noId, reason: 'no SPS Student ID in Final Forms' }]);
  });

  it('reports records with no last name or birthdate as unseedable', () => {
    const noDob = finalFormsRecord({ studentId: 'FF-NODOB', lastName: 'Nodob', dateOfBirth: '' });
    const noLast = finalFormsRecord({ studentId: 'FF-NOLAST', lastName: '', dateOfBirth: '2013-01-01' });
    const { entries } = plan([], [noDob, noLast]);
    expect(entries).toEqual([
      { kind: 'unseedable', record: noLast, reason: 'no last name in Final Forms' },
      { kind: 'unseedable', record: noDob, reason: 'no usable birthdate in Final Forms' },
    ]);
  });

  it('ignores signups without a PlayerID', () => {
    const { entries } = plan(
      [signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: '', [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast', [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-01' })],
      [solo]
    );
    expect(entries).toEqual([{ kind: 'seed', record: solo }]);
  });

  it('lists an unjoined signup no record shares a group with, with same-last-name possible matches', () => {
    const signup = signupRecord({
      [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-typo',
      [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'Zed', // sorts after Casey, so the seed entry comes first
      [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast',
      [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-02',
    });
    const { entries } = plan([signup], [solo]);
    expect(entries).toEqual([
      { kind: 'seed', record: solo },
      {
        kind: 'unmatched-signup',
        playerId: 'p-typo',
        signup,
        possibleMatches: [{ studentId: 'FF-SOLO', firstName: 'Casey', dateOfBirth: '2013-05-01' }],
      },
    ]);
  });
});

describe('seedSignupFromFinalForms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createRow.mockImplementation(async fields => signupRecord({ ...fields, [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-new' }));
    updateRow.mockImplementation(async (_id, fields) => signupRecord(fields));
    carryOverPhoto.mockResolvedValue('photo-file-1');
    subscribeUnlessUnsub.mockResolvedValue(true);
    subscriberStatus.mockResolvedValue('absent');
  });

  it('creates the row from Final Forms identity, then applies the first-join write to it', async () => {
    const record = finalFormsRecord({ studentId: 'FF-9', firstName: ' Casey ', lastName: 'Sololast', dateOfBirth: '5/1/2013' });
    const outcome = await seedSignupFromFinalForms(record, DATA_AS_OF);

    expect(outcome.playerId).toBe('p-new');
    expect(outcome.studentId).toBe('FF-9');

    const created = createRow.mock.calls[0][0];
    expect(created[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]).toBe('Casey');
    expect(created[SIGNUPS_COLUMNS.LEGAL_FIRST_NAME]).toBeUndefined();
    expect(created[SIGNUPS_COLUMNS.LAST_NAME]).toBe('Sololast');
    expect(created[SIGNUPS_COLUMNS.DATE_OF_BIRTH]).toBe('2013-05-01');
    expect(created[SIGNUPS_COLUMNS.SEEDED_AT]).toBeTruthy();
    expect(created[SIGNUPS_COLUMNS.CREATED_AT]).toBe(created[SIGNUPS_COLUMNS.SEEDED_AT]);

    const [playerId, updates, options] = updateRow.mock.calls[0];
    expect(playerId).toBe('p-new');
    expect(options).toEqual({ touchUpdatedAt: false }); // Updated At stays equal to Seeded At
    expect(updates[SIGNUPS_COLUMNS.SPS_STUDENT_ID]).toBe('FF-9');
    expect(updates[SIGNUPS_COLUMNS.GRADE]).toBe('7');
    expect(updates[SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]).toBe('ct1@example.com');
    expect(updates[SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]).toBe('photo-file-1');
    expect(outcome.firstJoin.photoCarriedOver).toBe(true);
    expect(outcome.firstJoin.subscribedEmails).toEqual(['ct1@example.com', 'player@example.com']);
    expect(outcome.firstJoin.subscribeFailed).toEqual([]);
  });

  it('reports every eligible email the newsletter could not take, so a Buttondown outage is visible in the run report', async () => {
    // Status lookup fails for one address (null) and the subscribe itself fails for the other.
    subscriberStatus.mockImplementation(async email => (email === 'ct1@example.com' ? null : 'absent'));
    subscribeUnlessUnsub.mockImplementation(async email => email !== 'player@example.com');
    const record = finalFormsRecord({ studentId: 'FF-10', firstName: 'Casey', lastName: 'Outagelast', dateOfBirth: '5/1/2013' });
    const outcome = await seedSignupFromFinalForms(record, DATA_AS_OF);

    expect(outcome.firstJoin.subscribedEmails).toEqual([]);
    expect(outcome.firstJoin.subscribeFailed).toEqual(['ct1@example.com', 'player@example.com']);
  });
});

describe('applyFinalFormsReconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createRow.mockImplementation(async fields => signupRecord({ ...fields, [SIGNUPS_COLUMNS.PLAYER_ID]: `p-${fields[SIGNUPS_COLUMNS.LAST_NAME]}` }));
    updateRow.mockImplementation(async (_id, fields) => signupRecord(fields));
    recompute.mockResolvedValue(4);
    carryOverPhoto.mockResolvedValue(null);
    subscribeUnlessUnsub.mockResolvedValue(true);
    subscriberStatus.mockResolvedValue('subscribed');
  });

  it('joins, then seeds, then recomputes Profile Complete, touching nothing for report-only entries', async () => {
    const signup = signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-join', [SIGNUPS_COLUMNS.LAST_NAME]: 'Twinlast' });
    const report = await applyFinalFormsReconciliation({
      dataAsOf: DATA_AS_OF,
      entries: [
        { kind: 'seed', record: solo },
        { kind: 'join', record: twinA, playerId: 'p-join', signup },
        { kind: 'ambiguous', records: [twinB], playerIds: ['p-x'] },
        { kind: 'unseedable', record: finalFormsRecord({ studentId: 'FF-U' }), reason: 'no last name in Final Forms' },
      ],
    });

    expect(report.joined).toEqual([{ playerId: 'p-join', studentId: 'FF-ALEX', firstJoin: expect.anything() }]);
    expect(report.seeded).toEqual([{ playerId: 'p-Sololast', studentId: 'FF-SOLO', firstJoin: expect.anything() }]);
    expect(report.recomputedProfileComplete).toBe(4);
    expect(createRow).toHaveBeenCalledTimes(1);
    // Join happens before seed: the join's update precedes the seed's create in call order.
    expect(updateRow.mock.invocationCallOrder[0]).toBeLessThan(createRow.mock.invocationCallOrder[0]);
    expect(recompute).toHaveBeenCalledTimes(1);
  });
});
