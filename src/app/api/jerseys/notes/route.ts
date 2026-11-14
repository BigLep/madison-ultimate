// Jersey Notes (CONTEXT.md): free-form observations a Jersey Manager records on the spot,
// optionally about a Player or a size. Add-only; mistakes are fixed in the sheet.

import { NextRequest, NextResponse } from 'next/server';
import { appendNote } from '@/lib/jerseys-sheet';
import { isKnownJerseySize, MAX_NOTE_LENGTH } from '@/lib/jerseys';
import { readWriteBody, findRosteredPlayer, jsonError, serverError } from '@/lib/jerseys-api';

export async function POST(request: NextRequest) {
  try {
    const parsed = await readWriteBody(request);
    if (parsed instanceof NextResponse) return parsed;
    const { body, by } = parsed;

    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (!note) return jsonError('The note is empty.', 400);
    if (note.length > MAX_NOTE_LENGTH) return jsonError(`Notes are limited to ${MAX_NOTE_LENGTH} characters.`, 400);

    let playerId = '';
    let playerName = '';
    if (body.playerId) {
      const player = await findRosteredPlayer(body.playerId);
      if (!player) return jsonError('That player is not on the Roster.', 400);
      playerId = player.playerId;
      playerName = player.fullName;
    }
    const size = typeof body.size === 'string' ? body.size.trim().toUpperCase() : '';
    if (size && !isKnownJerseySize(size)) return jsonError(`Unknown size: ${size}`, 400);

    await appendNote({ playerId, playerName, size, note, by, nowIso: new Date().toISOString() });
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError('Error saving a Jersey Note', error);
  }
}
