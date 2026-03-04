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
- **No integration tests in this suite**: These tests do not call the real Sheets or Drive APIs. An optional future step is a separate, minimal integration test against a test spreadsheet (with credentials in env).

## Running tests

```bash
npm run test       # watch mode
npm run test:run   # single run (e.g. for CI)
```

Tests live under `src/` with names `*.test.ts` or `*.spec.ts`.

## Pre-commit hook

[Husky](https://typicode.github.io/husky) runs `npm run test:run` before each commit. If tests fail, the commit is blocked so we avoid committing regressions. The hook is set up when you run `npm install` (via the `prepare` script). To skip the hook once, use `git commit --no-verify`.
