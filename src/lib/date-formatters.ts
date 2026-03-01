// Date formatting utilities for consistent date display across the application
// Convention: Always include day of the week to avoid confusion

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Parse a date string from sheets/API into { month, day, dateObj }.
 * Handles: "M/D", "MM/DD", "M/D/YYYY", "YYYY-MM-DD", "M/D DayName" (e.g. "2/27 Fri"), and Google Sheets serial numbers.
 */
function parseDateInput(dateInput: string | number): { month: number; day: number; dateObj: Date } | null {
  const currentYear = new Date().getFullYear();
  let s = String(dateInput).trim();
  if (!s) return null;

  // If string contains space (e.g. "2/27 Fri"), try the part before the first space for numeric parsing
  if (/\s/.test(s)) {
    const firstPart = s.split(/\s+/)[0];
    if (firstPart) {
      const parsed = parseDateInput(firstPart);
      if (parsed) return parsed;
    }
  }

  // Google Sheets date serial (number of days since 1899-12-30)
  const serial = Number(s);
  if (!isNaN(serial) && serial > 0) {
    const dateObj = new Date((serial - 25569) * 86400 * 1000);
    if (!isNaN(dateObj.getTime())) {
      return {
        month: dateObj.getMonth() + 1,
        day: dateObj.getDate(),
        dateObj,
      };
    }
  }

  // MM/DD or M/D or MM/DD/YYYY
  const slashParts = s.split('/').map(Number);
  if (slashParts.length >= 2) {
    const month = slashParts[0];
    const day = slashParts[1];
    if (!isNaN(month) && !isNaN(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const dateObj = new Date(slashParts[2] || currentYear, month - 1, day);
      return { month, day, dateObj };
    }
  }

  // YYYY-MM-DD (ISO)
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const dateObj = new Date(year, month - 1, day);
      return { month, day, dateObj };
    }
  }

  // Fallback: try native Date parse (e.g. "Feb 27, 2026")
  const dateObj = new Date(s);
  if (!isNaN(dateObj.getTime())) {
    return {
      month: dateObj.getMonth() + 1,
      day: dateObj.getDate(),
      dateObj,
    };
  }

  return null;
}

/**
 * Default date formatter for the application
 * Convention: Always include day of the week for clarity
 * Example: "9/23" → "Tuesday, September 23"
 * Handles MM/DD, M/D, ISO dates, and Google Sheets serial numbers.
 */
export function formatFullDate(dateString: string): string {
  const parsed = parseDateInput(dateString);
  if (!parsed) return dateString || 'Invalid date';

  const { dateObj, month, day } = parsed;
  const dayOfWeek = DAY_NAMES[dateObj.getDay()];
  const monthName = MONTH_NAMES[month - 1];

  return `${dayOfWeek}, ${monthName} ${day}`;
}

/**
 * Short date formatter (when space is limited)
 * Example: "9/23" → "Tue, Sep 23"
 */
export function formatShortDate(dateString: string): string {
  const parsed = parseDateInput(dateString);
  if (!parsed) return dateString || 'Invalid date';

  const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const shortMonthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const { dateObj, month, day } = parsed;
  const dayOfWeek = shortDayNames[dateObj.getDay()];
  const monthName = shortMonthNames[month - 1];

  return `${dayOfWeek}, ${monthName} ${day}`;
}

/**
 * Date formatter with year (for dates in different years)
 * Example: "9/23" → "Tuesday, September 23, 2024"
 */
export function formatFullDateWithYear(dateString: string, year?: number): string {
  const parsed = parseDateInput(dateString);
  if (!parsed) return dateString || 'Invalid date';

  const { dateObj, month, day } = parsed;
  const targetYear = year ?? dateObj.getFullYear();
  const dayOfWeek = DAY_NAMES[dateObj.getDay()];
  const monthName = MONTH_NAMES[month - 1];

  return `${dayOfWeek}, ${monthName} ${day}, ${targetYear}`;
}

/**
 * Parse MM/DD date string to Date object (current year assumed)
 * Handles MM/DD, ISO, and Sheets serial; returns Invalid Date if unparseable.
 */
export function parseMMDDDate(dateString: string): Date {
  const parsed = parseDateInput(dateString);
  return parsed ? parsed.dateObj : new Date(NaN);
}

/**
 * Return a canonical "M/D" or "MM/DD" key for matching availability sheet column headers.
 * Use this when reading dates from Practice Info or Game Info so the same key is used
 * for the availability sheet lookup (column headers are typically "2/27", "3/5", etc.).
 */
export function toCanonicalDateKey(dateInput: string | number): string {
  const parsed = parseDateInput(dateInput);
  if (!parsed) return String(dateInput).trim();
  const { month, day } = parsed;
  return `${month}/${day}`;
}