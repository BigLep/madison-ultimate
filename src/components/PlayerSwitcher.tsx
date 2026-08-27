"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getRememberedPlayers, forgetPlayer, RememberedPlayer } from '@/lib/player-switcher'

export function PlayerSwitcher({ currentPlayerId }: { currentPlayerId: string }) {
  const [players, setPlayers] = useState<RememberedPlayer[]>([])
  const router = useRouter()

  useEffect(() => {
    setPlayers(getRememberedPlayers())
  }, [currentPlayerId])

  const others = players.filter(p => p.playerId !== currentPlayerId)

  if (others.length === 0) {
    return (
      <a href="/signup" className="text-sm underline" style={{ color: 'var(--accent)' }}>
        Not this player?
      </a>
    )
  }

  return (
    <div className="text-sm space-y-2">
      <div className="font-semibold" style={{ color: 'var(--secondary-header)' }}>
        Switch player
      </div>
      <ul className="space-y-1">
        {others.map(player => (
          <li key={player.playerId} className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="underline text-left py-2 pr-1 -my-2"
              style={{ color: 'var(--accent)' }}
              onClick={() => router.push(`/player/${player.playerId}`)}
            >
              {player.displayName}
            </button>
            <button
              type="button"
              className="text-xs py-2 px-1 -my-2"
              style={{ color: 'var(--secondary-text)' }}
              onClick={() => {
                forgetPlayer(player.playerId)
                setPlayers(getRememberedPlayers())
              }}
            >
              remove
            </button>
          </li>
        ))}
      </ul>
      <a href="/signup" className="underline" style={{ color: 'var(--accent)' }}>
        Not this player?
      </a>
    </div>
  )
}
