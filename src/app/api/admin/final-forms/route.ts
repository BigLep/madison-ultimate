// Seed Signups from Final Forms (ADR 0006). GET is the Preview: the plan and the Buttondown
// blocked-subscriber count, with no writes. POST applies the same
// plan (joins, then seeds, then the Profile Complete recompute) and reports what happened.
// Gated by Basic Auth in src/proxy.ts. Report shapes live in src/lib/reconciliation-summary.ts.

import { NextResponse } from 'next/server';
import { listAllSignups } from '../../../../lib/signups-sheet';
import { previewFinalFormsReconciliation, applyFinalFormsReconciliation } from '../../../../lib/final-forms';
import { summarizePlan, summarizeApplied } from '../../../../lib/reconciliation-summary';
import { getBlockedSubscriberCount } from '../../../../lib/buttondown-api';

function errorResponse(context: string, error: unknown) {
  console.error(context, error);
  return NextResponse.json(
    { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
    { status: 500 }
  );
}

export async function GET() {
  try {
    const [signups, blockedCount] = await Promise.all([listAllSignups(), getBlockedSubscriberCount()]);
    const plan = await previewFinalFormsReconciliation(signups);
    return NextResponse.json({
      success: true,
      blockedCount,
      noSnapshot: plan === null,
      preview: plan ? summarizePlan(plan) : null,
    });
  } catch (error) {
    return errorResponse('Error previewing Seed Signups from Final Forms:', error);
  }
}

export async function POST() {
  try {
    const signups = await listAllSignups();
    const plan = await previewFinalFormsReconciliation(signups);
    if (!plan) {
      return NextResponse.json({ success: true, noSnapshot: true, preview: null, applied: null });
    }
    const report = await applyFinalFormsReconciliation(plan);
    return NextResponse.json({
      success: true,
      noSnapshot: false,
      preview: summarizePlan(plan),
      applied: summarizeApplied(plan, report),
    });
  } catch (error) {
    return errorResponse('Error applying Seed Signups from Final Forms:', error);
  }
}
