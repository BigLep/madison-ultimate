"use client"

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getSeasonPhase } from '@/lib/signup-deadlines'

export const secondaryButtonClass = 'border font-semibold hover:opacity-90 transition-opacity'
export const secondaryButtonStyle = {
  backgroundColor: 'var(--card-bg)',
  borderColor: 'var(--border)',
  color: 'var(--primary-text)',
} as const

const primaryButtonClass = 'text-white font-semibold hover:opacity-90 transition-opacity'
const primaryButtonStyle = { background: 'var(--accent)' } as const

// Landing page actions follow the season phase (docs/fall-2026/player-portal-grill.md Q13, Q20):
// Sign Up leads while new signups can still be created; once they close, the Player Portal leads
// and Sign Up is greyed out with a "check back next season" hint. /signup itself stays reachable
// (it shows the closed copy and still finds existing players) via the Portal Login's not-found link.
export function LandingActions() {
  const portalSeason = getSeasonPhase() === 'portal'

  if (portalSeason) {
    return (
      <>
        <Button asChild size="lg" className={primaryButtonClass} style={primaryButtonStyle}>
          <Link href="/player">🥏 Player Portal</Link>
        </Button>
        <Button
          size="lg"
          disabled
          aria-disabled="true"
          title="Signups are closed for this season. Check back next season."
          className="font-semibold cursor-not-allowed opacity-60"
          style={secondaryButtonStyle}
        >
          🏁 Sign Up (closed)
        </Button>
      </>
    )
  }

  return (
    <>
      <Button asChild size="lg" className={primaryButtonClass} style={primaryButtonStyle}>
        <Link href="/signup">🏁 Sign Up</Link>
      </Button>
      <Button asChild size="lg" className={secondaryButtonClass} style={secondaryButtonStyle}>
        <Link href="/player">🥏 Player Portal</Link>
      </Button>
    </>
  )
}
