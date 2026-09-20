import { NextRequest, NextResponse } from 'next/server';
import { getPlayerDirectoryEntry } from '../../../../../lib/coach-directory';

export async function GET(request: NextRequest, { params }: { params: Promise<{ playerId: string }> }) {
  try {
    const { playerId } = await params;
    if (!playerId) {
      return NextResponse.json({ success: false, error: 'Player ID is required' }, { status: 400 });
    }

    const player = await getPlayerDirectoryEntry(playerId);
    if (!player) {
      return NextResponse.json({ success: false, error: 'Player not found on a team roster' }, { status: 404 });
    }

    return NextResponse.json({ success: true, player });
  } catch (error) {
    console.error('Error fetching player directory entry:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
