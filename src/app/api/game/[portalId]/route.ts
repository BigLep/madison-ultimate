import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, updateSheetData } from '../../../../lib/google-api';
import { findPortalEntryByPortalId } from '../../../../lib/portal-cache';
import { getCachedSheetData, getCachedGameAvailabilityHeaderNotes } from '../../../../lib/sheet-cache';
import { getPlayerGameAvailability, findGameColumns } from '../../../../lib/game-availability-helper';
import { getColumnLetter } from '../../../../lib/availability-helper';
import { SHEET_CONFIG } from '../../../../lib/sheet-config';
import {
  GAME_CONFIG,
  Game,
  PlayerGameAvailability,
  ExtraFieldValue,
  ActivationStatus,
  ACTIVATION_STATUS_VALUES,
  isGameInPast,
  formatGameDate,
  formatGameTime,
  getGameKey
} from '../../../../lib/game-config';
import { toCanonicalDateKey } from '../../../../lib/date-formatters';

function normalizeActivationStatus(value: string | undefined): ActivationStatus {
  const v = (value || '').trim();
  if (ACTIVATION_STATUS_VALUES.includes(v as ActivationStatus)) return v as ActivationStatus;
  return '';
}

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


    // Get full name (and optional team for display) from player API
    let playerFullName = portalEntry.lookupKey; // fallback
    let playerTeam = '';
    try {
      const baseUrl = request.url.replace(/\/api\/game\/.*$/, '');
      const playerResponse = await fetch(`${baseUrl}/api/player/${portalId}`);
      if (playerResponse.ok) {
        const playerData = await playerResponse.json();
        if (playerData.success && playerData.player) {
          playerFullName = playerData.player.fullName;
          playerTeam = playerData.player.team || '';
        }
      }
    } catch (error) {
      console.log('Could not fetch player data, using lookup key as fallback');
    }

    // Step 2: Get Game Info data from cache
    const gameInfoData = await getCachedSheetData('GAME_INFO');

    if (!gameInfoData || gameInfoData.length < 2) {
      return NextResponse.json({
        success: false,
        error: 'No game information found'
      }, { status: 404 });
    }

    // Create column mapping for Game Info sheet (dynamic discovery)
    const gameInfoColumnMap: Record<string, number> = {};
    const headerRow = gameInfoData[0];
    for (let i = 0; i < headerRow.length; i++) {
      const columnName = headerRow[i]?.toString().trim();
      if (columnName) {
        gameInfoColumnMap[columnName] = i;
      }
    }

    // Helper function to get values from game info using column names
    const getGameInfoValue = (row: any[], columnName: string): string => {
      const index = gameInfoColumnMap[columnName];
      return index !== undefined ? (row[index]?.toString().trim() || '') : '';
    };

    // Build field name -> URLs map from Fields sheet (Field Name, Google Map URL, DiscNW URL)
    const fieldUrlByName: Record<string, { googleMapUrl: string | null; discNwUrl: string | null }> = {};
    try {
      const fieldsData = await getCachedSheetData('FIELDS');
      if (fieldsData && fieldsData.length >= 2) {
        const fieldsHeader = fieldsData[0];
        const fn = GAME_CONFIG.FIELDS_COLUMN_NAMES.FIELD_NAME;
        const gmu = GAME_CONFIG.FIELDS_COLUMN_NAMES.GOOGLE_MAP_URL;
        const dnu = GAME_CONFIG.FIELDS_COLUMN_NAMES.DISC_NW_URL;
        const fieldNameIdx = fieldsHeader.findIndex((h: unknown) => (h?.toString().trim() || '') === fn);
        const googleMapIdx = fieldsHeader.findIndex((h: unknown) => (h?.toString().trim() || '') === gmu);
        const discNwIdx = fieldsHeader.findIndex((h: unknown) => (h?.toString().trim() || '') === dnu);
        if (fieldNameIdx >= 0) {
          for (let r = 1; r < fieldsData.length; r++) {
            const name = (fieldsData[r][fieldNameIdx]?.toString() || '').trim();
            if (name) {
              fieldUrlByName[name] = {
                googleMapUrl: googleMapIdx >= 0 ? (fieldsData[r][googleMapIdx]?.toString()?.trim() || null) : null,
                discNwUrl: discNwIdx >= 0 ? (fieldsData[r][discNwIdx]?.toString()?.trim() || null) : null,
              };
            }
          }
        }
      }
    } catch (e) {
      console.log('Fields sheet not available, game location URLs will be missing:', e);
    }

    // Parse games (skip header row) - one game per row (single team). Assign ordinal per date (1st, 2nd game on that date).
    const teamDisplay = playerTeam || GAME_CONFIG.TEAM_DISPLAY_NAME;
    const games: Game[] = [];
    const col = GAME_CONFIG.GAME_INFO_COLUMN_NAMES;
    const dateOrdinal: Record<string, number> = {};

    for (let i = 1; i < gameInfoData.length; i++) {
      const row = gameInfoData[i];
      const rawDate = getGameInfoValue(row, col.DATE);
      const gameLabel = getGameInfoValue(row, col.GAME_LABEL);

      if (!rawDate || !gameLabel) continue;

      const date = toCanonicalDateKey(rawDate);
      const ordinalForDate = (dateOrdinal[date] ?? 0) + 1;
      dateOrdinal[date] = ordinalForDate;

      const warmupTime = getGameInfoValue(row, col.WARMUP);
      const gameStart = getGameInfoValue(row, col.START);
      const doneBy = getGameInfoValue(row, col.DONE);
      const fieldName = getGameInfoValue(row, col.FIELD_NAME);
      const fieldLocation = getGameInfoValue(row, col.FIELD_LOCATION);
      // Display: "Walt Hudley (East)" when both set; "Walt Hudley" when location empty; else the one that's set
      const location = fieldName && fieldLocation ? `${fieldName} (${fieldLocation})` : (fieldName || fieldLocation);
      const fieldUrls = fieldName ? fieldUrlByName[fieldName] : undefined;
      const locationUrl = fieldUrls?.googleMapUrl ?? null;
      const gameNote = getGameInfoValue(row, col.GAME_NOTE);
      const isBye = gameLabel.toLowerCase() === 'bye';

      games.push({
        team: teamDisplay,
        gameLabel,
        date,
        ordinalForDate,
        location,
        locationUrl,
        warmupTime,
        gameStart,
        doneBy,
        note: '',
        gameNote,
        isBye,
        isPast: isGameInPast(date),
        availabilityColumnIndex: -1,
        noteColumnIndex: -1,
      });
    }

    // Sort games: upcoming first (chronologically), then past games (reverse chronologically)
    games.sort((a, b) => {
      if (a.isPast !== b.isPast) {
        return a.isPast ? 1 : -1; // Past games go to end
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
        // Future games: earliest first
        return dateA.getTime() - dateB.getTime();
      } else {
        // Past games: most recent first
        return dateB.getTime() - dateA.getTime();
      }
    });

    // Step 3: Get availability header row (for filtering) and player's responses.
    // Also fetch header notes (cached 30 min) for extra column labels/subtitles.
    let playerAvailability: PlayerGameAvailability[] = [];

    let headerNotes: Record<string, string> = {};
    try {
      headerNotes = await getCachedGameAvailabilityHeaderNotes();
    } catch {
      // Non-fatal: extra field notes will just be empty
    }

    try {
      const availabilityResult = await getPlayerGameAvailability(playerFullName);

      if (availabilityResult) {
        const { headerRow, playerRow } = availabilityResult;

        // Only include games that have a column in the availability sheet (so players can enter availability)
        const gamesWithColumns = games.filter(g => findGameColumns(headerRow, g.date, g.ordinalForDate, headerNotes) !== null);

        // Extract availability, activation status, and extra fields for each game that has columns
        playerAvailability = gamesWithColumns.map(game => {
          const gameColumns = findGameColumns(headerRow, game.date, game.ordinalForDate, headerNotes)!;
          const activationStatus = gameColumns.activationStatusColumn !== undefined
            ? normalizeActivationStatus(playerRow[gameColumns.activationStatusColumn]?.toString())
            : '';
          const extraFields: ExtraFieldValue[] = gameColumns.extraColumns.map(col => ({
            columnName: col.columnName,
            label: col.label,
            note: col.note,
            value: (playerRow[col.columnIndex]?.toString() || '').trim(),
            columnIndex: col.columnIndex,
          }));
          return {
            gameKey: getGameKey(game.team, game.gameLabel),
            availability: (playerRow[gameColumns.availabilityColumn]?.toString() || '').trim(),
            note: (playerRow[gameColumns.noteColumn]?.toString() || '').trim(),
            activationStatus,
            extraFields,
          };
        });

        // Replace games with filtered list so response only shows ones we can collect availability for
        games.length = 0;
        games.push(...gamesWithColumns);
      } else {
        // Player not in sheet; still need header to know which games have columns (don't show the rest)
        const headerData = await getSheetData(ROSTER_SHEET_ID, `'${GAME_CONFIG.GAME_AVAILABILITY_SHEET}'!1:1`);
        const availabilityHeaderRow = (Array.isArray(headerData) && headerData[0]) ? headerData[0] : [];
        const gamesWithColumns = games.filter(g => findGameColumns(availabilityHeaderRow, g.date, g.ordinalForDate) !== null);
        games.length = 0;
        games.push(...gamesWithColumns);
      }
    } catch (error) {
      console.log('Could not fetch game availability:', error);
      // Fallback: get header row so we can still filter (no player data)
      try {
        const headerData = await getSheetData(ROSTER_SHEET_ID, `'${GAME_CONFIG.GAME_AVAILABILITY_SHEET}'!1:1`);
        const availabilityHeaderRow = (Array.isArray(headerData) && headerData[0]) ? headerData[0] : [];
        const gamesWithColumns = games.filter(g => findGameColumns(availabilityHeaderRow, g.date, g.ordinalForDate) !== null);
        games.length = 0;
        games.push(...gamesWithColumns);
      } catch {
        // No header; show no games so we don't show items users can't respond to
        games.length = 0;
      }
    }

    return NextResponse.json({
      success: true,
      player: {
        fullName: playerFullName,
        portalId: portalId,
        team: teamDisplay,
      },
      games: games.map(game => ({
        ...game,
        formattedDate: formatGameDate(game.date),
        formattedWarmupTime: formatGameTime(game.warmupTime),
        formattedGameStart: formatGameTime(game.gameStart),
        formattedDoneBy: formatGameTime(game.doneBy),
        gameKey: getGameKey(game.team, game.gameLabel),
        // Find this game's availability
        availability: playerAvailability.find(a => a.gameKey === getGameKey(game.team, game.gameLabel)) || {
          gameKey: getGameKey(game.team, game.gameLabel),
          availability: '',
          note: '',
          activationStatus: '' as ActivationStatus,
        },
      })),
      availabilityOptions: GAME_CONFIG.AVAILABILITY_OPTIONS,
    });

  } catch (error) {
    console.error('Error fetching game data:', error);
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

    const { gameKey, availability, note, fullName, extraFieldUpdates } = body;

    if (!gameKey || !availability || !fullName) {
      return NextResponse.json({
        success: false,
        error: `Game key, availability, and full name are required. Received: gameKey="${gameKey}", availability="${availability}", fullName="${fullName}"`
      }, { status: 400 });
    }

    // Extract game info from gameKey (e.g., "Varsity Team: Game 1" or "Varsity Team: Spring Reign Day 1")
    const gameKeyMatch = gameKey.match(/^(.+?): (.+)$/);
    if (!gameKeyMatch) {
      return NextResponse.json({
        success: false,
        error: `Invalid game key format: "${gameKey}"`
      }, { status: 400 });
    }

    const [, team, gameLabel] = gameKeyMatch;

    // Validate availability value
    const validValues = Object.values(GAME_CONFIG.AVAILABILITY_OPTIONS);
    if (!validValues.includes(availability)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid availability value'
      }, { status: 400 });
    }

    // Get Game Info data from cache to validate the game exists and check if it's in the past
    const gameInfoData = await getCachedSheetData('GAME_INFO');

    if (!gameInfoData || gameInfoData.length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Game information not found'
      }, { status: 404 });
    }

    // Create column mapping for Game Info sheet (dynamic discovery)
    const gameInfoColumnMap: Record<string, number> = {};
    const headerRow = gameInfoData[0];
    for (let i = 0; i < headerRow.length; i++) {
      const columnName = headerRow[i]?.toString().trim();
      if (columnName) {
        gameInfoColumnMap[columnName] = i;
      }
    }

    // Helper function to get values from game info using column names
    const getGameInfoValue = (row: any[], columnName: string): string => {
      const index = gameInfoColumnMap[columnName];
      return index !== undefined ? (row[index]?.toString().trim() || '') : '';
    };

    // Find the game and check if it's in the past
    let gameFound = false;
    for (let i = 1; i < gameInfoData.length; i++) {
      const row = gameInfoData[i];
      const date = getGameInfoValue(row, GAME_CONFIG.GAME_INFO_COLUMN_NAMES.DATE);
      const rowGameLabel = getGameInfoValue(row, GAME_CONFIG.GAME_INFO_COLUMN_NAMES.GAME_LABEL);

      if (!date || !rowGameLabel) continue;

      // Check if this row contains the game we're looking for
      if (rowGameLabel === gameLabel) {
        gameFound = true;

        // Check if game is in the past
        if (isGameInPast(date)) {
          return NextResponse.json({
            success: false,
            error: 'Cannot update availability for past games'
          }, { status: 400 });
        }

        break;
      }
    }

    if (!gameFound) {
      return NextResponse.json({
        success: false,
        error: 'Game not found'
      }, { status: 404 });
    }

    // Get fresh Game Availability data using cached player mappings
    const availabilityResult = await getPlayerGameAvailability(fullName);

    if (!availabilityResult) {
      return NextResponse.json({
        success: false,
        error: `Player "${fullName}" not found in game availability sheet`
      }, { status: 404 });
    }

    const { headerRow: availabilityHeaderRow, rowIndex: playerRowIndex } = availabilityResult;

    // Find the game date and ordinal (1st, 2nd, ... game on that date) from Game Info row order
    let gameDate = '';
    let ordinalForDate = 0;
    const dateOrdinal: Record<string, number> = {};
    for (let i = 1; i < gameInfoData.length; i++) {
      const row = gameInfoData[i];
      const date = getGameInfoValue(row, GAME_CONFIG.GAME_INFO_COLUMN_NAMES.DATE);
      const rowGameLabel = getGameInfoValue(row, GAME_CONFIG.GAME_INFO_COLUMN_NAMES.GAME_LABEL);

      if (!date || !rowGameLabel) continue;
      const canonicalDate = toCanonicalDateKey(date);
      dateOrdinal[canonicalDate] = (dateOrdinal[canonicalDate] ?? 0) + 1;
      if (rowGameLabel === gameLabel) {
        ordinalForDate = dateOrdinal[canonicalDate];
        gameDate = canonicalDate;
        break;
      }
    }

    if (!gameDate || ordinalForDate === 0) {
      return NextResponse.json({
        success: false,
        error: 'Could not find game date'
      }, { status: 404 });
    }

    const gameColumns = findGameColumns(availabilityHeaderRow, gameDate, ordinalForDate);

    if (!gameColumns) {
      return NextResponse.json({
        success: false,
        error: `This game (${gameDate}, game ${ordinalForDate}) is not yet available for availability tracking. Add columns for this game in the availability sheet.`
      }, { status: 404 });
    }

    // Update availability
    const availabilityColumn = getColumnLetter(gameColumns.availabilityColumn);
    const availabilityRange = `'${GAME_CONFIG.GAME_AVAILABILITY_SHEET}'!${availabilityColumn}${playerRowIndex}`;
    await updateSheetData(ROSTER_SHEET_ID, availabilityRange, [[availability]]);

    // Update note (write even if empty string, to allow clearing)
    if (note !== undefined) {
      const noteColumn = getColumnLetter(gameColumns.noteColumn);
      const noteRange = `'${GAME_CONFIG.GAME_AVAILABILITY_SHEET}'!${noteColumn}${playerRowIndex}`;
      await updateSheetData(ROSTER_SHEET_ID, noteRange, [[note]]);
    }

    // Update extra fields (e.g. carpool, lodging) — write each to its column, including empty strings
    if (extraFieldUpdates && typeof extraFieldUpdates === 'object') {
      for (const [columnName, value] of Object.entries(extraFieldUpdates)) {
        const col = gameColumns.extraColumns.find(c => c.columnName === columnName);
        if (col && col.columnIndex >= 0) {
          const colLetter = getColumnLetter(col.columnIndex);
          const range = `'${GAME_CONFIG.GAME_AVAILABILITY_SHEET}'!${colLetter}${playerRowIndex}`;
          await updateSheetData(ROSTER_SHEET_ID, range, [[value]]);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Availability updated successfully',
      data: {
        gameKey,
        availability,
        note: note !== undefined ? note : '',
        player: fullName,
      }
    });

  } catch (error) {
    console.error('Error updating game availability:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}