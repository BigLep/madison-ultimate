import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '../../../../lib/gmail-oauth';

export async function GET(request: NextRequest) {
  try {
    const authUrl = getAuthUrl();

    return NextResponse.json({
      success: true,
      authUrl
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}