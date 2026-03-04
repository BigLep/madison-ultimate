import { describe, it, expect } from 'vitest';
import { validateColumns } from '@/lib/column-validation';
import { ROSTER_MOCK_HEADER } from './fixtures/roster-mock';

describe('column-validation', () => {
  it('validates fixture header (required + portal columns)', () => {
    const result = validateColumns([...ROSTER_MOCK_HEADER]);
    expect(result.isValid).toBe(true);
    expect(result.missingRequired).toEqual([]);
    expect(result.portalColumns.lookupKey).toBeDefined();
    expect(result.portalColumns.portalId).toBeDefined();
  });

  it('is invalid when Portal Lookup Key column is missing', () => {
    const headerWithoutLookup = [...ROSTER_MOCK_HEADER].filter((c) => c !== 'Portal Lookup Key');
    const result = validateColumns(headerWithoutLookup);
    expect(result.isValid).toBe(false);
    expect(result.portalColumns.lookupKey).toBeUndefined();
  });

  it('is invalid when Portal ID column is missing', () => {
    const headerWithoutPortalId = [...ROSTER_MOCK_HEADER].filter((c) => c !== 'Portal ID');
    const result = validateColumns(headerWithoutPortalId);
    expect(result.isValid).toBe(false);
    expect(result.portalColumns.portalId).toBeUndefined();
  });

  it('is invalid when a required column (e.g. First Name) is missing', () => {
    const headerWithoutFirst = [...ROSTER_MOCK_HEADER].filter((c) => c !== 'First Name');
    const result = validateColumns(headerWithoutFirst);
    expect(result.isValid).toBe(false);
    expect(result.missingRequired).toContain('First Name');
  });
});
