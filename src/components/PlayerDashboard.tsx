"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SignupRecord } from '@/lib/signups-sheet'
import { SIGNUPS_COLUMNS } from '@/lib/signups-config'
import {
  isPlayerInfoComplete,
  isCaretakerInfoComplete,
  isCoachVolunteeringComplete,
  isOtherVolunteeringComplete,
  isPhotoComplete,
} from '@/lib/signup-checklist'
import { FinalFormsRow, FinalFormsStatus } from '@/components/FinalFormsRow'

function ChecklistItem({ label, done, anchor }: { label: string; done: boolean; anchor: string }) {
  return (
    <li>
      <a href={`#${anchor}`} className="flex items-center justify-between gap-2 py-1.5" style={{ color: 'var(--primary-text)' }}>
        <span className="flex items-center gap-2">
          <span aria-hidden="true">{done ? '✅' : '⭕'}</span>
          <span className="underline">{label}</span>
        </span>
        <span className="text-xs" style={{ color: 'var(--secondary-text)' }}>{done ? 'Done' : 'Not done'}</span>
      </a>
    </li>
  )
}

/**
 * Top-level signup status: a checklist with jump links to each section (round 3), plus the
 * SPS Final Forms Status detail panel. Purely informational except where noted; saving the
 * profile form never requires any of this to be "done" (round 2 decision).
 */
export function PlayerDashboard({
  record,
  finalFormsRefreshSignal,
}: {
  record: SignupRecord
  finalFormsRefreshSignal?: number
}) {
  const [finalFormsStatus, setFinalFormsStatus] = useState<FinalFormsStatus | null>(null)
  const finalFormsDone = Boolean(
    finalFormsStatus?.found &&
    finalFormsStatus.parentSigned &&
    finalFormsStatus.studentSigned &&
    finalFormsStatus.physicalCleared
  )

  return (
    <Card style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
      <CardHeader>
        <CardTitle style={{ color: 'var(--page-title)' }}>
          {record[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]} {record[SIGNUPS_COLUMNS.LAST_NAME]}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-0.5">
          <ChecklistItem label="SPS Final Forms Status" done={finalFormsDone} anchor="final-forms" />
          <ChecklistItem label="Player Info" done={isPlayerInfoComplete(record)} anchor="player-info" />
          <ChecklistItem label="Photo Upload" done={isPhotoComplete(record)} anchor="photo-upload" />
          <ChecklistItem label="Caretaker Info" done={isCaretakerInfoComplete(record)} anchor="caretaker-info" />
          <ChecklistItem label="Coach Volunteering" done={isCoachVolunteeringComplete(record)} anchor="coach-volunteering" />
          <ChecklistItem label="Other Volunteering" done={isOtherVolunteeringComplete(record)} anchor="other-volunteering" />
        </ul>

        <div id="final-forms" className="border-t pt-4 scroll-mt-4" style={{ borderColor: 'var(--border)' }}>
          <h4 className="font-semibold mb-2" style={{ color: 'var(--secondary-header)' }}>SPS Final Forms Status</h4>
          <div style={{ color: 'var(--primary-text)' }}>
            <FinalFormsRow
              preferredFirstName={record[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]}
              playerId={record[SIGNUPS_COLUMNS.PLAYER_ID]}
              refreshSignal={finalFormsRefreshSignal}
              onStatusChange={setFinalFormsStatus}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
