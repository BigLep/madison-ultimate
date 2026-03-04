/**
 * One-off script to fetch Game Info sheet headers (and first 2 data rows) from the roster spreadsheet.
 * Loads .env.local and uses the service account. Run from repo root: node scripts/fetch-game-info-headers.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Load .env.local
const envPath = join(root, '.env.local');
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
}

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
