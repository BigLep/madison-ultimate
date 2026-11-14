import { describe, it, expect } from 'vitest';
import { loginDestination } from '@/lib/login-destination';

describe('loginDestination', () => {
  it('returns to the requested path and query, re-attaching the bookmarked #fragment', () => {
    expect(loginDestination('/jerseys?team=Blue', '#players/p001', '/jerseys')).toBe('/jerseys?team=Blue#players/p001');
    expect(loginDestination('/coach', '', '/coach')).toBe('/coach');
  });

  it('falls back to the default for a missing or off-site next', () => {
    expect(loginDestination(null, '', '/jerseys')).toBe('/jerseys');
    expect(loginDestination('https://example.com/x', '', '/jerseys')).toBe('/jerseys');
    expect(loginDestination('//example.com/x', '', '/jerseys')).toBe('/jerseys');
    expect(loginDestination('/\\example.com', '', '/jerseys')).toBe('/jerseys');
  });
});
