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
import { recordToFormValues, isProfileComplete, ProfileFormValues } from '@/lib/signup-form-schema'

export default function PlayerPage() {
  const params = useParams<{ playerId: string }>()
  const playerId = params.playerId
  const [status, setStatus] = useState<'loading' | 'not-found' | 'form' | 'dashboard'>('loading')
  const [record, setRecord] = useState<SignupRecord | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/signup/player/${playerId}`)
      const data = await res.json()

      if (!res.ok || !data.success) {
        setStatus('not-found')
        return
      }

      const loaded: SignupRecord = data.record
      setRecord(loaded)

      const displayName = `${loaded[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]} ${loaded[SIGNUPS_COLUMNS.LAST_NAME]}`.trim()
      rememberPlayer({ playerId, displayName })

      setStatus(isProfileComplete(loaded) ? 'dashboard' : 'form')
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
    setStatus('dashboard')
  }

  return (
    <div className="min-h-screen p-4" style={{ background: 'var(--primary-bg)' }}>
      <div className="max-w-2xl mx-auto space-y-4">
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

        {status === 'form' && record && (
          <Card style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
            <CardHeader>
              <CardTitle style={{ color: 'var(--page-title)' }}>Player profile</CardTitle>
            </CardHeader>
            <CardContent>
              <PlayerProfileForm defaultValues={recordToFormValues(record)} onSave={handleSave} />
            </CardContent>
          </Card>
        )}

        {status === 'dashboard' && record && (
          <PlayerDashboard record={record} onEdit={() => setStatus('form')} onPhotoUploaded={load} />
        )}

        {status === 'dashboard' && <PlayerSwitcher currentPlayerId={playerId} />}
      </div>
    </div>
  )
}
