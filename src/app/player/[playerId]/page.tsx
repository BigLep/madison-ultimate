"use client"

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PlayerSwitcher } from '@/components/PlayerSwitcher'
import { PlayerProfileForm } from '@/components/PlayerProfileForm'
import { PlayerDashboard } from '@/components/PlayerDashboard'
import { rememberPlayer } from '@/lib/player-switcher'
import { SignupRecord } from '@/lib/signups-sheet'
import { SIGNUPS_COLUMNS } from '@/lib/signups-config'
import { recordToFormValues, ProfileFormValues } from '@/lib/signup-form-schema'
import { DeadlineBanner } from '@/components/DeadlineBanner'

export default function PlayerPage() {
  const params = useParams<{ playerId: string }>()
  const playerId = params.playerId
  const [status, setStatus] = useState<'loading' | 'not-found' | 'ready'>('loading')
  const [record, setRecord] = useState<SignupRecord | null>(null)
  const [finalFormsRefreshSignal, setFinalFormsRefreshSignal] = useState(0)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/signup/player/${playerId}`)
      const data = await res.json()

      if (!res.ok || !data.success) {
        setStatus('not-found')
        return
      }

      let loaded: SignupRecord = data.record

      try {
        const ffRes = await fetch(`/api/signup/player/${playerId}/finalforms`)
        const ffData = await ffRes.json()
        if (ffRes.ok && ffData.success && ffData.found && (ffData.fieldsCopied || ffData.photoCarriedOver)) {
          const refreshed = await fetch(`/api/signup/player/${playerId}`)
          const refreshedData = await refreshed.json()
          if (refreshed.ok && refreshedData.success) loaded = refreshedData.record
        }
      } catch {
        // Final Forms is a convenience; the profile still works without it.
      }

      const displayName = `${loaded[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]} ${loaded[SIGNUPS_COLUMNS.LAST_NAME]}`.trim()
      rememberPlayer({ playerId, displayName })

      setRecord(loaded)
      setStatus('ready')
    } catch {
      setStatus('not-found')
    }
  }, [playerId])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async (values: ProfileFormValues) => {
    const res = await fetch(`/api/signup/player/${playerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Save failed');
    }
    setRecord(data.record)
    setFinalFormsRefreshSignal(n => n + 1)
  }

  return (
    <div className="min-h-screen p-4" style={{ background: 'var(--primary-bg)' }}>
      <div className="max-w-2xl mx-auto space-y-4">
        <DeadlineBanner />

        {status === 'loading' && (
          <Card style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
            <CardContent className="pt-6" style={{ color: 'var(--primary-text)' }}>
              Loading...
            </CardContent>
          </Card>
        )}

        {status === 'not-found' && (
          <Card style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
            <CardHeader>
              <CardTitle style={{ color: 'var(--page-title)' }}>Madison Ultimate</CardTitle>
            </CardHeader>
            <CardContent style={{ color: 'var(--primary-text)' }}>
              We couldn&apos;t find this player.{' '}
              <a href="/signup" className="underline" style={{ color: 'var(--accent)' }}>Start over</a>.
            </CardContent>
          </Card>
        )}

        {status === 'ready' && record && (
          <>
            <PlayerDashboard record={record} finalFormsRefreshSignal={finalFormsRefreshSignal} />

            <Card style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
              <CardHeader>
                <CardTitle style={{ color: 'var(--page-title)' }}>Player profile</CardTitle>
              </CardHeader>
              <CardContent>
                <PlayerProfileForm
                  playerId={playerId}
                  defaultValues={recordToFormValues(record)}
                  hasPhoto={Boolean(record[SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID])}
                  onPhotoUploaded={load}
                  refreshSignal={finalFormsRefreshSignal}
                  onSave={handleSave}
                />
              </CardContent>
            </Card>

            <PlayerSwitcher currentPlayerId={playerId} />
          </>
        )}
      </div>
    </div>
  )
}
