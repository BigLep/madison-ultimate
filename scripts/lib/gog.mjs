// Run gog as the coach account, always. The scripts must not depend on GOG_ACCOUNT being set
// in whichever shell runs them: a plain `gog` in a shell without it resolves to some other
// signed-in account, where the coach's drafts do not exist (a send then fails with 404).
import { spawnSync } from 'node:child_process';

export const COACH_ACCOUNT = 'madisonultimate@gmail.com';

/** Run one gog command as the coach account. Returns { status, stdout, stderr, error }. */
export function gogRaw(argv) {
  return spawnSync('gog', ['--account', COACH_ACCOUNT, ...argv], { encoding: 'utf8' });
}

/** Run one gog command as the coach account and parse its --json output; throws on failure. */
export function gogJson(argv) {
  const result = gogRaw([...argv, '--json']);
  if (result.error) throw new Error(`Could not run gog: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`gog ${argv.slice(0, 3).join(' ')} failed (exit ${result.status}):\n${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout || '{}');
}
