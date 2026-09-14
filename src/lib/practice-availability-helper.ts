import { getPlayerAvailabilityData, findDateColumns, AvailabilityResult } from './availability-helper';
import { PRACTICE_CONFIG } from './practice-config';

/** This player's Practice Availability row (by PlayerID), or null when the tab has no row for them. */
export async function getPlayerPracticeAvailability(playerId: string): Promise<AvailabilityResult | null> {
  return getPlayerAvailabilityData(playerId, 'PRACTICE_AVAILABILITY_PLAYERS', PRACTICE_CONFIG.PRACTICE_AVAILABILITY_SHEET);
}

/**
 * Find practice columns by date in the header row
 */
export function findPracticeColumns(headerRow: any[], practiceDate: string) {
  return findDateColumns(headerRow, practiceDate);
}
