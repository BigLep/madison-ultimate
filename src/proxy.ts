// Request gate (this Next.js version's name for middleware): Basic Auth on the admin surface only.
// See src/lib/admin-auth.ts and ADR 0006. /api/diagnostics stays outside the matcher on purpose:
// it is read-only and is how a misconfigured ADMIN_SECRET gets noticed.

import { NextRequest, NextResponse } from 'next/server';
import { adminGateResponse } from './lib/admin-auth';

export function proxy(request: NextRequest) {
  return adminGateResponse(request, process.env.ADMIN_SECRET) ?? NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
