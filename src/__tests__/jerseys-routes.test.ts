import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { JerseyLoan } from '@/lib/jerseys';

vi.mock('@/lib/coach-directory', () => ({
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
  it('returns players with name, Team, and signup size only (no gender, no contact info)', async () => {
    const body = await (await getState()).json();
    expect(body.players).toEqual([{ playerId: 'p001', fullName: 'TestFirst TestLast', team: 'Blue', jerseySize: 'AS' }]);
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

  it('refuses an empty note', async () => {
    expect((await postNote(post('http://localhost/x', { note: '  ', by: 'M' }))).status).toBe(400);
  });
});

describe('GET /api/player/[playerId]/jersey', () => {
  it("returns only that player's own status and the season due date", async () => {
    vi.mocked(readLoans).mockResolvedValue([LOAN, { ...LOAN, loanId: 'l0002', playerId: 'p002', size: 'YL' }]);
    const body = await (await getPortalJersey(new NextRequest('http://localhost/x'), { params: Promise.resolve({ playerId: 'p001' }) })).json();
    expect(body).toEqual({ success: true, openLoanSizes: ['AS'], returned: null, unpaidFees: [], returnDueDate: expect.any(String) });
    expect(JSON.stringify(body)).not.toContain('TestFirst');
  });

  it('answers 503 (not a crash) when the workbook cannot be read', async () => {
    vi.mocked(readLoans).mockRejectedValue(new Error('JERSEYS_SHEET_ID is not configured'));
    const res = await getPortalJersey(new NextRequest('http://localhost/x'), { params: Promise.resolve({ playerId: 'p001' }) });
    expect(res.status).toBe(503);
  });
});
