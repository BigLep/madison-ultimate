import { getPlayerAvailabilityData, findDateColumns, AvailabilityResult } from './availability-helper';
import { PRACTICE_CONFIG } from './practice-config';

/**
 * Get fresh practice availability data for a specific player using cached player mappings
 */
export async function getPlayerPracticeAvailability(playerFullName: string): Promise<AvailabilityResult | null> {
  return getPlayerAvailabilityData(
    playerFullName,
    'PRACTICE_AVAILABILITY_PLAYERS',
    PRACTICE_CONFIG.PRACTICE_AVAILABILITY_SHEET,
    PRACTICE_CONFIG.AVAILABILITY_COLUMNS.FULL_NAME
  );
}

/**
 * Find practice columns by date in the header row
 */
export function findPracticeColumns(headerRow: any[], practiceDate: string) {
  return findDateColumns(headerRow, practiceDate);
}