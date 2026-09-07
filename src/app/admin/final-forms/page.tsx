'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PlanSummary, AppliedSummary } from '@/lib/reconciliation-summary'
import { OUTREACH_CHECKLIST_ROWS, type OutreachEntry } from '@/lib/signup-outreach'
import { formatLocalTimestamp } from '@/lib/date-formatters'

interface PreviewResponse {
  success: boolean
  error?: string
  blockedCount: number | null
  noSnapshot: boolean
  preview: PlanSummary | null
}

interface OutreachResponse {
  success: boolean
  error?: string
  dataAsOf: string | null
  players: OutreachEntry[]
  unreachable: { playerId: string; fullName: string; reason: string }[]
  counts: { total: number; notChecklistComplete: number; unreachable: number }
}

interface ApplyResponse {
  success: boolean
  error?: string
  noSnapshot: boolean
  preview: PlanSummary | null
  applied: AppliedSummary | null
}

export default function FinalFormsAdminPage() {
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null)
  const [applied, setApplied] = useState<AppliedSummary | null>(null)
  const [loading, setLoading] = useState<'preview' | 'apply' | 'sync' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [outreach, setOutreach] = useState<OutreachResponse | null>(null)
  const [outreachError, setOutreachError] = useState<string | null>(null)

  const runPreview = useCallback(async () => {
    setLoading('preview')
    setError(null)
    try {
      const res = await fetch('/api/admin/final-forms')
      const data: PreviewResponse = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Preview failed')
      setPreviewData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(null)
    }
  }, [])

  const loadOutreach = useCallback(async () => {
    setOutreachError(null)
    try {
      const res = await fetch('/api/admin/outreach')
      const data: OutreachResponse = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not load the outreach list')
      setOutreach(data)
    } catch (err) {
      setOutreachError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [])

  useEffect(() => {
    runPreview()
    loadOutreach()
  }, [runPreview, loadOutreach])

  async function runApply() {
    setLoading('apply')
    setError(null)
    try {
      const res = await fetch('/api/admin/final-forms', { method: 'POST' })
      const data: ApplyResponse = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Apply failed')
      setApplied(data.applied)
      await runPreview()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(null)
    }
  }

  // Same trigger the player page uses: dispatches the finalforms-export workflow (single-flight)
  // and drops the in-memory snapshot, so the next Preview after the export lands reads it.
  async function runSync() {
    setLoading('sync')
    setError(null)
    setSyncMessage(null)
    try {
      const res = await fetch('/api/signup/finalforms-refresh', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not start a sync')
      setSyncMessage(
        data.status === 'already-running'
          ? 'A sync is already underway. Give it a couple of minutes, then press Preview.'
          : 'Sync started. The export takes a couple of minutes to land; then press Preview.'
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(null)
    }
  }

  const preview = previewData?.preview ?? null
  const blockedCount = previewData?.blockedCount

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--page-title)' }}>
        Seed Signups from Final Forms
      </h1>
      <p className="mb-6" style={{ color: 'var(--secondary-text)' }}>
        Preview shows what a run would do and writes nothing. Apply joins every unjoined signup it can (Final Forms
        Backfill), creates a Seeded Signup for every Final Forms student still without one, then recomputes Profile
        Complete for every row. Safe to run again after every export.
      </p>

      <div
        className="rounded-lg p-4 border mb-6 text-sm"
        style={
          blockedCount
            ? {
                background: 'var(--availability-cant-make-bg)',
                borderColor: 'var(--availability-cant-make-border)',
                color: 'var(--availability-cant-make-text)',
              }
            : {
                background: 'var(--availability-unsure-bg)',
                borderColor: 'var(--availability-unsure-border)',
                color: 'var(--availability-unsure-text)',
              }
        }
      >
        <div className="font-semibold mb-1">
          {previewData === null
            ? 'Checking Buttondown for blocked subscribers…'
            : blockedCount === null
              ? 'Could not check Buttondown for blocked subscribers.'
              : blockedCount === 0
                ? 'No blocked subscribers on Buttondown right now.'
                : `${blockedCount} subscriber${blockedCount === 1 ? '' : 's'} currently blocked on Buttondown.`}
        </div>
        Apply auto-subscribes eligible emails to Buttondown from the server, with no family IP to forward, so
        Buttondown may mark those subscribers as blocked. After a run, check the Buttondown subscriber list (filter
        by type = Blocked) and unblock anyone who should be receiving team updates.
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={runPreview}
          disabled={loading !== null}
          className="px-4 py-2 rounded-lg disabled:opacity-50"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--primary-text)' }}
        >
          {loading === 'preview' ? 'Previewing...' : 'Preview'}
        </button>
        <button
          onClick={runApply}
          disabled={loading !== null || !preview}
          className="px-4 py-2 rounded-lg disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#ffffff' }}
        >
          {loading === 'apply' ? 'Applying...' : 'Apply'}
        </button>
        <button
          onClick={runSync}
          disabled={loading !== null}
          className="px-4 py-2 rounded-lg disabled:opacity-50 ml-auto"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--primary-text)' }}
          title="Fetch a fresh export from Final Forms (same as the refresh link on a player page)"
        >
          {loading === 'sync' ? 'Requesting sync...' : 'Sync Final Forms'}
        </button>
      </div>

      {syncMessage && (
        <p className="mb-6 text-sm" style={{ color: 'var(--secondary-text)' }}>
          {syncMessage}
        </p>
      )}

      {error && <div className="mb-6" style={{ color: 'var(--availability-cant-make-text)' }}>Error: {error}</div>}

      {previewData?.noSnapshot && (
        <Notice>Could not load the Final Forms export (Drive/export unavailable). Nothing to preview or apply.</Notice>
      )}

      {applied && (
        <div className="mb-8 space-y-6">
          <h2 className="text-xl font-semibold" style={{ color: 'var(--page-title)' }}>Last run</h2>
          <ReportSection title={`Seeded (${applied.seeded.length})`}>
            {applied.seeded.map(item => (
              <li key={item.playerId}>
                {item.playerId} ({item.firstName} {item.lastName}) ← SPS Student ID {item.studentId}
                {item.photoCarriedOver && <span style={{ color: 'var(--secondary-text)' }}> · photo carried over</span>}
                {item.subscribedEmails.length > 0 && (
                  <span style={{ color: 'var(--secondary-text)' }}> · subscribed: {item.subscribedEmails.join(', ')}</span>
                )}
              </li>
            ))}
          </ReportSection>
          <ReportSection title={`Joined (${applied.joined.length})`}>
            {applied.joined.map(item => (
              <li key={item.playerId}>
                {item.playerId} ({item.firstName} {item.lastName}) → SPS Student ID {item.studentId}
                {item.subscribedEmails.length > 0 && (
                  <span style={{ color: 'var(--secondary-text)' }}> · subscribed: {item.subscribedEmails.join(', ')}</span>
                )}
              </li>
            ))}
          </ReportSection>
          <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
            Profile Complete recomputed on {applied.recomputedProfileComplete} row
            {applied.recomputedProfileComplete === 1 ? '' : 's'}.
          </p>
        </div>
      )}

      {preview && (
        <div className="space-y-8">
          <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
            Final Forms export as of {formatLocalTimestamp(preview.dataAsOf)}. {preview.skipped} student{preview.skipped === 1 ? '' : 's'} already
            joined.
          </p>

          <ReportSection title={`Would seed (${preview.seed.length})`}>
            {preview.seed.map(s => (
              <li key={s.studentId}>
                {s.firstName} {s.lastName} · grade {s.grade || '?'} · DOB {s.dateOfBirth} · SPS Student ID {s.studentId}
              </li>
            ))}
          </ReportSection>

          <ReportSection title={`Would join an existing signup (${preview.join.length})`}>
            {preview.join.map(j => (
              <li key={j.studentId}>
                {j.playerId} ({j.preferredFirstName} {j.lastName}) → SPS Student ID {j.studentId} ({j.firstName})
              </li>
            ))}
          </ReportSection>

          <ReportSection title={`Ambiguous twins, nothing done (${preview.ambiguous.length})`}>
            {preview.ambiguous.map((a, i) => (
              <li key={i}>
                Final Forms: {a.students.map(s => `${s.firstName} ${s.lastName} (${s.studentId})`).join(', ')} · signups:{' '}
                {a.playerIds.join(', ')}. Add the legal first name to each signup, then run again.
              </li>
            ))}
          </ReportSection>

          <ReportSection title={`Suspected duplicate signups, nothing done (${preview.duplicateSignups.length})`}>
            {preview.duplicateSignups.map(d => (
              <li key={d.studentId}>
                {d.firstName} {d.lastName} ({d.studentId}) matches signups {d.playerIds.join(', ')}. Remove the extra row,
                then run again.
              </li>
            ))}
          </ReportSection>

          <ReportSection title={`Match Discrepancies, nothing done (${preview.discrepancies.length})`}>
            {preview.discrepancies.map(d => (
              <li key={d.studentId}>
                {d.firstName} {d.lastName} ({d.studentId}) shares a name and birthdate with {d.playerId}, which is joined to{' '}
                {d.storedStudentId}.
              </li>
            ))}
          </ReportSection>

          <ReportSection title={`Unseedable, fix in Final Forms (${preview.unseedable.length})`}>
            {preview.unseedable.map(u => (
              <li key={u.studentId}>
                {u.firstName} {u.lastName} ({u.studentId}): {u.reason}
              </li>
            ))}
          </ReportSection>

          <ReportSection title={`Signups still unmatched (${preview.unmatchedSignups.length})`}>
            {preview.unmatchedSignups.map(item => (
              <li key={item.playerId}>
                {item.playerId}: {item.preferredFirstName} {item.lastName} · signup DOB {item.signupDateOfBirth || '(none)'}
                {item.possibleMatches.map(m => (
                  <div key={m.studentId} className="mt-1" style={{ color: 'var(--secondary-text)' }}>
                    <div>
                      Possible match (birthdate doesn&apos;t match, check it): {m.firstName} {item.lastName} · SPS Student ID{' '}
                      {m.studentId} · Final Forms DOB {m.dateOfBirth}
                    </div>
                    <div className="flex items-start gap-2 mt-1">
                      <pre className="whitespace-pre-wrap p-2 rounded flex-1" style={{ background: 'var(--primary-bg)' }}>
                        {fixDobInstruction(item, m)}
                      </pre>
                      <CopyButton text={fixDobInstruction(item, m)} />
                    </div>
                  </div>
                ))}
              </li>
            ))}
          </ReportSection>
        </div>
      )}

      <OutreachSection data={outreach} error={outreachError} onReload={loadOutreach} />
    </div>
  )
}

/**
 * Signup Outreach (ADR 0007): the same list scripts/outreach-drafts.mjs reads, so the coach can
 * eyeball the audience before building drafts. Read-only.
 */
function OutreachSection({
  data,
  error,
  onReload,
}: {
  data: OutreachResponse | null
  error: string | null
  onReload: () => void
}) {
  return (
    <div className="mt-10 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--page-title)' }}>
          Signup Outreach
        </h2>
        <button
          onClick={onReload}
          className="px-3 py-1 rounded-lg text-sm"
          style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--primary-text)' }}
        >
          Reload
        </button>
      </div>
      <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
        Every signup with the six checklist rows the player page shows. Rows not Checklist Complete come first; they are
        the audience for the next Outreach Wave. Drafts are built with <code>scripts/outreach-drafts.mjs</code> (see{' '}
        <code>docs/fall-2026/signup-outreach-plan.md</code>); nothing here sends anything.
      </p>

      {error && <div style={{ color: 'var(--availability-cant-make-text)' }}>Error: {error}</div>}
      {!data && !error && <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>Loading the outreach list…</p>}

      {data && (
        <>
          <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
            {data.counts.notChecklistComplete} of {data.counts.total} signups not Checklist Complete; {data.counts.unreachable}{' '}
            unreachable. Final Forms export as of {data.dataAsOf ? formatLocalTimestamp(data.dataAsOf) : 'unknown'}.
          </p>

          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}>
            <table className="text-sm min-w-full" style={{ color: 'var(--primary-text)' }}>
              <thead>
                <tr className="text-left [&>th]:px-3 [&>th]:py-2 [&>th]:whitespace-nowrap" style={{ color: 'var(--secondary-text)' }}>
                  <th>Player</th>
                  <th>PlayerID</th>
                  <th>Source</th>
                  {OUTREACH_CHECKLIST_ROWS.map(c => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                  <th>To</th>
                  <th>Cc</th>
                </tr>
              </thead>
              <tbody>
                {data.players.map(p => (
                  <tr
                    key={p.playerId}
                    className={`border-t [&>td]:px-3 [&>td]:py-2 [&>td]:whitespace-nowrap ${p.checklistComplete ? 'opacity-60' : ''}`}
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td>
                      <a href={`/player/${p.playerId}`} className="underline" target="_blank" rel="noreferrer">
                        {p.fullName || '(no name)'}
                      </a>
                    </td>
                    <td className="font-mono text-xs">
                      <PlayerIdLink playerId={p.playerId} />
                    </td>
                    <td>{p.seeded ? 'seeded' : 'family'}</td>
                    {OUTREACH_CHECKLIST_ROWS.map(c => (
                      <td key={c.key} aria-label={p.checklist[c.key] ? `${c.label} done` : `${c.label} not done`}>
                        {p.checklist[c.key] ? '✅' : '❌'}
                      </td>
                    ))}
                    <td className={p.to.length === 0 ? 'text-[var(--availability-cant-make-text)]' : ''}>
                      {p.to.length > 0 ? p.to.join(', ') : 'none'}
                    </td>
                    <td>{p.cc.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.unreachable.length > 0 && (
            <ReportSection title={`Unreachable, no draft (${data.unreachable.length})`}>
              {data.unreachable.map(u => (
                <li key={u.playerId}>
                  <PlayerIdLink playerId={u.playerId} /> ({u.fullName || 'no name'}): {u.reason}
                </li>
              ))}
            </ReportSection>
          )}
        </>
      )}
    </div>
  )
}

/** A PlayerID that opens the player's own page, so a coach can jump from the outreach list to what the family sees. */
function PlayerIdLink({ playerId }: { playerId: string }) {
  return (
    <a href={`/player/${playerId}`} className="underline" target="_blank" rel="noreferrer" style={{ color: 'var(--secondary-text)' }}>
      {playerId}
    </a>
  )
}

function fixDobInstruction(
  item: { playerId: string; preferredFirstName: string; lastName: string; signupDateOfBirth: string },
  match: { studentId: string; dateOfBirth: string }
): string {
  return `Update signup PlayerID ${item.playerId} (${item.preferredFirstName} ${item.lastName}): Date of Birth is currently ${item.signupDateOfBirth || '(blank)'}, but Final Forms has ${match.dateOfBirth} for a same-last-name student (SPS Student ID ${match.studentId}). Change the signup's Date of Birth to ${match.dateOfBirth}.`
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg p-4 border mb-6"
      style={{
        background: 'var(--availability-unsure-bg)',
        borderColor: 'var(--availability-unsure-border)',
        color: 'var(--availability-unsure-text)',
      }}
    >
      {children}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be denied by the browser; the text is still selectable/visible.
    }
  }

  return (
    <button
      onClick={copy}
      className="px-2 py-1 rounded text-xs shrink-0"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--primary-text)' }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--secondary-header)' }}>
        {title}
      </h2>
      <ul
        className="rounded-lg text-sm font-mono border [&>li]:px-4 [&>li]:py-2 [&>li:not(:last-child)]:border-b [&>li]:border-[var(--border)]"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--border)', color: 'var(--primary-text)' }}
      >
        {children}
      </ul>
    </div>
  )
}
