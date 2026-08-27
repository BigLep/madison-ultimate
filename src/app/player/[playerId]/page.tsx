"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PlayerSwitcher } from '@/components/PlayerSwitcher'
import { rememberPlayer } from '@/lib/player-switcher'

export default function PlayerPage() {
  const params = useParams<{ playerId: string }>()
  const playerId = params.playerId
  const [status, setStatus] = useState<'loading' | 'not-found' | 'ready'>('loading')
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/signup/player/${playerId}`)
        const data = await res.json()
        if (cancelled) return

        if (!res.ok || !data.success) {
          setStatus('not-found')
          return
        }

        const name = `${data.record['Preferred First Name']} ${data.record['Last Name']}`.trim()
        setDisplayName(name)
        rememberPlayer({ playerId, displayName: name })
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('not-found')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [playerId])

  return (
    <div className="min-h-screen p-4" style={{ background: 'var(--primary-bg)' }}>
      <div className="max-w-2xl mx-auto space-y-4">
        <Card style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
          <CardHeader>
            <CardTitle style={{ color: 'var(--page-title)' }}>
              {status === 'ready' ? displayName || 'Your player' : 'Madison Ultimate'}
            </CardTitle>
          </CardHeader>
          <CardContent style={{ color: 'var(--primary-text)' }}>
            {status === 'loading' && <p>Loading...</p>}
            {status === 'not-found' && (
              <p>
                We couldn&apos;t find this player. <a href="/signup" className="underline" style={{ color: 'var(--accent)' }}>Start over</a>.
              </p>
            )}
            {status === 'ready' && <p>Profile and status coming next.</p>}
          </CardContent>
        </Card>
        {status === 'ready' && <PlayerSwitcher currentPlayerId={playerId} />}
      </div>
    </div>
  )
}
