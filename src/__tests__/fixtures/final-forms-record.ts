/**
 * Minimal valid FinalFormsRecord for unit tests. No PII: callers pass self-descriptive
 * labels only.
 */

import type { FinalFormsRecord } from '@/lib/final-forms';

export function finalFormsRecord(overrides: Partial<FinalFormsRecord> = {}): FinalFormsRecord {
  return {
    studentId: 'FF-1',
    firstName: 'Afirst',
    lastName: 'Blast',
    legalFirstName: 'Afirst',
    dateOfBirth: '2014-05-12',
    grade: '7',
    parentSigned: true,
    studentSigned: false,
    physicalCleared: false,
    physicalClearanceExpiration: '',
    studentEmail: 'player@example.com',
    studentCellPhone: '555-0100',
    parent1Name: 'Ct One',
    parent1Email: 'ct1@example.com',
    parent1Phone: '555-0101',
    parent2Name: '',
    parent2Email: '',
    parent2Phone: '',
    ...overrides,
  };
}
