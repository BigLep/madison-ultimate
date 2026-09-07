"use client"

import { SignupRecord } from '@/lib/signups-sheet'
import { isSeededAndIncomplete } from '@/lib/signup-checklist'
import { BANNER_STYLE } from '@/components/DeadlineBanner'

/**
 * Shown on a Seeded Signup (ADR 0006) until the family finishes: the row was started from Final
 * Forms, and the first name on it is the legal one until they change it.
 */
export function SeededSignupBanner({ record }: { record: SignupRecord }) {
  if (!isSeededAndIncomplete(record)) return null

  return (
    <div
      className="border px-4 py-3 rounded text-sm"
      style={{ backgroundColor: BANNER_STYLE.open.background, borderColor: BANNER_STYLE.open.border, color: BANNER_STYLE.open.color }}
      data-testid="seeded-signup-banner"
    >
      We started this signup from your player&apos;s SPS Final Forms registration. The first name shown is the
      legal one from Final Forms; change it to the name your player goes by, then check the rest of the details
      and finish the signup.
    </div>
  )
}
