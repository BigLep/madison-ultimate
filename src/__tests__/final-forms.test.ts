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
    updateSignupRow: vi.fn(),
  };
});

vi.mock('@/lib/photo-carryover', () => ({
  carryOverPhotoFromLastSeason: vi.fn(),
}));

vi.mock('@/lib/buttondown-api', () => ({
  subscribeUnlessUnsubscribed: vi.fn(),
  getSubscriberStatus: vi.fn(),
}));

vi.mock('@/lib/sheet-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sheet-config')>();
  return {
    ...actual,
    SHEET_CONFIG: {
      ...actual.SHEET_CONFIG,
      SPS_FINAL_FORMS_FOLDER_ID: 'test-ff-folder',
    },
  };
});

import { getMostRecentFileInfoFromFolder, downloadCsvFromDrive } from '@/lib/google-api';
import { updateSignupRow } from '@/lib/signups-sheet';
import { carryOverPhotoFromLastSeason } from '@/lib/photo-carryover';
import { subscribeUnlessUnsubscribed, getSubscriberStatus } from '@/lib/buttondown-api';
import {
  findFinalFormsMatch,
  seededFieldsFromFinalForms,
  clearFinalFormsCache,
  getFinalFormsDataAsOf,
  backfillFinalFormsJoin,
  FINAL_FORMS_FIXTURE_DATA_AS_OF,
} from '@/lib/final-forms';

const getFile = vi.mocked(getMostRecentFileInfoFromFolder);
const downloadCsv = vi.mocked(downloadCsvFromDrive);
const updateRow = vi.mocked(updateSignupRow);
const carryOverPhoto = vi.mocked(carryOverPhotoFromLastSeason);
const subscribeUnlessUnsub = vi.mocked(subscribeUnlessUnsubscribed);
const subscriberStatus = vi.mocked(getSubscriberStatus);

/** Student columns first so substring header matching does not steal Parent 1 Email as Email. */
const FINAL_FORMS_CSV = [
  'Student ID,First Name,Last Name,Date of Birth,Grade,Parent Signed,Student Signed,Physical Clearance,Physical Expiration,Email,Cell Phone,Parent 1 First Name,Parent 1 Last Name,Parent 1 Email,Parent 1 Cell Phone,Parent 2 First Name,Parent 2 Last Name,Parent 2 Email,Parent 2 Cell Phone',
  'FF-ALEX,Alex,Twinlast,2014-03-15,7,true,false,not cleared,,alex@example.com,555-0100,Pat,One,ct1@example.com,555-0101,Sam,Two,ct2@example.com,555-0102',
  'FF-BLAKE,Blake,Twinlast,2014-03-15,7,true,true,cleared,2027-06-01,blake@seattleschools.org,555-0200,Pat,One,ct1@example.com,555-0101,,,',
  'FF-CASEY,Casey,Sololast,2013-05-01,8,false,true,not cleared,,casey@example.com,555-0300,Pat,One,ct1@example.com,555-0101,,,',
].join('\n');

async function stubSnapshot(): Promise<void> {
  getFile.mockResolvedValue({ id: 'file-1', timestamp: '2026-08-28T05:15:11Z', name: 'students_basic.csv' });
  downloadCsv.mockResolvedValue(FINAL_FORMS_CSV);
}

describe('seededFieldsFromFinalForms', () => {
  const base = finalFormsRecord();

  it('routes a non-SPS student email to personal, not SPS', () => {
    const seeded = seededFieldsFromFinalForms(base);
    expect(seeded.studentPersonalEmail).toBe('player@example.com');
    expect(seeded.studentSpsEmail).toBeUndefined();
    expect(seeded.grade).toBe('7');
    expect(seeded.caretaker1Name).toBe('Ct One');
    expect(seeded.caretaker2Name).toBeUndefined();
  });

  it('routes an @seattleschools.org address to the SPS field only', () => {
    const seeded = seededFieldsFromFinalForms({
      ...base,
      studentEmail: 'player@seattleschools.org',
    });
    expect(seeded.studentSpsEmail).toBe('player@seattleschools.org');
    expect(seeded.studentPersonalEmail).toBeUndefined();
  });
});

describe('findFinalFormsMatch — magic last names', () => {
  beforeEach(() => {
    clearFinalFormsCache();
    vi.clearAllMocks();
  });

  it('returns null for TestNotFound without hitting Drive', async () => {
    const result = await findFinalFormsMatch(signupRecord({ [SIGNUPS_COLUMNS.LAST_NAME]: 'TestNotFound' }));
    expect(result).toBeNull();
    expect(getFile).not.toHaveBeenCalled();
  });

  it('still reports the fixture timestamp for TestNotFound so the dashboard can show last-synced', async () => {
    const dataAsOf = await getFinalFormsDataAsOf(signupRecord({ [SIGNUPS_COLUMNS.LAST_NAME]: 'TestNotFound' }));
    expect(dataAsOf).toBe(FINAL_FORMS_FIXTURE_DATA_AS_OF);
    expect(getFile).not.toHaveBeenCalled();
  });

  it('returns each found fixture as isTest so spsStudentId is never written back', async () => {
    const cases = [
      { lastName: 'TestNoneSigned', parentSigned: false, studentSigned: false, physicalCleared: false },
      { lastName: 'TestParentSigned', parentSigned: true, studentSigned: false, physicalCleared: false },
      { lastName: 'TestAllSigned', parentSigned: true, studentSigned: true, physicalCleared: false },
      { lastName: 'TestCleared', parentSigned: true, studentSigned: true, physicalCleared: true },
    ] as const;

    for (const row of cases) {
      const result = await findFinalFormsMatch(signupRecord({ [SIGNUPS_COLUMNS.LAST_NAME]: row.lastName }));
      expect(result, row.lastName).not.toBeNull();
      expect(result!.isTest).toBe(true);
      expect(result!.record.parentSigned).toBe(row.parentSigned);
      expect(result!.record.studentSigned).toBe(row.studentSigned);
      expect(result!.record.physicalCleared).toBe(row.physicalCleared);
    }
    expect(getFile).not.toHaveBeenCalled();
  });

  it('matches magic last names case- and spacing-insensitively', async () => {
    const result = await findFinalFormsMatch(
      signupRecord({ [SIGNUPS_COLUMNS.LAST_NAME]: '  test cleared  ' })
    );
    expect(result?.record.lastName).toBe('TestCleared');
    expect(result?.isTest).toBe(true);
  });
});

describe('findFinalFormsMatch — live export join', () => {
  beforeEach(() => {
    clearFinalFormsCache();
    vi.clearAllMocks();
  });

  it('matches a unique last name + birthdate', async () => {
    await stubSnapshot();
    const result = await findFinalFormsMatch(
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-01',
      })
    );
    expect(result?.isTest).toBeUndefined();
    expect(result?.record.studentId).toBe('FF-CASEY');
    expect(result?.record.parentSigned).toBe(false);
    expect(result?.record.studentSigned).toBe(true);
  });

  it('disambiguates twins by legal first name', async () => {
    await stubSnapshot();
    const result = await findFinalFormsMatch(
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Twinlast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2014-03-15',
        [SIGNUPS_COLUMNS.LEGAL_FIRST_NAME]: 'Blake',
      })
    );
    expect(result?.record.studentId).toBe('FF-BLAKE');
  });

  it('falls back to preferred first name when legal first name is empty', async () => {
    await stubSnapshot();
    const result = await findFinalFormsMatch(
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Twinlast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2014-03-15',
        [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'Alex',
      })
    );
    expect(result?.record.studentId).toBe('FF-ALEX');
  });

  it('returns null rather than guessing when twins are still ambiguous', async () => {
    await stubSnapshot();
    const result = await findFinalFormsMatch(
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Twinlast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2014-03-15',
        [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'Charlie',
      })
    );
    expect(result).toBeNull();
  });

  it('uses an existing spsStudentId as the authoritative join even if the name differs', async () => {
    await stubSnapshot();
    const result = await findFinalFormsMatch(
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Unrelated',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2000-01-01',
        [SIGNUPS_COLUMNS.SPS_STUDENT_ID]: 'FF-BLAKE',
      })
    );
    expect(result?.record.studentId).toBe('FF-BLAKE');
    expect(result?.record.physicalCleared).toBe(true);
  });

  it('returns null when spsStudentId is set but missing from the export', async () => {
    await stubSnapshot();
    const result = await findFinalFormsMatch(
      signupRecord({ [SIGNUPS_COLUMNS.SPS_STUDENT_ID]: 'FF-MISSING' })
    );
    expect(result).toBeNull();
  });

  it('returns null when last name + birthdate match nothing', async () => {
    await stubSnapshot();
    const result = await findFinalFormsMatch(
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Nobody',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2014-01-01',
      })
    );
    expect(result).toBeNull();
  });

  it('still reports the export timestamp when last name + birthdate match nothing', async () => {
    await stubSnapshot();
    const dataAsOf = await getFinalFormsDataAsOf(
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Nobody',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2014-01-01',
      })
    );
    expect(dataAsOf).toBe('2026-08-28T05:15:11Z');
  });

  it('finds a match after the family corrects a wrong birthdate, without a new Drive fetch', async () => {
    await stubSnapshot();
    const notYetMatched = await findFinalFormsMatch(
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-02', // one day off from the export
      })
    );
    expect(notYetMatched).toBeNull();

    const corrected = await findFinalFormsMatch(
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-01',
      })
    );
    expect(corrected?.record.studentId).toBe('FF-CASEY');
    // Same cached snapshot served both calls; the rejoin didn't need a fresh Drive read.
    expect(getFile).toHaveBeenCalledTimes(1);
    expect(downloadCsv).toHaveBeenCalledTimes(1);
  });

  it('finds a match after the family corrects a wrong legal first name, without a new Drive fetch', async () => {
    await stubSnapshot();
    const notYetMatched = await findFinalFormsMatch(
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Twinlast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2014-03-15',
        [SIGNUPS_COLUMNS.LEGAL_FIRST_NAME]: 'Wrongname',
      })
    );
    expect(notYetMatched).toBeNull();

    const corrected = await findFinalFormsMatch(
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Twinlast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2014-03-15',
        [SIGNUPS_COLUMNS.LEGAL_FIRST_NAME]: 'Blake',
      })
    );
    expect(corrected?.record.studentId).toBe('FF-BLAKE');
    expect(downloadCsv).toHaveBeenCalledTimes(1);
  });
});

describe('backfillFinalFormsJoin (ADR 0005)', () => {
  const PLAYER_ID = 'testplayerid';

  beforeEach(() => {
    clearFinalFormsCache();
    vi.clearAllMocks();
    updateRow.mockImplementation(async (_id, fields) => signupRecord(fields));
    carryOverPhoto.mockResolvedValue(null);
    subscribeUnlessUnsub.mockResolvedValue(true);
    subscriberStatus.mockResolvedValue('absent');
  });

  it('joins and reports subscribed emails for a row with no candidate previously', async () => {
    await stubSnapshot();
    const outcome = await backfillFinalFormsJoin(
      PLAYER_ID,
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-01',
      })
    );
    expect(outcome.kind).toBe('joined');
    if (outcome.kind !== 'joined') throw new Error('expected joined');
    expect(outcome.match.record.studentId).toBe('FF-CASEY');
    expect(outcome.firstJoin.subscribedEmails).toContain('ct1@example.com');
    expect(updateRow).toHaveBeenCalledWith(PLAYER_ID, expect.objectContaining({
      [SIGNUPS_COLUMNS.SPS_STUDENT_ID]: 'FF-CASEY',
    }));
  });

  it('reports unmatched with no possible matches when no one shares the last name', async () => {
    await stubSnapshot();
    const outcome = await backfillFinalFormsJoin(
      PLAYER_ID,
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Nobody',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2014-01-01',
      })
    );
    expect(outcome).toEqual({ kind: 'unmatched', possibleMatches: [] });
    expect(updateRow).not.toHaveBeenCalled();
  });

  it('surfaces a Possible Match when the last name matches but the birthdate does not', async () => {
    await stubSnapshot();
    const outcome = await backfillFinalFormsJoin(
      PLAYER_ID,
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-02', // one day off from the export
      })
    );
    expect(outcome).toEqual({
      kind: 'unmatched',
      possibleMatches: [{ studentId: 'FF-CASEY', firstName: 'Casey', dateOfBirth: '2013-05-01' }],
    });
  });

  it('reports ambiguous, distinct from unmatched, when twins cannot be disambiguated', async () => {
    await stubSnapshot();
    const outcome = await backfillFinalFormsJoin(
      PLAYER_ID,
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Twinlast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2014-03-15',
        [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'Charlie',
      })
    );
    expect(outcome).toEqual({ kind: 'ambiguous', candidateCount: 2 });
    expect(updateRow).not.toHaveBeenCalled();
  });

  it('never overwrites an existing SPS Student ID, even when a fresh match agrees', async () => {
    await stubSnapshot();
    const outcome = await backfillFinalFormsJoin(
      PLAYER_ID,
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-01',
        [SIGNUPS_COLUMNS.SPS_STUDENT_ID]: 'FF-CASEY',
      })
    );
    expect(outcome).toEqual({ kind: 'already-joined-consistent' });
    expect(updateRow).not.toHaveBeenCalled();
  });

  it('flags a Match Discrepancy instead of overwriting when a fresh match disagrees with the stored ID', async () => {
    await stubSnapshot();
    const outcome = await backfillFinalFormsJoin(
      PLAYER_ID,
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-01',
        [SIGNUPS_COLUMNS.SPS_STUDENT_ID]: 'FF-WRONG',
      })
    );
    expect(outcome).toEqual({
      kind: 'already-joined-discrepancy',
      storedStudentId: 'FF-WRONG',
      freshMatchStudentId: 'FF-CASEY',
    });
    expect(updateRow).not.toHaveBeenCalled();
  });

  it('reports no-snapshot when the Final Forms export cannot be loaded', async () => {
    getFile.mockResolvedValue(null);
    const outcome = await backfillFinalFormsJoin(
      PLAYER_ID,
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-01',
      })
    );
    expect(outcome).toEqual({ kind: 'no-snapshot' });
  });

  it('joins a magic-name fixture without writing spsStudentId', async () => {
    const outcome = await backfillFinalFormsJoin(
      PLAYER_ID,
      signupRecord({ [SIGNUPS_COLUMNS.LAST_NAME]: 'TestCleared' })
    );
    expect(outcome.kind).toBe('joined');
    if (outcome.kind !== 'joined') throw new Error('expected joined');
    expect(outcome.match.isTest).toBe(true);
    expect(updateRow.mock.calls[0][1][SIGNUPS_COLUMNS.SPS_STUDENT_ID]).toBeUndefined();
    expect(getFile).not.toHaveBeenCalled();
  });

  it('reports unmatched for the TestNotFound fixture', async () => {
    const outcome = await backfillFinalFormsJoin(
      PLAYER_ID,
      signupRecord({ [SIGNUPS_COLUMNS.LAST_NAME]: 'TestNotFound' })
    );
    expect(outcome).toEqual({ kind: 'unmatched', possibleMatches: [] });
  });

  it('never reports an email as subscribed when the subscribe call failed', async () => {
    await stubSnapshot();
    subscribeUnlessUnsub.mockImplementation(async email => email !== 'ct1@example.com');
    const outcome = await backfillFinalFormsJoin(
      PLAYER_ID,
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-01',
      })
    );
    expect(outcome.kind).toBe('joined');
    if (outcome.kind !== 'joined') throw new Error('expected joined');
    expect(outcome.firstJoin.subscribedEmails).not.toContain('ct1@example.com');
  });

  it('never reports an email as newly subscribed when it was already on the list (e.g. a coach who is also a caretaker)', async () => {
    await stubSnapshot();
    subscriberStatus.mockImplementation(async email => (email === 'ct1@example.com' ? 'subscribed' : 'absent'));
    const outcome = await backfillFinalFormsJoin(
      PLAYER_ID,
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-01',
      })
    );
    expect(outcome.kind).toBe('joined');
    if (outcome.kind !== 'joined') throw new Error('expected joined');
    expect(outcome.firstJoin.subscribedEmails).not.toContain('ct1@example.com');
  });
});

describe('finalforms-refresh cache clearing', () => {
  beforeEach(() => {
    clearFinalFormsCache();
    vi.clearAllMocks();
  });

  it('forces a fresh Drive read on the next join after clearFinalFormsCache', async () => {
    await stubSnapshot();
    const first = await findFinalFormsMatch(
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-01',
      })
    );
    expect(first?.record.parentSigned).toBe(false);
    expect(downloadCsv).toHaveBeenCalledTimes(1);

    clearFinalFormsCache();
    downloadCsv.mockResolvedValue(FINAL_FORMS_CSV.replace('Sololast,2013-05-01,8,false', 'Sololast,2013-05-01,8,true'));

    const second = await findFinalFormsMatch(
      signupRecord({
        [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast',
        [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-01',
      })
    );
    expect(second?.record.parentSigned).toBe(true);
    expect(downloadCsv).toHaveBeenCalledTimes(2);
  });
});
