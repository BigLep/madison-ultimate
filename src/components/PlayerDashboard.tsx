"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SignupRecord } from '@/lib/signups-sheet'
import { SIGNUPS_COLUMNS } from '@/lib/signups-config'
import { MailingListRow } from '@/components/MailingListRow'
import { PhotoUpload } from '@/components/PhotoUpload'

function DashboardRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t pt-4 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--border)' }}>
      <h4 className="font-semibold mb-2" style={{ color: 'var(--secondary-header)' }}>{title}</h4>
      <div style={{ color: 'var(--primary-text)' }}>{children}</div>
    </div>
  )
}

export function PlayerDashboard({
  record,
  onEdit,
  onPhotoUploaded,
}: {
  record: SignupRecord
  onEdit: () => void
  onPhotoUploaded: () => void
}) {
  const hasPhoto = Boolean(record[SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID])

  return (
    <Card style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
      <CardHeader>
        <CardTitle style={{ color: 'var(--page-title)' }}>
          {record[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]} {record[SIGNUPS_COLUMNS.LAST_NAME]}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <DashboardRow title="Profile">
          <div className="flex items-center justify-between">
            <span>Complete</span>
            <button type="button" className="underline text-sm" style={{ color: 'var(--accent)' }} onClick={onEdit}>
              Edit
            </button>
          </div>
        </DashboardRow>

        <DashboardRow title="Final Forms">
          <p>
            We couldn&apos;t find {record[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME] || 'your player'} in the school&apos;s
            Final Forms registration yet. Two common reasons: (1) You haven&apos;t registered in Final Forms; start
            at{' '}
            <a href="https://seattleschools-wa.finalforms.com" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent)' }}>
              seattleschools-wa.finalforms.com
            </a>{' '}
            (a sports physical within the last 2 years is also required). (2) The name we have doesn&apos;t match
            school records; enter the last name and legal first name exactly as they appear in Final Forms above.
            Preferred name is what we&apos;ll actually use with your player. Having trouble inside Final Forms itself
            (login, forms, clearance)? Contact Madison&apos;s Athletic Director, Valerie McDonald, at{' '}
            <a href="mailto:vamcdonald@seattleschools.org" className="underline" style={{ color: 'var(--accent)' }}>
              vamcdonald@seattleschools.org
            </a>
            . Anything else:{' '}
            <a href="mailto:madisonultimate@gmail.com" className="underline" style={{ color: 'var(--accent)' }}>
              madisonultimate@gmail.com
            </a>
            .
          </p>
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
