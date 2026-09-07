import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';
import { NOT_THIS_SEASON } from '@/lib/signup-form-schema';
import { COMPLETE_PLAYER_INFO, signupRecord } from './fixtures/signup-record';
import { finalFormsRecord } from './fixtures/final-forms-record';

vi.mock('@/lib/signups-sheet', () => ({
  listAllSignups: vi.fn(),
  updateSignupRow: vi.fn(),
  createSignupRow: vi.fn(),
}));

vi.mock('@/lib/final-forms', () => ({
  findFinalFormsMatch: vi.fn(),
  getFinalFormsDataAsOf: vi.fn(),
  applyFirstJoinSideEffects: vi.fn(),
}));

import { listAllSignups, updateSignupRow, createSignupRow } from '@/lib/signups-sheet';
import { findFinalFormsMatch, getFinalFormsDataAsOf, applyFirstJoinSideEffects } from '@/lib/final-forms';
import { GET } from '@/app/api/admin/outreach/route';

const listSignups = vi.mocked(listAllSignups);
const match = vi.mocked(findFinalFormsMatch);
const dataAsOf = vi.mocked(getFinalFormsDataAsOf);

const doneRow = (overrides = {}) =>
  signupRecord({
    ...COMPLETE_PLAYER_INFO,
    [SIGNUPS_COLUMNS.CARETAKER_1_NAME]: 'Ct One',
    [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: 'ct1@example.com',
    [SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]: 'drive-file-1',
    [SIGNUPS_COLUMNS.COACH_VOLUNTEERING_INTEREST]: NOT_THIS_SEASON,
    [SIGNUPS_COLUMNS.VOLUNTEER_ROLES]: NOT_THIS_SEASON,
    ...overrides,
  });

const rows = [
  doneRow({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-done', [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'Done', [SIGNUPS_COLUMNS.LAST_NAME]: 'Zed', [SIGNUPS_COLUMNS.SPS_STUDENT_ID]: 'FF-1' }),
  doneRow({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-forms', [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'Ay', [SIGNUPS_COLUMNS.LAST_NAME]: 'Alpha' }),
  doneRow({ [SIGNUPS_COLUMNS.PLAYER_ID]: 'p-noemail', [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'Cee', [SIGNUPS_COLUMNS.LAST_NAME]: 'Beta', [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: '', [SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]: '' }),
];

const request = (url: string) => new NextRequest(url);

describe('GET /api/admin/outreach', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listSignups.mockResolvedValue(rows);
    match.mockImplementation(async record =>
      record[SIGNUPS_COLUMNS.SPS_STUDENT_ID] === 'FF-1'
        ? { record: finalFormsRecord({ studentId: 'FF-1', parentSigned: true, studentSigned: true, physicalCleared: true }), dataAsOf: '2026-09-07T13:00:00Z' }
        : null
    );
    dataAsOf.mockResolvedValue('2026-09-07T13:00:00Z');
  });

  it('returns every row with its checklist, public player links, and counts, writing nothing', async () => {
    const body = await (await GET(request('https://portal.example.test/api/admin/outreach'))).json();

    expect(body.success).toBe(true);
    expect(body.dataAsOf).toBe('2026-09-07T13:00:00Z');
    expect(body.counts).toEqual({ total: 3, notChecklistComplete: 2, unreachable: 1 });
    expect(body.players.map((p: { playerId: string }) => p.playerId)).toEqual(['p-forms', 'p-noemail', 'p-done']);
    expect(body.players[0]).toMatchObject({
      playerId: 'p-forms',
      fullName: 'Ay Alpha',
      portalUrl: 'https://madisonultimate.org/player/p-forms',
      checklistComplete: false,
      checklist: expect.objectContaining({ finalForms: false, playerInfo: true }),
      finalFormsDetail: { found: false, parentSigned: false, studentSigned: false, physicalCleared: false },
      to: ['ct1@example.com'],
    });
    expect(body.players[2]).toMatchObject({ playerId: 'p-done', checklistComplete: true, finalFormsDetail: expect.objectContaining({ found: true }) });
    expect(body.unreachable).toEqual([{ playerId: 'p-noemail', fullName: 'Cee Beta', reason: 'no caretaker email' }]);
    expect(body.audience).toEqual({ selectedPlayerIds: ['p-forms'], skipped: [] });

    expect(applyFirstJoinSideEffects).not.toHaveBeenCalled();
    expect(updateSignupRow).not.toHaveBeenCalled();
    expect(createSignupRow).not.toHaveBeenCalled();
  });

  it('narrows the audience to the players query (PlayerIDs or Full Names) and reports skips', async () => {
    const body = await (await GET(request('https://portal.example.test/api/admin/outreach?players=Ay%20Alpha&players=p-done&players=p-noemail'))).json();
    expect(body.audience).toEqual({
      selectedPlayerIds: ['p-forms'],
      skipped: [
        { line: 'p-done', playerId: 'p-done', reason: 'already Checklist Complete' },
        { line: 'p-noemail', playerId: 'p-noemail', reason: 'no caretaker email' },
      ],
    });
  });

  it('answers 400 with the offending line when a players entry matches nothing', async () => {
    const res = await GET(request('https://portal.example.test/api/admin/outreach?players=Nobody%20Here'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'No signup matches "Nobody Here"' });
  });

  it('reports a null dataAsOf when there is no export', async () => {
    match.mockResolvedValue(null);
    dataAsOf.mockResolvedValue(undefined);
    const body = await (await GET(request('http://localhost:3001/api/admin/outreach'))).json();
    expect(body.dataAsOf).toBeNull();
  });

  it('links to the public portal address even when called on localhost', async () => {
    const body = await (await GET(request('http://localhost:3001/api/admin/outreach'))).json();
    expect(body.players[0].portalUrl).toBe('https://madisonultimate.org/player/p-forms');
  });

  it('returns a 500 with the message when the sheet read fails', async () => {
    listSignups.mockRejectedValue(new Error('Sheets API down'));
    const res = await GET(request('https://portal.example.test/api/admin/outreach'));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: 'Sheets API down' });
  });
});
