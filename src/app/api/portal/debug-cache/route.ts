import { NextResponse } from 'next/server';
import { getPortalCache } from '../../../../lib/portal-cache';

export async function GET() {
  try {
    const entries = await getPortalCache();

    // Return first 10 entries for debugging
    const sample = entries.slice(0, 10);

    return NextResponse.json({
      success: true,
      totalEntries: entries.length,
      sampleEntries: sample
    });
  } catch (error) {
    console.error('Error getting portal cache debug info:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}