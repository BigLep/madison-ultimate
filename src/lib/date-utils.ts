// Date formatting utilities

// Format ISO timestamp to US Pacific time format (e.g., "9/4 7:13am")
export function formatToPacificTime(isoTimestamp: string): string {
  if (!isoTimestamp) return '';
  
  try {
    const date = new Date(isoTimestamp);
    
    // Format to Pacific time
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    const parts = formatter.formatToParts(date);
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    const hour = parts.find(p => p.type === 'hour')?.value || '';
    const minute = parts.find(p => p.type === 'minute')?.value || '';
    const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value || '';
    
    return `${month}/${day} ${hour}:${minute}${dayPeriod.toLowerCase()}`;
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return '';
  }
}

// Get current timestamp for questionnaire (when accessed)
export function getCurrentPacificTime(): string {
  return formatToPacificTime(new Date().toISOString());
}