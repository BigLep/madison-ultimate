import { getPlayerAvailabilityData, findDateColumns, AvailabilityResult } from './availability-helper';
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

/**
 * Find game columns by date in the header row (availability, note, and optional "{date} Activation Status").
 */
export function findGameColumns(headerRow: any[], gameDate: string): GameColumnIndices | null {
  const base = findDateColumns(headerRow, gameDate);
  if (!base) return null;

  const activationHeader = `${gameDate} Activation Status`;
  let activationStatusColumn: number | undefined;
  for (let i = 0; i < headerRow.length; i++) {
    const header = headerRow[i]?.toString().trim();
    if (header === activationHeader) {
      activationStatusColumn = i;
      break;
    }
  }

  return {
    ...base,
    ...(activationStatusColumn !== undefined && { activationStatusColumn }),
  };
}