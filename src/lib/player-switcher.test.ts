// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getRememberedPlayers, rememberPlayer, forgetPlayer } from './player-switcher';

const STORAGE_KEY = 'mu_signup_players';

beforeEach(() => {
  window.localStorage.clear();
});

describe('getRememberedPlayers', () => {
  it('returns an empty array when nothing is stored', () => {
    expect(getRememberedPlayers()).toEqual([]);
  });

  it('returns an empty array for malformed JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    expect(getRememberedPlayers()).toEqual([]);
  });

  it('returns an empty array when the stored value is not an array', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ playerId: 'p1', displayName: 'One' }));
    expect(getRememberedPlayers()).toEqual([]);
  });
});

describe('rememberPlayer', () => {
  it('adds a new player to the front of the list', () => {
    rememberPlayer({ playerId: 'p1', displayName: 'TestFirst One' });
    rememberPlayer({ playerId: 'p2', displayName: 'TestFirst Two' });

    expect(getRememberedPlayers()).toEqual([
      { playerId: 'p2', displayName: 'TestFirst Two' },
      { playerId: 'p1', displayName: 'TestFirst One' },
    ]);
  });

  it('dedups by playerId and moves the re-added player to the front (MRU)', () => {
    rememberPlayer({ playerId: 'p1', displayName: 'TestFirst One' });
    rememberPlayer({ playerId: 'p2', displayName: 'TestFirst Two' });
    rememberPlayer({ playerId: 'p1', displayName: 'TestFirst One' });

    const players = getRememberedPlayers();
    expect(players).toHaveLength(2);
    expect(players[0]).toEqual({ playerId: 'p1', displayName: 'TestFirst One' });
    expect(players[1]).toEqual({ playerId: 'p2', displayName: 'TestFirst Two' });
  });

  it('updates the stored display name when re-adding an existing playerId', () => {
    rememberPlayer({ playerId: 'p1', displayName: 'Old Name' });
    rememberPlayer({ playerId: 'p1', displayName: 'New Name' });

    expect(getRememberedPlayers()).toEqual([{ playerId: 'p1', displayName: 'New Name' }]);
  });

  it('does not throw when localStorage is unavailable', () => {
    const original = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new Error('quota exceeded');
    };

    expect(() => rememberPlayer({ playerId: 'p1', displayName: 'TestFirst One' })).not.toThrow();

    window.localStorage.setItem = original;
  });
});

describe('forgetPlayer', () => {
  it('removes only the target player', () => {
    rememberPlayer({ playerId: 'p1', displayName: 'TestFirst One' });
    rememberPlayer({ playerId: 'p2', displayName: 'TestFirst Two' });

    forgetPlayer('p1');

    expect(getRememberedPlayers()).toEqual([{ playerId: 'p2', displayName: 'TestFirst Two' }]);
  });

  it('is a no-op when the playerId is not present', () => {
    rememberPlayer({ playerId: 'p1', displayName: 'TestFirst One' });

    forgetPlayer('unknown');

    expect(getRememberedPlayers()).toEqual([{ playerId: 'p1', displayName: 'TestFirst One' }]);
  });

  it('does not throw when localStorage is unavailable', () => {
    const original = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new Error('quota exceeded');
    };

    expect(() => forgetPlayer('p1')).not.toThrow();

    window.localStorage.setItem = original;
  });
});
