import { getBatchSheetData } from './google-api';
import { getCachedSheetData, forceRefreshSheetCache } from './sheet-cache';
import { SHEET_CONFIG, AVAILABILITY_COLUMN_NAMES } from './sheet-config';

/**
 * Shared availability helper for both practice and game availability
 */

export interface AvailabilityResult {
  headerRow: any[];
  playerRow: any[];
  rowIndex: number;
  columnMapping: Record<string, number>;
}

export interface ColumnIndices {
  availabilityColumn: number;
  noteColumn: number;
}

function headerIndex(headerRow: any[], name: string): number {
  return headerRow.findIndex(h => (h ?? '').toString().trim() === name);
}

function findPlayerRowIndex(data: any[][], playerId: string): { rowIndex: number; playerIdIndex: number } | null {
  if (!data || data.length < 1) return null;
  const playerIdIndex = headerIndex(data[0], AVAILABILITY_COLUMN_NAMES.PLAYER_ID);
  if (playerIdIndex === -1) return null;
  for (let i = 1; i < data.length; i++) {
    if ((data[i][playerIdIndex] ?? '').toString().trim() === playerId) {
      return { rowIndex: i + 1, playerIdIndex }; // 1-based sheet row
    }
  }
  return null;
}

/**
 * This player's row in an availability tab, matched by the PlayerID column (located by header
 * name, per docs/fall-2026/player-portal-grill.md Q12), never by Full Name: a family can edit
 * their preferred name on the profile, and that must not redirect availability writes.
 *
 * Returns null when the tab has no PlayerID column yet (not built this season) or no row for this
 * player (not rostered); the caller shows the schedule read-only in both cases.
 */
export async function getPlayerAvailabilityData(
  playerId: string,
  playerCacheKey: 'PRACTICE_AVAILABILITY_PLAYERS' | 'GAME_AVAILABILITY_PLAYERS',
  sheetName: string,
  retried = false
): Promise<AvailabilityResult | null> {
  try {
    let cached = await getCachedSheetData(playerCacheKey);
    let located = findPlayerRowIndex(cached, playerId);

    if (!located) {
      // The row may have been added since the cache was filled; refresh once before giving up.
      await forceRefreshSheetCache(playerCacheKey);
      cached = await getCachedSheetData(playerCacheKey);
      located = findPlayerRowIndex(cached, playerId);
      if (!located) {
        console.log(`[availability] no PlayerID row for ${playerId} in ${sheetName}`);
        return null;
      }
    }

    // Fetch header row (row 1) and player row fresh in a single batch request
    const ranges = [`'${sheetName}'!1:1`, `'${sheetName}'!${located.rowIndex}:${located.rowIndex}`];
    const batchResponse = await getBatchSheetData(SHEET_CONFIG.ROSTER_SHEET_ID, ranges);
    if (!batchResponse || batchResponse.length < 2) {
      throw new Error('Failed to fetch header and player rows');
    }

    const headerRow = batchResponse[0]?.[0] || [];
    const playerRow = batchResponse[1]?.[0] || [];

    // Verify the live row still belongs to this player (rows may have been sorted since caching)
    const livePlayerIdIndex = headerIndex(headerRow, AVAILABILITY_COLUMN_NAMES.PLAYER_ID);
    const fetchedPlayerId = livePlayerIdIndex === -1 ? '' : (playerRow[livePlayerIdIndex] ?? '').toString().trim();
    if (fetchedPlayerId !== playerId) {
      if (retried) {
        console.log(`[availability] row mismatch for ${playerId} in ${sheetName} after refresh`);
        return null;
      }
      console.log(`[availability] row mismatch for ${playerId} in ${sheetName}, refreshing cache...`);
      await forceRefreshSheetCache(playerCacheKey);
      return await getPlayerAvailabilityData(playerId, playerCacheKey, sheetName, true);
    }

    const columnMapping: Record<string, number> = {};
    headerRow.forEach((header: unknown, index: number) => {
      if (header) {
        columnMapping[header.toString().trim()] = index;
      }
    });

    return {
      headerRow,
      playerRow,
      rowIndex: located.rowIndex,
      columnMapping,
    };
  } catch (error) {
    console.error('Error fetching player availability:', error);
    throw error;
  }
}

/** Return zero-padded M/D as MM/DD for column header fallback (e.g. "2/27" -> "02/27"). */
function toPaddedDateKey(date: string): string | null {
  const parts = date.split('/').map(Number);
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  const [m, d] = parts;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
}

/**
 * Find columns for a specific date in the header row
 * Works for both practices and games - looks for date pattern (e.g. "3/7" or "3/7 Availability").
 * Availability column: header matches date or starts with date + " ".
 * Note column: header is exactly "{date} Note" or starts with date + " " and ends with " Note"; if none, noteColumn is -1.
 * Tries canonical date (e.g. "2/27") first, then zero-padded (e.g. "02/27") to match sheet headers.
 */
export function findDateColumns(headerRow: any[], date: string): ColumnIndices | null {
  const datesToTry = [date];
  const padded = toPaddedDateKey(date);
  if (padded && padded !== date) datesToTry.push(padded);

  for (const tryDate of datesToTry) {
    let availabilityColumn = -1;
    for (let i = 0; i < headerRow.length; i++) {
      const header = headerRow[i]?.toString().trim();
      const availabilityMatches = header === tryDate || header.startsWith(tryDate + ' ');

      if (availabilityMatches) {
        availabilityColumn = i;
        break;
      }
    }
    if (availabilityColumn === -1) continue;

    // Find the Note column for this date (e.g. "3/14 Note"), not the next column (which may be Activation Status)
    let noteColumn = -1;
    for (let j = 0; j < headerRow.length; j++) {
      const h = headerRow[j]?.toString().trim();
      if (h === tryDate + ' Note' || (h.startsWith(tryDate + ' ') && h.endsWith(' Note'))) {
        noteColumn = j;
        break;
      }
    }

    return {
      availabilityColumn,
      noteColumn: noteColumn >= 0 ? noteColumn : -1, // -1 when no "{date} Note" column; playerRow[-1] is undefined so note stays empty
    };
  }

  return null;
}

/**
 * Convert column index to letter format (A, B, C, ...)
 */
export function getColumnLetter(index: number): string {
  let result = '';
  while (index >= 0) {
    result = String.fromCharCode(65 + (index % 26)) + result;
    index = Math.floor(index / 26) - 1;
  }
  return result;
}