// Check-in (CONTEXT.md): ends a Jersey Loan as Returned (optionally in a different size than
// recorded) or Lost (optionally with a Lost Jersey Fee). The loan is re-read right before writing,
// so a jersey already checked in by another manager is refused instead of overwritten.

import { NextRequest, NextResponse } from 'next/server';
import { updateLoan } from '@/lib/jerseys-sheet';
import { checkInError, checkInCells, cleanFeeAmount, CheckInRequest } from '@/lib/jerseys';
import { LOAN_OUTCOMES } from '@/lib/jerseys-config';
import { readWriteBody, jsonError, serverError } from '@/lib/jerseys-api';

export async function POST(request: NextRequest, { params }: { params: Promise<{ loanId: string }> }) {
  try {
    const { loanId } = await params;
    const parsed = await readWriteBody(request);
    if (parsed instanceof NextResponse) return parsed;
    const { body, by } = parsed;

    let checkIn: CheckInRequest;
    if (body.outcome === LOAN_OUTCOMES.RETURNED) {
      const size = typeof body.size === 'string' && body.size.trim() ? body.size.trim().toUpperCase() : undefined;
      checkIn = { outcome: LOAN_OUTCOMES.RETURNED, size };
    } else if (body.outcome === LOAN_OUTCOMES.LOST) {
      const fee = cleanFeeAmount(body.fee);
      if (fee === null) return jsonError('Fee must be a dollar amount, like 25 or 25.50.', 400);
      checkIn = { outcome: LOAN_OUTCOMES.LOST, fee };
    } else {
      return jsonError('Outcome must be Returned or Lost.', 400);
    }

    const nowIso = new Date().toISOString();
    const result = await updateLoan(loanId, loan => {
      const error = checkInError(loan, checkIn);
      return error ? { error } : { cells: checkInCells(loan!, checkIn, by, nowIso) };
    });
    if ('error' in result) return jsonError(result.error, 409);
    return NextResponse.json({ success: true, loan: result.loan });
  } catch (error) {
    return serverError('Error checking in a jersey', error);
  }
}
