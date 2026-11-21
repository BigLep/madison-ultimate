import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import type { JerseyLoan } from '@/lib/jerseys';

vi.mock('@/lib/coach-directory', () => ({
  getPlayerDirectoryEntry: vi.fn(async (playerId: string) =>
    playerId === 'p001'
      ? {
          playerId: 'p001', fullName: 'TestFirst TestLast', team: 'Blue', grade: '7', gender: 'Girl', hasPhoto: false, allergies: '',
          studentEmail: 'student@example.com', studentPhone: '555-0100',
          caretakers: [
            { name: 'TestParent TestLast', email: 'parent@example.com', phone: '555-0101' },
            { name: 'TestNoEmail TestLast', email: '', phone: '555-0102' },
          ],
        }
      : null
  ),
  listRosteredPlayers: vi.fn(async () => [
    { playerId: 'p001', fullName: 'TestFirst TestLast', team: 'Blue', gender: 'Girl', jerseySize: 'AS' },
  ]),
}));

vi.mock('@/lib/jerseys-sheet', () => ({
  readJerseyWorkbook: vi.fn(async () => ({ loans: [], stock: [], familyJerseys: [], notes: [] })),
  readLoans: vi.fn(async () => []),
  appendLoan: vi.fn(async () => 'newid'),
  updateLoan: vi.fn(),
  appendFamilyJersey: vi.fn(async () => undefined),
  appendNote: vi.fn(async () => undefined),
}));

import { GET as getState } from '@/app/api/jerseys/state/route';
import { POST as postCheckout } from '@/app/api/jerseys/checkout/route';
import { POST as postCheckin } from '@/app/api/jerseys/loans/[loanId]/checkin/route';
import { POST as postFeePaid } from '@/app/api/jerseys/loans/[loanId]/fee-paid/route';
import { POST as postFamily } from '@/app/api/jerseys/family-jerseys/route';
import { POST as postNote } from '@/app/api/jerseys/notes/route';
import { GET as getPortalJersey } from '@/app/api/player/[playerId]/jersey/route';
import { GET as getOutstandingXlsx } from '@/app/api/jerseys/outstanding-xlsx/route';
import { GET as getContacts } from '@/app/api/jerseys/players/[playerId]/contacts/route';
import { readLoans, appendLoan, updateLoan, appendFamilyJersey, appendNote } from '@/lib/jerseys-sheet';

const LOAN: JerseyLoan = {
  loanId: 'l0001',
  playerId: 'p001',
  playerName: 'TestFirst TestLast',
  size: 'AS',
  checkedOutAt: '',
  checkedOutBy: 'Fall 2026 hand-out',
  checkedInAt: '',
  checkedInBy: '',
  outcome: '',
  feeIssued: '',
  feePaidOn: '',
  notes: '',
  rowNumber: 2,
};

function post(url: string, body: unknown) {
  return new NextRequest(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
}
const loanParams = { params: Promise.resolve({ loanId: 'l0001' }) };

/** Runs updateLoan's `decide` callback against `loan`, the way jerseys-sheet.ts does. */
function updateLoanAgainst(loan: JerseyLoan | undefined) {
  vi.mocked(updateLoan).mockImplementation(async (_id, decide) => {
    const decision = decide(loan);
    if ('error' in decision) return decision;
    return { loan: { ...loan!, outcome: decision.cells.Outcome ?? loan!.outcome } };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/jerseys/state', () => {
  it('returns players with name, Team, gender, and signup size only (no contact info)', async () => {
    const body = await (await getState()).json();
    expect(body.players).toEqual([{ playerId: 'p001', fullName: 'TestFirst TestLast', team: 'Blue', gender: 'Girl', jerseySize: 'AS' }]);
  });
});

describe('POST /api/jerseys/checkout', () => {
  it('appends a loan stamped with the manager name, using the Roster name, not the client one', async () => {
    const res = await postCheckout(post('http://localhost/api/jerseys/checkout', { playerId: 'p001', size: 'am', by: ' TestManager ', playerName: 'ignored' }));
    expect(res.status).toBe(200);
    expect(appendLoan).toHaveBeenCalledWith(expect.objectContaining({ playerId: 'p001', playerName: 'TestFirst TestLast', size: 'AM', by: 'TestManager' }));
  });

  it('requires a manager name, a Rostered Player, and a known size', async () => {
    expect((await postCheckout(post('http://localhost/x', { playerId: 'p001', size: 'AS' }))).status).toBe(400);
    expect((await postCheckout(post('http://localhost/x', { playerId: 'p999', size: 'AS', by: 'M' }))).status).toBe(400);
    expect((await postCheckout(post('http://localhost/x', { playerId: 'p001', size: 'XXXL', by: 'M' }))).status).toBe(400);
    expect(appendLoan).not.toHaveBeenCalled();
  });
});

describe('POST /api/jerseys/loans/[loanId]/checkin', () => {
  it('checks in an open loan as Returned', async () => {
    updateLoanAgainst(LOAN);
    const res = await postCheckin(post('http://localhost/x', { outcome: 'Returned', by: 'TestManager' }), loanParams);
    expect(res.status).toBe(200);
    expect((await res.json()).loan.outcome).toBe('Returned');
  });

  it('refuses with 409 when the loan was already checked in', async () => {
    updateLoanAgainst({ ...LOAN, outcome: 'Returned' });
    const res = await postCheckin(post('http://localhost/x', { outcome: 'Returned', by: 'TestManager' }), loanParams);
    expect(res.status).toBe(409);
  });

  it('rejects unknown outcomes and malformed fees before touching the sheet', async () => {
    expect((await postCheckin(post('http://localhost/x', { outcome: 'Stolen', by: 'M' }), loanParams)).status).toBe(400);
    expect((await postCheckin(post('http://localhost/x', { outcome: 'Lost', fee: 'lots', by: 'M' }), loanParams)).status).toBe(400);
    expect(updateLoan).not.toHaveBeenCalled();
  });
});

describe('POST /api/jerseys/loans/[loanId]/fee-paid', () => {
  it('records the paid date on a Lost loan with an unpaid fee', async () => {
    updateLoanAgainst({ ...LOAN, outcome: 'Lost', feeIssued: '25' });
    expect((await postFeePaid(post('http://localhost/x', { paidOn: '2026-11-20', by: 'M' }), loanParams)).status).toBe(200);
  });

  it('refuses a loan with no fee, and a missing date', async () => {
    updateLoanAgainst(LOAN);
    expect((await postFeePaid(post('http://localhost/x', { paidOn: '2026-11-20', by: 'M' }), loanParams)).status).toBe(409);
    expect((await postFeePaid(post('http://localhost/x', { by: 'M' }), loanParams)).status).toBe(400);
  });
});

describe('POST /api/jerseys/family-jerseys and /notes', () => {
  it('records a Family Jersey for a Rostered Player with the season label', async () => {
    expect((await postFamily(post('http://localhost/x', { playerId: 'p001', size: 'YL', by: 'M' }))).status).toBe(200);
    expect(appendFamilyJersey).toHaveBeenCalledWith(expect.objectContaining({ playerId: 'p001', size: 'YL', seasonLabel: expect.not.stringMatching(/Season$/) }));
  });

  it('saves a general note, or a player note with the Roster name', async () => {
    expect((await postNote(post('http://localhost/x', { note: 'Unlabeled YL in the bin', size: 'YL', by: 'M' }))).status).toBe(200);
    expect(appendNote).toHaveBeenLastCalledWith(expect.objectContaining({ playerId: '', size: 'YL' }));
    expect((await postNote(post('http://localhost/x', { note: 'Says it is at home', playerId: 'p001', by: 'M' }))).status).toBe(200);
    expect(appendNote).toHaveBeenLastCalledWith(expect.objectContaining({ playerId: 'p001', playerName: 'TestFirst TestLast' }));
  });

  it("saves a note about a past player whose jersey is still out, using the loan's name", async () => {
    vi.mocked(readLoans).mockResolvedValue([{ ...LOAN, playerId: 'p777', playerName: 'TestPast TestLast' }]);
    expect((await postNote(post('http://localhost/x', { note: 'Moved away', playerId: 'p777', playerName: 'ignored', by: 'M' }))).status).toBe(200);
    expect(appendNote).toHaveBeenLastCalledWith(expect.objectContaining({ playerId: 'p777', playerName: 'TestPast TestLast' }));
    vi.mocked(readLoans).mockResolvedValue([]);
    expect((await postNote(post('http://localhost/x', { note: 'Who?', playerId: 'p888', by: 'M' }))).status).toBe(400);
  });

    it('refuses an empty note', async () => {
    expect((await postNote(post('http://localhost/x', { note: '  ', by: 'M' }))).status).toBe(400);
  });
});

describe('GET /api/player/[playerId]/jersey', () => {
  it("returns only that player's own status and the season's return events", async () => {
    vi.mocked(readLoans).mockResolvedValue([LOAN, { ...LOAN, loanId: 'l0002', playerId: 'p002', size: 'YL' }]);
    const body = await (await getPortalJersey(new NextRequest('http://localhost/x'), { params: Promise.resolve({ playerId: 'p001' }) })).json();
    expect(body).toEqual({ success: true, openLoanSizes: ['AS'], returned: null, unpaidFees: [], returnEvents: expect.any(Array) });
    expect(JSON.stringify(body)).not.toContain('TestFirst');
  });

  it('answers 503 (not a crash) when the workbook cannot be read', async () => {
    vi.mocked(readLoans).mockRejectedValue(new Error('JERSEYS_SHEET_ID is not configured'));
    const res = await getPortalJersey(new NextRequest('http://localhost/x'), { params: Promise.resolve({ playerId: 'p001' }) });
    expect(res.status).toBe(503);
  });
});

describe('GET /api/jerseys/outstanding-xlsx', () => {
  it('returns an .xlsx of the open loans that pass the query filters, with no contact info or notes', async () => {
    vi.mocked(readLoans).mockResolvedValue([
      { ...LOAN, notes: 'private manager note' },
      { ...LOAN, loanId: 'l0002', playerId: 'p002', playerName: 'TestOther TestLast', size: 'YL' },
    ]);
    const res = await getOutstandingXlsx(new NextRequest('http://localhost/api/jerseys/outstanding-xlsx?team=Blue'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('spreadsheetml');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await res.arrayBuffer());
    const sheet = workbook.worksheets[0];
    const cells: string[] = [];
    sheet.eachRow(row => row.eachCell(cell => cells.push(String(cell.value))));
    expect(sheet.getRow(4).getCell(1).value).toBe('TestFirst TestLast');
    expect(sheet.getRow(5).getCell(1).value).toBeFalsy(); // p002 is not on the Roster as Blue
    expect(cells.join(' ')).not.toMatch(/private manager note|@|555-/);
  });

  it("dates the file by Pacific time, so a download just before midnight isn't tomorrow's", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-14T07:30:00Z')); // 11:30pm Friday, November 13 in Seattle
    try {
      vi.mocked(readLoans).mockResolvedValue([]);
      const res = await getOutstandingXlsx(new NextRequest('http://localhost/api/jerseys/outstanding-xlsx'));
      expect(res.headers.get('content-disposition')).toContain('outstanding-jerseys-2026-11-13.xlsx');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('GET /api/jerseys/players/[playerId]/contacts', () => {
  it("returns caretaker names and emails only: no phones, no student contact", async () => {
    const res = await getContacts(new NextRequest('http://localhost/x'), { params: Promise.resolve({ playerId: 'p001' }) });
    const body = await res.json();
    expect(body).toEqual({ success: true, contacts: [{ name: 'TestParent TestLast', email: 'parent@example.com' }] });
    expect(JSON.stringify(body)).not.toMatch(/555-|student@/);
  });

  it('404s for a player not on the Roster', async () => {
    const res = await getContacts(new NextRequest('http://localhost/x'), { params: Promise.resolve({ playerId: 'p999' }) });
    expect(res.status).toBe(404);
  });
});
