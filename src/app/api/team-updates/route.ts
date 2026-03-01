import { NextRequest, NextResponse } from 'next/server';
import {
  getTeamUpdatesFromRss,
  getTeamUpdatesCacheStatus,
} from '../../../lib/buttondown-rss';

const MAX_RESULTS_DEFAULT = 10;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const maxResults = parseInt(
      searchParams.get('maxResults') || MAX_RESULTS_DEFAULT.toString(),
      10
    );

    const cacheStatusBefore = getTeamUpdatesCacheStatus();
    const messages = await getTeamUpdatesFromRss(maxResults);
    const cacheStatusAfter = getTeamUpdatesCacheStatus();

    return NextResponse.json({
      success: true,
      messages,
      cache: {
        wasCached: cacheStatusBefore.cached,
        isNowCached: cacheStatusAfter.cached,
        messageCount: cacheStatusAfter.messageCount,
        cacheAge: cacheStatusAfter.age,
      },
    });
  } catch (error) {
    console.error('Error fetching team updates:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
