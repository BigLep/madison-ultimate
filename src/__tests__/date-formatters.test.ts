import { describe, it, expect } from 'vitest';
import { formatLocalTimestamp } from '@/lib/date-formatters';

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
