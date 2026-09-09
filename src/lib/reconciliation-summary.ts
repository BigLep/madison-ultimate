// The wire shape of a Seed Signups from Final Forms report (ADR 0006), shared by the admin route
// and the admin page so it is declared once. Pure: summarizePlan only reshapes a plan for display.

import { SIGNUPS_COLUMNS } from './signups-config';
import type { FinalFormsRecord, PossibleMatch, ReconciliationPlan, ReconciliationReport } from './final-forms';

export type StudentSummary = Pick<FinalFormsRecord, 'studentId' | 'firstName' | 'lastName' | 'grade' | 'dateOfBirth'>;

export interface PlanSummary {
  dataAsOf: string;
  seed: StudentSummary[];
  join: Array<StudentSummary & { playerId: string; preferredFirstName: string }>;
  ambiguous: Array<{ students: StudentSummary[]; playerIds: string[] }>;
  duplicateSignups: Array<StudentSummary & { playerIds: string[] }>;
  discrepancies: Array<StudentSummary & { playerId: string; storedStudentId: string }>;
  unseedable: Array<StudentSummary & { reason: string }>;
  unmatchedSignups: Array<{
    playerId: string;
    preferredFirstName: string;
    lastName: string;
    signupDateOfBirth: string;
    possibleMatches: PossibleMatch[];
  }>;
  skipped: number;
}

export interface AppliedRowSummary extends StudentSummary {
  playerId: string;
  subscribedEmails: string[];
  subscribeFailed: string[];
  photoCarriedOver: boolean;
}

export interface AppliedSummary {
  seeded: AppliedRowSummary[];
  joined: AppliedRowSummary[];
  recomputedProfileComplete: number;
  /** Total addresses across seeded and joined rows the newsletter did not take; the page warns when non-zero. */
  subscribeFailures: number;
}

export function studentSummary(record: FinalFormsRecord): StudentSummary {
  return {
    studentId: record.studentId,
    firstName: record.firstName,
    lastName: record.lastName,
    grade: record.grade,
    dateOfBirth: record.dateOfBirth,
  };
}

export function summarizePlan(plan: ReconciliationPlan): PlanSummary {
  const summary: PlanSummary = {
    dataAsOf: plan.dataAsOf,
    seed: [],
    join: [],
    ambiguous: [],
    duplicateSignups: [],
    discrepancies: [],
    unseedable: [],
    unmatchedSignups: [],
    skipped: 0,
  };
  for (const entry of plan.entries) {
    switch (entry.kind) {
      case 'skip':
        summary.skipped++;
        break;
      case 'seed':
        summary.seed.push(studentSummary(entry.record));
        break;
      case 'join':
        summary.join.push({
          ...studentSummary(entry.record),
          playerId: entry.playerId,
          preferredFirstName: entry.signup[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME] || '',
        });
        break;
      case 'ambiguous':
        summary.ambiguous.push({ students: entry.records.map(studentSummary), playerIds: entry.playerIds });
        break;
      case 'duplicate-signups':
        summary.duplicateSignups.push({ ...studentSummary(entry.record), playerIds: entry.playerIds });
        break;
      case 'discrepancy':
        summary.discrepancies.push({ ...studentSummary(entry.record), playerId: entry.playerId, storedStudentId: entry.storedStudentId });
        break;
      case 'unseedable':
        summary.unseedable.push({ ...studentSummary(entry.record), reason: entry.reason });
        break;
      case 'unmatched-signup':
        summary.unmatchedSignups.push({
          playerId: entry.playerId,
          preferredFirstName: entry.signup[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME] || '',
          lastName: entry.signup[SIGNUPS_COLUMNS.LAST_NAME] || '',
          signupDateOfBirth: entry.signup[SIGNUPS_COLUMNS.DATE_OF_BIRTH] || '',
          possibleMatches: entry.possibleMatches,
        });
        break;
    }
  }
  return summary;
}

/** Pair each written row with the student it was written for, so the Last Run list shows names, not only IDs. */
export function summarizeApplied(plan: ReconciliationPlan, report: ReconciliationReport): AppliedSummary {
  const byStudentId = new Map<string, FinalFormsRecord>();
  for (const entry of plan.entries) {
    if (entry.kind === 'seed' || entry.kind === 'join') byStudentId.set(entry.record.studentId, entry.record);
  }
  const row = (outcome: ReconciliationReport['seeded'][number]): AppliedRowSummary => {
    const record = byStudentId.get(outcome.studentId);
    return {
      ...(record ? studentSummary(record) : { studentId: outcome.studentId, firstName: '', lastName: '', grade: '', dateOfBirth: '' }),
      playerId: outcome.playerId,
      subscribedEmails: outcome.firstJoin.subscribedEmails,
      subscribeFailed: outcome.firstJoin.subscribeFailed,
      photoCarriedOver: outcome.firstJoin.photoCarriedOver,
    };
  };
  const seeded = report.seeded.map(row);
  const joined = report.joined.map(row);
  return {
    seeded,
    joined,
    recomputedProfileComplete: report.recomputedProfileComplete,
    subscribeFailures: [...seeded, ...joined].reduce((n, r) => n + r.subscribeFailed.length, 0),
  };
}
