import { describe, it, expect } from 'vitest';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';
import {
  profileFormSchema,
  recordToFormValues,
  formValuesToRecord,
  ProfileFormValues,
} from '@/lib/signup-form-schema';

function validProfile(overrides: Partial<ProfileFormValues> = {}): ProfileFormValues {
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

describe('caretaker cap', () => {
  it('exposes exactly two caretaker column groups on the Signups sheet', () => {
    const caretakerKeys = Object.keys(SIGNUPS_COLUMNS).filter(key => key.startsWith('CARETAKER_'));
    expect(caretakerKeys).toEqual([
      'CARETAKER_1_NAME',
      'CARETAKER_1_EMAIL',
      'CARETAKER_1_PHONE',
      'CARETAKER_2_NAME',
      'CARETAKER_2_EMAIL',
      'CARETAKER_2_PHONE',
    ]);
  });

  it('has no caretaker-3 fields on the profile schema', () => {
    const shape = profileFormSchema.shape as Record<string, unknown>;
    expect(shape.caretaker1Name).toBeDefined();
    expect(shape.caretaker2Name).toBeDefined();
    expect(shape.caretaker3Name).toBeUndefined();
    expect(shape.caretaker3Email).toBeUndefined();
  });
});

describe('profileFormSchema', () => {
  it('accepts an incomplete profile (completeness is informational, not blocking)', () => {
    const result = profileFormSchema.safeParse(validProfile());
    expect(result.success).toBe(true);
  });

  it('rejects an invalid caretaker email and accepts an empty one', () => {
    expect(profileFormSchema.safeParse(validProfile({ caretaker1Email: 'not-an-email' })).success).toBe(
      false
    );
    expect(profileFormSchema.safeParse(validProfile({ caretaker1Email: '' })).success).toBe(true);
  });

  it('rejects an invalid student personal email', () => {
    expect(
      profileFormSchema.safeParse(validProfile({ studentPersonalEmail: 'not-an-email' })).success
    ).toBe(false);
  });
});

describe('recordToFormValues / formValuesToRecord', () => {
  it('round-trips pronouns and volunteer roles joined with "; "', () => {
    const values = validProfile({
      pronouns: ['he', 'him'],
      volunteerRoles: ['Team photographer', 'Other'],
      mediaOptOut: true,
      caretaker1Name: 'Ct One',
      caretaker1Email: 'ct1@example.com',
    });
    const record = formValuesToRecord(values);
    expect(record[SIGNUPS_COLUMNS.PRONOUNS]).toBe('he; him');
    expect(record[SIGNUPS_COLUMNS.VOLUNTEER_ROLES]).toBe('Team photographer; Other');
    expect(record[SIGNUPS_COLUMNS.MEDIA_OPT_OUT]).toBe('true');

    const back = recordToFormValues(record as Record<string, string>);
    expect(back.pronouns).toEqual(['he', 'him']);
    expect(back.volunteerRoles).toEqual(['Team photographer', 'Other']);
    expect(back.mediaOptOut).toBe(true);
    expect(back.caretaker1Name).toBe('Ct One');
  });

  it('stores media opt-out as empty when unchecked', () => {
    const record = formValuesToRecord(validProfile({ mediaOptOut: false }));
    expect(record[SIGNUPS_COLUMNS.MEDIA_OPT_OUT]).toBe('');
    expect(recordToFormValues(record as Record<string, string>).mediaOptOut).toBe(false);
  });
});
