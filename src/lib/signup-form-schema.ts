// Zod schema and sheet-record mapping for the step 1 player profile form.
// Field order and grouping mirror docs/fall-2026/signup-spec.md exactly.

import { z } from 'zod';
import { SIGNUPS_COLUMNS } from './signups-config';
import { SignupRecord } from './signups-sheet';

export const GRADE_OPTIONS = ['6', '7', '8'] as const;
export const JERSEY_SIZE_OPTIONS = ['YM', 'YL', 'AS', 'AM', 'AL', 'AXL'] as const;

export const PRONOUN_OPTIONS = ['he', 'him', 'she', 'her', 'they', 'them'] as const;

export const GENDER_IDENTIFICATION_OPTIONS = [
  'Girl-Matching/Gx/Non-binary',
  'Boy-Matching/Bx/Non-binary',
] as const;

export const ELEMENTARY_SCHOOL_OPTIONS = [
  'Alki Elementary School',
  'Arbor Heights Elementary School',
  'Concord International School',
  'Fairmount Park Elementary School',
  'Gatewood Elementary School',
  'Genesee Hill Elementary School',
  'Highland Park Elementary School',
  'Holy Rosary School',
  'Hope Lutheran School',
  'Lafayette Elementary School',
  'Louisa Boren STEM K-8',
  'Our Lady of Guadalupe School',
  'Pathfinder K-8 School',
  'Roxhill Elementary School',
  'Sanislo Elementary School',
  'Tilden School',
  'West Seattle Elementary School',
  'West Seattle Montessori School & Academy',
  'Westside School',
] as const;

export const NOT_THIS_SEASON = 'Not this season';

export const COACH_VOLUNTEERING_OPTIONS = [
  'Yes',
  "Maybe (I'd like to talk more about the possibility)",
  NOT_THIS_SEASON,
] as const;

export const VOLUNTEER_ROLE_OPTIONS = [
  'Team photographer',
  'Team admin / communications',
  'Snacks / logistics',
  'Not sure yet, tell me more',
  'Other',
  NOT_THIS_SEASON,
] as const;

export const profileFormSchema = z.object({
  // Identity (editable in place per ADR 0001)
  preferredFirstName: z.string().trim().min(1, 'Required'),
  lastName: z.string().trim().min(1, 'Required'),
  dateOfBirth: z.string().trim().min(1, 'Required'),
  legalFirstName: z.string().trim().optional(),

  // Player. Grade/jersey size stay visually required in the UI but are not blocking here
  // (round 2 decision: profile save no longer requires completeness).
  grade: z.string().trim().optional(),
  elementarySchool: z.string().trim().optional(),
  pronouns: z.array(z.string()),
  genderIdentification: z.string().trim().optional(),
  allergies: z.string().trim().optional(),
  competingSports: z.string().trim().optional(),
  jerseySize: z.string().trim().optional(),
  playingExperience: z.string().trim().optional(),
  hopes: z.string().trim().optional(),
  otherInfo: z.string().trim().optional(),

  // Player contact
  studentPersonalEmail: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  studentSpsEmail: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  studentCellPhone: z.string().trim().optional(),

  // Caretakers. Caretaker 1 name/email stay visually required but not blocking (round 2).
  caretaker1Name: z.string().trim().optional(),
  caretaker1Email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  caretaker1Phone: z.string().trim().optional(),
  caretaker2Name: z.string().trim().optional(),
  caretaker2Email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  caretaker2Phone: z.string().trim().optional(),

  // Media
  mediaOptOut: z.boolean(),

  // Coach volunteering
  coachVolunteeringInterest: z.string().trim().optional(),
  coachUltimateExperience: z.string().trim().optional(),
  coachOtherSportsExperience: z.string().trim().optional(),

  // Other volunteering
  volunteerRoles: z.array(z.string()),
  volunteerNotes: z.string().trim().optional(),

  // Anything else
  additionalFeedback: z.string().trim().optional(),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function recordToFormValues(record: SignupRecord): ProfileFormValues {
  return {
    preferredFirstName: record[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME] || '',
    lastName: record[SIGNUPS_COLUMNS.LAST_NAME] || '',
    dateOfBirth: record[SIGNUPS_COLUMNS.DATE_OF_BIRTH] || '',
    legalFirstName: record[SIGNUPS_COLUMNS.LEGAL_FIRST_NAME] || '',
    grade: record[SIGNUPS_COLUMNS.GRADE] || '',
    elementarySchool: record[SIGNUPS_COLUMNS.ELEMENTARY_SCHOOL] || '',
    pronouns: record[SIGNUPS_COLUMNS.PRONOUNS]
      ? record[SIGNUPS_COLUMNS.PRONOUNS].split(';').map(s => s.trim()).filter(Boolean)
      : [],
    genderIdentification: record[SIGNUPS_COLUMNS.GENDER_IDENTIFICATION] || '',
    allergies: record[SIGNUPS_COLUMNS.ALLERGIES] || '',
    competingSports: record[SIGNUPS_COLUMNS.COMPETING_SPORTS_AND_ACTIVITIES] || '',
    jerseySize: record[SIGNUPS_COLUMNS.JERSEY_SIZE] || '',
    playingExperience: record[SIGNUPS_COLUMNS.PLAYING_EXPERIENCE] || '',
    hopes: record[SIGNUPS_COLUMNS.HOPES] || '',
    otherInfo: record[SIGNUPS_COLUMNS.OTHER_INFO] || '',
    studentPersonalEmail: record[SIGNUPS_COLUMNS.STUDENT_PERSONAL_EMAIL] || '',
    studentSpsEmail: record[SIGNUPS_COLUMNS.STUDENT_SPS_EMAIL] || '',
    studentCellPhone: record[SIGNUPS_COLUMNS.STUDENT_CELL_PHONE] || '',
    caretaker1Name: record[SIGNUPS_COLUMNS.CARETAKER_1_NAME] || '',
    caretaker1Email: record[SIGNUPS_COLUMNS.CARETAKER_1_EMAIL] || '',
    caretaker1Phone: record[SIGNUPS_COLUMNS.CARETAKER_1_PHONE] || '',
    caretaker2Name: record[SIGNUPS_COLUMNS.CARETAKER_2_NAME] || '',
    caretaker2Email: record[SIGNUPS_COLUMNS.CARETAKER_2_EMAIL] || '',
    caretaker2Phone: record[SIGNUPS_COLUMNS.CARETAKER_2_PHONE] || '',
    mediaOptOut: record[SIGNUPS_COLUMNS.MEDIA_OPT_OUT] === 'true',
    coachVolunteeringInterest: record[SIGNUPS_COLUMNS.COACH_VOLUNTEERING_INTEREST] || '',
    coachUltimateExperience: record[SIGNUPS_COLUMNS.COACH_ULTIMATE_EXPERIENCE] || '',
    coachOtherSportsExperience: record[SIGNUPS_COLUMNS.COACH_OTHER_SPORTS_EXPERIENCE] || '',
    volunteerRoles: record[SIGNUPS_COLUMNS.VOLUNTEER_ROLES]
      ? record[SIGNUPS_COLUMNS.VOLUNTEER_ROLES].split(';').map(s => s.trim()).filter(Boolean)
      : [],
    volunteerNotes: record[SIGNUPS_COLUMNS.VOLUNTEER_NOTES] || '',
    additionalFeedback: record[SIGNUPS_COLUMNS.ADDITIONAL_FEEDBACK] || '',
  };
}

export function formValuesToRecord(values: ProfileFormValues): Partial<SignupRecord> {
  return {
    [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: values.preferredFirstName,
    [SIGNUPS_COLUMNS.LAST_NAME]: values.lastName,
    [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: values.dateOfBirth,
    [SIGNUPS_COLUMNS.LEGAL_FIRST_NAME]: values.legalFirstName || '',
    [SIGNUPS_COLUMNS.GRADE]: values.grade || '',
    [SIGNUPS_COLUMNS.ELEMENTARY_SCHOOL]: values.elementarySchool || '',
    [SIGNUPS_COLUMNS.PRONOUNS]: values.pronouns.join('; '),
    [SIGNUPS_COLUMNS.GENDER_IDENTIFICATION]: values.genderIdentification || '',
    [SIGNUPS_COLUMNS.ALLERGIES]: values.allergies || '',
    [SIGNUPS_COLUMNS.COMPETING_SPORTS_AND_ACTIVITIES]: values.competingSports || '',
    [SIGNUPS_COLUMNS.JERSEY_SIZE]: values.jerseySize || '',
    [SIGNUPS_COLUMNS.PLAYING_EXPERIENCE]: values.playingExperience || '',
    [SIGNUPS_COLUMNS.HOPES]: values.hopes || '',
    [SIGNUPS_COLUMNS.OTHER_INFO]: values.otherInfo || '',
    [SIGNUPS_COLUMNS.STUDENT_PERSONAL_EMAIL]: values.studentPersonalEmail || '',
    [SIGNUPS_COLUMNS.STUDENT_SPS_EMAIL]: values.studentSpsEmail || '',
    [SIGNUPS_COLUMNS.STUDENT_CELL_PHONE]: values.studentCellPhone || '',
    [SIGNUPS_COLUMNS.CARETAKER_1_NAME]: values.caretaker1Name || '',
    [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: values.caretaker1Email || '',
    [SIGNUPS_COLUMNS.CARETAKER_1_PHONE]: values.caretaker1Phone || '',
    [SIGNUPS_COLUMNS.CARETAKER_2_NAME]: values.caretaker2Name || '',
    [SIGNUPS_COLUMNS.CARETAKER_2_EMAIL]: values.caretaker2Email || '',
    [SIGNUPS_COLUMNS.CARETAKER_2_PHONE]: values.caretaker2Phone || '',
    [SIGNUPS_COLUMNS.MEDIA_OPT_OUT]: values.mediaOptOut ? 'true' : '',
    [SIGNUPS_COLUMNS.COACH_VOLUNTEERING_INTEREST]: values.coachVolunteeringInterest || '',
    [SIGNUPS_COLUMNS.COACH_ULTIMATE_EXPERIENCE]: values.coachUltimateExperience || '',
    [SIGNUPS_COLUMNS.COACH_OTHER_SPORTS_EXPERIENCE]: values.coachOtherSportsExperience || '',
    [SIGNUPS_COLUMNS.VOLUNTEER_ROLES]: values.volunteerRoles.join('; '),
    [SIGNUPS_COLUMNS.VOLUNTEER_NOTES]: values.volunteerNotes || '',
    [SIGNUPS_COLUMNS.ADDITIONAL_FEEDBACK]: values.additionalFeedback || '',
  };
}
