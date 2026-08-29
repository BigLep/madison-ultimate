import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/google-api', () => ({
  getSheetDataWithHyperlinks: vi.fn(async () => []),
}));

vi.mock('@/lib/google-oauth-drive', () => ({
  downloadDriveFile: vi.fn(async () => null),
  uploadPlayerPhoto: vi.fn(async () => 'newFileId'),
}));

vi.mock('@/lib/sheet-config', () => ({
  SHEET_CONFIG: {
    ROSTER_SHEET_NAME: '📋 Roster',
    FALL_2025_ROSTER_SHEET_ID: 'fall-2025-roster-sheet-id',
  },
}));

import { getSheetDataWithHyperlinks } from '@/lib/google-api';
import { downloadDriveFile, uploadPlayerPhoto } from '@/lib/google-oauth-drive';
import { SHEET_CONFIG } from '@/lib/sheet-config';
import { findLastSeasonPhotoFileId, carryOverPhotoFromLastSeason, extractDriveFileId } from '@/lib/photo-carryover';

const HEADER_ROW = [
  'StudentID', 'First Name', 'Last Name', 'Full Name', 'Grade',
];
function withPhotoHeader(row: unknown[]) {
  return [...HEADER_ROW.slice(0, 4), 'Photo Download', ...row.slice(5)];
}

describe('extractDriveFileId', () => {
  it('extracts the id from a ?id= query param', () => {
    expect(extractDriveFileId('https://drive.google.com/uc?id=1IuloKUh4FRaP2_0Mutkt44ibA_t7ju69'))
      .toBe('1IuloKUh4FRaP2_0Mutkt44ibA_t7ju69');
  });

  it('extracts the id from a /d/<id>/ path', () => {
    expect(extractDriveFileId('https://drive.google.com/file/d/1IuloKUh4FRaP2_0Mutkt44ibA_t7ju69/view'))
      .toBe('1IuloKUh4FRaP2_0Mutkt44ibA_t7ju69');
  });

  it('returns null for a url with no recognizable id', () => {
    expect(extractDriveFileId('https://example.com/nothing-here')).toBeNull();
  });
});

describe('findLastSeasonPhotoFileId', () => {
  beforeEach(() => {
    vi.mocked(getSheetDataWithHyperlinks).mockReset();
    (SHEET_CONFIG as { FALL_2025_ROSTER_SHEET_ID?: string }).FALL_2025_ROSTER_SHEET_ID = 'fall-2025-roster-sheet-id';
  });

  it('finds the photo file id for a matching StudentID, using header names not positions', async () => {
    vi.mocked(getSheetDataWithHyperlinks).mockResolvedValue([
      withPhotoHeader(['StudentID', 'First', 'Last', 'Full Name']),
      ['ab0512', 'TestFirst', 'TestLast', 'TestLast Full', { text: 'Photo Download', url: 'https://drive.google.com/uc?id=1IuloKUh4FRaP2_0Mutkt44ibA_t7ju69' }],
    ] as any);

    const fileId = await findLastSeasonPhotoFileId('ab0512');
    expect(fileId).toBe('1IuloKUh4FRaP2_0Mutkt44ibA_t7ju69');
  });

  it('returns null when no row matches the studentId', async () => {
    vi.mocked(getSheetDataWithHyperlinks).mockResolvedValue([
      withPhotoHeader(['StudentID', 'First', 'Last', 'Full Name']),
      ['zz9999', 'TestFirst', 'TestLast', 'TestLast Full', 'https://drive.google.com/uc?id=someOtherFile'],
    ] as any);

    expect(await findLastSeasonPhotoFileId('ab0512')).toBeNull();
  });

  it('returns null when the matching row has no photo url', async () => {
    vi.mocked(getSheetDataWithHyperlinks).mockResolvedValue([
      withPhotoHeader(['StudentID', 'First', 'Last', 'Full Name']),
      ['ab0512', 'TestFirst', 'TestLast', 'TestLast Full', ''],
    ] as any);

    expect(await findLastSeasonPhotoFileId('ab0512')).toBeNull();
  });

  it('returns null and skips the lookup entirely when the sheet id is not configured', async () => {
    (SHEET_CONFIG as { FALL_2025_ROSTER_SHEET_ID?: string }).FALL_2025_ROSTER_SHEET_ID = undefined;
    expect(await findLastSeasonPhotoFileId('ab0512')).toBeNull();
    expect(getSheetDataWithHyperlinks).not.toHaveBeenCalled();
  });
});

describe('carryOverPhotoFromLastSeason', () => {
  beforeEach(() => {
    vi.mocked(getSheetDataWithHyperlinks).mockReset();
    vi.mocked(downloadDriveFile).mockReset();
    vi.mocked(uploadPlayerPhoto).mockReset();
    (SHEET_CONFIG as { FALL_2025_ROSTER_SHEET_ID?: string }).FALL_2025_ROSTER_SHEET_ID = 'fall-2025-roster-sheet-id';
  });

  it('downloads last season\'s photo and re-uploads it under this season\'s playerId', async () => {
    vi.mocked(getSheetDataWithHyperlinks).mockResolvedValue([
      withPhotoHeader(['StudentID', 'First', 'Last', 'Full Name']),
      ['ab0512', 'TestFirst', 'TestLast', 'TestLast Full', 'https://drive.google.com/uc?id=1IuloKUh4FRaP2_0Mutkt44ibA_t7ju69'],
    ] as any);
    vi.mocked(downloadDriveFile).mockResolvedValue({ buffer: Buffer.from('fake-bytes'), mimeType: 'image/jpeg' });
    vi.mocked(uploadPlayerPhoto).mockResolvedValue('P047-new-file-id');

    const result = await carryOverPhotoFromLastSeason('P047', 'ab0512');

    expect(downloadDriveFile).toHaveBeenCalledWith('1IuloKUh4FRaP2_0Mutkt44ibA_t7ju69');
    expect(uploadPlayerPhoto).toHaveBeenCalledWith('P047', Buffer.from('fake-bytes'), 'image/jpeg');
    expect(result).toBe('P047-new-file-id');
  });

  it('returns null without uploading when there is no last-season photo', async () => {
    vi.mocked(getSheetDataWithHyperlinks).mockResolvedValue([
      withPhotoHeader(['StudentID', 'First', 'Last', 'Full Name']),
      ['zz9999', 'TestFirst', 'TestLast', 'TestLast Full', 'https://drive.google.com/uc?id=someOtherFile'],
    ] as any);

    const result = await carryOverPhotoFromLastSeason('P047', 'ab0512');

    expect(uploadPlayerPhoto).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('returns null without uploading when the Drive download fails', async () => {
    vi.mocked(getSheetDataWithHyperlinks).mockResolvedValue([
      withPhotoHeader(['StudentID', 'First', 'Last', 'Full Name']),
      ['ab0512', 'TestFirst', 'TestLast', 'TestLast Full', 'https://drive.google.com/uc?id=1IuloKUh4FRaP2_0Mutkt44ibA_t7ju69'],
    ] as any);
    vi.mocked(downloadDriveFile).mockResolvedValue(null);

    const result = await carryOverPhotoFromLastSeason('P047', 'ab0512');

    expect(uploadPlayerPhoto).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
