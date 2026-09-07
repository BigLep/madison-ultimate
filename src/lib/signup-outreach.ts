// Signup Outreach (ADR 0007): the per-row status the outreach route returns and the audience
// selection the draft script applies. Pure; the route feeds it rows and Final Forms status.

import type { SignupRecord } from './signups-sheet';
import { SIGNUPS_COLUMNS } from './signups-config';
import {
  isPlayerInfoComplete,
  isCaretakerInfoComplete,
  isCoachVolunteeringComplete,
  isOtherVolunteeringComplete,
  isPhotoComplete,
  isFinalFormsComplete,
} from './signup-checklist';

export interface OutreachFinalFormsStatus {
  found: boolean;
  parentSigned?: boolean;
  studentSigned?: boolean;
  physicalCleared?: boolean;
}

export interface OutreachChecklist {
  finalForms: boolean;
  playerInfo: boolean;
  photo: boolean;
  caretakerInfo: boolean;
  otherVolunteering: boolean;
  coachVolunteering: boolean;
}

/** The six checklist rows in the player page's order, with the page's labels. */
export const OUTREACH_CHECKLIST_ROWS: { key: keyof OutreachChecklist; label: string }[] = [
  { key: 'finalForms', label: 'SPS Final Forms Status' },
  { key: 'playerInfo', label: 'Player Info' },
  { key: 'photo', label: 'Photo Upload' },
  { key: 'caretakerInfo', label: 'Caretaker Info' },
  { key: 'coachVolunteering', label: 'Coach Volunteering' },
  { key: 'otherVolunteering', label: 'Other Volunteering' },
];

export type UnreachableReason = 'no caretaker email' | 'caretaker emails invalid';

export interface OutreachEntry {
  playerId: string;
  preferredName: string;
  lastName: string;
  fullName: string;
  caretaker1Name: string;
  caretaker2Name: string;
  seeded: boolean;
  portalUrl: string;
  checklist: OutreachChecklist;
  checklistComplete: boolean;
  finalFormsDetail: { found: boolean; parentSigned: boolean; studentSigned: boolean; physicalCleared: boolean };
  to: string[];
  cc: string[];
  warnings: string[];
  /** Null when at least one valid caretaker address exists. */
  unreachableReason: UnreachableReason | null;
}

/** Same bar as the coach sheet's BuildEmailList.gs: one @, something on each side, a dot in the domain. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CollectedAddresses {
  emails: string[];
  invalid: { column: string; value: string }[];
}

/** Trim, lowercase, validate, and deduplicate the addresses in the given columns, in column order. */
function collectAddresses(record: SignupRecord, columns: string[]): CollectedAddresses {
  const emails: string[] = [];
  const invalid: CollectedAddresses['invalid'] = [];
  for (const column of columns) {
    const raw = (record[column] || '').trim();
    if (!raw) continue;
    const email = raw.toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      invalid.push({ column, value: raw });
      continue;
    }
    if (!emails.includes(email)) emails.push(email);
  }
  return { emails, invalid };
}

export function buildOutreachEntry(
  record: SignupRecord,
  finalForms: OutreachFinalFormsStatus | null | undefined,
  baseUrl: string
): OutreachEntry {
  const preferredName = (record[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME] || '').trim();
  const lastName = (record[SIGNUPS_COLUMNS.LAST_NAME] || '').trim();
  const playerId = record[SIGNUPS_COLUMNS.PLAYER_ID] || '';
  const checklist: OutreachChecklist = {
    finalForms: isFinalFormsComplete(finalForms),
    playerInfo: isPlayerInfoComplete(record),
    photo: isPhotoComplete(record),
    caretakerInfo: isCaretakerInfoComplete(record),
    coachVolunteering: isCoachVolunteeringComplete(record),
    otherVolunteering: isOtherVolunteeringComplete(record),
  };

  const caretakers = collectAddresses(record, [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL, SIGNUPS_COLUMNS.CARETAKER_2_EMAIL]);
  // Student Personal Email only; the SPS address is never a recipient (it is not the family's).
  const student = collectAddresses(record, [SIGNUPS_COLUMNS.STUDENT_PERSONAL_EMAIL]);
  const to = caretakers.emails;
  const cc = student.emails.filter(e => !to.includes(e));
  const warnings = [...caretakers.invalid, ...student.invalid].map(w => `${w.column} is not a valid address: "${w.value}"`);
  const unreachableReason: UnreachableReason | null =
    to.length > 0 ? null : caretakers.invalid.length > 0 ? 'caretaker emails invalid' : 'no caretaker email';

  return {
    playerId,
    preferredName,
    lastName,
    fullName: `${preferredName} ${lastName}`.trim(),
    caretaker1Name: (record[SIGNUPS_COLUMNS.CARETAKER_1_NAME] || '').trim(),
    caretaker2Name: (record[SIGNUPS_COLUMNS.CARETAKER_2_NAME] || '').trim(),
    seeded: Boolean(record[SIGNUPS_COLUMNS.SEEDED_AT]),
    portalUrl: `${baseUrl.replace(/\/$/, '')}/player/${playerId}`,
    checklist,
    checklistComplete: Object.values(checklist).every(Boolean),
    finalFormsDetail: {
      found: Boolean(finalForms?.found),
      parentSigned: Boolean(finalForms?.found && finalForms.parentSigned),
      studentSigned: Boolean(finalForms?.found && finalForms.studentSigned),
      physicalCleared: Boolean(finalForms?.found && finalForms.physicalCleared),
    },
    to,
    cc,
    warnings,
    unreachableReason,
  };
}

export type SkipReason = 'already Checklist Complete' | UnreachableReason;

export interface AudienceSelection {
  /** Every entry here is not Checklist Complete and has somewhere to send. */
  selected: OutreachEntry[];
  /** Explicitly named entries that get no draft, with why. Always empty for the default audience. */
  skipped: { line: string; playerId: string; reason: SkipReason }[];
}

/**
 * Who gets a draft. With no lines: every reachable entry not Checklist Complete (an Outreach
 * Wave). With lines: each is a PlayerID or a Full Name, matched exactly after trimming; a line
 * that matches nothing or more than one row throws, before any draft is created. A named entry
 * that is Checklist Complete or unreachable is reported in `skipped` rather than selected.
 */
export function selectAudience(entries: OutreachEntry[], lines?: string[]): AudienceSelection {
  if (!lines) {
    return { selected: entries.filter(e => !e.checklistComplete && e.unreachableReason === null), skipped: [] };
  }
  const selected: OutreachEntry[] = [];
  const skipped: AudienceSelection['skipped'] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const byId = entries.filter(e => e.playerId === line);
    const matches = byId.length > 0 ? byId : entries.filter(e => e.fullName === line);
    if (matches.length === 0) throw new Error(`No signup matches "${line}"`);
    if (matches.length > 1) {
      throw new Error(`"${line}" matches ${matches.length} signups (${matches.map(e => e.playerId).join(', ')}); use the PlayerID`);
    }
    const entry = matches[0];
    if (entry.checklistComplete) skipped.push({ line, playerId: entry.playerId, reason: 'already Checklist Complete' });
    else if (entry.unreachableReason) skipped.push({ line, playerId: entry.playerId, reason: entry.unreachableReason });
    else if (!selected.includes(entry)) selected.push(entry);
  }
  return { selected, skipped };
}

/** Not Checklist Complete first, then last name, then preferred name. Does not mutate. */
export function sortForDisplay(entries: OutreachEntry[]): OutreachEntry[] {
  return [...entries].sort(
    (a, b) =>
      Number(a.checklistComplete) - Number(b.checklistComplete) ||
      a.lastName.localeCompare(b.lastName) ||
      a.preferredName.localeCompare(b.preferredName)
  );
}
