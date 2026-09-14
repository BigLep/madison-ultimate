import { NextRequest, NextResponse } from 'next/server';
import { updateSheetData } from '../../../../../lib/google-api';
import { getCachedSheetData } from '../../../../../lib/sheet-cache';
import { getPlayerPracticeAvailability, findPracticeColumns } from '../../../../../lib/practice-availability-helper';
import { getColumnLetter } from '../../../../../lib/availability-helper';
import { SHEET_CONFIG } from '../../../../../lib/sheet-config';
import { loadPortalPlayer } from '../../../../../lib/portal-player';
import {
  PRACTICE_CONFIG,
  Practice,
  PlayerAvailability,
  isPracticeInPast,
  isPracticeCancelled,
  formatPracticeDate,
  formatPracticeTime,
} from '../../../../../lib/practice-config';
import { GAME_CONFIG } from '../../../../../lib/game-config';
import { parseMMDDDate, toCanonicalDateKey } from '../../../../../lib/date-formatters';

// Practices tab data for the Player Portal (docs/fall-2026/player-portal-grill.md Q3, Q12, Q16):
// the player is a Signups row found by PlayerID, their availability row is matched by the
// PlayerID column of Practice Availability, and Practice Info is read by header name.

const ROSTER_SHEET_ID = SHEET_CONFIG.ROSTER_SHEET_ID;

function headerMap(headerRow: any[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    const name = (h ?? '').toString().trim();
    if (name) map[name] = i;
  });
  return map;
}

interface PracticeInfoRow {
  date: string;
  fieldName: string;
  fieldLocation: string;
  startTime: string;
  endTime: string;
  note: string;
}

async function readPracticeInfo(): Promise<PracticeInfoRow[] | null> {
  const data = await getCachedSheetData('PRACTICE_INFO');
  if (!data || data.length < 2) return null;
  const cols = PRACTICE_CONFIG.PRACTICE_INFO_COLUMN_NAMES;
  const map = headerMap(data[0]);
  if (map[cols.DATE] === undefined) {
    throw new Error(`Practice Info is missing the "${cols.DATE}" column`);
  }
  const get = (row: any[], name: string) => {
    const index = map[name];
    return index === undefined ? '' : (row[index] ?? '').toString().trim();
  };
  const rows: PracticeInfoRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rawDate = get(row, cols.DATE);
    if (!rawDate) continue;
    rows.push({
      date: toCanonicalDateKey(rawDate),
      fieldName: get(row, cols.FIELD_NAME),
      fieldLocation: get(row, cols.FIELD_LOCATION),
      startTime: get(row, cols.START),
      endTime: get(row, cols.END),
      note: get(row, cols.NOTE),
    });
  }
  return rows;
}

async function readFieldMapUrls(): Promise<Record<string, string | null>> {
  const byName: Record<string, string | null> = {};
  try {
    const fieldsData = await getCachedSheetData('FIELDS');
    if (fieldsData && fieldsData.length >= 2) {
      const map = headerMap(fieldsData[0]);
      const nameIdx = map[GAME_CONFIG.FIELDS_COLUMN_NAMES.FIELD_NAME];
      const mapIdx = map[GAME_CONFIG.FIELDS_COLUMN_NAMES.GOOGLE_MAP_URL];
      if (nameIdx !== undefined) {
        for (let r = 1; r < fieldsData.length; r++) {
          const name = (fieldsData[r][nameIdx] ?? '').toString().trim();
          if (name) byName[name] = mapIdx !== undefined ? (fieldsData[r][mapIdx] ?? '').toString().trim() || null : null;
        }
      }
    }
  } catch (e) {
    console.log('Fields sheet not available, practice location URLs will be missing:', e);
  }
  return byName;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params;
    if (!playerId) {
      return NextResponse.json({ success: false, error: 'Player ID is required' }, { status: 400 });
    }

    const player = await loadPortalPlayer(playerId);
    if (!player) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    const practiceInfo = await readPracticeInfo();
    if (!practiceInfo) {
      return NextResponse.json({ success: false, error: 'No practice information found' }, { status: 404 });
    }
    const fieldUrlByName = await readFieldMapUrls();

    let practices: Practice[] = practiceInfo.map(row => {
      // Display: "Walt Hudley (East)" when both set; "Walt Hudley" when location empty; else the one that's set
      const location = row.fieldName && row.fieldLocation ? `${row.fieldName} (${row.fieldLocation})` : (row.fieldName || row.fieldLocation);
      return {
        date: row.date,
        location,
        locationUrl: (row.fieldName && fieldUrlByName[row.fieldName]) || null,
        startTime: row.startTime,
        endTime: row.endTime,
        note: row.note,
        isPast: isPracticeInPast(row.date),
        isCancelled: isPracticeCancelled(row.note),
        availabilityColumnIndex: -1,
        noteColumnIndex: -1,
      };
    });

    // Sort practices: upcoming first (chronologically), then past practices (reverse chronologically)
    practices.sort((a, b) => {
      if (a.isPast !== b.isPast) return a.isPast ? 1 : -1;
      const timeA = parseMMDDDate(a.date).getTime();
      const timeB = parseMMDDDate(b.date).getTime();
      if (isNaN(timeA) && isNaN(timeB)) return 0;
      if (isNaN(timeA)) return 1;
      if (isNaN(timeB)) return -1;
      return a.isPast ? timeB - timeA : timeA - timeB;
    });

    // Availability: only when this player has a row in Practice Availability. Otherwise (tab not
    // built yet, or player not rostered) the schedule shows read-only (grill Q3).
    let availabilityOpen = false;
    let playerAvailability: PlayerAvailability[] = [];
    try {
      const availabilityResult = await getPlayerPracticeAvailability(playerId);
      if (availabilityResult) {
        availabilityOpen = true;
        const { playerRow, headerRow } = availabilityResult;
        // Only include practices that have a column in the availability sheet (so players can enter availability)
        practices = practices.filter(p => findPracticeColumns(headerRow, p.date) !== null);
        playerAvailability = practices.map(practice => {
          const columns = findPracticeColumns(headerRow, practice.date)!;
          return {
            practiceDate: practice.date,
            availability: playerRow[columns.availabilityColumn] || '',
            note: playerRow[columns.noteColumn] || '',
          };
        });
      }
    } catch (error) {
      console.log('Could not fetch practice availability:', error);
    }

    return NextResponse.json({
      success: true,
      player: { playerId, fullName: player.fullName },
      availabilityOpen,
      practices: practices.map(practice => ({
        ...practice,
        formattedDate: formatPracticeDate(practice.date),
        formattedTime: formatPracticeTime(practice.startTime, practice.endTime),
        availability: playerAvailability.find(a => a.practiceDate === practice.date) || {
          practiceDate: practice.date,
          availability: '',
          note: '',
        },
      })),
      availabilityOptions: PRACTICE_CONFIG.AVAILABILITY_OPTIONS,
    });
  } catch (error) {
    console.error('Error fetching practice data:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params;
    const body = await request.json();
    if (!playerId) {
      return NextResponse.json({ success: false, error: 'Player ID is required' }, { status: 400 });
    }

    const { practiceDate: rawPracticeDate, availability, note } = body;
    if (!rawPracticeDate || !availability) {
      return NextResponse.json({ success: false, error: 'Practice date and availability are required' }, { status: 400 });
    }
    const practiceDate = toCanonicalDateKey(rawPracticeDate);

    if (isPracticeInPast(practiceDate)) {
      return NextResponse.json({ success: false, error: 'Cannot update availability for past practices' }, { status: 400 });
    }

    const practiceInfo = await readPracticeInfo();
    const practice = practiceInfo?.find(p => p.date === practiceDate);
    if (practice && isPracticeCancelled(practice.note)) {
      return NextResponse.json({ success: false, error: 'Cannot update availability for cancelled practices' }, { status: 400 });
    }

    const validValues = Object.values(PRACTICE_CONFIG.AVAILABILITY_OPTIONS);
    if (!validValues.includes(availability)) {
      return NextResponse.json({ success: false, error: 'Invalid availability value' }, { status: 400 });
    }

    const availabilityResult = await getPlayerPracticeAvailability(playerId);
    if (!availabilityResult) {
      return NextResponse.json(
        { success: false, error: 'Availability tracking is not open for this player yet' },
        { status: 404 }
      );
    }

    const practiceColumns = findPracticeColumns(availabilityResult.headerRow, practiceDate);
    if (!practiceColumns) {
      return NextResponse.json(
        { success: false, error: `Practice date not found in availability sheet: "${practiceDate}"` },
        { status: 404 }
      );
    }

    const playerRowIndex = availabilityResult.rowIndex;
    const availabilityColumn = getColumnLetter(practiceColumns.availabilityColumn);
    await updateSheetData(
      ROSTER_SHEET_ID,
      `'${PRACTICE_CONFIG.PRACTICE_AVAILABILITY_SHEET}'!${availabilityColumn}${playerRowIndex}`,
      [[availability]]
    );

    if (note !== undefined && practiceColumns.noteColumn >= 0) {
      const noteColumn = getColumnLetter(practiceColumns.noteColumn);
      await updateSheetData(
        ROSTER_SHEET_ID,
        `'${PRACTICE_CONFIG.PRACTICE_AVAILABILITY_SHEET}'!${noteColumn}${playerRowIndex}`,
        [[note]]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Availability updated successfully',
      data: { practiceDate, availability, note: note || '', playerId },
    });
  } catch (error) {
    console.error('Error updating practice availability:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

