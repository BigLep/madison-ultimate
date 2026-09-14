"use client"

import { forwardRef, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Home } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getRememberedPlayers, forgetPlayer, RememberedPlayer } from '@/lib/player-switcher'
import { anotherPlayerLink, getSeasonPhase } from '@/lib/signup-deadlines'

function initials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function Avatar({ displayName, size }: { displayName: string; size: 'sm' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-9 w-9 text-sm' : 'h-8 w-8 text-xs'
  return (
    <span
      className={`${sizeClass} shrink-0 rounded-full flex items-center justify-center font-semibold`}
      style={{ background: 'var(--accent)', color: 'var(--card-bg)' }}
      aria-hidden="true"
    >
      {initials(displayName)}
    </span>
  )
}

const RemoveButton = forwardRef<
  HTMLButtonElement,
  { isPending: boolean; label: string; onClick: () => void; className?: string }
>(function RemoveButton({ isPending, label, onClick, className = '' }, ref) {
  return (
    <Button
      ref={ref}
      type="button"
      size="sm"
      variant="outline"
      aria-label={label}
      className={`min-h-[44px] whitespace-nowrap ${isPending ? 'border-red-600 text-red-600 hover:text-red-600' : ''} ${className}`}
      onClick={onClick}
    >
      {isPending ? 'Confirm?' : 'Remove'}
    </Button>
  )
})

// A pending "Confirm?" reverts to "Remove" on any click that isn't the pending button itself,
// so an accidental first tap can't sit armed indefinitely.
function useRevertPendingOnOutsideClick(pending: boolean, onRevert: () => void) {
  const ref = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (!pending) return
    const handlePointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onRevert()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [pending, onRevert])
  return ref
}

// bordered rows with a chevron are the /signup and /player "Your players" treatment (more visual
// weight since it's a primary page choice, not just a menu); the portal header menu keeps plain rows.
function PlayerList({
  players,
  onSwitch,
  onRemove,
  confirmRemove = false,
  bordered = false,
}: {
  players: RememberedPlayer[]
  onSwitch: (playerId: string) => void
  onRemove: (playerId: string) => void
  confirmRemove?: boolean
  bordered?: boolean
}) {
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)
  const pendingButtonRef = useRevertPendingOnOutsideClick(pendingRemoveId !== null, () => setPendingRemoveId(null))

  const handleRemoveClick = (playerId: string) => {
    if (!confirmRemove || pendingRemoveId === playerId) {
      onRemove(playerId)
      setPendingRemoveId(null)
      return
    }
    setPendingRemoveId(playerId)
  }

  return (
    <ul className={bordered ? 'space-y-1.5 px-4' : undefined}>
      {players.map(player => {
        const isPending = pendingRemoveId === player.playerId
        return (
          <li key={player.playerId} className="flex items-center gap-2">
            {bordered ? (
              <button
                type="button"
                className="flex-1 min-w-0 min-h-[44px] flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:bg-white/5 active:bg-white/10"
                style={{ borderColor: 'var(--border)' }}
                onClick={() => onSwitch(player.playerId)}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Avatar displayName={player.displayName} size="sm" />
                  <span className="truncate" style={{ color: 'var(--primary-text)' }}>{player.displayName}</span>
                </span>
                <span aria-hidden="true" style={{ color: 'var(--secondary-text)' }}>
                  ›
                </span>
              </button>
            ) : (
              <button
                type="button"
                className="flex-1 min-w-0 min-h-[44px] flex items-center gap-3 rounded-md px-4 py-2 text-left transition-colors hover:bg-white/5 active:bg-white/10"
                onClick={() => onSwitch(player.playerId)}
              >
                <Avatar displayName={player.displayName} size="sm" />
                <span className="truncate" style={{ color: 'var(--primary-text)' }}>{player.displayName}</span>
              </button>
            )}
            <RemoveButton
              ref={isPending ? pendingButtonRef : undefined}
              isPending={isPending}
              label={
                isPending
                  ? `Confirm removing ${player.displayName} from this device`
                  : `Remove ${player.displayName} from this device`
              }
              onClick={() => handleRemoveClick(player.playerId)}
              className={bordered ? '' : 'mr-4'}
            />
          </li>
        )
      })}
    </ul>
  )
}

type PlayerSwitcherProps =
  | {
      variant: 'header'
      currentPlayerId: string
      /** Second line under the name, e.g. "🟦 Blue | Grade 7" (docs/fall-2026/player-portal-grill.md Q8). */
      subtitle?: string
      refreshKey?: string | number
    }
  | { variant: 'chooser'; dimmed?: boolean }

// Placement and behavior settled in docs/fall-2026/player-switcher-grill.md (2026-08-29) and
// player-portal-grill.md Q8/Q14/Q20 (2026-09-14): one component, rendered as the Player Portal's
// sticky header (avatar, name, team and grade line; tap for the switcher menu) and as a
// "Your players" chooser on /signup and /player, all reading/writing the same device-local
// mu_signup_players list. The menu's "another player" entry follows the season phase.
export function PlayerSwitcher(props: PlayerSwitcherProps) {
  const [players, setPlayers] = useState<RememberedPlayer[]>([])
  const [open, setOpen] = useState(false)
  const [confirmRemoveCurrent, setConfirmRemoveCurrent] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const currentRemoveButtonRef = useRevertPendingOnOutsideClick(confirmRemoveCurrent, () => setConfirmRemoveCurrent(false))
  const another = anotherPlayerLink(getSeasonPhase())

  useEffect(() => {
    if (!open) setConfirmRemoveCurrent(false)
  }, [open])

  const effectKey = props.variant === 'header' ? `${props.currentPlayerId}:${props.refreshKey ?? ''}` : 'chooser'
  useEffect(() => {
    setPlayers(getRememberedPlayers())
  }, [effectKey])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleSwitch = (playerId: string) => {
    setOpen(false)
    router.push(`/player/${playerId}`)
  }
  const handleRemove = (playerId: string) => {
    forgetPlayer(playerId)
    setPlayers(getRememberedPlayers())
  }
  const handleRemoveCurrentClick = () => {
    if (props.variant !== 'header') return
    if (!confirmRemoveCurrent) {
      setConfirmRemoveCurrent(true)
      return
    }
    forgetPlayer(props.currentPlayerId)
    router.push(another.href)
  }

  if (props.variant === 'chooser') {
    if (players.length === 0) return null
    return (
      <Card style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
        <CardContent
          className={`py-2 text-sm transition-opacity ${props.dimmed ? 'opacity-50' : 'opacity-100'}`}
        >
          <div className="font-semibold px-4 pt-3 pb-1" style={{ color: 'var(--secondary-header)' }}>
            Your players
          </div>
          <PlayerList players={players} onSwitch={handleSwitch} onRemove={handleRemove} confirmRemove bordered />
        </CardContent>
      </Card>
    )
  }

  const current = players.find(p => p.playerId === props.currentPlayerId)
  const others = players.filter(p => p.playerId !== props.currentPlayerId)

  return (
    <header className="sticky top-0 z-30 w-full border-b" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
      <div className="max-w-2xl mx-auto px-4 py-2 flex items-center gap-2">
        <Link
          href="/"
          aria-label="Home"
          className="flex items-center justify-center h-8 w-8 shrink-0 rounded-full transition-colors hover:bg-white/5 active:bg-white/10"
          style={{ color: 'var(--secondary-text)' }}
        >
          <Home className="h-4 w-4" aria-hidden="true" />
        </Link>
        <div ref={containerRef} className="relative min-w-0 flex-1">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={current ? `Player menu for ${current.displayName}` : 'Player menu'}
            className="flex items-center gap-2 max-w-full min-h-[44px] rounded-full border pl-1 pr-3 py-1"
            style={{ borderColor: 'var(--border)', background: 'var(--primary-bg)' }}
            onClick={() => setOpen(o => !o)}
          >
            <Avatar displayName={current?.displayName ?? '?'} size="sm" />
            <span className="min-w-0 text-left">
              <span className="block font-semibold text-sm truncate" style={{ color: 'var(--page-title)' }}>
                {current?.displayName ?? 'Switch player'}
              </span>
              {props.subtitle && (
                <span className="block text-xs truncate" style={{ color: 'var(--secondary-text)' }}>
                  {props.subtitle}
                </span>
              )}
            </span>
            <span aria-hidden="true" className="text-xs shrink-0" style={{ color: 'var(--secondary-text)' }}>
              {open ? '▲' : '▼'}
            </span>
          </button>

          {open && (
            <div
              role="menu"
              className="absolute left-0 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-lg border shadow-lg py-2 text-sm"
              style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <Avatar displayName={current?.displayName ?? '?'} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold" style={{ color: 'var(--primary-text)' }}>
                    {current?.displayName ?? 'This player'}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--secondary-text)' }}>
                    Viewing this player
                  </div>
                </div>
                {current && (
                  <RemoveButton
                    ref={currentRemoveButtonRef}
                    isPending={confirmRemoveCurrent}
                    label={
                      confirmRemoveCurrent
                        ? `Confirm removing ${current.displayName} from this device`
                        : `Remove ${current.displayName} from this device`
                    }
                    onClick={handleRemoveCurrentClick}
                  />
                )}
              </div>

              <div className="border-t my-1" style={{ borderColor: 'var(--border)' }} />

              {others.length > 0 && (
                <>
                  <PlayerList players={others} onSwitch={handleSwitch} onRemove={handleRemove} confirmRemove />
                  <div className="border-t my-1" style={{ borderColor: 'var(--border)' }} />
                </>
              )}

              <a
                href={another.href}
                role="menuitem"
                className="flex items-center gap-3 min-h-[44px] px-4 py-2 underline transition-colors hover:bg-white/5 active:bg-white/10"
                style={{ color: 'var(--accent)' }}
              >
                <span
                  className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center border border-dashed text-sm"
                  style={{ borderColor: 'var(--accent)' }}
                  aria-hidden="true"
                >
                  +
                </span>
                {another.label}
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
