import { describe, it, expect } from 'vitest';
import { formatLocalTimestamp, formatRelativeHighestUnit } from '@/lib/date-formatters';

describe('formatLocalTimestamp', () => {
  it('formats an ISO timestamp in the given timezone as M/D h:mmpm', () => {
    // 2026-08-28T05:15:11Z is 10:15pm the previous evening in Pacific Daylight Time.
    expect(formatLocalTimestamp('2026-08-28T05:15:11Z', 'America/Los_Angeles')).toBe(
      '8/27 10:15pm'
    );
  });

  it('formats noon and midnight without a leading zero on the hour', () => {
    expect(formatLocalTimestamp('2026-08-28T19:00:00Z', 'America/Los_Angeles')).toBe(
      '8/28 12:00pm'
    );
    expect(formatLocalTimestamp('2026-08-28T07:34:00Z', 'America/Los_Angeles')).toBe(
      '8/28 12:34am'
    );
  });

  it('passes through non-parseable values such as test-fixture labels', () => {
    expect(formatLocalTimestamp('test data')).toBe('test data');
  });

  it('returns empty string for empty input', () => {
    expect(formatLocalTimestamp('')).toBe('');
  });
});

describe('formatRelativeHighestUnit', () => {
  const now = new Date('2026-08-29T18:00:00Z');

  it('uses only the highest unit: days beat hours and minutes', () => {
    expect(formatRelativeHighestUnit('2026-08-27T14:54:55Z', now)).toBe('~2 days ago');
  });

  it('uses hours when under a day', () => {
    expect(formatRelativeHighestUnit('2026-08-29T15:00:00Z', now)).toBe('~3 hours ago');
  });

  it('uses minutes when under an hour', () => {
    expect(formatRelativeHighestUnit('2026-08-29T17:55:00Z', now)).toBe('~5 minutes ago');
  });

  it('singularizes a count of 1', () => {
    expect(formatRelativeHighestUnit('2026-08-28T18:00:00Z', now)).toBe('~1 day ago');
    expect(formatRelativeHighestUnit('2026-08-29T17:00:00Z', now)).toBe('~1 hour ago');
    expect(formatRelativeHighestUnit('2026-08-29T17:59:00Z', now)).toBe('~1 minute ago');
  });

  it('returns just now for under a minute', () => {
    expect(formatRelativeHighestUnit('2026-08-29T17:59:30Z', now)).toBe('just now');
  });

  it('returns empty string for empty or unparseable input', () => {
    expect(formatRelativeHighestUnit('')).toBe('');
    expect(formatRelativeHighestUnit('test data')).toBe('');
  });
});
