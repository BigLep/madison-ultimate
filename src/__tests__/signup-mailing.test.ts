import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';
import { eligibleMailingEmails } from '@/lib/mailing-eligibility';
import { signupRecord } from './fixtures/signup-record';

vi.mock('@/lib/signups-sheet', () => ({
  findSignupByPlayerId: vi.fn(),
}));

vi.mock('@/lib/buttondown-api', () => ({
  isSubscriber: vi.fn(),
  subscribeEmail: vi.fn(),
  unsubscribeEmail: vi.fn(),
}));

import { findSignupByPlayerId } from '@/lib/signups-sheet';
import { isSubscriber, subscribeEmail, unsubscribeEmail } from '@/lib/buttondown-api';
import { GET, POST } from '@/app/api/signup/player/[playerId]/mailing/route';

const findSignup = vi.mocked(findSignupByPlayerId);
const isSub = vi.mocked(isSubscriber);
const subscribe = vi.mocked(subscribeEmail);
const unsubscribe = vi.mocked(unsubscribeEmail);

const PLAYER_ID = 'testplayerid';
const routeParams = { params: Promise.resolve({ playerId: PLAYER_ID }) };

function mailingRequest(body?: object, headers?: Record<string, string>): NextRequest {
  return new NextRequest(`http://localhost/api/signup/player/${PLAYER_ID}/mailing`, {
    method: body ? 'POST' : 'GET',
    body: body ? JSON.stringify(body) : undefined,
    headers,
  });
}

describe('eligibleMailingEmails', () => {
  it('includes caretaker emails and student personal email; never SPS', () => {
    const emails = eligibleMailingEmails(
      signupRecord({
        [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: 'ct1@example.com',
        [SIGNUPS_COLUMNS.CARETAKER_2_EMAIL]: 'ct2@example.com',
        [SIGNUPS_COLUMNS.STUDENT_PERSONAL_EMAIL]: 'student@example.com',
        [SIGNUPS_COLUMNS.STUDENT_SPS_EMAIL]: 'student@seattleschools.org',
      })
    );
    expect(emails.map(e => e.label)).toEqual([
      'Caretaker 1',
      'Caretaker 2',
      'Student personal email',
    ]);
    expect(emails.map(e => e.email)).not.toContain('student@seattleschools.org');
  });

  it('omits blank emails so the widget stays hidden until an address exists', () => {
    expect(eligibleMailingEmails(signupRecord())).toEqual([]);
    expect(
      eligibleMailingEmails(signupRecord({ [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: '  ' }))
    ).toEqual([]);
    expect(
      eligibleMailingEmails(signupRecord({ [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: 'ct1@example.com' }))
    ).toEqual([{ label: 'Caretaker 1', email: 'ct1@example.com' }]);
  });
});

describe('GET /api/signup/player/[playerId]/mailing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when the player does not exist', async () => {
    findSignup.mockResolvedValue(null);
    const res = await GET(mailingRequest(), routeParams);
    expect(res.status).toBe(404);
  });

  it('returns per-email subscribed / not-subscribed status (mixed on and off)', async () => {
    findSignup.mockResolvedValue({
      record: signupRecord({
        [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: 'ct1@example.com',
        [SIGNUPS_COLUMNS.CARETAKER_2_EMAIL]: 'ct2@example.com',
        [SIGNUPS_COLUMNS.STUDENT_PERSONAL_EMAIL]: 'student@example.com',
        [SIGNUPS_COLUMNS.STUDENT_SPS_EMAIL]: 'student@seattleschools.org',
      }),
      rowNumber: 2,
    });
    isSub.mockImplementation(async email => email === 'ct1@example.com');

    const res = await GET(mailingRequest(), routeParams);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.statuses).toEqual([
      { label: 'Caretaker 1', email: 'ct1@example.com', subscribed: true },
      { label: 'Caretaker 2', email: 'ct2@example.com', subscribed: false },
      { label: 'Student personal email', email: 'student@example.com', subscribed: false },
    ]);
  });
});

describe('POST /api/signup/player/[playerId]/mailing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findSignup.mockResolvedValue({
      record: signupRecord({
        [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: 'ct1@example.com',
        [SIGNUPS_COLUMNS.STUDENT_PERSONAL_EMAIL]: 'student@example.com',
        [SIGNUPS_COLUMNS.STUDENT_SPS_EMAIL]: 'student@seattleschools.org',
      }),
      rowNumber: 2,
    });
  });

  it('subscribes an eligible caretaker email (join / on-list)', async () => {
    subscribe.mockResolvedValue(true);
    const res = await POST(
      mailingRequest({ email: 'ct1@example.com', action: 'subscribe' }),
      routeParams
    );
    expect(res.status).toBe(200);
    expect(subscribe).toHaveBeenCalledWith('ct1@example.com', undefined);
    expect((await res.json()).subscribed).toBe(true);
  });

  it('unsubscribes an eligible email (opt-out / off-list)', async () => {
    unsubscribe.mockResolvedValue(true);
    const res = await POST(
      mailingRequest({ email: 'ct1@example.com', action: 'unsubscribe' }),
      routeParams
    );
    expect(res.status).toBe(200);
    expect(unsubscribe).toHaveBeenCalledWith('ct1@example.com');
    expect((await res.json()).subscribed).toBe(false);
  });

  it('allows join/opt-out on the student personal email', async () => {
    subscribe.mockResolvedValue(true);
    const res = await POST(
      mailingRequest({ email: 'student@example.com', action: 'subscribe' }),
      routeParams
    );
    expect(res.status).toBe(200);
    expect(subscribe).toHaveBeenCalledWith('student@example.com', undefined);
  });

  it('forwards the subscriber IP from x-forwarded-for to subscribeEmail', async () => {
    subscribe.mockResolvedValue(true);
    const res = await POST(
      mailingRequest({ email: 'ct1@example.com', action: 'subscribe' }, { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }),
      routeParams
    );
    expect(res.status).toBe(200);
    expect(subscribe).toHaveBeenCalledWith('ct1@example.com', '203.0.113.5');
  });

  it('rejects the SPS email and any address not on the row', async () => {
    const sps = await POST(
      mailingRequest({ email: 'student@seattleschools.org', action: 'subscribe' }),
      routeParams
    );
    expect(sps.status).toBe(400);

    const other = await POST(
      mailingRequest({ email: 'stranger@example.com', action: 'subscribe' }),
      routeParams
    );
    expect(other.status).toBe(400);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('returns 502 when Buttondown fails', async () => {
    subscribe.mockResolvedValue(false);
    const res = await POST(
      mailingRequest({ email: 'ct1@example.com', action: 'subscribe' }),
      routeParams
    );
    expect(res.status).toBe(502);
  });
});
