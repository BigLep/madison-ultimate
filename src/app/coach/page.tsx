import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'

// Coach Tools landing page (CONTEXT.md, ADR 0008): lists tools gated by the /coach password.
// Deliberately separate from /admin, which is ops-facing and unlinked from here.

const TOOLS = [
  {
    href: '/coach/player-directory',
    icon: '🔍',
    title: 'Player Directory',
    description: "Look up a rostered player's photo, contact info, and availability.",
  },
]

export default function CoachToolsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--page-title)' }}>
        Coach Tools
      </h1>
      <div className="space-y-4">
        {TOOLS.map(tool => (
          <Link key={tool.href} href={tool.href} className="block">
            <Card className="shadow-lg transition-shadow hover:shadow-xl" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
              <CardContent className="p-4 flex items-center gap-4">
                <span className="text-3xl" aria-hidden="true">
                  {tool.icon}
                </span>
                <div>
                  <h2 className="font-semibold text-lg" style={{ color: 'var(--secondary-header)' }}>
                    {tool.title}
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
                    {tool.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
