import { NextRequest } from 'next/server';

/**
 * Best-effort client IP for a request, for forwarding to third-party APIs
 * (e.g. Buttondown's `ip_address` on subscriber create) so they see the real
 * visitor rather than our server's shared IP. `x-forwarded-for` may hold a
 * chain of proxy hops; the client's own address is the first entry.
 */
export function getClientIp(request: NextRequest): string | undefined {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const first = forwardedFor?.split(',')[0]?.trim();
  if (first) return first;

  const realIp = request.headers.get('x-real-ip')?.trim();
  return realIp || undefined;
}
