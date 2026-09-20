# Coach Tools and /admin share one cookie-based password gate, not Basic Auth

We're adding Coach Tools (`/coach`), a coach-facing area starting with the Player Directory, gated by a password simple enough to read off a page and type from a phone at practice. ADR 0006 gated `/admin` with HTTP Basic Auth and a single `ADMIN_SECRET`, reversing the no-gate choice in ADR 0005 once admin routes started creating rows and subscribing emails. Basic Auth's native browser prompt is a poor fit for Coach Tools: it can't be styled, can't redirect back to a deep link once entered, and its "session" is really just the browser caching the header, not something the app controls.

We decided to replace Basic Auth everywhere with one shared, custom cookie-based password gate: a dedicated login page per area, a submitted password checked against an env-var secret, and a cookie on success (long-lived, redirecting back to the originally requested page). `/admin` and `/coach` each get their own secret (`ADMIN_SECRET`, `COACH_TOOLS_PASSWORD`) and cookie, sharing the gate mechanism itself; there is no fallback default for either secret, so an unset secret fails closed exactly as it did for `/admin` under Basic Auth. This supersedes ADR 0006's Basic Auth choice for `/admin`, not just Coach Tools.

## Considered Options

- **Basic Auth for `/admin`, a custom gate for `/coach`.** Rejected: two different auth mechanisms in one small app is exactly the kind of thing a future reader would wonder about, for no benefit — `/admin`'s audience (you) has no need for Basic Auth's browser-level caching over a cookie.
- **Keep Basic Auth for both.** Rejected: fails the actual requirement for Coach Tools (a plain password field, not a browser credential prompt), and there was no reason to keep `/admin` on a different mechanism than `/coach` once a real custom gate existed.
