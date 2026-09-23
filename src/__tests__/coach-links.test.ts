import { describe, it, expect } from 'vitest';
import { coachKeyLinks, coachSheetUrl } from '../lib/coach-links';

describe('coachSheetUrl', () => {
  it('opens the coach workbook, on a given tab when its gid is known', () => {
    expect(coachSheetUrl('sheet123')).toBe('https://docs.google.com/spreadsheets/d/sheet123/edit');
    expect(coachSheetUrl('sheet123', 42)).toBe('https://docs.google.com/spreadsheets/d/sheet123/edit#gid=42');
    expect(coachSheetUrl('')).toBeNull();
  });
});

describe('coachKeyLinks', () => {
  it('lists the coach spreadsheet, Practice Plans, and Communication doc, hiding any whose env var is unset', () => {
    expect(
      coachKeyLinks({ rosterSheetId: 'sheet123', practicePlansDocUrl: 'https://docs.example/plans', commsDocUrl: '' }).map(l => [l.title, l.href])
    ).toEqual([
      ['Coach spreadsheet', 'https://docs.google.com/spreadsheets/d/sheet123/edit'],
      ['Practice Plans', 'https://docs.example/plans'],
    ]);
  });
});
