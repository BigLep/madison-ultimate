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
  isPracticeCancelled,
  formatPracticeDate,
  formatPracticeTime
} from '../../../../lib/practice-config';
import { GAME_CONFIG } from '../../../../lib/game-config';
import { parseMMDDDate, toCanonicalDateKey } from '../../../../lib/date-formatters';

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

    // Build field name -> URLs map from Fields sheet (same as game route)
    const fieldUrlByName: Record<string, { googleMapUrl: string | null }> = {};
    try {
      const fieldsData = await getCachedSheetData('FIELDS');
      if (fieldsData && fieldsData.length >= 2) {
        const fieldsHeader = fieldsData[0];
        const fn = GAME_CONFIG.FIELDS_COLUMN_NAMES.FIELD_NAME;
        const gmu = GAME_CONFIG.FIELDS_COLUMN_NAMES.GOOGLE_MAP_URL;
        const fieldNameIdx = fieldsHeader.findIndex((h: unknown) => (h?.toString().trim() || '') === fn);
        const googleMapIdx = fieldsHeader.findIndex((h: unknown) => (h?.toString().trim() || '') === gmu);
        if (fieldNameIdx >= 0) {
          for (let r = 1; r < fieldsData.length; r++) {
            const name = (fieldsData[r][fieldNameIdx]?.toString() || '').trim();
            if (name) {
              fieldUrlByName[name] = {
                googleMapUrl: googleMapIdx >= 0 ? (fieldsData[r][googleMapIdx]?.toString()?.trim() || null) : null,
              };
            }
          }
        }
      }
    } catch (e) {
      console.log('Fields sheet not available, practice location URLs will be missing:', e);
    }

    const cols = PRACTICE_CONFIG.PRACTICE_INFO_COLUMNS;
    // Parse practices (skip header row)
    const practices: Practice[] = [];
    for (let i = 1; i < practiceInfoData.length; i++) {
      const row = practiceInfoData[i];
      if (!row[cols.DATE]) continue;

      const rawDate = row[cols.DATE] || '';
      const date = toCanonicalDateKey(rawDate);
      const fieldName = (row[cols.FIELD_NAME]?.toString() || '').trim();
      const fieldLocation = (row[cols.FIELD_LOCATION]?.toString() || '').trim();
      // Display: "Walt Hudley (East)" when both set; "Walt Hudley" when location empty; else the one that's set
      const location = fieldName && fieldLocation ? `${fieldName} (${fieldLocation})` : (fieldName || fieldLocation);
      const sheetLocationUrl = (row[cols.LOCATION_URL]?.toString() || '').trim() || null;
      const locationUrl = fieldName && fieldUrlByName[fieldName]?.googleMapUrl
        ? fieldUrlByName[fieldName].googleMapUrl
        : sheetLocationUrl;
      const startTime = row[cols.START] || '';
      const endTime = row[cols.END] || '';
      const note = row[cols.NOTE] || '';

      practices.push({
        date,
        location,
        locationUrl: locationUrl || null,
        startTime,
        endTime,
        note,
        isPast: isPracticeInPast(date),
        isCancelled: isPracticeCancelled(note),
        availabilityColumnIndex: -1,
        noteColumnIndex: -1,
      });
    }

    // Sort practices: upcoming first (chronologically), then past practices (reverse chronologically)
    practices.sort((a, b) => {
      if (a.isPast !== b.isPast) {
        return a.isPast ? 1 : -1; // Past practices go to end
      }

      const dateA = parseMMDDDate(a.date);
      const dateB = parseMMDDDate(b.date);
      const timeA = dateA.getTime();
      const timeB = dateB.getTime();
      if (isNaN(timeA) && isNaN(timeB)) return 0;
      if (isNaN(timeA)) return 1;
      if (isNaN(timeB)) return -1;

      if (!a.isPast && !b.isPast) {
        return timeA - timeB;
      } else {
        return timeB - timeA;
      }
    });

    // Step 3: Get availability header row (for filtering) and player's responses
    let playerAvailability: PlayerAvailability[] = [];

    try {
      const availabilityResult = await getPlayerPracticeAvailability(playerFullName);

      if (availabilityResult) {
        const { playerRow, headerRow } = availabilityResult;

        // Only include practices that have a column in the availability sheet (so players can enter availability)
        const practicesWithColumns = practices.filter(p => findPracticeColumns(headerRow, p.date) !== null);

        // Extract availability for each practice that has columns
        playerAvailability = practicesWithColumns.map(practice => {
          const columns = findPracticeColumns(headerRow, practice.date)!;
          return {
            practiceDate: practice.date,
            availability: playerRow[columns.availabilityColumn] || '',
            note: playerRow[columns.noteColumn] || '',
          };
        });

        // Replace practices with filtered list so response only shows ones we can collect availability for
        practices.length = 0;
        practices.push(...practicesWithColumns);
      } else {
        // Player not in sheet; still need header to know which practices have columns (don't show the rest)
        const headerData = await getSheetData(ROSTER_SHEET_ID, `'${PRACTICE_CONFIG.PRACTICE_AVAILABILITY_SHEET}'!1:1`);
        const availabilityHeaderRow = (Array.isArray(headerData) && headerData[0]) ? headerData[0] : [];
        const practicesWithColumns = practices.filter(p => findPracticeColumns(availabilityHeaderRow, p.date) !== null);
        practices.length = 0;
        practices.push(...practicesWithColumns);
      }
    } catch (error) {
      console.log('Could not fetch practice availability:', error);
      // Fallback: get header row so we can still filter (no player data)
      try {
        const headerData = await getSheetData(ROSTER_SHEET_ID, `'${PRACTICE_CONFIG.PRACTICE_AVAILABILITY_SHEET}'!1:1`);
        const availabilityHeaderRow = (Array.isArray(headerData) && headerData[0]) ? headerData[0] : [];
        const practicesWithColumns = practices.filter(p => findPracticeColumns(availabilityHeaderRow, p.date) !== null);
        practices.length = 0;
        practices.push(...practicesWithColumns);
      } catch {
        // No header; show no practices so we don't show items users can't respond to
        practices.length = 0;
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

    const { practiceDate: rawPracticeDate, availability, note, fullName } = body;

    if (!rawPracticeDate || !availability || !fullName) {
      return NextResponse.json({
        success: false,
        error: 'Practice date, availability, and full name are required'
      }, { status: 400 });
    }

    const practiceDate = toCanonicalDateKey(rawPracticeDate);

    // Check if practice is in the past
    if (isPracticeInPast(practiceDate)) {
      return NextResponse.json({
        success: false,
        error: 'Cannot update availability for past practices'
      }, { status: 400 });
    }

    // Get Practice Info data to check if practice is cancelled
    const practiceInfoData = await getCachedSheetData('PRACTICE_INFO');
    if (practiceInfoData && practiceInfoData.length > 1) {
      for (let i = 1; i < practiceInfoData.length; i++) {
        const row = practiceInfoData[i];
        const rowDate = row[PRACTICE_CONFIG.PRACTICE_INFO_COLUMNS.DATE] || '';
        if (toCanonicalDateKey(rowDate) === practiceDate) {
          const practiceNote = row[PRACTICE_CONFIG.PRACTICE_INFO_COLUMNS.NOTE] || '';
          if (isPracticeCancelled(practiceNote)) {
            return NextResponse.json({
              success: false,
              error: 'Cannot update availability for cancelled practices'
            }, { status: 400 });
          }
          break;
        }
      }
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