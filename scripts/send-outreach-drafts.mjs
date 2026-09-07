#!/usr/bin/env node
// Signup Outreach (ADR 0007): send the drafts a manifest lists, one every few seconds, stopping
// on the first failure. Only a human runs this, and only with the no-send guard lifted on the
// command line itself; the script never changes the environment:
//
//   GOG_GMAIL_NO_SEND= node scripts/send-outreach-drafts.mjs tmp/outreach-2026-09-08.json [--pace-seconds 5]
//
// Every gog call runs as the coach account (scripts/lib/gog.mjs), whatever the shell has set.
// Re-running resumes after the last draft marked sent in the manifest.

import { readFileSync, writeFileSync } from 'node:fs';
import { gogRaw, gogJson, COACH_ACCOUNT } from './lib/gog.mjs';
import { setTimeout as sleep } from 'node:timers/promises';

function parseArgs(argv) {
  const args = { paceSeconds: 5 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pace-seconds') {
      args.paceSeconds = Number(argv[++i]);
      if (!Number.isFinite(args.paceSeconds) || args.paceSeconds < 0) throw new Error('--pace-seconds must be a non-negative number');
    } else if (a.startsWith('--')) throw new Error(`Unknown argument ${a}`);
    else if (!args.manifest) args.manifest = a;
    else throw new Error(`Unexpected argument ${a}`);
  }
  if (!args.manifest) throw new Error('Usage: GOG_GMAIL_NO_SEND= node scripts/send-outreach-drafts.mjs <manifest.json> [--pace-seconds 5]');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (process.env.GOG_GMAIL_NO_SEND) {
    throw new Error(
      'GOG_GMAIL_NO_SEND is set, so nothing can be sent. This script never lifts it; if you are the coach and mean to send, run:\n' +
        `  GOG_GMAIL_NO_SEND= node scripts/send-outreach-drafts.mjs ${args.manifest}`
    );
  }

  const manifest = JSON.parse(readFileSync(args.manifest, 'utf8'));
  const pending = manifest.drafts.filter(d => !d.sentAt);
  const alreadySent = manifest.drafts.length - pending.length;
  console.log(`${pending.length} draft${pending.length === 1 ? '' : 's'} to send as ${COACH_ACCOUNT} (${alreadySent} already sent), one every ${args.paceSeconds}s.`);
  if (pending.length === 0) return;

  // Pre-flight: the first pending draft must be visible in the coach account before anything
  // is sent, so a wrong account or a deleted draft fails here with a plain explanation.
  try {
    gogJson(['gmail', 'drafts', 'get', pending[0].draftId]);
  } catch (err) {
    throw new Error(
      `Draft ${pending[0].draftId} (${pending[0].playerId} ${pending[0].fullName}) is not in ${COACH_ACCOUNT}'s Drafts. ` +
        'It may have been deleted or already sent from Gmail; remove it from the manifest or re-run the draft script.\n' +
        err.message
    );
  }

  let sent = 0;
  for (const draft of pending) {
    const result = gogRaw(['gmail', 'drafts', 'send', draft.draftId, '--json']);
    if (result.error || result.status !== 0) {
      console.error(`\nStopped: could not send draft ${draft.draftId} (${draft.playerId} ${draft.fullName}, "${draft.subject}")`);
      console.error(result.error ? result.error.message : result.stderr || result.stdout);
      console.error(`Sent ${sent} this run; ${pending.length - sent} remaining. Fix the problem, then re-run the same command to resume.`);
      process.exit(1);
    }
    draft.sentAt = new Date().toISOString();
    writeFileSync(args.manifest, JSON.stringify(manifest, null, 2));
    sent++;
    console.log(`Sent ${draft.playerId} ${draft.fullName} to ${draft.to.join(', ')} (${sent}/${pending.length})`);
    if (sent < pending.length && args.paceSeconds > 0) await sleep(args.paceSeconds * 1000);
  }
  console.log(`\nDone: sent ${sent}, remaining 0.`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
