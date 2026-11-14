// Records that a Rostered Player has a Family Jersey (CONTEXT.md), so later seasons know they
// won't need a Program Jersey.

import { NextRequest, NextResponse } from 'next/server';
import { appendFamilyJersey } from '@/lib/jerseys-sheet';
import { isKnownJerseySize } from '@/lib/jerseys';
import { APP_CONFIG } from '@/lib/app-config';
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

    await appendFamilyJersey({
      playerId: player.playerId,
      playerName: player.fullName,
      size,
      seasonLabel: APP_CONFIG.SEASON_LABEL.replace(/\s+Season$/i, ''),
      by,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError('Error recording a Family Jersey', error);
  }
}
