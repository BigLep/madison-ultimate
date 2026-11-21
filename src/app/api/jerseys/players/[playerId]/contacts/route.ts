// A Rostered Player's caretaker names and emails, for a Jersey Manager following up on a jersey
// that hasn't come back. Behind the /api/jerseys gate, fetched one player at a time (only when a
// manager opens that player's More options), and never phone numbers or anything else from the
// Player Directory.

import { NextRequest, NextResponse } from 'next/server';
import { getPlayerDirectoryEntry } from '@/lib/coach-directory';
import { jsonError, serverError } from '@/lib/jerseys-api';
import { reminderCcList } from '@/lib/jersey-reminder';
import { APP_CONFIG } from '@/lib/app-config';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ playerId: string }> }) {
  try {
    const { playerId } = await params;
    const entry = await getPlayerDirectoryEntry(playerId);
    if (!entry) return jsonError('That player is not on the Roster.', 404);
    const contacts = entry.caretakers.filter(c => c.email.trim()).map(c => ({ name: c.name, email: c.email }));
    // Who every reminder email copies: the lead Jersey Manager (an env var, never committed) and the team inbox.
    const cc = reminderCcList(process.env.JERSEY_REMINDER_CC, APP_CONFIG.COACH_EMAIL);
    return NextResponse.json({ success: true, contacts, cc });
  } catch (error) {
    return serverError('Error reading caretaker contacts', error);
  }
}
