'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { PracticesTab } from '@/components/portal/PracticesTab'
import { GamesTab } from '@/components/portal/GamesTab'
import type { RosteredPlayerSummary, PlayerDirectoryEntry } from '@/lib/coach-directory'

const cardStyle = { background: 'var(--card-bg)', borderColor: 'var(--border)' } as const
const labelStyle = { color: 'var(--secondary-text)' }
const valueStyle = { color: 'var(--primary-text)' }

// A coach's team filter is a per-device convenience, not shared state, so it lives in
// localStorage rather than being synced anywhere (issue #1: "should persist between sessions").
const TEAM_FILTER_STORAGE_KEY = 'coach-player-directory-teams'

function loadStoredTeams(): string[] {
  try {
    const raw = window.localStorage.getItem(TEAM_FILTER_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : []
  } catch {
    return []
  }
}

function storeTeams(teams: string[]) {
  try {
    window.localStorage.setItem(TEAM_FILTER_STORAGE_KEY, JSON.stringify(teams))
  } catch {
    // Private browsing / blocked storage: filter just won't persist. Not worth surfacing.
  }
}

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

  const [nameFilter, setNameFilter] = useState('')
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [teamsLoaded, setTeamsLoaded] = useState(false)

  // Bookmarkable: the selected player lives in the URL hash (#playerId), so a link to a
  // specific player can be sent to another coach.
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) setSelectedPlayerId(hash)
    setSelectedTeams(loadStoredTeams())
    setTeamsLoaded(true)
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

  const teams = useMemo(() => {
    const seen = new Set(players?.map(p => p.team) ?? [])
    return Array.from(seen).sort((a, b) => a.localeCompare(b))
  }, [players])

  const toggleTeam = (team: string) => {
    const next = selectedTeams.includes(team) ? selectedTeams.filter(t => t !== team) : [...selectedTeams, team]
    setSelectedTeams(next)
    storeTeams(next)
  }

  const filteredPlayers = useMemo(() => {
    if (!players) return []
    const query = nameFilter.trim().toLowerCase()
    return players.filter(p => {
      const matchesTeam = selectedTeams.length === 0 || selectedTeams.includes(p.team)
      const matchesName = !query || p.fullName.toLowerCase().includes(query)
      return matchesTeam && matchesName
    })
  }, [players, nameFilter, selectedTeams])

  const showingList = !selectedPlayerId

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Link href="/coach" className="text-sm underline" style={{ color: 'var(--accent)' }}>
        ← Coach Tools
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-6" style={{ color: 'var(--page-title)' }}>
        Player Directory
      </h1>

      {showingList && (
        <div className="space-y-4 mb-6">
          {players === null && !playersError && <p style={labelStyle}>Loading players…</p>}

          {playersError && (
            <p className="text-sm" style={{ color: 'var(--error-text, #f87171)' }}>
              {playersError}
            </p>
          )}

          {players !== null && teamsLoaded && (
            <>
              {teams.length > 0 && (
                <fieldset>
                  <legend className="text-sm mb-2" style={labelStyle}>
                    Filter by team
                  </legend>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {teams.map(team => (
                      <label key={team} className="flex items-center gap-2 text-sm" style={valueStyle}>
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={selectedTeams.includes(team)}
                          onChange={() => toggleTeam(team)}
                        />
                        {team}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <input
                type="text"
                inputMode="search"
                placeholder="Filter by name…"
                value={nameFilter}
                onChange={e => setNameFilter(e.target.value)}
                className="w-full h-11 rounded-md border px-3 text-base"
                style={{ borderColor: 'var(--border)', background: 'var(--card-bg)', color: 'var(--primary-text)' }}
              />

              <Card className="shadow-lg" style={cardStyle}>
                <CardContent className="p-0">
                  {filteredPlayers.length === 0 ? (
                    <p className="p-4 text-sm italic" style={labelStyle}>
                      No players match.
                    </p>
                  ) : (
                    <ul>
                      {filteredPlayers.map((p, i) => (
                        <li key={p.playerId} className={i > 0 ? 'border-t' : ''} style={{ borderColor: 'var(--border)' }}>
                          <button
                            type="button"
                            onClick={() => selectPlayer(p.playerId)}
                            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left min-h-[44px]"
                          >
                            <span className="font-medium" style={valueStyle}>
                              {p.fullName}
                            </span>
                            <span className="text-sm" style={labelStyle}>
                              {p.team}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {!showingList && (
        <button type="button" onClick={() => selectPlayer('')} className="text-sm underline mb-4 block" style={{ color: 'var(--accent)' }}>
          ← Back to list
        </button>
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
