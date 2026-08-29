/**
 * Empty Signups-row helper for unit tests. No PII: callers pass self-descriptive labels only.
 */

import { SIGNUPS_COLUMNS } from '@/lib/signups-config';
import type { SignupRecord } from '@/lib/signups-sheet';

/** A signup row with every SIGNUPS_COLUMNS field set to '' , plus any overrides. */
export function signupRecord(overrides: Partial<SignupRecord> = {}): SignupRecord {
  const record: SignupRecord = {};
  for (const column of Object.values(SIGNUPS_COLUMNS)) {
    record[column] = '';
  }
  // Partial<SignupRecord> on a plain string-index type allows `undefined` per TS's handling of
  // index signatures; callers only ever pass actual strings, so this is a typing artifact, not
  // a real possibility.
  return { ...record, ...overrides } as SignupRecord;
}

/** Player-section fields that isPlayerInfoComplete requires (everything except Other Info). */
export const COMPLETE_PLAYER_INFO: Partial<SignupRecord> = {
  [SIGNUPS_COLUMNS.GRADE]: '7',
  [SIGNUPS_COLUMNS.ELEMENTARY_SCHOOL]: 'Alki Elementary School',
  [SIGNUPS_COLUMNS.PRONOUNS]: 'he; him',
  [SIGNUPS_COLUMNS.GENDER_IDENTIFICATION]: 'Boy-Matching/Bx/Non-binary',
  [SIGNUPS_COLUMNS.ALLERGIES]: 'NONE',
  [SIGNUPS_COLUMNS.COMPETING_SPORTS_AND_ACTIVITIES]: 'None',
  [SIGNUPS_COLUMNS.JERSEY_SIZE]: 'AM',
  [SIGNUPS_COLUMNS.PLAYING_EXPERIENCE]: 'One prior season',
  [SIGNUPS_COLUMNS.HOPES]: 'Have fun',
};
