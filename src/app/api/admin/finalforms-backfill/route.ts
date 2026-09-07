// Final Forms Backfill (ADR 0005): an admin-triggered, on-demand pass over every signup row
// missing SPS Student ID, for players who finished Final Forms but never returned to /player
// to trigger the normal join. Unauthenticated like this repo's other admin routes; a rare,
// start-of-season action, not a background job.

import { NextResponse } from 'next/server';
import { listAllSignups } from '../../../../lib/signups-sheet';
import { backfillFinalFormsJoin, PossibleMatch } from '../../../../lib/final-forms';
import { SIGNUPS_COLUMNS } from '../../../../lib/signups-config';

export async function POST() {
  try {
    const signups = await listAllSignups();

    const report = {
      joined: [] as Array<{ playerId: string; studentId: string; subscribedEmails: string[] }>,
      unmatched: [] as Array<{
        playerId: string;
        preferredFirstName: string;
        lastName: string;
        signupDateOfBirth: string;
        possibleMatches: PossibleMatch[];
      }>,
      ambiguous: [] as Array<{ playerId: string; candidateCount: number }>,
      discrepancies: [] as Array<{ playerId: string; storedStudentId: string; freshMatchStudentId: string }>,
      noSnapshot: false,
    };

    for (const signup of signups) {
      const playerId = signup[SIGNUPS_COLUMNS.PLAYER_ID];
      if (!playerId) continue;

      const outcome = await backfillFinalFormsJoin(playerId, signup);

      // A missing/unreadable Final Forms export affects every remaining row identically, and
      // loadSnapshot() only caches on success, so continuing here would re-attempt the same
      // failing Drive fetch once per remaining row instead of failing fast.
      if (outcome.kind === 'no-snapshot') {
        report.noSnapshot = true;
        break;
      }

      switch (outcome.kind) {
        case 'joined':
          report.joined.push({
            playerId,
            studentId: outcome.match.record.studentId,
            subscribedEmails: outcome.firstJoin.subscribedEmails,
          });
          break;
        case 'unmatched':
          report.unmatched.push({
            playerId,
            preferredFirstName: signup[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME],
            lastName: signup[SIGNUPS_COLUMNS.LAST_NAME],
            signupDateOfBirth: signup[SIGNUPS_COLUMNS.DATE_OF_BIRTH],
            possibleMatches: outcome.possibleMatches,
          });
          break;
        case 'ambiguous':
          report.ambiguous.push({ playerId, candidateCount: outcome.candidateCount });
          break;
        case 'already-joined-discrepancy':
          report.discrepancies.push({
            playerId,
            storedStudentId: outcome.storedStudentId,
            freshMatchStudentId: outcome.freshMatchStudentId,
          });
          break;
        case 'already-joined-consistent':
          break;
      }
    }

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('Error running Final Forms Backfill:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
