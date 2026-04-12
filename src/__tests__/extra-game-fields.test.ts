import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { findGameColumns } from '@/lib/game-availability-helper';
import { GET as gameGet } from '@/app/api/game/[portalId]/route';
import { getPlayerGameAvailability } from '@/lib/game-availability-helper';
import { getCachedSheetData } from '@/lib/sheet-cache';

// ---------------------------------------------------------------------------
// Unit tests: findGameColumns — extra column discovery
// ---------------------------------------------------------------------------

describe('findGameColumns – extra column discovery', () => {
  const GAME_INFO_MOCK = [
    ['Date', 'Game #', 'Warmup Arrival', 'Game Start', 'Done By', 'Field Name', 'Field Location', 'Game Note'],
    ['4/25', 'Spring Reign Day 1', '8:00 AM', '9:00 AM', '5:00 PM', 'Burlington Field', '', ''],
  ];

  it('discovers extra columns for ordinal-1 game and strips date prefix from label', () => {
    const headerRow = [
      'Full Name',
      '4/25 Availability',
      '4/25 Activation Status',
      '4/25 Can Carpool There?',
      '4/25 Need Carpool There',
      '4/25 Lodging Plan',
      '4/25 Note',
    ];
    const result = findGameColumns(headerRow, '4/25', 1);
    expect(result).not.toBeNull();
    expect(result!.extraColumns).toHaveLength(3);

    const labels = result!.extraColumns.map(c => c.label);
    expect(labels).toEqual(['Can Carpool There?', 'Need Carpool There', 'Lodging Plan']);

    const names = result!.extraColumns.map(c => c.columnName);
    expect(names).toEqual(['4/25 Can Carpool There?', '4/25 Need Carpool There', '4/25 Lodging Plan']);

    // Column indices should be correct (0-based)
    expect(result!.extraColumns[0].columnIndex).toBe(3);
    expect(result!.extraColumns[1].columnIndex).toBe(4);
    expect(result!.extraColumns[2].columnIndex).toBe(5);
  });

  it('does not include availability, note, or activation status in extraColumns', () => {
    const headerRow = [
      'Full Name',
      '3/7',               // availability col (exact date = game 1)
      '3/7 Note',
      '3/7 Activation Status',
    ];
    const result = findGameColumns(headerRow, '3/7', 1);
    expect(result).not.toBeNull();
    expect(result!.extraColumns).toHaveLength(0);
  });

  it('populates ExtraColumn.note from headerNotes map', () => {
    const headerRow = [
      'Full Name',
      '4/25 Availability',
      '4/25 Can Carpool There?',
      '4/25 Note',
    ];
    const headerNotes = {
      '4/25 Can Carpool There?': 'If driving, how many can ride with you?',
    };
    const result = findGameColumns(headerRow, '4/25', 1, headerNotes);
    expect(result).not.toBeNull();
    expect(result!.extraColumns).toHaveLength(1);
    expect(result!.extraColumns[0].note).toBe('If driving, how many can ride with you?');
  });

  it('returns empty note when column has no entry in headerNotes', () => {
    const headerRow = ['Full Name', '4/25 Availability', '4/25 Lodging Plan', '4/25 Note'];
    const result = findGameColumns(headerRow, '4/25', 1, {});
    expect(result!.extraColumns[0].note).toBe('');
  });

  it('returns empty extraColumns when headerNotes is omitted', () => {
    const headerRow = ['Full Name', '4/25', '4/25 Note'];
    const result = findGameColumns(headerRow, '4/25', 1);
    // No extra columns since only availability + note present
    expect(result!.extraColumns).toHaveLength(0);
  });

  it('does not include ordinal-1 extra columns when looking for ordinal-2 game', () => {
    // The "4/25 Can Carpool There?" column has no "(Game 2)" suffix, so it must NOT
    // appear as an extra column for the ordinal-2 game on the same date.
    const headerRow = [
      'Full Name',
      '4/25 Availability',        // game 1 availability
      '4/25 Can Carpool There?',  // game 1 extra (no game suffix)
      '4/25 Note',                // game 1 note
      '4/25 Availability (Game 2)',
      '4/25 Note (Game 2)',
    ];
    const result = findGameColumns(headerRow, '4/25', 2);
    expect(result).not.toBeNull();
    expect(result!.availabilityColumn).toBe(4);
    expect(result!.noteColumn).toBe(5);
    // No "(Game 2)" suffixed extra columns exist — should be empty
    expect(result!.extraColumns).toHaveLength(0);
  });

  it('discovers extra columns with (Game 2) suffix for ordinal-2 game', () => {
    const headerRow = [
      'Full Name',
      '3/7 Availability (Game 2)',
      '3/7 Special Question (Game 2)',
      '3/7 Note (Game 2)',
    ];
    const result = findGameColumns(headerRow, '3/7', 2);
    expect(result).not.toBeNull();
    expect(result!.extraColumns).toHaveLength(1);
    expect(result!.extraColumns[0].label).toBe('Special Question');
    expect(result!.extraColumns[0].columnName).toBe('3/7 Special Question (Game 2)');
    expect(result!.extraColumns[0].columnIndex).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Integration tests: GET /api/game — extraFields in response
// ---------------------------------------------------------------------------

vi.mock('@/lib/google-api', () => ({
  getSheetData: vi.fn(async () => []),
  updateSheetData: vi.fn(async () => {}),
  getBatchSheetData: vi.fn(async () => []),
  getHeaderRowWithNotes: vi.fn(async () => []),
}));

vi.mock('@/lib/portal-cache', () => ({
  findPortalEntryByPortalId: vi.fn(async () => ({ lookupKey: 'TestPlayer' })),
}));

const GAME_INFO_MOCK = [
  ['Date', 'Game #', 'Warmup Arrival', 'Game Start', 'Done By', 'Field Name', 'Field Location', 'Game Note'],
  ['4/25', 'Spring Reign Day 1', '8:00 AM', '9:00 AM', '5:00 PM', 'Field', '', ''],
];

vi.mock('@/lib/sheet-cache', () => ({
  getCachedSheetData: vi.fn(async (sheetType: string) => {
    if (sheetType === 'GAME_INFO') return GAME_INFO_MOCK.map(r => [...r]);
    return [];
  }),
  getCachedGameAvailabilityHeaderNotes: vi.fn(async () => ({
    '4/25 Can Carpool There?': 'If driving, how many can ride with you?',
    '4/25 Need Carpool There': 'Do you need a carpool ride?',
  })),
  forceRefreshSheetCache: vi.fn(async () => {}),
}));

vi.mock('@/lib/game-availability-helper', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/game-availability-helper')>();
  return {
    ...mod,
    getPlayerGameAvailability: vi.fn(async () => ({
      // Full Name, Grade, Gender Identification, 4/25 Availability, 4/25 Activation Status,
      // 4/25 Can Carpool There?, 4/25 Need Carpool There, 4/25 Note
      headerRow: [
        'Full Name', 'Grade', 'Gender Identification',
        '4/25 Availability', '4/25 Activation Status',
        '4/25 Can Carpool There?', '4/25 Need Carpool There',
        '4/25 Note',
      ],
      playerRow: [
        'TestPlayer', '8', 'Bx',
        '👍 Planning to be there', 'Active',
        'Yes, 2 seats', '',
        'See you there!',
      ],
      rowIndex: 2,
      columnMapping: {},
    })),
  };
});

describe('GET /api/game – extraFields in response', () => {
  it('returns extraFields with correct labels, notes, and player values', async () => {
    const req = new NextRequest('http://localhost/api/game/p123');
    const res = await gameGet(req, { params: Promise.resolve({ portalId: 'p123' }) });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.games).toHaveLength(1);

    const game = data.games[0];
    expect(game.date).toBe('4/25');
    expect(game.availability.availability).toBe('👍 Planning to be there');
    expect(game.availability.note).toBe('See you there!');

    const extraFields = game.availability.extraFields;
    expect(extraFields).toHaveLength(2);

    expect(extraFields[0].columnName).toBe('4/25 Can Carpool There?');
    expect(extraFields[0].label).toBe('Can Carpool There?');
    expect(extraFields[0].note).toBe('If driving, how many can ride with you?');
    expect(extraFields[0].value).toBe('Yes, 2 seats');

    expect(extraFields[1].columnName).toBe('4/25 Need Carpool There');
    expect(extraFields[1].label).toBe('Need Carpool There');
    expect(extraFields[1].note).toBe('Do you need a carpool ride?');
    expect(extraFields[1].value).toBe('');
  });

  it('returns empty extraFields array for games with no extra columns', async () => {
    vi.mocked(getPlayerGameAvailability).mockResolvedValueOnce({
      headerRow: ['Full Name', 'Grade', 'Gender Identification', '4/25', '4/25 Note', '4/25 Activation Status'],
      playerRow: ['TestPlayer', '8', 'Bx', '👍 Planning to be there', '', 'Active'],
      rowIndex: 2,
      columnMapping: {},
    });

    const req = new NextRequest('http://localhost/api/game/p123');
    const res = await gameGet(req, { params: Promise.resolve({ portalId: 'p123' }) });
    const data = await res.json();

    expect(data.success).toBe(true);
    const game = data.games[0];
    expect(game.availability.extraFields).toHaveLength(0);
  });
});
