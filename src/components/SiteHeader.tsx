import Link from 'next/link'
import { Home } from 'lucide-react'

// Breadcrumb bar shared across standalone pages (e.g. /calendar) so there's always a way back to
// the homepage. /player/[playerId] renders an equivalent breadcrumb itself via PlayerSwitcher's
// "header" variant, since that one also carries the account switcher.
export function SiteHeader({ label }: { label: string }) {
  return (
    <header className="sticky top-0 z-30 w-full border-b" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
      <div className="max-w-2xl mx-auto px-4 py-2 flex items-center gap-2">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
          <Link
            href="/"
            aria-label="Home"
            className="flex items-center justify-center h-8 w-8 rounded-full transition-colors hover:bg-white/5 active:bg-white/10"
            style={{ color: 'var(--secondary-text)' }}
          >
            <Home className="h-4 w-4" aria-hidden="true" />
          </Link>
          <span aria-hidden="true" style={{ color: 'var(--secondary-text)' }}>/</span>
          <span className="font-semibold" style={{ color: 'var(--secondary-text)' }}>{label}</span>
        </nav>
      </div>
    </header>
  )
}
