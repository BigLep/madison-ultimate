// Signup Outreach (ADR 0007): every signup row with the six checklist rows the player page
// shows, a Checklist Complete flag, and recipient emails. Read-only; gated by Basic Auth in
// src/proxy.ts. The draft script (scripts/outreach-drafts.mjs) and the admin page both read it.

import { NextRequest, NextResponse } from 'next/server';
import { listAllSignups } from '../../../../lib/signups-sheet';
import { findFinalFormsMatch, getFinalFormsDataAsOf } from '../../../../lib/final-forms';
import { buildOutreachEntry, selectAudience, sortForDisplay } from '../../../../lib/signup-outreach';

export async function GET(request: NextRequest) {
  try {
    const signups = await listAllSignups();
    const baseUrl = new URL(request.url).origin;

    // findFinalFormsMatch is a pure read (by SPS Student ID, else name plus birthdate). The
    // family route's first-join side effects are deliberately not run here.
    const entries = await Promise.all(
      signups.map(async record => {
        const match = await findFinalFormsMatch(record);
        return buildOutreachEntry(record, match ? { found: true, ...match.record } : null, baseUrl);
      })
    );

    // The export's "data as of": read via a joined row when there is one (a magic-name fixture
    // row would otherwise answer with the fixture date for the whole list).
    const joinedIndex = entries.findIndex(entry => entry.finalFormsDetail.found);
    const stampRow = signups[joinedIndex >= 0 ? joinedIndex : 0];
    const dataAsOf = stampRow ? (await getFinalFormsDataAsOf(stampRow)) ?? null : null;

    const players = sortForDisplay(entries);
    const unreachable = players
      .filter(entry => entry.unreachableReason !== null)
      .map(entry => ({ playerId: entry.playerId, fullName: entry.fullName, reason: entry.unreachableReason }));

    // Selection lives here, once, so the draft script never reimplements it. `players` query
    // values (repeatable) are PlayerIDs or Full Names; absent, the audience is the next wave.
    const lines = request.nextUrl.searchParams.getAll('players');
    let audience;
    try {
      audience = selectAudience(players, lines.length > 0 ? lines : undefined);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Bad players selection' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      dataAsOf,
      players,
      unreachable,
      audience: {
        selectedPlayerIds: audience.selected.map(entry => entry.playerId),
        skipped: audience.skipped,
      },
      counts: {
        total: players.length,
        notChecklistComplete: players.filter(entry => !entry.checklistComplete).length,
        unreachable: unreachable.length,
      },
    });
  } catch (error) {
    console.error('Error building the Signup Outreach list:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
