import { NextRequest, NextResponse } from 'next/server';
import { getGroupMessages, getGmailCacheStatus, GMAIL_CACHE_CONFIG } from '../../../lib/gmail-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const maxResults = parseInt(searchParams.get('maxResults') || GMAIL_CACHE_CONFIG.MAX_RESULTS_DEFAULT.toString());

    const cacheStatusBefore = getGmailCacheStatus();
    const messages = await getGroupMessages(maxResults);
    const cacheStatusAfter = getGmailCacheStatus();

    return NextResponse.json({
      success: true,
      messages,
      cache: {
        wasCached: cacheStatusBefore.cached,
        isNowCached: cacheStatusAfter.cached,
        messageCount: cacheStatusAfter.messageCount,
        cacheAge: cacheStatusAfter.age,
      }
    });

  } catch (error) {
    console.error('Error fetching group messages:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}