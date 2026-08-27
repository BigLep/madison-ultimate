"use client"

import { getDeadlineState, DEADLINE_COPY } from '@/lib/signup-deadlines'

const BANNER_STYLE: Record<string, { background: string; border: string; color: string }> = {
  open: { background: '#eff6ff', border: '#bfdbfe', color: '#1e40af' },
  late: { background: '#fefce8', border: '#fde68a', color: '#854d0e' },
  closed: { background: '#fef2f2', border: '#fecaca', color: '#991b1b' },
}

export function DeadlineBanner() {
  const state = getDeadlineState()
  const style = BANNER_STYLE[state]

  return (
    <div className="border px-4 py-3 rounded text-sm" style={{ backgroundColor: style.background, borderColor: style.border, color: style.color }}>
      {DEADLINE_COPY[state]}
    </div>
  )
}
