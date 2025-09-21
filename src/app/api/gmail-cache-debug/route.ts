import { NextRequest, NextResponse } from 'next/server';
import { getGmailCacheStatus, clearGmailCache } from '../../../lib/gmail-api';

export async function GET() {
  const status = getGmailCacheStatus();

  return NextResponse.json({
    success: true,
    cache: {
      ...status,
      cacheAgeMinutes: status.age ? Math.round(status.age / 60000 * 100) / 100 : undefined,
    }
  });
}

export async function DELETE() {
  clearGmailCache();

  return NextResponse.json({
    success: true,
    message: 'Gmail cache cleared'
  });
}