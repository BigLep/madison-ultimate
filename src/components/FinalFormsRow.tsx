"use client"

import { useEffect, useState, type ReactNode } from 'react'
import { formatFullDateWithYear, formatLocalTimestamp, formatRelativeHighestUnit } from '@/lib/date-formatters'

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

function Check({ label, done, loading }: { label: string; done?: boolean; loading?: boolean }) {
  const mark = loading ? '…' : done ? '✓' : '❌'
  const markClassName = loading
    ? 'animate-pulse text-[var(--secondary-text)]'
    : done
      ? 'text-green-400'
      : 'text-[var(--secondary-text)]'
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden="true" className={markClassName}>
        {mark}
      </span>
      <span>{label}</span>
    </li>
  )
}

const STATUS_ITEMS = [
  { key: 'parentSigned', label: 'Caretaker signed' },
  { key: 'studentSigned', label: 'Student signed' },
  { key: 'physicalCleared', label: 'Physical cleared' },
] as const

function StatusChecks({
  status,
  loading,
}: {
  status?: FinalFormsStatus | null
  loading?: boolean
}) {
  return (
    <ul className="space-y-1" aria-busy={loading || undefined}>
      {STATUS_ITEMS.map(item => (
        <Check
          key={item.key}
          label={item.label}
          loading={loading}
          done={status?.[item.key]}
        />
      ))}
    </ul>
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
    <p className="text-xs" style={{ color: 'var(--secondary-text)' }}>
      Seattle Public Schools requires every player to complete{' '}
      <FinalFormsLink />
      . That&apos;s the school&apos;s athletics registration, separate from this signup. A sports
      physical within the last 2 years is also required.
    </p>
  )
}

function FinalFormsHelp() {
  return (
    <div className="text-xs space-y-3" style={{ color: 'var(--secondary-text)' }}>
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
    </div>
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

function formatSyncedAt(dataAsOf?: string): string {
  if (!dataAsOf) return ''
  const relative = formatRelativeHighestUnit(dataAsOf)
  return `${formatLocalTimestamp(dataAsOf)}${relative ? ` (${relative})` : ''}`
}

function RefreshButton({
  isRefreshing,
  onRefresh,
}: {
  isRefreshing: boolean
  onRefresh: () => void
}) {
  return (
    <button
      type="button"
      className="underline"
      style={accentLink}
      disabled={isRefreshing}
      onClick={onRefresh}
      aria-label="Check Final Forms again"
    >
      {isRefreshing ? 'requesting…' : 'click here'}
    </button>
  )
}

function RefreshFeedback({
  isRefreshing,
  message,
}: {
  isRefreshing: boolean
  message: string
}) {
  if (!isRefreshing && !message) return null
  return (
    <p role="status" className="text-sm font-medium pt-1" style={accentLink}>
      {message || 'Requesting a refresh…'}
    </p>
  )
}

/** C3: last-synced stamp plus inline refresh (found state). */
function FinalFormsRefreshPrompt({
  dataAsOf,
  isRefreshing,
  onRefresh,
}: {
  dataAsOf?: string
  isRefreshing: boolean
  onRefresh: () => void
}) {
  const syncedAt = formatSyncedAt(dataAsOf)

  return (
    <>
      {syncedAt
        ? `Data last synchronized with Final Forms on ${syncedAt}. If you have updated Final Forms since then, `
        : 'If you have updated Final Forms, '}
      <RefreshButton isRefreshing={isRefreshing} onRefresh={onRefresh} />
      {' '}and we&apos;ll try again.
    </>
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
      <FinalFormsSection>
        <StatusChecks loading />
      </FinalFormsSection>
    )
  }

  const refreshFeedback = (
    <RefreshFeedback isRefreshing={isRefreshing} message={refreshMessage} />
  )
  const syncedAt = formatSyncedAt(status.dataAsOf)

  if (!status.found) {
    return (
      <FinalFormsSection>
        <p className="flex items-start gap-2">
          <span aria-hidden="true">⚠️</span>
          <span>
            We couldn&apos;t find {preferredFirstName || 'your player'} in the school&apos;s Final Forms
            registration yet. Three common reasons:
          </span>
        </p>
        <ol className="list-decimal ml-9 space-y-1">
          <li>
            You haven&apos;t registered in <FinalFormsLink /> yet. If you haven&apos;t, please do so now.
          </li>
          <li>
            Our Final Forms data may be stale.
            {syncedAt ? ` It was last refreshed on ${syncedAt}.` : ''}
            {' '}If you have updated Final Forms since then,{' '}
            <RefreshButton isRefreshing={isRefreshing} onRefresh={refresh} />
            {' '}and we&apos;ll try again.
            {refreshFeedback}
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
      <StatusChecks status={status} />
      {status.physicalClearanceExpiration && (
        <p className="text-xs" style={{ color: 'var(--secondary-text)' }}>
          Physical clearance expires {formatFullDateWithYear(status.physicalClearanceExpiration)}
        </p>
      )}
      <p className="text-xs" style={{ color: 'var(--secondary-text)' }}>
        <FinalFormsRefreshPrompt
          dataAsOf={status.dataAsOf}
          isRefreshing={isRefreshing}
          onRefresh={refresh}
        />
      </p>
      {refreshFeedback}
    </FinalFormsSection>
  )
}
