import { getCachedSheetData } from './sheet-cache';
import { ROSTER_COLUMN_NAMES } from './sheet-config';

interface RosterRows {
  rows: unknown[][];
  playerIdIndex: number;
  teamIndex: number;
}

/**
 * Reads the coach workbook's Roster tab once and locates PlayerID and Team by header name, never
 * position. Fails soft: an unshared workbook, a missing tab, or a missing column just means no
 * Team, never a broken caller.
 */
async function readRoster(): Promise<RosterRows | null> {
  try {
    const rows = await getCachedSheetData('ROSTER');
    if (!rows || rows.length < 2) return null;

    const header = rows[0].map(cell => (cell ?? '').toString().trim());
    const playerIdIndex = header.indexOf(ROSTER_COLUMN_NAMES.PLAYER_ID);
    const teamIndex = header.indexOf(ROSTER_COLUMN_NAMES.TEAM);
    if (playerIdIndex === -1 || teamIndex === -1) {
      console.warn('[roster-team] Roster tab is missing PlayerID or Team header; Team hidden');
      return null;
    }
    return { rows, playerIdIndex, teamIndex };
  } catch (error) {
    console.warn('[roster-team] Could not read Team from the Roster tab:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * The Player Portal's one read from the Roster tab: this player's Team, by PlayerID
 * (docs/fall-2026/player-portal-grill.md Q6/Q11). Everything family-authored comes from the
 * Signups sheet instead.
 */
export async function getTeamForPlayerId(playerId: string): Promise<string> {
  const roster = await readRoster();
  if (!roster) return '';
  const row = roster.rows.find((r, i) => i > 0 && (r[roster.playerIdIndex] ?? '').toString().trim() === playerId);
  return row ? (row[roster.teamIndex] ?? '').toString().trim() : '';
}

/**
 * Every PlayerID on the Roster tab mapped to its Team, in one read. Used to scope the Player
 * Directory (CONTEXT.md: Rostered Player) without an N+1 read per signup.
 */
export async function getAllRosterTeams(): Promise<Map<string, string>> {
  const roster = await readRoster();
  const map = new Map<string, string>();
  if (!roster) return map;
  for (let i = 1; i < roster.rows.length; i++) {
    const row = roster.rows[i];
    const playerId = (row[roster.playerIdIndex] ?? '').toString().trim();
    if (playerId) map.set(playerId, (row[roster.teamIndex] ?? '').toString().trim());
  }
  return map;
}
