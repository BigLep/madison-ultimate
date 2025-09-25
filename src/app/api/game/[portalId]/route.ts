import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, updateSheetData } from '../../../../lib/google-api';
import { findPortalEntryByPortalId } from '../../../../lib/portal-cache';
import { getCachedSheetData } from '../../../../lib/sheet-cache';
import { getPlayerGameAvailability, findGameColumns } from '../../../../lib/game-availability-helper';
import { getColumnLetter } from '../../../../lib/availability-helper';
import { SHEET_CONFIG } from '../../../../lib/sheet-config';
import {
  GAME_CONFIG,
  Game,
  PlayerGameAvailability,
  isGameInPast,
  formatGameDate,
  formatGameTime,
  getGameKey
} from '../../../../lib/game-config';

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

    // Get the actual full name and team from the player API
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

    if (!playerTeam) {
      return NextResponse.json({
        success: false,
        error: 'Player team not found. Please ensure team is assigned in the roster.'
      }, { status: 404 });
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

    // Parse games (skip header row) - we'll process all games and create both Gold and Blue games
    const games: Game[] = [];
    let gameIndex = 0; // Track overall game index for column calculation

    for (let i = 1; i < gameInfoData.length; i++) {
      const row = gameInfoData[i];
      const date = getGameInfoValue(row, GAME_CONFIG.GAME_INFO_COLUMN_NAMES.DATE);
      const gameNumber = getGameInfoValue(row, GAME_CONFIG.GAME_INFO_COLUMN_NAMES.GAME_NUMBER);

      if (!date || !gameNumber) continue; // Skip rows without basic game info

      // Create games for both teams from this row
      const teams = [GAME_CONFIG.TEAMS.GOLD, GAME_CONFIG.TEAMS.BLUE];

      for (const team of teams) {
        // Only include games for the player's team
        if (team !== playerTeam) {
          continue;
        }

        // Get team-specific columns
        const isGold = team === GAME_CONFIG.TEAMS.GOLD;
        const warmupColumnName = isGold ? GAME_CONFIG.GAME_INFO_COLUMN_NAMES.GOLD_WARMUP : GAME_CONFIG.GAME_INFO_COLUMN_NAMES.BLUE_WARMUP;
        const startColumnName = isGold ? GAME_CONFIG.GAME_INFO_COLUMN_NAMES.GOLD_START : GAME_CONFIG.GAME_INFO_COLUMN_NAMES.BLUE_START;
        const doneColumnName = isGold ? GAME_CONFIG.GAME_INFO_COLUMN_NAMES.GOLD_DONE : GAME_CONFIG.GAME_INFO_COLUMN_NAMES.BLUE_DONE;
        const locationColumnName = isGold ? GAME_CONFIG.GAME_INFO_COLUMN_NAMES.GOLD_LOCATION : GAME_CONFIG.GAME_INFO_COLUMN_NAMES.BLUE_LOCATION;
        const locationUrlColumnName = isGold ? GAME_CONFIG.GAME_INFO_COLUMN_NAMES.GOLD_LOCATION_URL : GAME_CONFIG.GAME_INFO_COLUMN_NAMES.BLUE_LOCATION_URL;
        const gameNoteColumnName = isGold ? GAME_CONFIG.GAME_INFO_COLUMN_NAMES.GOLD_GAME_NOTE : GAME_CONFIG.GAME_INFO_COLUMN_NAMES.BLUE_GAME_NOTE;

        const warmupTime = getGameInfoValue(row, warmupColumnName);
        const gameStart = getGameInfoValue(row, startColumnName);
        const doneBy = getGameInfoValue(row, doneColumnName);
        const location = getGameInfoValue(row, locationColumnName);
        const locationUrl = getGameInfoValue(row, locationUrlColumnName) || null;
        const gameNote = getGameInfoValue(row, gameNoteColumnName);

        // Check if this is a bye week
        const isBye = gameNumber.toLowerCase() === 'bye';

        games.push({
          team,
          gameNumber,
          date,
          location,
          locationUrl,
          warmupTime,
          gameStart,
          doneBy,
          note: '', // Games don't have notes in the info sheet
          gameNote, // Team-specific game note from coach
          isBye,
          isPast: isGameInPast(date),
          // We'll calculate these after we get the availability sheet structure
          availabilityColumnIndex: -1,
          noteColumnIndex: -1,
        });

        gameIndex++;
      }
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

    // Step 3: Get player's current availability responses (fresh data)
    let playerAvailability: PlayerGameAvailability[] = [];

    try {
      const availabilityResult = await getPlayerGameAvailability(playerFullName);

      if (availabilityResult) {
        const { headerRow, playerRow } = availabilityResult;

        // Extract availability for each game using dynamic column discovery
        playerAvailability = games.map(game => {
          const gameColumns = findGameColumns(headerRow, game.date);
          if (gameColumns) {
            return {
              gameKey: getGameKey(game.team, game.gameNumber),
              availability: playerRow[gameColumns.availabilityColumn] || '',
              note: playerRow[gameColumns.noteColumn] || '',
            };
          } else {
            console.warn(`Game columns not found for date: ${game.date}`);
            return {
              gameKey: getGameKey(game.team, game.gameNumber),
              availability: '',
              note: '',
            };
          }
        });
      }
    } catch (error) {
      console.log('Could not fetch game availability:', error);
      // Continue with empty availability - non-critical for page load
    }

    return NextResponse.json({
      success: true,
      player: {
        fullName: playerFullName,
        portalId: portalId,
        team: playerTeam,
      },
      games: games.map(game => ({
        ...game,
        formattedDate: formatGameDate(game.date),
        formattedWarmupTime: formatGameTime(game.warmupTime),
        formattedGameStart: formatGameTime(game.gameStart),
        formattedDoneBy: formatGameTime(game.doneBy),
        gameKey: getGameKey(game.team, game.gameNumber),
        // Find this game's availability
        availability: playerAvailability.find(a => a.gameKey === getGameKey(game.team, game.gameNumber)) || {
          gameKey: getGameKey(game.team, game.gameNumber),
          availability: '',
          note: '',
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

    const { gameKey, availability, note, fullName } = body;

    if (!gameKey || !availability || !fullName) {
      return NextResponse.json({
        success: false,
        error: `Game key, availability, and full name are required. Received: gameKey="${gameKey}", availability="${availability}", fullName="${fullName}"`
      }, { status: 400 });
    }

    // Extract game info from gameKey (e.g., "Gold Game #1" or "Blue Game #Playoff #1")
    const gameKeyMatch = gameKey.match(/^(\w+) Game #(.+)$/);
    if (!gameKeyMatch) {
      return NextResponse.json({
        success: false,
        error: `Invalid game key format: "${gameKey}"`
      }, { status: 400 });
    }

    const [, team, gameNumber] = gameKeyMatch;

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
      const rowGameNumber = getGameInfoValue(row, GAME_CONFIG.GAME_INFO_COLUMN_NAMES.GAME_NUMBER);

      if (!date || !rowGameNumber) continue;

      // Check if this row contains the game we're looking for
      if (rowGameNumber === gameNumber) {
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

    // Find the game date to use as column key in availability sheet
    let gameDate = '';
    for (let i = 1; i < gameInfoData.length; i++) {
      const row = gameInfoData[i];
      const date = getGameInfoValue(row, GAME_CONFIG.GAME_INFO_COLUMN_NAMES.DATE);
      const rowGameNumber = getGameInfoValue(row, GAME_CONFIG.GAME_INFO_COLUMN_NAMES.GAME_NUMBER);

      if (rowGameNumber === gameNumber) {
        gameDate = date;
        break;
      }
    }

    if (!gameDate) {
      return NextResponse.json({
        success: false,
        error: 'Could not find game date'
      }, { status: 404 });
    }

    // Find the columns for this game using dynamic discovery
    const gameColumns = findGameColumns(availabilityHeaderRow, gameDate);

    if (!gameColumns) {
      return NextResponse.json({
        success: false,
        error: `This game (${gameDate}) is not yet available for availability tracking. The availability sheet needs to have a "${gameDate}" column added.`
      }, { status: 404 });
    }

    // Update availability
    const availabilityColumn = getColumnLetter(gameColumns.availabilityColumn);
    const availabilityRange = `'${GAME_CONFIG.GAME_AVAILABILITY_SHEET}'!${availabilityColumn}${playerRowIndex}`;
    await updateSheetData(ROSTER_SHEET_ID, availabilityRange, [[availability]]);

    // Update note if provided
    if (note) {
      const noteColumn = getColumnLetter(gameColumns.noteColumn);
      const noteRange = `'${GAME_CONFIG.GAME_AVAILABILITY_SHEET}'!${noteColumn}${playerRowIndex}`;
      await updateSheetData(ROSTER_SHEET_ID, noteRange, [[note]]);
    }

    return NextResponse.json({
      success: true,
      message: 'Availability updated successfully',
      data: {
        gameKey,
        availability,
        note: note || '',
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