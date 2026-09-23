// Team display for the Player Portal header and Games tab (docs/fall-2026/player-portal-grill.md Q24).
// Fall 2026 squads: Blue, Gold, Silver, Practice Squad. TBD or blank means not assigned yet, and
// the portal hides the Team segment rather than showing "TBD" to a family.

const TEAM_DISPLAY: Record<string, string> = {
  blue: '🟦 Blue',
  gold: '🟨 Gold',
  silver: '🪙 Silver',
  'practice squad': '🏋️ Practice Squad',
};

/** Canonical squad order for anywhere teams are listed together (filters, standings, etc). */
export const TEAM_ORDER = ['blue', 'gold', 'silver', 'practice squad'] as const;

const PRACTICE_SQUAD = 'practice squad';
const UNASSIGNED_LABEL = '🕒 TBD';

export function normalizeTeam(team: string | null | undefined): string {
  return (team || '').trim().toLowerCase();
}

/** True once a coach has assigned a real squad (not blank, not TBD). */
export function isTeamAssigned(team: string | null | undefined): boolean {
  const t = normalizeTeam(team);
  return t !== '' && t !== 'tbd';
}

/** Family-facing team label with its emoji, or '' while unassigned. Unknown values show as typed. */
export function formatTeam(team: string | null | undefined): string {
  if (!isTeamAssigned(team)) return '';
  return TEAM_DISPLAY[normalizeTeam(team)] ?? (team || '').trim();
}

/**
 * Same as formatTeam, but with an explicit "TBD" label instead of hiding it — for coach-facing
 * views (e.g. the Player Directory) where "not yet assigned" is itself useful information, unlike
 * the family-facing views formatTeam serves.
 */
export function formatTeamOrTbd(team: string | null | undefined): string {
  return isTeamAssigned(team) ? formatTeam(team) : UNASSIGNED_LABEL;
}

/**
 * Sorts squads by TEAM_ORDER (Blue, Gold, Silver, Practice Squad); anything unrecognized,
 * including TBD, sorts after all known squads, alphabetically among themselves.
 */
export function compareTeams(a: string | null | undefined, b: string | null | undefined): number {
  const rank = (t: string | null | undefined) => {
    const i = TEAM_ORDER.indexOf(normalizeTeam(t) as (typeof TEAM_ORDER)[number]);
    return i === -1 ? TEAM_ORDER.length : i;
  };
  const rankDiff = rank(a) - rank(b);
  return rankDiff !== 0 ? rankDiff : normalizeTeam(a).localeCompare(normalizeTeam(b));
}

/**
 * Whether a Game Info row is shown to a player (grill Q25): a row with a blank Team is an all-team
 * event and shows to everyone; otherwise it shows only when its Team equals the player's. A player
 * whose Team is unassigned or Practice Squad sees only all-team rows.
 */
export function isGameRowVisibleToPlayer(rowTeam: string | null | undefined, playerTeam: string | null | undefined): boolean {
  const row = normalizeTeam(rowTeam);
  if (row === '') return true;
  const player = normalizeTeam(playerTeam);
  if (!isTeamAssigned(player) || player === PRACTICE_SQUAD) return false;
  return row === player;
}
