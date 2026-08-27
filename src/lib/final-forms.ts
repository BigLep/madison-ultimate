// Final Forms data for the signup dashboard: reads the newest export CSV from Drive
// (SHEET_CONFIG.SPS_FINAL_FORMS_FOLDER_ID) and joins it to a signup row, per
// docs/adr/0002-signups-sheet-as-season-intake.md. Final Forms Status is always read live
// (never copied); Seeded Fields are offered once and then owned by the signup row.
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
import { SignupRecord } from './signups-sheet';
import { SIGNUPS_COLUMNS } from './signups-config';

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

export interface FinalFormsJoinResult {
  record: FinalFormsRecord;
  dataAsOf: string;
}

/**
 * Join a signup row to its Final Forms record. If the row already has an SPS Student ID,
 * that match is authoritative. Otherwise, match on normalized last name + birthdate,
 * disambiguated by legal first name (twins); ambiguous matches return null rather than
 * guessing.
 */
export async function findFinalFormsMatch(signup: SignupRecord): Promise<FinalFormsJoinResult | null> {
  const snapshot = await loadSnapshot();
  if (!snapshot) return null;

  const existingStudentId = signup[SIGNUPS_COLUMNS.SPS_STUDENT_ID];
  if (existingStudentId) {
    const record = snapshot.records.find(r => r.studentId === existingStudentId);
    return record ? { record, dataAsOf: snapshot.fileTimestamp } : null;
  }

  const queryLast = normalizeName(signup[SIGNUPS_COLUMNS.LAST_NAME]);
  const queryDob = normalizeDateOfBirth(signup[SIGNUPS_COLUMNS.DATE_OF_BIRTH]);
  if (!queryLast || !queryDob) return null;

  const candidates = snapshot.records.filter(
    r => normalizeName(r.lastName) === queryLast && normalizeDateOfBirth(r.dateOfBirth) === queryDob
  );

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return { record: candidates[0], dataAsOf: snapshot.fileTimestamp };

  // Disambiguate twins by legal first name (falls back to preferred first name if none given).
  const legalFirst = normalizeName(signup[SIGNUPS_COLUMNS.LEGAL_FIRST_NAME] || signup[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]);
  const exact = candidates.find(r => normalizeName(r.legalFirstName) === legalFirst);
  return exact ? { record: exact, dataAsOf: snapshot.fileTimestamp } : null;
}

/** Seeded fields (grade, student email/phone, caretaker names/emails/phones) offered once per ADR 0002. */
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
