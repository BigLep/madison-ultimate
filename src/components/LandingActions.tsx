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
// and Sign Up stays as a secondary door (it shows the closed copy and the coach email).
export function LandingActions() {
  const portalSeason = getSeasonPhase() === 'portal'

  const signUp = (
    <Button asChild size="lg" className={portalSeason ? secondaryButtonClass : primaryButtonClass} style={portalSeason ? secondaryButtonStyle : primaryButtonStyle}>
      <Link href="/signup">🏁 Sign Up</Link>
    </Button>
  )
  const portal = (
    <Button asChild size="lg" className={portalSeason ? primaryButtonClass : secondaryButtonClass} style={portalSeason ? primaryButtonStyle : secondaryButtonStyle}>
      <Link href="/player">🥏 Player Portal</Link>
    </Button>
  )

  return portalSeason ? (
    <>
      {portal}
      {signUp}
    </>
  ) : (
    <>
      {signUp}
      {portal}
    </>
  )
}
