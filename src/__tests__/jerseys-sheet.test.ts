import { describe, it, expect, vi, beforeEach } from 'vitest';

const batchGet = vi.fn();
const batchUpdate = vi.fn(async () => ({}));
const append = vi.fn(async () => ({}));

vi.mock('@/lib/google-api', () => ({
  sheets: { spreadsheets: { values: { batchGet, batchUpdate, append } } },
}));

vi.stubEnv('JERSEYS_SHEET_ID', 'test-sheet');

const LOAN_HEADER = ['LoanID', 'PlayerID', 'Player Name', 'Size', 'Checked Out At', 'Checked Out By', 'Checked In At', 'Checked In By', 'Outcome', 'Fee Issued', 'Fee Paid On', 'Notes', 'Hand Formula'];
const OPEN_ROW = ['l0001', 'p001', 'TestFirst TestLast', 'AS', '', 'Fall 2026 hand-out', '', '', '', '', '', '', '=1+1'];

function tab(values: unknown[][]) {
  return { data: { valueRanges: [{ values }] } };
}

const RETURNED = { 'Checked In At': '2026-11-18T23:00:00.000Z', 'Checked In By': 'TestManager', Outcome: 'Returned' };

let jerseysSheet: typeof import('@/lib/jerseys-sheet');

beforeEach(async () => {
  vi.clearAllMocks();
  jerseysSheet = await import('@/lib/jerseys-sheet');
});

describe('updateLoan', () => {
  it('writes only the changed cells, one range per cell, leaving other columns (and formulas) alone', async () => {
    const afterRow = [...OPEN_ROW];
    afterRow[6] = RETURNED['Checked In At'];
    afterRow[7] = RETURNED['Checked In By'];
    afterRow[8] = RETURNED.Outcome;
    batchGet.mockResolvedValueOnce(tab([LOAN_HEADER, OPEN_ROW])).mockResolvedValueOnce(tab([LOAN_HEADER, afterRow]));

    const result = await jerseysSheet.updateLoan('l0001', () => ({ cells: RETURNED }));

    expect(result).toMatchObject({ loan: { loanId: 'l0001', outcome: 'Returned' } });
    expect(batchUpdate).toHaveBeenCalledTimes(1);
    const data = (batchUpdate.mock.calls[0] as unknown as [{ requestBody: { data: { range: string; values: string[][] }[] } }])[0].requestBody.data;
    expect(data).toEqual([
      { range: "'Jersey Loans'!G2", values: [['2026-11-18T23:00:00.000Z']] },
      { range: "'Jersey Loans'!H2", values: [['TestManager']] },
      { range: "'Jersey Loans'!I2", values: [['Returned']] },
    ]);
  });

  it("reports a conflict when another manager's write landed over this one", async () => {
    const otherRow = [...OPEN_ROW];
    otherRow[6] = '2026-11-18T23:00:00.500Z';
    otherRow[7] = 'OtherManager';
    otherRow[8] = 'Lost';
    batchGet.mockResolvedValueOnce(tab([LOAN_HEADER, OPEN_ROW])).mockResolvedValueOnce(tab([LOAN_HEADER, otherRow]));

    const result = await jerseysSheet.updateLoan('l0001', () => ({ cells: RETURNED }));
    expect(result).toEqual({ error: expect.stringMatching(/Another Jersey Manager/) });
  });

  it('passes the refusal from decide through without writing', async () => {
    batchGet.mockResolvedValueOnce(tab([LOAN_HEADER, OPEN_ROW]));
    expect(await jerseysSheet.updateLoan('l0001', () => ({ error: 'nope' }))).toEqual({ error: 'nope' });
    expect(batchUpdate).not.toHaveBeenCalled();
  });
});

describe('header validation', () => {
  it('fails closed when a required column is renamed, instead of reading every loan as open', async () => {
    const renamed = LOAN_HEADER.map(h => (h === 'Outcome' ? 'Result' : h));
    batchGet.mockResolvedValueOnce(tab([renamed, OPEN_ROW]));
    await expect(jerseysSheet.readLoans()).rejects.toThrow(/missing column\(s\): Outcome/);
  });

  it('refuses to append a loan to a tab with a missing column', async () => {
    const missing = LOAN_HEADER.filter(h => h !== 'Outcome');
    batchGet.mockResolvedValue(tab([missing]));
    await expect(jerseysSheet.appendLoan({ playerId: 'p001', playerName: 'TestFirst TestLast', size: 'AS', by: 'M', nowIso: 'now' })).rejects.toThrow(/Outcome/);
    expect(append).not.toHaveBeenCalled();
  });
});
