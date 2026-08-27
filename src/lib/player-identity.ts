// Identity primitives per docs/adr/0001-player-identity-model.md: PlayerID is an opaque
// minted slug, Player Lookup is field matching (no derived key), normalization rules
// live here and only here.

import { randomBytes } from 'crypto';

const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no 0/1/i/l/o to avoid confusion

/** Mint a short random opaque PlayerID. Never derive this from name or birthdate. */
export function mintPlayerId(length = 10): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  }
  return out;
}

/** Normalize a name for comparison: trim, lowercase, strip whitespace/apostrophes, fold accents, keep hyphens. */
export function normalizeName(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '') // strip apostrophes (straight and curly)
    .replace(/\s+/g, ''); // strip internal whitespace, keep hyphens
}

/** Normalize a date of birth string to YYYY-MM-DD for comparison. Returns '' if unparseable. */
export function normalizeDateOfBirth(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  // Already ISO (YYYY-MM-DD)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // M/D/YYYY or MM/DD/YYYY
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return '';
}

export interface SignupIdentity {
  preferredFirstName: string;
  lastName: string;
  dateOfBirth: string;
}

/**
 * Given a lookup query and candidate rows sharing the exact normalized last name +
 * birthdate, disambiguate by normalized preferred first name using as many leading
 * letters as needed. Returns the matching candidate index, or -1 if none/ambiguous.
 */
export function disambiguateByPreferredName<T extends SignupIdentity>(
  query: Pick<SignupIdentity, 'preferredFirstName'>,
  candidates: T[]
): number {
  if (candidates.length === 0) return -1;
  if (candidates.length === 1) return 0;

  const queryName = normalizeName(query.preferredFirstName);
  const exact = candidates.findIndex(c => normalizeName(c.preferredFirstName) === queryName);
  if (exact !== -1) return exact;

  // Fall back to longest shared leading-letter prefix.
  let bestIndex = -1;
  let bestLength = 0;
  for (let i = 0; i < candidates.length; i++) {
    const candidateName = normalizeName(candidates[i].preferredFirstName);
    let shared = 0;
    while (
      shared < queryName.length &&
      shared < candidateName.length &&
      queryName[shared] === candidateName[shared]
    ) {
      shared++;
    }
    if (shared > bestLength) {
      bestLength = shared;
      bestIndex = i;
    }
  }
  return bestLength > 0 ? bestIndex : -1;
}

/** Content-free near-match check (spec C1): same last name + birthdate, or same birthdate + similar last name. */
export function isNearMatch(
  query: SignupIdentity,
  candidate: SignupIdentity
): boolean {
  const queryLast = normalizeName(query.lastName);
  const candidateLast = normalizeName(candidate.lastName);
  const queryDob = normalizeDateOfBirth(query.dateOfBirth);
  const candidateDob = normalizeDateOfBirth(candidate.dateOfBirth);

  if (!queryDob || !candidateDob) return false;

  if (queryLast === candidateLast && queryDob === candidateDob) return true;

  if (queryDob === candidateDob && queryLast !== candidateLast) {
    // Similar last name: shares a long leading prefix without being identical.
    let shared = 0;
    while (
      shared < queryLast.length &&
      shared < candidateLast.length &&
      queryLast[shared] === candidateLast[shared]
    ) {
      shared++;
    }
    if (shared >= 3 && shared >= Math.min(queryLast.length, candidateLast.length) - 1) {
      return true;
    }
  }

  return false;
}
