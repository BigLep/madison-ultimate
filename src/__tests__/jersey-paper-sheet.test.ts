import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { outstandingRows, type JerseyLoan } from '@/lib/jerseys';
import { outstandingJerseysWorkbook } from '@/lib/jersey-paper-sheet';

function loan(overrides: Partial<JerseyLoan>): JerseyLoan {
  return {
    loanId: 'l', playerId: 'p001', playerName: 'TestFirst TestLast', size: 'AS', checkedOutAt: '', checkedOutBy: '',
    checkedInAt: '', checkedInBy: '', outcome: '', feeIssued: '', feePaidOn: '', notes: '', rowNumber: 2, ...overrides,
  };
}

const PLAYERS = [
  { playerId: 'p001', fullName: 'TestZed TestLast', team: 'Gold', gender: 'Girl /Gx/' },
  { playerId: 'p002', fullName: 'TestAmy TestLast', team: 'Blue', gender: 'Boy /Bx/' },
  { playerId: 'p003', fullName: 'TestBea TestLast', team: 'Blue', gender: 'Girl /Gx/' },
];
const NO_FILTERS = { search: '', teams: [], genders: [], statuses: [] };

describe('outstandingRows', () => {
  const loans = [
    loan({ playerId: 'p001' }),
    loan({ playerId: 'p002', size: 'YL' }),
    loan({ playerId: 'p003', outcome: 'Returned' }),
    loan({ playerId: 'p999', playerName: 'TestPast TestLast' }),
  ];

  it('lists open loans only, by team then name, with past players last', () => {
    expect(outstandingRows(PLAYERS, loans, NO_FILTERS)).toEqual([
      { playerName: 'TestAmy TestLast', team: 'Blue', size: 'YL' },
      { playerName: 'TestZed TestLast', team: 'Gold', size: 'AS' },
      { playerName: 'TestPast TestLast', team: 'Not on Roster', size: 'AS' },
    ]);
  });

  it('applies the team, gender, and search filters the Check-in tab shows', () => {
    expect(outstandingRows(PLAYERS, loans, { ...NO_FILTERS, teams: ['Gold'] }).map(r => r.playerName)).toEqual(['TestZed TestLast']);
    expect(outstandingRows(PLAYERS, loans, { ...NO_FILTERS, genders: ['Bx'] }).map(r => r.playerName)).toEqual(['TestAmy TestLast']);
    expect(outstandingRows(PLAYERS, loans, { ...NO_FILTERS, search: 'past' }).map(r => r.playerName)).toEqual(['TestPast TestLast']);
  });
});

describe('outstandingJerseysWorkbook', () => {
  it('writes the five columns with every table cell bordered and blank Returned?/Note cells', async () => {
    const buffer = await outstandingJerseysWorkbook([{ playerName: 'TestAmy TestLast', team: 'Blue', size: 'YL' }], { title: 'Program Jerseys still out', today: '2026-11-14' });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];

    expect(sheet.getRow(3).values).toEqual([undefined, 'Player', 'Team', 'Jersey', 'Returned?', 'Note']);
    const data = sheet.getRow(4);
    expect([data.getCell(1).value, data.getCell(2).value, data.getCell(3).value]).toEqual(['TestAmy TestLast', 'Blue', 'Youth Large (YL)']);
    expect(data.getCell(4).value).toBeFalsy();
    expect(data.getCell(5).value).toBeFalsy();
    for (const rowNumber of [3, 4]) {
      for (let col = 1; col <= 5; col++) {
        const border = sheet.getRow(rowNumber).getCell(col).border;
        expect([border?.top?.style, border?.left?.style, border?.bottom?.style, border?.right?.style]).toEqual(['thin', 'thin', 'thin', 'thin']);
      }
    }
    expect(sheet.getCell('A2').value).toBe('1 still out as of Saturday, November 14');
  });
});
