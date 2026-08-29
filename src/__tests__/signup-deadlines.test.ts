import { describe, it, expect } from 'vitest';
import { getDeadlineState, isNewSignupClosed } from '@/lib/signup-deadlines';

function utcDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00.000Z`);
}

describe('getDeadlineState', () => {
  it('is open on and before September 9', () => {
    expect(getDeadlineState(utcDate('2026-09-08'))).toBe('open');
    expect(getDeadlineState(utcDate('2026-09-09'))).toBe('open');
  });

  it('is late from September 10 through September 18', () => {
    expect(getDeadlineState(utcDate('2026-09-10'))).toBe('late');
    expect(getDeadlineState(utcDate('2026-09-18'))).toBe('late');
  });

  it('is closed after September 18', () => {
    expect(getDeadlineState(utcDate('2026-09-19'))).toBe('closed');
  });
});

describe('isNewSignupClosed', () => {
  it('is true only for the closed state; lookup of existing players stays open', () => {
    expect(isNewSignupClosed('open')).toBe(false);
    expect(isNewSignupClosed('late')).toBe(false);
    expect(isNewSignupClosed('closed')).toBe(true);
  });
});
