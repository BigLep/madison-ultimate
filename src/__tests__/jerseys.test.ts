import { describe, it, expect } from 'vitest';
import {
  parseLoans,
  parseStock,
  parseFamilyJerseys,
  parseNotes,
  computeStock,
  stockTotals,
  portalJerseyStatus,
  hasUnpaidFee,
  checkInError,
  checkInCells,
  feePaidError,
  applyCells,
  rowFromCells,
  cleanManagerName,
  cleanFeeAmount,
  cleanIsoDate,
  compareSizes,
  jerseyStatusesFor,
  JerseyLoan,
} from '@/lib/jerseys';

const LOAN_HEADER = ['LoanID', 'PlayerID', 'Player Name', 'Size', 'Checked Out At', 'Checked Out By', 'Checked In At', 'Checked In By', 'Outcome', 'Fee Issued', 'Fee Paid On', 'Notes'];

function loan(overrides: Partial<JerseyLoan> = {}): JerseyLoan {
  return {
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
    ...overrides,
  };
}

describe('parseLoans', () => {
  it('reads columns by header name, whatever their order, and skips rows without a LoanID', () => {
    const header = [...LOAN_HEADER].reverse();
    const row = (cells: Record<string, string>) => header.map(h => cells[h] ?? '');
    const values = [
      header,
      row({ LoanID: 'l0001', PlayerID: 'p001', Size: 'as', Outcome: '' }),
      row({ PlayerID: 'p002', Size: 'YL' }),
      row({ LoanID: 'l0003', PlayerID: 'p003', Size: 'YL', Outcome: 'Returned' }),
    ];
    const loans = parseLoans(values);
    expect(loans.map(l => [l.loanId, l.playerId, l.size, l.outcome, l.rowNumber])).toEqual([
      ['l0001', 'p001', 'AS', '', 2],
      ['l0003', 'p003', 'YL', 'Returned', 4],
    ]);
  });

  it('treats short rows (trailing blank cells dropped by the Sheets API) as blank', () => {
    const [l] = parseLoans([LOAN_HEADER, ['l0001', 'p001', 'TestFirst TestLast', 'AS']]);
    expect(l.outcome).toBe('');
    expect(l.notes).toBe('');
  });
});

describe('parseStock', () => {
  it('ignores the Total row and treats a blank Total Owned as 0', () => {
    const stock = parseStock([
      ['Size', 'Total Owned', 'Out', 'Lost', 'On Hand', 'Notes'],
      ['YL', '21', '17', '0', '4', ''],
      ['AXS', '', '0', '0', '0', 'none'],
      ['Total', '21', '17', '0', '4', ''],
    ]);
    expect(stock).toEqual([
      { size: 'YL', totalOwned: 21, notes: '' },
      { size: 'AXS', totalOwned: 0, notes: 'none' },
    ]);
  });
});

describe('parseFamilyJerseys and parseNotes', () => {
  it('keep only rows with a PlayerID (family) or note text (notes)', () => {
    expect(
      parseFamilyJerseys([
        ['PlayerID', 'Player Name', 'Size', 'Season Recorded', 'Notes'],
        ['p001', 'TestFirst TestLast', 'am', 'Fall 2026', ''],
        ['', '', '', '', ''],
      ])
    ).toEqual([{ playerId: 'p001', playerName: 'TestFirst TestLast', size: 'AM', seasonRecorded: 'Fall 2026', notes: '' }]);
    expect(
      parseNotes([
        ['Recorded At', 'Recorded By', 'PlayerID', 'Player Name', 'Size', 'Note'],
        ['2026-11-18T23:00:00.000Z', 'TestManager', '', '', 'YL', 'Unlabeled YL in the bin'],
        ['2026-11-18T23:01:00.000Z', 'TestManager', '', '', '', ''],
      ])
    ).toHaveLength(1);
  });
});

describe('computeStock', () => {
  it('computes On Hand as Total Owned minus open and Lost loans, ignoring Returned', () => {
    const lines = computeStock(
      [
        { size: 'YL', totalOwned: 21, notes: '' },
        { size: 'AS', totalOwned: 27, notes: '' },
      ],
      [
        loan({ size: 'AS' }),
        loan({ size: 'AS', outcome: 'Returned' }),
        loan({ size: 'AS', outcome: 'Lost' }),
        loan({ size: 'YL' }),
      ]
    );
    expect(lines).toEqual([
      { size: 'YL', totalOwned: 21, out: 1, lost: 0, onHand: 20 },
      { size: 'AS', totalOwned: 27, out: 1, lost: 1, onHand: 25 },
    ]);
    expect(stockTotals(lines)).toEqual({ totalOwned: 48, out: 2, lost: 1, onHand: 45 });
  });

  it('shows a size that has loans but no Stock row, with a negative On Hand', () => {
    expect(computeStock([], [loan({ size: 'AXL' })])).toEqual([{ size: 'AXL', totalOwned: 0, out: 1, lost: 0, onHand: -1 }]);
  });

  it('orders sizes youth to adult, smallest first', () => {
    expect(['AL', 'YM', 'AS', 'ZZ', 'YL'].sort(compareSizes)).toEqual(['YM', 'YL', 'AS', 'AL', 'ZZ']);
  });
});

describe('portalJerseyStatus', () => {
  it('reports an open loan', () => {
    expect(portalJerseyStatus('p001', [loan(), loan({ playerId: 'p002', size: 'YL' })])).toEqual({
      openLoanSizes: ['AS'],
      returned: null,
      unpaidFees: [],
    });
  });

  it('reports the latest loan when it was returned recently and nothing is open', () => {
    const status = portalJerseyStatus(
      'p001',
      [
        loan({ loanId: 'old', outcome: 'Returned', checkedInAt: '2026-03-01T00:00:00.000Z', size: 'YL' }),
        loan({ loanId: 'new', outcome: 'Returned', checkedInAt: '2026-11-18T00:00:00.000Z' }),
      ],
      new Date('2026-11-20T00:00:00.000Z')
    );
    expect(status.returned).toEqual({ size: 'AS', checkedInAt: '2026-11-18T00:00:00.000Z' });
  });

  it("stops thanking a family for last season's return once the window has passed", () => {
    const loans = [loan({ outcome: 'Returned', checkedInAt: '2026-11-18T00:00:00.000Z' })];
    expect(portalJerseyStatus('p001', loans, new Date('2027-03-01T00:00:00.000Z')).returned).toBeNull();
  });

  it('reports unpaid Lost Jersey Fees and no thank-you after a Lost loan', () => {
    const status = portalJerseyStatus('p001', [loan({ outcome: 'Lost', feeIssued: '25', checkedInAt: '2026-11-18T00:00:00.000Z' })], new Date('2027-03-01T00:00:00.000Z'));
    expect(status).toEqual({ openLoanSizes: [], returned: null, unpaidFees: ['25'] });
  });

  it('is empty for a player with no loans', () => {
    expect(portalJerseyStatus('p009', [loan()])).toEqual({ openLoanSizes: [], returned: null, unpaidFees: [] });
  });
});

describe('fees', () => {
  it('a fee is unpaid only on a Lost loan with a fee and no paid date', () => {
    expect(hasUnpaidFee(loan({ outcome: 'Lost', feeIssued: '25' }))).toBe(true);
    expect(hasUnpaidFee(loan({ outcome: 'Lost', feeIssued: '25', feePaidOn: '2026-11-20' }))).toBe(false);
    expect(hasUnpaidFee(loan({ outcome: 'Lost' }))).toBe(false);
    expect(hasUnpaidFee(loan({ outcome: 'Returned', feeIssued: '25' }))).toBe(false);
  });

  it('feePaidError refuses loans with no fee or an already-paid fee', () => {
    expect(feePaidError(undefined)).toMatch(/not in the Jerseys workbook/);
    expect(feePaidError(loan())).toMatch(/No Lost Jersey Fee/);
    expect(feePaidError(loan({ outcome: 'Lost', feeIssued: '25', feePaidOn: '2026-11-20' }))).toMatch(/already marked paid/);
    expect(feePaidError(loan({ outcome: 'Lost', feeIssued: '25' }))).toBeNull();
  });
});

describe('check-in', () => {
  it('refuses a loan that is already closed (e.g. two managers checking in the same jersey)', () => {
    expect(checkInError(loan({ outcome: 'Returned' }), { outcome: 'Returned' })).toMatch(/already checked in/);
    expect(checkInError(loan(), { outcome: 'Returned', size: 'XXL' })).toMatch(/Unknown size/);
    expect(checkInError(loan(), { outcome: 'Returned', size: 'AM' })).toBeNull();
  });

  it('a plain return writes when, who, and Returned', () => {
    expect(checkInCells(loan(), { outcome: 'Returned' }, 'TestManager', '2026-11-18T23:00:00.000Z')).toEqual({
      'Checked In At': '2026-11-18T23:00:00.000Z',
      'Checked In By': 'TestManager',
      Outcome: 'Returned',
    });
  });

  it('a different-size return corrects Size and explains it in Notes, keeping earlier notes', () => {
    const cells = checkInCells(loan({ notes: 'Seeded.' }), { outcome: 'Returned', size: 'AM' }, 'TestManager', 'now');
    expect(cells.Size).toBe('AM');
    expect(cells.Notes).toBe('Seeded. Returned as AM; was recorded as AS.');
  });

  it('Lost records the fee only when one was issued', () => {
    expect(checkInCells(loan(), { outcome: 'Lost', fee: '25' }, 'TestManager', 'now')['Fee Issued']).toBe('25');
    expect(checkInCells(loan(), { outcome: 'Lost', fee: '' }, 'TestManager', 'now')).not.toHaveProperty('Fee Issued');
  });
});

describe('applyCells / rowFromCells', () => {
  it('changes only the named cells and keeps every other column, including hand-added ones', () => {
    const header = ['LoanID', 'Outcome', 'Extra'];
    expect(applyCells(header, ['l0001', '', 'keep me'], { Outcome: 'Returned' })).toEqual(['l0001', 'Returned', 'keep me']);
  });

  it('builds a new row in header order and refuses a missing column', () => {
    expect(rowFromCells(['A', 'B'], { B: 'b' })).toEqual(['', 'b']);
    expect(() => rowFromCells(['A'], { B: 'b' })).toThrow(/missing the "B" column/);
  });
});

describe('input cleaning', () => {
  it('manager names are trimmed, non-empty, and bounded', () => {
    expect(cleanManagerName('  TestManager ')).toBe('TestManager');
    expect(cleanManagerName('   ')).toBeNull();
    expect(cleanManagerName(42)).toBeNull();
    expect(cleanManagerName('x'.repeat(61))).toBeNull();
  });

  it('fee amounts accept dollars and cents, tolerate "$", and treat blank as no fee', () => {
    expect(cleanFeeAmount('$25')).toBe('25');
    expect(cleanFeeAmount('25.50')).toBe('25.50');
    expect(cleanFeeAmount(25)).toBe('25');
    expect(cleanFeeAmount('')).toBe('');
    expect(cleanFeeAmount(undefined)).toBe('');
    expect(cleanFeeAmount('twenty')).toBeNull();
    expect(cleanFeeAmount('-5')).toBeNull();
  });

  it('dates must be YYYY-MM-DD', () => {
    expect(cleanIsoDate('2026-11-20')).toBe('2026-11-20');
    expect(cleanIsoDate('11/20/2026')).toBeNull();
    expect(cleanIsoDate(undefined)).toBeNull();
  });
});

describe('jerseyStatusesFor', () => {
  const family = [{ playerId: 'p003', playerName: '', size: 'AM', seasonRecorded: 'Fall 2026', notes: '' }];
  const statuses = (playerId: string, loans: JerseyLoan[]) => [...jerseyStatusesFor(playerId, loans, family)].sort();

  it('marks an open loan as outstanding', () => {
    expect(statuses('p001', [loan()])).toEqual(['outstanding']);
  });

  it('marks a latest-returned loan as returned (however long ago), and a Lost one as lost and unpaid', () => {
    expect(statuses('p001', [loan({ outcome: 'Returned', checkedInAt: '2026-11-18T00:00:00.000Z' })])).toEqual(['returned']);
    expect(statuses('p001', [loan({ outcome: 'Lost', feeIssued: '25' })])).toEqual(['lost', 'unpaid-fee']);
  });

  it('marks a Family Jersey, and "none" only when there is neither a loan nor a Family Jersey', () => {
    expect(statuses('p003', [])).toEqual(['family']);
    expect(statuses('p009', [loan()])).toEqual(['none']);
  });
});
