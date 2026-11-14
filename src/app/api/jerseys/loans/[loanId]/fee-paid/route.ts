// Records that a Lost Jersey Fee was paid, on the date the Jersey Manager gives.

import { NextRequest, NextResponse } from 'next/server';
import { updateLoan } from '@/lib/jerseys-sheet';
import { feePaidError, cleanIsoDate } from '@/lib/jerseys';
import { LOAN_COLUMNS } from '@/lib/jerseys-config';
import { readWriteBody, jsonError, serverError } from '@/lib/jerseys-api';

export async function POST(request: NextRequest, { params }: { params: Promise<{ loanId: string }> }) {
  try {
    const { loanId } = await params;
    const parsed = await readWriteBody(request);
    if (parsed instanceof NextResponse) return parsed;
    const { body, by } = parsed;

    const paidOn = cleanIsoDate(body.paidOn);
    if (!paidOn) return jsonError('Paid date is required (YYYY-MM-DD).', 400);

    const result = await updateLoan(loanId, loan => {
      const error = feePaidError(loan);
      if (error) return { error };
      const note = `Fee marked paid by ${by}.`;
      return { cells: { [LOAN_COLUMNS.FEE_PAID_ON]: paidOn, [LOAN_COLUMNS.NOTES]: loan!.notes ? `${loan!.notes} ${note}` : note } };
    });
    if ('error' in result) return jsonError(result.error, 409);
    return NextResponse.json({ success: true, loan: result.loan });
  } catch (error) {
    return serverError('Error recording a fee payment', error);
  }
}
