// Access layer for the coach workbook's Coaches tab (CONTEXT.md: Coach). Parsing is in
// coaches-table.ts; this file only reads and writes the sheet.

import { getSheetData, updateSheetData } from './google-api';
import { getCachedSheetData, forceRefreshSheetCache } from './sheet-cache';
import { SHEET_CONFIG } from './sheet-config';
import { Coach, EditableCoachFields, coachFieldsToRow, parseCoachesTable } from './coaches-table';
import { getColumnLetter } from './availability-helper';

const COACHES_RANGE = `'${SHEET_CONFIG.COACHES_SHEET_NAME}'`;

async function readCoachesFresh(): Promise<unknown[][]> {
  return getSheetData(SHEET_CONFIG.ROSTER_SHEET_ID, COACHES_RANGE);
}

/**
 * Every Coach in sheet order. `fresh` skips the in-memory cache: Coach Home reads fresh so a coach
 * sees their own edit immediately; the public Coaches Page and Coach Login list use the cache.
 */
export async function listCoaches({ fresh = false }: { fresh?: boolean } = {}): Promise<Coach[]> {
  const values = fresh ? await readCoachesFresh() : await getCachedSheetData('COACHES');
  return parseCoachesTable(values);
}

export async function findCoach(coachId: string, { fresh = false }: { fresh?: boolean } = {}): Promise<Coach | null> {
  return (await listCoaches({ fresh })).find(c => c.coachId === coachId) ?? null;
}

/**
 * Write the given fields onto a coach's row in place, leaving every other cell as it was.
 * Returns the updated Coach, or null when the CoachID is not on the tab.
 */
export async function updateCoach(coachId: string, fields: EditableCoachFields): Promise<Coach | null> {
  const values = await readCoachesFresh();
  const coach = parseCoachesTable(values).find(c => c.coachId === coachId);
  if (!coach) return null;

  const headerRow = values[0];
  const row = coachFieldsToRow(headerRow, values[coach.rowNumber - 1] || [], fields);
  const lastColumn = getColumnLetter(headerRow.length - 1);
  await updateSheetData(
    SHEET_CONFIG.ROSTER_SHEET_ID,
    `${COACHES_RANGE}!A${coach.rowNumber}:${lastColumn}${coach.rowNumber}`,
    [row]
  );
  await forceRefreshSheetCache('COACHES');
  return { ...coach, ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) };
}
