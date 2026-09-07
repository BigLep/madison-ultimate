#!/usr/bin/env node
// Signup Outreach (ADR 0007): send the drafts a manifest lists, one every few seconds, stopping
// on the first failure. Only a human runs this, and only with the no-send guard lifted on the
// command line itself; the script never changes the environment:
//
//   GOG_GMAIL_NO_SEND= node scripts/send-outreach-drafts.mjs tmp/outreach-2026-09-08.json [--pace-seconds 5]
//
// Re-running resumes after the last draft marked sent in the manifest.

import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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
  console.log(`${pending.length} draft${pending.length === 1 ? '' : 's'} to send (${alreadySent} already sent), one every ${args.paceSeconds}s.`);

  let sent = 0;
  for (const draft of pending) {
    const result = spawnSync('gog', ['gmail', 'drafts', 'send', draft.draftId, '--json'], { encoding: 'utf8' });
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
