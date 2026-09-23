// Request and response halves of a photo route, shared by Player Photos and Coach Photos.
// Bytes are served directly rather than as a Drive link: viewers have no Google sign-in, and
// Drive's own links either need Drive auth or don't render HEIC in a browser (ADR 0003). No
// conversion: the browser decides whether it can render the bytes.

import { NextRequest, NextResponse } from 'next/server';
import { downloadDriveFile } from './google-oauth-drive';
import { PHOTO_ALLOWED_TYPES, PHOTO_MAX_BYTES, photoContentDisposition, photoContentType, photoDownloadFilename, photoTooLargeMessage } from './photo-limits';

/**
 * Stream a Drive photo back to the browser, named from a display name at download time.
 * `cacheControl` defaults to private/no-cache (Player Photos); the public Coaches Page passes a
 * short public max-age.
 */
export async function drivePhotoResponse(
  fileId: string,
  name: { firstName: string; lastName: string },
  cacheControl = 'private, no-cache, must-revalidate'
): Promise<NextResponse> {
  const file = await downloadDriveFile(fileId);
  if (!file) {
    return NextResponse.json({ success: false, error: 'Photo not found in Drive' }, { status: 404 });
  }
  const filename = photoDownloadFilename(name.firstName, name.lastName, file.mimeType);
  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      'Content-Type': photoContentType(file.mimeType),
      'Content-Disposition': photoContentDisposition(filename),
      'Cache-Control': cacheControl,
    },
  });
}

/** The uploaded `photo` form field, or a 400 response when it is missing, the wrong type, or too large. */
export async function readPhotoUpload(request: NextRequest): Promise<{ buffer: Buffer; mimeType: string } | NextResponse> {
  const formData = await request.formData();
  const file = formData.get('photo');
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: 'No photo provided' }, { status: 400 });
  }
  if (!(PHOTO_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json({ success: false, error: 'Unsupported file type' }, { status: 400 });
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return NextResponse.json({ success: false, error: photoTooLargeMessage(file.size) }, { status: 400 });
  }
  return { buffer: Buffer.from(await file.arrayBuffer()), mimeType: file.type };
}
