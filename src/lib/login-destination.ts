// Where a password-gate login page sends the browser after a successful login (ADR 0008).
// The gate passes the requested path and query as ?next=; the browser keeps the original
// #fragment on the login page's own URL across the redirect (it is never sent to the server), so
// it is re-attached here. ?next= is resolved the way the browser will resolve it and only a
// same-origin result is followed, so it can never send anyone off-site (a string prefix check is
// not enough: "/\t/example.com" becomes "//example.com" once the tab is stripped).

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function loginDestination(next: string | null, fragment: string, defaultNext: string, origin: string): string {
  let target = defaultNext;
  if (next && next.startsWith('/') && !CONTROL_CHARS.test(next)) {
    try {
      const url = new URL(next, origin);
      if (url.origin === origin) target = url.pathname + url.search + url.hash;
    } catch {
      // unparseable: use the default
    }
  }
  if (target.includes('#') || !fragment || fragment === '#') return target;
  return target + (fragment.startsWith('#') ? fragment : `#${fragment}`);
}
