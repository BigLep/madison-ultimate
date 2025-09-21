import { google } from 'googleapis';
import { getGmailClient } from './gmail-oauth';

const GOOGLE_GROUP_EMAIL = 'madisonultimatefall25@googlegroups.com';

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

export async function getGroupMessages(maxResults: number = 10): Promise<GroupMessage[]> {
  try {
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
    return messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  } catch (error) {
    console.error('Error fetching group messages:', error);
    return [];
  }
}