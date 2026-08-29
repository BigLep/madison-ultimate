"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { APP_CONFIG } from '@/lib/app-config'

interface MailingEntry {
  label: string
  email: string
  subscribed: boolean | null
}

/**
 * Inline newsletter status + Join/Leave for a single eligible email
 * (caretaker or student personal; SPS addresses are never shown here).
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
      <span>
        <a
          href={APP_CONFIG.MAILING_LIST_JOIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
          style={{ color: 'var(--accent)' }}
        >
          Newsletter
        </a>: {entry.subscribed ? 'subscribed' : 'not subscribed'}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2.5 text-xs"
        style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'transparent' }}
        disabled={pending}
        onClick={toggle}
      >
        {entry.subscribed ? '📭 Leave' : '📬 Join'}
      </Button>
    </p>
  )
}
