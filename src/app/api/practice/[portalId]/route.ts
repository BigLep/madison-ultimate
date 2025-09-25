import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, updateSheetData } from '../../../../lib/google-api';
import { findPortalEntryByPortalId } from '../../../../lib/portal-cache';
import { getCachedSheetData } from '../../../../lib/sheet-cache';
import { getPlayerPracticeAvailability, findPracticeColumns } from '../../../../lib/practice-availability-helper';
import { getColumnLetter } from '../../../../lib/availability-helper';
import { SHEET_CONFIG } from '../../../../lib/sheet-config';
import {
  PRACTICE_CONFIG,
  Practice,
  PlayerAvailability,
  isPracticeInPast,
  formatPracticeDate,
  formatPracticeTime
} from '../../../../lib/practice-config';

const ROSTER_SHEET_ID = SHEET_CONFIG.ROSTER_SHEET_ID;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ portalId: string }> }
) {
  try {
    const { portalId } = await params;

    if (!portalId) {
      return NextResponse.json({
        success: false,
        error: 'Portal ID is required'
      }, { status: 400 });
    }

    // Step 1: Validate Portal ID and get player info
    const portalEntry = await findPortalEntryByPortalId(portalId);
    if (!portalEntry) {
      return NextResponse.json({
        success: false,
        error: 'Player not found with the provided Portal ID'
      }, { status: 404 });
    }

    // Get the actual full name from the player API
    let playerFullName = portalEntry.lookupKey; // fallback
    try {
      const baseUrl = request.url.replace(/\/api\/practice\/.*$/, '');
      const playerResponse = await fetch(`${baseUrl}/api/player/${portalId}`);
      if (playerResponse.ok) {
        const playerData = await playerResponse.json();
        if (playerData.success && playerData.player) {
          playerFullName = playerData.player.fullName;
        }
      }
    } catch (error) {
      console.log('Could not fetch player full name, using lookup key as fallback');
    }

    // Step 2: Get Practice Info data from cache
    const practiceInfoData = await getCachedSheetData('PRACTICE_INFO');

    if (!practiceInfoData || practiceInfoData.length < 2) {
      return NextResponse.json({
        success: false,
        error: 'No practice information found'
      }, { status: 404 });
    }

    // Parse practices (skip header row)
    const practices: Practice[] = [];
    for (let i = 1; i < practiceInfoData.length; i++) {
      const row = practiceInfoData[i];
      if (!row[PRACTICE_CONFIG.PRACTICE_INFO_COLUMNS.DATE]) continue;

      // Extract practice data from cached sheet (all values are strings)
      const date = row[PRACTICE_CONFIG.PRACTICE_INFO_COLUMNS.DATE] || '';
      const location = row[PRACTICE_CONFIG.PRACTICE_INFO_COLUMNS.LOCATION] || '';
      const locationUrl = row[PRACTICE_CONFIG.PRACTICE_INFO_COLUMNS.LOCATION_URL] || null;
      const startTime = row[PRACTICE_CONFIG.PRACTICE_INFO_COLUMNS.START] || '';
      const endTime = row[PRACTICE_CONFIG.PRACTICE_INFO_COLUMNS.END] || '';
      const note = row[PRACTICE_CONFIG.PRACTICE_INFO_COLUMNS.NOTE] || '';

      practices.push({
        date,
        location,
        locationUrl,
        startTime,
        endTime,
        note,
        isPast: isPracticeInPast(date),
        // Column indices will be determined dynamically during data fetching
        availabilityColumnIndex: -1,
        noteColumnIndex: -1,
      });
    }

    // Sort practices: upcoming first (chronologically), then past practices (reverse chronologically)
    practices.sort((a, b) => {
      if (a.isPast !== b.isPast) {
        return a.isPast ? 1 : -1; // Past practices go to end
      }

      // Parse dates for proper chronological sorting
      const parseDate = (dateStr: string) => {
        const [month, day] = dateStr.split('/').map(Number);
        const currentYear = new Date().getFullYear();
        return new Date(currentYear, month - 1, day);
      };

      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);

      if (!a.isPast && !b.isPast) {
        // Future practices: earliest first
        return dateA.getTime() - dateB.getTime();
      } else {
        // Past practices: most recent first
        return dateB.getTime() - dateA.getTime();
      }
    });

    // Step 3: Get player's current availability responses (fresh data)
    let playerAvailability: PlayerAvailability[] = [];

    try {
      const availabilityResult = await getPlayerPracticeAvailability(playerFullName);

      if (availabilityResult) {
        const { playerRow, headerRow } = availabilityResult;

        // Extract availability for each practice using dynamic column discovery
        playerAvailability = practices.map(practice => {
          const columns = findPracticeColumns(headerRow, practice.date);
          if (columns) {
            return {
              practiceDate: practice.date,
              availability: playerRow[columns.availabilityColumn] || '',
              note: playerRow[columns.noteColumn] || '',
            };
          } else {
            console.warn(`Practice columns not found for date: ${practice.date}`);
            return {
              practiceDate: practice.date,
              availability: '',
              note: '',
            };
          }
        });
      }
    } catch (error) {
      console.log('Could not fetch practice availability:', error);
      // Continue with empty availability - non-critical for page load
    }

    return NextResponse.json({
      success: true,
      player: {
        fullName: playerFullName,
        portalId: portalId,
      },
      practices: practices.map(practice => ({
        ...practice,
        formattedDate: formatPracticeDate(practice.date),
        formattedTime: formatPracticeTime(practice.startTime, practice.endTime),
        // Find this practice's availability
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
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ portalId: string }> }
) {
  try {
    const { portalId } = await params;
    const body = await request.json();

    if (!portalId) {
      return NextResponse.json({
        success: false,
        error: 'Portal ID is required'
      }, { status: 400 });
    }

    const { practiceDate, availability, note, fullName } = body;

    if (!practiceDate || !availability || !fullName) {
      return NextResponse.json({
        success: false,
        error: 'Practice date, availability, and full name are required'
      }, { status: 400 });
    }

    // Check if practice is in the past
    if (isPracticeInPast(practiceDate)) {
      return NextResponse.json({
        success: false,
        error: 'Cannot update availability for past practices'
      }, { status: 400 });
    }

    // Validate availability value
    const validValues = Object.values(PRACTICE_CONFIG.AVAILABILITY_OPTIONS);
    if (!validValues.includes(availability)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid availability value'
      }, { status: 400 });
    }

    // Get player's availability data to access header row for column discovery
    const availabilityResult = await getPlayerPracticeAvailability(fullName);

    if (!availabilityResult) {
      return NextResponse.json({
        success: false,
        error: `Player not found in availability sheet: "${fullName}"`
      }, { status: 404 });
    }

    // Find the practice columns using dynamic discovery
    const practiceColumns = findPracticeColumns(availabilityResult.headerRow, practiceDate);

    if (!practiceColumns) {
      return NextResponse.json({
        success: false,
        error: `Practice date not found in availability sheet: "${practiceDate}"`
      }, { status: 404 });
    }

    const playerRowIndex = availabilityResult.rowIndex;

    // Update availability
    const availabilityColumn = getColumnLetter(practiceColumns.availabilityColumn);
    const availabilityRange = `'${PRACTICE_CONFIG.PRACTICE_AVAILABILITY_SHEET}'!${availabilityColumn}${playerRowIndex}`;
    await updateSheetData(ROSTER_SHEET_ID, availabilityRange, [[availability]]);

    // Update note if provided
    if (note) {
      const noteColumn = getColumnLetter(practiceColumns.noteColumn);
      const noteRange = `'${PRACTICE_CONFIG.PRACTICE_AVAILABILITY_SHEET}'!${noteColumn}${playerRowIndex}`;
      await updateSheetData(ROSTER_SHEET_ID, noteRange, [[note]]);
    }

    return NextResponse.json({
      success: true,
      message: 'Availability updated successfully',
      data: {
        practiceDate,
        availability,
        note: note || '',
        player: fullName,
      }
    });

  } catch (error) {
    console.error('Error updating practice availability:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}