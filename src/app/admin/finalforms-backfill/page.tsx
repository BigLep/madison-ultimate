'use client'

import { useState } from 'react'

interface BackfillReport {
  joined: { playerId: string; studentId: string; subscribedEmails: string[] }[]
  unmatched: {
    playerId: string
    preferredFirstName: string
    lastName: string
    signupDateOfBirth: string
    possibleMatches: { studentId: string; firstName: string; dateOfBirth: string }[]
  }[]
  ambiguous: { playerId: string; candidateCount: number }[]
  discrepancies: { playerId: string; storedStudentId: string; freshMatchStudentId: string }[]
  noSnapshot: boolean
}

export default function FinalFormsBackfillPage() {
  const [report, setReport] = useState<BackfillReport | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runBackfill() {
    setRunning(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/finalforms-backfill', { method: 'POST' })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Backfill failed')
      }
      setReport(result.report)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--page-title)' }}>
        Final Forms Backfill
      </h1>
      <p className="mb-6" style={{ color: 'var(--secondary-text)' }}>
        Attempts a Final Forms Join for every signup row missing an SPS Student ID: players who finished Final Forms
        but never returned to their player page. Never overwrites a row that already has an SPS Student ID.
      </p>

      <div
        className="rounded-lg p-4 border mb-6 text-sm"
        style={{
          background: 'var(--availability-unsure-bg)',
          borderColor: 'var(--availability-unsure-border)',
          color: 'var(--availability-unsure-text)',
        }}
      >
        Heads up: this backfill auto-subscribes eligible emails to Buttondown, but it runs server-side with no
        family IP to forward, so Buttondown may flag those subscribers as coming from a datacenter IP and mark them
        blocked. Check the Buttondown subscriber list (filter by type = Blocked) after running this and unblock
        anyone who should be receiving team updates. Signups made directly through /player are not affected; those
        forward the family&apos;s own IP.
      </div>

      <button
        onClick={runBackfill}
        disabled={running}
        className="px-4 py-2 rounded-lg disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#ffffff' }}
      >
        {running ? 'Running...' : 'Run Backfill'}
      </button>

      {error && <div className="mt-6" style={{ color: 'var(--availability-cant-make-text)' }}>Error: {error}</div>}

      {report && (
        <div className="mt-8 space-y-8">
          {report.noSnapshot && (
            <div
              className="rounded-lg p-4 border"
              style={{
                background: 'var(--availability-unsure-bg)',
                borderColor: 'var(--availability-unsure-border)',
                color: 'var(--availability-unsure-text)',
              }}
            >
              Could not load the Final Forms export (Drive/export unavailable); rows without an SPS Student ID were
              left unattempted.
            </div>
          )}

          <ReportSection title={`Joined (${report.joined.length})`}>
            {report.joined.map(item => (
              <li key={item.playerId}>
                {item.playerId} → SPS Student ID {item.studentId}
                {item.subscribedEmails.length > 0 && (
                  <span style={{ color: 'var(--secondary-text)' }}> · subscribed: {item.subscribedEmails.join(', ')}</span>
                )}
              </li>
            ))}
          </ReportSection>

          <ReportSection title={`Match Discrepancies (${report.discrepancies.length})`}>
            {report.discrepancies.map(item => (
              <li key={item.playerId}>
                {item.playerId}: stored {item.storedStudentId}, fresh match {item.freshMatchStudentId} (not changed)
              </li>
            ))}
          </ReportSection>

          <ReportSection title={`Ambiguous Matches (${report.ambiguous.length})`}>
            {report.ambiguous.map(item => (
              <li key={item.playerId}>
                {item.playerId}: {item.candidateCount} candidates, could not disambiguate
              </li>
            ))}
          </ReportSection>

          <ReportSection title={`Still Unmatched (${report.unmatched.length})`}>
            {report.unmatched.map(item => (
              <li key={item.playerId}>
                {item.playerId}: {item.preferredFirstName} {item.lastName} · signup DOB {item.signupDateOfBirth || '(none)'}
                {item.possibleMatches.map(m => (
                  <div key={m.studentId} className="mt-1" style={{ color: 'var(--secondary-text)' }}>
                    <div>
                      Possible match (birthdate doesn&apos;t match, check it): {m.firstName} {item.lastName} · SPS Student ID{' '}
                      {m.studentId} · Final Forms DOB {m.dateOfBirth}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-wide" style={{ color: 'var(--secondary-text)' }}>
                      Potential agent prompt to fix
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
    </div>
  )
}

function fixDobInstruction(
  item: { playerId: string; preferredFirstName: string; lastName: string; signupDateOfBirth: string },
  match: { studentId: string; dateOfBirth: string }
): string {
  return `Update signup PlayerID ${item.playerId} (${item.preferredFirstName} ${item.lastName}): Date of Birth is currently ${item.signupDateOfBirth || '(blank)'}, but Final Forms has ${match.dateOfBirth} for a same-last-name student (SPS Student ID ${match.studentId}). Change the signup's Date of Birth to ${match.dateOfBirth}.`
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
