// Photo Carryover (docs/adr/0003-player-photo-carryover-and-heic-handling.md): copies a
// returning player's Fall 2025 Player Photo into the current season the moment their signup
// row is matched by SPS Student ID, skipping players who already have a current-season photo.
// Column lookups use header names discovered at read time, never hardcoded positions, since the
// Fall 2025 sheet's layout isn't something this season's code controls.

import { getSheetDataWithHyperlinks } from './google-api';
import { downloadDriveFile, uploadPlayerPhoto } from './google-oauth-drive';
import { SHEET_CONFIG } from './sheet-config';


const STUDENT_ID_HEADER = 'StudentID';
const PHOTO_URL_HEADER = 'Photo Download';

type SheetCell = string | { text: string; url?: string } | undefined;

function cellText(cell: SheetCell): string {
  if (!cell) return '';
  return typeof cell === 'string' ? cell : cell.text;
}

function cellUrl(cell: SheetCell): string {
  if (!cell) return '';
  return typeof cell === 'string' ? cell : cell.url || cell.text;
}

export function extractDriveFileId(url: string): string | null {
  const idParam = url.match(/[?&]id=([-\w]+)/);
  if (idParam) return idParam[1];
  const pathSegment = url.match(/\/d\/([-\w]+)/);
  if (pathSegment) return pathSegment[1];
  const longestToken = url.match(/[-\w]{25,}/);
  return longestToken ? longestToken[0] : null;
}

/** Looks up last season's photo Drive file id for a returning player, by SPS Student ID. */
export async function findLastSeasonPhotoFileId(studentId: string): Promise<string | null> {
  const sheetId = SHEET_CONFIG.FALL_2025_ROSTER_SHEET_ID;
  if (!sheetId || !studentId) return null;

  const rows = await getSheetDataWithHyperlinks(sheetId, SHEET_CONFIG.ROSTER_SHEET_NAME, 'A:AQ');
  if (rows.length === 0) return null;

  const header = (rows[0] as SheetCell[]).map(cellText);
  const studentIdIndex = header.indexOf(STUDENT_ID_HEADER);
  const photoUrlIndex = header.indexOf(PHOTO_URL_HEADER);
  if (studentIdIndex === -1 || photoUrlIndex === -1) return null;

  for (const row of rows.slice(1) as SheetCell[][]) {
    if (cellText(row[studentIdIndex]).trim() === studentId.trim()) {
      const url = cellUrl(row[photoUrlIndex]).trim();
      return url ? extractDriveFileId(url) : null;
    }
  }
  return null;
}

/**
 * Carries a returning player's Fall 2025 photo into this season, under their new PlayerID.
 * Returns the new season's Drive file id, or null if there's nothing to carry over.
 */
export async function carryOverPhotoFromLastSeason(playerId: string, studentId: string): Promise<string | null> {
  const lastSeasonFileId = await findLastSeasonPhotoFileId(studentId);
  if (!lastSeasonFileId) return null;

  const file = await downloadDriveFile(lastSeasonFileId);
  if (!file) return null;

  return uploadPlayerPhoto(playerId, file.buffer, file.mimeType);
}
