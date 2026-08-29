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

import { GET } from '@/app/api/signup/player/[playerId]/photo/route';
import { findSignupByPlayerId } from '@/lib/signups-sheet';
import { downloadDriveFile } from '@/lib/google-oauth-drive';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';

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
      record: { [SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]: 'driveFileId' },
    } as any);
    vi.mocked(downloadDriveFile).mockResolvedValue({ buffer: Buffer.from('fake-bytes'), mimeType: 'image/jpeg' });

    const res = await GET(makeRequest(), { params: Promise.resolve({ playerId: 'P047' }) });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.toString()).toBe('fake-bytes');
  });
});
