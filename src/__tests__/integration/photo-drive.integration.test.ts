// Integration test: exercises the photo upload/download pipeline and Photo Carryover against
// real Google Drive and Sheets (never the production photos folder or Fall 2025 roster sheet).
// Requires PHOTOS_FOLDER_ID_TEST, FALL_2025_ROSTER_SHEET_ID_TEST, the GOOGLE_OAUTH_* credentials,
// and Google service account credentials; skipped automatically when any are absent.
//
// Unlike the mocked unit tests (google-oauth-drive.test.ts equivalents, photo-carryover.test.ts),
// this catches real Drive/Sheets API behavior mocks can't: whether replace-in-place genuinely
// keeps the same file id, whether downloaded bytes round-trip, and whether header discovery
// across a real sheet out to column AQ actually finds the right row. See docs/TEST_DESIGN.md.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const PHOTOS_FOLDER_ID_TEST = process.env.PHOTOS_FOLDER_ID_TEST;
const FALL_2025_ROSTER_SHEET_ID_TEST = process.env.FALL_2025_ROSTER_SHEET_ID_TEST;
const HAS_SHEETS_CREDENTIALS = Boolean(
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE
);
const HAS_OAUTH_CREDENTIALS = Boolean(
  process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_OAUTH_REFRESH_TOKEN
);

// Test-only Drive client, deliberately separate from google-oauth-drive.ts: it exposes no
// delete operation (Photo Carryover's round-3 decision dropped delete/archive from scope, see
// docs/adr/0003), but integration-test artifacts still need cleaning up after every run.
function testOnlyDriveClient() {
  const auth = new OAuth2Client({
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  });
  auth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth });
}

const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMDAwMDAwMDAwMEAwMEBQQEBAQFBQUFBQUFBQX/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9k=',
  'base64'
);
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==',
  'base64'
);

describe.skipIf(!PHOTOS_FOLDER_ID_TEST || !HAS_OAUTH_CREDENTIALS)(
  'photo upload/download round-trip (real Google Drive)',
  () => {
    let googleOauthDrive: typeof import('@/lib/google-oauth-drive');
    let testDrive: ReturnType<typeof testOnlyDriveClient>;
    let uploadedFileId: string | undefined;

    beforeAll(async () => {
      vi.stubEnv('PHOTOS_FOLDER_ID', PHOTOS_FOLDER_ID_TEST!);
      googleOauthDrive = await import('@/lib/google-oauth-drive');
      testDrive = testOnlyDriveClient();
    });

    afterAll(async () => {
      if (uploadedFileId) {
        await testDrive.files.delete({ fileId: uploadedFileId }).catch(() => {});
      }
    });

    it('creates, replaces in place, and downloads a player photo', async () => {
      const playerId = `it-photo-${Date.now()}`;

      const createdFileId = await googleOauthDrive.uploadPlayerPhoto(playerId, TINY_JPEG, 'image/jpeg');
      expect(createdFileId).toBeTruthy();
      uploadedFileId = createdFileId;

      const downloaded = await googleOauthDrive.downloadDriveFile(createdFileId);
      expect(downloaded).not.toBeNull();
      expect(downloaded!.mimeType).toBe('image/jpeg');
      expect(downloaded!.buffer.equals(TINY_JPEG)).toBe(true);

      const replacedFileId = await googleOauthDrive.uploadPlayerPhoto(playerId, TINY_PNG, 'image/png', createdFileId);
      expect(replacedFileId).toBe(createdFileId);

      const replaced = await googleOauthDrive.downloadDriveFile(createdFileId);
      expect(replaced).not.toBeNull();
      expect(replaced!.mimeType).toBe('image/png');
      expect(replaced!.buffer.equals(TINY_PNG)).toBe(true);
    });
  }
);

describe.skipIf(
  !PHOTOS_FOLDER_ID_TEST || !FALL_2025_ROSTER_SHEET_ID_TEST || !HAS_SHEETS_CREDENTIALS || !HAS_OAUTH_CREDENTIALS
)('Photo Carryover (real Google Sheets + Drive)', () => {
  let photoCarryover: typeof import('@/lib/photo-carryover');
  let googleOauthDrive: typeof import('@/lib/google-oauth-drive');
  let googleApi: typeof import('@/lib/google-api');
  let sheetConfig: typeof import('@/lib/sheet-config');
  let testDrive: ReturnType<typeof testOnlyDriveClient>;

  const studentId = `it-student-${Date.now()}`;
  let lastSeasonFileId: string | undefined;
  let carriedOverFileId: string | undefined;

  beforeAll(async () => {
    // FALL_2025_ROSTER_SHEET_ID is baked into SHEET_CONFIG at module-eval time (same bake-in
    // hazard as SIGNUPS_SHEET_ID, see signups-sheet.integration.test.ts): reset the module
    // registry and stub the env before the first import of sheet-config in this process, then
    // verify it actually resolved to the test sheet before touching anything.
    vi.resetModules();
    vi.stubEnv('FALL_2025_ROSTER_SHEET_ID', FALL_2025_ROSTER_SHEET_ID_TEST!);
    vi.stubEnv('PHOTOS_FOLDER_ID', PHOTOS_FOLDER_ID_TEST!);

    sheetConfig = await import('@/lib/sheet-config');
    if (sheetConfig.SHEET_CONFIG.FALL_2025_ROSTER_SHEET_ID !== FALL_2025_ROSTER_SHEET_ID_TEST) {
      throw new Error(
        `Refusing to run: sheet-config resolved FALL_2025_ROSTER_SHEET_ID to ` +
          `"${sheetConfig.SHEET_CONFIG.FALL_2025_ROSTER_SHEET_ID}", expected the test sheet ` +
          `"${FALL_2025_ROSTER_SHEET_ID_TEST}". This must never point at the real Fall 2025 roster.`
      );
    }

    googleApi = await import('@/lib/google-api');
    googleOauthDrive = await import('@/lib/google-oauth-drive');
    photoCarryover = await import('@/lib/photo-carryover');
    testDrive = testOnlyDriveClient();

    // Seed "last season's photo": upload a real file to the test Drive folder, then write a
    // fixture row into the test sheet's fixed scratch row (row 2) pointing at it. A fixed row
    // (rather than appending a new one every run) keeps the test sheet from growing unboundedly.
    lastSeasonFileId = await googleOauthDrive.uploadPlayerPhoto(`it-lastseason-${Date.now()}`, TINY_JPEG, 'image/jpeg');
    await googleApi.updateSheetData(FALL_2025_ROSTER_SHEET_ID_TEST!, "'📋 Roster'!B2", [[studentId]]);
    await googleApi.updateSheetData(FALL_2025_ROSTER_SHEET_ID_TEST!, "'📋 Roster'!AQ2", [
      [`https://drive.google.com/uc?id=${lastSeasonFileId}`],
    ]);
  });

  afterAll(async () => {
    await googleApi.clearSheetData(FALL_2025_ROSTER_SHEET_ID_TEST!, "'📋 Roster'!B2:AQ2").catch(() => {});
    for (const fileId of [lastSeasonFileId, carriedOverFileId]) {
      if (fileId) await testDrive.files.delete({ fileId }).catch(() => {});
    }
  });

  it('finds, downloads, and copies last season\'s photo under the new PlayerID', async () => {
    const foundFileId = await photoCarryover.findLastSeasonPhotoFileId(studentId);
    expect(foundFileId).toBe(lastSeasonFileId);

    const newPlayerId = `it-photo-carried-${Date.now()}`;
    const resultFileId = await photoCarryover.carryOverPhotoFromLastSeason(newPlayerId, studentId);
    expect(resultFileId).toBeTruthy();
    expect(resultFileId).not.toBe(lastSeasonFileId);
    carriedOverFileId = resultFileId!;

    const copied = await googleOauthDrive.downloadDriveFile(resultFileId!);
    expect(copied).not.toBeNull();
    expect(copied!.buffer.equals(TINY_JPEG)).toBe(true);
  });

  it('returns null for a studentId with no row in the test sheet', async () => {
    const result = await photoCarryover.findLastSeasonPhotoFileId(`no-such-student-${Date.now()}`);
    expect(result).toBeNull();
  });
});
