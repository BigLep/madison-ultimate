// Central configuration for all Google Sheets names and constants
// This ensures consistency across the application and makes it easy to update sheet names

/** Roster: first data row (1-indexed). Row 1 = header; change if your sheet has more header/metadata rows. */
export const ROSTER_FIRST_DATA_ROW = 2;

export const SHEET_CONFIG = {
  // Sheet Names
  ROSTER_SHEET_NAME: '📋 Roster',
  PRACTICE_INFO_SHEET_NAME: '📍Practice Info',
  PRACTICE_AVAILABILITY_SHEET_NAME: 'Practice Availability',
  GAME_INFO_SHEET_NAME: '📍Game Info',
  GAME_AVAILABILITY_SHEET_NAME: 'Game Availability',

  METADATA_ROWS: 4, // Used by roster-metadata (build tooling) for sheets with type/source/note rows

  // Common Sheet IDs (from environment)
  ROSTER_SHEET_ID: process.env.ROSTER_SHEET_ID || '1kV3Y_GST_Y-X9PZFXu9yFkCzGWvhk9f7G24Y8QNuayU',
  SPS_FINAL_FORMS_FOLDER_ID: process.env.SPS_FINAL_FORMS_FOLDER_ID,
  TEAM_MAILING_LIST_FOLDER_ID: process.env.TEAM_MAILING_LIST_FOLDER_ID,
  ADDITIONAL_QUESTIONNAIRE_SHEET_ID: process.env.ADDITIONAL_QUESTIONNAIRE_SHEET_ID,
} as const;

// Helper function to get a metadata range for any sheet
export function getMetadataRange(maxColumn: string = 'Z'): string {
  return `A1:${maxColumn}${SHEET_CONFIG.METADATA_ROWS}`;
}

// Helper function to get a data range starting at ROSTER_FIRST_DATA_ROW
export function getDataRange(maxColumn: string = 'Z', maxRow?: number): string {
  const endRow = maxRow ? maxRow : '1000';
  return `A${ROSTER_FIRST_DATA_ROW}:${maxColumn}${endRow}`;
}