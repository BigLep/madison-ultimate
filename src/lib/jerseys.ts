// Jersey Loans, Jersey Stock, Family Jerseys, and Jersey Notes (CONTEXT.md: Jerseys; ADR 0009).
// Pure: parsing sheet values into typed rows, the stock arithmetic, per-player views, and write
// validation. jerseys-sheet.ts does the I/O. Safe to import from client components.

import { headerMap, cellGetter } from './header-map';
import { JERSEY_SIZE_OPTIONS } from './signup-form-schema';
import {
  LOAN_COLUMNS,
  STOCK_COLUMNS,
  FAMILY_JERSEY_COLUMNS,
  NOTE_COLUMNS,
  LOAN_OUTCOMES,
  LoanOutcome,
} from './jerseys-config';

export interface JerseyLoan {
  loanId: string;
  playerId: string;
  playerName: string;
  size: string;
  checkedOutAt: string;
  checkedOutBy: string;
  checkedInAt: string;
  checkedInBy: string;
  /** '' while the loan is open. Anything else in the sheet is kept verbatim. */
  outcome: string;
  feeIssued: string;
  feePaidOn: string;
  notes: string;
  /** 1-based sheet row, for writing the row back in place. */
  rowNumber: number;
}

export interface StockRow {
  size: string;
  /** NaN-safe: a blank or non-numeric cell counts as 0. */
  totalOwned: number;
  notes: string;
}

export interface FamilyJersey {
  playerId: string;
  playerName: string;
  size: string;
  seasonRecorded: string;
  notes: string;
}

export interface JerseyNote {
  recordedAt: string;
  recordedBy: string;
  playerId: string;
  playerName: string;
  size: string;
  note: string;
}

export interface StockLine {
  size: string;
  totalOwned: number;
  out: number;
  lost: number;
  onHand: number;
}

/** Display order for sizes: the signup form's order, then anything unrecognized alphabetically. */
const SIZE_ORDER: string[] = JERSEY_SIZE_OPTIONS.map(o => o.value);

export function isKnownJerseySize(size: string): boolean {
  return SIZE_ORDER.includes(size);
}

export function compareSizes(a: string, b: string): number {
  const ia = SIZE_ORDER.indexOf(a);
  const ib = SIZE_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

function dataRows(values: unknown[][]): { get: (row: unknown[], name: string) => string; rows: { row: unknown[]; rowNumber: number }[] } {
  const get = cellGetter(headerMap(values[0] || []));
  const rows = values.slice(1).map((row, i) => ({ row, rowNumber: i + 2 }));
  return { get, rows };
}

/** Every loan row with a LoanID. Rows without one (blank or hand-typed junk) are skipped. */
export function parseLoans(values: unknown[][]): JerseyLoan[] {
  const { get, rows } = dataRows(values);
  return rows
    .map(({ row, rowNumber }) => ({
      loanId: get(row, LOAN_COLUMNS.LOAN_ID),
      playerId: get(row, LOAN_COLUMNS.PLAYER_ID),
      playerName: get(row, LOAN_COLUMNS.PLAYER_NAME),
      size: get(row, LOAN_COLUMNS.SIZE).toUpperCase(),
      checkedOutAt: get(row, LOAN_COLUMNS.CHECKED_OUT_AT),
      checkedOutBy: get(row, LOAN_COLUMNS.CHECKED_OUT_BY),
      checkedInAt: get(row, LOAN_COLUMNS.CHECKED_IN_AT),
      checkedInBy: get(row, LOAN_COLUMNS.CHECKED_IN_BY),
      outcome: get(row, LOAN_COLUMNS.OUTCOME),
      feeIssued: get(row, LOAN_COLUMNS.FEE_ISSUED),
      feePaidOn: get(row, LOAN_COLUMNS.FEE_PAID_ON),
      notes: get(row, LOAN_COLUMNS.NOTES),
      rowNumber,
    }))
    .filter(loan => loan.loanId);
}

/** One row per size with a Size cell. The sheet's own Out/Lost/On Hand formula cells are ignored. */
export function parseStock(values: unknown[][]): StockRow[] {
  const { get, rows } = dataRows(values);
  return rows
    .map(({ row }) => {
      const total = Number(get(row, STOCK_COLUMNS.TOTAL_OWNED));
      return {
        size: get(row, STOCK_COLUMNS.SIZE).toUpperCase(),
        totalOwned: Number.isFinite(total) ? total : 0,
        notes: get(row, STOCK_COLUMNS.NOTES),
      };
    })
    // The sheet ends with a "Total" row for people; it is not a size.
    .filter(r => r.size && r.size !== 'TOTAL');
}

export function parseFamilyJerseys(values: unknown[][]): FamilyJersey[] {
  const { get, rows } = dataRows(values);
  return rows
    .map(({ row }) => ({
      playerId: get(row, FAMILY_JERSEY_COLUMNS.PLAYER_ID),
      playerName: get(row, FAMILY_JERSEY_COLUMNS.PLAYER_NAME),
      size: get(row, FAMILY_JERSEY_COLUMNS.SIZE).toUpperCase(),
      seasonRecorded: get(row, FAMILY_JERSEY_COLUMNS.SEASON_RECORDED),
      notes: get(row, FAMILY_JERSEY_COLUMNS.NOTES),
    }))
    .filter(f => f.playerId);
}

export function parseNotes(values: unknown[][]): JerseyNote[] {
  const { get, rows } = dataRows(values);
  return rows
    .map(({ row }) => ({
      recordedAt: get(row, NOTE_COLUMNS.RECORDED_AT),
      recordedBy: get(row, NOTE_COLUMNS.RECORDED_BY),
      playerId: get(row, NOTE_COLUMNS.PLAYER_ID),
      playerName: get(row, NOTE_COLUMNS.PLAYER_NAME),
      size: get(row, NOTE_COLUMNS.SIZE).toUpperCase(),
      note: get(row, NOTE_COLUMNS.NOTE),
    }))
    .filter(n => n.note);
}

export function isOpenLoan(loan: JerseyLoan): boolean {
  return loan.outcome === '';
}

export function isLostLoan(loan: JerseyLoan): boolean {
  return loan.outcome.toLowerCase() === LOAN_OUTCOMES.LOST.toLowerCase();
}

export function hasUnpaidFee(loan: JerseyLoan): boolean {
  return isLostLoan(loan) && loan.feeIssued !== '' && loan.feePaidOn === '';
}

/**
 * Per size: Total Owned (typed in the sheet), Out (open loans), Lost, and On Hand = Total Owned −
 * Out − Lost. A size that has loans but no Stock row still appears, with Total Owned 0, so a typo
 * in the sheet shows up as a negative On Hand instead of vanishing.
 */
export function computeStock(stock: StockRow[], loans: JerseyLoan[]): StockLine[] {
  const lines = new Map<string, StockLine>();
  const line = (size: string) => {
    let l = lines.get(size);
    if (!l) {
      l = { size, totalOwned: 0, out: 0, lost: 0, onHand: 0 };
      lines.set(size, l);
    }
    return l;
  };
  for (const s of stock) line(s.size).totalOwned += s.totalOwned;
  for (const loan of loans) {
    if (!loan.size) continue;
    if (isOpenLoan(loan)) line(loan.size).out += 1;
    else if (isLostLoan(loan)) line(loan.size).lost += 1;
  }
  return [...lines.values()]
    .map(l => ({ ...l, onHand: l.totalOwned - l.out - l.lost }))
    .sort((a, b) => compareSizes(a.size, b.size));
}

export function stockTotals(lines: StockLine[]): Omit<StockLine, 'size'> {
  return lines.reduce(
    (t, l) => ({ totalOwned: t.totalOwned + l.totalOwned, out: t.out + l.out, lost: t.lost + l.lost, onHand: t.onHand + l.onHand }),
    { totalOwned: 0, out: 0, lost: 0, onHand: 0 }
  );
}

/** Newest first by timestamp text (ISO timestamps sort as text); rows with no timestamp last. */
export function newestFirst<T>(items: T[], at: (item: T) => string): T[] {
  return [...items].sort((a, b) => (at(b) || '').localeCompare(at(a) || ''));
}

/** What the Player Portal shows a family about Program Jerseys (never notes, never other players). */
export interface PortalJerseyStatus {
  /** Sizes of the player's open loans (normally zero or one). */
  openLoanSizes: string[];
  /** The player's most recent loan, when it was Returned and nothing is open. */
  returned: { size: string; checkedInAt: string } | null;
  /** Unpaid Lost Jersey Fees, as typed in the sheet (e.g. "25"). */
  unpaidFees: string[];
}

export function portalJerseyStatus(playerId: string, loans: JerseyLoan[]): PortalJerseyStatus {
  const mine = loans.filter(l => l.playerId === playerId);
  const open = mine.filter(isOpenLoan);
  const latest = newestFirst(mine, l => l.checkedInAt || l.checkedOutAt)[0];
  const returned =
    open.length === 0 && latest && !isOpenLoan(latest) && !isLostLoan(latest)
      ? { size: latest.size, checkedInAt: latest.checkedInAt }
      : null;
  return {
    openLoanSizes: open.map(l => l.size),
    returned,
    unpaidFees: mine.filter(hasUnpaidFee).map(l => l.feeIssued),
  };
}

// ---- Write validation ----

export const MAX_MANAGER_NAME_LENGTH = 60;
export const MAX_NOTE_LENGTH = 1000;

/** The Jersey Manager name stamped on every write: trimmed, non-empty, bounded. */
export function cleanManagerName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (!name || name.length > MAX_MANAGER_NAME_LENGTH) return null;
  return name;
}

/** A Lost Jersey Fee amount: digits with optional cents, '$' tolerated. '' means no fee. */
export function cleanFeeAmount(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const s = String(value).trim().replace(/^\$/, '');
  if (s === '') return '';
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return s;
}

/** A calendar date as YYYY-MM-DD, or null. */
export function cleanIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00`).getTime()) ? s : null;
}

export type CheckInRequest =
  | { outcome: typeof LOAN_OUTCOMES.RETURNED; size?: string }
  | { outcome: typeof LOAN_OUTCOMES.LOST; fee: string };

/** Why a check-in can't be applied to this loan, or null when it can. */
export function checkInError(loan: JerseyLoan | undefined, request: CheckInRequest): string | null {
  if (!loan) return 'That loan is not in the Jerseys workbook.';
  if (!isOpenLoan(loan)) return `This jersey was already checked in (${loan.outcome}).`;
  if (request.outcome === LOAN_OUTCOMES.RETURNED && request.size !== undefined && !isKnownJerseySize(request.size)) {
    return `Unknown size: ${request.size}`;
  }
  return null;
}

/** Why a fee can't be marked paid on this loan, or null when it can. */
export function feePaidError(loan: JerseyLoan | undefined): string | null {
  if (!loan) return 'That loan is not in the Jerseys workbook.';
  if (!isLostLoan(loan) || !loan.feeIssued) return 'No Lost Jersey Fee was issued on this loan.';
  if (loan.feePaidOn) return `This fee was already marked paid on ${loan.feePaidOn}.`;
  return null;
}

/** Cells a check-in writes, keyed by header name. */
export function checkInCells(loan: JerseyLoan, request: CheckInRequest, by: string, nowIso: string): Record<string, string> {
  const cells: Record<string, string> = {
    [LOAN_COLUMNS.CHECKED_IN_AT]: nowIso,
    [LOAN_COLUMNS.CHECKED_IN_BY]: by,
    [LOAN_COLUMNS.OUTCOME]: request.outcome as LoanOutcome,
  };
  if (request.outcome === LOAN_OUTCOMES.RETURNED && request.size && request.size !== loan.size) {
    cells[LOAN_COLUMNS.SIZE] = request.size;
    const correction = `Returned as ${request.size}; was recorded as ${loan.size || 'blank'}.`;
    cells[LOAN_COLUMNS.NOTES] = loan.notes ? `${loan.notes} ${correction}` : correction;
  }
  if (request.outcome === LOAN_OUTCOMES.LOST && request.fee) cells[LOAN_COLUMNS.FEE_ISSUED] = request.fee;
  return cells;
}

/**
 * The full row to write back: `existing` with `cells` applied by header name. Columns not named in
 * `cells` keep their current value, so hand-added columns survive.
 */
export function applyCells(headerRow: unknown[], existing: unknown[], cells: Record<string, string>): string[] {
  const map = headerMap(headerRow);
  const row = headerRow.map((_, i) => (existing[i] ?? '').toString());
  for (const [name, value] of Object.entries(cells)) {
    const index = map[name];
    if (index === undefined) throw new Error(`Jerseys workbook is missing the "${name}" column`);
    row[index] = value;
  }
  return row;
}

/** A new row in header order, for appending. Throws when a named column is missing. */
export function rowFromCells(headerRow: unknown[], cells: Record<string, string>): string[] {
  return applyCells(headerRow, [], cells);
}
