import { NextRequest, NextResponse } from 'next/server';
import { findPortalIdByLookupKey } from '../../../../lib/portal-cache';

/**
 * Debug: see what lookup key is computed for given name/DOB and whether it matches.
 * GET /api/debug/lookup?firstName=...&lastName=...&birthMonth=05&birthYear=14
 * Use this to verify login key vs spreadsheet Portal Lookup Key column.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const firstName = searchParams.get('firstName')?.trim();
    const lastName = searchParams.get('lastName')?.trim();
    const birthMonth = searchParams.get('birthMonth')?.trim();
    const birthYear = searchParams.get('birthYear')?.trim();

    if (!firstName || !lastName || !birthMonth || !birthYear) {
      return NextResponse.json(
        { success: false, error: 'Query params required: firstName, lastName, birthMonth (2 digits), birthYear (2 digits)' },
        { status: 400 }
      );
    }

    if (!/^\d{2}$/.test(birthMonth) || !/^\d{2}$/.test(birthYear)) {
      return NextResponse.json(
        { success: false, error: 'birthMonth and birthYear must be 2 digits (e.g. 05, 14)' },
        { status: 400 }
      );
    }

    const year2 = birthYear.length === 4 ? birthYear.slice(-2) : birthYear;
    const firstInitial = firstName.charAt(0).toLowerCase();
    const lookupKeyComputed = `${firstInitial}${lastName.toLowerCase()}${birthMonth}${year2}`;

    const playerPortalId = await findPortalIdByLookupKey(lookupKeyComputed);

    return NextResponse.json({
      success: true,
      lookupKeyComputed,
      hint: 'Compare this to the "Portal Lookup Key" column in the roster sheet (spaces are ignored when matching).',
      found: !!playerPortalId,
      ...(playerPortalId ? { playerPortalId } : {}),
    });
  } catch (error) {
    console.error('Debug lookup failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
