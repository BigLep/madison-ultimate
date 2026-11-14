import { describe, it, expect } from 'vitest';
import { loginDestination } from '@/lib/login-destination';

const ORIGIN = 'https://portal.example.org';
const go = (next: string | null, fragment = '') => loginDestination(next, fragment, '/jerseys', ORIGIN);

describe('loginDestination', () => {
  it('returns to the requested path and query, re-attaching the bookmarked #fragment', () => {
    expect(go('/jerseys?team=Blue', '#players/p001')).toBe('/jerseys?team=Blue#players/p001');
    expect(loginDestination('/coach', '', '/coach', ORIGIN)).toBe('/coach');
  });

  it('falls back to the default for a missing or off-site next', () => {
    expect(go(null)).toBe('/jerseys');
    expect(go('https://example.com/x')).toBe('/jerseys');
    expect(go('//example.com/x')).toBe('/jerseys');
    expect(go('/\\example.com')).toBe('/jerseys');
    expect(go('/\\/example.com')).toBe('/jerseys');
  });

  it('rejects control characters that browsers strip into "//" (tab, LF, CR)', () => {
    for (const ch of ['\t', '\n', '\r']) {
      expect(go(`/${ch}/example.com`)).toBe('/jerseys');
    }
  });

  it('rejects paths that normalize to "//host" (literal and encoded dot segments)', () => {
    for (const next of ['/.//example.com', '/safe/..//example.com', '/%2e//example.com', '/%2E%2E//example.com']) {
      expect(go(next)).toBe('/jerseys');
    }
    expect(go('/jerseys/../coach')).toBe('/coach');
  });
});
