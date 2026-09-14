import { findSignupByPlayerId, SignupRecord } from './signups-sheet';
import { SIGNUPS_COLUMNS } from './signups-config';
import { getTeamForPlayerId } from './roster-team';

export interface PortalPlayer {
  playerId: string;
  fullName: string;
  /** Raw Team value from the coach Roster tab ('' or 'TBD' while unassigned). */
  team: string;
  record: SignupRecord;
}

/**
 * The Player Portal's view of a player (docs/fall-2026/player-portal-grill.md Q11): everything
 * family-authored from the Signups row, plus Team from the coach Roster tab by PlayerID.
 * Full Name is Preferred First Name followed by Last Name, the coach sheet's convention.
 */
export async function loadPortalPlayer(playerId: string): Promise<PortalPlayer | null> {
  const found = await findSignupByPlayerId(playerId);
  if (!found) return null;
  const record = found.record;
  const fullName = `${record[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME] || ''} ${record[SIGNUPS_COLUMNS.LAST_NAME] || ''}`.trim();
  const team = await getTeamForPlayerId(playerId);
  return { playerId, fullName, team, record };
}
