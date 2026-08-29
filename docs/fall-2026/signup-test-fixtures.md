# Signup test fixtures: magic last names

Status: in place since Milestone B (2026-08-27).

To exercise every Final Forms dashboard state without waiting on a real family's registration or touching the real export, the join step (`src/lib/final-forms.ts`) checks a small table of reserved last names before it looks at the real Final Forms CSV: `src/lib/final-forms-test-fixtures.ts`.

## How to use it

Go to `/signup` and enter any preferred first name and any birthdate, with one of these as the **last name** (case/spacing-insensitive):

| Last name | Final Forms dashboard state |
|---|---|
| `TestNotFound` | Not found (C5 guidance copy) |
| `TestNoneSigned` | Found; nothing signed, not cleared |
| `TestParentSigned` | Found; caretaker signed only |
| `TestAllSigned` | Found; caretaker + student signed, not yet cleared |
| `TestCleared` | Found; fully signed and physical cleared (expiration 2027-06-01) |

This creates a real row in the "2026 Fall Signups" spreadsheet, exactly like any other signup (safe to delete afterward, or leave in place and re-visit the same `/player/$playerId` URL to re-test). Only the Final Forms *join* is faked; everything else in the flow is real: profile save, Buttondown subscribe, photo upload, the mailing list row, etc. Each fixture also carries fake seeded fields (grade 7, fake parent/student names/emails/phones) so the "use it or enter something different" hints on the profile form can be exercised too.

`spsStudentId` is never written back to the signup row for these fixture matches, so re-visiting a test player's dashboard always re-evaluates the fixture rather than getting stuck on a stale join.

Join logic for these names (and the live-export path: twins, `spsStudentId` handoff, copy-once seeding) is covered by Vitest in `src/__tests__/final-forms.test.ts` and `src/__tests__/signup-finalforms-route.test.ts`. Use the table above for dashboard copy and layout, not for asserting the join itself. See `docs/TEST_DESIGN.md`.

## Adding a new fixture

Add an entry to `FIXTURES_BY_NORMALIZED_LAST_NAME` in `src/lib/final-forms-test-fixtures.ts`, keyed by the normalized (lowercase, no spaces) last name. A `null` value means "not found"; anything else is a `FinalFormsRecord` to return. If it is a new join/dashboard state, also add a case in `src/__tests__/final-forms.test.ts` so layer 1 stays in sync with the table above.

## Why last name and not something else

Player Lookup (step 0) and the Final Forms join are separate mechanisms: the last name typed at signup always creates/finds a normal row via the Signups sheet, and is *then* looked up against this fixture table only when the dashboard asks for Final Forms status. That keeps the fixture mechanism orthogonal to the real identity model in `docs/adr/0001-player-identity-model.md` — no special-casing needed anywhere else in the app.
