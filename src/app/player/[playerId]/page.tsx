"use client"

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PlayerSwitcher } from '@/components/PlayerSwitcher'
import { PlayerProfileForm } from '@/components/PlayerProfileForm'
import { PlayerProfileSummary, ProfileSectionId } from '@/components/PlayerProfileSummary'
import { PlayerDashboard } from '@/components/PlayerDashboard'
import { DeadlineBanner } from '@/components/DeadlineBanner'
import { SeededSignupBanner } from '@/components/SeededSignupBanner'
import { PWAInstallBanner } from '@/components/pwa-install-banner'
import { PortalHome } from '@/components/portal/PortalHome'
import { PortalNav, PortalScreen, HASH_TO_SCREEN, SCREEN_TO_HASH } from '@/components/portal/PortalNav'
import { PracticesTab } from '@/components/portal/PracticesTab'
import { GamesTab } from '@/components/portal/GamesTab'
import { usePortalPwa } from '@/components/portal/usePortalPwa'
import { FinalFormsStatus } from '@/components/FinalFormsRow'
import { rememberPlayer } from '@/lib/player-switcher'
import { SignupRecord } from '@/lib/signups-sheet'
import { SIGNUPS_COLUMNS } from '@/lib/signups-config'
import { recordToFormValues, ProfileFormValues } from '@/lib/signup-form-schema'
import { isChecklistComplete } from '@/lib/signup-checklist'
import { getDeadlineState } from '@/lib/signup-deadlines'
import { formatTeam } from '@/lib/team-display'

const cardStyle = { background: 'var(--card-bg)', borderColor: 'var(--border)' } as const

// The Player Portal (CONTEXT.md): one player's tabbed page for the whole season. Structure per
// docs/fall-2026/player-portal-grill.md Q8 (sticky switcher header, hash-routed tabs, bottom nav),
// Q9/Q15 (Player tab read-only view with per-section Edit, Save returns, Cancel discards),
// Q19 (Signup Status collapses once Checklist Complete) and Q23 (deadline banner rules).
export default function PlayerPortalPage() {
  const params = useParams<{ playerId: string }>()
  const playerId = params.playerId
  const [status, setStatus] = useState<'loading' | 'not-found' | 'ready'>('loading')
  const [record, setRecord] = useState<SignupRecord | null>(null)
  const [team, setTeam] = useState('')
  const [finalFormsStatus, setFinalFormsStatus] = useState<FinalFormsStatus | null>(null)
  const [finalFormsRefreshSignal, setFinalFormsRefreshSignal] = useState(0)
  const [screen, setScreen] = useState<PortalScreen>('home')
  const [editSection, setEditSection] = useState<ProfileSectionId | null>(null)

  // Hash routing: the URL hash is the source of truth for the active tab.
  useEffect(() => {
    const applyHash = () => {
      const next = HASH_TO_SCREEN[window.location.hash]
      if (next) setScreen(next)
    }
    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

  const changeScreen = (next: PortalScreen) => {
    window.location.hash = SCREEN_TO_HASH[next]
    setScreen(next)
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/signup/player/${playerId}`)
      const data = await res.json()

      if (!res.ok || !data.success) {
        setStatus('not-found')
        return
      }

      let loaded: SignupRecord = data.record
      let loadedTeam: string = data.team || ''

      try {
        const ffRes = await fetch(`/api/signup/player/${playerId}/finalforms`)
        const ffData = await ffRes.json()
        if (ffRes.ok && ffData.success && ffData.found && (ffData.fieldsCopied || ffData.photoCarriedOver)) {
          const refreshed = await fetch(`/api/signup/player/${playerId}`)
          const refreshedData = await refreshed.json()
          if (refreshed.ok && refreshedData.success) {
            loaded = refreshedData.record
            loadedTeam = refreshedData.team || loadedTeam
          }
        }
      } catch {
        // Final Forms is a convenience; the profile still works without it.
      }

      const displayName = `${loaded[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]} ${loaded[SIGNUPS_COLUMNS.LAST_NAME]}`.trim()
      rememberPlayer({ playerId, displayName })

      setRecord(loaded)
      setTeam(loadedTeam)
      setStatus('ready')
    } catch {
      setStatus('not-found')
    }
  }, [playerId])

  useEffect(() => {
    load()
  }, [load])

  const fullName = record ? `${record[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME]} ${record[SIGNUPS_COLUMNS.LAST_NAME]}`.trim() : null
  usePortalPwa(playerId, fullName)

  // Edit opens the full form scrolled to the section the family tapped (Q15).
  useEffect(() => {
    if (!editSection) return
    const target = document.getElementById(editSection)
    target?.scrollIntoView({ block: 'start' })
  }, [editSection])

  const handleSave = async (values: ProfileFormValues) => {
    const res = await fetch(`/api/signup/player/${playerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Save failed')
    }
    setRecord(data.record)
    if (typeof data.team === 'string') setTeam(data.team)
    setFinalFormsRefreshSignal(n => n + 1)
  }

  const leaveEdit = () => {
    setEditSection(null)
    window.scrollTo({ top: 0 })
  }

  const grade = record?.[SIGNUPS_COLUMNS.GRADE] || ''
  const subtitle = [formatTeam(team), grade ? `Grade ${grade}` : ''].filter(Boolean).join(' | ')
  const checklistComplete = record ? isChecklistComplete(record, finalFormsStatus) : false
  const showDeadlineBanner = !checklistComplete && getDeadlineState() !== 'closed'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--primary-bg)' }}>
      <PlayerSwitcher variant="header" currentPlayerId={playerId} subtitle={subtitle || undefined} refreshKey={status} />

      <main className="flex-1">
        <div className={`max-w-2xl mx-auto px-4 py-4 ${editSection ? 'pb-28' : 'pb-8'}`}>
          {status === 'loading' && (
            <Card style={cardStyle}>
              <CardContent className="pt-6" style={{ color: 'var(--primary-text)' }}>
                Loading...
              </CardContent>
            </Card>
          )}

          {status === 'not-found' && (
            <Card style={cardStyle}>
              <CardHeader>
                <CardTitle style={{ color: 'var(--page-title)' }}>Madison Ultimate</CardTitle>
              </CardHeader>
              <CardContent style={{ color: 'var(--primary-text)' }}>
                We couldn&apos;t find this player.{' '}
                <Link href="/player" className="underline" style={{ color: 'var(--accent)' }}>
                  Find your player
                </Link>
                .
              </CardContent>
            </Card>
          )}

          {status === 'ready' && record && (
            <>
              {screen === 'home' && <PortalHome />}

              {/* The Player tab stays mounted across tab switches so edits in progress survive (Q15). */}
              <div hidden={screen !== 'player'} className="space-y-4">
                {showDeadlineBanner && <DeadlineBanner />}
                <SeededSignupBanner record={record} />
                <PlayerDashboard
                  record={record}
                  finalFormsRefreshSignal={finalFormsRefreshSignal}
                  onFinalFormsStatusChange={setFinalFormsStatus}
                />

                <Card style={cardStyle}>
                  <CardHeader>
                    <CardTitle style={{ color: 'var(--page-title)' }}>{editSection ? 'Edit player profile' : 'Player profile'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {editSection ? (
                      <PlayerProfileForm
                        playerId={playerId}
                        defaultValues={recordToFormValues(record)}
                        hasPhoto={Boolean(record[SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID])}
                        onPhotoUploaded={load}
                        refreshSignal={finalFormsRefreshSignal}
                        onSave={handleSave}
                        onSaved={leaveEdit}
                        onCancel={leaveEdit}
                      />
                    ) : (
                      <PlayerProfileSummary
                        playerId={playerId}
                        record={record}
                        hasPhoto={Boolean(record[SIGNUPS_COLUMNS.PHOTO_DRIVE_FILE_ID])}
                        refreshSignal={finalFormsRefreshSignal}
                        onEdit={setEditSection}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>

              {screen === 'practices' && <PracticesTab playerId={playerId} />}
              {screen === 'games' && <GamesTab playerId={playerId} />}
            </>
          )}
        </div>
      </main>

      <PortalNav active={screen} onChange={changeScreen} />
      {fullName && <PWAInstallBanner playerName={fullName} />}
    </div>
  )
}
