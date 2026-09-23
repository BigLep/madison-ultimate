// Short gender-division codes for coach-facing filters (e.g. the Player Directory). The Fall 2026
// signup form's Gender Identification is exactly one of two full strings — see
// GENDER_IDENTIFICATION_OPTIONS in signup-form-schema.ts — each carrying one of these codes.

export const GENDER_CODE_ORDER = ['Gx', 'Bx'] as const;

export type GenderCode = (typeof GENDER_CODE_ORDER)[number];

/** Extracts the Gx/Bx code from a full Gender Identification value, or '' if neither is present. */
export function shortGenderCode(gender: string | null | undefined): GenderCode | '' {
  const g = gender || '';
  if (g.includes('/Gx/')) return 'Gx';
  if (g.includes('/Bx/')) return 'Bx';
  return '';
}
