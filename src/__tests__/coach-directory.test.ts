import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';
import { ROSTER_COLUMN_NAMES } from '@/lib/sheet-config';
import { signupRecord } from './fixtures/signup-record';

vi.mock('@/lib/google-api', () => ({
  getSheetData: vi.fn(),
  appendSheetData: vi.fn(),
  updateSheetData: vi.fn(),
}));

vi.mock('@/lib/sheet-cache', () => ({
  getCachedSheetData: vi.fn(),
}));

vi.mock('@/lib/signups-config', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/signups-config')>();
  return {
    ...actual,
    SIGNUPS_SHEET_CONFIG: { ...actual.SIGNUPS_SHEET_CONFIG, SIGNUPS_SHEET_ID: 'test-signups-sheet' },
  };
});

import { getSheetData } from '@/lib/google-api';
import { getCachedSheetData } from '@/lib/sheet-cache';
import { listRosteredPlayers, getPlayerDirectoryEntry } from '@/lib/coach-directory';

const getData = vi.mocked(getSheetData);
const getCachedData = vi.mocked(getCachedSheetData);

const SIGNUPS_HEADER = Object.values(SIGNUPS_COLUMNS) as string[];
const ROSTER_HEADER = [ROSTER_COLUMN_NAMES.PLAYER_ID, ROSTER_COLUMN_NAMES.TEAM];

function signupRow(overrides: Record<string, string>): string[] {
  const record = signupRecord(overrides);
  return SIGNUPS_HEADER.map(h => record[h] ?? '');
}

const ROSTERED = signupRow({
  [SIGNUPS_COLUMNS.PLAYER_ID]: 'p001',
  [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'TestFirst',
  [SIGNUPS_COLUMNS.LAST_NAME]: 'TestLast',
  [SIGNUPS_COLUMNS.GRADE]: '7',
  [SIGNUPS_COLUMNS.GENDER_IDENTIFICATION]: 'Girl',
  [SIGNUPS_COLUMNS.ALLERGIES]: 'Peanuts',
  [SIGNUPS_COLUMNS.STUDENT_PERSONAL_EMAIL]: 'player@example.com',
  [SIGNUPS_COLUMNS.STUDENT_CELL_PHONE]: '555-0100',
  [SIGNUPS_COLUMNS.CARETAKER_1_NAME]: 'Ct One',
  [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: 'ct1@example.com',
  [SIGNUPS_COLUMNS.CARETAKER_1_PHONE]: '555-0101',
  [SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]: 'photo-1',
});

// A signup with no row at all on the Roster tab yet: not Rostered, unlike ROSTERED (which is,
// whatever its Team cell says).
const NOT_ON_ROSTER = signupRow({
  [SIGNUPS_COLUMNS.PLAYER_ID]: 'p002',
  [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'ab0512',
  [SIGNUPS_COLUMNS.LAST_NAME]: 'NotOnRoster',
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listRosteredPlayers', () => {
  it('includes a signup with a named Team, sorted by full name', async () => {
    getData.mockResolvedValue([SIGNUPS_HEADER, ROSTERED, NOT_ON_ROSTER]);
    getCachedData.mockResolvedValue([ROSTER_HEADER, ['p001', 'Green']]);

    const players = await listRosteredPlayers();

    expect(players).toEqual([{ playerId: 'p001', fullName: 'TestFirst TestLast' }]);
  });

  it('includes a signup whose Team is still TBD or blank: being on the Roster tab at all is what makes them Rostered', async () => {
    getData.mockResolvedValue([SIGNUPS_HEADER, ROSTERED]);
    getCachedData.mockResolvedValue([ROSTER_HEADER, ['p001', 'TBD']]);
    expect(await listRosteredPlayers()).toEqual([{ playerId: 'p001', fullName: 'TestFirst TestLast' }]);

    getCachedData.mockResolvedValue([ROSTER_HEADER, ['p001', '']]);
    expect(await listRosteredPlayers()).toEqual([{ playerId: 'p001', fullName: 'TestFirst TestLast' }]);
  });

  it('excludes a signup with no row at all on the Roster tab', async () => {
    getData.mockResolvedValue([SIGNUPS_HEADER, NOT_ON_ROSTER]);
    getCachedData.mockResolvedValue([ROSTER_HEADER]);

    expect(await listRosteredPlayers()).toEqual([]);
  });
});

describe('getPlayerDirectoryEntry', () => {
  it('returns the joined profile, contact, and caretaker fields for a Rostered Player', async () => {
    getData.mockResolvedValue([SIGNUPS_HEADER, ROSTERED]);
    getCachedData.mockResolvedValue([ROSTER_HEADER, ['p001', 'Green']]);

    const entry = await getPlayerDirectoryEntry('p001');

    expect(entry).toEqual({
      playerId: 'p001',
      fullName: 'TestFirst TestLast',
      team: 'Green',
      grade: '7',
      gender: 'Girl',
      hasPhoto: true,
      allergies: 'Peanuts',
      studentEmail: 'player@example.com',
      studentPhone: '555-0100',
      caretakers: [{ name: 'Ct One', email: 'ct1@example.com', phone: '555-0101' }],
    });
  });

  it('normalizes a blank or TBD Team to "TBD" rather than excluding the player', async () => {
    getData.mockResolvedValue([SIGNUPS_HEADER, ROSTERED]);

    getCachedData.mockResolvedValue([ROSTER_HEADER, ['p001', 'TBD']]);
    expect((await getPlayerDirectoryEntry('p001'))?.team).toBe('TBD');

    getCachedData.mockResolvedValue([ROSTER_HEADER, ['p001', '']]);
    expect((await getPlayerDirectoryEntry('p001'))?.team).toBe('TBD');
  });

  it('returns null for a signup with no row at all on the Roster tab', async () => {
    getData.mockResolvedValue([SIGNUPS_HEADER, NOT_ON_ROSTER]);
    getCachedData.mockResolvedValue([ROSTER_HEADER]);

    expect(await getPlayerDirectoryEntry('p002')).toBeNull();
  });

  it('returns null for an unknown player', async () => {
    getData.mockResolvedValue([SIGNUPS_HEADER, ROSTERED]);
    getCachedData.mockResolvedValue([ROSTER_HEADER, ['p001', 'Green']]);

    expect(await getPlayerDirectoryEntry('nope')).toBeNull();
  });
});
