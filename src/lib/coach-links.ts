// Key season links on Coach Home (grill Q12). The coach spreadsheet link comes from ROSTER_SHEET_ID;
// the two docs are env vars (COACH_PRACTICE_PLANS_DOC_URL, COACH_COMMS_DOC_URL) changed each season.
// A link whose source is unset is left out.

export interface CoachLink {
  title: string;
  description: string;
  href: string;
  icon: string;
}

export function coachSheetUrl(sheetId: string, gid?: number): string | null {
  if (!sheetId) return null;
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit${gid !== undefined ? `#gid=${gid}` : ''}`;
}

export function coachKeyLinks(sources: { rosterSheetId: string; practicePlansDocUrl?: string; commsDocUrl?: string }): CoachLink[] {
  const links: Array<CoachLink | null> = [
    sheetLink(sources.rosterSheetId),
    sources.practicePlansDocUrl ? { title: 'Practice Plans', description: 'Plans for upcoming practices.', href: sources.practicePlansDocUrl, icon: '📋' } : null,
    sources.commsDocUrl ? { title: 'Communication doc', description: 'Drafts and history of family communication.', href: sources.commsDocUrl, icon: '📣' } : null,
  ];
  return links.filter((l): l is CoachLink => l !== null);
}

function sheetLink(sheetId: string): CoachLink | null {
  const href = coachSheetUrl(sheetId);
  return href ? { title: 'Coach spreadsheet', description: 'Roster, schedule, and availability for the season.', href, icon: '📊' } : null;
}
