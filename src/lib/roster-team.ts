import { getCachedSheetData } from './sheet-cache';
import { ROSTER_COLUMN_NAMES } from './sheet-config';

/**
 * The one read the portal makes from the coach workbook's Roster tab: this player's Team, by
 * PlayerID (docs/fall-2026/player-portal-grill.md Q6/Q11). Everything family-authored comes from
 * the Signups sheet instead. Fails soft: an unshared workbook, a missing tab, or a missing column
 * just means no Team, never a broken portal. Columns are found by header name, never position.
 */
export async function getTeamForPlayerId(playerId: string): Promise<string> {
  try {
    const rows = await getCachedSheetData('ROSTER');
    if (!rows || rows.length < 2) return '';

    const header = rows[0].map(cell => (cell ?? '').toString().trim());
    const playerIdIndex = header.indexOf(ROSTER_COLUMN_NAMES.PLAYER_ID);
    const teamIndex = header.indexOf(ROSTER_COLUMN_NAMES.TEAM);
    if (playerIdIndex === -1 || teamIndex === -1) {
      console.warn('[roster-team] Roster tab is missing PlayerID or Team header; Team hidden');
      return '';
    }

    const row = rows.find((r, i) => i > 0 && (r[playerIdIndex] ?? '').toString().trim() === playerId);
    return row ? (row[teamIndex] ?? '').toString().trim() : '';
  } catch (error) {
    console.warn('[roster-team] Could not read Team from the Roster tab:', error instanceof Error ? error.message : error);
    return '';
  }
}
