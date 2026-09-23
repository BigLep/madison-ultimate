'use client'

import { useEffect, useState } from 'react'
import { PasswordGateForm } from '@/components/PasswordGateForm'
import { getRememberedCoachId, rememberCoach } from '@/lib/coach-session'
import type { PublicCoach } from '@/lib/coaches-table'

// Coach Login (CONTEXT.md): pick your name from the Coaches list, enter the shared Coach Tools
// password. The password becomes the gate cookie (ADR 0008); the chosen CoachID is remembered on
// this device until Coach Logout.

const selectClassName = 'flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'

export default function CoachLoginPage() {
  const [coaches, setCoaches] = useState<PublicCoach[] | null>(null)
  const [coachId, setCoachId] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    setCoachId(getRememberedCoachId() || '')
    fetch('/api/coaches')
      .then(res => res.json())
      .then(data => {
        if (data.success) setCoaches(data.coaches)
        else setLoadError(data.error || 'Could not load the coach list.')
      })
      .catch(() => setLoadError('Network error loading the coach list.'))
  }, [])

  return (
    <PasswordGateForm
      title="Coach Login"
      loginApiPath="/api/coach/login"
      defaultNext="/coach"
      canSubmit={Boolean(coachId)}
      onSuccess={() => rememberCoach(coachId)}
    >
      <select
        aria-label="Your name"
        className={selectClassName}
        value={coachId}
        onChange={e => setCoachId(e.target.value)}
        disabled={!coaches}
      >
        <option value="">{coaches ? 'Pick your name…' : 'Loading coaches…'}</option>
        {coaches?.map(coach => (
          <option key={coach.coachId} value={coach.coachId}>
            {coach.name}
          </option>
        ))}
      </select>
      {loadError && (
        <p className="text-sm" style={{ color: 'var(--error-text, #f87171)' }}>
          {loadError}
        </p>
      )}
    </PasswordGateForm>
  )
}
