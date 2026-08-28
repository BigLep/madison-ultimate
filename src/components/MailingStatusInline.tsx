"use client"

import { useEffect, useState } from 'react'

interface MailingEntry {
  label: string
  email: string
  subscribed: boolean | null
}

/**
 * Inline mailing-list status + join/opt-out action for a single email field (round 3: replaces
 * the old standalone Mailing List dashboard row/section; unenforced, purely informational).
 */
export function MailingStatusInline({
  playerId,
  matchLabel,
  refreshSignal,
}: {
  playerId: string
  matchLabel: string
  refreshSignal?: number
}) {
  const [entry, setEntry] = useState<MailingEntry | null | undefined>(undefined)
  const [pending, setPending] = useState(false)

  const load = async () => {
    try {
      const res = await fetch(`/api/signup/player/${playerId}/mailing`)
      const data = await res.json()
      if (res.ok && data.success) {
        const found: MailingEntry | undefined = data.statuses.find((s: MailingEntry) => s.label === matchLabel)
        setEntry(found ?? null)
      } else {
        setEntry(null)
      }
    } catch {
      setEntry(null)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, matchLabel, refreshSignal])

  const toggle = async () => {
    if (!entry) return
    setPending(true)
    try {
      const action = entry.subscribed ? 'unsubscribe' : 'subscribe'
      const res = await fetch(`/api/signup/player/${playerId}/mailing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: entry.email, action }),
      })
      if (res.ok) await load()
    } finally {
      setPending(false)
    }
  }

  if (!entry) return null

  return (
    <p className="text-xs flex items-center gap-2 flex-wrap" style={{ color: 'var(--secondary-text)' }}>
      <span>Mailing list: {entry.subscribed ? 'Subscribed' : 'Not subscribed'}</span>
      <button type="button" className="underline py-1 px-1" style={{ color: 'var(--accent)' }} disabled={pending} onClick={toggle}>
        {entry.subscribed ? 'Opt out' : 'Join'}
      </button>
    </p>
  )
}
