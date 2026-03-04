import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ROSTER_MOCK } from './fixtures/roster-mock';
import { forceRefreshPortalCache, findPortalIdByLookupKey } from '@/lib/portal-cache';
import { POST } from '@/app/api/player/lookup/route';

vi.mock('@/lib/sheet-cache', () => ({
  getCachedSheetData: vi.fn(async (sheetType: string) => {
    if (sheetType === 'ROSTER') return [...ROSTER_MOCK.map((row) => [...row])];
    return [];
  }),
  forceRefreshSheetCache: vi.fn(async () => {}),
}));

describe('portal cache and player lookup', () => {
  beforeEach(async () => {
    await forceRefreshPortalCache();
  });

  describe('findPortalIdByLookupKey', () => {
    it('finds portal for simple name (AfirstName BlastName, 05/12)', async () => {
      const portalId = await findPortalIdByLookupKey('ablastname0512');
      expect(portalId).toBe('p001');
    });

    it('finds portal for last name with space (XfirstName YLast ZName, 03/14) via normalized key', async () => {
      const portalId = await findPortalIdByLookupKey('xylast zname0314');
      expect(portalId).toBe('p002');
    });

    it('finds portal for last name with dash (PfirstName Q-RlastName, 05/15)', async () => {
      const portalId = await findPortalIdByLookupKey('pq-rlastname0515');
      expect(portalId).toBe('p003');
    });

    it('returns null for key not in roster', async () => {
      const portalId = await findPortalIdByLookupKey('zzz9999');
      expect(portalId).toBeNull();
    });
  });

  describe('POST /api/player/lookup', () => {
    it('returns 200 and playerPortalId for simple name', async () => {
      const req = new NextRequest('http://localhost/api/player/lookup', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'AfirstName',
          lastName: 'BlastName',
          birthMonth: '05',
          birthYear: '12',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.playerPortalId).toBe('p001');
    });

    it('returns 200 for last name with space (normalized)', async () => {
      const req = new NextRequest('http://localhost/api/player/lookup', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'XfirstName',
          lastName: 'YLast ZName',
          birthMonth: '03',
          birthYear: '14',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.playerPortalId).toBe('p002');
    });

    it('returns 200 for last name with dash', async () => {
      const req = new NextRequest('http://localhost/api/player/lookup', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'PfirstName',
          lastName: 'Q-RlastName',
          birthMonth: '05',
          birthYear: '15',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.playerPortalId).toBe('p003');
    });

    it('returns 404 when no player matches', async () => {
      const req = new NextRequest('http://localhost/api/player/lookup', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Z',
          lastName: 'Z',
          birthMonth: '99',
          birthYear: '99',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('No player found');
    });

    it('returns 400 when birthMonth is not 2 digits', async () => {
      const req = new NextRequest('http://localhost/api/player/lookup', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'AfirstName',
          lastName: 'BlastName',
          birthMonth: '5',
          birthYear: '12',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('2 digits');
    });

    it('returns 400 when required fields are missing', async () => {
      const req = new NextRequest('http://localhost/api/player/lookup', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'AfirstName',
          lastName: '',
          birthMonth: '05',
          birthYear: '12',
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required');
    });
  });
});
