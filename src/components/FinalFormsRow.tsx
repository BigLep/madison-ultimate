"use client"

import { useEffect, useState, type ReactNode } from 'react'
import { formatFullDateWithYear, formatLocalTimestamp } from '@/lib/date-formatters'

const FINAL_FORMS_URL = 'https://seattleschools-wa.finalforms.com'
const accentLink = { color: 'var(--accent)' }

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

function FinalFormsLink() {
  return (
    <a href={FINAL_FORMS_URL} target="_blank" rel="noopener noreferrer" className="underline" style={accentLink}>
      SPS Final Forms
    </a>
  )
}

/** Shown in every Final Forms state: this is SPS's process, not ours. */
function FinalFormsExplainer() {
  return (
    <p>
      Seattle Public Schools requires every player to complete{' '}
      <FinalFormsLink />
      . That&apos;s the school&apos;s athletics registration, separate from this signup. A sports
      physical within the last 2 years is also required.
    </p>
  )
}

function FinalFormsHelp() {
  return (
    <>
      <p>
        If you are having trouble inside Final Forms itself (e.g., login, forms, clearance), contact{' '}
        <a href="mailto:vamcdonald@seattleschools.org" className="underline" style={accentLink}>
          Madison&apos;s Athletic Director, Valerie McDonald 📧
        </a>
        .
      </p>
      <p>
        Other questions? Email{' '}
        <a href="mailto:madisonultimate@gmail.com" className="underline" style={accentLink}>
          madisonultimate@gmail.com
        </a>
        .
      </p>
    </>
  )
}

function FinalFormsSection({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-3">
      <FinalFormsExplainer />
      {children}
      <FinalFormsHelp />
    </div>
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

  if (!status) {
    return (
      <div className="space-y-3">
        <FinalFormsExplainer />
        <p style={{ color: 'var(--secondary-text)' }}>Loading...</p>
      </div>
    )
  }

  if (!status.found) {
    return (
      <FinalFormsSection>
        <p className="flex items-start gap-2">
          <span aria-hidden="true">⚠️</span>
          <span>
            We couldn&apos;t find {preferredFirstName || 'your player'} in the school&apos;s Final Forms
            registration yet. Two common reasons:
          </span>
        </p>
        <ol className="list-decimal ml-9 space-y-1">
          <li>
            You haven&apos;t registered in <FinalFormsLink /> yet.
          </li>
          <li>
            The name we have doesn&apos;t match school records; enter the last name and legal first name exactly
            as they appear in Final Forms. Preferred name is what we&apos;ll actually use with your player.
          </li>
        </ol>
      </FinalFormsSection>
    )
  }

  return (
    <FinalFormsSection>
      <ul className="space-y-1">
        <Check label="Caretaker signed" done={status.parentSigned} />
        <Check label="Student signed" done={status.studentSigned} />
        <Check label="Physical cleared" done={status.physicalCleared} />
      </ul>
      {status.physicalClearanceExpiration && (
        <p style={{ color: 'var(--secondary-text)' }}>
          Physical clearance expires {formatFullDateWithYear(status.physicalClearanceExpiration)}
        </p>
      )}
      <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
        {status.dataAsOf
          ? `Data last synchronized with Final Forms on ${formatLocalTimestamp(status.dataAsOf)}. If you have updated Final Forms since then, `
          : 'If you have updated Final Forms, '}
        <button
          type="button"
          className="underline py-2"
          style={accentLink}
          disabled={isRefreshing}
          onClick={refresh}
          aria-label="Check Final Forms again"
        >
          click here
        </button>
        {' '}and we&apos;ll try again.
      </p>
      {refreshMessage && <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>{refreshMessage}</p>}
    </FinalFormsSection>
  )
}
