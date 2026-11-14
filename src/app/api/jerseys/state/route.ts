// Everything the /jerseys screens need, in one read (ADR 0009): Rostered Players (name, Team, and
// signup size only; never contact info), every Jersey Loan, Family Jersey, and Jersey Note, and
// the Jersey Stock rows. The client derives its views with the pure helpers in jerseys.ts.

import { NextResponse } from 'next/server';
import { listRosteredPlayers } from '@/lib/coach-directory';
import { readJerseyWorkbook } from '@/lib/jerseys-sheet';
import { serverError } from '@/lib/jerseys-api';

export async function GET() {
  try {
    const [players, workbook] = await Promise.all([listRosteredPlayers(), readJerseyWorkbook()]);
    return NextResponse.json({
      success: true,
      players: players.map(({ playerId, fullName, team, jerseySize }) => ({ playerId, fullName, team, jerseySize })),
      ...workbook,
    });
  } catch (error) {
    return serverError('Error reading the Jerseys workbook', error);
  }
}
