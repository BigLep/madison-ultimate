import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { adminGateResponse } from '@/lib/admin-auth';
import { config as proxyConfig } from '@/proxy';

function request(authorization?: string): NextRequest {
  return new NextRequest('http://localhost/admin/final-forms', {
    headers: authorization ? { authorization } : {},
  });
}

const basic = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

describe('adminGateResponse', () => {
  it('fails closed with 503 when ADMIN_SECRET is unset', async () => {
    const res = adminGateResponse(request(basic('admin', 'anything')), undefined);
    expect(res?.status).toBe(503);
    expect((await res!.json()).error).toMatch(/ADMIN_SECRET/);
  });

  it('challenges with 401 and WWW-Authenticate when no header is sent', () => {
    const res = adminGateResponse(request(), 's3cret');
    expect(res?.status).toBe(401);
    expect(res?.headers.get('www-authenticate')).toMatch(/^Basic realm=/);
  });

  it('rejects a wrong password, a malformed header, and a non-Basic scheme', () => {
    expect(adminGateResponse(request(basic('admin', 'wrong')), 's3cret')?.status).toBe(401);
    expect(adminGateResponse(request('Basic not-base64!!'), 's3cret')?.status).toBe(401);
    expect(adminGateResponse(request('Bearer s3cret'), 's3cret')?.status).toBe(401);
  });

  it('lets the request through with the right password, whatever the username', () => {
    expect(adminGateResponse(request(basic('admin', 's3cret')), 's3cret')).toBeNull();
    expect(adminGateResponse(request(basic('', 's3cret')), 's3cret')).toBeNull();
  });
});

describe('proxy matcher', () => {
  it('covers the admin page and API and leaves diagnostics open', () => {
    expect(proxyConfig.matcher).toEqual(['/admin/:path*', '/api/admin/:path*']);
    const matches = (path: string) => proxyConfig.matcher.some(pattern => new RegExp('^' + pattern.replace('/:path*', '(/.*)?') + '$').test(path));
    expect(matches('/admin/final-forms')).toBe(true);
    expect(matches('/api/admin/final-forms')).toBe(true);
    expect(matches('/api/diagnostics')).toBe(false);
    expect(matches('/player/abc12')).toBe(false);
  });
});
