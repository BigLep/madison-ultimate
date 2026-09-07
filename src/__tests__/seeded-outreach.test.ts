import { describe, it, expect } from 'vitest';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';
import { signupRecord } from './fixtures/signup-record';
import { isSeededAndIncomplete, outreachEmails } from '@/lib/seeded-outreach';

const seeded = (overrides = {}) =>
  signupRecord({ [SIGNUPS_COLUMNS.SEEDED_AT]: '2026-09-07T13:00:00Z', [SIGNUPS_COLUMNS.PROFILE_COMPLETE]: 'FALSE', ...overrides });

describe('isSeededAndIncomplete', () => {
  it('is true only for a seeded row that is not Profile Complete', () => {
    expect(isSeededAndIncomplete(seeded())).toBe(true);
    expect(isSeededAndIncomplete(seeded({ [SIGNUPS_COLUMNS.PROFILE_COMPLETE]: 'TRUE' }))).toBe(false);
    expect(isSeededAndIncomplete(signupRecord({ [SIGNUPS_COLUMNS.PROFILE_COMPLETE]: 'FALSE' }))).toBe(false);
  });
});

describe('outreachEmails', () => {
  it('collects both caretaker emails, lowercased and deduplicated, from seeded incomplete rows only', () => {
    const emails = outreachEmails([
      seeded({ [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: ' Ct1@Example.com ', [SIGNUPS_COLUMNS.CARETAKER_2_EMAIL]: 'ct2@example.com' }),
      seeded({ [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: 'ct1@example.com' }), // sibling, same caretaker
      seeded({ [SIGNUPS_COLUMNS.PROFILE_COMPLETE]: 'TRUE', [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: 'done@example.com' }),
      signupRecord({ [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: 'family@example.com' }),
      seeded({ [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: '' }),
    ]);
    expect(emails).toEqual(['ct1@example.com', 'ct2@example.com']);
  });
});
