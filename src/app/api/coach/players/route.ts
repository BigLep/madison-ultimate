import { NextResponse } from 'next/server';
import { listRosteredPlayers } from '../../../../lib/coach-directory';

export async function GET() {
  try {
    const players = await listRosteredPlayers();
    return NextResponse.json({ success: true, players });
  } catch (error) {
    console.error('Error listing rostered players:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
