// Request gate (this Next.js version's name for middleware): cookie-based password gates on the
// admin and coach surfaces (ADR 0008). See src/lib/password-gate.ts and src/lib/gate-areas.ts.
// /api/diagnostics stays outside the matcher on purpose: it is read-only and is how a
// misconfigured secret gets noticed.

import { NextRequest, NextResponse } from 'next/server';
import { gateResponse } from './lib/password-gate';
import { ADMIN_GATE_AREA, COACH_GATE_AREA } from './lib/gate-areas';

// The login page and the login API route it submits to must stay reachable without a cookie,
// or nobody could ever get one.
const UNGATED_PATHS = new Set([
  ADMIN_GATE_AREA.loginPath,
  COACH_GATE_AREA.loginPath,
  '/api/admin/login',
  '/api/coach/login',
  // Coach Logout must work even with a stale cookie, or a coach could get stuck logged in.
  '/api/coach/logout',
]);

/** True for `base` itself and anything under `base/`, but not `base` + more letters (/coaches). */
function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(base + '/');
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (UNGATED_PATHS.has(pathname)) return NextResponse.next();

  if (isUnder(pathname, '/admin') || isUnder(pathname, '/api/admin')) {
    return gateResponse(request, ADMIN_GATE_AREA, process.env.ADMIN_SECRET) ?? NextResponse.next();
  }
  if (isUnder(pathname, '/coach') || isUnder(pathname, '/api/coach')) {
    return gateResponse(request, COACH_GATE_AREA, process.env.COACH_TOOLS_PASSWORD) ?? NextResponse.next();
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/coach/:path*', '/api/coach/:path*'],
};
