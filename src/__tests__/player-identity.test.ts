import { describe, it, expect } from 'vitest';
import {
  mintPlayerId,
  normalizeName,
  normalizeDateOfBirth,
  disambiguateByPreferredName,
  isNearMatch,
  SignupIdentity,
} from '@/lib/player-identity';

function identity(overrides: Partial<SignupIdentity>): SignupIdentity {
  return {
    preferredFirstName: 'Afirst',
    lastName: 'Blast',
    dateOfBirth: '2014-05-12',
    ...overrides,
  };
}

describe('normalizeName', () => {
  it('returns empty string for null, undefined, or empty', () => {
    expect(normalizeName(null)).toBe('');
    expect(normalizeName(undefined)).toBe('');
    expect(normalizeName('')).toBe('');
    expect(normalizeName('   ')).toBe('');
  });

  it('trims, lowercases, and strips internal spaces', () => {
    expect(normalizeName('  Y Last  ')).toBe('ylast');
    expect(normalizeName('YLast ZName')).toBe('ylastzname');
  });

  it('strips straight and curly apostrophes', () => {
    expect(normalizeName("O'Brien")).toBe('obrien');
    expect(normalizeName('O’Brien')).toBe('obrien');
  });

  it('folds accents to plain letters', () => {
    expect(normalizeName('José')).toBe('jose');
    expect(normalizeName('Ñame')).toBe('name');
  });

  it('keeps hyphens', () => {
    expect(normalizeName('Q-RlastName')).toBe('q-rlastname');
  });
});

describe('normalizeDateOfBirth', () => {
  it('returns empty string for unparseable or empty values', () => {
    expect(normalizeDateOfBirth(null)).toBe('');
    expect(normalizeDateOfBirth('')).toBe('');
    expect(normalizeDateOfBirth('not-a-date')).toBe('');
    expect(normalizeDateOfBirth('05-12-2014')).toBe('');
  });

  it('passes through ISO YYYY-MM-DD (including a trailing time prefix match)', () => {
    expect(normalizeDateOfBirth('2014-05-12')).toBe('2014-05-12');
    expect(normalizeDateOfBirth('2014-05-12T00:00:00Z')).toBe('2014-05-12');
  });

  it('normalizes M/D/YYYY and MM/DD/YYYY to ISO', () => {
    expect(normalizeDateOfBirth('5/12/2014')).toBe('2014-05-12');
    expect(normalizeDateOfBirth('05/12/2014')).toBe('2014-05-12');
  });
});

describe('mintPlayerId', () => {
  it('returns an opaque slug of the requested length from the safe alphabet', () => {
    const id = mintPlayerId();
    expect(id).toHaveLength(10);
    expect(id).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]+$/);
  });

  it('is not derived from name or birthdate', () => {
    const id = mintPlayerId();
    expect(id.toLowerCase()).not.toContain('afirst');
    expect(id).not.toContain('2014');
    expect(id).not.toContain('0512');
  });

  it('returns a different value on successive calls', () => {
    expect(mintPlayerId()).not.toBe(mintPlayerId());
  });
});

describe('disambiguateByPreferredName', () => {
  const alex = identity({ preferredFirstName: 'Alex' });
  const blake = identity({ preferredFirstName: 'Blake' });

  it('returns -1 when there are no candidates', () => {
    expect(disambiguateByPreferredName({ preferredFirstName: 'Alex' }, [])).toBe(-1);
  });

  it('returns 0 for a single candidate even if the preferred name does not match', () => {
    expect(disambiguateByPreferredName({ preferredFirstName: 'Unrelated' }, [alex])).toBe(0);
  });

  it('picks the exact preferred-name match among twins', () => {
    expect(disambiguateByPreferredName({ preferredFirstName: 'Blake' }, [alex, blake])).toBe(1);
  });

  it('falls back to the longest shared leading-letter prefix', () => {
    expect(disambiguateByPreferredName({ preferredFirstName: 'Ale' }, [alex, blake])).toBe(0);
  });

  it('returns -1 when no letters are shared', () => {
    expect(disambiguateByPreferredName({ preferredFirstName: 'Zed' }, [alex, blake])).toBe(-1);
  });
});

describe('isNearMatch', () => {
  it('is true for the same normalized last name and birthdate', () => {
    expect(
      isNearMatch(
        identity({ preferredFirstName: 'Alex', lastName: 'Blast' }),
        identity({ preferredFirstName: 'Blake', lastName: 'Blast' })
      )
    ).toBe(true);
  });

  it('is true for a similar last name (long shared prefix) and the same birthdate', () => {
    expect(
      isNearMatch(identity({ lastName: 'TestLast' }), identity({ lastName: 'TestLasx' }))
    ).toBe(true);
  });

  it('is false for unrelated last names even on the same birthdate', () => {
    expect(
      isNearMatch(identity({ lastName: 'Blast' }), identity({ lastName: 'Unrelated' }))
    ).toBe(false);
  });

  it('is false when either birthdate is unparseable', () => {
    expect(
      isNearMatch(identity({ dateOfBirth: 'nope' }), identity({ dateOfBirth: '2014-05-12' }))
    ).toBe(false);
  });
});
