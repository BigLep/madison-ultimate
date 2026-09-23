import { describe, it, expect } from 'vitest';
import { parseCoachesTable, coachInitials, coachFieldsToRow } from '../lib/coaches-table';

const HEADER = ['CoachID', 'Name', 'Email', 'Phone', 'About', 'Photo Drive File ID'];

describe('parseCoachesTable', () => {
  it('returns coaches in sheet order with their 1-based row numbers, skipping rows without a CoachID', () => {
    const coaches = parseCoachesTable([
      HEADER,
      ['c0001', 'TestFirst One', 'one@example.com', '555-0100', '- Coach **one**', 'file1'],
      ['', 'TestFirst Unminted', '', '', '', ''],
      ['c0002', 'TestFirst Two', '', '', ''],
    ]);
    expect(coaches).toEqual([
      { coachId: 'c0001', name: 'TestFirst One', email: 'one@example.com', phone: '555-0100', about: '- Coach **one**', photoDriveFileId: 'file1', rowNumber: 2 },
      { coachId: 'c0002', name: 'TestFirst Two', email: '', phone: '', about: '', photoDriveFileId: '', rowNumber: 4 },
    ]);
  });

  it('finds columns by header name, not position', () => {
    const [coach] = parseCoachesTable([
      ['Name', 'About', 'CoachID'],
      ['TestFirst One', 'hi', 'c0001'],
    ]);
    expect(coach).toMatchObject({ coachId: 'c0001', name: 'TestFirst One', about: 'hi', email: '' });
  });

  it('returns nothing when the tab has no CoachID column', () => {
    expect(parseCoachesTable([['Name'], ['TestFirst One']])).toEqual([]);
    expect(parseCoachesTable([])).toEqual([]);
  });
});

describe('coachFieldsToRow', () => {
  it('writes only the given fields into their columns and leaves the rest of the row as it was', () => {
    const header = ['CoachID', 'Name', 'Extra', 'Email', 'About'];
    const existing = ['c0001', 'Old Name', 'keep me', 'old@example.com', 'old'];
    expect(coachFieldsToRow(header, existing, { name: 'New Name', about: 'new' })).toEqual([
      'c0001', 'New Name', 'keep me', 'old@example.com', 'new',
    ]);
  });
});

describe('coachInitials', () => {
  it('uses the first letters of the first and last words', () => {
    expect(coachInitials('TestFirst Middle TestLast')).toBe('TT');
    expect(coachInitials('Solo')).toBe('S');
    expect(coachInitials('  ')).toBe('');
  });
});
