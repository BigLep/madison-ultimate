import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BUTTONDOWN_WRITE_PROBE_EMAIL,
  probeButtondownPermissions,
  subscribeEmail,
  subscribeUnlessUnsubscribed,
} from '@/lib/buttondown-api';

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

describe('subscribeEmail', () => {
  const originalKey = process.env.BUTTONDOWN_API_KEY;

  beforeEach(() => {
    process.env.BUTTONDOWN_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env.BUTTONDOWN_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it('resubscribes an opted-out address with PATCH, not POST overwrite', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ type: 'unsubscribed' }))
      .mockResolvedValueOnce(jsonResponse({ type: 'regular' }));

    expect(await subscribeEmail(EMAIL)).toBe(true);
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe('PATCH');
    expect(fetchMock.mock.calls[1][0]).toBe(`https://api.buttondown.com/v1/subscribers/${encoded}`);
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)).toEqual({
      type: 'regular',
    });
  });

  it('creates an absent address with collision add', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(jsonResponse({ type: 'regular' }, 201));

    expect(await subscribeEmail(EMAIL)).toBe(true);
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toMatchObject({
      'X-Buttondown-Collision-Behavior': 'add',
    });
  });
});

describe('probeButtondownPermissions', () => {
  const originalKey = process.env.BUTTONDOWN_API_KEY;

  beforeEach(() => {
    process.env.BUTTONDOWN_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env.BUTTONDOWN_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it('reports unconfigured when the key is missing', async () => {
    delete process.env.BUTTONDOWN_API_KEY;
    expect(await probeButtondownPermissions()).toEqual({
      configured: false,
      status: 'not-configured',
      message: 'BUTTONDOWN_API_KEY is not set',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('passes write when PATCH on the probe address is 404', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    const probe = await probeButtondownPermissions();
    expect(probe).toMatchObject({ configured: true, read: true, write: true });
    expect(fetchMock.mock.calls[1][0]).toBe(
      `https://api.buttondown.com/v1/subscribers/${encodeURIComponent(BUTTONDOWN_WRITE_PROBE_EMAIL)}`
    );
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe('PATCH');
  });

  it('fails write (not read) when the key is read-only', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ detail: 'You do not have permission to access this resource.' }, 403));

    expect(await probeButtondownPermissions()).toMatchObject({
      configured: true,
      read: true,
      write: false,
    });
  });
});
