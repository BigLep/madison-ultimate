import { describe, it, expect } from 'vitest';
import { assignGameOrdinals, makeGameKey, parseGameKey } from '@/lib/game-schedule';

describe('assignGameOrdinals (player-portal-grill.md Q25)', () => {
  it('counts "(Game 2)" per date and per team, so three teams on one date share the first triple', () => {
    const rows = [
      { date: '9/26', team: 'Blue', label: 'Game 1' },
      { date: '9/26', team: 'Gold', label: 'Game 1' },
      { date: '9/26', team: 'Silver', label: 'Game 1' },
      { date: '9/26', team: 'Blue', label: 'Game 1b' },
      { date: '9/26', team: '', label: 'Scrimmage' },
      { date: '9/26', team: '  blue ', label: 'Game 1c' },
      { date: '10/3', team: 'Blue', label: 'Game 2' },
    ];
    expect(assignGameOrdinals(rows).map(r => r.ordinalForDate)).toEqual([1, 1, 1, 2, 1, 3, 1]);
  });

  it('keeps the rows in sheet order and leaves their fields intact', () => {
    const rows = assignGameOrdinals([{ date: '9/26', team: 'Blue', label: 'Game 1' }]);
    expect(rows[0]).toEqual({ date: '9/26', team: 'Blue', label: 'Game 1', ordinalForDate: 1 });
  });
});

describe('game keys', () => {
  it('round-trips date and label, including labels with separators of their own', () => {
    const key = makeGameKey('9/26', 'Playoff Game 1: Round A');
    expect(parseGameKey(key)).toEqual({ date: '9/26', label: 'Playoff Game 1: Round A' });
  });

  it('rejects malformed keys', () => {
    expect(parseGameKey('')).toBeNull();
    expect(parseGameKey('9/26')).toBeNull();
    expect(parseGameKey('9/26|')).toBeNull();
    expect(parseGameKey('|Game 1')).toBeNull();
  });
});
