import { describe, it, expect } from 'vitest';
import { getDeadlineState, isNewSignupClosed, getSeasonPhase, anotherPlayerLink } from '@/lib/signup-deadlines';

function utcDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00.000Z`);
}

describe('getDeadlineState', () => {
  it('is open on and before September 8', () => {
    expect(getDeadlineState(utcDate('2026-09-07'))).toBe('open');
    expect(getDeadlineState(utcDate('2026-09-08'))).toBe('open');
  });

  it('is late from September 9 through September 13', () => {
    expect(getDeadlineState(utcDate('2026-09-09'))).toBe('late');
    expect(getDeadlineState(utcDate('2026-09-13'))).toBe('late');
  });

  it('is closed from September 14', () => {
    expect(getDeadlineState(utcDate('2026-09-14'))).toBe('closed');
  });
});

describe('isNewSignupClosed', () => {
  it('is true only for the closed state; lookup of existing players stays open', () => {
    expect(isNewSignupClosed('open')).toBe(false);
    expect(isNewSignupClosed('late')).toBe(false);
    expect(isNewSignupClosed('closed')).toBe(true);
  });
});

describe('getSeasonPhase', () => {
  it('is signup season while new signups can still be created, portal season once closed', () => {
    expect(getSeasonPhase(utcDate('2026-09-01'))).toBe('signup');
    expect(getSeasonPhase(utcDate('2026-09-13'))).toBe('signup');
    expect(getSeasonPhase(utcDate('2026-09-14'))).toBe('portal');
  });
});

describe('anotherPlayerLink', () => {
  it('drives to /signup in signup season and to the Portal Login in portal season', () => {
    expect(anotherPlayerLink('signup')).toEqual({ href: '/signup', label: 'Sign up another player' });
    expect(anotherPlayerLink('portal')).toEqual({ href: '/player', label: 'Add another player' });
  });
});
