import { NextRequest, NextResponse } from 'next/server';
import { getGroupMessages } from '../../../lib/gmail-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const maxResults = parseInt(searchParams.get('maxResults') || '5');

    const messages = await getGroupMessages(maxResults);

    return NextResponse.json({
      success: true,
      messages
    });

  } catch (error) {
    console.error('Error fetching group messages:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}