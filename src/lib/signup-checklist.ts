// Round 3: per-section completion checks driving the top-level signup status checklist.
// Each check is deliberately narrow (one section, one question: "is this done?") so the
// checklist and the section itself never disagree about what "done" means.

import type { SignupRecord } from './signups-sheet';
import { SIGNUPS_COLUMNS } from './signups-config';

/** Player Info: every field in the Player section is required except Other Info (an open-ended catch-all). */
export function isPlayerInfoComplete(record: SignupRecord): boolean {
  return Boolean(
    record[SIGNUPS_COLUMNS.GRADE] &&
    record[SIGNUPS_COLUMNS.ELEMENTARY_SCHOOL] &&
    record[SIGNUPS_COLUMNS.PRONOUNS] &&
    record[SIGNUPS_COLUMNS.GENDER_IDENTIFICATION] &&
    record[SIGNUPS_COLUMNS.ALLERGIES] &&
    record[SIGNUPS_COLUMNS.COMPETING_SPORTS_AND_ACTIVITIES] &&
    record[SIGNUPS_COLUMNS.JERSEY_SIZE] &&
    record[SIGNUPS_COLUMNS.PLAYING_EXPERIENCE] &&
    record[SIGNUPS_COLUMNS.HOPES]
  );
}

/** Caretaker Info: unchanged bar from round 1/2, Caretaker 1 name + email. Caretaker 2 stays fully optional. */
export function isCaretakerInfoComplete(record: SignupRecord): boolean {
  return Boolean(record[SIGNUPS_COLUMNS.CARETAKER_1_NAME] && record[SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]);
}

/** Coach Volunteering: any answer counts, including the "Not this season" escape hatch. */
export function isCoachVolunteeringComplete(record: SignupRecord): boolean {
  return Boolean(record[SIGNUPS_COLUMNS.COACH_VOLUNTEERING_INTEREST]);
}

/** Other Volunteering: at least one selection, including the "Not this season" escape hatch. */
export function isOtherVolunteeringComplete(record: SignupRecord): boolean {
  return Boolean(record[SIGNUPS_COLUMNS.VOLUNTEER_ROLES]);
}

/** Photo Upload: required as of round 3 (previously optional). */
export function isPhotoComplete(record: SignupRecord): boolean {
  return Boolean(record[SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]);
}

/** Final Forms checklist row: done only when found and all three status flags are true. */
export function isFinalFormsComplete(status: {
  found?: boolean;
  parentSigned?: boolean;
  studentSigned?: boolean;
  physicalCleared?: boolean;
} | null | undefined): boolean {
  return Boolean(
    status?.found &&
    status.parentSigned &&
    status.studentSigned &&
    status.physicalCleared
  );
}
