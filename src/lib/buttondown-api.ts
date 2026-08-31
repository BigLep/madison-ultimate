/**
 * Buttondown API helpers for subscriber list (mailing list status).
 * Cached for 5 minutes to avoid hammering the API.
 */

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const API_BASE = 'https://api.buttondown.com/v1';

interface CacheEntry {
  emails: Set<string>;
  timestamp: number;
}

let subscriberCache: CacheEntry | null = null;

function isCacheValid(): boolean {
  if (!subscriberCache) return false;
  return Date.now() - subscriberCache.timestamp < CACHE_DURATION_MS;
}

interface SubscriberResponse {
  results?: Array<{ email_address?: string; type?: string }>;
  count?: number;
  next?: string | null;
}

/**
 * Fetch all active subscriber emails from Buttondown (paginated), cache for 5 minutes.
 * Excludes unsubscribed (type === 'unsubscribed').
 */
export async function getSubscriberEmails(): Promise<Set<string>> {
  const apiKey = process.env.BUTTONDOWN_API_KEY;
  if (!apiKey) {
    throw new Error('BUTTONDOWN_API_KEY is not set');
  }

  if (isCacheValid()) {
    return subscriberCache!.emails;
  }

  const emails = new Set<string>();
  let url: string | null = `${API_BASE}/subscribers`;
  let requestCount = 0;

  while (url && requestCount < 50) {
    const res = await fetch(url, {
      headers: { Authorization: `Token ${apiKey}` },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error('Buttondown API key invalid');
      if (res.status === 403) throw new Error('Buttondown API forbidden');
      throw new Error(`Buttondown API error: ${res.status}`);
    }

    const data: SubscriberResponse = await res.json();
    const results = data.results || [];

    for (const sub of results) {
      const email = sub.email_address?.trim().toLowerCase();
      if (email && sub.type !== 'unsubscribed') {
        emails.add(email);
      }
    }

    url = data.next || null;
    requestCount++;
  }

  subscriberCache = { emails, timestamp: Date.now() };
  return emails;
}

/**
 * Check if an email is in the Buttondown subscriber list. Returns null if API key not set or API fails.
 */
export async function isSubscriber(email: string): Promise<boolean | null> {
  if (!email?.trim()) return false;
  try {
    const set = await getSubscriberEmails();
    return set.has(email.trim().toLowerCase());
  } catch {
    return null;
  }
}

function invalidateSubscriberCache(): void {
  subscriberCache = null;
}

async function logFailedWrite(action: string, res: Response): Promise<void> {
  const text = await res.text();
  let suffix = '';
  try {
    const data = JSON.parse(text) as { code?: string; detail?: string; error?: string };
    suffix = [data.code, data.detail ?? data.error].filter(Boolean).join(' ');
  } catch {
    suffix = text.slice(0, 200);
  }
  console.error(`Buttondown ${action} failed for an email: ${res.status}${suffix ? ` ${suffix}` : ''}`);
}

export type SubscriberStatus = 'subscribed' | 'unsubscribed' | 'absent';

/**
 * Look up one email on Buttondown, including people who have opted out.
 * Returns null if the API key is missing or the request fails.
 */
export async function getSubscriberStatus(email: string): Promise<SubscriberStatus | null> {
  const apiKey = process.env.BUTTONDOWN_API_KEY;
  const trimmed = email?.trim();
  if (!trimmed) return 'absent';
  if (!apiKey) return null;

  try {
    const res = await fetch(`${API_BASE}/subscribers/${encodeURIComponent(trimmed)}`, {
      headers: { Authorization: `Token ${apiKey}` },
      next: { revalidate: 0 },
    });
    if (res.status === 404) return 'absent';
    if (!res.ok) return null;

    const data: { type?: string; subscriber_type?: string } = await res.json();
    const type = data.type ?? data.subscriber_type;
    return type === 'unsubscribed' ? 'unsubscribed' : 'subscribed';
  } catch (error) {
    console.error('Error looking up Buttondown subscriber:', error);
    return null;
  }
}

/**
 * Subscribe an email unless it is already on the list or has opted out.
 * Never re-subscribes an unsubscribed address. Never throws.
 */
export async function subscribeUnlessUnsubscribed(email: string, ipAddress?: string): Promise<boolean> {
  const apiKey = process.env.BUTTONDOWN_API_KEY;
  const trimmed = email?.trim();
  const status = await getSubscriberStatus(email);
  if (status === 'unsubscribed' || status === 'subscribed') return true;
  if (status === 'absent') {
    if (!apiKey || !trimmed) return false;
    return performSubscribe(trimmed, apiKey, 'absent', ipAddress);
  }
  return false;
}

/**
 * Subscribe or resubscribe an email as type "regular" (skips double opt-in).
 * Leave marks the address unsubscribed; Buttondown will not let POST+overwrite
 * flip that sticky type (400 subscriber_suppressed). Join must PATCH type back
 * to regular. New addresses are created with collision `add`.
 * Returns true on success, false on failure (never throws).
 */
export async function subscribeEmail(email: string, ipAddress?: string): Promise<boolean> {
  const apiKey = process.env.BUTTONDOWN_API_KEY;
  const trimmed = email?.trim();
  if (!apiKey || !trimmed) return false;

  const status = await getSubscriberStatus(trimmed);
  if (status === 'subscribed') return true;
  if (status === null) return false;

  return performSubscribe(trimmed, apiKey, status, ipAddress);
}

/** Shared PATCH/POST write for subscribeEmail and subscribeUnlessUnsubscribed, given an already-known status. */
async function performSubscribe(
  trimmed: string,
  apiKey: string,
  status: 'unsubscribed' | 'absent',
  ipAddress?: string
): Promise<boolean> {
  try {
    const res =
      status === 'unsubscribed'
        ? await fetch(`${API_BASE}/subscribers/${encodeURIComponent(trimmed)}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Token ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ type: 'regular' }),
            next: { revalidate: 0 },
          })
        : await fetch(`${API_BASE}/subscribers`, {
            method: 'POST',
            headers: {
              Authorization: `Token ${apiKey}`,
              'Content-Type': 'application/json',
              'X-Buttondown-Collision-Behavior': 'add',
            },
            body: JSON.stringify({
              email_address: trimmed,
              type: 'regular',
              ...(ipAddress ? { ip_address: ipAddress } : {}),
            }),
            next: { revalidate: 0 },
          });

    if (!res.ok) {
      await logFailedWrite('subscribe', res);
      return false;
    }

    invalidateSubscriberCache();
    return true;
  } catch (error) {
    console.error('Error subscribing email to Buttondown:', error);
    return false;
  }
}

/**
 * Address used only to probe subscriber write permission. It should never exist
 * on the list. PATCH on a missing subscriber is 404 when the key can write, and
 * 403 when the key is read-only — same shape as the GitHub Actions write probe
 * in /api/diagnostics, and it never creates or unsubscribes a real person.
 */
export const BUTTONDOWN_WRITE_PROBE_EMAIL = 'madison-ultimate-diagnostics-probe@invalid';

/**
 * `status` is the single source of truth for what happened; `read`/`write` are
 * derived from it and kept only so existing callers/tests can match on them
 * without a switch of their own (see /api/diagnostics, which switches on
 * `status` alone rather than re-deriving these four cases from the booleans).
 */
export type ButtondownProbeStatus = 'not-configured' | 'no-access' | 'read-only' | 'full-access';

export type ButtondownPermissionProbe =
  | { configured: false; status: 'not-configured'; message: string }
  | { configured: true; status: ButtondownProbeStatus; read: boolean; write: boolean; message: string };

/**
 * Read + write check for BUTTONDOWN_API_KEY. Never creates a subscriber.
 * Used by /api/diagnostics so a read-only key fails loudly instead of looking
 * like Join / Leave "did nothing."
 */
export async function probeButtondownPermissions(): Promise<ButtondownPermissionProbe> {
  const apiKey = process.env.BUTTONDOWN_API_KEY;
  if (!apiKey) {
    return { configured: false, status: 'not-configured', message: 'BUTTONDOWN_API_KEY is not set' };
  }

  const headers = { Authorization: `Token ${apiKey}` };

  try {
    const listRes = await fetch(`${API_BASE}/subscribers?page_size=1`, {
      headers,
      next: { revalidate: 0 },
    });
    if (listRes.status === 401) {
      return {
        configured: true,
        status: 'no-access',
        read: false,
        write: false,
        message: 'BUTTONDOWN_API_KEY was rejected (invalid or revoked)',
      };
    }
    if (!listRes.ok) {
      return {
        configured: true,
        status: 'no-access',
        read: false,
        write: false,
        message: `Could not list subscribers (HTTP ${listRes.status})`,
      };
    }

    const writeRes = await fetch(
      `${API_BASE}/subscribers/${encodeURIComponent(BUTTONDOWN_WRITE_PROBE_EMAIL)}`,
      {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'unsubscribed' }),
        next: { revalidate: 0 },
      }
    );

    // 404: no such subscriber (expected) and the key was allowed to try. 200 would
    // mean the probe address somehow exists; either way the key can write.
    if (writeRes.status === 404 || writeRes.status === 200) {
      return {
        configured: true,
        status: 'full-access',
        read: true,
        write: true,
        message:
          'Key can list subscribers and has subscriber write (probed via PATCH on a nonexistent address)',
      };
    }
    if (writeRes.status === 403) {
      return {
        configured: true,
        status: 'read-only',
        read: true,
        write: false,
        message:
          'Key can list subscribers but lacks subscriber write, so Join / Leave and auto-subscribe will fail. In Buttondown → API → Keys, set subscriber access to write',
      };
    }
    return {
      configured: true,
      status: 'read-only',
      read: true,
      write: false,
      message: `Unexpected response probing subscriber write (HTTP ${writeRes.status})`,
    };
  } catch (error) {
    return {
      configured: true,
      status: 'no-access',
      read: false,
      write: false,
      message: error instanceof Error ? error.message : 'Unknown error probing Buttondown',
    };
  }
}

/** Unsubscribe an email (one-click opt-out). Returns true on success, false on failure. */
export async function unsubscribeEmail(email: string): Promise<boolean> {
  const apiKey = process.env.BUTTONDOWN_API_KEY;
  const trimmed = email?.trim();
  if (!apiKey || !trimmed) return false;

  try {
    const res = await fetch(`${API_BASE}/subscribers/${encodeURIComponent(trimmed)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'unsubscribed' }),
    });

    if (!res.ok) {
      await logFailedWrite('unsubscribe', res);
      return false;
    }

    invalidateSubscriberCache();
    return true;
  } catch (error) {
    console.error('Error unsubscribing email from Buttondown:', error);
    return false;
  }
}
