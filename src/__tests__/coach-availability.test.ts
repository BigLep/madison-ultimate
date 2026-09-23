import { describe, it, expect } from 'vitest';
import { coachAvailabilityHeaders, buildCoachEvents, readCoachAvailability } from '../lib/coach-availability';
import type { PracticeInfoRow, GameInfoRow } from '../lib/schedule-info';

function practice(date: string, note = ''): PracticeInfoRow {
  return { date, fieldName: 'Track', fieldLocation: '', startTime: '3:55 PM', endTime: '5:30 PM', note };
}

function game(date: string, team: string, ordinalForDate = 1, label = 'Game 1'): GameInfoRow & { ordinalForDate: number } {
  return {
    date, label, team, ordinalForDate,
    warmupTime: '1:15 PM', gameStart: '2:00 PM', doneBy: '3:45 PM',
    fieldName: 'Field', fieldLocation: 'East', gameNote: '', opponent: 'Opponent',
  };
}

describe('coachAvailabilityHeaders', () => {
  // Must match madison-ultimate-admin coach-sheet-apps-script/CoachAvailability.gs exactly.
  it('names a practice pair', () => {
    expect(coachAvailabilityHeaders({ kind: 'practice', date: '9/23' })).toEqual({
      availabilityHeader: '9/23 Practice',
      noteHeader: '9/23 Practice Note',
    });
  });

  it('names a team game pair', () => {
    expect(coachAvailabilityHeaders({ kind: 'game', date: '9/26', team: 'Blue', ordinalForDate: 1 })).toEqual({
      availabilityHeader: '9/26 Blue Game',
      noteHeader: '9/26 Blue Game Note',
    });
  });

  it('names an all-teams game and a second game for the same team', () => {
    expect(coachAvailabilityHeaders({ kind: 'game', date: '10/17', team: '' }).availabilityHeader).toBe('10/17 Game');
    expect(coachAvailabilityHeaders({ kind: 'game', date: '9/26', team: 'Blue', ordinalForDate: 2 }).noteHeader).toBe('9/26 Blue Game 2 Note');
  });
});

describe('buildCoachEvents', () => {
  it('merges practices and games in date order, practices first on a shared date, games in sheet order', () => {
    const events = buildCoachEvents(
      [practice('9/29'), practice('9/26'), practice('9/22')],
      [game('9/26', 'Blue'), game('9/26', 'Gold'), game('10/17', '')],
    );
    expect(events.map(e => e.availabilityHeader)).toEqual([
      '9/22 Practice',
      '9/26 Practice',
      '9/26 Blue Game',
      '9/26 Gold Game',
      '9/29 Practice',
      '10/17 Game',
    ]);
  });

  it('keeps the schedule details each event needs for display', () => {
    const [p, g] = buildCoachEvents([practice('9/22', 'Cancelled')], [game('9/26', 'Blue')]);
    expect(p).toMatchObject({ kind: 'practice', date: '9/22', isCancelled: true, noteHeader: '9/22 Practice Note' });
    expect(g).toMatchObject({ kind: 'game', date: '9/26', team: 'Blue', label: 'Game 1', opponent: 'Opponent' });
  });
});

describe('readCoachAvailability', () => {
  const events = buildCoachEvents([practice('9/22')], [game('9/26', 'Blue'), game('10/17', '')]);
  const header = ['CoachID', 'Name', '9/22 Practice', '9/22 Practice Note', '9/26 Blue Game', '9/26 Blue Game Note'];
  const row = ['c0ach', 'TestFirst TestLast', '👍 Planning to be there', 'late', "👎 Can't make it"];

  it('reads each event that has a column pair, and drops events the sheet has no column for yet', () => {
    expect(readCoachAvailability(events, header, row)).toEqual([
      { event: events[0], availability: '👍 Planning to be there', note: 'late', availabilityColumn: 2, noteColumn: 3 },
      { event: events[1], availability: "👎 Can't make it", note: '', availabilityColumn: 4, noteColumn: 5 },
    ]);
  });
});
