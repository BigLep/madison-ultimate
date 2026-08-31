import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';
import { signupRecord } from './fixtures/signup-record';
import { validProfile } from './fixtures/profile-form-values';

vi.mock('@/lib/signups-sheet', () => ({
  findSignupByPlayerId: vi.fn(),
  updateSignupRow: vi.fn(),
}));

vi.mock('@/lib/buttondown-api', () => ({
  subscribeEmail: vi.fn(),
  subscribeUnlessUnsubscribed: vi.fn(),
}));

import { findSignupByPlayerId, updateSignupRow } from '@/lib/signups-sheet';
import { subscribeEmail, subscribeUnlessUnsubscribed } from '@/lib/buttondown-api';
import { PUT } from '@/app/api/signup/player/[playerId]/route';

const findSignup = vi.mocked(findSignupByPlayerId);
const updateRow = vi.mocked(updateSignupRow);
const subscribe = vi.mocked(subscribeEmail);
const subscribeUnlessUnsub = vi.mocked(subscribeUnlessUnsubscribed);

const PLAYER_ID = 'testplayerid';
const routeParams = { params: Promise.resolve({ playerId: PLAYER_ID }) };

function putRequest(body: object, headers?: Record<string, string>): NextRequest {
  return new NextRequest(`http://localhost/api/signup/player/${PLAYER_ID}`, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers,
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
    subscribeUnlessUnsub.mockResolvedValue(true);
  });

  it('subscribes caretaker and student personal emails on save, never SPS', async () => {
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
    expect(subscribeUnlessUnsub).toHaveBeenCalledTimes(3);
    expect(subscribeUnlessUnsub).toHaveBeenCalledWith('ct1@example.com', undefined);
    expect(subscribeUnlessUnsub).toHaveBeenCalledWith('ct2@example.com', undefined);
    expect(subscribeUnlessUnsub).toHaveBeenCalledWith('student@example.com', undefined);
    expect(subscribeUnlessUnsub).not.toHaveBeenCalledWith('student@seattleschools.org', undefined);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('forwards the visitor IP from x-forwarded-for to subscribeUnlessUnsubscribed', async () => {
    const res = await PUT(
      putRequest(validProfile({ caretaker1Email: 'ct1@example.com' }), {
        'x-forwarded-for': '203.0.113.5, 10.0.0.1',
      }),
      routeParams
    );
    expect(res.status).toBe(200);
    expect(subscribeUnlessUnsub).toHaveBeenCalledWith('ct1@example.com', '203.0.113.5');
  });

  it('does not call Buttondown when no eligible emails are present', async () => {
    const res = await PUT(putRequest(validProfile()), routeParams);
    expect(res.status).toBe(200);
    expect(subscribeUnlessUnsub).not.toHaveBeenCalled();
  });

  it('still saves the profile when subscribe returns false (Buttondown must not block save)', async () => {
    subscribeUnlessUnsub.mockResolvedValue(false);
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
