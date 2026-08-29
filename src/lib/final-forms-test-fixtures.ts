// Magic-name test fixtures for exercising every Final Forms dashboard state without touching
// the real export or waiting on a real family's registration. Triggered purely by the LAST
// NAME typed at /signup (case/spacing-insensitive) — preferred first name and birthdate are
// free choices and only affect the normal Player Lookup/near-match behavior, not this.
//
// To use: go to /signup and enter any preferred first name + birthdate, with one of the last
// names below. A real row is created in the Signups sheet like any other signup (safe to
// delete afterward); its Final Forms status on /player/$playerId is then this canned data
// instead of a real join, so every dashboard state is reachable on demand:
//
//   Last name           -> Final Forms dashboard state
//   TestNotFound        -> not found (C5 guidance)
//   TestNoneSigned      -> found; nothing signed, not cleared
//   TestParentSigned    -> found; caretaker signed only
//   TestAllSigned       -> found; caretaker + student signed, not yet cleared
//   TestCleared         -> found; fully signed and physical cleared
//
// All of these also carry fake seeded fields (grade/contact/caretaker) so a join
// auto-fills the profile form the same way a real Final Forms match would.

import { normalizeName } from './player-identity';
import { FinalFormsRecord } from './final-forms';

const BASE_FIXTURE: Omit<FinalFormsRecord, 'studentId' | 'lastName' | 'parentSigned' | 'studentSigned' | 'physicalCleared' | 'physicalClearanceExpiration'> = {
  firstName: 'Test',
  legalFirstName: 'Test',
  dateOfBirth: '',
  grade: '7',
  studentEmail: 'test-student@example.com',
  studentCellPhone: '555-0100',
  parent1Name: 'Test Parent One',
  parent1Email: 'test-parent-1@example.com',
  parent1Phone: '555-0101',
  parent2Name: 'Test Parent Two',
  parent2Email: 'test-parent-2@example.com',
  parent2Phone: '555-0102',
};

const FIXTURES_BY_NORMALIZED_LAST_NAME: Record<string, FinalFormsRecord | null> = {
  testnotfound: null,
  testnonesigned: {
    ...BASE_FIXTURE,
    studentId: 'TEST-NONE-SIGNED',
    lastName: 'TestNoneSigned',
    parentSigned: false,
    studentSigned: false,
    physicalCleared: false,
    physicalClearanceExpiration: '',
  },
  testparentsigned: {
    ...BASE_FIXTURE,
    studentId: 'TEST-PARENT-SIGNED',
    lastName: 'TestParentSigned',
    parentSigned: true,
    studentSigned: false,
    physicalCleared: false,
    physicalClearanceExpiration: '',
  },
  testallsigned: {
    ...BASE_FIXTURE,
    studentId: 'TEST-ALL-SIGNED',
    lastName: 'TestAllSigned',
    parentSigned: true,
    studentSigned: true,
    physicalCleared: false,
    physicalClearanceExpiration: '',
  },
  testcleared: {
    ...BASE_FIXTURE,
    studentId: 'TEST-CLEARED',
    lastName: 'TestCleared',
    parentSigned: true,
    studentSigned: true,
    physicalCleared: true,
    physicalClearanceExpiration: '2027-06-01',
  },
};

/** Returns the fixture for a magic last name: an override record, `null` for the not-found fixture, or `undefined` if not a magic name at all. */
export function findTestFixture(lastName: string): FinalFormsRecord | null | undefined {
  const key = normalizeName(lastName);
  return key in FIXTURES_BY_NORMALIZED_LAST_NAME ? FIXTURES_BY_NORMALIZED_LAST_NAME[key] : undefined;
}
