import { NextRequest, NextResponse } from 'next/server';
import { appendSheetData } from '@/lib/google-api';

const ROSTER_SHEET_ID = process.env.ROSTER_SHEET_ID || '1ZZA5TxHu8nmtyNORm3xYtN5rzP3p1jtW178UgRcxLA8';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing append operation to roster sheet');
    
    // Test appending a simple row
    const testRow = ['Test Player', 'Test', 'Player', 'test@example.com', '', '', '', 'TRUE', 'TRUE', 'TRUE', 'M', '7'];
    const range = 'A6:Z6'; // Start after metadata rows
    
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