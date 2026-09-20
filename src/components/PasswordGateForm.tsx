'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Shared UI for the /admin and /coach login pages (ADR 0008): one password field, posted to the
// area's login route. Reads `next` from the URL itself (not useSearchParams) so this can render
// without a Suspense boundary.

export function PasswordGateForm({ title, loginApiPath, defaultNext }: { title: string; loginApiPath: string; defaultNext: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(loginApiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'Incorrect password')
        return
      }
      const next = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null
      router.push(next || defaultNext)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-sm">
      <Card className="shadow-lg" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
        <CardContent className="pt-6">
          <h1 className="text-xl font-bold mb-4" style={{ color: 'var(--page-title)' }}>
            {title}
          </h1>
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              type="password"
              inputMode="text"
              autoFocus
              autoComplete="off"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            {error && (
              <p className="text-sm" style={{ color: 'var(--error-text, #f87171)' }}>
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading || !password} className="w-full">
              {loading ? 'Checking…' : 'Log In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
