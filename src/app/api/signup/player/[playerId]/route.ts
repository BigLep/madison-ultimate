import { NextRequest, NextResponse } from 'next/server';
import { findSignupByPlayerId, updateSignupRow } from '../../../../../lib/signups-sheet';
import { profileFormSchema, formValuesToRecord } from '../../../../../lib/signup-form-schema';

export async function GET(request: NextRequest, { params }: { params: Promise<{ playerId: string }> }) {
  try {
    const { playerId } = await params;
    const existing = await findSignupByPlayerId(playerId);

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, record: existing.record });
  } catch (error) {
    console.error('Error fetching signup player:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ playerId: string }> }) {
  try {
    const { playerId } = await params;
    const existing = await findSignupByPlayerId(playerId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = profileFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid profile data', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const fields = formValuesToRecord(parsed.data);
    const updated = await updateSignupRow(playerId, fields);

    return NextResponse.json({ success: true, record: updated });
  } catch (error) {
    console.error('Error saving signup player:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
