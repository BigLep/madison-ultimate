// The Player Portal's Program Jersey status (ADR 0009): open loan size, last return, unpaid Lost
// Jersey Fees, plus the season's return events. Keyed by PlayerID and ungated, like the practice and game routes, so it returns
// only that player's own status: never Jersey Notes, names, or other players.

import { NextRequest, NextResponse } from 'next/server';
import { readLoans } from '@/lib/jerseys-sheet';
import { portalJerseyStatus } from '@/lib/jerseys';
import { APP_CONFIG } from '@/lib/app-config';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  try {
    const status = portalJerseyStatus(playerId, await readLoans());
    return NextResponse.json({ success: true, ...status, returnEvents: APP_CONFIG.JERSEY_RETURN_EVENTS });
  } catch (error) {
    // The jersey card is an extra on the Home tab; a broken read must not look like an error there.
    console.error('Error reading jersey status for the Player Portal:', error);
    return NextResponse.json({ success: false, error: 'Jersey status unavailable' }, { status: 503 });
  }
}
