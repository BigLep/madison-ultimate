import { NextRequest, NextResponse } from 'next/server';
import { findSignupByPlayerId, updateSignupRow } from '../../../../../../lib/signups-sheet';
import { SIGNUPS_COLUMNS } from '../../../../../../lib/signups-config';
import { downloadDriveFile, uploadPlayerPhoto } from '../../../../../../lib/google-oauth-drive';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_BYTES = 15 * 1024 * 1024; // 15MB

// Serves the player's photo bytes directly (rather than a Drive link), since families viewing
// /player/$playerId have no Google sign-in and Drive's own links (thumbnailLink, webContentLink)
// either require Drive auth or don't render HEIC in a browser (docs/adr/0003). No conversion:
// the browser decides whether it can render the bytes; PhotoUpload falls back to a plain link.
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

    const file = await downloadDriveFile(fileId);
    if (!file) {
      return NextResponse.json({ success: false, error: 'Photo not found in Drive' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=60',
      },
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

    const formData = await request.formData();
    const file = formData.get('photo');
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No photo provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Unsupported file type' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, error: 'File too large' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const existingFileId = existing.record[SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID] || undefined;

    const fileId = await uploadPlayerPhoto(playerId, buffer, file.type, existingFileId);

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
