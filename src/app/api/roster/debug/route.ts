import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/google-api';

const ROSTER_SHEET_ID = process.env.ROSTER_SHEET_ID || '1ZZA5TxHu8nmtyNORm3xYtN5rzP3p1jtW178UgRcxLA8';

export async function GET(request: NextRequest) {
  try {
    console.log('Debug: Using roster sheet ID:', ROSTER_SHEET_ID);
    
    // Try different sheet ranges to find the right tab
    const defaultData = await getSheetData(ROSTER_SHEET_ID, 'A1:Z10');
    const rosterData = await getSheetData(ROSTER_SHEET_ID, 'Roster!A1:Z10');
    const sheetData = await getSheetData(ROSTER_SHEET_ID, 'Sheet1!A1:Z10');
    
    console.log('Debug: Default data:', defaultData);
    console.log('Debug: Roster data:', rosterData);
    console.log('Debug: Sheet1 data:', sheetData);
    
    return NextResponse.json({
      success: true,
      sheetId: ROSTER_SHEET_ID,
      results: {
        default: { length: defaultData.length, data: defaultData },
        roster: { length: rosterData.length, data: rosterData },
        sheet1: { length: sheetData.length, data: sheetData }
      }
    });
  } catch (error) {
    console.error('Debug: Error fetching roster sheet:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch roster sheet',
      details: error instanceof Error ? error.message : 'Unknown error',
      sheetId: ROSTER_SHEET_ID,
    }, { status: 500 });
  }
}