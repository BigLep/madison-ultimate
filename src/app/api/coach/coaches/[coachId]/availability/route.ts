// Coach Availability for Coach Home (CONTEXT.md): every practice and every game in one list, read
// from and written to this coach's row of the Coach Availability tab, found by CoachID. Columns
// are found by header name; see src/lib/coach-availability.ts for the naming.

import { NextRequest, NextResponse } from 'next/server';
import { updateSheetData } from '../../../../../../lib/google-api';
import { getAvailabilityRow, getColumnLetter, AvailabilityTab } from '../../../../../../lib/availability-helper';
import { readPracticeInfo, readGameInfo, readFieldUrls, formatFieldLocation } from '../../../../../../lib/schedule-info';
import { buildCoachEvents, readCoachAvailability, CoachEvent } from '../../../../../../lib/coach-availability';
import { findCoach } from '../../../../../../lib/coaches-sheet';
import { SHEET_CONFIG, COACH_AVAILABILITY_COLUMN_NAMES } from '../../../../../../lib/sheet-config';
import { PRACTICE_CONFIG, isPracticeInPast, formatPracticeTime } from '../../../../../../lib/practice-config';
import { isGameInPast, formatGameTime } from '../../../../../../lib/game-config';
import { formatFullDate } from '../../../../../../lib/date-formatters';
import { formatTeam } from '../../../../../../lib/team-display';

const COACH_AVAILABILITY_TAB: AvailabilityTab = {
  sheetName: SHEET_CONFIG.COACH_AVAILABILITY_SHEET_NAME,
  keyColumnName: COACH_AVAILABILITY_COLUMN_NAMES.COACH_ID,
  cacheKey: 'COACH_AVAILABILITY_COACHES',
};

// The answers a coach can pick; "Was there" / "Wasn't there" stay coach-sheet-only, as for players.
const ANSWERS: string[] = Object.values(PRACTICE_CONFIG.AVAILABILITY_OPTIONS);

function isEventPast(event: CoachEvent): boolean {
  return event.kind === 'practice' ? isPracticeInPast(event.date) : isGameInPast(event.date);
}

async function loadEvents(): Promise<CoachEvent[]> {
  const [practices, games] = await Promise.all([readPracticeInfo(), readGameInfo()]);
  return buildCoachEvents(practices ?? [], games ?? []);
}

function eventTitle(event: CoachEvent): string {
  if (event.kind === 'practice') return 'Practice';
  const team = formatTeam(event.team) || 'All teams';
  const opponent = event.opponent ? ` vs ${event.opponent}` : '';
  return `${team} ${event.label}${opponent}`;
}

function eventTime(event: CoachEvent): string {
  if (event.kind === 'practice') return formatPracticeTime(event.startTime, event.endTime);
  const parts = [
    event.warmupTime && `Warmup ${formatGameTime(event.warmupTime)}`,
    event.startTime && `Game ${formatGameTime(event.startTime)}`,
  ].filter(Boolean);
  return parts.join(', ');
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ coachId: string }> }) {
  try {
    const { coachId } = await params;
    const [events, row, fieldUrls] = await Promise.all([
      loadEvents(),
      getAvailabilityRow(coachId, COACH_AVAILABILITY_TAB),
      readFieldUrls(),
    ]);
    if (!row) {
      // No row yet: Build Coach Availability has not been run since this coach was added.
      return NextResponse.json({ success: true, availabilityOpen: false, events: [], availabilityOptions: PRACTICE_CONFIG.AVAILABILITY_OPTIONS });
    }

    const items = readCoachAvailability(events, row.headerRow, row.playerRow).map(({ event, availability, note }) => ({
      eventKey: event.availabilityHeader,
      kind: event.kind,
      date: event.date,
      title: eventTitle(event),
      formattedDate: formatFullDate(event.date),
      formattedTime: eventTime(event),
      location: formatFieldLocation(event.fieldName, event.fieldLocation),
      locationUrl: (event.fieldName && fieldUrls[event.fieldName]?.googleMapUrl) || null,
      eventNote: event.note,
      isCancelled: event.isCancelled,
      isPast: isEventPast(event),
      availability: { availability, note },
    }));

    return NextResponse.json({
      success: true,
      availabilityOpen: true,
      events: items,
      availabilityOptions: PRACTICE_CONFIG.AVAILABILITY_OPTIONS,
    });
  } catch (error) {
    console.error('Error fetching coach availability:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ coachId: string }> }) {
  try {
    const { coachId } = await params;
    const body = await request.json().catch(() => null);
    const eventKey = typeof body?.eventKey === 'string' ? body.eventKey : '';
    const availability = typeof body?.availability === 'string' ? body.availability : '';
    const note = typeof body?.note === 'string' ? body.note : undefined;

    if (!ANSWERS.includes(availability)) {
      return NextResponse.json({ success: false, error: 'Invalid availability value' }, { status: 400 });
    }
    // Only a column pair that belongs to a real event can be written, never CoachID or Name.
    const event = (await loadEvents()).find(e => e.availabilityHeader === eventKey);
    if (!event) {
      return NextResponse.json({ success: false, error: 'Unknown practice or game' }, { status: 400 });
    }
    if (isEventPast(event)) {
      return NextResponse.json({ success: false, error: 'Cannot update availability for past events' }, { status: 400 });
    }
    if (event.isCancelled) {
      return NextResponse.json({ success: false, error: 'Cannot update availability for a cancelled practice' }, { status: 400 });
    }
    if (!(await findCoach(coachId))) {
      return NextResponse.json({ success: false, error: 'Coach not found' }, { status: 404 });
    }

    const row = await getAvailabilityRow(coachId, COACH_AVAILABILITY_TAB);
    const [columns] = row ? readCoachAvailability([event], row.headerRow, row.playerRow) : [];
    if (!row || !columns) {
      return NextResponse.json(
        { success: false, error: 'This event is not in Coach Availability yet; run Build Coach Availability in the coach sheet.' },
        { status: 404 }
      );
    }

    const sheetName = COACH_AVAILABILITY_TAB.sheetName;
    await updateSheetData(SHEET_CONFIG.ROSTER_SHEET_ID, `'${sheetName}'!${getColumnLetter(columns.availabilityColumn)}${row.rowIndex}`, [[availability]]);
    if (note !== undefined) {
      await updateSheetData(SHEET_CONFIG.ROSTER_SHEET_ID, `'${sheetName}'!${getColumnLetter(columns.noteColumn)}${row.rowIndex}`, [[note]]);
    }

    return NextResponse.json({ success: true, data: { eventKey, availability, note: note ?? '' } });
  } catch (error) {
    console.error('Error updating coach availability:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
