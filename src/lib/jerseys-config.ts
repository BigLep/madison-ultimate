// Central configuration for the Madison Ultimate Jerseys workbook (ADR 0009; CONTEXT.md: Jerseys).
// The workbook is not seasonal: one sheet for every season. Column values below are header NAMES,
// never positions; jerseys.ts resolves each column's index from the tab's own header row.

export const JERSEYS_SHEET_CONFIG = {
  JERSEYS_SHEET_ID: process.env.JERSEYS_SHEET_ID || '',
} as const;

export const JERSEY_TABS = {
  LOANS: 'Jersey Loans',
  STOCK: 'Jersey Stock',
  FAMILY_JERSEYS: 'Family Jerseys',
  NOTES: 'Jersey Notes',
} as const;

export const LOAN_COLUMNS = {
  LOAN_ID: 'LoanID',
  PLAYER_ID: 'PlayerID',
  PLAYER_NAME: 'Player Name',
  SIZE: 'Size',
  CHECKED_OUT_AT: 'Checked Out At',
  CHECKED_OUT_BY: 'Checked Out By',
  CHECKED_IN_AT: 'Checked In At',
  CHECKED_IN_BY: 'Checked In By',
  OUTCOME: 'Outcome',
  FEE_ISSUED: 'Fee Issued',
  FEE_PAID_ON: 'Fee Paid On',
  NOTES: 'Notes',
} as const;

export const STOCK_COLUMNS = {
  SIZE: 'Size',
  TOTAL_OWNED: 'Total Owned',
  NOTES: 'Notes',
} as const;

export const FAMILY_JERSEY_COLUMNS = {
  PLAYER_ID: 'PlayerID',
  PLAYER_NAME: 'Player Name',
  SIZE: 'Size',
  SEASON_RECORDED: 'Season Recorded',
  NOTES: 'Notes',
} as const;

export const NOTE_COLUMNS = {
  RECORDED_AT: 'Recorded At',
  RECORDED_BY: 'Recorded By',
  PLAYER_ID: 'PlayerID',
  PLAYER_NAME: 'Player Name',
  SIZE: 'Size',
  NOTE: 'Note',
} as const;

/** A Jersey Loan's Outcome; blank means the loan is still open. */
export const LOAN_OUTCOMES = {
  RETURNED: 'Returned',
  LOST: 'Lost',
} as const;

export type LoanOutcome = (typeof LOAN_OUTCOMES)[keyof typeof LOAN_OUTCOMES];
