"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SignupRecord } from '@/lib/signups-sheet'
import { SIGNUPS_COLUMNS } from '@/lib/signups-config'
import { isProfileComplete, missingRequiredFields } from '@/lib/signup-form-schema'
import { MailingListRow } from '@/components/MailingListRow'
import { PhotoUpload } from '@/components/PhotoUpload'
import { FinalFormsRow } from '@/components/FinalFormsRow'

function DashboardRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t pt-4 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--border)' }}>
      <h4 className="font-semibold mb-2" style={{ color: 'var(--secondary-header)' }}>{title}</h4>
      <div style={{ color: 'var(--primary-text)' }}>{children}</div>
    </div>
  )
}

/**
 * Status summary shown above the always-editable profile form (round 2: save no longer
 * requires completeness, so this is purely informational, not a gate on anything).
 */
export function PlayerDashboard({
  record,
  onPhotoUploaded,
  finalFormsRefreshSignal,
}: {
  record: SignupRecord
  onPhotoUploaded: () => void
  finalFormsRefreshSignal?: number
}) {
  const hasPhoto = Boolean(record[SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID])
  const complete = isProfileComplete(record)
  const missing = missingRequiredFields(record)

  return (
    <Card style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
      <CardHeader>
        <CardTitle style={{ color: 'var(--page-title)' }}>
          {record[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]} {record[SIGNUPS_COLUMNS.LAST_NAME]}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <DashboardRow title="Final Forms">
          <FinalFormsRow
            preferredFirstName={record[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]}
            playerId={record[SIGNUPS_COLUMNS.PLAYER_ID]}
            refreshSignal={finalFormsRefreshSignal}
          />
        </DashboardRow>

        <DashboardRow title="Profile">
          <span>{complete ? 'Complete' : `Missing: ${missing.join(', ')}`}</span>
        </DashboardRow>

        <DashboardRow title="Photo">
          <PhotoUpload playerId={record[SIGNUPS_COLUMNS.PLAYER_ID]} hasPhoto={hasPhoto} onUploaded={onPhotoUploaded} />
        </DashboardRow>

        <DashboardRow title="Mailing list">
          <MailingListRow playerId={record[SIGNUPS_COLUMNS.PLAYER_ID]} />
        </DashboardRow>
      </CardContent>
    </Card>
  )
}
