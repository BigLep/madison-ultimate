import { Card, CardContent } from '@/components/ui/card'
import { Markdown } from '@/components/Markdown'
import { CoachAvatar } from '@/components/coach/CoachAvatar'
import { listCoaches } from '@/lib/coaches-sheet'
import { toPublicCoach } from '@/lib/coaches-table'
import { APP_CONFIG } from '@/lib/app-config'

// The public Coaches Page (CONTEXT.md): every Coach in Coaches-tab order with photo, name, and
// About. Never email or phone. Read per request through the in-memory sheet cache.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Coaches | Madison Ultimate',
}

export default async function CoachesPage() {
  const coaches = (await listCoaches()).map(toPublicCoach)

  return (
    <main className="container mx-auto px-4 py-10 max-w-2xl">
      <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--page-title)' }}>
        Our Coaches
      </h1>
      <p className="mb-8 text-sm" style={{ color: 'var(--secondary-text)' }}>
        Madison Ultimate is run by volunteer coaches. To reach all of us, email{' '}
        <a href={`mailto:${APP_CONFIG.COACH_EMAIL}`} className="hyperlink">
          {APP_CONFIG.COACH_EMAIL}
        </a>
        .
      </p>
      <div className="space-y-4">
        {coaches.map(coach => (
          <Card key={coach.coachId} className="shadow-lg" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
            <CardContent className="pt-6 flex flex-col sm:flex-row gap-4">
              <CoachAvatar coachId={coach.coachId} name={coach.name} hasPhoto={coach.hasPhoto} size={112} />
              <div className="min-w-0 space-y-2">
                <h2 className="text-xl font-semibold" style={{ color: 'var(--secondary-header)' }}>
                  {coach.name}
                </h2>
                {coach.about && <Markdown>{coach.about}</Markdown>}
              </div>
            </CardContent>
          </Card>
        ))}
        {coaches.length === 0 && <p style={{ color: 'var(--secondary-text)' }}>Coach info is coming soon.</p>}
      </div>
    </main>
  )
}
