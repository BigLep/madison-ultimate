import { google } from 'googleapis';
import { getGmailClient } from './gmail-oauth';

const GOOGLE_GROUP_EMAIL = 'madisonultimatefall25@googlegroups.com';

// Gmail API caching configuration
export const GMAIL_CACHE_CONFIG = {
  CACHE_DURATION_MS: 5 * 60 * 1000, // 5 minutes in milliseconds
  MAX_RESULTS_DEFAULT: 10, // Default number of messages to fetch
} as const;

// In-memory cache for Gmail messages
interface CacheEntry {
  data: GroupMessage[];
  timestamp: number;
  maxResults: number;
}

let messageCache: CacheEntry | null = null;

export interface GroupMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body?: string;
  htmlBody?: string;
}

// Helper function to check if cache is valid
function isCacheValid(maxResults: number): boolean {
  if (!messageCache) return false;

  const now = Date.now();
  const cacheAge = now - messageCache.timestamp;

  // Cache is valid if it's within the duration and maxResults matches or exceeds what we need
  return cacheAge < GMAIL_CACHE_CONFIG.CACHE_DURATION_MS && messageCache.maxResults >= maxResults;
}

export async function getGroupMessages(maxResults: number = GMAIL_CACHE_CONFIG.MAX_RESULTS_DEFAULT): Promise<GroupMessage[]> {
  try {
    // Check cache first
    if (isCacheValid(maxResults)) {
      console.log('Gmail cache hit - returning cached messages');
      return messageCache!.data.slice(0, maxResults);
    }

    console.log('Gmail cache miss - fetching from API');
    const gmail = await getGmailClient();

    // Search for messages sent by madisonultimate@gmail.com to the group
    const queries = [
      `from:madisonultimate@gmail.com to:${GOOGLE_GROUP_EMAIL}`,
      `from:madisonultimate@gmail.com ${GOOGLE_GROUP_EMAIL}`,
    ];

    let response;
    let lastError;

    // Try different query approaches
    for (const query of queries) {
      try {
        response = await gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults,
        });
        break; // Success, exit loop
      } catch (error) {
        console.log(`Gmail search failed for query "${query}":`, error);
        lastError = error;
        continue; // Try next query
      }
    }

    if (!response) {
      throw lastError || new Error('All Gmail search queries failed');
    }

    if (!response.data.messages) {
      return [];
    }

    // Get full message details for each message
    const messages: GroupMessage[] = [];

    for (const message of response.data.messages) {
      if (!message.id) continue;

      const messageDetail = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full',
      });

      const headers = messageDetail.data.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown Sender';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      // Extract body text and HTML with recursive part searching
      let body = '';
      let htmlBody = '';

      const extractFromParts = (parts: any[]): void => {
        for (const part of parts) {
          if (part.mimeType === 'text/plain' && part.body?.data && !body) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.mimeType === 'text/html' && part.body?.data && !htmlBody) {
            htmlBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.parts) {
            // Recursively search nested parts
            extractFromParts(part.parts);
          }
        }
      };

      if (messageDetail.data.payload?.body?.data) {
        // Simple case: body is directly in payload
        body = Buffer.from(messageDetail.data.payload.body.data, 'base64').toString('utf-8');
      } else if (messageDetail.data.payload?.parts) {
        // Complex case: search through parts (potentially nested)
        extractFromParts(messageDetail.data.payload.parts);
      }

      messages.push({
        id: message.id,
        threadId: message.threadId || '',
        subject,
        from: from.replace(/.*<(.+)>.*/, '$1'), // Extract email from "Name <email>" format
        date: new Date(date).toISOString(),
        snippet: messageDetail.data.snippet || '',
        body: body, // Keep full body text
        htmlBody: htmlBody, // Keep full HTML body
      });
    }

    // Sort by date (newest first)
    const sortedMessages = messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Cache the messages (always cache the full result regardless of maxResults requested)
    messageCache = {
      data: sortedMessages,
      timestamp: Date.now(),
      maxResults: maxResults,
    };

    console.log(`Gmail messages cached - ${sortedMessages.length} messages for ${maxResults} maxResults`);

    return sortedMessages;

  } catch (error) {
    console.error('Error fetching group messages:', error);
    return [];
  }
}

// Function to manually clear the Gmail cache (useful for debugging or forced refresh)
export function clearGmailCache(): void {
  messageCache = null;
  console.log('Gmail cache cleared');
}

// Function to get cache status (useful for debugging)
export function getGmailCacheStatus(): { cached: boolean; age?: number; messageCount?: number; maxResults?: number } {
  if (!messageCache) {
    return { cached: false };
  }

  const age = Date.now() - messageCache.timestamp;
  return {
    cached: true,
    age,
    messageCount: messageCache.data.length,
    maxResults: messageCache.maxResults,
  };
}