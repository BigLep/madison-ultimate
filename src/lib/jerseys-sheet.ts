// I/O for the Madison Ultimate Jerseys workbook (ADR 0009). Parsing, stock math, and validation
// are in jerseys.ts; this file only reads and writes the sheet. Nothing is cached: two Jersey
// Managers may be working at once, and the workbook is small. Read errors throw rather than
// returning empty data, so a failed read can never look like "no loans".

import { sheets } from './google-api';
import { getColumnLetter } from './availability-helper';
import { mintPlayerId } from './player-identity';
import { JERSEYS_SHEET_CONFIG, JERSEY_TABS, LOAN_COLUMNS, FAMILY_JERSEY_COLUMNS, NOTE_COLUMNS } from './jerseys-config';
import {
  JerseyLoan,
  StockRow,
  FamilyJersey,
  JerseyNote,
  parseLoans,
  parseStock,
  parseFamilyJerseys,
  parseNotes,
  applyCells,
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

async function readTabs(tabs: string[]): Promise<unknown[][][]> {
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetId(),
    ranges: tabs.map(tabRange),
  });
  const ranges = response.data.valueRanges || [];
  return tabs.map((tab, i) => {
    const values = (ranges[i]?.values || []) as unknown[][];
    if (!values[0]?.length) throw new Error(`Jerseys workbook tab "${tab}" has no header row`);
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
 * on its current state, then writes the returned cells onto that row in place. Re-reading is what
 * stops two managers from checking in the same jersey twice.
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

  const headerRow = values[0];
  const row = applyCells(headerRow, values[loan.rowNumber - 1] || [], decision.cells);
  const lastColumn = getColumnLetter(headerRow.length - 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId(),
    range: `${tabRange(JERSEY_TABS.LOANS)}!A${loan.rowNumber}:${lastColumn}${loan.rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
  return { loan: { ...parseLoans([headerRow, row])[0], rowNumber: loan.rowNumber } };
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
