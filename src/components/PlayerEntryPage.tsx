"use client"

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HelperText, Req } from '@/components/FormField'
import { rememberPlayer } from '@/lib/player-switcher'
import { DeadlineBanner } from '@/components/DeadlineBanner'
import { PlayerSwitcher } from '@/components/PlayerSwitcher'
import { PLAYER_BIRTHDATE_MAX, PLAYER_BIRTHDATE_MIN } from '@/lib/player-birthdates'
import { APP_CONFIG } from '@/lib/app-config'

// One shared entry screen for both doors (docs/fall-2026/player-portal-grill.md Q1):
// /signup finds or creates a player (needs preferred first name, runs the near-match check),
// /player is the Portal Login and only ever finds one (last name plus birthdate, family picks
// among several matches). Both show the device's remembered players above the form and use the
// same honeypot, minimum-time-to-submit, and birthdate bounds.

export type PlayerEntryMode = 'signup' | 'login'

const labelStyle = { color: 'var(--primary-text)' }
const errorBoxStyle = { backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }
const warningBoxStyle = { backgroundColor: '#fefce8', borderColor: '#fde68a', color: '#854d0e' }

/** Visually hidden without off-screen positioning, which can stretch the page horizontally on mobile. */
function HoneypotField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        margin: '-1px',
        padding: 0,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
      aria-hidden="true"
    >
      <label htmlFor="website">Leave this field blank</label>
      <input
        id="website"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

function BirthdateField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="dateOfBirth" style={labelStyle}>
        Player&apos;s date of birth<Req />
      </Label>
      <Input
        id="dateOfBirth"
        type="date"
        min={PLAYER_BIRTHDATE_MIN}
        max={PLAYER_BIRTHDATE_MAX}
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        disabled={disabled}
      />
    </div>
  )
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="border px-4 py-3 rounded font-medium" style={errorBoxStyle}>
      {children}
    </div>
  )
}

/** The button is server-rendered disabled and only enabled once mounted client-side, so a tap
 * in the brief pre-hydration window on a slow mobile connection can't fall through to a native
 * (unhandled) form GET submit, which would silently reload the page and wipe every field. */
function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  return mounted
}

function SignupForm({ onEngagedChange }: { onEngagedChange: (engaged: boolean) => void }) {
  const [preferredFirstName, setPreferredFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [legalFirstName, setLegalFirstName] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [nearMatchWarning, setNearMatchWarning] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const formRenderedAt = useRef(Date.now())
  const router = useRouter()
  const mounted = useMounted()

  const engaged = Boolean(preferredFirstName || lastName || dateOfBirth || legalFirstName)
  useEffect(() => {
    onEngagedChange(engaged)
  }, [engaged, onEngagedChange])

  const submit = async (confirmNearMatch: boolean) => {
    setError('')
    setIsLoading(true)
    try {
      const response = await fetch('/api/signup/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredFirstName: preferredFirstName.trim(),
          lastName: lastName.trim(),
          dateOfBirth,
          legalFirstName: legalFirstName.trim(),
          honeypot,
          formRenderedAt: formRenderedAt.current,
          confirmNearMatch,
        }),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }

      if (data.nearMatch) {
        setNearMatchWarning(true)
        return
      }

      rememberPlayer({ playerId: data.playerId, displayName: `${preferredFirstName.trim()} ${lastName.trim()}` })
      router.push(`/player/${data.playerId}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        submit(false)
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="preferredFirstName" style={labelStyle}>
          Player&apos;s preferred first name<Req />
        </Label>
        <Input
          id="preferredFirstName"
          value={preferredFirstName}
          onChange={e => setPreferredFirstName(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lastName" style={labelStyle}>
          Player&apos;s last name<Req />
        </Label>
        <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} required disabled={isLoading} />
      </div>

      <BirthdateField value={dateOfBirth} onChange={setDateOfBirth} disabled={isLoading} />

      <div className="space-y-2">
        <Label htmlFor="legalFirstName" style={labelStyle}>
          Legal first name
        </Label>
        <HelperText>
          Only if different from preferred. Needed to match your player&apos;s Final Forms record when last
          name and birthdate alone aren&apos;t enough (e.g. twins). Never shown publicly.
        </HelperText>
        <Input
          id="legalFirstName"
          value={legalFirstName}
          onChange={e => setLegalFirstName(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <HoneypotField value={honeypot} onChange={setHoneypot} />

      {nearMatchWarning && (
        <div className="border px-4 py-3 rounded space-y-3" style={warningBoxStyle}>
          <p>
            We may already have a signup for this player. Double-check the spelling of the name and
            birthdate. If this is a sibling or you are sure this is a new signup, continue.
          </p>
          <Button type="button" size="sm" disabled={isLoading} onClick={() => submit(true)}>
            Continue anyway
          </Button>
        </div>
      )}

      {error && <ErrorBox>{error}</ErrorBox>}

      <Button
        type="submit"
        className="w-full text-white font-semibold hover:opacity-90 transition-opacity"
        style={{ background: 'var(--accent)' }}
        disabled={isLoading || !mounted}
      >
        {isLoading ? 'Looking...' : 'Continue'}
      </Button>
    </form>
  )
}

interface LookupMatch {
  playerId: string
  preferredFirstName: string
  displayName: string
}

function LoginForm({ onEngagedChange }: { onEngagedChange: (engaged: boolean) => void }) {
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [matches, setMatches] = useState<LookupMatch[] | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const formRenderedAt = useRef(Date.now())
  const router = useRouter()
  const mounted = useMounted()

  const engaged = Boolean(lastName || dateOfBirth)
  useEffect(() => {
    onEngagedChange(engaged)
  }, [engaged, onEngagedChange])

  const go = (match: LookupMatch) => {
    rememberPlayer({ playerId: match.playerId, displayName: match.displayName })
    router.push(`/player/${match.playerId}`)
  }

  const submit = async () => {
    setError('')
    setNotFound(false)
    setMatches(null)
    setIsLoading(true)
    try {
      const response = await fetch('/api/player/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastName: lastName.trim(),
          dateOfBirth,
          honeypot,
          formRenderedAt: formRenderedAt.current,
        }),
      })
      const data = await response.json()

      if (data.notFound) {
        setNotFound(true)
        return
      }
      if (!response.ok || !data.success) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }

      const found: LookupMatch[] = data.matches || []
      if (found.length === 1) {
        go(found[0])
        return
      }
      setMatches(found)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        submit()
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="lastName" style={labelStyle}>
          Player&apos;s last name<Req />
        </Label>
        <Input
          id="lastName"
          value={lastName}
          onChange={e => {
            setLastName(e.target.value)
            setMatches(null)
          }}
          required
          disabled={isLoading}
        />
      </div>

      <BirthdateField
        value={dateOfBirth}
        onChange={value => {
          setDateOfBirth(value)
          setMatches(null)
        }}
        disabled={isLoading}
      />

      <HoneypotField value={honeypot} onChange={setHoneypot} />

      {matches && matches.length > 1 && (
        <div className="space-y-2" role="group" aria-labelledby="which-player">
          <p id="which-player" className="font-semibold" style={labelStyle}>
            Which player?
          </p>
          <ul className="space-y-1.5">
            {matches.map(match => (
              <li key={match.playerId}>
                <button
                  type="button"
                  className="w-full min-h-[44px] flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:bg-white/5 active:bg-white/10"
                  style={{ borderColor: 'var(--border)', color: 'var(--primary-text)' }}
                  onClick={() => go(match)}
                >
                  <span className="truncate">{match.preferredFirstName || match.displayName}</span>
                  <span aria-hidden="true" style={{ color: 'var(--secondary-text)' }}>
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {notFound && (
        <div className="border px-4 py-3 rounded space-y-2 text-sm" style={warningBoxStyle}>
          <p className="font-medium">We couldn&apos;t find a player with that last name and birthdate.</p>
          <p>Check the birthdate: it must match what you entered at signup.</p>
          <p>
            Not signed up yet?{' '}
            <a href="/signup" className="underline font-medium">
              Sign up here
            </a>
            .
          </p>
          <p>
            Still stuck? Email{' '}
            <a href={`mailto:${APP_CONFIG.COACH_EMAIL}`} className="underline font-medium">
              {APP_CONFIG.COACH_EMAIL}
            </a>
            .
          </p>
        </div>
      )}

      {error && <ErrorBox>{error}</ErrorBox>}

      <Button
        type="submit"
        className="w-full text-white font-semibold hover:opacity-90 transition-opacity"
        style={{ background: 'var(--accent)' }}
        disabled={isLoading || !mounted}
      >
        {isLoading ? 'Looking...' : 'Continue'}
      </Button>
    </form>
  )
}

const COPY: Record<PlayerEntryMode, { title: string; description: string }> = {
  signup: { title: 'Madison Ultimate Signup', description: "Let's find (or start) your player's page" },
  login: { title: 'Madison Ultimate Player Portal', description: "Let's find your player's portal" },
}

export function PlayerEntryPage({ mode }: { mode: PlayerEntryMode }) {
  // Two-path chooser (docs/fall-2026/player-switcher-grill.md Q8/Q9): typing into the form
  // de-emphasizes the "Your players" list; clearing the form reverses it.
  const [formEngaged, setFormEngaged] = useState(false)
  const copy = COPY[mode]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4" style={{ background: 'var(--primary-bg)' }}>
      <div className="w-full max-w-md space-y-4">
        {mode === 'signup' && <DeadlineBanner />}
        <PlayerSwitcher variant="chooser" dimmed={formEngaged} />
      </div>
      <Card className="w-full max-w-md shadow-lg" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 mb-2">
            <img src="/images/MadisonSchoolLogo.webp" alt="Madison School Logo" className="w-full h-full object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold" style={{ color: 'var(--page-title)' }}>
            {copy.title}
          </CardTitle>
          <CardDescription className="font-semibold" style={{ color: 'var(--secondary-header)' }}>
            {copy.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === 'signup' ? <SignupForm onEngagedChange={setFormEngaged} /> : <LoginForm onEngagedChange={setFormEngaged} />}
        </CardContent>
      </Card>
    </div>
  )
}
