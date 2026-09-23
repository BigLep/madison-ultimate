// Public Coach Photo bytes for the Coaches Page (grill Q21). Uploads go through the gated
// /api/coach/coaches/[coachId]/photo route.

import { NextRequest, NextResponse } from 'next/server';
import { findCoach } from '../../../../../lib/coaches-sheet';
import { drivePhotoResponse } from '../../../../../lib/photo-response';

export async function GET(request: NextRequest, { params }: { params: Promise<{ coachId: string }> }) {
  try {
    const { coachId } = await params;
    const coach = await findCoach(coachId);
    if (!coach || !coach.photoDriveFileId) {
      return NextResponse.json({ success: false, error: 'No photo' }, { status: 404 });
    }
    const [firstName = '', ...rest] = coach.name.split(/\s+/);
    // Short public cache: the page passes ?v= after an upload, so a new photo shows right away.
    return drivePhotoResponse(coach.photoDriveFileId, { firstName, lastName: rest.join(' ') }, 'public, max-age=300');
  } catch (error) {
    console.error('Error fetching coach photo:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
