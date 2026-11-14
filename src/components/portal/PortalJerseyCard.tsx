"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatJerseySize } from '@/lib/signup-form-schema'
import { formatFullDate } from '@/lib/date-formatters'

// Program Jersey card on the Player Portal Home tab (ADR 0009; docs/fall-2026/jersey-plan.md
// phase 5). Shown only when there is something to say: a jersey to return, an unpaid Lost Jersey
// Fee, or a thank-you for the most recent return. Hidden on any error; it is never the reason the
// Home tab looks broken.

interface JerseyStatus {
  openLoanSizes: string[]
  returned: { size: string; checkedInAt: string } | null
  unpaidFees: string[]
  returnDueDate: string
}

const cardStyle = { background: 'var(--card-bg)', borderColor: 'var(--border)' } as const
const textStyle = { color: 'var(--primary-text)' }

/** An ISO timestamp's calendar day in the viewer's timezone, as YYYY-MM-DD (UTC would be a day off in the evening). */
function localDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function PortalJerseyCard({ playerId }: { playerId: string }) {
  const [status, setStatus] = useState<JerseyStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/player/${encodeURIComponent(playerId)}/jersey`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.success) setStatus(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [playerId])

  if (!status) return null
  const { openLoanSizes, returned, unpaidFees, returnDueDate } = status
  if (openLoanSizes.length === 0 && unpaidFees.length === 0 && !returned) return null

  const sizes = openLoanSizes.map(s => formatJerseySize(s) || s).join(' and ')
  return (
    <Card className="shadow-lg" style={cardStyle}>
      <CardHeader>
        <CardTitle style={{ color: 'var(--page-title)' }}>🎽 Program Jersey</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {openLoanSizes.length > 0 && (
          <p style={textStyle}>
            You have {openLoanSizes.length > 1 ? `${openLoanSizes.length} Program Jerseys` : 'a Program Jersey'} ({sizes}). Please return{' '}
            {openLoanSizes.length > 1 ? 'them' : 'it'} to a Jersey Manager
            {returnDueDate ? <> by <strong>{formatFullDate(returnDueDate)}</strong></> : null}.
          </p>
        )}
        {unpaidFees.map((fee, i) => (
          <p key={i} style={textStyle}>
            Your Program Jersey was marked lost. A <strong>${fee}</strong> fee is due. A coach will be in touch about how to pay.
          </p>
        ))}
        {openLoanSizes.length === 0 && unpaidFees.length === 0 && returned && (
          <p style={textStyle}>
            Program Jersey returned {returned.checkedInAt ? formatFullDate(localDay(returned.checkedInAt)) : ''}. Thank you!
          </p>
        )}
      </CardContent>
    </Card>
  )
}
