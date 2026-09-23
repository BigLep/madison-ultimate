import { describe, it, expect } from 'vitest';
import { shortGenderCode } from '@/lib/gender-display';

describe('shortGenderCode', () => {
  it('extracts Gx and Bx from the two Fall 2026 Gender Identification options', () => {
    expect(shortGenderCode('Girl-Matching/Gx/Non-binary')).toBe('Gx');
    expect(shortGenderCode('Boy-Matching/Bx/Non-binary')).toBe('Bx');
  });

  it('returns "" for blank, unset, or an unrecognized value', () => {
    expect(shortGenderCode('')).toBe('');
    expect(shortGenderCode(undefined)).toBe('');
    expect(shortGenderCode('Prefer not to say')).toBe('');
  });
});
