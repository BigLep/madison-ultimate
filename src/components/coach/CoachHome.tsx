'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Home, User, Calendar, LogOut } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { BottomTabNav, BottomTabItem } from '@/components/portal/PortalNav'
import { getRememberedCoachId, forgetCoach } from '@/lib/coach-session'
import type { CoachProfile as CoachProfileData } from '@/lib/coaches-table'
import type { CoachLink } from '@/lib/coach-links'
import { CoachProfile } from './CoachProfile'
import { CoachAvailabilityTab } from './CoachAvailabilityTab'

// Coach Home (CONTEXT.md) at /coach: the remembered coach's page, with Home (key links and Coach
// Tools), Me (photo, contact, About), and Availability tabs. The device remembers which coach it
// is (coach-session.ts); with no remembered coach, it goes to Coach Login.

type CoachScreen = 'home' | 'me' | 'availability'

const NAV_ITEMS: Array<BottomTabItem<CoachScreen>> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'me', label: 'Me', icon: User },
  { id: 'availability', label: 'Availability', icon: Calendar },
]

const HASHES: Record<CoachScreen, string> = { home: '#home', me: '#me', availability: '#availability' }

export interface CoachTool {
  href: string
  icon: string
  title: string
  description: string
}

const cardStyle = { background: 'var(--card-bg)', borderColor: 'var(--border)' } as const

export function CoachHome({ links, tools, availabilitySheetUrl }: { links: CoachLink[]; tools: CoachTool[]; availabilitySheetUrl: string | null }) {
  const router = useRouter()
  const [coach, setCoach] = useState<CoachProfileData | null>(null)
  const [error, setError] = useState('')
  const [screen, setScreen] = useState<CoachScreen>('home')

  useEffect(() => {
    const fromHash = (Object.keys(HASHES) as CoachScreen[]).find(s => HASHES[s] === window.location.hash)
    if (fromHash) setScreen(fromHash)

    const coachId = getRememberedCoachId()
    if (!coachId) {
      router.replace('/coach/login?next=/coach')
      return
    }
    fetch(`/api/coach/coaches/${coachId}`)
      .then(async res => {
        const body = await res.json()
        if (res.status === 404) {
          // Removed from the Coaches tab since this device logged in.
          forgetCoach()
          router.replace('/coach/login?next=/coach')
          return
        }
        if (!body.success) setError(body.error || 'Could not load your coach info.')
        else setCoach(body.coach)
      })
      .catch(() => setError('Network error. Please try again.'))
  }, [router])

  const changeScreen = (next: CoachScreen) => {
    window.location.hash = HASHES[next]
    setScreen(next)
    window.scrollTo({ top: 0 })
  }

  const logout = async () => {
    forgetCoach()
    await fetch('/api/coach/logout', { method: 'POST' }).catch(() => {})
    router.replace('/coach/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--primary-bg)' }}>
      <header className="border-b" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs" style={{ color: 'var(--secondary-text)' }}>
              Coach Tools
            </p>
            <h1 className="text-lg font-bold truncate" style={{ color: 'var(--page-title)' }}>
              {coach?.name || ' '}
            </h1>
          </div>
          <button type="button" onClick={logout} className="flex items-center gap-1 text-sm hyperlink shrink-0">
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Log out
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6">
        {error && <p style={{ color: 'var(--error-text, #f87171)' }}>{error}</p>}
        {!coach && !error && <p style={{ color: 'var(--secondary-text)' }}>Loading…</p>}
        {coach && screen === 'home' && <CoachHomeTab links={links} tools={tools} />}
        {coach && screen === 'me' && <CoachProfile coach={coach} onSaved={setCoach} />}
        {coach && screen === 'availability' && <CoachAvailabilityTab coachId={coach.coachId} availabilitySheetUrl={availabilitySheetUrl} />}
      </main>

      <BottomTabNav label="Coach Home" items={NAV_ITEMS} active={screen} onChange={changeScreen} />
    </div>
  )
}

function LinkCard({ href, icon, title, description, external }: CoachTool & { external?: boolean }) {
  const content = (
    <Card className="shadow-lg transition-shadow hover:shadow-xl" style={cardStyle}>
      <CardContent className="p-4 flex items-center gap-4">
        <span className="text-3xl" aria-hidden="true">
          {icon}
        </span>
        <div>
          <h3 className="font-semibold text-lg" style={{ color: 'var(--secondary-header)' }}>
            {title}
          </h3>
          <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  )
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block">
      {content}
    </a>
  ) : (
    <Link href={href} className="block">
      {content}
    </Link>
  )
}

function CoachHomeTab({ links, tools }: { links: CoachLink[]; tools: CoachTool[] }) {
  return (
    <div className="space-y-6">
      {links.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--page-title)' }}>
            Key links
          </h2>
          {links.map(link => (
            <LinkCard key={link.href} {...link} external />
          ))}
        </section>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--page-title)' }}>
          Tools
        </h2>
        {tools.map(tool => (
          <LinkCard key={tool.href} {...tool} />
        ))}
      </section>
    </div>
  )
}
