"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SignupRecord } from '@/lib/signups-sheet'
import { SIGNUPS_COLUMNS } from '@/lib/signups-config'
import {
  isPlayerInfoComplete,
  isCaretakerInfoComplete,
  isCoachVolunteeringComplete,
  isOtherVolunteeringComplete,
  isPhotoComplete,
  isFinalFormsComplete,
  isChecklistComplete,
} from '@/lib/signup-checklist'
import { FinalFormsRow, FinalFormsStatus } from '@/components/FinalFormsRow'

function ChecklistItem({ label, done, anchor }: { label: string; done: boolean; anchor: string }) {
  return (
    <li>
      <a href={`#${anchor}`} className="flex items-center justify-between gap-2 py-1.5" style={{ color: 'var(--primary-text)' }}>
        <span className="flex items-center gap-2">
          <span aria-hidden="true">{done ? '✅' : '❌'}</span>
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
 *
 * Once every row is done (Checklist Complete) the card collapses to a single "Signup Status ✅"
 * row a family can tap to expand (docs/fall-2026/player-portal-grill.md Q19). The panel stays
 * mounted while collapsed so the Final Forms status keeps refreshing; if a row later stops being
 * done (a physical expires, a required field is cleared) the card comes back expanded on its own.
 */
export function PlayerDashboard({
  record,
  finalFormsRefreshSignal,
  onFinalFormsStatusChange,
}: {
  record: SignupRecord
  finalFormsRefreshSignal?: number
  /** Lets the Player Portal derive Checklist Complete for the deadline banner (grill Q23). */
  onFinalFormsStatusChange?: (status: FinalFormsStatus | null) => void
}) {
  const [finalFormsStatus, setFinalFormsStatus] = useState<FinalFormsStatus | null>(null)
  const [manuallyExpanded, setManuallyExpanded] = useState(false)
  const finalFormsDone = isFinalFormsComplete(finalFormsStatus)
  const complete = isChecklistComplete(record, finalFormsStatus)
  const expanded = !complete || manuallyExpanded

  useEffect(() => {
    onFinalFormsStatusChange?.(finalFormsStatus)
  }, [finalFormsStatus, onFinalFormsStatusChange])

  return (
    <Card style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
      {complete ? (
        <button
          type="button"
          className="w-full min-h-[44px] flex items-center justify-between gap-2 px-6 py-4 text-left"
          aria-expanded={expanded}
          aria-controls="signup-status-details"
          onClick={() => setManuallyExpanded(v => !v)}
        >
          <span className="font-semibold text-lg" style={{ color: 'var(--page-title)' }}>
            Signup Status ✅
          </span>
          <span aria-hidden="true" className="text-xs" style={{ color: 'var(--secondary-text)' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </button>
      ) : (
        <CardHeader>
          <CardTitle style={{ color: 'var(--page-title)' }}>Signup Status</CardTitle>
        </CardHeader>
      )}
      <CardContent id="signup-status-details" className={`space-y-4 ${expanded ? '' : 'pb-0'}`} hidden={!expanded}>
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
