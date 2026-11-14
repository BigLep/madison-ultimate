// Integration test: exercises jerseys-sheet.ts against the dedicated "Madison Ultimate Jerseys
// (Test)" workbook (never the real Jerseys workbook). Requires JERSEYS_SHEET_ID_TEST and Google
// service account credentials; skipped automatically when either is absent. Rows it appends are
// left in the test workbook, tagged with the fake PlayerID "it-p001".

import { describe, it, expect, beforeAll, vi } from 'vitest';

const TEST_SHEET_ID = process.env.JERSEYS_SHEET_ID_TEST;
const HAS_CREDENTIALS = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE);

describe.skipIf(!TEST_SHEET_ID || !HAS_CREDENTIALS)('jerseys-sheet integration (real Google Sheets)', () => {
  let jerseysSheet: typeof import('@/lib/jerseys-sheet');
  let jerseys: typeof import('@/lib/jerseys');

  beforeAll(async () => {
    // jerseys-config.ts bakes JERSEYS_SHEET_ID in at import time; reset modules and stub the env
    // before the first import so this can never write to the real workbook (see TEST_DESIGN.md).
    vi.resetModules();
    vi.stubEnv('JERSEYS_SHEET_ID', TEST_SHEET_ID!);
    const config = await import('@/lib/jerseys-config');
    if (config.JERSEYS_SHEET_CONFIG.JERSEYS_SHEET_ID !== TEST_SHEET_ID) {
      throw new Error(`Refusing to run: JERSEYS_SHEET_ID resolved to "${config.JERSEYS_SHEET_CONFIG.JERSEYS_SHEET_ID}", not the test workbook.`);
    }
    jerseysSheet = await import('@/lib/jerseys-sheet');
    jerseys = await import('@/lib/jerseys');
  });

  it('checks a jersey out, checks it in once, refuses a second check-in, and reads it all back', async () => {
    const nowIso = new Date().toISOString();
    const loanId = await jerseysSheet.appendLoan({ playerId: 'it-p001', playerName: 'IT TestFirst', size: 'YL', by: 'IT Manager', nowIso });

    const before = (await jerseysSheet.readLoans()).find(l => l.loanId === loanId);
    expect(before).toMatchObject({ playerId: 'it-p001', size: 'YL', checkedOutBy: 'IT Manager', checkedOutAt: nowIso, outcome: '' });

    const request = { outcome: 'Returned' as const, size: 'AS' };
    const decide = (loan: import('@/lib/jerseys').JerseyLoan | undefined) => {
      const error = jerseys.checkInError(loan, request);
      return error ? { error } : { cells: jerseys.checkInCells(loan!, request, 'IT Manager', nowIso) };
    };
    const first = await jerseysSheet.updateLoan(loanId, decide);
    expect(first).toMatchObject({ loan: { outcome: 'Returned', size: 'AS', checkedInBy: 'IT Manager' } });
    expect(await jerseysSheet.updateLoan(loanId, decide)).toEqual({ error: expect.stringMatching(/already checked in/) });

    await jerseysSheet.appendNote({ playerId: 'it-p001', playerName: 'IT TestFirst', size: 'AS', note: `IT note ${nowIso}`, by: 'IT Manager', nowIso });
    const workbook = await jerseysSheet.readJerseyWorkbook();
    expect(workbook.loans.find(l => l.loanId === loanId)).toMatchObject({ outcome: 'Returned', size: 'AS', checkedInAt: nowIso });
    expect(workbook.notes.some(n => n.note === `IT note ${nowIso}`)).toBe(true);
    expect(workbook.stock.length).toBeGreaterThan(0);
  });
});
