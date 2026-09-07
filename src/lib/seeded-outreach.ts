// Outreach list for Seeded Signups (ADR 0006): the caretaker emails of every seeded row whose
// family has not yet finished, ready to paste into a BCC line. Pure; the admin route feeds it
// the current rows.

import { SIGNUPS_COLUMNS } from './signups-config';
import { PROFILE_COMPLETE_TRUE } from './signup-checklist';
import type { SignupRecord } from './signups-sheet';

export function isSeededAndIncomplete(record: SignupRecord): boolean {
  return Boolean(record[SIGNUPS_COLUMNS.SEEDED_AT]) && record[SIGNUPS_COLUMNS.PROFILE_COMPLETE] !== PROFILE_COMPLETE_TRUE;
}

/** Caretaker 1 and 2 emails of seeded, not yet complete rows: trimmed, lowercased, deduplicated, in row order. */
export function outreachEmails(records: SignupRecord[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const record of records) {
    if (!isSeededAndIncomplete(record)) continue;
    for (const column of [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL, SIGNUPS_COLUMNS.CARETAKER_2_EMAIL]) {
      const email = (record[column] || '').trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      out.push(email);
    }
  }
  return out;
}
