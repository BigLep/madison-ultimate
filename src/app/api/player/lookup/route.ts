import { NextRequest, NextResponse } from 'next/server';
import { findPortalIdByLookupKey } from '../../../../lib/portal-cache';

interface PlayerLookupRequest {
  lastName: string;
  birthMonth: string; // 2 digits
  birthYear: string;  // 2 digits
}

export async function POST(request: NextRequest) {
  try {
    const body: PlayerLookupRequest = await request.json();
    const { lastName, birthMonth, birthYear } = body;

    // Validate input
    if (!lastName || !birthMonth || !birthYear) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: lastName, birthMonth, birthYear'
      }, { status: 400 });
    }

    // Validate birth month and year format
    if (!/^\d{2}$/.test(birthMonth) || !/^\d{2}$/.test(birthYear)) {
      return NextResponse.json({
        success: false,
        error: 'birthMonth and birthYear must be 2 digits'
      }, { status: 400 });
    }

    // Construct lookup key from input
    const lookupKey = `${lastName.toLowerCase()}${birthMonth}${birthYear}`;

    // Use cached portal data to find matching portal ID
    const playerPortalId = await findPortalIdByLookupKey(lookupKey);

    if (playerPortalId) {
      return NextResponse.json({
        success: true,
        playerPortalId
      });
    }

    // No match found
    return NextResponse.json({
      success: false,
      error: 'No player found with the provided information'
    }, { status: 404 });

  } catch (error) {
    console.error('Error in player lookup:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}