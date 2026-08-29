import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';
import { ProfileFormValues } from '@/lib/signup-form-schema';
import { signupRecord } from './fixtures/signup-record';

vi.mock('@/lib/signups-sheet', () => ({
  findSignupByPlayerId: vi.fn(),
  updateSignupRow: vi.fn(),
}));

vi.mock('@/lib/buttondown-api', () => ({
  subscribeEmail: vi.fn(),
}));

import { findSignupByPlayerId, updateSignupRow } from '@/lib/signups-sheet';
import { subscribeEmail } from '@/lib/buttondown-api';
import { PUT } from '@/app/api/signup/player/[playerId]/route';

const findSignup = vi.mocked(findSignupByPlayerId);
const updateRow = vi.mocked(updateSignupRow);
const subscribe = vi.mocked(subscribeEmail);

const PLAYER_ID = 'testplayerid';
const routeParams = { params: Promise.resolve({ playerId: PLAYER_ID }) };

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

function putRequest(body: object): NextRequest {
  return new NextRequest(`http://localhost/api/signup/player/${PLAYER_ID}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

describe('PUT /api/signup/player/[playerId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findSignup.mockResolvedValue({
      record: signupRecord({ [SIGNUPS_COLUMNS.PLAYER_ID]: PLAYER_ID }),
      rowNumber: 2,
    });
    updateRow.mockImplementation(async (_id, fields) => signupRecord(fields));
    subscribe.mockResolvedValue(true);
  });

  it('subscribes caretaker 1 and 2 emails on save, never the student emails', async () => {
    const res = await PUT(
      putRequest(
        validProfile({
          caretaker1Email: 'ct1@example.com',
          caretaker2Email: 'ct2@example.com',
          studentPersonalEmail: 'student@example.com',
          studentSpsEmail: 'student@seattleschools.org',
        })
      ),
      routeParams
    );
    expect(res.status).toBe(200);
    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(subscribe).toHaveBeenCalledWith('ct1@example.com');
    expect(subscribe).toHaveBeenCalledWith('ct2@example.com');
    expect(subscribe).not.toHaveBeenCalledWith('student@example.com');
    expect(subscribe).not.toHaveBeenCalledWith('student@seattleschools.org');
  });

  it('does not call Buttondown when no caretaker emails are present', async () => {
    const res = await PUT(putRequest(validProfile()), routeParams);
    expect(res.status).toBe(200);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('still saves the profile when subscribe returns false (Buttondown must not block save)', async () => {
    subscribe.mockResolvedValue(false);
    const res = await PUT(
      putRequest(validProfile({ caretaker1Email: 'ct1@example.com' })),
      routeParams
    );
    expect(res.status).toBe(200);
    expect(updateRow).toHaveBeenCalled();
    expect((await res.json()).success).toBe(true);
  });

  it('returns 400 for invalid profile data', async () => {
    const res = await PUT(
      putRequest(validProfile({ caretaker1Email: 'not-an-email' })),
      routeParams
    );
    expect(res.status).toBe(400);
    expect(updateRow).not.toHaveBeenCalled();
  });

  it('returns 404 when the player does not exist', async () => {
    findSignup.mockResolvedValue(null);
    const res = await PUT(putRequest(validProfile()), routeParams);
    expect(res.status).toBe(404);
  });
});
