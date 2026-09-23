// A Coach's own profile on Coach Home (CONTEXT.md): read and edit Name, Email, Phone, About.
// Behind the Coach Tools gate; any coach can edit any coach (grill Q4).

import { NextRequest, NextResponse } from 'next/server';
import { findCoach, updateCoach } from '../../../../../lib/coaches-sheet';
import { toCoachProfile } from '../../../../../lib/coaches-table';

const MAX_ABOUT_LENGTH = 5000;
const MAX_FIELD_LENGTH = 200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: NextRequest, { params }: { params: Promise<{ coachId: string }> }) {
  try {
    const { coachId } = await params;
    const coach = await findCoach(coachId, { fresh: true });
    if (!coach) {
      return NextResponse.json({ success: false, error: 'Coach not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, coach: toCoachProfile(coach) });
  } catch (error) {
    console.error('Error fetching coach:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ coachId: string }> }) {
  try {
    const { coachId } = await params;
    const body = await request.json().catch(() => null);
    const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
    const fields = {
      name: text(body?.name),
      email: text(body?.email),
      phone: text(body?.phone),
      about: text(body?.about),
    };
    if (!fields.name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }
    if (fields.email && !EMAIL_PATTERN.test(fields.email)) {
      return NextResponse.json({ success: false, error: 'That email address does not look right' }, { status: 400 });
    }
    if ([fields.name, fields.email, fields.phone].some(v => v.length > MAX_FIELD_LENGTH) || fields.about.length > MAX_ABOUT_LENGTH) {
      return NextResponse.json({ success: false, error: 'That is too long to save' }, { status: 400 });
    }

    const updated = await updateCoach(coachId, fields);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Coach not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, coach: toCoachProfile(updated) });
  } catch (error) {
    console.error('Error updating coach:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
