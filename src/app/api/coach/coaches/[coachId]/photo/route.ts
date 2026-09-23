// Coach Photo upload from Coach Home, into its own COACH_PHOTOS_FOLDER_ID (grill Q10). Served
// publicly by /api/coaches/[coachId]/photo.

import { NextRequest, NextResponse } from 'next/server';
import { findCoach, updateCoach } from '../../../../../../lib/coaches-sheet';
import { uploadCoachPhoto } from '../../../../../../lib/google-oauth-drive';
import { readPhotoUpload } from '../../../../../../lib/photo-response';

export async function POST(request: NextRequest, { params }: { params: Promise<{ coachId: string }> }) {
  try {
    if (!process.env.COACH_PHOTOS_FOLDER_ID) {
      return NextResponse.json({ success: false, error: 'Coach photo upload is not set up yet (COACH_PHOTOS_FOLDER_ID).' }, { status: 503 });
    }
    const { coachId } = await params;
    const coach = await findCoach(coachId, { fresh: true });
    if (!coach) {
      return NextResponse.json({ success: false, error: 'Coach not found' }, { status: 404 });
    }

    const upload = await readPhotoUpload(request);
    if (upload instanceof NextResponse) return upload;

    const fileId = await uploadCoachPhoto(coachId, upload.buffer, upload.mimeType, coach.photoDriveFileId || undefined);
    await updateCoach(coachId, { photoDriveFileId: fileId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error uploading coach photo:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
