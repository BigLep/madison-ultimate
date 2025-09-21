// Central configuration for all Google Sheets names and constants
// This ensures consistency across the application and makes it easy to update sheet names

export const SHEET_CONFIG = {
  // Sheet Names
  ROSTER_SHEET_NAME: '📋 Roster',
  PRACTICE_INFO_SHEET_NAME: '📍Practice Info',
  PRACTICE_AVAILABILITY_SHEET_NAME: 'Practice Availability',

  // Metadata Configuration
  METADATA_ROWS: 4,
  DATA_START_ROW: 5, // First row after metadata (1-indexed)
  DATA_START_ROW_INDEX: 4, // First row after metadata (0-indexed)

  // Common Sheet IDs (from environment)
  ROSTER_SHEET_ID: process.env.ROSTER_SHEET_ID || '1ZZA5TxHu8nmtyNORm3xYtN5rzP3p1jtW178UgRcxLA8',
  SPS_FINAL_FORMS_FOLDER_ID: process.env.SPS_FINAL_FORMS_FOLDER_ID,
  TEAM_MAILING_LIST_FOLDER_ID: process.env.TEAM_MAILING_LIST_FOLDER_ID,
  ADDITIONAL_QUESTIONNAIRE_SHEET_ID: process.env.ADDITIONAL_QUESTIONNAIRE_SHEET_ID,
} as const;

// Helper function to get a metadata range for any sheet
export function getMetadataRange(maxColumn: string = 'Z'): string {
  return `A1:${maxColumn}${SHEET_CONFIG.METADATA_ROWS}`;
}

// Helper function to get a data range starting after metadata
export function getDataRange(maxColumn: string = 'Z', maxRow?: number): string {
  const endRow = maxRow ? maxRow : '1000';
  return `A${SHEET_CONFIG.DATA_START_ROW}:${maxColumn}${endRow}`;
}