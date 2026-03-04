import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ROSTER_MOCK } from './fixtures/roster-mock';
import { GET } from '@/app/api/debug/route';

const mockDebugData = () => ({
  unmatchedEmails: [],
  matchedEmails: [],
  totalMailingListEmails: 0,
  totalPlayerEmails: 0,
});

vi.mock('@/lib/cache-manager', () => ({
  default: {
    getInstance: vi.fn(() => ({
      getDebugData: vi.fn(async () => mockDebugData()),
    })),
  },
}));

vi.mock('@/lib/sheet-cache', () => ({
  getCachedSheetData: vi.fn(async (sheetType: string) => {
    if (sheetType === 'ROSTER') return [...ROSTER_MOCK.map((row) => [...row])];
    return [];
  }),
  forceRefreshSheetCache: vi.fn(async () => {}),
}));

describe('GET /api/debug', () => {
  it('includes rosterLookupKeys when rosterKeys=1', async () => {
    const req = new NextRequest('http://localhost/api/debug?rosterKeys=1');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rosterLookupKeys).toBeDefined();
    expect(data.rosterLookupKeys.source).toBe('sheet');
    expect(data.rosterLookupKeys.count).toBe(4);
    expect(data.rosterLookupKeys.keys).toEqual(
      expect.arrayContaining(['ablastname0512', 'xylastzname0314', 'pq-rlastname0515', 'jklastname0610'])
    );
    expect(data.rosterLookupKeys.keys).toHaveLength(4);
  });

  it('does not include rosterLookupKeys when rosterKeys is not 1', async () => {
    const req = new NextRequest('http://localhost/api/debug?rosterKeys=0');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rosterLookupKeys).toBeUndefined();
  });
});
