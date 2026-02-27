// Game system configuration
// Update these column names if the sheet structure changes

import { SHEET_CONFIG } from './sheet-config';
import { formatFullDate } from './date-formatters';

export const GAME_CONFIG = {
  // Sheet names (imported from central config)
  GAME_INFO_SHEET: SHEET_CONFIG.GAME_INFO_SHEET_NAME,
  GAME_AVAILABILITY_SHEET: SHEET_CONFIG.GAME_AVAILABILITY_SHEET_NAME,

  // Game Info sheet column names for dynamic discovery (single team)
  GAME_INFO_COLUMN_NAMES: {
    DATE: "Date",
    GAME_NUMBER: "Game #",
    WARMUP: "Warmup Arrival",
    START: "Game Start",
    DONE: "Done By",
    LOCATION: "Location",
    LOCATION_URL: "Location URL",
    SNACK: "Snack Owner",
    DISC: "DiscNW Page",
    GAME_NOTE: "Game Note",
  },

  // Game Availability sheet column names for dynamic discovery
  AVAILABILITY_COLUMN_NAMES: {
    FULL_NAME: "Full Name",
    GRADE: "Grade",
    GENDER_IDENTIFICATION: "Gender Identification",
    // Team column optional for single-team seasons
    // Per-date columns: {date}, {date} Note, {date} Activation Status
  },

  // Valid availability values (what players can select)
  AVAILABILITY_OPTIONS: {
    PLANNING: "👍 Planning to be there",
    CANT_MAKE: "👎 Can't make it",
    NOT_SURE: "❓ Not sure yet",
  },

  // Read-only values (set by coaches after game)
  COACH_ONLY_VALUES: {
    WAS_THERE: "Was there",
    WASNT_THERE: "Wasn't there",
  },

  // All valid values for validation
  ALL_VALID_VALUES: [
    "👍 Planning to be there",
    "👎 Can't make it",
    "❓ Not sure yet",
    "Was there",
    "Wasn't there",
    "", // Empty is valid (no response yet)
  ],

  // Single team display label (used for game keys and portal copy when no roster team)
  TEAM_DISPLAY_NAME: "Varsity Team",
} as const;

// Type definitions
export interface Game {
  team: string;
  gameNumber: string;
  date: string;
  location: string;
  locationUrl?: string | null;
  warmupTime: string;
  gameStart: string;
  doneBy: string;
  note?: string;
  gameNote?: string; // Team-specific game note from coach
  isBye: boolean; // Whether this is a bye week
  isPast: boolean;
  availabilityColumnIndex: number;
  noteColumnIndex: number;
}

export interface PlayerGameAvailability {
  gameKey: string; // e.g., "Gold Game #1"
  availability: string;
  note: string;
}

export interface GameAvailabilityRow {
  fullName: string;
  grade: string;
  genderIdentification: string;
  team: string;
  games: PlayerGameAvailability[];
}

// Helper functions
export function isGameInPast(gameDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today

  // Parse game date (assuming MM/DD format for current year)
  const [month, day] = gameDate.split('/').map(Number);
  const currentYear = today.getFullYear();
  const gameDateTime = new Date(currentYear, month - 1, day);

  return gameDateTime < today;
}

export function formatGameDate(date: string): string {
  // Use the centralized date formatter for consistency
  // Convert "9/23" to "Tuesday, September 23"
  return formatFullDate(date);
}

export function formatGameTime(time: string): string {
  // Handle times that might already be formatted (e.g., "3:55 PM") or raw (e.g., "15:55")
  // If time already contains AM/PM, return as-is
  if (time.match(/\s*(AM|PM)\s*$/i)) {
    return time.trim();
  }

  // Otherwise, parse and format
  const [hours, minutes] = time.split(':').map(Number);

  // Handle invalid parsing
  if (isNaN(hours) || isNaN(minutes)) {
    return time; // Return original if we can't parse
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function getGameKey(team: string, gameNumber: string): string {
  const displayTeam = team && team.trim() ? team : GAME_CONFIG.TEAM_DISPLAY_NAME;
  return `${displayTeam} Game #${gameNumber}`;
}