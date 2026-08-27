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

/**
 * Subscribe an email as type "regular" (skips double opt-in/confirmation email), using the
 * collision-behavior header so re-saving an already-subscribed email never errors.
 * Returns true on success, false on failure (never throws; a subscribe failure should not block a profile save).
 */
export async function subscribeEmail(email: string): Promise<boolean> {
  const apiKey = process.env.BUTTONDOWN_API_KEY;
  const trimmed = email?.trim();
  if (!apiKey || !trimmed) return false;

  try {
    const res = await fetch(`${API_BASE}/subscribers`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Buttondown-Collision-Behavior': 'overwrite',
      },
      body: JSON.stringify({ email_address: trimmed, type: 'regular' }),
    });

    if (!res.ok) {
      console.error(`Buttondown subscribe failed for an email: ${res.status}`);
      return false;
    }

    invalidateSubscriberCache();
    return true;
  } catch (error) {
    console.error('Error subscribing email to Buttondown:', error);
    return false;
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
      console.error(`Buttondown unsubscribe failed for an email: ${res.status}`);
      return false;
    }

    invalidateSubscriberCache();
    return true;
  } catch (error) {
    console.error('Error unsubscribing email from Buttondown:', error);
    return false;
  }
}
