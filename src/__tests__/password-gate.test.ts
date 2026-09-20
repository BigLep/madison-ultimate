import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { gateResponse, isValidPassword, GateArea } from '@/lib/password-gate';
import { ADMIN_GATE_AREA, COACH_GATE_AREA } from '@/lib/gate-areas';
import { config as proxyConfig } from '@/proxy';

const AREA: GateArea = { name: 'admin', cookieName: 'madison_admin_auth', loginPath: '/admin/login', secretEnvVar: 'ADMIN_SECRET' };

function pageRequest(cookieValue?: string): NextRequest {
  return new NextRequest('http://localhost/admin/final-forms', {
    headers: cookieValue ? { cookie: `${AREA.cookieName}=${cookieValue}` } : {},
  });
}

function apiRequest(cookieValue?: string): NextRequest {
  return new NextRequest('http://localhost/api/admin/final-forms', {
    headers: cookieValue ? { cookie: `${AREA.cookieName}=${cookieValue}` } : {},
  });
}

describe('isValidPassword', () => {
  it('matches only the exact secret', () => {
    expect(isValidPassword('s3cret', 's3cret')).toBe(true);
    expect(isValidPassword('wrong', 's3cret')).toBe(false);
    expect(isValidPassword('', 's3cret')).toBe(false);
  });
});

describe('gateResponse', () => {
  it('fails closed with 503 when the secret is unset (page and API)', async () => {
    const pageRes = gateResponse(pageRequest(), AREA, undefined);
    expect(pageRes?.status).toBe(503);
    expect(await pageRes!.text()).toMatch(/ADMIN_SECRET/);

    const apiRes = gateResponse(apiRequest(), AREA, undefined);
    expect(apiRes?.status).toBe(503);
    expect((await apiRes!.json()).error).toMatch(/ADMIN_SECRET/);
  });

  it('redirects a page request to the login page, preserving the original path', () => {
    const res = gateResponse(pageRequest(), AREA, 's3cret');
    expect(res?.status).toBe(307);
    const location = new URL(res!.headers.get('location')!);
    expect(location.pathname).toBe('/admin/login');
    expect(location.searchParams.get('next')).toBe('/admin/final-forms');
  });

  it('401s an API request with no redirect', () => {
    const res = gateResponse(apiRequest(), AREA, 's3cret');
    expect(res?.status).toBe(401);
  });

  it('rejects a wrong cookie value', () => {
    expect(gateResponse(pageRequest('wrong'), AREA, 's3cret')?.status).toBe(307);
    expect(gateResponse(apiRequest('wrong'), AREA, 's3cret')?.status).toBe(401);
  });

  it('lets the request through with the right cookie value', () => {
    expect(gateResponse(pageRequest('s3cret'), AREA, 's3cret')).toBeNull();
    expect(gateResponse(apiRequest('s3cret'), AREA, 's3cret')).toBeNull();
  });
});

describe('gate areas', () => {
  it('admin and coach use distinct cookies, secrets, and login paths', () => {
    expect(ADMIN_GATE_AREA.cookieName).not.toBe(COACH_GATE_AREA.cookieName);
    expect(ADMIN_GATE_AREA.secretEnvVar).not.toBe(COACH_GATE_AREA.secretEnvVar);
    expect(ADMIN_GATE_AREA.loginPath).not.toBe(COACH_GATE_AREA.loginPath);
  });
});

describe('proxy matcher', () => {
  it('covers the admin and coach pages and APIs, and leaves diagnostics open', () => {
    expect(proxyConfig.matcher).toEqual(['/admin/:path*', '/api/admin/:path*', '/coach/:path*', '/api/coach/:path*']);
    const matches = (path: string) =>
      proxyConfig.matcher.some(pattern => new RegExp('^' + pattern.replace('/:path*', '(/.*)?') + '$').test(path));
    expect(matches('/admin/final-forms')).toBe(true);
    expect(matches('/api/admin/final-forms')).toBe(true);
    expect(matches('/coach/player-directory')).toBe(true);
    expect(matches('/api/coach/players')).toBe(true);
    expect(matches('/api/diagnostics')).toBe(false);
    expect(matches('/player/abc12')).toBe(false);
  });
});
