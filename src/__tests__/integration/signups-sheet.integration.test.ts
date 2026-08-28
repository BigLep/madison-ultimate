// Integration test: exercises signups-sheet.ts against a real, dedicated test spreadsheet
// (never the production "2026 Fall Signups" sheet). Requires SIGNUPS_SHEET_ID_TEST and
// Google service account credentials; skipped automatically when either is absent.
//
// Unlike the mocked unit tests, this catches real Google Sheets API behavior mocks can't:
// range/column truncation, type coercion on read-back, and header discovery past column Z.
// See docs/TEST_DESIGN.md for the layered test strategy and how to (re)create the test sheet.

import { describe, it, expect, beforeAll, vi } from 'vitest';

const TEST_SHEET_ID = process.env.SIGNUPS_SHEET_ID_TEST;
const HAS_CREDENTIALS = Boolean(
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE
);

function fieldValue(key: string): string {
  // Distinct, greppable, non-PII value per field so a mismatch on read-back is easy to spot.
  return `IT-${key}`;
}

describe.skipIf(!TEST_SHEET_ID || !HAS_CREDENTIALS)('signups-sheet integration (real Google Sheets)', () => {
  let signupsSheet: typeof import('@/lib/signups-sheet');
  let SIGNUPS_COLUMNS: typeof import('@/lib/signups-config').SIGNUPS_COLUMNS;

  beforeAll(async () => {
    // signups-config.ts bakes SIGNUPS_SHEET_ID into a module-level const at import time, so a
    // plain `process.env.SIGNUPS_SHEET_ID = TEST_SHEET_ID` assignment here is NOT enough if
    // anything (in this file or a shared module) already imported signups-config first: the
    // cached module keeps whatever sheet ID was live at ITS import time. That previously let
    // this test silently write to the real production sheet. Reset the module registry and
    // stub the env before the first import of signups-config in this process to guarantee a
    // clean bake-in, then verify it resolved to the test sheet before doing anything else.
    vi.resetModules();
    vi.stubEnv('SIGNUPS_SHEET_ID', TEST_SHEET_ID!);

    const config = await import('@/lib/signups-config');
    SIGNUPS_COLUMNS = config.SIGNUPS_COLUMNS;

    if (config.SIGNUPS_SHEET_CONFIG.SIGNUPS_SHEET_ID !== TEST_SHEET_ID) {
      throw new Error(
        `Refusing to run: signups-config resolved SIGNUPS_SHEET_ID to "${config.SIGNUPS_SHEET_CONFIG.SIGNUPS_SHEET_ID}", ` +
          `expected the test sheet "${TEST_SHEET_ID}". This must never point at the production sheet.`
      );
    }

    signupsSheet = await import('@/lib/signups-sheet');
  });

  it('round-trips every SIGNUPS_COLUMNS field through create + update + a fresh read, including columns past Z', async () => {
    const allKeys = Object.values(SIGNUPS_COLUMNS);
    // Sanity check on the test sheet's own setup, not the bug: if this ever fails, the test
    // sheet's header row no longer covers every field and needs to be recreated/widened.
    expect(allKeys.length).toBeGreaterThan(26);

    const createFields: Record<string, string> = {};
    for (const key of allKeys) {
      if (key === SIGNUPS_COLUMNS.PLAYER_ID || key === SIGNUPS_COLUMNS.CREATED_AT || key === SIGNUPS_COLUMNS.UPDATED_AT) {
        continue; // system-assigned, not caller-supplied
      }
      createFields[key] = fieldValue(key);
    }

    const created = await signupsSheet.createSignupRow(createFields);
    const playerId = created[SIGNUPS_COLUMNS.PLAYER_ID];
    expect(playerId).toBeTruthy();

    // Update every field to a second distinct value, exercising updateSignupRow the same way.
    const updateFields: Record<string, string> = {};
    for (const key of allKeys) {
      if (key === SIGNUPS_COLUMNS.PLAYER_ID || key === SIGNUPS_COLUMNS.CREATED_AT || key === SIGNUPS_COLUMNS.UPDATED_AT) {
        continue;
      }
      updateFields[key] = fieldValue(key) + '-v2';
    }
    await signupsSheet.updateSignupRow(playerId, updateFields);

    // The regression: don't trust what create/update return, do a fresh read from the sheet.
    const fresh = await signupsSheet.findSignupByPlayerId(playerId);
    expect(fresh).not.toBeNull();

    for (const key of allKeys) {
      if (key === SIGNUPS_COLUMNS.PLAYER_ID || key === SIGNUPS_COLUMNS.CREATED_AT || key === SIGNUPS_COLUMNS.UPDATED_AT) {
        continue;
      }
      expect(fresh!.record[key], `field "${key}" did not round-trip through a fresh read`).toBe(
        fieldValue(key) + '-v2'
      );
    }
  });
});
