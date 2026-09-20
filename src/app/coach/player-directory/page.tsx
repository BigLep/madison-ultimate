'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { PracticesTab } from '@/components/portal/PracticesTab'
import { GamesTab } from '@/components/portal/GamesTab'
import type { RosteredPlayerSummary, PlayerDirectoryEntry } from '@/lib/coach-directory'

const cardStyle = { background: 'var(--card-bg)', borderColor: 'var(--border)' } as const
const labelStyle = { color: 'var(--secondary-text)' }
const valueStyle = { color: 'var(--primary-text)' }

function Field({
  label,
  value,
  placeholder = 'Not provided',
  contact,
}: {
  label: string
  value: string
  placeholder?: string
  /** Renders the value as a tappable mailto:/tel: link, so a coach can start contact in one tap. */
  contact?: 'email' | 'tel'
}) {
  const text = value.trim()
  const href = contact === 'email' ? `mailto:${text}` : contact === 'tel' ? `tel:${text.replace(/[^\d+]/g, '')}` : undefined
  return (
    <div>
      <dt className="text-sm" style={labelStyle}>
        {label}
      </dt>
      <dd className={text ? 'font-medium' : 'italic'} style={text ? valueStyle : labelStyle}>
        {text && href ? (
          <a href={href} className="underline" style={{ color: 'var(--accent)' }}>
            {text}
          </a>
        ) : (
          text || placeholder
        )}
      </dd>
    </div>
  )
}

export default function PlayerDirectoryPage() {
  const [players, setPlayers] = useState<RosteredPlayerSummary[] | null>(null)
  const [playersError, setPlayersError] = useState<string | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [player, setPlayer] = useState<PlayerDirectoryEntry | null>(null)
  const [playerLoading, setPlayerLoading] = useState(false)
  const [playerError, setPlayerError] = useState<string | null>(null)

  // Bookmarkable: the selected player lives in the URL hash (#playerId), so a link to a
  // specific player can be sent to another coach.
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) setSelectedPlayerId(hash)
  }, [])

  const selectPlayer = (playerId: string) => {
    setSelectedPlayerId(playerId)
    const url = playerId ? `#${playerId}` : window.location.pathname + window.location.search
    window.history.replaceState(null, '', url)
  }

  useEffect(() => {
    fetch('/api/coach/players')
      .then(res => res.json())
      .then(data => {
        if (data.success) setPlayers(data.players)
        else setPlayersError(data.error || 'Failed to load players')
      })
      .catch(() => setPlayersError('Network error. Please try again.'))
  }, [])

  useEffect(() => {
    if (!selectedPlayerId) {
      setPlayer(null)
      return
    }
    setPlayerLoading(true)
    setPlayerError(null)
    fetch(`/api/coach/players/${selectedPlayerId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setPlayer(data.player)
        else setPlayerError(data.error || 'Failed to load player')
      })
      .catch(() => setPlayerError('Network error. Please try again.'))
      .finally(() => setPlayerLoading(false))
  }, [selectedPlayerId])

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Link href="/coach" className="text-sm underline" style={{ color: 'var(--accent)' }}>
        ← Coach Tools
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-6" style={{ color: 'var(--page-title)' }}>
        Player Directory
      </h1>

      <label htmlFor="player-select" className="block text-sm mb-1" style={labelStyle}>
        Player
      </label>
      <select
        id="player-select"
        className="w-full h-11 rounded-md border px-3 text-base mb-6"
        style={{ borderColor: 'var(--border)', background: 'var(--card-bg)', color: 'var(--primary-text)' }}
        value={selectedPlayerId}
        onChange={e => selectPlayer(e.target.value)}
      >
        <option value="">
          {players === null ? 'Loading players…' : players.length === 0 ? 'No rostered players found' : 'Select a player…'}
        </option>
        {players?.map(p => (
          <option key={p.playerId} value={p.playerId}>
            {p.fullName}
          </option>
        ))}
      </select>

      {playersError && (
        <p className="text-sm mb-4" style={{ color: 'var(--error-text, #f87171)' }}>
          {playersError}
        </p>
      )}

      {playerLoading && (
        <Card className="shadow-lg" style={cardStyle}>
          <CardContent className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p style={labelStyle}>Loading player…</p>
          </CardContent>
        </Card>
      )}

      {playerError && !playerLoading && (
        <Card className="shadow-lg" style={cardStyle}>
          <CardContent className="text-center py-8">
            <p style={{ color: 'var(--error-text, #f87171)' }}>{playerError}</p>
          </CardContent>
        </Card>
      )}

      {player && !playerLoading && (
        <div className="space-y-6">
          <Card className="shadow-lg" style={cardStyle}>
            <CardContent className="pt-6">
              <div className="flex gap-4 items-start mb-4">
                {player.hasPhoto ? (
                  <img
                    src={`/api/signup/player/${player.playerId}/photo`}
                    alt={`${player.fullName} photo`}
                    className="h-28 w-28 rounded-lg object-cover border shrink-0"
                    style={{ borderColor: 'var(--border)' }}
                  />
                ) : (
                  <div
                    className="h-28 w-28 rounded-lg border flex items-center justify-center text-sm italic shrink-0"
                    style={{ borderColor: 'var(--border)', color: 'var(--secondary-text)' }}
                  >
                    No photo
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--page-title)' }}>
                    {player.fullName}
                  </h2>
                  <p style={labelStyle}>{player.team}</p>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field label="Grade" value={player.grade} />
                <Field label="Gender" value={player.gender} />
                <Field label="Allergies / medical" value={player.allergies} placeholder="None listed" />
              </dl>
            </CardContent>
          </Card>

          <Card className="shadow-lg" style={cardStyle}>
            <CardContent className="pt-6 space-y-3">
              <h3 className="font-semibold text-lg" style={{ color: 'var(--secondary-header)' }}>
                📞 Player contact
              </h3>
              <dl className="space-y-3">
                <Field label="Email" value={player.studentEmail} contact="email" />
                <Field label="Phone" value={player.studentPhone} contact="tel" />
              </dl>
            </CardContent>
          </Card>

          <Card className="shadow-lg" style={cardStyle}>
            <CardContent className="pt-6 space-y-3">
              <h3 className="font-semibold text-lg" style={{ color: 'var(--secondary-header)' }}>
                👪 Caretakers (emergency contacts)
              </h3>
              {player.caretakers.length === 0 && (
                <p className="italic" style={labelStyle}>
                  None listed
                </p>
              )}
              {player.caretakers.map((c, i) => (
                <dl key={i} className="space-y-3 pb-3 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                  <Field label={`Caretaker ${i + 1} name`} value={c.name} />
                  <Field label="Email" value={c.email} contact="email" />
                  <Field label="Phone" value={c.phone} contact="tel" />
                </dl>
              ))}
            </CardContent>
          </Card>

          <div>
            <h3 className="font-semibold text-lg mb-3" style={{ color: 'var(--secondary-header)' }}>
              🗓️ Practice availability
            </h3>
            <PracticesTab playerId={player.playerId} readOnly />
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3" style={{ color: 'var(--secondary-header)' }}>
              🏆 Game availability
            </h3>
            <GamesTab playerId={player.playerId} readOnly />
          </div>
        </div>
      )}
    </div>
  )
}
