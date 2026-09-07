// Basic Auth gate for /admin and /api/admin (ADR 0006). One shared secret in ADMIN_SECRET; the
// username is ignored. Kept out of proxy.ts so it can be unit-tested with a plain NextRequest.

import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const ADMIN_REALM = 'Madison Ultimate admin';

function secretsMatch(candidate: string, secret: string): boolean {
  const a = Buffer.from(candidate, 'utf8');
  const b = Buffer.from(secret, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function passwordFromBasicHeader(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Basic\s+(.+)$/i);
  if (!match) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(match[1].trim(), 'base64').toString('utf8');
  } catch {
    return null;
  }
  const colon = decoded.indexOf(':');
  return colon === -1 ? decoded : decoded.slice(colon + 1);
}

/**
 * Returns a response that ends the request (401 or 503) when the caller is not allowed in, or
 * null to let the request through. Fails closed: an unset secret denies everyone rather than
 * leaving the admin routes open on a misconfigured deploy.
 */
export function adminGateResponse(request: NextRequest, secret: string | undefined): NextResponse | null {
  if (!secret) {
    return NextResponse.json(
      { success: false, error: 'ADMIN_SECRET is not configured; admin routes are disabled.' },
      { status: 503 }
    );
  }

  const password = passwordFromBasicHeader(request.headers.get('authorization'));
  if (password !== null && secretsMatch(password, secret)) return null;

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': `Basic realm="${ADMIN_REALM}", charset="UTF-8"` },
  });
}
