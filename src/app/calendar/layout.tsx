import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Team Calendar | Madison Ultimate',
  description: 'Subscribe to the Madison Ultimate team calendar for practices and games.',
}

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return children
}
