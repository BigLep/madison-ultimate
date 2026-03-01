/**
 * Fetch and parse Buttondown newsletter RSS for "Recent Team Updates".
 * Cached for 5 minutes to avoid hammering the public feed.
 */

import { XMLParser } from 'fast-xml-parser';

const BUTTONDOWN_RSS_URL = 'https://buttondown.com/madisonultimate/rss';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: TeamUpdate[];
  timestamp: number;
}

let cache: CacheEntry | null = null;

export interface TeamUpdate {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body?: string;
  htmlBody?: string;
}

function isCacheValid(): boolean {
  if (!cache) return false;
  return Date.now() - cache.timestamp < CACHE_DURATION_MS;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

export async function getTeamUpdatesFromRss(maxResults: number = 10): Promise<TeamUpdate[]> {
  if (isCacheValid() && cache!.data.length >= maxResults) {
    return cache!.data.slice(0, maxResults);
  }

  const parser = new XMLParser({ ignoreAttributes: false });
  const res = await fetch(`${BUTTONDOWN_RSS_URL}?count=${Math.max(maxResults, 30)}`, {
    next: { revalidate: 0 },
    headers: { 'User-Agent': 'MadisonUltimatePortal/1.0' },
  });

  if (!res.ok) {
    throw new Error(`Buttondown RSS failed: ${res.status}`);
  }

  const xml = await res.text();
  const parsed = parser.parse(xml);

  const channel = parsed?.rss?.channel;
  if (!channel) {
    throw new Error('Invalid RSS: no channel');
  }

  const rawItems = channel.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  const fromName = channel.title || 'Madison Ultimate';

  const updates: TeamUpdate[] = items.map((item: Record<string, string>) => {
    const title = item.title || 'No subject';
    const link = item.link || item.guid || '';
    const pubDate = item.pubDate || '';
    const description = item.description || item['content:encoded'] || item.content || '';
    const snippet = stripHtml(description);
    const date = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();

    return {
      id: link || `rss-${title.slice(0, 20)}`,
      threadId: link,
      subject: title,
      from: fromName,
      date,
      snippet: snippet || title,
      body: description,
      htmlBody: description?.startsWith('<') ? description : undefined,
    };
  });

  cache = { data: updates, timestamp: Date.now() };
  return updates.slice(0, maxResults);
}

export function getTeamUpdatesCacheStatus(): {
  cached: boolean;
  age?: number;
  messageCount?: number;
} {
  if (!cache) return { cached: false };
  return {
    cached: true,
    age: Date.now() - cache.timestamp,
    messageCount: cache.data.length,
  };
}
