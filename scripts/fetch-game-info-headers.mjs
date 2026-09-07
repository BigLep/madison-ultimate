/**
 * One-off script to fetch Game Info sheet headers (and first 2 data rows) from the roster spreadsheet.
 * Loads .env.local and uses the service account. Run from repo root: node scripts/fetch-game-info-headers.mjs
 */
import { existsSync } from 'fs';
import { join } from 'path';
import { loadEnvLocal, repoRoot as root } from './lib/env.mjs';

loadEnvLocal();

const sheetId = process.env.ROSTER_SHEET_ID;
const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE
  ? join(root, process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE.replace(/^\.\//, ''))
  : null;

if (!sheetId || !keyFile || !existsSync(keyFile)) {
  console.error('Need ROSTER_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_KEY_FILE in .env.local');
  process.exit(1);
}

const { google } = await import('googleapis');
const auth = new google.auth.GoogleAuth({
  keyFile,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

const range = "'📍Game Info'!A1:Z5";
const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
const rows = res.data.values || [];

console.log('Game Info sheet – headers (row 1) and sample data (rows 2–5):\n');
console.log('Headers:', rows[0] || []);
console.log('\nColumn index → header name:');
(rows[0] || []).forEach((h, i) => console.log(`  ${i}: "${h}"`));
if (rows.length > 1) {
  console.log('\nFirst data row:', rows[1]);
}
