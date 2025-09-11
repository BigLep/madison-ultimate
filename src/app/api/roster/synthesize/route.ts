import { NextRequest, NextResponse } from 'next/server';
import { RosterSynthesizer } from '@/lib/roster-synthesizer';

export async function POST(request: NextRequest) {
  try {
    const synthesizer = new RosterSynthesizer();
    const result = await synthesizer.synthesizeRoster();
    
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error synthesizing roster:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to synthesize roster',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// Also support GET for testing/preview mode
export async function GET(request: NextRequest) {
  return POST(request);
}