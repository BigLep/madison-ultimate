"use client"

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HelperText, Req } from '@/components/FormField'
import { rememberPlayer } from '@/lib/player-switcher'
import { DeadlineBanner } from '@/components/DeadlineBanner'

export default function SignupPage() {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4" style={{ background: 'var(--primary-bg)' }}>
      <div className="w-full max-w-md">
        <DeadlineBanner />
      </div>
      <Card className="w-full max-w-md shadow-lg" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 mb-2">
            <img
              src="/images/MadisonSchoolLogo.webp"
              alt="Madison School Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold" style={{ color: 'var(--page-title)' }}>
            Madison Ultimate Signup
          </CardTitle>
          <CardDescription className="font-semibold" style={{ color: 'var(--secondary-header)' }}>
            Let&apos;s find (or start) your player&apos;s page
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preferredFirstName" style={{ color: 'var(--primary-text)' }}>
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
              <Label htmlFor="lastName" style={{ color: 'var(--primary-text)' }}>
                Player&apos;s last name<Req />
              </Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateOfBirth" style={{ color: 'var(--primary-text)' }}>
                Player&apos;s date of birth<Req />
              </Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={e => setDateOfBirth(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="legalFirstName" style={{ color: 'var(--primary-text)' }}>
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

            {/* Honeypot: visually hidden without off-screen positioning, which can otherwise
                stretch the page's scrollable area horizontally on mobile browsers. */}
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
                value={honeypot}
                onChange={e => setHoneypot(e.target.value)}
              />
            </div>

            {nearMatchWarning && (
              <div
                className="border px-4 py-3 rounded space-y-3"
                style={{ backgroundColor: '#fefce8', borderColor: '#fde68a', color: '#854d0e' }}
              >
                <p>
                  We may already have a signup for this player. Double-check the spelling of the name and
                  birthdate. If this is a sibling or you are sure this is a new signup, continue.
                </p>
                <Button type="button" size="sm" disabled={isLoading} onClick={() => submit(true)}>
                  Continue anyway
                </Button>
              </div>
            )}

            {error && (
              <div className="border px-4 py-3 rounded font-medium" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }}>
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full text-white font-semibold hover:opacity-90 transition-opacity"
              style={{ background: 'var(--accent)' }}
              disabled={isLoading}
            >
              {isLoading ? 'Looking...' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
