// Shared cookie-based password gate for /admin and /coach (ADR 0008). Each area has its own
// secret and cookie, but both are checked and issued the same way: a login page posts a
// password, and on match a cookie holding that password is set. The gate itself just compares
// the cookie's value against the area's secret on every request; there is no server-side
// session store. Kept out of proxy.ts so it can be unit-tested with a plain NextRequest.

import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

/** ~90 days: long enough that a coach or admin isn't re-prompted mid-season. */
export const GATE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

export interface GateArea {
  /** Human-readable name for messages, e.g. "admin" or "coach". */
  name: string;
  cookieName: string;
  /** Page path the browser is sent to when the gate check fails, e.g. "/admin/login". */
  loginPath: string;
  /** Env var name holding the shared secret, e.g. "ADMIN_SECRET". Named only for messages. */
  secretEnvVar: string;
}

function secretsMatch(candidate: string, secret: string): boolean {
  const a = Buffer.from(candidate, 'utf8');
  const b = Buffer.from(secret, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isValidPassword(candidate: string, secret: string): boolean {
  return candidate.length > 0 && secretsMatch(candidate, secret);
}

/**
 * Returns a response that ends the request (a redirect to the login page for a page request, or
 * a 401/503 JSON body for an API request) when the caller's gate cookie doesn't match, or null
 * to let the request through. Fails closed: an unset secret denies everyone rather than leaving
 * the area open on a misconfigured deploy.
 */
export function gateResponse(request: NextRequest, area: GateArea, secret: string | undefined): NextResponse | null {
  const isApiRequest = request.nextUrl.pathname.startsWith('/api/');

  if (!secret) {
    const message = `${area.secretEnvVar} is not configured; ${area.name} routes are disabled.`;
    return isApiRequest
      ? NextResponse.json({ success: false, error: message }, { status: 503 })
      : new NextResponse(message, { status: 503 });
  }

  const cookieValue = request.cookies.get(area.cookieName)?.value;
  if (cookieValue && isValidPassword(cookieValue, secret)) return null;

  if (isApiRequest) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const loginUrl = new URL(area.loginPath, request.url);
  loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

/** Sets the gate cookie on a response after a successful login POST. */
export function setGateCookie(response: NextResponse, area: GateArea, password: string): void {
  response.cookies.set(area.cookieName, password, gateCookieOptions(GATE_COOKIE_MAX_AGE_SECONDS));
}

/** Expires the gate cookie (Coach Logout). */
export function clearGateCookie(response: NextResponse, area: GateArea): void {
  response.cookies.set(area.cookieName, '', gateCookieOptions(0));
}

function gateCookieOptions(maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge, path: '/' };
}
