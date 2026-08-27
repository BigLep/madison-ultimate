"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SignupRecord } from '@/lib/signups-sheet'
import { SIGNUPS_COLUMNS } from '@/lib/signups-config'

function DashboardRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t pt-4 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--border)' }}>
      <h4 className="font-semibold mb-2" style={{ color: 'var(--secondary-header)' }}>{title}</h4>
      <div style={{ color: 'var(--primary-text)' }}>{children}</div>
    </div>
  )
}

export function PlayerDashboard({ record, onEdit }: { record: SignupRecord; onEdit: () => void }) {
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
      </CardContent>
    </Card>
  )
}
