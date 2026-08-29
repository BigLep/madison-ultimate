// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerProfileForm } from '@/components/PlayerProfileForm';
import type { ProfileFormValues } from '@/lib/signup-form-schema';

// Out of scope for this test: both fetch on mount. Stub them so the form under test doesn't
// depend on network calls unrelated to the Save/error behavior being tested here.
vi.mock('@/components/PhotoUpload', () => ({
  PhotoUpload: () => null,
}));
vi.mock('@/components/MailingStatusInline', () => ({
  MailingStatusInline: () => null,
}));

const defaultValues: ProfileFormValues = {
  preferredFirstName: 'TestFirst',
  lastName: 'TestLast',
  dateOfBirth: '2013-01-01',
  legalFirstName: '',
  grade: '',
  elementarySchool: '',
  pronouns: [],
  genderIdentification: '',
  allergies: '',
  competingSports: '',
  jerseySize: '',
  playingExperience: '',
  hopes: '',
  otherInfo: '',
  studentPersonalEmail: '',
  studentSpsEmail: '',
  studentCellPhone: '',
  caretaker1Name: '',
  caretaker1Email: '',
  caretaker1Phone: '',
  caretaker2Name: '',
  caretaker2Email: '',
  caretaker2Phone: '',
  mediaOptOut: false,
  coachVolunteeringInterest: '',
  coachUltimateExperience: '',
  coachOtherSportsExperience: '',
  volunteerRoles: [],
  volunteerNotes: '',
  additionalFeedback: '',
};

function renderForm(onSave: (values: ProfileFormValues) => Promise<void>) {
  return render(
    <PlayerProfileForm
      playerId="p001"
      defaultValues={defaultValues}
      hasPhoto={false}
      onPhotoUploaded={vi.fn()}
      onSave={onSave}
    />
  );
}

function getPreferredFirstNameInput(): HTMLInputElement {
  return document.querySelector('input[name="preferredFirstName"]') as HTMLInputElement;
}

describe('PlayerProfileForm — Saved/error confirmation', () => {
  it('shows a Saved confirmation after a successful save, and clears it on the next edit', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderForm(onSave);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByRole('button', { name: '✓ Saved' })).toBeInTheDocument());
    expect(onSave).toHaveBeenCalledTimes(1);

    await user.type(getPreferredFirstNameInput(), 'X');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument());
  });

  it('shows an error alert on a failed save, and clears it on the next edit', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('network down'));
    renderForm(onSave);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not save. Please try again.'));

    await user.type(getPreferredFirstNameInput(), 'X');

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('does not carry a stale error into the next successful save', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce(undefined);
    renderForm(onSave);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByRole('button', { name: '✓ Saved' })).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
