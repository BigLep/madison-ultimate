import { NextResponse } from 'next/server';
import { getSheetData } from '../../../../lib/google-api';
import { SHEET_CONFIG } from '../../../../lib/sheet-config';

const ROSTER_SHEET_ID = SHEET_CONFIG.ROSTER_SHEET_ID;

export async function GET() {
  try {
    // Get sample data including Portal columns (AQ and AR)
    const data = await getSheetData(ROSTER_SHEET_ID, `A${SHEET_CONFIG.DATA_START_ROW}:AR10`);

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