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

/**
 * Find game columns by date in the header row
 */
export function findGameColumns(headerRow: any[], gameDate: string) {
  return findDateColumns(headerRow, gameDate);
}