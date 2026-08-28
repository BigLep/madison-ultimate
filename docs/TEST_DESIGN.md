# Test design

This document describes how we test the Madison Ultimate app locally: which framework we use, where we mock, when we reset state, and how to add tests.

## Framework: Vitest

We use **Vitest** for unit tests.

- **Why Vitest**: Fast, good ESM and TypeScript support, and works well with Next.js path aliases (`@/`). No Jest config or transform quirks. Same `describe`/`it`/`expect` style.
- **Config**: [vitest.config.ts](../vitest.config.ts) at repo root. `environment: 'node'` (no DOM). `include`: `src/**/*.test.ts`, `src/**/*.spec.ts`. Path alias `@` → `./src` matches [tsconfig.json](../tsconfig.json).
- **Scripts**: `npm run test` (watch), `npm run test:run` (single run).

## Where we mock

We do **not** call the real Google Sheets API in unit tests. We mock the layer that provides sheet data so tests are fast and deterministic.

**Mock layer: `@/lib/sheet-cache`**

- **What**: In tests that need roster (or other sheet) data, we mock `getCachedSheetData` so that when the app asks for `'ROSTER'`, it gets a fixture (array-of-arrays) instead of hitting Google.
- **Why here**: All roster reads go through `getCachedSheetData('ROSTER')` (used by portal-cache, debug route, column-health). Mocking at sheet-cache means one mock covers every consumer. We do not mock the lower-level `google-api.getSheetData` so we don’t have to fake sheet IDs and ranges.
- **Tests that use this**: Portal-cache + player lookup ([src/__tests__/player-lookup.test.ts](../src/__tests__/player-lookup.test.ts)), debug API ([src/__tests__/debug-api.test.ts](../src/__tests__/debug-api.test.ts)).

**Additional mock: `@/lib/cache-manager` (debug API only)**

- The debug route also calls `CacheManager.getInstance().getDebugData()`. We mock that to return a minimal object so the route doesn’t try to fetch from Drive/Sheets. The mock returns a **new object** each time so one test doesn’t mutate shared state for another.

## When we reset

**Portal cache**

- The portal cache is an in-memory singleton. So that each test sees the same mock roster data (and not stale data from a previous test), we call **`forceRefreshPortalCache()` in a `beforeEach`** in any test file that depends on roster data.
- That forces the portal cache to repopulate from the mocked `getCachedSheetData('ROSTER')` before each test. No module reset or test-only APIs are required.

**Sheet cache**

- We don’t reset the sheet-cache module; we replace its behavior with a mock that always returns the fixture. So there’s no need to clear sheet-cache between tests.

## Mock data (fixtures)

- **Location**: [src/__tests__/fixtures/roster-mock.ts](../src/__tests__/fixtures/roster-mock.ts).
- **Shape**: Same as Google Sheets API: array of rows (row 0 = header, row 1+ = data). Column names must match `src/lib/column-validation.ts` (required columns + portal columns matched by pattern).
- **Content**: No real PII. Self-descriptive labels only (e.g. AfirstName, BlastName, YLast ZName, Q-RlastName, p001, p002). Covers:
  - Simple name (e.g. AfirstName BlastName → key `ablastname0512`).
  - Last name with **space** (e.g. XfirstName, "YLast ZName" → key `xylastzname0314`; normalization strips spaces so login still matches).
  - Last name with **dash** (e.g. PfirstName, "Q-RlastName" → key `pq-rlastname0515`; dash is kept in key and in sheet).
- **Adding scenarios**: Add rows to `ROSTER_MOCK_DATA` and corresponding tests. Keep header in sync with required + portal columns.

## What we don’t do

- **No local Google Sheet**: We don’t run a “local Sheets server.” All sheet data in unit tests comes from fixtures and mocks.
- **No real API calls in this suite**: `npm run test` / `npm run test:run` never call the real Sheets or Drive APIs. The real-API layer lives in the separate integration suite below.

## Running tests

```bash
npm run test              # watch mode (unit, mocked)
npm run test:run          # single run (unit, mocked; e.g. for CI, and the pre-commit hook)
npm run test:integration  # single run against the real Sheets integration test sheet
```

Unit tests live under `src/` with names `*.test.ts` or `*.spec.ts`, excluding `src/__tests__/integration/`. The integration suite lives only under `src/__tests__/integration/` and uses its own [vitest.integration.config.ts](../vitest.integration.config.ts).

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

## Layer 3: browser/E2E scenarios (manual, ad hoc)

There’s no Playwright or other headless-browser suite in this repo. Signup-flow UI changes are instead spot-checked on demand (before shipping a change to `/signup` or the player dashboard) by driving the real app in Chrome and walking the magic-last-name scenario matrix documented in `docs/fall-2026/signup-test-fixtures.md` (`TestNotFound` through `TestCleared`), at both desktop and mobile (375×812) viewport widths, with screenshots for visual comparison. This is intentionally not automated/CI-wired; ask for it explicitly when it matters.

## Pre-commit hook

[Husky](https://typicode.github.io/husky) runs `npm run test:run` before each commit. If tests fail, the commit is blocked so we avoid committing regressions. The hook is set up when you run `npm install` (via the `prepare` script). To skip the hook once, use `git commit --no-verify`.
