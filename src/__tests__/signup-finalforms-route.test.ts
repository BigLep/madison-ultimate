import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';
import { signupRecord } from './fixtures/signup-record';
import { finalFormsRecord } from './fixtures/final-forms-record';

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

// carryOverPhotoFromLastSeason's own behavior (sheet lookup, Drive download/upload) is covered
// by photo-carryover.test.ts; mocking it here at the route's boundary tests only how the route
// orchestrates it, not its internals. Mocking one layer lower (google-api/google-oauth-drive)
// previously left this mock missing getSheetDataWithHyperlinks, so the real carryover call threw
// and got silently swallowed by the route's own try/catch, exercising no one's intended path.
vi.mock('@/lib/photo-carryover', () => ({
  carryOverPhotoFromLastSeason: vi.fn(),
}));

import { findSignupByPlayerId, updateSignupRow } from '@/lib/signups-sheet';
import { findFinalFormsMatch } from '@/lib/final-forms';
import { carryOverPhotoFromLastSeason } from '@/lib/photo-carryover';
import { GET } from '@/app/api/signup/player/[playerId]/finalforms/route';

const findSignup = vi.mocked(findSignupByPlayerId);
const updateRow = vi.mocked(updateSignupRow);
const findMatch = vi.mocked(findFinalFormsMatch);
const carryOverPhoto = vi.mocked(carryOverPhotoFromLastSeason);

const PLAYER_ID = 'testplayerid';
const routeParams = { params: Promise.resolve({ playerId: PLAYER_ID }) };

function ffRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/signup/player/${PLAYER_ID}/finalforms`);
}

const matchedRecord = finalFormsRecord({
  studentId: 'FF-001',
  parent2Name: 'Ct Two',
  parent2Email: 'ct2@example.com',
  parent2Phone: '555-0102',
});

describe('GET /api/signup/player/[playerId]/finalforms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findSignup.mockResolvedValue({
      record: signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: PLAYER_ID }),
      rowNumber: 2,
    });
    updateRow.mockImplementation(async (_id, fields) => signupRecord(fields));
    carryOverPhoto.mockResolvedValue(null);
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
    const res = await GET(ffRequest(), routeParams);
    expect(updateRow).toHaveBeenCalledWith(PLAYER_ID, { [SIGNUPS_COLUMNS.SPS_STUDENT_ID]: 'FF-001' });
    expect((await res.json()).photoCarriedOver).toBe(false);
  });

  it('carries over last season\'s photo on the first real join and reports photoCarriedOver', async () => {
    findMatch.mockResolvedValue({ record: matchedRecord, dataAsOf: '2026-08-28' });
    carryOverPhoto.mockResolvedValue('carried-over-file-id');

    const res = await GET(ffRequest(), routeParams);

    expect(carryOverPhoto).toHaveBeenCalledWith(PLAYER_ID, 'FF-001');
    expect(updateRow).toHaveBeenCalledWith(PLAYER_ID, {
      [SIGNUPS_COLUMNS.SPS_STUDENT_ID]: 'FF-001',
      [SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]: 'carried-over-file-id',
    });
    expect((await res.json()).photoCarriedOver).toBe(true);
  });

  it('never attempts carryover when the player already has a current-season photo', async () => {
    findSignup.mockResolvedValue({
      record: signupRecord({
        [SIGNUPS_COLUMNS.PLAYER_ID]: PLAYER_ID,
        [SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]: 'already-has-a-photo',
      }),
      rowNumber: 2,
    });
    findMatch.mockResolvedValue({ record: matchedRecord, dataAsOf: '2026-08-28' });

    const res = await GET(ffRequest(), routeParams);

    expect(carryOverPhoto).not.toHaveBeenCalled();
    expect(updateRow).toHaveBeenCalledWith(PLAYER_ID, { [SIGNUPS_COLUMNS.SPS_STUDENT_ID]: 'FF-001' });
    expect((await res.json()).photoCarriedOver).toBe(false);
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
