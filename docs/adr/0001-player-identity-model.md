# Player identity: opaque PlayerID, field-matching lookup, spsStudentId handoff

Status: accepted (2026-08-26)

Players need a durable identity across signup, the season portal, and coach tooling, but families have no accounts and identify players by typing name + birthdate, fields they also mistype and later edit. We decided to separate three identifiers with distinct jobs: **PlayerID**, a short random opaque slug minted at row creation, is the permanent identity everything durable hangs off (`/player/$playerId` URLs, coach sheet joins, photo mapping, device-local switcher); **Player Lookup** is field matching, not a stored key (normalized last name + full birthdate must match exactly, normalized preferred name disambiguates twins with as many leading letters as needed); **spsStudentId** is written onto the row at the first successful Final Forms match (or manually by the coach) and is authoritative for all later Final Forms joins.

## Considered options

- **Derive the ID from name + birthdate** (the Fall 2025 portal pattern: first initial + last name + MMYY). Rejected: an ID derived from editable fields breaks bookmarks, joins, and photo mappings the moment a family fixes a typo, which contradicts the settled fix-in-place editing model; it also puts name + birthdate PII in URLs, history, and server logs, and the 2025 scheme silently routed one real twin into the other's portal (`.find()` on a colliding key).
- **Store a derived lookup-key column in the sheet** (2-letter preferred-name prefix + last name + MMDDYY, with per-player key extension for colliding twins). Rejected in favor of matching fields directly in code: no formula column to hand-maintain (the 2025 formula had no written spec and drifted from the app), normalization rules live in exactly one place, and twin collisions resolve with data already stored instead of a bespoke key rule only twins ever see.

## Consequences

Regenerating an ID from player data is impossible by design; the row must be found by lookup or by URL. Editing identity fields changes what a family types at login but never their URL or joins. Normalization (trim, lowercase, strip whitespace and apostrophes, fold accents, keep hyphens) is defined once in webapp code; nothing sheet-side computes keys. The glossary entries live in the repo-root `CONTEXT.md`; the full decision record is in `docs/fall-2026/signup-grill.md` (Q1-Q3, Q15).
