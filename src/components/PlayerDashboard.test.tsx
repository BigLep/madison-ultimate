// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { PlayerDashboard } from '@/components/PlayerDashboard';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';
import { signupRecord, COMPLETE_PLAYER_INFO } from '../__tests__/fixtures/signup-record';
import type { FinalFormsStatus } from '@/components/FinalFormsRow';

// Stand in for the live Final Forms panel: report whatever status the test asks for.
let finalFormsStatus: FinalFormsStatus = { found: true, parentSigned: true, studentSigned: true, physicalCleared: true };
vi.mock('@/components/FinalFormsRow', () => ({
  FinalFormsRow: ({ onStatusChange }: { onStatusChange: (s: FinalFormsStatus) => void }) => {
    useEffect(() => {
      onStatusChange(finalFormsStatus);
    }, [onStatusChange]);
    return <div>final forms panel</div>;
  },
}));

const completeRecord = signupRecord({
  ...COMPLETE_PLAYER_INFO,
  [SIGNUPS_COLUMNS.PLAYER_ID]: 'p001',
  [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'TestFirst',
  [SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]: 'file123',
  [SIGNUPS_COLUMNS.CARETAKER_1_NAME]: 'TestCaretaker',
  [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: 'caretaker@example.com',
  [SIGNUPS_COLUMNS.COACH_VOLUNTEERING_INTEREST]: 'No',
  [SIGNUPS_COLUMNS.VOLUNTEER_ROLES]: 'Not this season',
});

describe('PlayerDashboard collapse (player-portal-grill.md Q19)', () => {
  it('collapses to "Signup Status ✅" once Checklist Complete, and expands on tap', async () => {
    finalFormsStatus = { found: true, parentSigned: true, studentSigned: true, physicalCleared: true };
    const user = userEvent.setup();
    render(<PlayerDashboard record={completeRecord} />);

    const toggle = await screen.findByRole('button', { name: /Signup Status ✅/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('final forms panel')).not.toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('final forms panel')).toBeVisible();
  });

  it('stays expanded with the plain title while any row is not done', async () => {
    finalFormsStatus = { found: true, parentSigned: true, studentSigned: false, physicalCleared: true };
    render(<PlayerDashboard record={completeRecord} />);

    expect(await screen.findByText('Signup Status')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Signup Status ✅/ })).not.toBeInTheDocument();
    expect(screen.getByText('final forms panel')).toBeVisible();
  });
});
