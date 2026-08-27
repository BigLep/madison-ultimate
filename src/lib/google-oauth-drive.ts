// Drive access via the madisonultimate@gmail.com OAuth identity (refresh token), NOT the
// service account: service accounts have zero Drive storage quota and cannot create files
// in My Drive folders (see docs/fall-2026/signup-plan.md section 10 and the
// madison-ultimate-admin/finalforms-export README, which established this same pattern for
// CSV uploads). Used only for photo uploads; all other Drive/Sheets access stays on the
// service account in google-api.ts.

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Readable } from 'stream';

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
      media,
    });
    return res.data.id || existingFileId;
  }

  const extension = mimeType.split('/')[1] || 'jpg';
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
