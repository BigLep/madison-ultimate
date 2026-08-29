import { describe, it, expect } from 'vitest';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';
import { NOT_THIS_SEASON } from '@/lib/signup-form-schema';
import {
  isPlayerInfoComplete,
  isCaretakerInfoComplete,
  isCoachVolunteeringComplete,
  isOtherVolunteeringComplete,
  isPhotoComplete,
  isFinalFormsComplete,
} from '@/lib/signup-checklist';
import { COMPLETE_PLAYER_INFO, signupRecord } from './fixtures/signup-record';

describe('isPlayerInfoComplete', () => {
  it('is true when every required Player-section field is set (Other Info excluded)', () => {
    expect(isPlayerInfoComplete(signupRecord(COMPLETE_PLAYER_INFO))).toBe(true);
  });

  it('is true even when Other Info is empty', () => {
    expect(
      isPlayerInfoComplete(signupRecord({ ...COMPLETE_PLAYER_INFO, [SIGNUPS_COLUMNS.OTHER_INFO]: '' }))
    ).toBe(true);
  });

  it('is false when any required Player-section field is missing', () => {
    for (const key of Object.keys(COMPLETE_PLAYER_INFO)) {
      const overrides = { ...COMPLETE_PLAYER_INFO, [key]: '' };
      expect(isPlayerInfoComplete(signupRecord(overrides)), `still complete with ${key} empty`).toBe(
        false
      );
    }
  });
});

describe('isCaretakerInfoComplete', () => {
  it('is false with zero caretakers', () => {
    expect(isCaretakerInfoComplete(signupRecord())).toBe(false);
  });

  it('is false when caretaker 1 has a name but no email', () => {
    expect(
      isCaretakerInfoComplete(signupRecord({ [SIGNUPS_COLUMNS.CARETAKER_1_NAME]: 'Ct One' }))
    ).toBe(false);
  });

  it('is true with caretaker 1 name and email; caretaker 2 stays optional', () => {
    expect(
      isCaretakerInfoComplete(
        signupRecord({
          [SIGNUPS_COLUMNS.CARETAKER_1_NAME]: 'Ct One',
          [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: 'ct1@example.com',
        })
      )
    ).toBe(true);
  });

  it('is still true when a second caretaker is also filled', () => {
    expect(
      isCaretakerInfoComplete(
        signupRecord({
          [SIGNUPS_COLUMNS.CARETAKER_1_NAME]: 'Ct One',
          [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: 'ct1@example.com',
          [SIGNUPS_COLUMNS.CARETAKER_2_NAME]: 'Ct Two',
          [SIGNUPS_COLUMNS.CARETAKER_2_EMAIL]: 'ct2@example.com',
        })
      )
    ).toBe(true);
  });

  it('is false when only caretaker 2 is filled', () => {
    expect(
      isCaretakerInfoComplete(
        signupRecord({
          [SIGNUPS_COLUMNS.CARETAKER_2_NAME]: 'Ct Two',
          [SIGNUPS_COLUMNS.CARETAKER_2_EMAIL]: 'ct2@example.com',
        })
      )
    ).toBe(false);
  });
});

describe('isCoachVolunteeringComplete / isOtherVolunteeringComplete', () => {
  it('treats any coach-volunteering answer as done, including Not this season', () => {
    expect(isCoachVolunteeringComplete(signupRecord())).toBe(false);
    expect(
      isCoachVolunteeringComplete(
        signupRecord({ [SIGNUPS_COLUMNS.COACH_VOLUNTEERING_INTEREST]: 'Yes' })
      )
    ).toBe(true);
    expect(
      isCoachVolunteeringComplete(
        signupRecord({ [SIGNUPS_COLUMNS.COACH_VOLUNTEERING_INTEREST]: NOT_THIS_SEASON })
      )
    ).toBe(true);
  });

  it('treats any other-volunteering selection as done, including Not this season', () => {
    expect(isOtherVolunteeringComplete(signupRecord())).toBe(false);
    expect(
      isOtherVolunteeringComplete(
        signupRecord({ [SIGNUPS_COLUMNS.VOLUNTEER_ROLES]: 'Team photographer' })
      )
    ).toBe(true);
    expect(
      isOtherVolunteeringComplete(
        signupRecord({ [SIGNUPS_COLUMNS.VOLUNTEER_ROLES]: NOT_THIS_SEASON })
      )
    ).toBe(true);
  });
});

describe('isPhotoComplete', () => {
  it('is true only when a Drive file id is stored', () => {
    expect(isPhotoComplete(signupRecord())).toBe(false);
    expect(
      isPhotoComplete(signupRecord({ [SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]: 'file-abc' }))
    ).toBe(true);
  });
});

describe('isFinalFormsComplete', () => {
  it('is false when status is missing, not found, or any flag is off', () => {
    expect(isFinalFormsComplete(null)).toBe(false);
    expect(isFinalFormsComplete({ found: false })).toBe(false);
    expect(
      isFinalFormsComplete({ found: true, parentSigned: false, studentSigned: false, physicalCleared: false })
    ).toBe(false);
    expect(
      isFinalFormsComplete({ found: true, parentSigned: true, studentSigned: false, physicalCleared: false })
    ).toBe(false);
    expect(
      isFinalFormsComplete({ found: true, parentSigned: true, studentSigned: true, physicalCleared: false })
    ).toBe(false);
    expect(
      isFinalFormsComplete({ found: true, parentSigned: false, studentSigned: true, physicalCleared: true })
    ).toBe(false);
  });

  it('is true only when found and all three flags are set', () => {
    expect(
      isFinalFormsComplete({ found: true, parentSigned: true, studentSigned: true, physicalCleared: true })
    ).toBe(true);
  });
});
