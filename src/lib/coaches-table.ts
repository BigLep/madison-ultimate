// Pure parsing and row-building for the Coaches tab (CONTEXT.md: Coach, CoachID). Columns are
// found by header name, never by position (AGENTS.md). I/O lives in coaches-sheet.ts.

import { COACH_COLUMN_NAMES } from './sheet-config';

export interface Coach {
  coachId: string;
  name: string;
  email: string;
  phone: string;
  /** Markdown */
  about: string;
  photoDriveFileId: string;
  /** 1-based sheet row */
  rowNumber: number;
}

/** The fields a coach can edit about themselves on Coach Home. */
export type EditableCoachFields = Partial<Pick<Coach, 'name' | 'email' | 'phone' | 'about' | 'photoDriveFileId'>>;

const FIELD_TO_HEADER: Record<keyof EditableCoachFields, string> = {
  name: COACH_COLUMN_NAMES.NAME,
  email: COACH_COLUMN_NAMES.EMAIL,
  phone: COACH_COLUMN_NAMES.PHONE,
  about: COACH_COLUMN_NAMES.ABOUT,
  photoDriveFileId: COACH_COLUMN_NAMES.PHOTO_DRIVE_FILE_ID,
};

function headerIndexes(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    const name = (h ?? '').toString().trim();
    if (name) map[name] = i;
  });
  return map;
}

/** Every Coach with a CoachID, in sheet order (which is display order everywhere). */
export function parseCoachesTable(values: unknown[][]): Coach[] {
  if (!values || values.length < 1) return [];
  const map = headerIndexes(values[0]);
  if (map[COACH_COLUMN_NAMES.COACH_ID] === undefined) return [];
  const cell = (row: unknown[], header: string) => {
    const index = map[header];
    return index === undefined ? '' : (row[index] ?? '').toString().trim();
  };
  const coaches: Coach[] = [];
  values.slice(1).forEach((row, i) => {
    const coachId = cell(row, COACH_COLUMN_NAMES.COACH_ID);
    if (!coachId) return;
    coaches.push({
      coachId,
      name: cell(row, COACH_COLUMN_NAMES.NAME),
      email: cell(row, COACH_COLUMN_NAMES.EMAIL),
      phone: cell(row, COACH_COLUMN_NAMES.PHONE),
      about: cell(row, COACH_COLUMN_NAMES.ABOUT),
      photoDriveFileId: cell(row, COACH_COLUMN_NAMES.PHOTO_DRIVE_FILE_ID),
      rowNumber: i + 2,
    });
  });
  return coaches;
}

/**
 * The full row to write back for a coach: `fields` in their columns, every other cell (including
 * columns the portal doesn't know about) exactly as it was.
 */
export function coachFieldsToRow(headerRow: unknown[], existingRow: unknown[], fields: EditableCoachFields): string[] {
  const map = headerIndexes(headerRow);
  const row = headerRow.map((_, i) => (existingRow[i] ?? '').toString());
  for (const [field, value] of Object.entries(fields) as Array<[keyof EditableCoachFields, string | undefined]>) {
    const index = map[FIELD_TO_HEADER[field]];
    if (value !== undefined && index !== undefined) row[index] = value;
  }
  return row;
}

/** Placeholder text for a coach without a Coach Photo. */
export function coachInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = words[0][0];
  return words.length === 1 ? first.toUpperCase() : (first + words[words.length - 1][0]).toUpperCase();
}

/** What the public Coaches Page and the Coach Login list may show: never email or phone. */
export interface PublicCoach {
  coachId: string;
  name: string;
  about: string;
  hasPhoto: boolean;
}

export function toPublicCoach(coach: Coach): PublicCoach {
  return { coachId: coach.coachId, name: coach.name, about: coach.about, hasPhoto: Boolean(coach.photoDriveFileId) };
}

/** What Coach Home shows a coach about themselves (behind the Coach Tools gate). */
export interface CoachProfile extends PublicCoach {
  email: string;
  phone: string;
}

export function toCoachProfile(coach: Coach): CoachProfile {
  return { ...toPublicCoach(coach), email: coach.email, phone: coach.phone };
}
