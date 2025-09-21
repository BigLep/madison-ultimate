// Date formatting utilities for consistent date display across the application
// Convention: Always include day of the week to avoid confusion

/**
 * Default date formatter for the application
 * Convention: Always include day of the week for clarity
 * Example: "9/23" → "Tuesday, September 23"
 */
export function formatFullDate(dateString: string): string {
  const [month, day] = dateString.split('/').map(Number);
  const currentYear = new Date().getFullYear();
  const dateObj = new Date(currentYear, month - 1, day);

  const dayNames = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
  ];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayOfWeek = dayNames[dateObj.getDay()];
  const monthName = monthNames[month - 1];

  return `${dayOfWeek}, ${monthName} ${day}`;
}

/**
 * Short date formatter (when space is limited)
 * Example: "9/23" → "Tue, Sep 23"
 */
export function formatShortDate(dateString: string): string {
  const [month, day] = dateString.split('/').map(Number);
  const currentYear = new Date().getFullYear();
  const dateObj = new Date(currentYear, month - 1, day);

  const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const shortMonthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const dayOfWeek = shortDayNames[dateObj.getDay()];
  const monthName = shortMonthNames[month - 1];

  return `${dayOfWeek}, ${monthName} ${day}`;
}

/**
 * Date formatter with year (for dates in different years)
 * Example: "9/23" → "Tuesday, September 23, 2024"
 */
export function formatFullDateWithYear(dateString: string, year?: number): string {
  const [month, day] = dateString.split('/').map(Number);
  const targetYear = year || new Date().getFullYear();
  const dateObj = new Date(targetYear, month - 1, day);

  const dayNames = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
  ];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayOfWeek = dayNames[dateObj.getDay()];
  const monthName = monthNames[month - 1];

  return `${dayOfWeek}, ${monthName} ${day}, ${targetYear}`;
}

/**
 * Parse MM/DD date string to Date object (current year assumed)
 */
export function parseMMDDDate(dateString: string): Date {
  const [month, day] = dateString.split('/').map(Number);
  const currentYear = new Date().getFullYear();
  return new Date(currentYear, month - 1, day);
}