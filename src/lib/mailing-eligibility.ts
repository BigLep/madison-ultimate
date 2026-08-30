// Mailing-list-eligible emails for a signup row, per docs/fall-2026/signup-plan.md section 7:
// caretaker emails and the student's personal email. SPS student addresses are never offered
// (external mail bounces). Eligible emails are auto-subscribed on first Final Forms join and
// on profile save, except addresses already marked unsubscribed in Buttondown.

import { SIGNUPS_COLUMNS } from './signups-config';

export interface EligibleMailingEmail {
  label: string;
  email: string;
}

export function eligibleMailingEmails(record: Record<string, string | undefined>): EligibleMailingEmail[] {
  return [
    { label: 'Caretaker 1', email: record[SIGNUPS_COLUMNS.CARETAKER_1_EMAIL] },
    { label: 'Caretaker 2', email: record[SIGNUPS_COLUMNS.CARETAKER_2_EMAIL] },
    { label: 'Student personal email', email: record[SIGNUPS_COLUMNS.STUDENT_PERSONAL_EMAIL] },
  ].filter((entry): entry is EligibleMailingEmail => Boolean(entry.email?.trim()));
}
