"use client"

import { useEffect, useState } from 'react'

export interface FinalFormsStatus {
  found: boolean
  dataAsOf?: string
  parentSigned?: boolean
  studentSigned?: boolean
  physicalCleared?: boolean
  physicalClearanceExpiration?: string
}

function Check({ label, done }: { label: string; done?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span style={{ color: done ? '#4ade80' : 'var(--secondary-text)' }}>{done ? '✓' : '○'}</span>
      <span>{label}</span>
    </li>
  )
}

export function FinalFormsRow({
  preferredFirstName,
  playerId,
  refreshSignal,
  onStatusChange,
}: {
  preferredFirstName: string
  playerId: string
  /** Bump this (e.g. after a profile save) to force a re-fetch, so a corrected identity field re-joins immediately. */
  refreshSignal?: number
  /** Reports the fetched status upward, e.g. for the top-level checklist's done/not-done indicator. */
  onStatusChange?: (status: FinalFormsStatus) => void
}) {
  const [status, setStatus] = useState<FinalFormsStatus | null>(null)
  const [refreshMessage, setRefreshMessage] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const load = async () => {
    const res = await fetch(`/api/signup/player/${playerId}/finalforms`)
    const data = await res.json()
    if (res.ok && data.success) {
      setStatus(data)
      onStatusChange?.(data)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, refreshSignal])

  const refresh = async () => {
    setIsRefreshing(true)
    setRefreshMessage('')
    try {
      const res = await fetch('/api/signup/finalforms-refresh', { method: 'POST' })
      const data = await res.json()
      setRefreshMessage(data.message || data.error || 'Could not check for a refresh.')
    } catch {
      setRefreshMessage('Network error. Please try again.')
    } finally {
      setIsRefreshing(false)
    }
  }

  if (!status) return <p style={{ color: 'var(--secondary-text)' }}>Loading...</p>

  if (!status.found) {
    const linkStyle = { color: 'var(--accent)' }
    return (
      <div className="space-y-3">
        <p className="flex items-start gap-2">
          <span aria-hidden="true">⚠️</span>
          <span>
            We couldn&apos;t find {preferredFirstName || 'your player'} in the school&apos;s Final Forms
            registration yet. Two common reasons:
          </span>
        </p>
        <ol className="list-decimal ml-9 space-y-1">
          <li>
            You haven&apos;t registered in{' '}
            <a href="https://seattleschools-wa.finalforms.com" target="_blank" rel="noopener noreferrer" className="underline" style={linkStyle}>
              SPS Final Forms
            </a>{' '}
            (a sports physical within the last 2 years is also required).
          </li>
          <li>
            The name we have doesn&apos;t match school records; enter the last name and legal first name exactly
            as they appear in Final Forms above. Preferred name is what we&apos;ll actually use with your player.
          </li>
        </ol>
        <p>
          If you are having trouble inside Final Forms itself (e.g., login, forms, clearance),{' '}
          <a href="mailto:vamcdonald@seattleschools.org" className="underline" style={linkStyle}>
            contact Madison&apos;s Athletic Director, Valerie McDonald 📧
          </a>
          .
        </p>
        <p>
          Anything else:{' '}
          <a href="mailto:madisonultimate@gmail.com" className="underline" style={linkStyle}>
            madisonultimate@gmail.com
          </a>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-1">
        <Check label="Caretaker signed" done={status.parentSigned} />
        <Check label="Student signed" done={status.studentSigned} />
        <Check label="Physical cleared" done={status.physicalCleared} />
      </ul>
      {status.physicalClearanceExpiration && (
        <p style={{ color: 'var(--secondary-text)' }}>Physical clearance expires {status.physicalClearanceExpiration}</p>
      )}
      {status.dataAsOf && (
        <p className="text-xs" style={{ color: 'var(--secondary-text)' }}>Data as of {status.dataAsOf}</p>
      )}
      <button
        type="button"
        className="underline text-sm py-2 px-1 -mx-1 text-left"
        style={{ color: 'var(--accent)' }}
        disabled={isRefreshing}
        onClick={refresh}
      >
        I believe I&apos;ve completed Final Forms; check again.
      </button>
      {refreshMessage && <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>{refreshMessage}</p>}
    </div>
  )
}
