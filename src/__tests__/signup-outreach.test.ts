import { describe, it, expect } from 'vitest';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';
import { NOT_THIS_SEASON } from '@/lib/signup-form-schema';
import { COMPLETE_PLAYER_INFO, signupRecord } from './fixtures/signup-record';
import { buildOutreachEntry, selectAudience, sortForDisplay, type OutreachFinalFormsStatus } from '@/lib/signup-outreach';

const BASE = 'https://portal.example.test';

/** A row with every checklist section done except what a test overrides. */
const doneRow = (overrides = {}) =>
  signupRecord({
    ...COMPLETE_PLAYER_INFO,
    [SIGNUPS_COLUMNS.PLAYER_ID]: 'p001',
    [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: 'TestFirst',
    [SIGNUPS_COLUMNS.LAST_NAME]: 'TestLast',
    [SIGNUPS_COLUMNS.CARETAKER_1_NAME]: 'Ct One',
    [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: 'ct1@example.com',
    [SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]: 'drive-file-1',
    [SIGNUPS_COLUMNS.COACH_VOLUNTEERING_INTEREST]: NOT_THIS_SEASON,
    [SIGNUPS_COLUMNS.VOLUNTEER_ROLES]: NOT_THIS_SEASON,
    ...overrides,
  });

const cleared = { found: true, parentSigned: true, studentSigned: true, physicalCleared: true };

describe('buildOutreachEntry', () => {
  it('is Checklist Complete when all six rows are done, with identity, link, and recipients', () => {
    const entry = buildOutreachEntry(doneRow(), cleared, BASE);
    expect(entry).toEqual({
      playerId: 'p001',
      preferredName: 'TestFirst',
      lastName: 'TestLast',
      fullName: 'TestFirst TestLast',
      caretaker1Name: 'Ct One',
      caretaker2Name: '',
      seeded: false,
      portalUrl: 'https://portal.example.test/player/p001',
      checklist: {
        finalForms: true,
        playerInfo: true,
        photo: true,
        caretakerInfo: true,
        coachVolunteering: true,
        otherVolunteering: true,
      },
      checklistComplete: true,
      finalFormsDetail: { found: true, parentSigned: true, studentSigned: true, physicalCleared: true },
      to: ['ct1@example.com'],
      cc: [],
      warnings: [],
      unreachableReason: null,
    });
  });
});

describe('buildOutreachEntry: rows not done', () => {
  it('a missing volunteering answer alone makes the row not Checklist Complete', () => {
    const entry = buildOutreachEntry(doneRow({ [SIGNUPS_COLUMNS.VOLUNTEER_ROLES]: '' }), cleared, BASE);
    expect(entry.checklist.otherVolunteering).toBe(false);
    expect(entry.checklistComplete).toBe(false);
  });

  it('Final Forms not cleared carries the sub-items so the email can say which side to fix', () => {
    const entry = buildOutreachEntry(doneRow(), { found: true, parentSigned: true, studentSigned: false, physicalCleared: false }, BASE);
    expect(entry.checklist.finalForms).toBe(false);
    expect(entry.checklistComplete).toBe(false);
    expect(entry.finalFormsDetail).toEqual({ found: true, parentSigned: true, studentSigned: false, physicalCleared: false });
  });

  it('Final Forms not found reports found false and every sub-item false', () => {
    expect(buildOutreachEntry(doneRow(), null, BASE).finalFormsDetail).toEqual({
      found: false,
      parentSigned: false,
      studentSigned: false,
      physicalCleared: false,
    });
  });

  it('marks a Seeded Signup', () => {
    expect(buildOutreachEntry(doneRow({ [SIGNUPS_COLUMNS.SEEDED_AT]: '2026-09-07T13:00:00Z' }), cleared, BASE).seeded).toBe(true);
  });
});

describe('buildOutreachEntry: recipients', () => {
  it('puts both caretakers on To, trimmed, lowercased, deduplicated, and the student on Cc', () => {
    const entry = buildOutreachEntry(
      doneRow({
        [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: ' Ct1@Example.com ',
        [SIGNUPS_COLUMNS.CARETAKER_2_EMAIL]: 'ct1@example.com',
        [SIGNUPS_COLUMNS.STUDENT_PERSONAL_EMAIL]: 'Player@Example.com',
      }),
      cleared,
      BASE
    );
    expect(entry.to).toEqual(['ct1@example.com']);
    expect(entry.cc).toEqual(['player@example.com']);
  });

  it('drops an invalid address with a warning naming the column, and never uses the SPS email', () => {
    const entry = buildOutreachEntry(
      doneRow({
        [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: 'ct1@example.com',
        [SIGNUPS_COLUMNS.CARETAKER_2_EMAIL]: 'not an email',
        [SIGNUPS_COLUMNS.STUDENT_SPS_EMAIL]: 'student@seattleschools.org',
      }),
      cleared,
      BASE
    );
    expect(entry.to).toEqual(['ct1@example.com']);
    expect(entry.cc).toEqual([]);
    expect(entry.warnings).toEqual(['Caretaker 2 Email is not a valid address: "not an email"']);
  });
});


const entryFor = (playerId: string, first: string, last: string, extra = {}, ff: OutreachFinalFormsStatus | null = cleared) =>
  buildOutreachEntry(doneRow({ [SIGNUPS_COLUMNS.PLAYER_ID]: playerId, [SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]: first, [SIGNUPS_COLUMNS.LAST_NAME]: last, ...extra }), ff, BASE);

const complete = entryFor('p-done', 'Done', 'Zed');
const missingPhoto = entryFor('p-photo', 'Bee', 'Alpha', { [SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]: '' });
const missingForms = entryFor('p-forms', 'Ay', 'Alpha', {}, null);
const noEmail = entryFor('p-noemail', 'Cee', 'Beta', { [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: '', [SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]: '' });
const badEmail = entryFor('p-bademail', 'Dee', 'Beta', { [SIGNUPS_COLUMNS.CARETAKER_1_EMAIL]: 'nope', [SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]: '' });
const twinA = entryFor('p-twin-a', 'Same', 'Twin', { [SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]: '' });
const twinB = entryFor('p-twin-b', 'Same', 'Twin', { [SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID]: '' });
const all = [complete, missingPhoto, missingForms, noEmail, badEmail];

describe('unreachableReason', () => {
  it('needs at least one valid caretaker address, and says why when there is none', () => {
    expect(complete.unreachableReason).toBeNull();
    expect(noEmail.unreachableReason).toBe('no caretaker email');
    expect(badEmail.unreachableReason).toBe('caretaker emails invalid');
  });
});

describe('selectAudience', () => {
  it('with no selection picks every reachable entry not Checklist Complete', () => {
    const result = selectAudience(all);
    expect(result.selected.map(e => e.playerId)).toEqual(['p-photo', 'p-forms']);
    expect(result.skipped).toEqual([]);
  });

  it('narrows to a list of PlayerIDs or Full Names, skipping Checklist Complete entries with a note', () => {
    const result = selectAudience(all, ['p-forms', 'Bee Alpha', 'Done Zed']);
    expect(result.selected.map(e => e.playerId)).toEqual(['p-forms', 'p-photo']);
    expect(result.skipped).toEqual([{ line: 'Done Zed', playerId: 'p-done', reason: 'already Checklist Complete' }]);
  });

  it('stops on a line that matches nothing', () => {
    expect(() => selectAudience(all, ['Nobody Here'])).toThrow('No signup matches "Nobody Here"');
  });

  it('stops on a Full Name shared by more than one row', () => {
    expect(() => selectAudience([...all, twinA, twinB], ['Same Twin'])).toThrow('"Same Twin" matches 2 signups (p-twin-a, p-twin-b); use the PlayerID');
  });

  it('reports an explicitly named unreachable player as skipped, with the reason', () => {
    const result = selectAudience(all, ['p-noemail', 'p-bademail', '# a comment', '']);
    expect(result.selected).toEqual([]);
    expect(result.skipped).toEqual([
      { line: 'p-noemail', playerId: 'p-noemail', reason: 'no caretaker email' },
      { line: 'p-bademail', playerId: 'p-bademail', reason: 'caretaker emails invalid' },
    ]);
  });
});

describe('sortForDisplay', () => {
  it('puts not Checklist Complete first, then last name, then preferred name', () => {
    expect(sortForDisplay([complete, missingPhoto, noEmail, missingForms]).map(e => e.playerId)).toEqual([
      'p-forms',
      'p-photo',
      'p-noemail',
      'p-done',
    ]);
  });
});
