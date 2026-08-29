/**
 * Minimal valid ProfileFormValues for unit tests. No PII: callers pass self-descriptive
 * labels only.
 */

import type { ProfileFormValues } from '@/lib/signup-form-schema';

export function validProfile(overrides: Partial<ProfileFormValues> = {}): ProfileFormValues {
  return {
    preferredFirstName: 'Afirst',
    lastName: 'Blast',
    dateOfBirth: '2014-05-12',
    pronouns: [],
    volunteerRoles: [],
    mediaOptOut: false,
    ...overrides,
  };
}
