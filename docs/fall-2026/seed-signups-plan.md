# Seed Signups from Final Forms: implementation plan

Decision record: `seed-signups-grill.md` (three rounds, 2026-09-07). Architecture: `../adr/0006-seed-signups-from-final-forms.md`, which also amends ADRs 0004 and 0005. Glossary: `../../CONTEXT.md` (Seeded Signup, Seed Signups from Final Forms, Profile Complete). Status: built 2026-09-07 (portal code, tests, coach sheet script edits); rollout steps 2 to 7 below still to run.

## 1. What gets built

One admin page at `/admin/final-forms` with Preview and Apply. Apply runs Final Forms Backfill over every unjoined signup row, then creates a Seeded Signup for every Final Forms student still unmatched, then recomputes Profile Complete for every row. Preview computes the same plan and writes nothing. The page also shows a copyable BCC list of caretaker emails for seeded rows that are not yet Profile Complete. The old Backfill page and route are deleted. `/admin` and `/api/admin` get Basic Auth. The family's player page shows a banner on a seeded row until it is Profile Complete. The coach sheet passes Profile Complete through, defaults Include In Generated Rosters to TRUE, and reports seeded rows not yet complete.

## 2. Signups sheet changes (do first, by hand)

Two new header columns, appended at the end of the `Signups` tab on both the live sheet (`SIGNUPS_SHEET_ID`) and the test sheet (`SIGNUPS_SHEET_ID_TEST`). Done 2026-09-07 with `gog sheets update` (columns AJ and AK on both):

- `Seeded At`: ISO timestamp, empty for family-created rows.
- `Profile Complete`: the text `TRUE` or `FALSE`, written by the portal.

Why by hand and first: `createSignupRow` builds the appended row from the live header row, so a column absent from the header is silently dropped. Sheet writes use `valueInputOption: 'RAW'`, so the portal's `TRUE` arrives in the coach sheet as text, not a boolean; the coach sheet formula coerces it (section 9).

Add both names to `SIGNUPS_COLUMNS` in `src/lib/signups-config.ts` (`SEEDED_AT`, `PROFILE_COMPLETE`). Add a diagnostics check that the live Signups header row contains every `SIGNUPS_COLUMNS` value, so a missing header fails visibly instead of dropping data.

## 3. Profile Complete

- `isProfileComplete(record)` in `src/lib/signup-checklist.ts`: `isPlayerInfoComplete && isCaretakerInfoComplete && isPhotoComplete`. Nothing else, and no other definition anywhere.
- Written by the sheet layer, not by each route: `createSignupRow` and `updateSignupRow` in `src/lib/signups-sheet.ts` compute it from the merged record and always write the column. Every existing write site (lookup create, profile save, photo upload, first-join side effects) gets it without change.
- Existing rows get a value the first time the seed run's recompute pass touches them (section 5).

## 4. Updated At rule

Updated At changes only when a family makes a change or a seed or join does meaningful work on the row. Add an options argument to `updateSignupRow` (`{ touchUpdatedAt?: boolean }`, default true). The Profile Complete recompute pass is the only caller passing false, and it writes only when the stored value differs. A seeded row is created with Created At, Updated At, and Seeded At equal, and the seed's second write (the first-join write) also passes false so all three stay equal on the sheet.

## 5. Reconciliation logic (`src/lib/final-forms.ts`)

Two functions, one pure and one that writes, so the plan can be unit-tested exhaustively and Preview is the pure half.

`planFinalFormsReconciliation(signups, snapshot)` groups both sides by normalized last name plus normalized birthdate and returns, per Final Forms record or signup row, one of:

- `skip`: the record's student ID is already on a signup row (compares by ID, before any name matching).
- `join`: one record, exactly one unjoined signup in the group (the Backfill case). With twins, a signup joins only when its legal first name (falling back to preferred, as `matchByNameAndDob` already does) picks exactly one record, and every signup in the group resolves to a distinct record.
- `seed`: a record with no unjoined signup in its group, or a leftover record in a fully resolved twin group.
- `ambiguous`: a twin group where any signup cannot be resolved; nothing in the group is joined or seeded.
- `duplicate-signups`: one record, two or more unjoined signups; nothing is done.
- `discrepancy`: a record whose group contains a row already joined to a different SPS Student ID; not seeded. (Rows already joined are also re-checked exactly as `backfillFinalFormsJoin` does today, producing the existing `already-joined-discrepancy`.)
- `unseedable`: a record missing last name, birthdate, or SPS Student ID.
- `unmatched-signup`: an unjoined signup no record shares a group with, carrying same-last-name Possible Matches. Not a Final Forms outcome, but it keeps the old Backfill's "still unmatched" list and Possible Match surfacing alive.

A `discrepancy` blocks the whole group, joins included, not only seeding: a human has to look before anything is written there. A `discrepancy` is reported even when every record in the group is already claimed by ID, which is the old `already-joined-discrepancy`.

`applyFinalFormsReconciliation(plan)`:

- `join` entries call `applyFirstJoinSideEffects` unchanged.
- `seed` entries call `seedSignupFromFinalForms(record)`: `createSignupRow` with Preferred First Name, Last Name, Date of Birth (normalized to `YYYY-MM-DD`, the shape the sheet stores) from the record, Legal First Name blank, and Seeded At; then `applyFirstJoinSideEffects(playerId, created, match)` on the fresh row. Two writes, zero new join code: the second write is the existing first-join write (SPS Student ID, Seeded Fields, Photo Carryover, auto-subscribe) applied to a row whose cells are all empty. Magic-name fixtures do not apply; the export has no fixture rows.
- Then the recompute pass: for every row, compute Profile Complete and write it without touching Updated At if it differs.
- A missing export (`no-snapshot`) stops the run before any write, as the Backfill route does today.

Seeding ignores `isNewSignupClosed`; it is an admin action.
- Added 2026-09-09: when every Final Forms record in a last-name-plus-birthdate group is already joined by ID and an unjoined signup still shares the group's key (a family row created after the seed, or a birthdate corrected after it), the plan reports a `duplicate-signups` entry carrying `joinedPlayerId`, instead of dropping the row silently as it did before. The admin page tells the coach to keep one row, copy SPS Student ID, Grade, and Photo Drive File ID onto it, delete the other, and run again; the Possible Match instruction now says to fix the birthdate and Preview again before Apply, since Apply first seeds a second row.

## 6. Admin route and page

- `src/app/api/admin/final-forms/route.ts`: `GET` returns the preview (the plan, bucketed for display), the Buttondown blocked-subscriber count, and the outreach list; `POST` applies and returns the report. Report sections: seeded, joined, ambiguous, discrepancies, duplicate signups, unseedable, no-snapshot, recomputed count. Each entry carries PlayerID or SPS Student ID plus the display name, as the Backfill report does today.
- Outreach list: rows with Seeded At set and Profile Complete not `TRUE`; Caretaker 1 and Caretaker 2 emails, lowercased, deduplicated, comma-joined. Available from `GET` so it needs no Apply.
- `src/app/admin/final-forms/page.tsx`: Preview runs on load and on a button; Apply is a second button, disabled while running, that shows the report. A third button, Sync Final Forms, calls the existing `/api/signup/finalforms-refresh` route (the same workflow dispatch the player page uses, single-flight guarded) so a fresh export can be pulled before a run. Keep the blocked-subscriber warning box. The outreach list sits in a read-only textarea with a Copy button.
- Delete `src/app/admin/finalforms-backfill/`, `src/app/api/admin/finalforms-backfill/`, and `src/__tests__/admin-finalforms-backfill-route.test.ts`. No redirect.

## 7. Admin gate

- `src/proxy.ts` (this Next.js version's name for middleware) with `matcher: ['/admin/:path*', '/api/admin/:path*']`. Parse the `Authorization: Basic` header, ignore the username, compare the password to `ADMIN_SECRET` with a constant-time comparison. On mismatch or absence respond 401 with `WWW-Authenticate: Basic realm="Madison Ultimate admin"`. If `ADMIN_SECRET` is unset, respond 503 naming the missing variable: fail closed.
- `/api/diagnostics` stays outside the matcher. Add `ADMIN_SECRET` to its required-environment list.
- Set the secret in `.env.local` and as a Vercel Sensitive environment variable. Document in `DESIGN.md` under Environment Configuration.

## 8. Family-facing banner

On `/player/[playerId]`, above the dashboard, when Seeded At is set and Profile Complete is not `TRUE`. Copy (adopted 2026-09-07; Steve reviews it in the built UI later): "We started this signup from your player's SPS Final Forms registration. The first name shown is the legal one from Final Forms; change it to the name your player goes by, then check the rest of the details and finish the signup." Styled like the existing deadline banner. Disappears on its own once the family finishes.

The outreach email itself is Steve's to write. It links to `/signup`, asks families to enter the player's last name and birthdate exactly as in Final Forms (and the legal first name if asked), and asks them to finish before the first practice.

## 9. Coach sheet work package (in `madison-ultimate-admin/coach-sheet-apps-script`)

- `Code.gs`: add `seededAt: 'Seeded At'` and `profileComplete: 'Profile Complete'` to `SIGNUPS_HEADERS` (Diagnostics then checks the mirror has them). `ROSTER_COLUMNS` `Profile Complete?` becomes source Signups: `UPPER(TO_TEXT(lookupSignups('profileComplete')))="TRUE"`, note "Defined and written by the portal". `Include In Generated Rosters` formula becomes `LET(e, lookupExtra('include'), IF(e="", TRUE, e))`, note "Extra Player Info value when one is set, else TRUE". `showStatistics` is unchanged.
- `AnalyzeSignups.gs`: section 2 retitled "Final Forms students not yet seeded or joined" (same logic); section 5 reads the `Profile Complete` column instead of computing its own and lists PlayerID, Full Name, and whether the row is a Seeded Signup or family-created; new section 6 "Seeded Signups not Profile Complete" (Seeded At non-empty and Profile Complete not TRUE), columns PlayerID, Full Name, Seeded At.
- `CONTEXT.md` (coach sheet): Profile Complete becomes "defined and written by the portal; see the portal glossary"; Include In Generated Rosters becomes "the coach's Extra Player Info value when one is set, otherwise TRUE"; Analyze Signups lists the new section; add Seeded Signup and Profile Complete to the shared-terms sentence at the top. `ExtraPlayerInfo.gs` header note: blank Include now means "included".
- A short coach-sheet ADR 0002 recording that Include In Generated Rosters defaults to TRUE and Profile Complete is portal-owned (reversal of the Profile Complete formula in ADR 0001's plan).
- README Menu Functions and Roster sections; version bump; push with clasp; run Diagnostics, Generate Fresh Roster, Analyze Signups.

## 10. Tests (`docs/TEST_DESIGN.md` conventions, fake data only)

- `planFinalFormsReconciliation`: one case per outcome, including twins both new, twins with one resolvable signup, twins ambiguous, duplicate signups, discrepancy against a joined row, unseedable record, already-joined skip by ID before any name match.
- `seedSignupFromFinalForms`: row shape (Preferred equals legal first name, Legal blank, normalized birthdate, Seeded At equals Created At equals Updated At), then the first-join write carries SPS Student ID and Seeded Fields.
- `isProfileComplete` and the sheet-layer write on create and update; `touchUpdatedAt: false` leaves Updated At alone.
- Route: `GET` writes nothing; `POST` buckets every outcome; no-snapshot stops before writes; outreach list dedupes and excludes complete rows.
- `proxy.ts` matcher covers `/admin` and `/api/admin` and not `/api/diagnostics` (asserted in `admin-auth.test.ts`).
- `proxy.ts`: 401 without header, 401 with wrong secret, pass-through with the right one, 503 when unset, diagnostics untouched.
- Coach sheet: extend the scratch Node harness described in the roster rebuild decisions log (D9) to assert the two changed formulas.

## 11. Rollout

1. Headers already added to the live and test Signups sheets (section 2, done 2026-09-07). On the live sheet they sit in AI and AJ, before Photo Drive File ID, because the grid could not be extended past its last column with `gog`; everything resolves by header name so the position does not matter.
2. `ADMIN_SECRET` is set in `.env.local` (done 2026-09-07). Set the same value in Vercel as a Sensitive environment variable, deploy, and confirm `/admin/final-forms` prompts and `/api/diagnostics` does not. Local check done 2026-09-07: 401 without the secret, 200 with it, diagnostics open and reporting all 37 headers.
3. Preview on production. Local Preview against live data on 2026-09-07 found 38 to seed, 61 already joined, 0 to join, 0 ambiguous, 0 duplicates, 0 discrepancies, 0 unseedable, and 6 unmatched family signups (Possible Matches shown on the page). Read every ambiguous, duplicate, and discrepancy entry before applying.
4. Apply. Check the Buttondown blocked-subscriber count and unblock anyone who should receive the newsletter.
5. Coach sheet script edits are made in the admin repo (version 3.17, not yet pushed with clasp). Push, then run Diagnostics, Generate Fresh Roster, Analyze Signups; confirm section 6 lists the seeded rows and Include resolves TRUE for them.
6. Copy the BCC list, send the outreach email from Gmail.
7. Re-run Preview and Apply after later nightly exports as needed. Follow up individually with families still listed in section 6 after a few days.

## 12. Deferred

- Templated per-family outreach drafts (select signups, template with variables, generate Gmail drafts, send all with a delay), possibly in `madison-ultimate-admin`. Designed 2026-09-07 as Signup Outreach, in the portal: ADR 0007 and `docs/fall-2026/signup-outreach-plan.md`; the BCC list in section 6 is superseded.
- Seeding Gender Identification from the export's gender column.
- Any scheduled run of seeding.
