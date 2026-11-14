// Login for the /jerseys gate (ADR 0008, ADR 0009). Excluded from the proxy's gate check
// (src/proxy.ts) so it stays reachable without a cookie. The Jersey Manager's name is kept on the
// device by the login page, not here.

import { NextRequest, NextResponse } from 'next/server';
import { isValidPassword, setGateCookie } from '@/lib/password-gate';
import { JERSEY_GATE_AREA } from '@/lib/gate-areas';

export async function POST(request: NextRequest) {
  const secret = process.env.JERSEY_MANAGER_PASSWORD;
  if (!secret) {
    return NextResponse.json({ success: false, error: 'JERSEY_MANAGER_PASSWORD is not configured.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!isValidPassword(password, secret)) {
    return NextResponse.json({ success: false, error: 'Incorrect password' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  setGateCookie(response, JERSEY_GATE_AREA, password);
  return response;
}
