// Access layer for the "2026 Fall Signups" spreadsheet's `Signups` tab.
// Per AGENTS.md: never hardcode column positions; always discover headers dynamically.

import { getSheetData, appendSheetData, updateSheetData } from './google-api';
import { SIGNUPS_SHEET_CONFIG, SIGNUPS_COLUMNS } from './signups-config';
import { profileCompleteCellValue } from './signup-checklist';
import {
  mintPlayerId,
  normalizeName,
  normalizeDateOfBirth,
  disambiguateByPreferredName,
  isNearMatch,
  SignupIdentity,
} from './player-identity';

export type SignupRecord = Record<string, string>;

interface SignupsSheetData {
  headerMap: Record<string, number>;
  headerRow: string[];
  rows: string[][];
}

async function loadSignupsSheet(): Promise<SignupsSheetData> {
  if (!SIGNUPS_SHEET_CONFIG.SIGNUPS_SHEET_ID) {
    throw new Error('SIGNUPS_SHEET_ID is not set');
  }

  // Whole-sheet range (no column bound): the sheet has grown well past column Z as fields
  // were added, and a hardcoded 'A:Z' silently truncated every column beyond it out of
  // headerMap, so those fields would validate and appear to save (the API echoed back
  // what was sent) but never actually persist. Never hardcode a column bound here again.
  const values = await getSheetData(
    SIGNUPS_SHEET_CONFIG.SIGNUPS_SHEET_ID,
    `'${SIGNUPS_SHEET_CONFIG.SIGNUPS_SHEET_NAME}'`
  );

  const headerRow = (values[0] || []).map(v => (v || '').toString().trim());
  const headerMap: Record<string, number> = {};
  headerRow.forEach((header, index) => {
    if (header) headerMap[header] = index;
  });

  const rows = values.slice(1).filter(row => row.some(cell => (cell || '').toString().trim() !== ''));

  return { headerMap, headerRow, rows };
}

function rowToRecord(row: string[], headerMap: Record<string, number>): SignupRecord {
  const record: SignupRecord = {};
  for (const columnName of Object.values(SIGNUPS_COLUMNS)) {
    const index = headerMap[columnName];
    record[columnName] = index !== undefined ? (row[index] || '').toString() : '';
  }
  return record;
}

function recordIdentity(record: SignupRecord): SignupIdentity {
  return {
    preferredFirstName: record[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME] || '',
    lastName: record[SIGNUPS_COLUMNS.LAST_NAME] || '',
    dateOfBirth: record[SIGNUPS_COLUMNS.DATE_OF_BIRTH] || '',
  };
}

export interface LookupResult {
  record: SignupRecord;
  rowNumber: number; // 1-indexed sheet row, for updates
}

/** Player Lookup: normalized last name + full birthdate match exactly; preferred name disambiguates twins. */
export async function findSignupByIdentity(query: SignupIdentity): Promise<LookupResult | null> {
  const { headerMap, rows } = await loadSignupsSheet();

  const queryLast = normalizeName(query.lastName);
  const queryDob = normalizeDateOfBirth(query.dateOfBirth);
  if (!queryLast || !queryDob) return null;

  const candidates: Array<{ record: SignupRecord; rowNumber: number }> = [];
  rows.forEach((row, i) => {
    const record = rowToRecord(row, headerMap);
    const identity = recordIdentity(record);
    if (normalizeName(identity.lastName) === queryLast && normalizeDateOfBirth(identity.dateOfBirth) === queryDob) {
      candidates.push({ record, rowNumber: i + 2 }); // +1 header, +1 for 1-indexing
    }
  });

  if (candidates.length === 0) return null;

  const index = disambiguateByPreferredName(
    query,
    candidates.map(c => recordIdentity(c.record))
  );
  if (index === -1) return null;

  return candidates[index];
}

/** Content-free near-match check (spec C1), excluding exact identity matches. */
export async function findNearMatches(query: SignupIdentity): Promise<SignupRecord[]> {
  const { headerMap, rows } = await loadSignupsSheet();

  const matches: SignupRecord[] = [];
  for (const row of rows) {
    const record = rowToRecord(row, headerMap);
    const identity = recordIdentity(record);
    if (isNearMatch(query, identity)) {
      matches.push(record);
    }
  }
  return matches;
}

/** Every signup row, for admin-side bulk operations like Final Forms Backfill (ADR 0005). */
export async function listAllSignups(): Promise<SignupRecord[]> {
  const { headerMap, rows } = await loadSignupsSheet();
  return rows.map(row => rowToRecord(row, headerMap));
}

export async function findSignupByPlayerId(playerId: string): Promise<LookupResult | null> {
  const { headerMap, rows } = await loadSignupsSheet();
  const index = rows.findIndex(row => (row[headerMap[SIGNUPS_COLUMNS.PLAYER_ID]] || '') === playerId);
  if (index === -1) return null;
  return { record: rowToRecord(rows[index], headerMap), rowNumber: index + 2 };
}

/**
 * Create a new signup row with a freshly minted PlayerID. Returns the created record.
 * A caller may pass Created At (Seed Signups from Final Forms does, so Created At, Updated At,
 * and Seeded At are the same instant); otherwise it is now. Profile Complete is always computed
 * here, never passed in.
 */
export async function createSignupRow(fields: Partial<SignupRecord>): Promise<SignupRecord> {
  const { headerMap, headerRow } = await loadSignupsSheet();

  const playerId = mintPlayerId();
  const now = fields[SIGNUPS_COLUMNS.CREATED_AT] || new Date().toISOString();

  const record: SignupRecord = {};
  for (const columnName of Object.values(SIGNUPS_COLUMNS)) {
    record[columnName] = fields[columnName] || '';
  }
  record[SIGNUPS_COLUMNS.PLAYER_ID] = playerId;
  record[SIGNUPS_COLUMNS.CREATED_AT] = now;
  record[SIGNUPS_COLUMNS.UPDATED_AT] = now;
  record[SIGNUPS_COLUMNS.PROFILE_COMPLETE] = profileCompleteCellValue(record);

  const row = headerRow.map(header => record[header] ?? '');

  await appendSheetData(
    SIGNUPS_SHEET_CONFIG.SIGNUPS_SHEET_ID,
    `'${SIGNUPS_SHEET_CONFIG.SIGNUPS_SHEET_NAME}'`,
    [row]
  );

  return record;
}

export interface UpdateSignupRowOptions {
  /**
   * Updated At means "last change by a family, or a seed or join that did meaningful work on
   * the row" (ADR 0006). Pass false for a purely system write (recomputing a derived column)
   * so it keeps that meaning.
   */
  touchUpdatedAt?: boolean;
}

/**
 * Update an existing signup row in place (edit-in-place). Only columns present in `fields`
 * are changed; all other columns (including any coach-added manual columns) are preserved.
 * Profile Complete is recomputed from the merged row on every call.
 */
export async function updateSignupRow(
  playerId: string,
  fields: Partial<SignupRecord>,
  options: UpdateSignupRowOptions = {}
): Promise<SignupRecord> {
  const existing = await findSignupByPlayerId(playerId);
  if (!existing) {
    throw new Error(`No signup row found for PlayerID ${playerId}`);
  }

  const { headerMap, headerRow } = await loadSignupsSheet();

  const merged: SignupRecord = { ...existing.record };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) merged[key] = value;
  }
  merged[SIGNUPS_COLUMNS.PLAYER_ID] = playerId; // never overwritten
  if (options.touchUpdatedAt !== false) {
    merged[SIGNUPS_COLUMNS.UPDATED_AT] = new Date().toISOString();
  }
  merged[SIGNUPS_COLUMNS.PROFILE_COMPLETE] = profileCompleteCellValue(merged);

  const row = headerRow.map(header => merged[header] ?? existing.record[header] ?? '');

  const lastColumnLetter = columnIndexToLetter(headerRow.length - 1);
  await updateSheetData(
    SIGNUPS_SHEET_CONFIG.SIGNUPS_SHEET_ID,
    `'${SIGNUPS_SHEET_CONFIG.SIGNUPS_SHEET_NAME}'!A${existing.rowNumber}:${lastColumnLetter}${existing.rowNumber}`,
    [row]
  );

  return merged;
}

/**
 * Recompute the Profile Complete column for every row (ADR 0006), writing only the cells whose
 * stored value differs and never touching Updated At. One sheet read, one single-cell write per
 * changed row. Returns the number of rows written.
 */
export async function recomputeProfileCompleteForAllRows(): Promise<number> {
  const { headerMap, rows } = await loadSignupsSheet();
  const columnIndex = headerMap[SIGNUPS_COLUMNS.PROFILE_COMPLETE];
  if (columnIndex === undefined) {
    throw new Error(`Signups sheet is missing the "${SIGNUPS_COLUMNS.PROFILE_COMPLETE}" header`);
  }
  const letter = columnIndexToLetter(columnIndex);

  let written = 0;
  for (let i = 0; i < rows.length; i++) {
    const record = rowToRecord(rows[i], headerMap);
    if (!record[SIGNUPS_COLUMNS.PLAYER_ID]) continue;
    const expected = profileCompleteCellValue(record);
    if (record[SIGNUPS_COLUMNS.PROFILE_COMPLETE] === expected) continue;
    const rowNumber = i + 2; // +1 header, +1 for 1-indexing
    await updateSheetData(
      SIGNUPS_SHEET_CONFIG.SIGNUPS_SHEET_ID,
      `'${SIGNUPS_SHEET_CONFIG.SIGNUPS_SHEET_NAME}'!${letter}${rowNumber}`,
      [[expected]]
    );
    written++;
  }
  return written;
}

function columnIndexToLetter(index: number): string {
  let letter = '';
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}
