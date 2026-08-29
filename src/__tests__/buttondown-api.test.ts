import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { subscribeUnlessUnsubscribed } from '@/lib/buttondown-api';

const EMAIL = 'ct1@example.com';
const encoded = encodeURIComponent(EMAIL);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('subscribeUnlessUnsubscribed', () => {
  const originalKey = process.env.BUTTONDOWN_API_KEY;

  beforeEach(() => {
    process.env.BUTTONDOWN_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env.BUTTONDOWN_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it('does not resubscribe an email that has opted out', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ type: 'unsubscribed' }));

    expect(await subscribeUnlessUnsubscribed(EMAIL)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.buttondown.com/v1/subscribers/${encoded}`);
    expect((fetchMock.mock.calls[0][1] as RequestInit).method ?? 'GET').toBe('GET');
  });

  it('skips an email that is already subscribed', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ type: 'regular' }));

    expect(await subscribeUnlessUnsubscribed(EMAIL)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('subscribes an email that is not on the list', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(jsonResponse({ type: 'regular' }, 201));

    expect(await subscribeUnlessUnsubscribed(EMAIL)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe('POST');
  });
});
