// I/O for the Madison Ultimate Jerseys workbook (ADR 0009). Parsing, stock math, and validation
// are in jerseys.ts; this file only reads and writes the sheet. Nothing is cached: two Jersey
// Managers may be working at once, and the workbook is small. Read errors and missing headers
// throw rather than returning empty data, so a failed read or a renamed column can never look
// like "no loans" or "every loan open". Loan updates write only the cells they change, so
// formulas and hand edits elsewhere in the row survive.

import { sheets } from './google-api';
import { getColumnLetter } from './availability-helper';
import { headerMap } from './header-map';
import { mintPlayerId } from './player-identity';
import { JERSEYS_SHEET_CONFIG, JERSEY_TABS, LOAN_COLUMNS, STOCK_COLUMNS, FAMILY_JERSEY_COLUMNS, NOTE_COLUMNS } from './jerseys-config';
import {
  JerseyLoan,
  StockRow,
  FamilyJersey,
  JerseyNote,
  parseLoans,
  parseStock,
  parseFamilyJerseys,
  parseNotes,
  rowFromCells,
} from './jerseys';

export interface JerseyWorkbook {
  loans: JerseyLoan[];
  stock: StockRow[];
  familyJerseys: FamilyJersey[];
  notes: JerseyNote[];
}

function sheetId(): string {
  const id = JERSEYS_SHEET_CONFIG.JERSEYS_SHEET_ID;
  if (!id) throw new Error('JERSEYS_SHEET_ID is not configured');
  return id;
}

const tabRange = (tab: string) => `'${tab}'`;

/** Every header each tab must have; a read of that tab fails closed without them. */
const REQUIRED_COLUMNS: Record<string, Record<string, string>> = {
  [JERSEY_TABS.LOANS]: LOAN_COLUMNS,
  [JERSEY_TABS.STOCK]: STOCK_COLUMNS,
  [JERSEY_TABS.FAMILY_JERSEYS]: FAMILY_JERSEY_COLUMNS,
  [JERSEY_TABS.NOTES]: NOTE_COLUMNS,
};

/** Throws naming every missing header, so a renamed column stops the app instead of reading as blank. */
export function assertHeaders(tab: string, headerRow: unknown[] | undefined): void {
  const present = headerMap(headerRow || []);
  const missing = Object.values(REQUIRED_COLUMNS[tab] || {}).filter(name => present[name] === undefined);
  if (missing.length > 0) {
    throw new Error(`Jerseys workbook tab "${tab}" is missing column(s): ${missing.join(', ')}. Fix the header row (see the README tab).`);
  }
}

async function readTabs(tabs: string[]): Promise<unknown[][][]> {
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetId(),
    ranges: tabs.map(tabRange),
  });
  const ranges = response.data.valueRanges || [];
  return tabs.map((tab, i) => {
    const values = (ranges[i]?.values || []) as unknown[][];
    assertHeaders(tab, values[0]);
    return values;
  });
}

export async function readJerseyWorkbook(): Promise<JerseyWorkbook> {
  const [loans, stock, family, notes] = await readTabs([JERSEY_TABS.LOANS, JERSEY_TABS.STOCK, JERSEY_TABS.FAMILY_JERSEYS, JERSEY_TABS.NOTES]);
  return {
    loans: parseLoans(loans),
    stock: parseStock(stock),
    familyJerseys: parseFamilyJerseys(family),
    notes: parseNotes(notes),
  };
}

export async function readLoans(): Promise<JerseyLoan[]> {
  const [values] = await readTabs([JERSEY_TABS.LOANS]);
  return parseLoans(values);
}

async function appendRow(tab: string, cells: Record<string, string>): Promise<void> {
  const [values] = await readTabs([tab]);
  const row = rowFromCells(values[0], cells);
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId(),
    range: tabRange(tab),
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

/** Starts a Jersey Loan. Returns the new LoanID. */
export async function appendLoan(input: { playerId: string; playerName: string; size: string; by: string; nowIso: string }): Promise<string> {
  const existing = new Set((await readLoans()).map(l => l.loanId));
  let loanId = mintPlayerId();
  while (existing.has(loanId)) loanId = mintPlayerId();
  await appendRow(JERSEY_TABS.LOANS, {
    [LOAN_COLUMNS.LOAN_ID]: loanId,
    [LOAN_COLUMNS.PLAYER_ID]: input.playerId,
    [LOAN_COLUMNS.PLAYER_NAME]: input.playerName,
    [LOAN_COLUMNS.SIZE]: input.size,
    [LOAN_COLUMNS.CHECKED_OUT_AT]: input.nowIso,
    [LOAN_COLUMNS.CHECKED_OUT_BY]: input.by,
  });
  return loanId;
}

/**
 * Re-reads the loan right before writing, lets `decide` refuse (returning an error message) based
 * on its current state, writes only the returned cells, then re-reads the row and confirms they
 * stuck. Two managers acting on the same jersey within the same second can both pass the first
 * check; the later write wins in the sheet, and the earlier manager's confirmation sees the
 * difference and gets an error instead of a false success. (A real lock would need a store shared
 * across server instances; at a handful of Jersey Managers this is the proportionate guard.)
 */
export async function updateLoan(
  loanId: string,
  decide: (loan: JerseyLoan | undefined) => { error: string } | { cells: Record<string, string> }
): Promise<{ error: string } | { loan: JerseyLoan }> {
  const [values] = await readTabs([JERSEY_TABS.LOANS]);
  const loan = parseLoans(values).find(l => l.loanId === loanId);
  const decision = decide(loan);
  if ('error' in decision) return decision;
  if (!loan) return { error: 'That loan is not in the Jerseys workbook.' };

  const map = headerMap(values[0]);
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId(),
    requestBody: {
      valueInputOption: 'RAW',
      data: Object.entries(decision.cells).map(([name, value]) => ({
        range: `${tabRange(JERSEY_TABS.LOANS)}!${getColumnLetter(map[name])}${loan.rowNumber}`,
        values: [[value]],
      })),
    },
  });

  const [after] = await readTabs([JERSEY_TABS.LOANS]);
  const written = parseLoans(after).find(l => l.loanId === loanId);
  const afterMap = headerMap(after[0]);
  const row = written ? after[written.rowNumber - 1] || [] : [];
  const stuck = written && Object.entries(decision.cells).every(([name, value]) => (row[afterMap[name]] ?? '').toString().trim() === value.trim());
  if (!written || !stuck) {
    return { error: 'Another Jersey Manager changed this jersey at the same moment. Reload to see what was saved.' };
  }
  return { loan: written };
}

export async function appendFamilyJersey(input: { playerId: string; playerName: string; size: string; seasonLabel: string; by: string }): Promise<void> {
  await appendRow(JERSEY_TABS.FAMILY_JERSEYS, {
    [FAMILY_JERSEY_COLUMNS.PLAYER_ID]: input.playerId,
    [FAMILY_JERSEY_COLUMNS.PLAYER_NAME]: input.playerName,
    [FAMILY_JERSEY_COLUMNS.SIZE]: input.size,
    [FAMILY_JERSEY_COLUMNS.SEASON_RECORDED]: input.seasonLabel,
    [FAMILY_JERSEY_COLUMNS.NOTES]: `Recorded by ${input.by}`,
  });
}

export async function appendNote(input: { playerId: string; playerName: string; size: string; note: string; by: string; nowIso: string }): Promise<void> {
  await appendRow(JERSEY_TABS.NOTES, {
    [NOTE_COLUMNS.RECORDED_AT]: input.nowIso,
    [NOTE_COLUMNS.RECORDED_BY]: input.by,
    [NOTE_COLUMNS.PLAYER_ID]: input.playerId,
    [NOTE_COLUMNS.PLAYER_NAME]: input.playerName,
    [NOTE_COLUMNS.SIZE]: input.size,
    [NOTE_COLUMNS.NOTE]: input.note,
  });
}
