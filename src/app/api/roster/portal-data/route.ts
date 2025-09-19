import { NextResponse } from 'next/server';
import { getSheetData } from '../../../../lib/google-api';

const ROSTER_SHEET_ID = process.env.ROSTER_SHEET_ID || '1ZZA5TxHu8nmtyNORm3xYtN5rzP3p1jtW178UgRcxLA8';

export async function GET() {
  try {
    // Get sample data including Portal columns (AQ and AR)
    const data = await getSheetData(ROSTER_SHEET_ID, 'A5:AR10');

    return NextResponse.json({
      success: true,
      data: {
        rows: data,
        portalColumnIndexes: {
          lookupKey: 42, // AQ column (0-indexed)
          portalId: 43   // AR column (0-indexed)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching portal data:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}