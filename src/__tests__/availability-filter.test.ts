import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as practiceGet, POST as practicePost } from '@/app/api/player/[playerId]/practice/route';
import { GET as gameGet, POST as gamePost } from '@/app/api/player/[playerId]/game/route';
import { getCachedSheetData } from '@/lib/sheet-cache';
import { getPlayerGameAvailability } from '@/lib/game-availability-helper';
import { getPlayerPracticeAvailability } from '@/lib/practice-availability-helper';
import { loadPortalPlayer } from '@/lib/portal-player';
import { updateSheetData } from '@/lib/google-api';

// Avoid loading real Google auth when route imports google-api
vi.mock('@/lib/google-api', () => ({
  getSheetData: vi.fn(async () => []),
  updateSheetData: vi.fn(async () => {}),
  getBatchSheetData: vi.fn(async () => []),
}));

// Practice Info by header name (player-portal-grill.md Q16): Date is not in column A here on purpose.
const PRACTICE_INFO_MOCK = [
  ['Note', 'Date', 'Field Name', 'Field Location', 'Start', 'End', 'Duration', 'Google Calendar Event ID'],
  ['', '3/7', 'Field A', 'East', '4:00 PM', '5:30 PM', '1:30', ''],
  ['Cancelled - rain', '3/14', 'Field B', '', '4:00 PM', '5:30 PM', '1:30', ''],
];

// Game Info with the Fall 2026 Team column (Q25): one row per team-game, blank Team = everyone.
const GAME_INFO_MOCK = [
  ['Date', 'Label', 'Warmup Arrival', 'Game Start', 'Done By', 'Field Name', 'Field Location', 'Game Note', 'Opponent', 'Oponent Team Page', 'Google Calendar Event ID', 'Google Calendar Warmup Event ID', 'Team'],
  ['3/7', 'Game 1', '4:00', '4:30', '6:00', 'Main Field', 'Main Field', 'bring water', '', '', '', '', 'Blue'],
  ['3/7', 'Game 1', '4:00', '4:30', '6:00', 'Other Field', 'Other Field', '', '', '', '', '', 'Gold'],
  ['3/7', 'Jamboree', '1:00', '1:30', '3:00', 'Main Field', '', '', '', '', '', '', ''],
  ['3/21', 'Game 2', '4:00', '4:30', '6:00', 'Main Field', 'Main Field', '', '', '', '', '', 'Blue'],
];

// Mock dates are M/D in the current year; pin "upcoming" so the tests don't depend on today's date.
vi.mock('@/lib/practice-config', async importOriginal => {
  const mod = await importOriginal<typeof import('@/lib/practice-config')>();
  return { ...mod, isPracticeInPast: () => false };
});
vi.mock('@/lib/game-config', async importOriginal => {
  const mod = await importOriginal<typeof import('@/lib/game-config')>();
  return { ...mod, isGameInPast: () => false };
});

vi.mock('@/lib/portal-player', () => ({
  loadPortalPlayer: vi.fn(async () => ({ playerId: 'p001', fullName: 'TestFirst TestLast', team: 'Blue', record: {} })),
}));

vi.mock('@/lib/sheet-cache', () => ({
  getCachedSheetData: vi.fn(async (sheetType: string) => {
    if (sheetType === 'PRACTICE_INFO') return PRACTICE_INFO_MOCK.map(row => [...row]);
    if (sheetType === 'GAME_INFO') return GAME_INFO_MOCK.map(row => [...row]);
    return [];
  }),
  getCachedGameAvailabilityHeaderNotes: vi.fn(async () => ({})),
  forceRefreshSheetCache: vi.fn(async () => {}),
}));

const PRACTICE_ROW = {
  headerRow: ['Full Name', 'PlayerID', 'Grade', 'Gender Identification', '3/7', '3/7 Note'],
  playerRow: ['TestFirst TestLast', 'p001', '', '', '', ''],
  rowIndex: 2,
  columnMapping: {},
};
const GAME_ROW = {
  headerRow: ['Full Name', 'PlayerID', 'Grade', 'Gender Identification', '3/7 Availability', '3/7 Note', '3/7 Activation Status'],
  playerRow: ['TestFirst TestLast', 'p001', '', '', '', '', ''],
  rowIndex: 2,
  columnMapping: {},
};

vi.mock('@/lib/practice-availability-helper', async importOriginal => {
  const mod = await importOriginal<typeof import('@/lib/practice-availability-helper')>();
  return { ...mod, getPlayerPracticeAvailability: vi.fn(async () => PRACTICE_ROW) };
});

vi.mock('@/lib/game-availability-helper', async importOriginal => {
  const mod = await importOriginal<typeof import('@/lib/game-availability-helper')>();
  return { ...mod, getPlayerGameAvailability: vi.fn(async () => GAME_ROW) };
});

const params = { params: Promise.resolve({ playerId: 'p001' }) };

beforeEach(() => {
  vi.mocked(getCachedSheetData).mockImplementation(async (sheetType: string) => {
    if (sheetType === 'PRACTICE_INFO') return PRACTICE_INFO_MOCK.map(row => [...row]);
    if (sheetType === 'GAME_INFO') return GAME_INFO_MOCK.map(row => [...row]);
    return [];
  });
  vi.mocked(getPlayerPracticeAvailability).mockResolvedValue(PRACTICE_ROW);
  vi.mocked(getPlayerGameAvailability).mockResolvedValue(GAME_ROW);
  vi.mocked(loadPortalPlayer).mockResolvedValue({ playerId: 'p001', fullName: 'TestFirst TestLast', team: 'Blue', record: {} });
  vi.mocked(updateSheetData).mockClear();
});

describe('GET /api/player/[playerId]/practice', () => {
  it('reads Practice Info by header name and returns only practices with an availability column', async () => {
    const res = await practiceGet(new NextRequest('http://localhost/api/player/p001/practice'), params);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.availabilityOpen).toBe(true);
    expect(data.practices).toHaveLength(1);
    expect(data.practices[0].date).toBe('3/7');
    expect(data.practices[0].location).toBe('Field A (East)');
  });

  it('shows the whole schedule read-only when the player has no availability row', async () => {
    vi.mocked(getPlayerPracticeAvailability).mockResolvedValue(null);
    const res = await practiceGet(new NextRequest('http://localhost/api/player/p001/practice'), params);
    const data = await res.json();
    expect(data.availabilityOpen).toBe(false);
    expect(data.practices.map((p: { date: string }) => p.date)).toEqual(expect.arrayContaining(['3/7', '3/14']));
    expect(data.practices.find((p: { date: string }) => p.date === '3/14').isCancelled).toBe(true);
  });

  it('404s on a write when availability tracking is not open for the player', async () => {
    vi.mocked(getPlayerPracticeAvailability).mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/player/p001/practice', {
      method: 'POST',
      body: JSON.stringify({ practiceDate: '3/7', availability: '👍 Planning to be there' }),
    });
    const res = await practicePost(req, params);
    expect(res.status).toBe(404);
    expect(updateSheetData).not.toHaveBeenCalled();
  });

  it('refuses a write for a cancelled practice found by header name', async () => {
    const req = new NextRequest('http://localhost/api/player/p001/practice', {
      method: 'POST',
      body: JSON.stringify({ practiceDate: '3/14', availability: '👍 Planning to be there' }),
    });
    const res = await practicePost(req, params);
    expect(res.status).toBe(400);
    expect(updateSheetData).not.toHaveBeenCalled();
  });
});

describe('GET /api/player/[playerId]/game', () => {
  it('shows a Blue player only Blue rows and all-team rows, filtered to dates with availability columns', async () => {
    const res = await gameGet(new NextRequest('http://localhost/api/player/p001/game'), params);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.player.teamDisplay).toBe('🟦 Blue');
    expect(data.games.map((g: { gameLabel: string; date: string }) => `${g.date} ${g.gameLabel}`)).toEqual(['3/7 Game 1', '3/7 Jamboree']);
    expect(data.games[0].location).toBe('Main Field (Main Field)');
    expect(data.games[0].gameNote).toBe('bring water');
  });

  it('numbers "(Game 2)" per date and per team: the Jamboree is the first all-team game, not game 3', async () => {
    vi.mocked(getPlayerGameAvailability).mockResolvedValue({
      ...GAME_ROW,
      headerRow: [...GAME_ROW.headerRow, '3/7 Availability (Game 2)', '3/7 Note (Game 2)', '3/7 Activation Status (Game 2)'],
      playerRow: [...GAME_ROW.playerRow, '', '', ''],
    });
    const res = await gameGet(new NextRequest('http://localhost/api/player/p001/game'), params);
    const data = await res.json();
    // Blue Game 1 is ordinal 1 for (3/7, Blue); Jamboree is ordinal 1 for (3/7, blank). Neither is game 2.
    expect(data.games.map((g: { ordinalForDate: number }) => g.ordinalForDate)).toEqual([1, 1]);
  });

  it('shows an unassigned player only all-team rows', async () => {
    vi.mocked(loadPortalPlayer).mockResolvedValue({ playerId: 'p001', fullName: 'TestFirst TestLast', team: 'TBD', record: {} });
    const res = await gameGet(new NextRequest('http://localhost/api/player/p001/game'), params);
    const data = await res.json();
    expect(data.games.map((g: { gameLabel: string }) => g.gameLabel)).toEqual(['Jamboree']);
  });

  it('shows the whole visible schedule read-only when the player has no availability row', async () => {
    vi.mocked(getPlayerGameAvailability).mockResolvedValue(null);
    const res = await gameGet(new NextRequest('http://localhost/api/player/p001/game'), params);
    const data = await res.json();
    expect(data.availabilityOpen).toBe(false);
    expect(data.games.map((g: { date: string }) => g.date)).toEqual(['3/7', '3/7', '3/21']);
  });

  it('writes availability to the row matched by PlayerID for a game visible to the player', async () => {
    const req = new NextRequest('http://localhost/api/player/p001/game', {
      method: 'POST',
      body: JSON.stringify({ gameKey: '3/7|Game 1', availability: '👍 Planning to be there', note: 'late' }),
    });
    const res = await gamePost(req, params);
    expect(res.status).toBe(200);
    expect(updateSheetData).toHaveBeenCalledTimes(2);
    expect(vi.mocked(updateSheetData).mock.calls[0][1]).toBe("'Game Availability'!E2");
    expect(vi.mocked(updateSheetData).mock.calls[1][1]).toBe("'Game Availability'!F2");
  });

  it("404s a write for another team's game", async () => {
    vi.mocked(loadPortalPlayer).mockResolvedValue({ playerId: 'p001', fullName: 'TestFirst TestLast', team: 'Silver', record: {} });
    const req = new NextRequest('http://localhost/api/player/p001/game', {
      method: 'POST',
      body: JSON.stringify({ gameKey: '3/7|Game 1', availability: '👍 Planning to be there' }),
    });
    const res = await gamePost(req, params);
    expect(res.status).toBe(404);
    expect(updateSheetData).not.toHaveBeenCalled();
  });
});
