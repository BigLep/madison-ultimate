import { NextRequest, NextResponse } from 'next/server';
import { findSignupByIdentity, findNearMatches, createSignupRow } from '../../../../lib/signups-sheet';
import { SIGNUPS_COLUMNS } from '../../../../lib/signups-config';

const MIN_SUBMIT_MS = 3000; // minimum time-to-submit; faster than this is treated as a bot

interface LookupRequestBody {
  preferredFirstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  legalFirstName?: string;
  honeypot?: string; // must stay empty; a filled honeypot means a bot
  formRenderedAt?: number; // client timestamp (ms) when the form was rendered
  confirmNearMatch?: boolean; // set after the family has seen and dismissed the near-match warning
}

export async function POST(request: NextRequest) {
  try {
    const body: LookupRequestBody = await request.json();
    const { preferredFirstName, lastName, dateOfBirth, legalFirstName, honeypot, formRenderedAt, confirmNearMatch } = body;

    if (honeypot) {
      console.warn('[signup/lookup] honeypot triggered');
      return NextResponse.json({ success: false, error: 'Invalid submission' }, { status: 400 });
    }

    if (typeof formRenderedAt === 'number' && Date.now() - formRenderedAt < MIN_SUBMIT_MS) {
      console.warn('[signup/lookup] submitted too fast');
      return NextResponse.json({ success: false, error: 'Invalid submission' }, { status: 400 });
    }

    if (!preferredFirstName?.trim() || !lastName?.trim() || !dateOfBirth?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: preferredFirstName, lastName, dateOfBirth' },
        { status: 400 }
      );
    }

    const identity = { preferredFirstName: preferredFirstName.trim(), lastName: lastName.trim(), dateOfBirth: dateOfBirth.trim() };

    const existing = await findSignupByIdentity(identity);
    if (existing) {
      return NextResponse.json({
        success: true,
        found: true,
        playerId: existing.record[SIGNUPS_COLUMNS.PLAYER_ID],
      });
    }

    if (!confirmNearMatch) {
      const nearMatches = await findNearMatches(identity);
      if (nearMatches.length > 0) {
        return NextResponse.json({
          success: true,
          found: false,
          nearMatch: true,
        });
      }
    }

    const created = await createSignupRow({
      [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: identity.preferredFirstName,
      [SIGNUPS_COLUMNS.LAST_NAME]: identity.lastName,
      [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: identity.dateOfBirth,
      [SIGNUPS_COLUMNS.LEGAL_FIRST_NAME]: legalFirstName?.trim() || '',
    });

    return NextResponse.json({
      success: true,
      found: false,
      created: true,
      playerId: created[SIGNUPS_COLUMNS.PLAYER_ID],
    });
  } catch (error) {
    console.error('Error in signup lookup:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
