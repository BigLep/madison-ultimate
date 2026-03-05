import { getPlayerAvailabilityData, AvailabilityResult } from './availability-helper';
import { GAME_CONFIG } from './game-config';

/**
 * Get fresh game availability data for a specific player using cached player mappings
 */
export async function getPlayerGameAvailability(playerFullName: string): Promise<AvailabilityResult | null> {
  return getPlayerAvailabilityData(
    playerFullName,
    'GAME_AVAILABILITY_PLAYERS',
    GAME_CONFIG.GAME_AVAILABILITY_SHEET,
    0 // Assuming Full Name is in column A for games
  );
}

export interface GameColumnIndices {
  availabilityColumn: number;
  noteColumn: number;
  activationStatusColumn?: number;
}

/** Zero-padded M/D for column header fallback (e.g. "2/27" -> "02/27"). */
function toPaddedDateKey(date: string): string | null {
  const parts = date.split('/').map(Number);
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  const [m, d] = parts;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
}

/**
 * Find game columns by date and ordinal in the header row.
 * - ordinalForDate 1: matches unsuffixed columns ("3/7", "3/7 Note", "3/7 Activation Status") or " (Game 1)" suffix.
 * - ordinalForDate >= 2: matches only " (Game N)" suffix (e.g. "3/7 Availability (Game 2)").
 */
export function findGameColumns(headerRow: any[], gameDate: string, ordinalForDate: number): GameColumnIndices | null {
  const datesToTry = [gameDate];
  const padded = toPaddedDateKey(gameDate);
  if (padded && padded !== gameDate) datesToTry.push(padded);

  const suffix = ordinalForDate === 1 ? null : ` (Game ${ordinalForDate})`;

  for (const tryDate of datesToTry) {
    let availabilityColumn = -1;
    const availabilitySuffix = ordinalForDate === 1 ? '' : ` Availability (Game ${ordinalForDate})`;
    for (let i = 0; i < headerRow.length; i++) {
      const header = headerRow[i]?.toString().trim();
      const match =
        ordinalForDate === 1
          ? header === tryDate ||
            (header.startsWith(tryDate + ' ') && !header.includes(' (Game ')) // unsuffixed = Game 1
          : header === tryDate + availabilitySuffix;
      if (match) {
        availabilityColumn = i;
        break;
      }
    }
    if (availabilityColumn === -1) continue;

    let noteColumn = -1;
    const noteSuffix = ordinalForDate === 1 ? ' Note' : ` Note (Game ${ordinalForDate})`;
    for (let j = 0; j < headerRow.length; j++) {
      const h = headerRow[j]?.toString().trim();
      if (ordinalForDate === 1) {
        if (h === tryDate + ' Note' || (h.startsWith(tryDate + ' ') && h.endsWith(' Note') && !h.includes(' (Game '))) {
          noteColumn = j;
          break;
        }
      } else {
        if (h === tryDate + noteSuffix) {
          noteColumn = j;
          break;
        }
      }
    }

    let activationStatusColumn: number | undefined;
    const activationSuffix = ordinalForDate === 1 ? ' Activation Status' : ` Activation Status (Game ${ordinalForDate})`;
    for (let k = 0; k < headerRow.length; k++) {
      const h = headerRow[k]?.toString().trim();
      if (h === tryDate + activationSuffix) {
        activationStatusColumn = k;
        break;
      }
    }

    return {
      availabilityColumn,
      noteColumn: noteColumn >= 0 ? noteColumn : -1,
      ...(activationStatusColumn !== undefined && { activationStatusColumn }),
    };
  }

  return null;
}