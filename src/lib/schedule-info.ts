// Readers for the coach workbook's schedule tabs (Practice Info, Game Info, Fields), shared by the
// Player Portal's Practices and Games tabs and Coach Availability. Columns are found by header
// name, never by position (AGENTS.md).

import { getCachedSheetData } from './sheet-cache';
import { PRACTICE_CONFIG } from './practice-config';
import { GAME_CONFIG } from './game-config';
import { assignGameOrdinals } from './game-schedule';
import { toCanonicalDateKey } from './date-formatters';

export function headerMap(headerRow: any[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    const name = (h ?? '').toString().trim();
    if (name) map[name] = i;
  });
  return map;
}

function cellGetter(map: Record<string, number>) {
  return (row: any[], name: string) => {
    const index = map[name];
    return index === undefined ? '' : (row[index] ?? '').toString().trim();
  };
}

/** "Walt Hudley (East)" when both are set; otherwise whichever one is set. */
export function formatFieldLocation(fieldName: string, fieldLocation: string): string {
  return fieldName && fieldLocation ? `${fieldName} (${fieldLocation})` : (fieldName || fieldLocation);
}

export interface PracticeInfoRow {
  date: string;
  fieldName: string;
  fieldLocation: string;
  startTime: string;
  endTime: string;
  note: string;
}

export async function readPracticeInfo(): Promise<PracticeInfoRow[] | null> {
  const data = await getCachedSheetData('PRACTICE_INFO');
  if (!data || data.length < 2) return null;
  const cols = PRACTICE_CONFIG.PRACTICE_INFO_COLUMN_NAMES;
  const map = headerMap(data[0]);
  if (map[cols.DATE] === undefined) {
    throw new Error(`Practice Info is missing the "${cols.DATE}" column`);
  }
  const get = cellGetter(map);
  const rows: PracticeInfoRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rawDate = get(row, cols.DATE);
    if (!rawDate) continue;
    rows.push({
      date: toCanonicalDateKey(rawDate),
      fieldName: get(row, cols.FIELD_NAME),
      fieldLocation: get(row, cols.FIELD_LOCATION),
      startTime: get(row, cols.START),
      endTime: get(row, cols.END),
      note: get(row, cols.NOTE),
    });
  }
  return rows;
}

export interface GameInfoRow {
  date: string;
  label: string;
  team: string;
  warmupTime: string;
  gameStart: string;
  doneBy: string;
  fieldName: string;
  fieldLocation: string;
  gameNote: string;
  opponent: string;
}

/** Every Game Info row with a date and label, in sheet order, with per-date-per-team ordinals. */
export async function readGameInfo(): Promise<Array<GameInfoRow & { ordinalForDate: number }> | null> {
  const data = await getCachedSheetData('GAME_INFO');
  if (!data || data.length < 2) return null;
  const col = GAME_CONFIG.GAME_INFO_COLUMN_NAMES;
  const get = cellGetter(headerMap(data[0]));
  const rows: GameInfoRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rawDate = get(row, col.DATE);
    const label = get(row, col.GAME_LABEL);
    if (!rawDate || !label) continue;
    rows.push({
      date: toCanonicalDateKey(rawDate),
      label,
      team: get(row, col.TEAM),
      warmupTime: get(row, col.WARMUP),
      gameStart: get(row, col.START),
      doneBy: get(row, col.DONE),
      fieldName: get(row, col.FIELD_NAME),
      fieldLocation: get(row, col.FIELD_LOCATION),
      gameNote: get(row, col.GAME_NOTE),
      opponent: get(row, col.OPPONENT),
    });
  }
  return assignGameOrdinals(rows);
}

export interface FieldUrls {
  googleMapUrl: string | null;
  discNwUrl: string | null;
}

/** Fields tab links by field name. Empty (not an error) when the tab is missing. */
export async function readFieldUrls(): Promise<Record<string, FieldUrls>> {
  const byName: Record<string, FieldUrls> = {};
  try {
    const fieldsData = await getCachedSheetData('FIELDS');
    if (fieldsData && fieldsData.length >= 2) {
      const map = headerMap(fieldsData[0]);
      const get = cellGetter(map);
      const cols = GAME_CONFIG.FIELDS_COLUMN_NAMES;
      if (map[cols.FIELD_NAME] !== undefined) {
        for (let r = 1; r < fieldsData.length; r++) {
          const name = get(fieldsData[r], cols.FIELD_NAME);
          if (name) {
            byName[name] = {
              googleMapUrl: get(fieldsData[r], cols.GOOGLE_MAP_URL) || null,
              discNwUrl: get(fieldsData[r], cols.DISC_NW_URL) || null,
            };
          }
        }
      }
    }
  } catch (e) {
    console.log('Fields sheet not available, location URLs will be missing:', e);
  }
  return byName;
}
