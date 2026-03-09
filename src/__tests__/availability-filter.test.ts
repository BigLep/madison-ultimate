import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as practiceGet } from '@/app/api/practice/[portalId]/route';
import { GET as gameGet } from '@/app/api/game/[portalId]/route';
import { getCachedSheetData } from '@/lib/sheet-cache';
import { getPlayerGameAvailability } from '@/lib/game-availability-helper';

// Avoid loading real Google auth when route imports google-api
vi.mock('@/lib/google-api', () => ({
  getSheetData: vi.fn(async () => []),
  updateSheetData: vi.fn(async () => {}),
  getBatchSheetData: vi.fn(async () => []),
}));

// Practice Info: header + 2 practices (3/7 and 3/14). Columns: Date, Field Name, Field Location, Start, End, Duration, Note
const PRACTICE_INFO_MOCK = [
  ['Date', 'Field Name', 'Field Location', 'Start', 'End', 'Duration', 'Note'],
  ['3/7', 'Field A', 'Field A', '4:00 PM', '5:30 PM', '1:30', ''],
  ['3/14', 'Field B', 'Field B', '4:00 PM', '5:30 PM', '1:30', ''],
];

// Game Info: full header to match real sheet; availability sheet will only have column for 3/7.
const GAME_INFO_MOCK = [
  ['Date', 'Game #', 'Warmup Arrival', 'Game Start', 'Done By', 'Field Name', 'Field Location', 'Game Note', 'Opponent', 'Oponent Team Page', 'Google Calendar Event ID', 'Google Calendar Warmup Event ID'],
  ['3/7', '1', '4:00', '4:30', '6:00', 'Main Field', 'Main Field', '', '', '', '', ''],
  ['3/21', '2', '4:00', '4:30', '6:00', 'Main Field', 'Main Field', '', '', '', '', ''],
];

vi.mock('@/lib/portal-cache', () => ({
  findPortalEntryByPortalId: vi.fn(async () => ({ lookupKey: 'TestPlayer' })),
}));

vi.mock('@/lib/sheet-cache', () => ({
  getCachedSheetData: vi.fn(async (sheetType: string) => {
    if (sheetType === 'PRACTICE_INFO') return PRACTICE_INFO_MOCK.map((row) => [...row]);
    if (sheetType === 'GAME_INFO') return GAME_INFO_MOCK.map((row) => [...row]);
    return [];
  }),
  forceRefreshSheetCache: vi.fn(async () => {}),
}));

// Headers used in mocks (only 3/7 has a column; 3/14 and 3/21 do not) – inline in factories for hoisting
vi.mock('@/lib/practice-availability-helper', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/practice-availability-helper')>();
  return {
    ...mod,
    getPlayerPracticeAvailability: vi.fn(async () => ({
      headerRow: ['Full Name', 'Grade', 'Gender Identification', '3/7', '3/7 Note'],
      playerRow: ['TestPlayer', '', '', '', ''],
      rowIndex: 2,
      columnMapping: {},
    })),
  };
});

vi.mock('@/lib/game-availability-helper', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/game-availability-helper')>();
  return {
    ...mod,
    getPlayerGameAvailability: vi.fn(async () => ({
      headerRow: ['Full Name', 'Grade', 'Gender Identification', '3/7', '3/7 Note', '3/7 Activation Status'],
      playerRow: ['TestPlayer', '', '', '', '', ''],
      rowIndex: 2,
      columnMapping: {},
    })),
  };
});

describe('Practice and Game API – filter by availability columns', () => {
  it('GET /api/practice/[portalId] returns only practices that have a column in Practice Availability', async () => {
    const req = new NextRequest('http://localhost/api/practice/p123');
    const res = await practiceGet(req, { params: Promise.resolve({ portalId: 'p123' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.practices).toHaveLength(1);
    expect(data.practices[0].date).toBe('3/7');
    // 3/14 is in Practice Info but has no column in Practice Availability, so it must not appear
    const dates = data.practices.map((p: { date: string }) => p.date);
    expect(dates).not.toContain('3/14');
  });

  it('GET /api/game/[portalId] returns only games that have a column in Game Availability', async () => {
    const req = new NextRequest('http://localhost/api/game/p123');
    const res = await gameGet(req, { params: Promise.resolve({ portalId: 'p123' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.games).toHaveLength(1);
    expect(data.games[0].date).toBe('3/7');
    expect(data.games[0].gameNumber).toBe('1');
    // 3/21 game is in Game Info but has no column in Game Availability, so it must not appear
    const dates = data.games.map((g: { date: string }) => g.date);
    expect(dates).not.toContain('3/21');
  });

  it('GET /api/game/[portalId] returns both games when two games on same date have columns (unsuffixed + Game 2)', async () => {
    const gameInfoTwoOnSameDay = [
      ['Date', 'Game #', 'Warmup Arrival', 'Game Start', 'Done By', 'Field Name', 'Field Location', 'Game Note', 'Opponent', 'Oponent Team Page'],
      ['3/7', '1', '4:00', '4:30', '6:00', 'Main Field', 'Main Field', '', '', ''],
      ['3/7', '2', '5:00', '5:30', '7:00', 'Main Field', 'Main Field', '', '', ''],
    ];
    const headerWithGame2 = [
      'Full Name',
      'Grade',
      'Gender Identification',
      '3/7',
      '3/7 Note',
      '3/7 Activation Status',
      '3/7 Availability (Game 2)',
      '3/7 Note (Game 2)',
      '3/7 Activation Status (Game 2)',
    ];
    vi.mocked(getCachedSheetData).mockImplementation(async (sheetType: string) => {
      if (sheetType === 'PRACTICE_INFO') return PRACTICE_INFO_MOCK.map((row) => [...row]);
      if (sheetType === 'GAME_INFO') return gameInfoTwoOnSameDay.map((row) => [...row]);
      return [];
    });
    vi.mocked(getPlayerGameAvailability).mockResolvedValue({
      headerRow: headerWithGame2,
      playerRow: ['TestPlayer', '', '', '', '', '', '', '', ''],
      rowIndex: 2,
      columnMapping: {},
    });

    const req = new NextRequest('http://localhost/api/game/p123');
    const res = await gameGet(req, { params: Promise.resolve({ portalId: 'p123' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.games).toHaveLength(2);
    expect(data.games[0].date).toBe('3/7');
    expect(data.games[0].gameNumber).toBe('1');
    expect(data.games[1].date).toBe('3/7');
    expect(data.games[1].gameNumber).toBe('2');
  });
});
