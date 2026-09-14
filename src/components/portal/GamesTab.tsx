"use client"

import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { AvailabilityCard } from '@/components/availability-card'
import { AvailabilitySummary } from '@/components/availability-summary'
import { AvailabilityNotOpenNotice } from '@/components/portal/PracticesTab'

interface ExtraField {
  columnName: string
  label: string
  note: string
  value: string
  columnIndex: number
}

interface GameItem {
  gameKey: string
  gameLabel: string
  date: string
  location: string
  locationUrl?: string | null
  gameNote?: string
  isBye: boolean
  isPast: boolean
  formattedDate: string
  formattedWarmupTime: string
  formattedGameStart: string
  formattedDoneBy: string
  availability: {
    gameKey: string
    availability: string
    note: string
    activationStatus?: string
    extraFields?: ExtraField[]
  }
}

interface GameData {
  player: { fullName: string; playerId: string; team: string; teamDisplay: string }
  availabilityOpen: boolean
  games: GameItem[]
  availabilityOptions: Record<string, string>
}

const cardStyle = { background: 'var(--card-bg)', borderColor: 'var(--border)' } as const

export function GamesTab({ playerId }: { playerId: string }) {
  const [gameData, setGameData] = useState<GameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [gameSaveError, setGameSaveError] = useState<string | null>(null)

  useEffect(() => {
    const fetchGameData = async () => {
      try {
        const response = await fetch(`/api/player/${playerId}/game`)
        const data = await response.json()
        if (data.success) setGameData(data)
        else console.error('Failed to fetch game data:', data.error)
      } catch (error) {
        console.error('Error fetching game data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchGameData()
  }, [playerId])

  const post = async (body: Record<string, unknown>, gameKey: string, apply: (game: GameItem) => GameItem) => {
    setGameSaveError(null)
    setUpdating(gameKey)
    try {
      const response = await fetch(`/api/player/${playerId}/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (result.success) {
        setGameData(prev => (prev ? { ...prev, games: prev.games.map(game => (game.gameKey === gameKey ? apply(game) : game)) } : prev))
      } else {
        setGameSaveError(result.error || 'Failed to save. Please try again.')
      }
    } catch {
      setGameSaveError('Network error. Please try again.')
    } finally {
      setUpdating(null)
    }
  }

  const updateAvailability = (gameKey: string, availability: string, note: string) =>
    post({ gameKey, availability, note }, gameKey, game => ({
      ...game,
      availability: { ...game.availability, gameKey, availability, note },
    }))

  const updateExtraField = (game: GameItem, columnName: string, value: string) =>
    post(
      {
        gameKey: game.gameKey,
        availability: game.availability.availability,
        note: game.availability.note,
        extraFieldUpdates: { [columnName]: value },
      },
      game.gameKey,
      g => ({
        ...g,
        availability: {
          ...g.availability,
          extraFields: (g.availability.extraFields || []).map(f => (f.columnName === columnName ? { ...f, value } : f)),
        },
      })
    )

  if (loading) {
    return (
      <Card className="shadow-lg" style={cardStyle}>
        <CardContent className="text-center py-8">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: 'var(--secondary-text)' }} />
          <p style={{ color: 'var(--secondary-text)' }}>Loading game information...</p>
        </CardContent>
      </Card>
    )
  }

  if (!gameData) {
    return (
      <Card className="shadow-lg" style={cardStyle}>
        <CardContent className="text-center py-8">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: 'var(--secondary-text)' }} />
          <p style={{ color: 'var(--secondary-text)' }}>Unable to load game information.</p>
        </CardContent>
      </Card>
    )
  }

  const { games, availabilityOptions, player, availabilityOpen } = gameData
  const upcomingGames = games.filter(g => !g.isPast)
  const pastGames = games.filter(g => g.isPast)
  // Byes are shown but never counted
  const upcomingGamesForStats = upcomingGames.filter(g => !g.isBye)
  const pastGamesForStats = pastGames.filter(g => !g.isBye)
  const allUpcomingResponded =
    upcomingGamesForStats.length > 0 && upcomingGamesForStats.filter(g => !g.availability.availability).length === 0

  const renderCard = (game: GameItem, editable: boolean) => (
    <AvailabilityCard
      key={game.gameKey}
      title={game.isBye ? game.formattedDate : `${game.gameLabel}: ${game.formattedDate}`}
      subtitle={!game.isBye ? `Warmups: ${game.formattedWarmupTime} • Start: ${game.formattedGameStart} • Done: ${game.formattedDoneBy}` : ''}
      location={game.location}
      locationUrl={game.locationUrl}
      availabilityOptions={availabilityOptions}
      currentAvailability={game.availability.availability}
      currentNote={game.availability.note}
      onUpdateAvailability={(availability, note) => updateAvailability(game.gameKey, availability, note)}
      isUpdating={updating === game.gameKey}
      isEditable={editable}
      isBye={game.isBye}
      activationStatus={game.availability.activationStatus ?? ''}
      extraFields={game.availability.extraFields}
      onUpdateExtraField={editable ? (columnName, value) => updateExtraField(game, columnName, value) : undefined}
    >
      {game.gameNote && (
        <div className="text-xs italic mt-2" style={{ color: 'var(--secondary-text)' }}>
          Coach note: {game.gameNote}
        </div>
      )}
    </AvailabilityCard>
  )

  return (
    <div className="space-y-6">
      {!availabilityOpen && <AvailabilityNotOpenNotice />}

      {availabilityOpen && (upcomingGamesForStats.length > 0 || pastGamesForStats.length > 0) && (
        <AvailabilitySummary
          title={`${player.teamDisplay} Game Summary`}
          upcomingItems={upcomingGamesForStats}
          pastItems={pastGamesForStats}
          availabilityOptions={availabilityOptions}
          allUpcomingResponded={allUpcomingResponded}
        />
      )}

      {gameSaveError && (
        <Card className="border-red-500/50" style={cardStyle}>
          <CardContent className="py-3">
            <p className="text-sm text-red-600 dark:text-red-400">{gameSaveError}</p>
          </CardContent>
        </Card>
      )}

      {upcomingGames.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--page-title)' }}>
            Upcoming Games
          </h2>
          {upcomingGames.map(game => renderCard(game, availabilityOpen))}
        </div>
      )}

      {pastGames.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--page-title)' }}>
            Past Games
          </h2>
          {pastGames.map(game => renderCard(game, false))}
        </div>
      )}

      {games.length === 0 && (
        <Card className="shadow-lg" style={cardStyle}>
          <CardContent className="text-center py-8">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: 'var(--secondary-text)' }} />
            <p style={{ color: 'var(--secondary-text)' }}>No games scheduled for the {player.teamDisplay} yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
