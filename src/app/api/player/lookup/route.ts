import { NextRequest, NextResponse } from 'next/server';
import { findSignupsByLastNameAndBirthdate } from '../../../../lib/signups-sheet';
import { SIGNUPS_COLUMNS } from '../../../../lib/signups-config';

// Portal Login lookup (docs/fall-2026/player-portal-grill.md Q2, Q4): normalized last name plus
// full birthdate against the Signups sheet, never the coach Roster. Zero matches is a 404 the
// client turns into the "not signed up yet?" copy; several matches are returned for the family
// to pick from by preferred first name. Nothing is ever created here; that is /api/signup/lookup.

const MIN_SUBMIT_MS = 3000; // minimum time-to-submit; faster than this is treated as a bot

interface LookupRequestBody {
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  honeypot?: string; // must stay empty; a filled honeypot means a bot
  formRenderedAt?: number; // client timestamp (ms) when the form was rendered
}

export interface LookupMatch {
  playerId: string;
  preferredFirstName: string;
  displayName: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LookupRequestBody = await request.json();
    const { lastName, dateOfBirth, honeypot, formRenderedAt } = body;

    if (honeypot) {
      console.warn('[player/lookup] honeypot triggered');
      return NextResponse.json({ success: false, error: 'Invalid submission' }, { status: 400 });
    }

    if (typeof formRenderedAt === 'number' && Date.now() - formRenderedAt < MIN_SUBMIT_MS) {
      console.warn('[player/lookup] submitted too fast');
      return NextResponse.json({ success: false, error: 'Invalid submission' }, { status: 400 });
    }

    if (!lastName?.trim() || !dateOfBirth?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: lastName, dateOfBirth' },
        { status: 400 }
      );
    }

    const candidates = await findSignupsByLastNameAndBirthdate({
      lastName: lastName.trim(),
      dateOfBirth: dateOfBirth.trim(),
    });

    if (candidates.length === 0) {
      return NextResponse.json({ success: false, notFound: true, error: 'No player found' }, { status: 404 });
    }

    const matches: LookupMatch[] = candidates.map(({ record }) => {
      const preferredFirstName = record[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME] || '';
      return {
        playerId: record[SIGNUPS_COLUMNS.PLAYER_ID],
        preferredFirstName,
        displayName: `${preferredFirstName} ${record[SIGNUPS_COLUMNS.LAST_NAME] || ''}`.trim(),
      };
    });

    return NextResponse.json({ success: true, matches });
  } catch (error) {
    console.error('Error in player lookup:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
