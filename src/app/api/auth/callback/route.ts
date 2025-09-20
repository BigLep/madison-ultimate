import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '../../../../lib/gmail-oauth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.json({
        success: false,
        error: `OAuth error: ${error}`
      }, { status: 400 });
    }

    if (!code) {
      return NextResponse.json({
        success: false,
        error: 'No authorization code provided'
      }, { status: 400 });
    }

    const tokens = await getTokensFromCode(code);

    // In production, you'd store this securely. For setup, we'll display it.
    return NextResponse.json({
      success: true,
      message: 'Authorization successful! Add this refresh token to your .env.local:',
      refreshToken: tokens.refresh_token,
      instructions: `Add this to your .env.local file:\nGMAIL_REFRESH_TOKEN=${tokens.refresh_token}`
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}