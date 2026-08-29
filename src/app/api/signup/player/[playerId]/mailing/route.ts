import { NextRequest, NextResponse } from 'next/server';
import { findSignupByPlayerId } from '../../../../../../lib/signups-sheet';
import { eligibleMailingEmails } from '../../../../../../lib/mailing-eligibility';
import { isSubscriber, subscribeEmail, unsubscribeEmail } from '../../../../../../lib/buttondown-api';

export async function GET(request: NextRequest, { params }: { params: Promise<{ playerId: string }> }) {
  try {
    const { playerId } = await params;
    const existing = await findSignupByPlayerId(playerId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    const entries = eligibleMailingEmails(existing.record);
    const statuses = await Promise.all(
      entries.map(async entry => ({ ...entry, subscribed: await isSubscriber(entry.email) }))
    );

    return NextResponse.json({ success: true, statuses });
  } catch (error) {
    console.error('Error fetching mailing list status:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ playerId: string }> }) {
  try {
    const { playerId } = await params;
    const existing = await findSignupByPlayerId(playerId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    const { email, action } = await request.json();
    const eligible = eligibleMailingEmails(existing.record).map(e => e.email.toLowerCase());
    if (!email || !eligible.includes(email.toLowerCase())) {
      return NextResponse.json({ success: false, error: 'Email is not eligible for this player' }, { status: 400 });
    }

    const ok = action === 'unsubscribe' ? await unsubscribeEmail(email) : await subscribeEmail(email);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Buttondown request failed' }, { status: 502 });
    }

    return NextResponse.json({ success: true, subscribed: action !== 'unsubscribe' });
  } catch (error) {
    console.error('Error updating mailing list status:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
