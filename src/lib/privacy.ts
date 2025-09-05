// Privacy utilities for protecting student information

export function obfuscatePlayerName(firstName: string, lastName: string): string {
  if (!firstName || !lastName) {
    return `${firstName || ''} ${lastName || ''}`.trim();
  }
  
  // Return "FirstName L." format
  const obfuscatedLastName = lastName.charAt(0).toUpperCase() + '.';
  return `${firstName} ${obfuscatedLastName}`;
}

// For testing purposes, we can add a flag to show full names (admin view)
export function getDisplayName(
  firstName: string, 
  lastName: string, 
  showFullNames: boolean = false
): string {
  if (showFullNames) {
    return `${firstName} ${lastName}`;
  }
  return obfuscatePlayerName(firstName, lastName);
}