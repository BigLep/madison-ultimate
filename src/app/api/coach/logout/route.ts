// Coach Logout (CONTEXT.md): clears the /coach gate cookie. The client also forgets the remembered
// coach. Ungated in src/proxy.ts so it works even when the cookie is already stale.

import { NextResponse } from 'next/server';
import { clearGateCookie } from '../../../../lib/password-gate';
import { COACH_GATE_AREA } from '../../../../lib/gate-areas';

export async function POST() {
  const response = NextResponse.json({ success: true });
  clearGateCookie(response, COACH_GATE_AREA);
  return response;
}
