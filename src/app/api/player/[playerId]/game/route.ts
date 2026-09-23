import { NextRequest, NextResponse } from 'next/server';
import { updateSheetData } from '../../../../../lib/google-api';
import { getCachedGameAvailabilityHeaderNotes } from '../../../../../lib/sheet-cache';
import { readGameInfo, readFieldUrls, formatFieldLocation } from '../../../../../lib/schedule-info';
import { getPlayerGameAvailability, findGameColumns } from '../../../../../lib/game-availability-helper';
import { getColumnLetter } from '../../../../../lib/availability-helper';
import { SHEET_CONFIG } from '../../../../../lib/sheet-config';
import { loadPortalPlayer } from '../../../../../lib/portal-player';
import { formatTeam, isGameRowVisibleToPlayer } from '../../../../../lib/team-display';
import { makeGameKey, parseGameKey } from '../../../../../lib/game-schedule';
import {
  GAME_CONFIG,
  ExtraFieldValue,
  ActivationStatus,
  ACTIVATION_STATUS_VALUES,
  isGameInPast,
  formatGameDate,
  formatGameTime,
} from '../../../../../lib/game-config';
import { toCanonicalDateKey } from '../../../../../lib/date-formatters';

// Games tab data for the Player Portal (docs/fall-2026/player-portal-grill.md Q3, Q12, Q25):
// Game Info has one row per team-game with a Team column (blank means every team); a player sees
// the rows visible to their Team; "(Game 2)" ordinals count per date and per team, matching the
// coach sheet; the availability row is matched by the PlayerID column of Game Availability.

const ROSTER_SHEET_ID = SHEET_CONFIG.ROSTER_SHEET_ID;

function normalizeActivationStatus(value: string | undefined): ActivationStatus {
  const v = (value || '').trim();
  if (ACTIVATION_STATUS_VALUES.includes(v as ActivationStatus)) return v as ActivationStatus;
  return '';
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

    const gameInfo = await readGameInfo();
    if (!gameInfo) {
      return NextResponse.json({ success: false, error: 'No game information found' }, { status: 404 });
    }
    const fieldUrlByName = await readFieldUrls();
    const teamDisplay = formatTeam(player.team) || GAME_CONFIG.TEAM_DISPLAY_NAME;

    let games = gameInfo
      .filter(row => isGameRowVisibleToPlayer(row.team, player.team))
      .map(row => {
        const location = formatFieldLocation(row.fieldName, row.fieldLocation);
        return {
          team: row.team,
          gameLabel: row.label,
          date: row.date,
          ordinalForDate: row.ordinalForDate,
          location,
          locationUrl: (row.fieldName && fieldUrlByName[row.fieldName]?.googleMapUrl) || null,
          warmupTime: row.warmupTime,
          gameStart: row.gameStart,
          doneBy: row.doneBy,
          gameNote: row.gameNote,
          isBye: row.label.toLowerCase() === 'bye',
          isPast: isGameInPast(row.date),
        };
      });

    // Sort games: upcoming first (chronologically), then past games (reverse chronologically)
    const parseDate = (dateStr: string) => {
      const [month, day] = dateStr.split('/').map(Number);
      return new Date(new Date().getFullYear(), month - 1, day);
    };
    games.sort((a, b) => {
      if (a.isPast !== b.isPast) return a.isPast ? 1 : -1;
      const timeA = parseDate(a.date).getTime();
      const timeB = parseDate(b.date).getTime();
      return a.isPast ? timeB - timeA : timeA - timeB;
    });

    // Availability: only when this player has a row in Game Availability (grill Q3).
    let availabilityOpen = false;
    const availabilityByKey: Record<string, {
      availability: string;
      note: string;
      activationStatus: ActivationStatus;
      extraFields: ExtraFieldValue[];
    }> = {};
    let headerNotes: Record<string, string> = {};
    try {
      headerNotes = await getCachedGameAvailabilityHeaderNotes();
    } catch {
      // Non-fatal: extra field notes will just be empty
    }
    try {
      const availabilityResult = await getPlayerGameAvailability(playerId);
      if (availabilityResult) {
        availabilityOpen = true;
        const { headerRow, playerRow } = availabilityResult;
        // Only include games that have a column in the availability sheet (so players can enter availability)
        games = games.filter(g => findGameColumns(headerRow, g.date, g.ordinalForDate, headerNotes) !== null);
        for (const game of games) {
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
          availabilityByKey[makeGameKey(game.date, game.gameLabel)] = {
            availability: (playerRow[gameColumns.availabilityColumn]?.toString() || '').trim(),
            note: gameColumns.noteColumn >= 0 ? (playerRow[gameColumns.noteColumn]?.toString() || '').trim() : '',
            activationStatus,
            extraFields,
          };
        }
      }
    } catch (error) {
      console.log('Could not fetch game availability:', error);
    }

    return NextResponse.json({
      success: true,
      player: { playerId, fullName: player.fullName, team: player.team, teamDisplay },
      availabilityOpen,
      games: games.map(game => {
        const gameKey = makeGameKey(game.date, game.gameLabel);
        return {
          ...game,
          gameKey,
          formattedDate: formatGameDate(game.date),
          formattedWarmupTime: formatGameTime(game.warmupTime),
          formattedGameStart: formatGameTime(game.gameStart),
          formattedDoneBy: formatGameTime(game.doneBy),
          availability: {
            gameKey,
            ...(availabilityByKey[gameKey] || { availability: '', note: '', activationStatus: '' as ActivationStatus, extraFields: [] }),
          },
        };
      }),
      availabilityOptions: GAME_CONFIG.AVAILABILITY_OPTIONS,
    });
  } catch (error) {
    console.error('Error fetching game data:', error);
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

    const { gameKey, availability, note, extraFieldUpdates } = body;
    if (!gameKey || !availability) {
      return NextResponse.json({ success: false, error: 'Game key and availability are required' }, { status: 400 });
    }
    const parsedKey = parseGameKey(gameKey);
    if (!parsedKey) {
      return NextResponse.json({ success: false, error: `Invalid game key format: "${gameKey}"` }, { status: 400 });
    }

    const validValues = Object.values(GAME_CONFIG.AVAILABILITY_OPTIONS);
    if (!validValues.includes(availability)) {
      return NextResponse.json({ success: false, error: 'Invalid availability value' }, { status: 400 });
    }

    const player = await loadPortalPlayer(playerId);
    if (!player) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    const gameInfo = await readGameInfo();
    if (!gameInfo) {
      return NextResponse.json({ success: false, error: 'Game information not found' }, { status: 404 });
    }
    const gameDate = toCanonicalDateKey(parsedKey.date);
    const game = gameInfo.find(
      row => row.date === gameDate && row.label === parsedKey.label && isGameRowVisibleToPlayer(row.team, player.team)
    );
    if (!game) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }
    if (isGameInPast(game.date)) {
      return NextResponse.json({ success: false, error: 'Cannot update availability for past games' }, { status: 400 });
    }

    const availabilityResult = await getPlayerGameAvailability(playerId);
    if (!availabilityResult) {
      return NextResponse.json(
        { success: false, error: 'Availability tracking is not open for this player yet' },
        { status: 404 }
      );
    }
    const { headerRow: availabilityHeaderRow, rowIndex: playerRowIndex } = availabilityResult;

    const gameColumns = findGameColumns(availabilityHeaderRow, game.date, game.ordinalForDate);
    if (!gameColumns) {
      return NextResponse.json({
        success: false,
        error: `This game (${game.date}, game ${game.ordinalForDate}) is not yet available for availability tracking. Add columns for this game in the availability sheet.`,
      }, { status: 404 });
    }

    const availabilityColumn = getColumnLetter(gameColumns.availabilityColumn);
    await updateSheetData(ROSTER_SHEET_ID, `'${GAME_CONFIG.GAME_AVAILABILITY_SHEET}'!${availabilityColumn}${playerRowIndex}`, [[availability]]);

    // Update note (write even if empty string, to allow clearing)
    if (note !== undefined && gameColumns.noteColumn >= 0) {
      const noteColumn = getColumnLetter(gameColumns.noteColumn);
      await updateSheetData(ROSTER_SHEET_ID, `'${GAME_CONFIG.GAME_AVAILABILITY_SHEET}'!${noteColumn}${playerRowIndex}`, [[note]]);
    }

    // Update extra fields (e.g. carpool, lodging): write each to its column, including empty strings
    if (extraFieldUpdates && typeof extraFieldUpdates === 'object') {
      for (const [columnName, value] of Object.entries(extraFieldUpdates)) {
        const col = gameColumns.extraColumns.find(c => c.columnName === columnName);
        if (col && col.columnIndex >= 0) {
          const colLetter = getColumnLetter(col.columnIndex);
          await updateSheetData(ROSTER_SHEET_ID, `'${GAME_CONFIG.GAME_AVAILABILITY_SHEET}'!${colLetter}${playerRowIndex}`, [[value]]);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Availability updated successfully',
      data: { gameKey, availability, note: note !== undefined ? note : '', playerId },
    });
  } catch (error) {
    console.error('Error updating game availability:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
