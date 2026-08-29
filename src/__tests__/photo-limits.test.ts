import { describe, it, expect } from 'vitest';
import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_MB,
  photoContentDisposition,
  photoContentType,
  photoDownloadFilename,
  photoExtension,
  photoTooLargeMessage,
} from '@/lib/photo-limits';

describe('photoTooLargeMessage', () => {
  it('names the 5 MB cap and the actual size to one decimal', () => {
    expect(PHOTO_MAX_MB).toBe(5);
    expect(photoTooLargeMessage(PHOTO_MAX_BYTES + 1)).toBe(
      'Photos must be 5 MB or smaller. This one is 5.0 MB.'
    );
    expect(photoTooLargeMessage(8.4 * 1024 * 1024)).toBe(
      'Photos must be 5 MB or smaller. This one is 8.4 MB.'
    );
  });
});

describe('photo download naming', () => {
  it('treats HEIF as HEIC, the filename families expect', () => {
    expect(photoExtension('image/heif')).toBe('heic');
    expect(photoExtension('image/heic')).toBe('heic');
    expect(photoContentType('image/heif')).toBe('image/heic');
  });

  it('builds firstNameLastName.ext from preferred name and last name', () => {
    expect(photoDownloadFilename('TestFirst', 'TestLast', 'image/heif')).toBe('TestFirstTestLast.heic');
    expect(photoDownloadFilename('Test First', 'Test-Last', 'image/jpeg')).toBe('TestFirstTestLast.jpg');
    expect(photoDownloadFilename('', '', 'image/png')).toBe('photo.png');
  });

  it('sets both ASCII and UTF-8 Content-Disposition filenames', () => {
    expect(photoContentDisposition('TestFirstTestLast.heic')).toBe(
      'inline; filename="TestFirstTestLast.heic"; filename*=UTF-8\'\'TestFirstTestLast.heic'
    );
  });
});
