// Drive access via the madisonultimate@gmail.com OAuth identity (refresh token), NOT the
// service account: service accounts have zero Drive storage quota and cannot create files
// in My Drive folders (see docs/fall-2026/signup-plan.md section 10 and the
// madison-ultimate-admin/finalforms-export README, which established this same pattern for
// CSV uploads). Used only for photo uploads; all other Drive/Sheets access stays on the
// service account in google-api.ts.

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Readable } from 'stream';
import { photoExtension } from './photo-limits';

function getOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Photo upload requires GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN ' +
        '(the same madisonultimate@gmail.com OAuth identity used by finalforms-export).'
    );
  }

  const client = new OAuth2Client({ clientId, clientSecret });
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

function getPhotosFolderId(): string {
  const folderId = process.env.PHOTOS_FOLDER_ID;
  if (!folderId) {
    throw new Error('PHOTOS_FOLDER_ID is not set (create a photos folder in the fall Drive folder and share it with the OAuth identity)');
  }
  return folderId;
}

/**
 * Upload (or replace) a player's photo in the photos Drive folder. If `existingFileId` is
 * given, the file's content is replaced in place instead of creating a duplicate. Returns
 * the Drive file id.
 */
export async function uploadPlayerPhoto(
  playerId: string,
  fileBuffer: Buffer,
  mimeType: string,
  existingFileId?: string
): Promise<string> {
  const auth = getOAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const media = { mimeType, body: bufferToStream(fileBuffer) };

  if (existingFileId) {
    const res = await drive.files.update({
      fileId: existingFileId,
      requestBody: { mimeType },
      media,
    });
    return res.data.id || existingFileId;
  }

  const extension = photoExtension(mimeType);
  const res = await drive.files.create({
    requestBody: {
      name: `${playerId}.${extension}`,
      parents: [getPhotosFolderId()],
    },
    media,
    fields: 'id',
  });

  if (!res.data.id) {
    throw new Error('Drive did not return a file id for the uploaded photo');
  }
  return res.data.id;
}

function bufferToStream(buffer: Buffer) {
  return Readable.from(buffer);
}

/**
 * Verifies the photo-upload OAuth identity can authenticate and see a given Drive folder.
 * Read-only; used by /api/diagnostics to check GOOGLE_OAUTH_* + PHOTOS_FOLDER_ID together,
 * since having all three env vars set doesn't guarantee the refresh token is still valid or
 * that it actually has access to that specific folder.
 */
export async function getDriveFolderName(folderId: string): Promise<string | null> {
  try {
    const auth = getOAuthClient();
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.get({ fileId: folderId, fields: 'name' });
    return res.data.name || null;
  } catch (error) {
    console.error(`Error checking Drive folder ${folderId}:`, error);
    return null;
  }
}

/**
 * Downloads a Drive file's bytes and mime type through the same OAuth identity photo uploads
 * use. Returns null (rather than throwing) when the file is missing or inaccessible, so callers
 * like Photo Carryover can treat that as "nothing to carry over" instead of a hard failure.
 */
export async function downloadDriveFile(fileId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const auth = getOAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    const metadata = await drive.files.get({ fileId, fields: 'mimeType' });
    const mimeType = metadata.data.mimeType || 'application/octet-stream';

    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    return { buffer: Buffer.from(res.data as ArrayBuffer), mimeType };
  } catch (error) {
    console.error(`Error downloading Drive file ${fileId}:`, error);
    return null;
  }
}
