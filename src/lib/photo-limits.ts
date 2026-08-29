export const PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const PHOTO_MAX_MB = 5
export const PHOTO_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const

const PHOTO_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  // HEIF is the ISO family name; iPhone photos in this family are .heic to families.
  'image/heif': 'heic',
}

export function photoTooLargeMessage(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return `Photos must be ${PHOTO_MAX_MB} MB or smaller. This one is ${mb.toFixed(1)} MB.`
}

export function photoExtension(mimeType: string): string {
  return PHOTO_EXTENSIONS[mimeType.toLowerCase().trim()] || 'jpg'
}

export function photoContentType(mimeType: string): string {
  const key = mimeType.toLowerCase().trim()
  if (key === 'image/heif') return 'image/heic'
  return key || 'application/octet-stream'
}

function filenameBase(firstName: string, lastName: string): string {
  const compact = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .replace(/[^\p{L}\p{N}]+/gu, '')
  return `${compact(firstName)}${compact(lastName)}` || 'photo'
}

export function photoDownloadFilename(firstName: string, lastName: string, mimeType: string): string {
  return `${filenameBase(firstName, lastName)}.${photoExtension(mimeType)}`
}

export function photoContentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_')
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}
