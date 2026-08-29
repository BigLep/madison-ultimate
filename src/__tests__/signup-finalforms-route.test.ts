import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';
import { signupRecord } from './fixtures/signup-record';

vi.mock('@/lib/signups-sheet', () => ({
  findSignupByPlayerId: vi.fn(),
  updateSignupRow: vi.fn(),
}));

vi.mock('@/lib/google-api', () => ({
  getMostRecentFileInfoFromFolder: vi.fn(),
  downloadCsvFromDrive: vi.fn(),
}));

vi.mock('@/lib/final-forms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/final-forms')>();
  return {
    ...actual,
    findFinalFormsMatch: vi.fn(),
  };
});

import { findSignupByPlayerId, updateSignupRow } from '@/lib/signups-sheet';
import { findFinalFormsMatch } from '@/lib/final-forms';
import { GET } from '@/app/api/signup/player/[playerId]/finalforms/route';

const findSignup = vi.mocked(findSignupByPlayerId);
const updateRow = vi.mocked(updateSignupRow);
const findMatch = vi.mocked(findFinalFormsMatch);

const PLAYER_ID = 'testplayerid';
const routeParams = { params: Promise.resolve({ playerId: PLAYER_ID }) };

function ffRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/signup/player/${PLAYER_ID}/finalforms`);
}

const matchedRecord = {
  studentId: 'FF-001',
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
  parent2Name: 'Ct Two',
  parent2Email: 'ct2@example.com',
  parent2Phone: '555-0102',
};

describe('GET /api/signup/player/[playerId]/finalforms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findSignup.mockResolvedValue({
      record: signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: PLAYER_ID }),
      rowNumber: 2,
    });
    updateRow.mockImplementation(async (_id, fields) => signupRecord(fields));
  });

  it('returns found: false when there is no join', async () => {
    findMatch.mockResolvedValue(null);
    const res = await GET(ffRequest(), routeParams);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, found: false });
    expect(updateRow).not.toHaveBeenCalled();
  });

  it('writes spsStudentId on the first real join and never for a magic-name fixture', async () => {
    findMatch.mockResolvedValue({ record: matchedRecord, dataAsOf: '2026-08-28', isTest: true });
    await GET(ffRequest(), routeParams);
    expect(updateRow).not.toHaveBeenCalled();

    findMatch.mockResolvedValue({ record: matchedRecord, dataAsOf: '2026-08-28' });
    await GET(ffRequest(), routeParams);
    expect(updateRow).toHaveBeenCalledWith(PLAYER_ID, { [SIGNUPS_COLUMNS.SPS_STUDENT_ID]: 'FF-001' });
  });

  it('does not overwrite an existing spsStudentId', async () => {
    findSignup.mockResolvedValue({
      record: signupRecord({
        [SIGNUPS_COLUMNS.PLAYER_ID]: PLAYER_ID,
        [SIGNUPS_COLUMNS.SPS_STUDENT_ID]: 'FF-EXISTING',
      }),
      rowNumber: 2,
    });
    findMatch.mockResolvedValue({ record: matchedRecord, dataAsOf: '2026-08-28' });
    await GET(ffRequest(), routeParams);
    expect(updateRow).not.toHaveBeenCalled();
  });

  it('offers seeded fields only while the signup row field is still empty', async () => {
    findSignup.mockResolvedValue({
      record: signupRecord({
        [SIGNUPS_COLUMNS.PLAYER_ID]: PLAYER_ID,
        [SIGNUPS_COLUMNS.GRADE]: '8',
        [SIGNUPS_COLUMNS.CARETAKER_1_NAME]: '',
      }),
      rowNumber: 2,
    });
    findMatch.mockResolvedValue({ record: matchedRecord, dataAsOf: '2026-08-28', isTest: true });

    const res = await GET(ffRequest(), routeParams);
    const data = await res.json();
    expect(data.found).toBe(true);
    expect(data.seeded.grade).toBeUndefined();
    expect(data.seeded.caretaker1Name).toBe('Ct One');
    expect(data.seeded.caretaker2Name).toBe('Ct Two');
    expect(data.parentSigned).toBe(true);
    expect(data.studentSigned).toBe(false);
  });
});
