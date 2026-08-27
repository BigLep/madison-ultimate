"use client"

import { useEffect, useState } from 'react'

interface MailingStatus {
  label: string
  email: string
  subscribed: boolean | null
}

export function MailingListRow({ playerId }: { playerId: string }) {
  const [statuses, setStatuses] = useState<MailingStatus[] | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  const load = async () => {
    const res = await fetch(`/api/signup/player/${playerId}/mailing`)
    const data = await res.json()
    if (res.ok && data.success) setStatuses(data.statuses)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId])

  const toggle = async (email: string, subscribed: boolean | null) => {
    setPending(email)
    try {
      const action = subscribed ? 'unsubscribe' : 'subscribe'
      const res = await fetch(`/api/signup/player/${playerId}/mailing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, action }),
      })
      if (res.ok) await load()
    } finally {
      setPending(null)
    }
  }

  if (!statuses) return <p style={{ color: 'var(--secondary-text)' }}>Loading...</p>
  if (statuses.length === 0) return <p style={{ color: 'var(--secondary-text)' }}>No mailing-eligible emails on file yet.</p>

  return (
    <ul className="space-y-2">
      {statuses.map(status => (
        <li key={status.email} className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <span>
            {status.label}: {status.subscribed ? 'Subscribed' : 'Not subscribed'}
          </span>
          <button
            type="button"
            className="underline text-sm py-1 px-1 -mx-1 sm:py-2"
            style={{ color: 'var(--accent)' }}
            disabled={pending === status.email}
            onClick={() => toggle(status.email, status.subscribed)}
          >
            {status.subscribed ? 'Opt out' : 'Join'}
          </button>
        </li>
      ))}
    </ul>
  )
}
