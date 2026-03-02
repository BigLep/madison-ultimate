import { NextRequest, NextResponse } from 'next/server';
import { appendSheetData } from '@/lib/google-api';
import { SHEET_CONFIG, ROSTER_FIRST_DATA_ROW } from '@/lib/sheet-config';

const ROSTER_SHEET_ID = SHEET_CONFIG.ROSTER_SHEET_ID;

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing append operation to roster sheet');
    
    // Test appending a simple row
    const testRow = ['Test Player', 'Test', 'Player', 'test@example.com', '', '', '', 'TRUE', 'TRUE', 'TRUE', 'M', '7'];
    const range = `A${ROSTER_FIRST_DATA_ROW}:Z${ROSTER_FIRST_DATA_ROW}`;
    
    console.log('🧪 Appending test row:', testRow);
    console.log('🧪 To sheet:', ROSTER_SHEET_ID);
    console.log('🧪 At range:', range);
    
    const result = await appendSheetData(ROSTER_SHEET_ID, range, [testRow]);
    
    console.log('🧪 Append result:', result);
    
    return NextResponse.json({
      success: true,
      result: result,
      message: 'Test row appended successfully'
    });
  } catch (error) {
    console.error('🧪 Test append error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to test append',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}