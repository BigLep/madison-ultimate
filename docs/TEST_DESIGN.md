# Test design

This document describes how we test the Madison Ultimate app locally: which framework we use, where we mock, when we reset state, and how to add tests.

## Framework: Vitest

We use **Vitest** for unit tests.

- **Why Vitest**: Fast, good ESM and TypeScript support, and works well with Next.js path aliases (`@/`). No Jest config or transform quirks. Same `describe`/`it`/`expect` style.
- **Config**: [vitest.config.mts](../vitest.config.mts) at repo root. Default `environment: 'node'` (no DOM) for lib/route tests. `include`: `src/**/*.test.ts`, `src/**/*.spec.ts`, `src/**/*.test.tsx`. Path alias `@` → `./src` matches [tsconfig.json](../tsconfig.json).
- **Component tests (jsdom)**: a test file opts into a real DOM per-file with a `// @vitest-environment jsdom` docblock as its first line (works on `.ts` or `.tsx`, no global config change needed). Use [`@testing-library/react`](https://testing-library.com/docs/react-testing-library/intro/) (`render`, `screen`) and `@testing-library/user-event`; see [src/__tests__/PlayerProfileForm.test.tsx](../src/__tests__/PlayerProfileForm.test.tsx) and [src/components/PlayerSwitcher.test.tsx](../src/components/PlayerSwitcher.test.tsx) for the pattern.
- **`localStorage`/`sessionStorage` in jsdom tests**: Node 22+ ships an experimental global `localStorage` that shadows jsdom's real implementation and silently resolves to `undefined` (with a console `ExperimentalWarning`) unless the process is started with `--localstorage-file`. [vitest.setup.ts](../vitest.setup.ts) works around this by installing a small in-memory `Storage` polyfill on `window` whenever a jsdom test provides one, so any `@vitest-environment jsdom` file can use `window.localStorage` normally. If a jsdom test touching storage starts failing with `localStorage` being `undefined` (not throwing, just `undefined`), this is almost certainly the cause — check that `vitest.setup.ts` is still doing the polyfill before looking anywhere else.
- **Scripts**: `npm run test` (watch), `npm run test:run` (single run).

## Where we mock

We do **not** call the real Google Sheets, Drive, or Buttondown APIs in unit tests. We mock the layer that provides that data so tests are fast and deterministic.

**Roster / 2025 portal: `@/lib/sheet-cache`**

- **What**: In tests that need roster (or other sheet) data, we mock `getCachedSheetData` so that when the app asks for `'ROSTER'`, it gets a fixture (array-of-arrays) instead of hitting Google.
- **Why here**: All roster reads go through `getCachedSheetData('ROSTER')` (used by portal-cache, debug route, column-health). Mocking at sheet-cache means one mock covers every consumer. We do not mock the lower-level `google-api.getSheetData` so we don’t have to fake sheet IDs and ranges.
- **Tests that use this**: Portal-cache + player lookup ([src/__tests__/player-lookup.test.ts](../src/__tests__/player-lookup.test.ts)), debug API ([src/__tests__/debug-api.test.ts](../src/__tests__/debug-api.test.ts)). These cover the **2025 portal derived-key lookup** (first initial + last + MMYY), not ADR 0001 field-matching Player Lookup.

**Additional mock: `@/lib/cache-manager` (debug API only)**

- The debug route also calls `CacheManager.getInstance().getDebugData()`. We mock that to return a minimal object so the route doesn’t try to fetch from Drive/Sheets. The mock returns a **new object** each time so one test doesn’t mutate shared state for another.

**Fall 2026 signup: mock the access layer, not Google itself**

Signup routes go through `@/lib/signups-sheet`, `@/lib/buttondown-api`, and (for Final Forms) `@/lib/google-api` + `@/lib/sheet-config`. Unit tests mock those modules the same way roster tests mock sheet-cache: one seam per external system.

| Seam | Mocked in | Why |
|---|---|---|
| `@/lib/signups-sheet` (`findSignupByIdentity`, `findSignupByPlayerId`, `createSignupRow`, `updateSignupRow`) | lookup, mailing, profile-save, finalforms route | Avoids the real Signups spreadsheet. (Layer 2 integration covers the real sheet.) |
| `@/lib/buttondown-api` (`isSubscriber`, `subscribeEmail`, `unsubscribeEmail`, `subscribeUnlessUnsubscribed`) | mailing, profile-save, finalforms | Avoids the real newsletter API. |
| `@/lib/google-api` (`getMostRecentFileInfoFromFolder`, `downloadCsvFromDrive`) plus `SHEET_CONFIG.SPS_FINAL_FORMS_FOLDER_ID` | Final Forms join | Feeds a canned CSV into `findFinalFormsMatch` without Drive. `google-api` must be mocked in any file that loads `final-forms.ts`, because that module initializes auth on import. |
| `@/lib/signup-deadlines.getDeadlineState` | lookup route | Lets lookup tests pin open vs closed without depending on today's date. Deadlines themselves are tested by passing an explicit `Date` into `getDeadlineState`. |

Pure functions (`player-identity`, `signup-checklist`, `signup-deadlines`, `signup-form-schema`, `eligibleMailingEmails`, `seededFieldsFromFinalForms`) take no I/O and need no mocks.

## When we reset

**Portal cache**

- The portal cache is an in-memory singleton. So that each test sees the same mock roster data (and not stale data from a previous test), we call **`forceRefreshPortalCache()` in a `beforeEach`** in any test file that depends on roster data.
- That forces the portal cache to repopulate from the mocked `getCachedSheetData('ROSTER')` before each test. No module reset or test-only APIs are required.

**Sheet cache**

- We don’t reset the sheet-cache module; we replace its behavior with a mock that always returns the fixture. So there’s no need to clear sheet-cache between tests.

**Final Forms snapshot**

- `final-forms.ts` caches the newest export CSV for 2 minutes. Tests that exercise the live-join path (not magic last names) call **`clearFinalFormsCache()` in a `beforeEach`** so one test’s CSV cannot leak into the next. Magic-name fixtures short-circuit before the cache and do not need this.

## Mock data (fixtures)

**2025 portal roster**

- **Location**: [src/__tests__/fixtures/roster-mock.ts](../src/__tests__/fixtures/roster-mock.ts).
- **Shape**: Same as Google Sheets API: array of rows (row 0 = header, row 1+ = data). Column names must match `src/lib/column-validation.ts` (required columns + portal columns matched by pattern).
- **Content**: No real PII. Self-descriptive labels only (e.g. AfirstName, BlastName, YLast ZName, Q-RlastName, p001, p002). Covers:
  - Simple name (e.g. AfirstName BlastName → key `ablastname0512`).
  - Last name with **space** (e.g. XfirstName, "YLast ZName" → key `xylastzname0314`; normalization strips spaces so login still matches).
  - Last name with **dash** (e.g. PfirstName, "Q-RlastName" → key `pq-rlastname0515`; dash is kept in key and in sheet).
- **Adding scenarios**: Add rows to `ROSTER_MOCK_DATA` and corresponding tests. Keep header in sync with required + portal columns.

**Fall 2026 signup rows**

- **Location**: [src/__tests__/fixtures/signup-record.ts](../src/__tests__/fixtures/signup-record.ts). `signupRecord(overrides)` fills every `SIGNUPS_COLUMNS` field with `''` so tests only spell the fields they care about.
- **Final Forms CSV**: inline in [src/__tests__/final-forms.test.ts](../src/__tests__/final-forms.test.ts). Student columns (`Email`, `Cell Phone`, `First Name`) are listed *before* Parent 1 equivalents so substring header matching does not steal the parent column as the student one.
- **Magic last names**: [src/lib/final-forms-test-fixtures.ts](../src/lib/final-forms-test-fixtures.ts), documented in [docs/fall-2026/signup-test-fixtures.md](fall-2026/signup-test-fixtures.md). Unit tests assert the join table and `isTest` flag; the browser walk still covers dashboard copy and layout.

## Signup domain states (layer 1)

These are the family-facing states from ADRs 0001–0004 and `docs/fall-2026/signup-spec.md`. Add a unit test here when you add a new state, rather than relying only on a manual click-through.

**Identity** ([src/__tests__/player-identity.test.ts](../src/__tests__/player-identity.test.ts), [src/__tests__/signup-lookup.test.ts](../src/__tests__/signup-lookup.test.ts))

- `normalizeName`: spaces, apostrophes, accents, hyphens kept.
- `normalizeDateOfBirth`: ISO and `M/D/YYYY`.
- `mintPlayerId`: opaque, not derived from name/DOB.
- Twins: exact preferred-name match, leading-letter prefix, no shared letters → no guess; a single candidate matches even if the preferred name differs.
- Near-match: same last+DOB, similar last name, unrelated last name.
- Lookup route: existing row, near-match warning, confirm-then-create, honeypot, min-time, missing fields, season closed (create 403, existing lookup still 200).

**Final Forms** ([src/__tests__/final-forms.test.ts](../src/__tests__/final-forms.test.ts), [src/__tests__/signup-finalforms-route.test.ts](../src/__tests__/signup-finalforms-route.test.ts), [src/__tests__/signup-checklist.test.ts](../src/__tests__/signup-checklist.test.ts))

- Magic last names: `TestNotFound` plus the four found signature/clearance combos; case/spacing insensitive; Drive is not called; `isTest` is set. `TestNotFound` still reports the fixture `dataAsOf` so the dashboard can show last-synced.
- Live join: unique last+DOB (including student-signed / caretaker-unsigned), twins by legal first name, preferred-name fallback, ambiguous twins return null, `spsStudentId` is authoritative, missing id / missing name → not found. A miss still reports the export timestamp via `getFinalFormsDataAsOf`.
- Route: not-found includes `dataAsOf`; first join writes `spsStudentId`; never overwrite; never write `spsStudentId` for a fixture; empty seed fields are copied only on first join (fixtures: only while every seed column is still empty); never overwrite a saved seed value; never refill after the join is established.
- Checklist: Final Forms is done only when found **and** all three flags are true.
- Not-found dashboard ([src/__tests__/FinalFormsRow.test.tsx](../src/__tests__/FinalFormsRow.test.tsx)): register-now, then stale-data with last-refreshed + refresh, then name mismatch; C4 live status after click.

**Mailing list** ([src/__tests__/signup-mailing.test.ts](../src/__tests__/signup-mailing.test.ts), [src/__tests__/signup-profile-save.test.ts](../src/__tests__/signup-profile-save.test.ts))

- Eligible emails: caretaker 1, caretaker 2, student personal. SPS email is never eligible. Blank emails are omitted.
- GET mixed on/off status per email.
- POST join and opt-out for caretaker and student personal; ineligible / SPS → 400; Buttondown failure → 502.
- Auto-subscribe (first Final Forms join and profile save) covers caretaker 1/2 and student personal, never SPS; skips addresses already unsubscribed in Buttondown; a false subscribe result does not block the sheet write. Fixtures never hit the real list.

**Caretakers / schema / checklist / deadlines**

- Cap of 2 is structural: exactly two `CARETAKER_*` column groups and no `caretaker3*` schema fields ([src/__tests__/signup-form-schema.test.ts](../src/__tests__/signup-form-schema.test.ts)). Completeness requires caretaker 1 name+email; caretaker 2 is optional; zero caretakers is incomplete but save is still allowed.
- Checklist: player-info required fields (Other Info excluded), photo, volunteering including “Not this season”.
- Deadlines: open through Sept 9, late Sept 10–18, closed after Sept 18; only `closed` blocks new-player creation.

**Still layer 3 only (no unit/DOM suite)**

- Dashboard copy and layout for each Final Forms state (C5/C15) other than the not-found last-synced/refresh covered above, mailing widget visibility, caretaker-2 collapsed vs expanded, photo upload UI, media opt-out vs photo independence, found-state refresh C3/C4 copy. Drive those with the magic last names at desktop and 375×812 as below.

## What we don’t do

- **No local Google Sheet**: We don’t run a “local Sheets server.” All sheet data in unit tests comes from fixtures and mocks.
- **No real API calls in this suite**: `npm run test` / `npm run test:run` never call the real Sheets, Drive, or Buttondown APIs. The real-API layer lives in the separate integration suite below (Sheets only). Mailing and Final Forms Drive reads are unit-mocked; they are not in the integration suite.

## Running tests

```bash
npm run test              # watch mode (unit, mocked)
npm run test:run          # single run (unit, mocked; e.g. for CI, and the pre-commit hook)
npm run test:integration  # single run against the real Sheets integration test sheet
```

Unit tests live under `src/` with names `*.test.ts` or `*.spec.ts`, excluding `src/__tests__/integration/`. The integration suite lives only under `src/__tests__/integration/` and uses its own [vitest.integration.config.mts](../vitest.integration.config.mts).

## Layer 2: Sheets integration tests

A second suite (`src/__tests__/integration/`) calls the *real* Google Sheets API (`@/lib/google-api`, not mocked) so we can catch things unit tests structurally cannot: range/column truncation, type coercion on read-back, and whatever else the real API does differently from the mock. This is what would have caught the `A:Z` truncation bug end-to-end, not just at the mapping layer.

**Target**: a dedicated **”Signups Test - Fall 2026”** spreadsheet, never the real “2026 Fall Signups” sheet the coach depends on. Its `Signups` tab’s header row is a copy of the real sheet’s header row (same names, same count, deliberately past column Z), so the suite exercises the same shape of bug that hit production. Config: `SIGNUPS_SHEET_ID_TEST` in `.env.local` / GitHub Actions secrets.

**Isolation is load-bearing.** `signups-config.ts` bakes `SIGNUPS_SHEET_ID` into a module-level constant at import time. A naive `process.env.SIGNUPS_SHEET_ID = testId` assignment is *not* enough if anything already imported `signups-config` first (the cached module keeps whatever sheet ID was live at *its* import time): this actually happened once while building this suite and wrote junk rows into the real production sheet before it was caught and fixed. `signups-sheet.integration.test.ts`’s `beforeAll` now calls `vi.resetModules()` + `vi.stubEnv()` before the *first* import of `signups-config` in the process, then asserts the resolved `SIGNUPS_SHEET_CONFIG.SIGNUPS_SHEET_ID` actually equals `SIGNUPS_SHEET_ID_TEST` before doing anything else — it throws instead of running if that check ever fails again. Don’t remove that guard when editing the test.

**Cadence**: runs in CI (`.github/workflows/test.yml`, `integration` job) on every push/PR, using `SIGNUPS_SHEET_ID_TEST` and `GOOGLE_SERVICE_ACCOUNT_KEY` repo secrets. Not part of the pre-commit hook (network + slower). The suite `describe.skipIf`s itself when those env vars aren’t set, so it degrades gracefully for local runs or forks without the secrets.

**Season setup**: each new season’s signup cycle needs its own test sheet once its real Signups sheet’s schema is finalized (see “Recreating the test sheet” below), since the test sheet’s header must track the real one.

### Recreating the test sheet (e.g. at the start of a new season)

1. Create a new spreadsheet with a `Signups` tab, in the same Drive folder as the current test sheet (ask the coach for the folder, or check `SIGNUPS_SHEET_ID_TEST`’s current sheet for its parent).
2. Copy the real Signups sheet’s header row (`Signups!1:1`) into the new test sheet’s `Signups!1:1` verbatim: same names, same order. Do **not** hand-type `SIGNUPS_COLUMNS` values instead; the point is to mirror what production actually has, including any manual/coach-added columns.
3. Share the new sheet with the service account (`GOOGLE_SERVICE_ACCOUNT_KEY`’s `client_email`) as a writer.
4. Update `SIGNUPS_SHEET_ID_TEST` in `.env.local`, `.env.example`, and the `SIGNUPS_SHEET_ID_TEST` GitHub Actions secret.
5. Run `npm run test:integration` locally once to confirm it’s wired up correctly before relying on CI.

## Layer 2b: Drive integration tests (photo upload and Photo Carryover)

A third suite, `src/__tests__/integration/photo-drive.integration.test.ts`, calls the *real* Google Drive API (`@/lib/google-oauth-drive`, not mocked) and the real Sheets API against a dedicated test “Fall 2025 roster” fixture, covering what the mocked `photo-carryover.test.ts`/route tests structurally cannot: whether `uploadPlayerPhoto`’s replace-in-place genuinely keeps the same Drive file id rather than creating a duplicate, whether downloaded bytes round-trip unchanged, and whether header discovery across a real sheet out to column AQ actually finds the right row.

**Targets**: a dedicated **“Photos Test - Fall 2026”** Drive folder and a dedicated **“Photo Carryover Test - Fall 2026”** spreadsheet (one `📋 Roster` tab, header row with `StudentID` at B1 and `Photo Download` at AQ1, matching the real Fall 2025 sheet’s column names), both living in the same Drive folder as “Signups Test - Fall 2026”. Neither is ever the real `PHOTOS_FOLDER_ID` folder or the real Fall 2025 roster sheet. Config: `PHOTOS_FOLDER_ID_TEST` and `FALL_2025_ROSTER_SHEET_ID_TEST` in `.env.local` / GitHub Actions secrets, alongside the existing `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`/`GOOGLE_OAUTH_REFRESH_TOKEN` (same identity photo uploads already use) and `GOOGLE_SERVICE_ACCOUNT_KEY`.

**Isolation is load-bearing here too.** `FALL_2025_ROSTER_SHEET_ID` is baked into `SHEET_CONFIG` at module-eval time, the same hazard `SIGNUPS_SHEET_ID` has in Layer 2. The Photo Carryover describe block’s `beforeAll` calls `vi.resetModules()` + `vi.stubEnv()` before the first import of `sheet-config`, then asserts the resolved `SHEET_CONFIG.FALL_2025_ROSTER_SHEET_ID` actually equals `FALL_2025_ROSTER_SHEET_ID_TEST` before doing anything else, throwing otherwise. `PHOTOS_FOLDER_ID` isn’t baked into a module constant (`google-oauth-drive.ts` reads `process.env.PHOTOS_FOLDER_ID` live inside each call), so a plain `vi.stubEnv()` is sufficient for it, no reset-modules dance needed.

**Self-contained fixture, self-cleaning.** The test uploads its own “last season’s photo” into the test Drive folder and writes it into the test sheet’s fixed scratch row (`📋 Roster!B2:AQ2`) in `beforeAll`, rather than depending on manually pre-seeded data that could drift. `afterAll` clears that scratch row and deletes every Drive file the run created (the seeded “last season” photo, the round-trip test upload, and the carried-over copy), using a small Drive client built directly in the test file rather than a `deleteDriveFile` export from `google-oauth-drive.ts` — Photo Carryover’s round-3 decision (docs/adr/0003) deliberately dropped delete/archive from production scope, and test cleanup shouldn’t grow that surface.

**Cadence**: runs in CI (`.github/workflows/test.yml`, `integration` job) alongside the Sheets suite, using the same secrets plus `PHOTOS_FOLDER_ID_TEST`, `FALL_2025_ROSTER_SHEET_ID_TEST`, and the three `GOOGLE_OAUTH_*` secrets. `describe.skipIf`s itself when any are absent.

## Layer 3: browser/E2E scenarios (manual, ad hoc)

There’s no Playwright or other headless-browser suite in this repo. Join logic, mailing eligibility, and lookup/save routes are covered in layer 1. Signup-flow **UI** changes (copy, layout, caretaker 2 always visible, mailing widget, photo upload) are instead spot-checked on demand by driving the real app in Chrome and walking the magic-last-name scenario matrix documented in `docs/fall-2026/signup-test-fixtures.md` (`TestNotFound` through `TestCleared`), at both desktop and mobile (375×812) viewport widths, with screenshots for visual comparison. This is intentionally not automated/CI-wired; ask for it explicitly when it matters.

## Pre-commit hook

[Husky](https://typicode.github.io/husky) runs `npm run test:run` before each commit. If tests fail, the commit is blocked so we avoid committing regressions. The hook is set up when you run `npm install` (via the `prepare` script). To skip the hook once, use `git commit --no-verify`.
