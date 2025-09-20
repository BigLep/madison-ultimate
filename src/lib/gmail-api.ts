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

      // Extract body text
      let body = '';
      if (messageDetail.data.payload?.body?.data) {
        body = Buffer.from(messageDetail.data.payload.body.data, 'base64').toString('utf-8');
      } else if (messageDetail.data.payload?.parts) {
        // Look for text/plain part
        const textPart = messageDetail.data.payload.parts.find(
          part => part.mimeType === 'text/plain'
        );
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        }
      }

      messages.push({
        id: message.id,
        threadId: message.threadId || '',
        subject,
        from: from.replace(/.*<(.+)>.*/, '$1'), // Extract email from "Name <email>" format
        date: new Date(date).toISOString(),
        snippet: messageDetail.data.snippet || '',
        body: body.substring(0, 500), // Limit body length
      });
    }

    // Sort by date (newest first)
    return messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  } catch (error) {
    console.error('Error fetching group messages:', error);
    return [];
  }
}