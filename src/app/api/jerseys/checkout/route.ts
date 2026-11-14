// Check-out (CONTEXT.md): a Jersey Manager hands a Rostered Player a Program Jersey. Warnings
// (already has an open loan, has a Family Jersey) are shown by the client; the server does not
// block them, since a manager may have a reason.

import { NextRequest, NextResponse } from 'next/server';
import { appendLoan } from '@/lib/jerseys-sheet';
import { isKnownJerseySize } from '@/lib/jerseys';
import { readWriteBody, findRosteredPlayer, jsonError, serverError } from '@/lib/jerseys-api';

export async function POST(request: NextRequest) {
  try {
    const parsed = await readWriteBody(request);
    if (parsed instanceof NextResponse) return parsed;
    const { body, by } = parsed;

    const player = await findRosteredPlayer(body.playerId);
    if (!player) return jsonError('That player is not on the Roster.', 400);
    const size = typeof body.size === 'string' ? body.size.trim().toUpperCase() : '';
    if (!isKnownJerseySize(size)) return jsonError(`Unknown size: ${size || '(blank)'}`, 400);

    const loanId = await appendLoan({ playerId: player.playerId, playerName: player.fullName, size, by, nowIso: new Date().toISOString() });
    return NextResponse.json({ success: true, loanId });
  } catch (error) {
    return serverError('Error checking out a jersey', error);
  }
}
