// Central configuration for the 2026 Fall Signups spreadsheet.
// Column values below are header NAMES, never positions: signups-sheet.ts discovers
// each column's index dynamically from the sheet's own header row (see AGENT.md).

export const SIGNUPS_SHEET_CONFIG = {
  SIGNUPS_SHEET_ID: process.env.SIGNUPS_SHEET_ID || '',
  SIGNUPS_SHEET_NAME: 'Signups',
} as const;

// Sheet column header names, grouped to match docs/fall-2026/signup-spec.md.
export const SIGNUPS_COLUMNS = {
  // System
  PLAYER_ID: 'PlayerID',
  CREATED_AT: 'Created At',
  UPDATED_AT: 'Updated At',

  // Identity
  PREFERRED_FIRST_NAME: 'Preferred First Name',
  LEGAL_FIRST_NAME: 'Legal First Name',
  LAST_NAME: 'Last Name',
  DATE_OF_BIRTH: 'Date of Birth',
  GRADE: 'Grade',
  ELEMENTARY_SCHOOL: 'Elementary School',

  // Profile
  PRONOUNS: 'Pronouns',
  GENDER_IDENTIFICATION: 'Gender Identification',
  ALLERGIES: 'Allergies',
  COMPETING_SPORTS_AND_ACTIVITIES: 'Competing Sports and Activities',
  JERSEY_SIZE: 'Jersey Size',
  PLAYING_EXPERIENCE: 'Playing Experience',
  HOPES: 'Hopes',
  OTHER_INFO: 'Other Info',

  // Student contact
  STUDENT_PERSONAL_EMAIL: 'Student Personal Email',
  STUDENT_SPS_EMAIL: 'Student SPS Email',
  STUDENT_CELL_PHONE: 'Student Cell Phone',

  // Family
  CARETAKER_1_NAME: 'Caretaker 1 Name',
  CARETAKER_1_EMAIL: 'Caretaker 1 Email',
  CARETAKER_1_PHONE: 'Caretaker 1 Phone',
  CARETAKER_2_NAME: 'Caretaker 2 Name',
  CARETAKER_2_EMAIL: 'Caretaker 2 Email',
  CARETAKER_2_PHONE: 'Caretaker 2 Phone',
  MEDIA_OPT_OUT: 'Media Opt-Out',

  // Volunteer
  COACH_VOLUNTEERING_INTEREST: 'Coach Volunteering Interest',
  COACH_ULTIMATE_EXPERIENCE: 'Coach Ultimate Experience',
  COACH_OTHER_SPORTS_EXPERIENCE: 'Coach Other Sports Experience',
  VOLUNTEER_ROLES: 'Volunteer Roles',
  VOLUNTEER_NOTES: 'Volunteer Notes',

  // Feedback
  ADDITIONAL_FEEDBACK: 'Additional Feedback',

  // Joins
  SPS_STUDENT_ID: 'SPS Student ID',
  PHOTO_DRIVE_FILE_ID: 'Photo Drive File ID',
} as const;

export type SignupsColumnKey = keyof typeof SIGNUPS_COLUMNS;
