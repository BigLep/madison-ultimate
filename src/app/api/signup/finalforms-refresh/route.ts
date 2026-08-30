import { NextResponse } from 'next/server';
import { clearFinalFormsCache } from '@/lib/final-forms';

// On-demand Final Forms refresh (spec C3/C4): triggers workflow_dispatch on the
// finalforms-export workflow in madison-ultimate-admin, with a single-flight guard so
// concurrent clicks don't queue duplicate runs (the workflow file also has a concurrency
// group as a second guard against the check-then-dispatch race).
//
// FINALFORMS_GITHUB_TOKEN is a classic PAT (public_repo scope only; `workflow` scope is NOT
// needed since we only dispatch/list/cancel runs, never edit workflow files) owned by a
// GitHub account dedicated to Madison Ultimate automation (not Steve's personal account),
// added as a collaborator on BigLep/madison-ultimate-admin. See docs/fall-2026/signup-plan.md
// section 6 for setup details and rotation date. /api/diagnostics verifies both read access
// and actual write permission (via a safe cancel-on-a-completed-run probe) without ever
// triggering a real sync, so check there first if this route starts reporting failures.
//
// If the env vars below are unset, this route reports itself as not configured rather than
// erroring, so the dashboard can skip the refresh button gracefully.

const GITHUB_API = 'https://api.github.com';

function getConfig() {
  const token = process.env.FINALFORMS_GITHUB_TOKEN;
  const repo = process.env.FINALFORMS_GITHUB_REPO; // e.g. "BigLep/madison-ultimate-admin"
  const workflowFile = process.env.FINALFORMS_GITHUB_WORKFLOW_FILE; // e.g. "finalforms-export.yml"
  const ref = process.env.FINALFORMS_GITHUB_REF || 'main';

  if (!token || !repo || !workflowFile) return null;
  return { token, repo, workflowFile, ref };
}

export async function POST() {
  const config = getConfig();
  if (!config) {
    return NextResponse.json(
      {
        success: false,
        configured: false,
        error: 'Final Forms refresh is not configured yet (needs FINALFORMS_GITHUB_TOKEN, FINALFORMS_GITHUB_REPO, FINALFORMS_GITHUB_WORKFLOW_FILE).',
      },
      { status: 503 }
    );
  }

  try {
    const headers = {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    };

    // Single-flight guard: don't dispatch a new run if one is already queued/in-progress.
    const runsRes = await fetch(
      `${GITHUB_API}/repos/${config.repo}/actions/workflows/${config.workflowFile}/runs?status=in_progress&per_page=1`,
      { headers }
    );
    if (runsRes.ok) {
      const runsData = await runsRes.json();
      if ((runsData.total_count || 0) > 0) {
        // A sync landed some data since our last read; drop the stale snapshot so
        // whenever the player reloads (manually, per the simplified refresh UX),
        // the join re-reads Drive instead of waiting out the rest of the TTL.
        clearFinalFormsCache();
        return NextResponse.json({
          success: true,
          status: 'already-running',
          message: 'A sync is already underway. Reload this page in a couple of minutes to see if that worked.',
        });
      }
    }

    const dispatchRes = await fetch(
      `${GITHUB_API}/repos/${config.repo}/actions/workflows/${config.workflowFile}/dispatches`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ ref: config.ref }),
      }
    );

    if (!dispatchRes.ok) {
      const text = await dispatchRes.text();
      console.error('Final Forms refresh dispatch failed:', dispatchRes.status, text);
      return NextResponse.json({ success: false, error: 'Could not start a sync. Please try again.' }, { status: 502 });
    }

    clearFinalFormsCache();
    return NextResponse.json({
      success: true,
      status: 'started',
      message: 'Great, we’re syncing with Final Forms now. Reload this page in a couple of minutes to see if that worked.',
    });
  } catch (error) {
    console.error('Error triggering Final Forms refresh:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
