import { NextRequest, NextResponse } from 'next/server';
import { findSignupByPlayerId } from '../../../../../../lib/signups-sheet';
import { findFinalFormsMatch, applyFirstJoinSideEffects, getFinalFormsDataAsOf } from '../../../../../../lib/final-forms';

export async function GET(request: NextRequest, { params }: { params: Promise<{ playerId: string }> }) {
  try {
    const { playerId } = await params;
    const existing = await findSignupByPlayerId(playerId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    const match = await findFinalFormsMatch(existing.record);
    if (!match) {
      return NextResponse.json({
        success: true,
        found: false,
        dataAsOf: await getFinalFormsDataAsOf(existing.record),
      });
    }

    // Seeded Fields copy only on first join (ADR 0004); after that the row owns them, so a
    // family can clear a field and it stays empty on every later visit.
    const { fieldsCopied, photoCarriedOver } = await applyFirstJoinSideEffects(playerId, existing.record, match);

    return NextResponse.json({
      success: true,
      found: true,
      dataAsOf: match.dataAsOf,
      parentSigned: match.record.parentSigned,
      studentSigned: match.record.studentSigned,
      physicalCleared: match.record.physicalCleared,
      physicalClearanceExpiration: match.record.physicalClearanceExpiration,
      fieldsCopied,
      photoCarriedOver,
    });
  } catch (error) {
    console.error('Error fetching Final Forms status:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
