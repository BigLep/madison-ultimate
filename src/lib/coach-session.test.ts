// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getRememberedCoachId, rememberCoach, forgetCoach } from './coach-session';

beforeEach(() => {
  window.localStorage.clear();
});

describe('remembered coach', () => {
  it('is empty until a coach logs in', () => {
    expect(getRememberedCoachId()).toBeNull();
  });

  it('remembers the chosen CoachID and forgets it on logout', () => {
    rememberCoach('c0001');
    expect(getRememberedCoachId()).toBe('c0001');
    forgetCoach();
    expect(getRememberedCoachId()).toBeNull();
  });
});
