import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, getSheetDataWithHyperlinks, updateSheetData } from '../../../../lib/google-api';
import { findPortalEntryByPortalId } from '../../../../lib/portal-cache';
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

    // Step 2: Get Practice Info data with hyperlinks
    const practiceInfoData = await getSheetDataWithHyperlinks(
      ROSTER_SHEET_ID,
      PRACTICE_CONFIG.PRACTICE_INFO_SHEET,
      'A:E'
    );

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

      const date = row[PRACTICE_CONFIG.PRACTICE_INFO_COLUMNS.DATE];
      const locationData = row[PRACTICE_CONFIG.PRACTICE_INFO_COLUMNS.LOCATION];
      const startTime = row[PRACTICE_CONFIG.PRACTICE_INFO_COLUMNS.START] || '';
      const endTime = row[PRACTICE_CONFIG.PRACTICE_INFO_COLUMNS.END] || '';
      const note = row[PRACTICE_CONFIG.PRACTICE_INFO_COLUMNS.NOTE] || '';

      // Handle location data - could be string or object with text/url
      let location, locationUrl;
      if (typeof locationData === 'object' && locationData?.text && locationData?.url) {
        location = locationData.text;
        locationUrl = locationData.url;
      } else {
        location = locationData || '';
        locationUrl = null;
      }

      practices.push({
        date,
        location,
        locationUrl,
        startTime,
        endTime,
        note,
        isPast: isPracticeInPast(date),
        // Calculate column indices for this practice in the availability sheet
        // Column pattern: Name(0), Grade(1), Gender(2), then pairs of [date, date+" Note"]
        availabilityColumnIndex: 3 + (i - 1) * 2,
        noteColumnIndex: 3 + (i - 1) * 2 + 1,
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

    // Step 3: Get player's current availability responses
    const availabilityData = await getSheetData(
      ROSTER_SHEET_ID,
      `'${PRACTICE_CONFIG.PRACTICE_AVAILABILITY_SHEET}'!A:ZZ`
    );

    let playerAvailability: PlayerAvailability[] = [];

    if (availabilityData && availabilityData.length > 1) {
      // Find player's row by matching full name
      const playerRow = availabilityData.find((row, index) => {
        if (index === 0) return false; // Skip header
        return row[PRACTICE_CONFIG.AVAILABILITY_COLUMNS.FULL_NAME] === playerFullName;
      });

      if (playerRow) {
        // Extract availability for each practice
        playerAvailability = practices.map(practice => ({
          practiceDate: practice.date,
          availability: playerRow[practice.availabilityColumnIndex] || '',
          note: playerRow[practice.noteColumnIndex] || '',
        }));
      }
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

    // Get Practice Info data to find the practice column indices
    const practiceInfoData = await getSheetData(
      ROSTER_SHEET_ID,
      `'${PRACTICE_CONFIG.PRACTICE_INFO_SHEET}'!A:E`
    );

    if (!practiceInfoData || practiceInfoData.length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Practice information not found'
      }, { status: 404 });
    }

    // Find the practice and its column indices
    let practiceColumnIndex = -1;
    let noteColumnIndex = -1;

    for (let i = 1; i < practiceInfoData.length; i++) {
      const row = practiceInfoData[i];
      if (row[PRACTICE_CONFIG.PRACTICE_INFO_COLUMNS.DATE] === practiceDate) {
        // Calculate column indices for this practice in the availability sheet
        practiceColumnIndex = 3 + (i - 1) * 2;
        noteColumnIndex = 3 + (i - 1) * 2 + 1;
        break;
      }
    }

    if (practiceColumnIndex === -1) {
      return NextResponse.json({
        success: false,
        error: 'Practice not found'
      }, { status: 404 });
    }

    // Get Practice Availability data to find the player's row
    const availabilityData = await getSheetData(
      ROSTER_SHEET_ID,
      `'${PRACTICE_CONFIG.PRACTICE_AVAILABILITY_SHEET}'!A:ZZ`
    );

    if (!availabilityData || availabilityData.length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Practice availability sheet not found'
      }, { status: 404 });
    }

    // Find the player's row
    let playerRowIndex = -1;
    console.log('DEBUG: Looking for player:', fullName);
    console.log('DEBUG: Available players in sheet:');
    for (let i = 1; i < availabilityData.length; i++) {
      const playerName = availabilityData[i][PRACTICE_CONFIG.AVAILABILITY_COLUMNS.FULL_NAME];
      console.log(`  Row ${i}: "${playerName}"`);
      if (playerName === fullName) {
        playerRowIndex = i + 1; // +1 because sheet rows are 1-indexed
        break;
      }
    }

    if (playerRowIndex === -1) {
      return NextResponse.json({
        success: false,
        error: `Player not found in availability sheet. Looking for: "${fullName}". Found ${availabilityData.length - 1} players in sheet.`
      }, { status: 404 });
    }

    // Convert column index to letter format (A, B, C, ...)
    const getColumnLetter = (index: number): string => {
      let result = '';
      while (index >= 0) {
        result = String.fromCharCode(65 + (index % 26)) + result;
        index = Math.floor(index / 26) - 1;
      }
      return result;
    };

    // Update availability
    const availabilityColumn = getColumnLetter(practiceColumnIndex);
    const availabilityRange = `'${PRACTICE_CONFIG.PRACTICE_AVAILABILITY_SHEET}'!${availabilityColumn}${playerRowIndex}`;
    await updateSheetData(ROSTER_SHEET_ID, availabilityRange, [[availability]]);

    // Update note if provided
    if (note) {
      const noteColumn = getColumnLetter(noteColumnIndex);
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