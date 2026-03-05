// Practice system configuration
// Update these column names if the sheet structure changes

import { SHEET_CONFIG } from './sheet-config';
import { formatFullDate, parseMMDDDate } from './date-formatters';

export const PRACTICE_CONFIG = {
  // Sheet names (imported from central config)
  PRACTICE_INFO_SHEET: SHEET_CONFIG.PRACTICE_INFO_SHEET_NAME,
  PRACTICE_AVAILABILITY_SHEET: SHEET_CONFIG.PRACTICE_AVAILABILITY_SHEET_NAME,

  // UI Configuration
  NOTE_DEBOUNCE_DELAY: 2500, // Milliseconds to wait before auto-saving notes

  // Practice Info sheet columns (0-indexed): Date, Field Name, Field Location, Location URL, Start, End, Note
  PRACTICE_INFO_COLUMNS: {
    DATE: 0,
    FIELD_NAME: 1,
    FIELD_LOCATION: 2,
    LOCATION_URL: 3, // optional override; otherwise resolved from Fields sheet via Field Name
    START: 4,
    END: 5,
    NOTE: 6,
  },

  // Practice Availability sheet columns
  AVAILABILITY_COLUMNS: {
    FULL_NAME: 0,                    // "Full Name"
    GRADE: 1,                        // "Grade"
    GENDER_IDENTIFICATION: 2,        // "Gender Identification"
    // Practice columns start at index 3
    // Each practice has 2 columns: availability and note
    // Pattern: [date], [date + " Note"], [next date], [next date + " Note"], etc.
  },

  // Valid availability values (what players can select)
  AVAILABILITY_OPTIONS: {
    PLANNING: "👍 Planning to be there",
    CANT_MAKE: "👎 Can't make it",
    NOT_SURE: "❓ Not sure yet",
  },

  // Read-only values (set by coaches after practice)
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
} as const;

// Type definitions
export interface Practice {
  date: string;
  location: string;
  locationUrl?: string | null;
  startTime: string;
  endTime: string;
  note?: string;
  isPast: boolean;
  isCancelled: boolean;
  availabilityColumnIndex: number;
  noteColumnIndex: number;
}

export interface PlayerAvailability {
  practiceDate: string;
  availability: string;
  note: string;
}

export interface PracticeAvailabilityRow {
  fullName: string;
  grade: string;
  genderIdentification: string;
  practices: PlayerAvailability[];
}

// Helper functions
export function isPracticeInPast(practiceDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today

  const practiceDateTime = parseMMDDDate(practiceDate);
  if (isNaN(practiceDateTime.getTime())) return false;

  practiceDateTime.setHours(0, 0, 0, 0);
  return practiceDateTime < today;
}

export function formatPracticeDate(date: string): string {
  // Use the centralized date formatter for consistency
  // Convert "9/23" to "Tuesday, September 23"
  return formatFullDate(date);
}

export function isPracticeCancelled(practiceNote: string): boolean {
  // Check if the note contains "Cancelled" (case-insensitive)
  return /cancelled/i.test(practiceNote || '');
}

export function formatPracticeTime(startTime: string, endTime: string): string {
  // Handle times that might already be formatted (e.g., "3:55 PM") or raw (e.g., "15:55")
  const parseAndFormatTime = (time: string) => {
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
  };

  const startFormatted = parseAndFormatTime(startTime);
  const endFormatted = parseAndFormatTime(endTime);

  // Extract periods for comparison
  const startPeriod = startFormatted.match(/(AM|PM)/i)?.[0];
  const endPeriod = endFormatted.match(/(AM|PM)/i)?.[0];

  // If both times have same period, only show period on end time
  if (startPeriod && endPeriod && startPeriod === endPeriod) {
    const startWithoutPeriod = startFormatted.replace(/\s*(AM|PM)\s*/i, '');
    return `${startWithoutPeriod} - ${endFormatted}`;
  }

  return `${startFormatted} - ${endFormatted}`;
}