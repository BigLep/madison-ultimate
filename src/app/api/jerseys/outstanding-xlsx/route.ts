// GET: the outstanding-jerseys paper sheet (src/lib/jersey-paper-sheet.ts) as an .xlsx download.
// Takes the Check-in tab's own query string (team, gender, q; jersey-url.ts), so the file matches
// what the Jersey Manager is looking at. Gated with the rest of /api/jerseys.

import { NextRequest, NextResponse } from 'next/server';
import { listRosteredPlayers } from '@/lib/coach-directory';
import { readLoans } from '@/lib/jerseys-sheet';
import { outstandingRows } from '@/lib/jerseys';
import { parseFilterQuery } from '@/lib/jersey-url';
import { outstandingJerseysWorkbook } from '@/lib/jersey-paper-sheet';
import { serverError } from '@/lib/jerseys-api';

/** Today's date in Pacific time, as YYYY-MM-DD (the server itself runs in UTC). */
function pacificToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
}

export async function GET(request: NextRequest) {
  try {
    const parsed = parseFilterQuery(request.nextUrl.search);
    const filters = { search: parsed?.search || '', teams: parsed?.teams || [], genders: parsed?.genders || [], statuses: [] };
    const [players, loans] = await Promise.all([listRosteredPlayers(), readLoans()]);
    const rows = outstandingRows(players, loans, filters);

    const scope = filters.teams.length > 0 ? ` (${filters.teams.join(', ')})` : '';
    const today = pacificToday();
    const file = await outstandingJerseysWorkbook(rows, { title: `Program Jerseys still out${scope}`, today });
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="outstanding-jerseys-${today}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return serverError('Error building the outstanding jerseys sheet', error);
  }
}
