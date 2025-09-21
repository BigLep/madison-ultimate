// Game system configuration
// Update these column names if the sheet structure changes

import { SHEET_CONFIG } from './sheet-config';
import { formatFullDate } from './date-formatters';

export const GAME_CONFIG = {
  // Sheet names (imported from central config)
  GAME_INFO_SHEET: SHEET_CONFIG.GAME_INFO_SHEET_NAME,
  GAME_AVAILABILITY_SHEET: SHEET_CONFIG.GAME_AVAILABILITY_SHEET_NAME,

  // Game Info sheet column names for dynamic discovery
  // Based on the actual sheet structure with separate Gold/Blue columns
  GAME_INFO_COLUMN_NAMES: {
    DATE: "Date",
    GAME_NUMBER: "Game #",
    // Gold team columns
    GOLD_WARMUP: "Gold Warmup Arrival",
    GOLD_START: "Gold Game Start",
    GOLD_DONE: "Gold Done By",
    GOLD_LOCATION: "Gold Location",
    GOLD_SNACK: "Gold Snack Owner",
    GOLD_DISC: "Gold DiscNW Page",
    // Blue team columns
    BLUE_WARMUP: "Blue Warmup Arrival",
    BLUE_START: "Blue Game Start",
    BLUE_DONE: "Blue Done By",
    BLUE_LOCATION: "Blue Location",
    BLUE_SNACK: "Blue Snack Owner",
    BLUE_DISC: "Blue DiscNW Page",
  },

  // Game Availability sheet column names for dynamic discovery
  AVAILABILITY_COLUMN_NAMES: {
    FULL_NAME: "Full Name",
    GRADE: "Grade",
    GENDER_IDENTIFICATION: "Gender Identification",
    TEAM: "Team",
    // Game columns are dynamically named based on game info
    // Pattern: [team + " Game #" + number], [team + " Game #" + number + " Note"], etc.
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

  // Team values
  TEAMS: {
    GOLD: "Gold",
    BLUE: "Blue",
  },
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
  return `${team} Game #${gameNumber}`;
}