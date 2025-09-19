import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '../../../../lib/google-api';

const ROSTER_SHEET_ID = process.env.ROSTER_SHEET_ID || '1ZZA5TxHu8nmtyNORm3xYtN5rzP3p1jtW178UgRcxLA8';

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

    // Step 1: Get metadata to find Portal columns dynamically
    const metadataRows = await getSheetData(ROSTER_SHEET_ID, 'A1:AZ4');

    if (metadataRows.length < 4) {
      return NextResponse.json({
        success: false,
        error: 'Invalid roster metadata structure'
      }, { status: 500 });
    }

    const [columnNameRow] = metadataRows;

    // Find Portal Lookup Key and Portal ID columns dynamically
    let lookupKeyIndex = -1;
    let portalIdIndex = -1;

    for (let i = 0; i < columnNameRow.length; i++) {
      const columnName = columnNameRow[i]?.toLowerCase().trim();
      if (columnName.includes('portal') && columnName.includes('lookup')) {
        lookupKeyIndex = i;
      }
      if (columnName.includes('portal') && columnName.includes('id') && !columnName.includes('lookup')) {
        portalIdIndex = i;
      }
    }

    if (lookupKeyIndex === -1 || portalIdIndex === -1) {
      return NextResponse.json({
        success: false,
        error: 'Portal columns not found in roster metadata'
      }, { status: 500 });
    }

    // Step 2: Construct lookup key from input
    const lookupKey = `${lastName.toLowerCase()}${birthMonth}${birthYear}`;

    // Step 3: Get roster data and search for matching lookup key
    const rosterData = await getSheetData(ROSTER_SHEET_ID, 'A5:AZ1000'); // Skip metadata rows

    for (const row of rosterData) {
      const rowLookupKey = row[lookupKeyIndex]?.toString().trim();
      if (rowLookupKey === lookupKey) {
        const playerPortalId = row[portalIdIndex]?.toString().trim();

        if (playerPortalId) {
          return NextResponse.json({
            success: true,
            playerPortalId
          });
        }
      }
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