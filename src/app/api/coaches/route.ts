// Public list of Coaches for the Coaches Page and the Coach Login name list (CONTEXT.md).
// Only name, About, and whether a Coach Photo exists: never email or phone.

import { NextResponse } from 'next/server';
import { listCoaches } from '../../../lib/coaches-sheet';
import { toPublicCoach } from '../../../lib/coaches-table';

export async function GET() {
  try {
    const coaches = await listCoaches();
    return NextResponse.json({ success: true, coaches: coaches.map(toPublicCoach) });
  } catch (error) {
    console.error('Error listing coaches:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
