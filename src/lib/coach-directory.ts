// Player Directory data (CONTEXT.md, ADR 0008): the coach-facing, read-only join of Signups and
// the Roster tab's Team, scoped to Rostered Players only. Distinct from Player Lookup, which is
// the family's own self-service identity match.

import { listAllSignups, findSignupByPlayerId, SignupRecord } from './signups-sheet';
import { SIGNUPS_COLUMNS } from './signups-config';
import { isPhotoComplete } from './signup-checklist';
import { getAllRosterTeams } from './roster-team';
import { isTeamAssigned } from './team-display';

export interface RosteredPlayerSummary {
  playerId: string;
  fullName: string;
  team: string;
  gender: string;
}

export interface CaretakerContact {
  name: string;
  email: string;
  phone: string;
}

export interface PlayerDirectoryEntry {
  playerId: string;
  fullName: string;
  team: string;
  grade: string;
  gender: string;
  hasPhoto: boolean;
  allergies: string;
  studentEmail: string;
  studentPhone: string;
  caretakers: CaretakerContact[];
}

function fullNameOf(record: SignupRecord): string {
  return `${record[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME] || ''} ${record[SIGNUPS_COLUMNS.LAST_NAME] || ''}`.trim();
}

/** '' and the literal 'TBD' both mean "which team hasn't been decided yet" (see team-display.ts). */
function normalizeTeam(team: string): string {
  return isTeamAssigned(team) ? team : 'TBD';
}

function caretakersOf(record: SignupRecord): CaretakerContact[] {
  const caretakers: CaretakerContact[] = [
    {
      name: record[SIGNUPS_COLUMNS.CARETAKER_1_NAME] || '',
      email: record[SIGNUPS_COLUMNS.CARETAKER_1_EMAIL] || '',
      phone: record[SIGNUPS_COLUMNS.CARETAKER_1_PHONE] || '',
    },
    {
      name: record[SIGNUPS_COLUMNS.CARETAKER_2_NAME] || '',
      email: record[SIGNUPS_COLUMNS.CARETAKER_2_EMAIL] || '',
      phone: record[SIGNUPS_COLUMNS.CARETAKER_2_PHONE] || '',
    },
  ];
  return caretakers.filter(c => c.name || c.email || c.phone);
}

function toDirectoryEntry(record: SignupRecord, team: string): PlayerDirectoryEntry {
  return {
    playerId: record[SIGNUPS_COLUMNS.PLAYER_ID] || '',
    fullName: fullNameOf(record),
    team,
    grade: record[SIGNUPS_COLUMNS.GRADE] || '',
    gender: record[SIGNUPS_COLUMNS.GENDER_IDENTIFICATION] || '',
    hasPhoto: isPhotoComplete(record),
    allergies: record[SIGNUPS_COLUMNS.ALLERGIES] || '',
    studentEmail: record[SIGNUPS_COLUMNS.STUDENT_PERSONAL_EMAIL] || record[SIGNUPS_COLUMNS.STUDENT_SPS_EMAIL] || '',
    studentPhone: record[SIGNUPS_COLUMNS.STUDENT_CELL_PHONE] || '',
    caretakers: caretakersOf(record),
  };
}

/**
 * Every Rostered Player: a signup with a row at all on the coach Roster tab. Team itself may
 * still be blank or 'TBD' (not yet decided which team) — that doesn't make the player any less
 * Rostered, only a signup with no Roster row at all is excluded. Sorted alphabetically by full
 * name; includes each player's Team so the Player Directory can filter by it (issue #1).
 */
export async function listRosteredPlayers(): Promise<RosteredPlayerSummary[]> {
  const [signups, teamsByPlayerId] = await Promise.all([listAllSignups(), getAllRosterTeams()]);
  return signups
    .filter(record => teamsByPlayerId.has(record[SIGNUPS_COLUMNS.PLAYER_ID] || ''))
    .map(record => {
      const playerId = record[SIGNUPS_COLUMNS.PLAYER_ID] || '';
      return {
        playerId,
        fullName: fullNameOf(record),
        team: normalizeTeam(teamsByPlayerId.get(playerId) || ''),
        gender: record[SIGNUPS_COLUMNS.GENDER_IDENTIFICATION] || '',
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/** Null both when the player doesn't exist and when they exist but aren't Rostered. */
export async function getPlayerDirectoryEntry(playerId: string): Promise<PlayerDirectoryEntry | null> {
  const [found, teamsByPlayerId] = await Promise.all([findSignupByPlayerId(playerId), getAllRosterTeams()]);
  if (!found) return null;
  if (!teamsByPlayerId.has(playerId)) return null;
  return toDirectoryEntry(found.record, normalizeTeam(teamsByPlayerId.get(playerId) || ''));
}
