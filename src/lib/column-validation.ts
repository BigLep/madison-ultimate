/**
 * Column validation system for roster sheet
 *
 * This module defines all expected columns and provides validation
 * to ensure the application fails fast when columns are missing.
 */

export interface ColumnDefinition {
  name: string;
  required: boolean;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'email' | 'date';
}

/**
 * Complete list of all columns expected by the application
 */
export const REQUIRED_COLUMNS: ColumnDefinition[] = [
  // Minimal required for portal login and display (many seasons use a simpler roster)
  { name: 'First Name', required: true, description: 'Student first name', type: 'string' },
  { name: 'Last Name', required: true, description: 'Student last name', type: 'string' },
  { name: 'Full Name', required: true, description: 'Student full name', type: 'string' },
  { name: 'Grade', required: true, description: 'Student grade level', type: 'number' },
  { name: 'Gender Identification', required: true, description: 'Student gender identification', type: 'string' },

  // Optional for minimal roster (portal only needs Full Name + portal columns)
  { name: 'StudentID', required: false, description: 'Unique student identifier', type: 'string' },
  { name: 'Gender', required: false, description: 'Student gender', type: 'string' },
  { name: 'Date of Birth', required: false, description: 'Student date of birth', type: 'date' },
  { name: 'Team', required: false, description: 'Team assignment (optional for single-team seasons)', type: 'string' },

  // Final Forms status (optional for minimal roster)
  { name: 'Are All Forms Parent Signed', required: false, description: 'Parent signature status', type: 'boolean' },
  { name: 'Are All Forms Student Signed', required: false, description: 'Student signature status', type: 'boolean' },
  { name: 'Physical Cleared', required: false, description: 'Physical clearance status', type: 'boolean' },
  { name: 'Final Forms Cleared?', required: false, description: 'All forms cleared status', type: 'boolean' },

  // Parent/Caretaker 1 info (optional for minimal roster)
  { name: 'Parent 1 First Name', required: false, description: 'Parent 1 first name', type: 'string' },
  { name: 'Parent 1 Last Name', required: false, description: 'Parent 1 last name', type: 'string' },
  { name: 'Parent 1 Email', required: false, description: 'Parent 1 email address', type: 'email' },
  { name: 'Parent 1 Email On Mailing List?', required: false, description: 'Parent 1 mailing list status', type: 'string' },

  // Parent/Caretaker 2 info (optional for minimal roster)
  { name: 'Parent 2 First Name', required: false, description: 'Parent 2 first name', type: 'string' },
  { name: 'Parent 2 Last Name', required: false, description: 'Parent 2 last name', type: 'string' },
  { name: 'Parent 2 Email', required: false, description: 'Parent 2 email address', type: 'email' },
  { name: 'Parent 2 Email On Mailing List?', required: false, description: 'Parent 2 mailing list status', type: 'string' },

  // Student emails
  { name: 'Student SPS Email', required: false, description: 'Student SPS email address', type: 'email' },
  { name: 'Student Personal Email', required: false, description: 'Student personal email address', type: 'email' },
  { name: 'Student Personal Email On Mailing List?', required: false, description: 'Student personal email mailing list status', type: 'string' },

  // Additional questionnaire info
  { name: 'Prounouns', required: false, description: 'Student pronouns', type: 'string' },
  { name: 'Player Allergies', required: false, description: 'Player allergies', type: 'string' },
  { name: 'Competing Sports and Activities', required: false, description: 'Other competing activities', type: 'string' },
  { name: 'Jersey Size', required: false, description: 'Jersey size preference', type: 'string' },
  { name: 'Playing Experience', required: false, description: 'Previous playing experience', type: 'string' },
  { name: 'Player hopes for the season', required: false, description: 'Player goals and hopes', type: 'string' },
  { name: 'Other Player Info', required: false, description: 'Other miscellaneous info', type: 'string' },
  { name: 'Additional Info Questionnaire Filled Out?', required: false, description: 'Questionnaire completion status', type: 'boolean' },
];

/**
 * Portal-specific columns that are dynamically found
 */
export const PORTAL_COLUMN_PATTERNS = {
  LOOKUP_KEY: /portal.*lookup/i,
  PORTAL_ID: /portal.*id/i,
} as const;

export interface ColumnValidationResult {
  isValid: boolean;
  missingRequired: string[];
  missingOptional: string[];
  extraColumns: string[];
  portalColumns: {
    lookupKey?: string;
    portalId?: string;
  };
}

/**
 * Validate that all required columns exist in the roster sheet
 */
export function validateColumns(availableColumns: string[]): ColumnValidationResult {
  const columnSet = new Set(availableColumns.map(col => col.trim()));

  const required = REQUIRED_COLUMNS.filter(col => col.required);
  const optional = REQUIRED_COLUMNS.filter(col => !col.required);

  const missingRequired = required
    .filter(col => !columnSet.has(col.name))
    .map(col => col.name);

  const missingOptional = optional
    .filter(col => !columnSet.has(col.name))
    .map(col => col.name);

  const expectedColumnNames = new Set(REQUIRED_COLUMNS.map(col => col.name));
  const extraColumns = availableColumns.filter(col => !expectedColumnNames.has(col.trim()));

  // Find portal columns
  const portalColumns: { lookupKey?: string; portalId?: string } = {};
  for (const col of availableColumns) {
    if (PORTAL_COLUMN_PATTERNS.LOOKUP_KEY.test(col)) {
      portalColumns.lookupKey = col;
    }
    if (PORTAL_COLUMN_PATTERNS.PORTAL_ID.test(col) && !PORTAL_COLUMN_PATTERNS.LOOKUP_KEY.test(col)) {
      portalColumns.portalId = col;
    }
  }

  return {
    isValid: missingRequired.length === 0 && typeof portalColumns.lookupKey === 'string' && typeof portalColumns.portalId === 'string',
    missingRequired,
    missingOptional,
    extraColumns,
    portalColumns,
  };
}

/**
 * Get a safe column value with validation
 */
export function getValidatedColumnValue(
  playerData: any,
  columnName: string,
  required: boolean = false
): string | null {
  const columnIndex = playerData.columnMapping[columnName];

  if (columnIndex === undefined) {
    if (required) {
      throw new Error(`Required column '${columnName}' not found in roster data. Please check the column mapping.`);
    }
    console.warn(`Optional column '${columnName}' not found in roster data.`);
    return null;
  }

  return playerData.rowData[columnIndex]?.toString().trim() || null;
}

/**
 * Create a validation error message for missing columns
 */
export function createValidationErrorMessage(result: ColumnValidationResult): string {
  const errors: string[] = [];

  if (result.missingRequired.length > 0) {
    errors.push(`Missing required columns: ${result.missingRequired.join(', ')}`);
  }

  if (!result.portalColumns.lookupKey) {
    errors.push('Missing portal lookup key column (should match pattern: portal.*lookup)');
  }

  if (!result.portalColumns.portalId) {
    errors.push('Missing portal ID column (should match pattern: portal.*id)');
  }

  if (result.missingOptional.length > 0) {
    errors.push(`Missing optional columns: ${result.missingOptional.join(', ')}`);
  }

  return errors.join('\n');
}

/**
 * Helper function to safely extract all player data using validated column access
 */
export function extractPlayerData(playerData: any) {
  // Helper to get required columns with fail-fast behavior
  const getRequired = (columnName: string) => getValidatedColumnValue(playerData, columnName, true);
  // Helper to get optional columns
  const getOptional = (columnName: string) => getValidatedColumnValue(playerData, columnName, false);

  return {
    // Basic info
    studentId: getOptional('StudentID') || '',
    firstName: getRequired('First Name') || '',
    lastName: getRequired('Last Name') || '',
    fullName: getRequired('Full Name') || '',
    grade: parseInt(getRequired('Grade') || '0'),
    gender: getOptional('Gender') || '',
    genderIdentification: getRequired('Gender Identification') || '',
    dateOfBirth: getOptional('Date of Birth') || '',
    team: getOptional('Team') || '',

    // Final Forms status (optional)
    finalFormsStatus: {
      parentSigned: getOptional('Are All Forms Parent Signed') === 'TRUE',
      studentSigned: getOptional('Are All Forms Student Signed') === 'TRUE',
      physicalCleared: getOptional('Physical Cleared') === 'TRUE',
      allCleared: getOptional('Final Forms Cleared?') === 'TRUE'
    },

    // Parent contacts (optional)
    contacts: {
      parent1: {
        firstName: getOptional('Parent 1 First Name') || '',
        lastName: getOptional('Parent 1 Last Name') || '',
        email: getOptional('Parent 1 Email') || '',
        mailingListStatus: getOptional('Parent 1 Email On Mailing List?') || ''
      },
      parent2: {
        firstName: getOptional('Parent 2 First Name') || '',
        lastName: getOptional('Parent 2 Last Name') || '',
        email: getOptional('Parent 2 Email') || '',
        mailingListStatus: getOptional('Parent 2 Email On Mailing List?') || ''
      },
      studentEmails: {
        spsEmail: getOptional('Student SPS Email') || undefined,
        personalEmail: getOptional('Student Personal Email') || undefined,
        personalEmailMailingStatus: getOptional('Student Personal Email On Mailing List?') || undefined
      }
    },

    // Additional info (all optional)
    additionalInfo: {
      pronouns: getOptional('Prounouns') || undefined,
      allergies: getOptional('Player Allergies') || undefined,
      competingSports: getOptional('Competing Sports and Activities') || undefined,
      jerseySize: getOptional('Jersey Size') || undefined,
      playingExperience: getOptional('Playing Experience') || undefined,
      playerHopes: getOptional('Player hopes for the season') || undefined,
      otherInfo: getOptional('Other Player Info') || undefined,
      questionnaireFilledOut: getOptional('Additional Info Questionnaire Filled Out?') === 'TRUE'
    }
  };
}