import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { Coach } from '@/lib/coaches-table';

vi.mock('@/lib/coaches-sheet', () => ({
  listCoaches: vi.fn(async () => []),
  findCoach: vi.fn(async () => null),
  updateCoach: vi.fn(async () => null),
}));

vi.mock('@/lib/schedule-info', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/schedule-info')>()),
  readPracticeInfo: vi.fn(async () => []),
  readGameInfo: vi.fn(async () => []),
  readFieldUrls: vi.fn(async () => ({})),
}));

vi.mock('@/lib/availability-helper', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/availability-helper')>()),
  getAvailabilityRow: vi.fn(async () => null),
}));

vi.mock('@/lib/google-api', () => ({
  updateSheetData: vi.fn(async () => ({})),
}));

import { GET as listPublicCoaches } from '@/app/api/coaches/route';
import { GET as getCoach, PUT as putCoach } from '@/app/api/coach/coaches/[coachId]/route';
import { POST as postAvailability } from '@/app/api/coach/coaches/[coachId]/availability/route';
import { listCoaches, findCoach, updateCoach } from '@/lib/coaches-sheet';
import { readPracticeInfo, readGameInfo } from '@/lib/schedule-info';
import { getAvailabilityRow } from '@/lib/availability-helper';
import { updateSheetData } from '@/lib/google-api';

const COACH: Coach = {
  coachId: 'c0001',
  name: 'TestFirst TestLast',
  email: 'coach@example.com',
  phone: '555-0100',
  about: '- **Hi**',
  photoDriveFileId: 'file1',
  rowNumber: 2,
};

const params = { params: Promise.resolve({ coachId: 'c0001' }) };

function jsonRequest(url: string, method: string, body: unknown) {
  return new NextRequest(url, { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/coaches (public)', () => {
  it('lists coaches in sheet order with name, About, and whether there is a photo, never email or phone', async () => {
    vi.mocked(listCoaches).mockResolvedValue([COACH, { ...COACH, coachId: 'c0002', photoDriveFileId: '' }]);
    const body = await (await listPublicCoaches()).json();
    expect(body.coaches).toEqual([
      { coachId: 'c0001', name: 'TestFirst TestLast', about: '- **Hi**', hasPhoto: true },
      { coachId: 'c0002', name: 'TestFirst TestLast', about: '- **Hi**', hasPhoto: false },
    ]);
    expect(JSON.stringify(body)).not.toContain('coach@example.com');
    expect(JSON.stringify(body)).not.toContain('555-0100');
  });
});

describe('/api/coach/coaches/[coachId]', () => {
  it('GET returns 404 for an unknown coach', async () => {
    const res = await getCoach(new NextRequest('http://localhost/api/coach/coaches/c0001'), params);
    expect(res.status).toBe(404);
  });

  it('GET returns the coach with contact info (behind the Coach Tools gate)', async () => {
    vi.mocked(findCoach).mockResolvedValue(COACH);
    const body = await (await getCoach(new NextRequest('http://localhost/api/coach/coaches/c0001'), params)).json();
    expect(body.coach).toMatchObject({ coachId: 'c0001', email: 'coach@example.com', phone: '555-0100', hasPhoto: true });
    expect(body.coach.photoDriveFileId).toBeUndefined();
  });

  it('PUT trims and saves only the editable fields', async () => {
    vi.mocked(updateCoach).mockResolvedValue({ ...COACH, name: 'New Name' });
    const res = await putCoach(
      jsonRequest('http://localhost/api/coach/coaches/c0001', 'PUT', {
        name: '  New Name ',
        email: ' new@example.com ',
        phone: '555-0199',
        about: 'Line one\n\nLine two  ',
        photoDriveFileId: 'sneaky',
        coachId: 'other',
      }),
      params
    );
    expect(res.status).toBe(200);
    expect(updateCoach).toHaveBeenCalledWith('c0001', {
      name: 'New Name',
      email: 'new@example.com',
      phone: '555-0199',
      about: 'Line one\n\nLine two',
    });
  });

  it('PUT requires a name and rejects a malformed email', async () => {
    expect((await putCoach(jsonRequest('http://localhost/x', 'PUT', { name: ' ' }), params)).status).toBe(400);
    expect((await putCoach(jsonRequest('http://localhost/x', 'PUT', { name: 'A', email: 'not-an-email' }), params)).status).toBe(400);
    expect(updateCoach).not.toHaveBeenCalled();
  });
});

describe('POST /api/coach/coaches/[coachId]/availability', () => {
  const header = ['CoachID', 'Name', '9/29 Practice', '9/29 Practice Note', '9/22 Practice', '9/22 Practice Note'];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 23, 12));
    vi.mocked(findCoach).mockResolvedValue(COACH);
    vi.mocked(readPracticeInfo).mockResolvedValue([
      { date: '9/29', fieldName: 'Track', fieldLocation: '', startTime: '', endTime: '', note: '' },
      { date: '9/22', fieldName: 'Track', fieldLocation: '', startTime: '', endTime: '', note: '' },
    ]);
    vi.mocked(readGameInfo).mockResolvedValue([]);
    vi.mocked(getAvailabilityRow).mockResolvedValue({ headerRow: header, playerRow: ['c0001'], rowIndex: 3, columnMapping: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const post = (body: unknown) => postAvailability(jsonRequest('http://localhost/x', 'POST', body), params);

  it('writes the answer and note into this coach row, in the event columns found by header', async () => {
    const res = await post({ eventKey: '9/29 Practice', availability: '👍 Planning to be there', note: 'late' });
    expect(res.status).toBe(200);
    expect(updateSheetData).toHaveBeenCalledWith(expect.any(String), "'Coach Availability'!C3", [['👍 Planning to be there']]);
    expect(updateSheetData).toHaveBeenCalledWith(expect.any(String), "'Coach Availability'!D3", [['late']]);
  });

  it('refuses a column that is not an event (it could otherwise overwrite CoachID or Name)', async () => {
    expect((await post({ eventKey: 'Name', availability: '👍 Planning to be there' })).status).toBe(400);
    expect(updateSheetData).not.toHaveBeenCalled();
  });

  it('refuses past events and unknown answers', async () => {
    expect((await post({ eventKey: '9/22 Practice', availability: '👍 Planning to be there' })).status).toBe(400);
    expect((await post({ eventKey: '9/29 Practice', availability: 'Was there' })).status).toBe(400);
    expect(updateSheetData).not.toHaveBeenCalled();
  });
});
