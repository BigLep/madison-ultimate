// Final Forms data for the signup dashboard: reads the newest export CSV from Drive
// (SHEET_CONFIG.SPS_FINAL_FORMS_FOLDER_ID) and joins it to a signup row, per
// docs/adr/0002-signups-sheet-as-season-intake.md. Final Forms Status is always read live
// (never copied); Seeded Fields are copied into empty signup-row cells on first join and then
// owned by the signup row.
//
// Header names are matched by fuzzy substring (like parseQuestionnaireData in
// data-processing.ts) rather than exact string or position, because the real "students
// basic" export's header row has not been verified against this code yet. Any expected
// column that isn't found is logged and treated as absent (graceful, never a hard crash);
// see docs/fall-2026/signup-plan.md section 6 for the documented column layout to verify
// against once a real export is available.

import { getMostRecentFileInfoFromFolder, downloadCsvFromDrive } from './google-api';
import { SHEET_CONFIG } from './sheet-config';
import { parseCsvString } from './data-processing';
import { normalizeName, normalizeDateOfBirth } from './player-identity';
import { SignupRecord, UpdateSignupRowOptions, updateSignupRow, createSignupRow, recomputeProfileCompleteForAllRows } from './signups-sheet';
import { SIGNUPS_COLUMNS } from './signups-config';
import { findTestFixture } from './final-forms-test-fixtures';
import { carryOverPhotoFromLastSeason } from './photo-carryover';
import { eligibleMailingEmails } from './mailing-eligibility';
import { subscribeUnlessUnsubscribed, getSubscriberStatus } from './buttondown-api';

export interface FinalFormsRecord {
  studentId: string;
  firstName: string;
  lastName: string;
  legalFirstName: string; // Final Forms' own first name field, used only to disambiguate the join
  dateOfBirth: string;
  grade: string;
  parentSigned: boolean;
  studentSigned: boolean;
  physicalCleared: boolean;
  physicalClearanceExpiration: string;
  studentEmail: string;
  studentCellPhone: string;
  parent1Name: string;
  parent1Email: string;
  parent1Phone: string;
  parent2Name: string;
  parent2Email: string;
  parent2Phone: string;
}

interface FinalFormsSnapshot {
  records: FinalFormsRecord[];
  fetchedAt: number; // ms, when we downloaded this snapshot
  fileTimestamp: string; // timestamp embedded in the export's filename ("data as of")
}

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes; short because the refresh button (C3/C4) expects near-live reads
let cache: FinalFormsSnapshot | null = null;

/** Drop the in-memory snapshot so the next join reloads from Drive (or a test mock). */
export function clearFinalFormsCache(): void {
  cache = null;
}

function findHeaderIndex(headers: string[], ...substrings: string[]): number {
  const lower = headers.map(h => h.toLowerCase());
  for (const substring of substrings) {
    const index = lower.findIndex(h => h.includes(substring));
    if (index !== -1) return index;
  }
  return -1;
}

function cell(row: string[], index: number): string {
  return index === -1 ? '' : (row[index] || '').toString().trim();
}

function parseFinalFormsCsv(rows: string[][]): FinalFormsRecord[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => (h || '').toString().trim());

  const idx = {
    studentId: findHeaderIndex(headers, 'student id', 'studentid'),
    firstName: findHeaderIndex(headers, 'first name'),
    lastName: findHeaderIndex(headers, 'last name'),
    dateOfBirth: findHeaderIndex(headers, 'date of birth', 'birth date', 'dob'),
    grade: findHeaderIndex(headers, 'grade'),
    parentSigned: findHeaderIndex(headers, 'parent signed'),
    studentSigned: findHeaderIndex(headers, 'student signed'),
    physicalCleared: findHeaderIndex(headers, 'physical clearance', 'physical cleared'),
    physicalExpiration: findHeaderIndex(headers, 'physical expiration', 'clearance expiration', 'physical exam expiration'),
    studentEmail: findHeaderIndex(headers, 'email'),
    studentCellPhone: findHeaderIndex(headers, 'cell phone'),
    parent1FirstName: findHeaderIndex(headers, 'parent 1 first name'),
    parent1LastName: findHeaderIndex(headers, 'parent 1 last name'),
    parent1Email: findHeaderIndex(headers, 'parent 1 email'),
    parent1CellPhone: findHeaderIndex(headers, 'parent 1 cell phone'),
    parent1HomePhone: findHeaderIndex(headers, 'parent 1 home phone'),
    parent1WorkPhone: findHeaderIndex(headers, 'parent 1 work phone'),
    parent2FirstName: findHeaderIndex(headers, 'parent 2 first name'),
    parent2LastName: findHeaderIndex(headers, 'parent 2 last name'),
    parent2Email: findHeaderIndex(headers, 'parent 2 email'),
    parent2CellPhone: findHeaderIndex(headers, 'parent 2 cell phone'),
    parent2HomePhone: findHeaderIndex(headers, 'parent 2 home phone'),
    parent2WorkPhone: findHeaderIndex(headers, 'parent 2 work phone'),
  };

  const missing = Object.entries(idx)
    .filter(([, i]) => i === -1)
    .map(([key]) => key);
  if (missing.length > 0) {
    console.warn('[final-forms] columns not found in export header row (will be treated as absent):', missing.join(', '));
  }

  const dataRows = rows.slice(1).filter(row => row.some(c => (c || '').toString().trim() !== ''));

  return dataRows.map(row => ({
    studentId: cell(row, idx.studentId),
    firstName: cell(row, idx.firstName),
    lastName: cell(row, idx.lastName),
    legalFirstName: cell(row, idx.firstName),
    dateOfBirth: cell(row, idx.dateOfBirth),
    grade: cell(row, idx.grade),
    parentSigned: cell(row, idx.parentSigned).toLowerCase() === 'true',
    studentSigned: cell(row, idx.studentSigned).toLowerCase() === 'true',
    physicalCleared: cell(row, idx.physicalCleared).toLowerCase() === 'cleared',
    physicalClearanceExpiration: cell(row, idx.physicalExpiration),
    studentEmail: cell(row, idx.studentEmail),
    studentCellPhone: cell(row, idx.studentCellPhone),
    parent1Name: [cell(row, idx.parent1FirstName), cell(row, idx.parent1LastName)].filter(Boolean).join(' '),
    parent1Email: cell(row, idx.parent1Email),
    parent1Phone: cell(row, idx.parent1CellPhone) || cell(row, idx.parent1HomePhone) || cell(row, idx.parent1WorkPhone),
    parent2Name: [cell(row, idx.parent2FirstName), cell(row, idx.parent2LastName)].filter(Boolean).join(' '),
    parent2Email: cell(row, idx.parent2Email),
    parent2Phone: cell(row, idx.parent2CellPhone) || cell(row, idx.parent2HomePhone) || cell(row, idx.parent2WorkPhone),
  }));
}

async function loadSnapshot(): Promise<FinalFormsSnapshot | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  const folderId = SHEET_CONFIG.SPS_FINAL_FORMS_FOLDER_ID;
  if (!folderId) {
    console.error('SPS_FINAL_FORMS_FOLDER_ID is not set');
    return null;
  }

  const fileInfo = await getMostRecentFileInfoFromFolder(folderId);
  if (!fileInfo) return null;

  const csvContent = await downloadCsvFromDrive(fileInfo.id);
  if (!csvContent) return null;

  const rawRows = await parseCsvString(csvContent);
  // parseCsvString (csv-parser) already applies the header row; reconstruct a plain rows array using its own keys.
  const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
  const rows = [headers, ...rawRows.map(r => headers.map(h => (r[h] ?? '').toString()))];

  cache = {
    records: parseFinalFormsCsv(rows),
    fetchedAt: Date.now(),
    fileTimestamp: fileInfo.timestamp || fileInfo.name,
  };
  return cache;
}

/** Shared "data as of" for every magic-name fixture, including TestNotFound. */
export const FINAL_FORMS_FIXTURE_DATA_AS_OF = '2026-08-28T05:15:11Z';

export interface FinalFormsJoinResult {
  record: FinalFormsRecord;
  dataAsOf: string;
  isTest?: boolean; // from a magic-name test fixture (final-forms-test-fixtures.ts); never write spsStudentId back for these
}

/**
 * Outcome of matching a signup row against the Final Forms export by name + birthdate alone
 * (never consulting an existing SPS Student ID). Distinguishes "found nothing" from "found
 * twins we couldn't tell apart" so Final Forms Backfill can report an Ambiguous Match
 * separately from an unmatched row; findFinalFormsMatch collapses both back to null since the
 * per-player join has never needed the distinction.
 */
export type NameDobMatchOutcome =
  | { kind: 'matched'; match: FinalFormsJoinResult }
  | { kind: 'no-candidate' }
  | { kind: 'ambiguous'; candidateCount: number };

function matchByNameAndDob(signup: SignupRecord, snapshot: FinalFormsSnapshot): NameDobMatchOutcome {
  const queryLast = normalizeName(signup[SIGNUPS_COLUMNS.LAST_NAME]);
  const queryDob = normalizeDateOfBirth(signup[SIGNUPS_COLUMNS.DATE_OF_BIRTH]);
  if (!queryLast || !queryDob) return { kind: 'no-candidate' };

  const candidates = snapshot.records.filter(
    r => normalizeName(r.lastName) === queryLast && normalizeDateOfBirth(r.dateOfBirth) === queryDob
  );

  if (candidates.length === 0) return { kind: 'no-candidate' };

  // Disambiguate twins by legal first name (falls back to preferred first name if none given).
  const legalFirst = normalizeName(signup[SIGNUPS_COLUMNS.LEGAL_FIRST_NAME] || signup[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]);

  if (candidates.length === 1) {
    // A single Final Forms record sharing last name + birthdate does not mean this signup is
    // that person: a twin's own record can simply not have synced into the export yet, and the
    // sibling's record left alone in the group looks identical to an only child (this is exactly
    // how the Wilcox mismatch happened - Zoë's signup was joined to her twin brother Caleb's
    // Final Forms record because his was the only Wilcox record in the export at the time). Only
    // skip the name check when the signup has not given us a name to check against yet.
    const candidateFirst = normalizeName(candidates[0].legalFirstName);
    if (!legalFirst || !candidateFirst || legalFirst[0] === candidateFirst[0]) {
      return { kind: 'matched', match: { record: candidates[0], dataAsOf: snapshot.fileTimestamp } };
    }
    return { kind: 'ambiguous', candidateCount: candidates.length };
  }

  const exact = candidates.find(r => normalizeName(r.legalFirstName) === legalFirst);
  return exact
    ? { kind: 'matched', match: { record: exact, dataAsOf: snapshot.fileTimestamp } }
    : { kind: 'ambiguous', candidateCount: candidates.length };
}

/** A same-last-name Final Forms record found while ignoring birthdate, surfaced on an unmatched
 *  Final Forms Backfill row so a human can tell whether the row's Date of Birth is simply wrong
 *  (the usual case) rather than genuinely finding no one. Never used to join automatically.
 *  dateOfBirth is normalized to YYYY-MM-DD (same shape the signup row stores) so the two can be
 *  compared and pasted straight back into the sheet without reformatting. */
export interface PossibleMatch {
  studentId: string;
  firstName: string;
  dateOfBirth: string;
}

function possibleMatchesByLastNameOnly(signup: SignupRecord, snapshot: { records: FinalFormsRecord[] }): PossibleMatch[] {
  const queryLast = normalizeName(signup[SIGNUPS_COLUMNS.LAST_NAME]);
  if (!queryLast) return [];
  return snapshot.records
    .filter(r => normalizeName(r.lastName) === queryLast)
    .map(r => ({ studentId: r.studentId, firstName: r.firstName, dateOfBirth: normalizeDateOfBirth(r.dateOfBirth) }));
}

/**
 * Join a signup row to its Final Forms record. If the row already has an SPS Student ID,
 * that match is authoritative. Otherwise, match on normalized last name + birthdate,
 * disambiguated by legal first name (twins); ambiguous matches return null rather than
 * guessing.
 */
export async function findFinalFormsMatch(signup: SignupRecord): Promise<FinalFormsJoinResult | null> {
  const fixture = findTestFixture(signup[SIGNUPS_COLUMNS.LAST_NAME]);
  if (fixture !== undefined) {
    return fixture ? { record: fixture, dataAsOf: FINAL_FORMS_FIXTURE_DATA_AS_OF, isTest: true } : null;
  }

  const snapshot = await loadSnapshot();
  if (!snapshot) return null;

  const existingStudentId = signup[SIGNUPS_COLUMNS.SPS_STUDENT_ID];
  if (existingStudentId) {
    const record = snapshot.records.find(r => r.studentId === existingStudentId);
    return record ? { record, dataAsOf: snapshot.fileTimestamp } : null;
  }

  const outcome = matchByNameAndDob(signup, snapshot);
  return outcome.kind === 'matched' ? outcome.match : null;
}

/**
 * Export timestamp even when the player has no join. Used by the not-found dashboard
 * so a family can see how stale our copy is and request a refresh (same C3 stamp as found).
 */
export async function getFinalFormsDataAsOf(signup: SignupRecord): Promise<string | undefined> {
  const fixture = findTestFixture(signup[SIGNUPS_COLUMNS.LAST_NAME]);
  if (fixture !== undefined) return FINAL_FORMS_FIXTURE_DATA_AS_OF;
  const snapshot = await loadSnapshot();
  return snapshot?.fileTimestamp;
}

/** Seeded fields (grade, student email/phone, caretaker names/emails/phones) copied into empty signup-row cells on first join per ADR 0004. */
export function seededFieldsFromFinalForms(finalForms: FinalFormsRecord) {
  const isSpsEmail = finalForms.studentEmail.toLowerCase().endsWith('@seattleschools.org');
  return {
    grade: finalForms.grade || undefined,
    studentPersonalEmail: !isSpsEmail ? finalForms.studentEmail || undefined : undefined,
    studentSpsEmail: isSpsEmail ? finalForms.studentEmail || undefined : undefined,
    studentCellPhone: finalForms.studentCellPhone || undefined,
    caretaker1Name: finalForms.parent1Name || undefined,
    caretaker1Email: finalForms.parent1Email || undefined,
    caretaker1Phone: finalForms.parent1Phone || undefined,
    caretaker2Name: finalForms.parent2Name || undefined,
    caretaker2Email: finalForms.parent2Email || undefined,
    caretaker2Phone: finalForms.parent2Phone || undefined,
  };
}

/**
 * Signup-row column each seededFieldsFromFinalForms() key copies into. Kept beside that
 * function (rather than redeclared at each call site) so the field list only exists once;
 * TypeScript's Record<keyof ..., string> still catches drift if a field is ever added to one
 * without the other.
 */
export const SEEDABLE_FIELD_COLUMNS: Record<keyof ReturnType<typeof seededFieldsFromFinalForms>, string> = {
  grade: SIGNUPS_COLUMNS.GRADE,
  studentPersonalEmail: SIGNUPS_COLUMNS.STUDENT_PERSONAL_EMAIL,
  studentSpsEmail: SIGNUPS_COLUMNS.STUDENT_SPS_EMAIL,
  studentCellPhone: SIGNUPS_COLUMNS.STUDENT_CELL_PHONE,
  caretaker1Name: SIGNUPS_COLUMNS.CARETAKER_1_NAME,
  caretaker1Email: SIGNUPS_COLUMNS.CARETAKER_1_EMAIL,
  caretaker1Phone: SIGNUPS_COLUMNS.CARETAKER_1_PHONE,
  caretaker2Name: SIGNUPS_COLUMNS.CARETAKER_2_NAME,
  caretaker2Email: SIGNUPS_COLUMNS.CARETAKER_2_EMAIL,
  caretaker2Phone: SIGNUPS_COLUMNS.CARETAKER_2_PHONE,
};

export interface FirstJoinOutcome {
  fieldsCopied: boolean;
  photoCarriedOver: boolean;
  subscribedEmails: string[];
  /** Eligible emails the newsletter did not take: the status lookup or the subscribe call failed (Buttondown down, key rejected). */
  subscribeFailed: string[];
}

/**
 * Everything that happens exactly once, on the first successful Final Forms join for a signup
 * row (ADR 0004: write spsStudentId, carry over last season's photo per ADR 0003, copy empty
 * Seeded Fields, auto-subscribe eligible emails), all in the same write. Pulled out of the
 * finalforms route so that one handler isn't the only place these four related concerns meet;
 * the route just calls this and shapes the response.
 */
export async function applyFirstJoinSideEffects(
  playerId: string,
  existing: SignupRecord,
  match: FinalFormsJoinResult,
  ipAddress?: string,
  options?: UpdateSignupRowOptions
): Promise<FirstJoinOutcome> {
  const allSeeded = seededFieldsFromFinalForms(match.record);

  // Real joins are marked by spsStudentId. Magic-name fixtures never write spsStudentId, so
  // "no seed column has a value yet" stands in for "first join" in that case.
  const isFirstRealJoin =
    !match.isTest && !existing[SIGNUPS_COLUMNS.SPS_STUDENT_ID] && Boolean(match.record.studentId);
  const isFirstFixtureJoin =
    Boolean(match.isTest) && Object.values(SEEDABLE_FIELD_COLUMNS).every(column => !existing[column]);
  const isFirstJoin = isFirstRealJoin || isFirstFixtureJoin;

  let photoCarriedOver = false;
  const updates: Record<string, string> = {};
  if (isFirstRealJoin) {
    updates[SIGNUPS_COLUMNS.SPS_STUDENT_ID] = match.record.studentId;

    // Photo Carryover (ADR 0003): a fresh match to a returning player is the one moment we know
    // both their Fall 2025 identity and that this is a first-time join, so it's the natural
    // hook for bringing their old photo forward. Never overwrites a photo the family already
    // set this season; failures here must never break Final Forms status display.
    if (!existing[SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]) {
      try {
        const carriedPhotoFileId = await carryOverPhotoFromLastSeason(playerId, match.record.studentId);
        if (carriedPhotoFileId) {
          updates[SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID] = carriedPhotoFileId;
          photoCarriedOver = true;
        }
      } catch (error) {
        console.error('Error carrying over last season\'s photo:', error);
      }
    }
  }

  let fieldsCopied = false;
  if (isFirstJoin) {
    for (const [field, value] of Object.entries(allSeeded)) {
      const column = SEEDABLE_FIELD_COLUMNS[field as keyof typeof allSeeded];
      if (value && !existing[column]) {
        updates[column] = value;
        fieldsCopied = true;
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    if (options) await updateSignupRow(playerId, updates, options);
    else await updateSignupRow(playerId, updates);
  }

  // First real join also subscribes eligible emails now on the row (copied or already saved),
  // unless they have opted out. Magic-name fixtures never hit the real list.
  // subscribedEmails reports only emails that were newly added (status was 'absent' before this
  // call and the subscribe call succeeded), never one already on the list (e.g. a coach who's a
  // caretaker too) and never one whose subscribe attempt failed, so a Final Forms Backfill report
  // can't misrepresent who was actually just added to the mailing list.
  let subscribedEmails: string[] = [];
  let subscribeFailed: string[] = [];
  if (isFirstRealJoin) {
    const merged = { ...existing, ...updates };
    const eligible = eligibleMailingEmails(merged);
    const wasAbsent = await Promise.all(eligible.map(entry => getSubscriberStatus(entry.email)));
    const succeeded = await Promise.all(
      eligible.map(entry => subscribeUnlessUnsubscribed(entry.email, ipAddress))
    );
    subscribedEmails = eligible
      .filter((_, i) => wasAbsent[i] === 'absent' && succeeded[i])
      .map(entry => entry.email);
    // A null status means the lookup itself failed; subscribeUnlessUnsubscribed then returns
    // false too. Either way the address is not on the list and someone should know.
    subscribeFailed = eligible
      .filter((_, i) => wasAbsent[i] === null || (wasAbsent[i] === 'absent' && !succeeded[i]))
      .map(entry => entry.email);
  }

  return { fieldsCopied, photoCarriedOver, subscribedEmails, subscribeFailed };
}

/**
 * Seed Signups from Final Forms (ADR 0006). The plan is pure so Preview is exactly Apply minus
 * the writes, and so every last-name-plus-birthdate group rule can be unit-tested without Drive.
 *
 * Both sides are grouped by normalized last name plus birthdate. Per group, seeding never creates
 * a row where a human still has to decide: twins the legal first name cannot tell apart, several
 * unjoined signups for one student, or a row already joined to a different SPS Student ID all
 * become report entries instead.
 */
export type ReconciliationEntry =
  | { kind: 'skip'; record: FinalFormsRecord; playerId: string }
  | { kind: 'join'; record: FinalFormsRecord; playerId: string; signup: SignupRecord }
  | { kind: 'seed'; record: FinalFormsRecord }
  | { kind: 'ambiguous'; records: FinalFormsRecord[]; playerIds: string[] }
  | { kind: 'duplicate-signups'; record: FinalFormsRecord; playerIds: string[]; joinedPlayerId?: string }
  | { kind: 'discrepancy'; record: FinalFormsRecord; playerId: string; storedStudentId: string }
  | { kind: 'unseedable'; record: FinalFormsRecord; reason: string }
  | { kind: 'unmatched-signup'; playerId: string; signup: SignupRecord; possibleMatches: PossibleMatch[] };

export interface ReconciliationPlan {
  entries: ReconciliationEntry[];
  dataAsOf: string;
}

function groupKey(lastName: string, dateOfBirth: string): string | null {
  const last = normalizeName(lastName);
  const dob = normalizeDateOfBirth(dateOfBirth);
  return last && dob ? `${last}|${dob}` : null;
}

function pushTo<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function planFinalFormsReconciliation(
  signups: SignupRecord[],
  snapshot: { records: FinalFormsRecord[]; fileTimestamp: string }
): ReconciliationPlan {
  const entries: ReconciliationEntry[] = [];

  const joinedByStudentId = new Map<string, SignupRecord>();
  const joinedByKey = new Map<string, SignupRecord[]>();
  const unjoinedByKey = new Map<string, SignupRecord[]>();
  for (const signup of signups) {
    if (!signup[SIGNUPS_COLUMNS.PLAYER_ID]) continue;
    const studentId = (signup[SIGNUPS_COLUMNS.SPS_STUDENT_ID] || '').trim();
    const key = groupKey(signup[SIGNUPS_COLUMNS.LAST_NAME], signup[SIGNUPS_COLUMNS.DATE_OF_BIRTH]);
    if (studentId) {
      joinedByStudentId.set(studentId, signup);
      if (key) pushTo(joinedByKey, key, signup);
    } else if (key) {
      pushTo(unjoinedByKey, key, signup);
    }
  }

  const recordsByKey = new Map<string, FinalFormsRecord[]>();
  for (const record of snapshot.records) {
    if (!record.studentId.trim()) {
      entries.push({ kind: 'unseedable', record, reason: 'no SPS Student ID in Final Forms' });
      continue;
    }
    const key = groupKey(record.lastName, record.dateOfBirth);
    if (!key) {
      entries.push({
        kind: 'unseedable',
        record,
        reason: !record.lastName.trim() ? 'no last name in Final Forms' : 'no usable birthdate in Final Forms',
      });
      continue;
    }
    pushTo(recordsByKey, key, record);
  }

  for (const [key, group] of recordsByKey) {
    const groupIds = new Set(group.map(r => r.studentId));
    const remaining: FinalFormsRecord[] = [];
    for (const record of group) {
      const joined = joinedByStudentId.get(record.studentId);
      if (joined) entries.push({ kind: 'skip', record, playerId: joined[SIGNUPS_COLUMNS.PLAYER_ID] });
      else remaining.push(record);
    }
    // Rows in this group already joined to an ID outside the group (the old Backfill's
    // already-joined-discrepancy): a human has to look, so nothing in the group is joined or
    // seeded. Reported even when every record here is already claimed by ID.
    const foreignJoined = (joinedByKey.get(key) || []).filter(
      row => !groupIds.has((row[SIGNUPS_COLUMNS.SPS_STUDENT_ID] || '').trim())
    );
    if (foreignJoined.length > 0) {
      for (const row of foreignJoined) {
        for (const record of remaining.length > 0 ? remaining : [group[0]]) {
          entries.push({
            kind: 'discrepancy',
            record,
            playerId: row[SIGNUPS_COLUMNS.PLAYER_ID],
            storedStudentId: (row[SIGNUPS_COLUMNS.SPS_STUDENT_ID] || '').trim(),
          });
        }
      }
      continue;
    }
    // Twins where a row is joined to one twin but its first name (legal, else preferred) names
    // the other: the per-player join matched before both twins were in the export, and seeding
    // the "free" twin now would duplicate the row that is really theirs. Report, write nothing.
    if (group.length > 1) {
      const wrongTwin = (joinedByKey.get(key) || []).find(row => {
        const storedId = (row[SIGNUPS_COLUMNS.SPS_STUDENT_ID] || '').trim();
        const first = normalizeName(row[SIGNUPS_COLUMNS.LEGAL_FIRST_NAME] || row[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]);
        const named = group.filter(r => normalizeName(r.legalFirstName) === first);
        return named.length === 1 && named[0].studentId !== storedId;
      });
      if (wrongTwin) {
        for (const record of remaining.length > 0 ? remaining : [group[0]]) {
          entries.push({
            kind: 'discrepancy',
            record,
            playerId: wrongTwin[SIGNUPS_COLUMNS.PLAYER_ID],
            storedStudentId: (wrongTwin[SIGNUPS_COLUMNS.SPS_STUDENT_ID] || '').trim(),
          });
        }
        continue;
      }
    }
    const unjoined = unjoinedByKey.get(key) || [];

    // Every record here is already claimed by ID, yet an unjoined row shares the group's last
    // name and birthdate: a family row created after the seed, or a birthdate fixed after it.
    // Report it as a suspected duplicate of the joined row rather than dropping it silently.
    if (remaining.length === 0) {
      for (const signup of unjoined) {
        const first = normalizeName(signup[SIGNUPS_COLUMNS.LEGAL_FIRST_NAME] || signup[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]);
        const named = group.filter(r => normalizeName(r.legalFirstName) === first);
        const record = group.length === 1 ? group[0] : named.length === 1 ? named[0] : group[0];
        const joinedPlayerId = joinedByStudentId.get(record.studentId)![SIGNUPS_COLUMNS.PLAYER_ID];
        entries.push({
          kind: 'duplicate-signups',
          record,
          playerIds: [joinedPlayerId, signup[SIGNUPS_COLUMNS.PLAYER_ID]],
          joinedPlayerId,
        });
      }
      continue;
    }

    if (group.length === 1) {
      const record = remaining[0];
      if (unjoined.length === 0) entries.push({ kind: 'seed', record });
      else if (unjoined.length === 1) {
        entries.push({ kind: 'join', record, playerId: unjoined[0][SIGNUPS_COLUMNS.PLAYER_ID], signup: unjoined[0] });
      } else {
        entries.push({ kind: 'duplicate-signups', record, playerIds: unjoined.map(u => u[SIGNUPS_COLUMNS.PLAYER_ID]) });
      }
      continue;
    }

    // Twins: every unjoined signup must resolve by legal first name (falling back to preferred,
    // exactly as the per-player join does) to a distinct, still-unjoined record.
    const claimed = new Map<string, SignupRecord>();
    let ambiguous = false;
    for (const signup of unjoined) {
      const legalFirst = normalizeName(signup[SIGNUPS_COLUMNS.LEGAL_FIRST_NAME] || signup[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]);
      const matches = group.filter(r => normalizeName(r.legalFirstName) === legalFirst);
      const match = matches.length === 1 ? matches[0] : undefined;
      if (!match || !remaining.includes(match) || claimed.has(match.studentId)) {
        ambiguous = true;
        break;
      }
      claimed.set(match.studentId, signup);
    }
    if (ambiguous) {
      entries.push({ kind: 'ambiguous', records: remaining, playerIds: unjoined.map(u => u[SIGNUPS_COLUMNS.PLAYER_ID]) });
      continue;
    }
    for (const record of remaining) {
      const signup = claimed.get(record.studentId);
      if (signup) entries.push({ kind: 'join', record, playerId: signup[SIGNUPS_COLUMNS.PLAYER_ID], signup });
      else entries.push({ kind: 'seed', record });
    }
  }

  // Unjoined signups no Final Forms record shares a group with: the old Backfill's "still
  // unmatched" list, with Possible Matches so a wrong birthdate on either side is easy to spot.
  for (const [key, group] of unjoinedByKey) {
    if (recordsByKey.has(key)) continue;
    for (const signup of group) {
      entries.push({
        kind: 'unmatched-signup',
        playerId: signup[SIGNUPS_COLUMNS.PLAYER_ID],
        signup,
        possibleMatches: possibleMatchesByLastNameOnly(signup, snapshot),
      });
    }
  }

  const sortKey = (e: ReconciliationEntry): string => {
    if (e.kind === 'unmatched-signup') {
      return `${normalizeName(e.signup[SIGNUPS_COLUMNS.LAST_NAME])}|${normalizeName(e.signup[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME])}`;
    }
    const r = 'record' in e ? e.record : e.records[0];
    return `${normalizeName(r.lastName)}|${normalizeName(r.firstName)}`;
  };
  entries.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  return { entries, dataAsOf: snapshot.fileTimestamp };
}

/** Load the newest export and plan against the given rows; null when the export is unavailable. */
export async function previewFinalFormsReconciliation(signups: SignupRecord[]): Promise<ReconciliationPlan | null> {
  const snapshot = await loadSnapshot();
  if (!snapshot) return null;
  return planFinalFormsReconciliation(signups, snapshot);
}

/** One row the run wrote to, whether by seeding it or joining it. */
export interface AppliedRowOutcome {
  playerId: string;
  studentId: string;
  firstJoin: FirstJoinOutcome;
}

/**
 * Create a Seeded Signup: identity from Final Forms (Preferred First Name equal to the legal
 * first name, Legal First Name blank), Seeded At, then the very same first-join write the portal
 * performs for a family-created row, on a row whose cells are all still empty (ADR 0004 amended
 * by ADR 0006). Two writes, no new join code.
 */
export async function seedSignupFromFinalForms(record: FinalFormsRecord, dataAsOf: string): Promise<AppliedRowOutcome> {
  const now = new Date().toISOString();
  const created = await createSignupRow({
    [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: record.firstName.trim(),
    [SIGNUPS_COLUMNS.LAST_NAME]: record.lastName.trim(),
    [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: normalizeDateOfBirth(record.dateOfBirth) || record.dateOfBirth.trim(),
    [SIGNUPS_COLUMNS.CREATED_AT]: now,
    [SIGNUPS_COLUMNS.SEEDED_AT]: now,
  });
  const playerId = created[SIGNUPS_COLUMNS.PLAYER_ID];
  // The second write is still the seed doing its work, so Updated At stays equal to Seeded At.
  const firstJoin = await applyFirstJoinSideEffects(playerId, created, { record, dataAsOf }, undefined, { touchUpdatedAt: false });
  return { playerId, studentId: record.studentId, firstJoin };
}

export interface ReconciliationReport {
  seeded: AppliedRowOutcome[];
  joined: AppliedRowOutcome[];
  recomputedProfileComplete: number;
}

/** Apply a plan: joins, then seeds, then the Profile Complete recompute over every row. */
export async function applyFinalFormsReconciliation(plan: ReconciliationPlan): Promise<ReconciliationReport> {
  const report: ReconciliationReport = { seeded: [], joined: [], recomputedProfileComplete: 0 };

  for (const entry of plan.entries) {
    if (entry.kind === 'join') {
      const firstJoin = await applyFirstJoinSideEffects(entry.playerId, entry.signup, {
        record: entry.record,
        dataAsOf: plan.dataAsOf,
      });
      report.joined.push({ playerId: entry.playerId, studentId: entry.record.studentId, firstJoin });
    }
  }
  for (const entry of plan.entries) {
    if (entry.kind === 'seed') {
      report.seeded.push(await seedSignupFromFinalForms(entry.record, plan.dataAsOf));
    }
  }

  report.recomputedProfileComplete = await recomputeProfileCompleteForAllRows();
  return report;
}
