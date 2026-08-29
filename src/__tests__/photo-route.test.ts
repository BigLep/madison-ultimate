import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/signups-sheet', () => ({
  findSignupByPlayerId: vi.fn(async () => null),
  updateSignupRow: vi.fn(async () => ({})),
}));

vi.mock('@/lib/google-oauth-drive', () => ({
  downloadDriveFile: vi.fn(async () => null),
  uploadPlayerPhoto: vi.fn(async () => 'fileId'),
}));

import { GET, POST } from '@/app/api/signup/player/[playerId]/photo/route';
import { findSignupByPlayerId } from '@/lib/signups-sheet';
import { downloadDriveFile, uploadPlayerPhoto } from '@/lib/google-oauth-drive';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';
import { PHOTO_MAX_BYTES } from '@/lib/photo-limits';

function makeRequest() {
  return new NextRequest('http://localhost/api/signup/player/P047/photo');
}

describe('GET /api/signup/player/[playerId]/photo', () => {
  beforeEach(() => {
    vi.mocked(findSignupByPlayerId).mockReset();
    vi.mocked(downloadDriveFile).mockReset();
  });

  it('returns 404 when the player is not found', async () => {
    vi.mocked(findSignupByPlayerId).mockResolvedValue(null as any);

    const res = await GET(makeRequest(), { params: Promise.resolve({ playerId: 'P047' }) });

    expect(res.status).toBe(404);
  });

  it('returns 404 when the player has no photo on file', async () => {
    vi.mocked(findSignupByPlayerId).mockResolvedValue({ record: {} } as any);

    const res = await GET(makeRequest(), { params: Promise.resolve({ playerId: 'P047' }) });

    expect(res.status).toBe(404);
    expect(downloadDriveFile).not.toHaveBeenCalled();
  });

  it('returns 404 when the Drive file cannot be downloaded', async () => {
    vi.mocked(findSignupByPlayerId).mockResolvedValue({
      record: { [SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]: 'driveFileId' },
    } as any);
    vi.mocked(downloadDriveFile).mockResolvedValue(null);

    const res = await GET(makeRequest(), { params: Promise.resolve({ playerId: 'P047' }) });

    expect(res.status).toBe(404);
  });

  it('streams the photo bytes with the right content type when found', async () => {
    vi.mocked(findSignupByPlayerId).mockResolvedValue({
      record: {
        [SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]: 'driveFileId',
        [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'TestFirst',
        [SIGNUPS_COLUMNS.LAST_NAME]: 'TestLast',
      },
    } as any);
    vi.mocked(downloadDriveFile).mockResolvedValue({ buffer: Buffer.from('fake-bytes'), mimeType: 'image/jpeg' });

    const res = await GET(makeRequest(), { params: Promise.resolve({ playerId: 'P047' }) });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('Content-Disposition')).toContain('TestFirstTestLast.jpg');
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.toString()).toBe('fake-bytes');
  });

  it('downloads HEIF as firstNameLastName.heic', async () => {
    vi.mocked(findSignupByPlayerId).mockResolvedValue({
      record: {
        [SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]: 'driveFileId',
        [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'TestFirst',
        [SIGNUPS_COLUMNS.LAST_NAME]: 'TestLast',
      },
    } as any);
    vi.mocked(downloadDriveFile).mockResolvedValue({ buffer: Buffer.from('heif-bytes'), mimeType: 'image/heif' });

    const res = await GET(makeRequest(), { params: Promise.resolve({ playerId: 'P047' }) });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/heic');
    expect(res.headers.get('Content-Disposition')).toBe(
      'inline; filename="TestFirstTestLast.heic"; filename*=UTF-8\'\'TestFirstTestLast.heic'
    );
  });
});

describe('POST /api/signup/player/[playerId]/photo', () => {
  beforeEach(() => {
    vi.mocked(findSignupByPlayerId).mockReset();
    vi.mocked(uploadPlayerPhoto).mockReset();
  });

  function makePost(file: File) {
    const form = new FormData();
    form.append('photo', file);
    return new NextRequest('http://localhost/api/signup/player/P047/photo', { method: 'POST', body: form });
  }

  it('rejects photos larger than 5 MB before talking to Drive', async () => {
    vi.mocked(findSignupByPlayerId).mockResolvedValue({ record: {} } as any);
    const file = new File([new Uint8Array(PHOTO_MAX_BYTES + 1)], 'big.jpg', { type: 'image/jpeg' });

    const res = await POST(makePost(file), { params: Promise.resolve({ playerId: 'P047' }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/5 MB or smaller/);
    expect(uploadPlayerPhoto).not.toHaveBeenCalled();
  });
});
