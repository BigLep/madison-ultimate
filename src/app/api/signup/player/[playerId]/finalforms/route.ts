import { NextRequest, NextResponse } from 'next/server';
import { findSignupByPlayerId, updateSignupRow } from '../../../../../../lib/signups-sheet';
import { SIGNUPS_COLUMNS } from '../../../../../../lib/signups-config';
import { findFinalFormsMatch, seededFieldsFromFinalForms } from '../../../../../../lib/final-forms';

export async function GET(request: NextRequest, { params }: { params: Promise<{ playerId: string }> }) {
  try {
    const { playerId } = await params;
    const existing = await findSignupByPlayerId(playerId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    const match = await findFinalFormsMatch(existing.record);
    if (!match) {
      return NextResponse.json({ success: true, found: false });
    }

    // spsStudentId is authoritative once set: write it back only the first time we join (never
    // overwrite), and never for a magic-name test fixture.
    if (!match.isTest && !existing.record[SIGNUPS_COLUMNS.SPS_STUDENT_ID] && match.record.studentId) {
      await updateSignupRow(playerId, { [SIGNUPS_COLUMNS.SPS_STUDENT_ID]: match.record.studentId });
    }

    // Seeded fields (spec: "use it or enter something different") are offered only while the
    // signup row's own field is still empty; once saved (from a seed or typed), the row owns it.
    const allSeeded = seededFieldsFromFinalForms(match.record);
    const seedableColumns: Record<keyof typeof allSeeded, string> = {
      grade: SIGNUPS_COLUMNS.GRADE,
      studentPersonalEmail: SIGNUPS_COLUMNS.STUDENT_PERSONAL_EMAIL,
      studentSpsEmail: SIGNUPS_COLUMNS.STUDENT_SPS_EMAIL,
      studentCellPhone: SIGNUPS_COLUMNS.STUDENT_CELL_PHONE,
      caretaker1Name: SIGNUPS_COLUMNS.CARETAKER_1_NAME,
      caretaker1Email: SIGNUPS_COLUMNS.CARETAKER_1_EMAIL,
      caretaker1Phone: SIGNUPS_COLUMNS.CARETAKER_1_PHONE,
      caretaker2Name: SIGNUPS_COLUMNS.CARETAKER_2_NAME,
      caretaker2Email: SIGNUPS_COLUMNS.CARETAKER_2_EMAIL,
      caretaker2Phone: SIGNUPS_COLUMNS.CARETAKER_2_PHONE,
    };
    const seeded: Record<string, string> = {};
    for (const [field, value] of Object.entries(allSeeded)) {
      const column = seedableColumns[field as keyof typeof allSeeded];
      if (value && !existing.record[column]) {
        seeded[field] = value;
      }
    }

    return NextResponse.json({
      success: true,
      found: true,
      dataAsOf: match.dataAsOf,
      parentSigned: match.record.parentSigned,
      studentSigned: match.record.studentSigned,
      physicalCleared: match.record.physicalCleared,
      physicalClearanceExpiration: match.record.physicalClearanceExpiration,
      seeded,
    });
  } catch (error) {
    console.error('Error fetching Final Forms status:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
