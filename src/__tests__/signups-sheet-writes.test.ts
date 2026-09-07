import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';
import { COMPLETE_PLAYER_INFO, signupRecord } from './fixtures/signup-record';

vi.mock('@/lib/google-api', () => ({
  getSheetData: vi.fn(),
  appendSheetData: vi.fn(),
  updateSheetData: vi.fn(),
}));

vi.mock('@/lib/signups-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/signups-config')>();
  return {
    ...actual,
    SIGNUPS_SHEET_CONFIG: { ...actual.SIGNUPS_SHEET_CONFIG, SIGNUPS_SHEET_ID: 'test-signups-sheet' },
  };
});

import { getSheetData, appendSheetData, updateSheetData } from '@/lib/google-api';
import { createSignupRow, updateSignupRow, recomputeProfileCompleteForAllRows } from '@/lib/signups-sheet';

const getData = vi.mocked(getSheetData);
const appendData = vi.mocked(appendSheetData);
const updateData = vi.mocked(updateSheetData);

const HEADER = Object.values(SIGNUPS_COLUMNS) as string[];
const col = (name: string) => HEADER.indexOf(name);

const COMPLETE_ROW = {
  ...COMPLETE_PLAYER_INFO,
  [SIGNUPS_COLUMNS.CARETAKER_1_NAME]: 'Ct One',
  [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: 'ct1@example.com',
  [SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]: 'photo-1',
};

function sheetRow(overrides: Record<string, string>): string[] {
  const record = signupRecord(overrides);
  return HEADER.map(h => record[h] ?? '');
}

function stubSheet(...rows: string[][]) {
  getData.mockResolvedValue([HEADER, ...rows]);
}

describe('createSignupRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appendData.mockResolvedValue(undefined as never);
  });

  it('computes Profile Complete and stamps Created At and Updated At', async () => {
    stubSheet();
    const created = await createSignupRow({ [SIGNUPS_COLUMNS.LAST_NAME]: 'Newlast' });
    expect(created[SIGNUPS_COLUMNS.PLAYER_ID]).toHaveLength(5);
    expect(created[SIGNUPS_COLUMNS.PROFILE_COMPLETE]).toBe('FALSE');
    expect(created[SIGNUPS_COLUMNS.CREATED_AT]).toBe(created[SIGNUPS_COLUMNS.UPDATED_AT]);
    const appended = appendData.mock.calls[0][2][0];
    expect(appended[col(SIGNUPS_COLUMNS.PROFILE_COMPLETE)]).toBe('FALSE');
  });

  it('honors a caller-supplied Created At so a seeded row has one instant for all three stamps', async () => {
    stubSheet();
    const created = await createSignupRow({ [SIGNUPS_COLUMNS.CREATED_AT]: '2026-09-07T13:00:00.000Z', [SIGNUPS_COLUMNS.SEEDED_AT]: '2026-09-07T13:00:00.000Z' });
    expect(created[SIGNUPS_COLUMNS.CREATED_AT]).toBe('2026-09-07T13:00:00.000Z');
    expect(created[SIGNUPS_COLUMNS.UPDATED_AT]).toBe('2026-09-07T13:00:00.000Z');
    expect(created[SIGNUPS_COLUMNS.SEEDED_AT]).toBe('2026-09-07T13:00:00.000Z');
  });

  it('writes Grade as a number so the sheet cell matches the numeric Final Forms grade', async () => {
    stubSheet();
    const created = await createSignupRow({ [SIGNUPS_COLUMNS.GRADE]: '7' });
    expect(created[SIGNUPS_COLUMNS.GRADE]).toBe('7'); // the record stays text
    const appended = appendData.mock.calls[0][2][0];
    expect(appended[col(SIGNUPS_COLUMNS.GRADE)]).toBe(7);
  });

  it('leaves an empty Grade as an empty cell rather than a zero', async () => {
    stubSheet();
    await createSignupRow({ [SIGNUPS_COLUMNS.LAST_NAME]: 'Newlast' });
    const appended = appendData.mock.calls[0][2][0];
    expect(appended[col(SIGNUPS_COLUMNS.GRADE)]).toBe('');
  });
});

describe('updateSignupRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateData.mockResolvedValue(undefined as never);
  });

  it('recomputes Profile Complete from the merged row and bumps Updated At by default', async () => {
    stubSheet(sheetRow({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-1', [SIGNUPS_COLUMNS.UPDATED_AT]: '2026-09-01T00:00:00.000Z', ...COMPLETE_PLAYER_INFO }));
    const updated = await updateSignupRow('p-1', {
      [SIGNUPS_COLUMNS.CARETAKER_1_NAME]: 'Ct One',
      [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: 'ct1@example.com',
      [SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]: 'photo-1',
    });
    expect(updated[SIGNUPS_COLUMNS.PROFILE_COMPLETE]).toBe('TRUE');
    expect(updated[SIGNUPS_COLUMNS.UPDATED_AT]).not.toBe('2026-09-01T00:00:00.000Z');
    const written = updateData.mock.calls[0][2][0];
    expect(written[col(SIGNUPS_COLUMNS.PROFILE_COMPLETE)]).toBe('TRUE');
  });

  it('writes Grade as a number on update, including a stored text grade that was not edited', async () => {
    stubSheet(sheetRow({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-1', [SIGNUPS_COLUMNS.GRADE]: '8' }));
    await updateSignupRow('p-1', { [SIGNUPS_COLUMNS.HOPES]: 'Have fun' });
    const written = updateData.mock.calls[0][2][0];
    expect(written[col(SIGNUPS_COLUMNS.GRADE)]).toBe(8);
    expect(written[col(SIGNUPS_COLUMNS.HOPES)]).toBe('Have fun');
  });

  it('leaves Updated At alone when told the write is system-only', async () => {
    stubSheet(sheetRow({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-1', [SIGNUPS_COLUMNS.UPDATED_AT]: '2026-09-01T00:00:00.000Z' }));
    const updated = await updateSignupRow('p-1', {}, { touchUpdatedAt: false });
    expect(updated[SIGNUPS_COLUMNS.UPDATED_AT]).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('recomputeProfileCompleteForAllRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateData.mockResolvedValue(undefined as never);
  });

  it('writes only the Profile Complete cell of rows whose stored value is stale', async () => {
    stubSheet(
      sheetRow({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-stale', ...COMPLETE_ROW, [SIGNUPS_COLUMNS.PROFILE_COMPLETE]: '' }),
      sheetRow({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-fresh', [SIGNUPS_COLUMNS.PROFILE_COMPLETE]: 'FALSE' }),
      sheetRow({ [SIGNUPS_COLUMNS.PLAYER_ID]: '', [SIGNUPS_COLUMNS.PROFILE_COMPLETE]: '' }),
    );
    const written = await recomputeProfileCompleteForAllRows();
    expect(written).toBe(1);
    expect(updateData).toHaveBeenCalledTimes(1);
    const [, range, values] = updateData.mock.calls[0];
    expect(range).toMatch(/!\w+2$/); // row 2: header +1, first data row
    expect(values).toEqual([['TRUE']]);
  });

  it('throws when the sheet has no Profile Complete header rather than writing into the wrong column', async () => {
    getData.mockResolvedValue([HEADER.filter(h => h !== SIGNUPS_COLUMNS.PROFILE_COMPLETE)]);
    await expect(recomputeProfileCompleteForAllRows()).rejects.toThrow(/Profile Complete/);
  });
});
