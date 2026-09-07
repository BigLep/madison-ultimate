#!/usr/bin/env node
// Signup Outreach (ADR 0007): build one Gmail draft per player from the coach's template.
// Never sends. Run from the repo root:
//
//   node scripts/outreach-drafts.mjs --template docs/fall-2026/outreach/wave-1.txt [options]
//
// Options:
//   --base-url <url>   Portal to fetch /api/admin/outreach from (default: production). Player
//                      links in the drafts always use the public address the route returns,
//                      whatever this points at.
//   --players <file>   One PlayerID or Full Name per line; narrows the audience. Blank lines and
//                      "#" comments are ignored. Any line matching nothing, or more than one row,
//                      stops the run before a draft is created.
//   --to <email>       Rehearsal: every draft goes to this one address (Cc dropped), subject
//                      prefixed "[TEST] ".
//   --limit <n>        Stop after n drafts.
//   --dry-run          Print what would be created (gog --dry-run); write no manifest.
//
// Every gog call runs as the coach account (scripts/lib/gog.mjs), whatever the shell has set.
// Reads ADMIN_SECRET from .env.local. The route does the audience selection (see
// src/lib/signup-outreach.ts); this script renders and calls gog. Writes
// tmp/outreach-<date>.json (gitignored) listing every draft created, which
// scripts/send-outreach-drafts.mjs consumes.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseTemplate, renderDraft, CHECKLIST_ROWS } from './lib/outreach-template.mjs';
import { loadEnvLocal, repoRoot as root } from './lib/env.mjs';
import { gogJson as gog, COACH_ACCOUNT } from './lib/gog.mjs';

const DEFAULT_BASE_URL = 'https://madisonultimate.org';

function parseArgs(argv) {
  const args = { baseUrl: DEFAULT_BASE_URL, dryRun: false, limit: Infinity };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--template') args.template = next();
    else if (a === '--base-url') args.baseUrl = next().replace(/\/$/, '');
    else if (a === '--players') args.players = next();
    else if (a === '--to') args.to = next();
    else if (a === '--limit') args.limit = Number(next());
    else if (a === '--dry-run') args.dryRun = true;
    else throw new Error(`Unknown argument ${a}`);
  }
  if (!args.template) throw new Error('--template <file> is required');
  if (Number.isNaN(args.limit)) throw new Error('--limit must be a number');
  return args;
}

/**
 * Subjects of every unsent draft in the account, for the duplicate check. gog v0.39 shapes:
 * `drafts list --json` gives { drafts: [{ id }] } (no subject), and `drafts get <id> --json`
 * gives { draft: { id, message: { payload: { headers: [{ name, value }] } } } }.
 */
function existingDraftSubjects() {
  const subjects = new Set();
  for (const { id } of gog(['gmail', 'drafts', 'list', '--all']).drafts || []) {
    const headers = gog(['gmail', 'drafts', 'get', id]).draft?.message?.payload?.headers || [];
    const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value;
    if (subject) subjects.add(subject);
  }
  return subjects;
}

async function fetchOutreach(baseUrl, secret, playerLines) {
  const url = new URL(`${baseUrl}/api/admin/outreach`);
  for (const line of playerLines || []) url.searchParams.append('players', line);
  const res = await fetch(url, { headers: { Authorization: `Basic ${Buffer.from(`:${secret}`).toString('base64')}` } });
  if (res.status === 401) throw new Error('The portal rejected ADMIN_SECRET (401)');
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.error || `GET ${url.pathname} failed: ${res.status}`);
  return data;
}

const SHORT_LABELS = { finalForms: 'Forms', playerInfo: 'Info', photo: 'Photo', caretakerInfo: 'Care', coachVolunteering: 'Coach', otherVolunteering: 'Vol' };

function printAudience(selected, skipped, unreachable) {
  const marksHeader = CHECKLIST_ROWS.map(([key]) => SHORT_LABELS[key].padEnd(6)).join('');
  console.log(`${'PlayerID'.padEnd(10)} ${'Name'.padEnd(28)} ${'Src'.padEnd(7)} ${marksHeader} To / Cc`);
  for (const p of selected) {
    const marks = CHECKLIST_ROWS.map(([key]) => (p.checklist[key] ? '✅' : '❌').padEnd(5)).join('');
    const cc = p.cc.length ? ` / cc ${p.cc.join(', ')}` : '';
    console.log(`${p.playerId.padEnd(10)} ${p.fullName.padEnd(28)} ${(p.seeded ? 'seeded' : 'family').padEnd(7)} ${marks} ${p.to.join(', ')}${cc}`);
    for (const w of p.warnings) console.log(`${''.padEnd(10)} warning: ${w}`);
  }
  for (const s of skipped) console.log(`Skipped ${s.line} (${s.playerId}): ${s.reason}`);
  if (unreachable.length > 0) {
    console.log('\nUnreachable (no draft):');
    for (const u of unreachable) console.log(`  ${u.playerId} ${u.fullName}: ${u.reason}`);
  }
}

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error('ADMIN_SECRET is not set (expected in .env.local)');

  const template = parseTemplate(readFileSync(resolve(root, args.template), 'utf8'));
  const playerLines = args.players
    ? readFileSync(resolve(root, args.players), 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    : undefined;

  const data = await fetchOutreach(args.baseUrl, secret, playerLines);
  const byId = new Map(data.players.map(p => [p.playerId, p]));
  const selected = data.audience.selectedPlayerIds.map(id => byId.get(id));

  console.log(`Signup Outreach audience: ${selected.length} of ${data.counts.total} rows (Final Forms export as of ${data.dataAsOf || 'unknown'}); drafting as ${COACH_ACCOUNT}\n`);
  printAudience(selected, data.audience.skipped, playerLines ? [] : data.unreachable);
  console.log('');

  const existing = existingDraftSubjects();
  const manifestPath = join(root, 'tmp', `outreach-${new Date().toISOString().slice(0, 10)}.json`);
  const bodiesDir = join(root, 'tmp', 'outreach');
  mkdirSync(bodiesDir, { recursive: true });
  const manifest =
    existsSync(manifestPath) && !args.dryRun
      ? JSON.parse(readFileSync(manifestPath, 'utf8'))
      : { wave: args.template, baseUrl: args.baseUrl, createdAt: new Date().toISOString(), drafts: [] };

  let created = 0;
  let skippedExisting = 0;
  for (const player of selected) {
    if (created >= args.limit) break;
    const draft = renderDraft(template, player, { rehearsal: Boolean(args.to) });
    if (existing.has(draft.subject)) {
      console.log(`${player.playerId} ${player.fullName}: skipped, draft exists ("${draft.subject}")`);
      skippedExisting++;
      continue;
    }
    const to = args.to ? [args.to] : player.to;
    const cc = args.to ? [] : player.cc;
    const textPath = join(bodiesDir, `${player.playerId}.txt`);
    const htmlPath = join(bodiesDir, `${player.playerId}.html`);
    writeFileSync(textPath, draft.text);
    writeFileSync(htmlPath, draft.html);
    const argv = ['gmail', 'drafts', 'create', '--to', to.join(','), '--subject', draft.subject, '--body-file', textPath, '--body-html-file', htmlPath];
    if (cc.length > 0) argv.push('--cc', cc.join(','));
    if (args.dryRun) argv.push('--dry-run');
    const result = gog(argv);
    created++;
    const recipients = `${to.join(', ')}${cc.length ? ` cc ${cc.join(', ')}` : ''}`;
    if (args.dryRun) {
      console.log(`${player.playerId} ${player.fullName}: would draft to ${recipients} ("${draft.subject}")`);
      continue;
    }
    // gog v0.39 `drafts create --json` answers { draftId, message: { id, threadId }, ... }.
    const draftId = result.draftId || result.draft?.id || result.id;
    if (!draftId) throw new Error(`Draft created for ${player.playerId} but no id in gog output:\n${JSON.stringify(result)}`);
    manifest.drafts.push({ playerId: player.playerId, fullName: player.fullName, subject: draft.subject, to, cc, draftId, createdAt: new Date().toISOString() });
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`${player.playerId} ${player.fullName}: draft ${draftId} to ${recipients}`);
  }

  console.log(`\n${args.dryRun ? 'Would create' : 'Created'} ${created}, skipped ${skippedExisting} (draft exists), skipped ${data.audience.skipped.length} (named but not draftable).`);
  if (!args.dryRun && created > 0) {
    console.log(`Manifest: ${manifestPath}`);
    console.log(`Review the drafts in Gmail, then send with:\n  GOG_GMAIL_NO_SEND= node scripts/send-outreach-drafts.mjs ${manifestPath.replace(root + '/', '')}`);
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
