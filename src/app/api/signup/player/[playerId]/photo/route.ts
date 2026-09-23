import { NextRequest, NextResponse } from 'next/server';
import { findSignupByPlayerId, updateSignupRow } from '../../../../../../lib/signups-sheet';
import { SIGNUPS_COLUMNS } from '../../../../../../lib/signups-config';
import { uploadPlayerPhoto } from '../../../../../../lib/google-oauth-drive';
import { drivePhotoResponse, readPhotoUpload } from '../../../../../../lib/photo-response';

// Serves the player's photo bytes directly (see photo-response.ts and docs/adr/0003);
// PhotoUpload falls back to a plain link when the browser can't render them.
export async function GET(request: NextRequest, { params }: { params: Promise<{ playerId: string }> }) {
  try {
    const { playerId } = await params;
    const existing = await findSignupByPlayerId(playerId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    const fileId = existing.record[SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID];
    if (!fileId) {
      return NextResponse.json({ success: false, error: 'No photo uploaded' }, { status: 404 });
    }

    return drivePhotoResponse(fileId, {
      firstName: existing.record[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME] || '',
      lastName: existing.record[SIGNUPS_COLUMNS.LAST_NAME] || '',
    });
  } catch (error) {
    console.error('Error fetching player photo:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ playerId: string }> }) {
  try {
    const { playerId } = await params;
    const existing = await findSignupByPlayerId(playerId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    const upload = await readPhotoUpload(request);
    if (upload instanceof NextResponse) return upload;
    const { buffer, mimeType } = upload;
    const existingFileId = existing.record[SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID] || undefined;

    const fileId = await uploadPlayerPhoto(playerId, buffer, mimeType, existingFileId);

    const updated = await updateSignupRow(playerId, {
      [SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]: fileId,
    });

    return NextResponse.json({ success: true, record: updated });
  } catch (error) {
    console.error('Error uploading player photo:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
