import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';
import { signupRecord } from './fixtures/signup-record';

vi.mock('@/lib/google-api', () => ({
  getMostRecentFileInfoFromFolder: vi.fn(),
  downloadCsvFromDrive: vi.fn(),
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
import {
  findFinalFormsMatch,
  seededFieldsFromFinalForms,
  clearFinalFormsCache,
  FinalFormsRecord,
} from '@/lib/final-forms';

const getFile = vi.mocked(getMostRecentFileInfoFromFolder);
const downloadCsv = vi.mocked(downloadCsvFromDrive);

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
  const base: FinalFormsRecord = {
    studentId: 'FF-1',
    firstName: 'Afirst',
    lastName: 'Blast',
    legalFirstName: 'Afirst',
    dateOfBirth: '2014-05-12',
    grade: '7',
    parentSigned: true,
    studentSigned: false,
    physicalCleared: false,
    physicalClearanceExpiration: '',
    studentEmail: 'player@example.com',
    studentCellPhone: '555-0100',
    parent1Name: 'Ct One',
    parent1Email: 'ct1@example.com',
    parent1Phone: '555-0101',
    parent2Name: '',
    parent2Email: '',
    parent2Phone: '',
  };

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
});
