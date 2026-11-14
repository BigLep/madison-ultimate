// Where a password-gate login page sends the browser after a successful login (ADR 0008).
// The gate passes the requested path and query as ?next=; the browser keeps the original
// #fragment on the login page's own URL across the redirect (it is never sent to the server), so
// it is re-attached here. Only same-site paths are accepted, so ?next= can't send anyone off-site.

export function loginDestination(next: string | null, fragment: string, defaultNext: string): string {
  const safe = next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : defaultNext;
  if (safe.includes('#') || !fragment || fragment === '#') return safe;
  return safe + (fragment.startsWith('#') ? fragment : `#${fragment}`);
}
