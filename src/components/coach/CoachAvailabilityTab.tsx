'use client'

import { useEffect, useState } from 'react'
import { Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { AvailabilityCard } from '@/components/availability-card'
import { AvailabilitySummary } from '@/components/availability-summary'

// Coach Availability on Coach Home (CONTEXT.md): practices and games in one list, answered with the
// same cards and summary players use. Past events are read-only, as on the player tabs.

interface CoachEventItem {
  eventKey: string
  kind: 'practice' | 'game'
  title: string
  formattedDate: string
  formattedTime: string
  location: string
  locationUrl: string | null
  eventNote: string
  isCancelled: boolean
  isPast: boolean
  availability: { availability: string; note: string }
}

interface CoachAvailabilityData {
  availabilityOpen: boolean
  events: CoachEventItem[]
  availabilityOptions: { PLANNING: string; CANT_MAKE: string; NOT_SURE: string }
}

const cardStyle = { background: 'var(--card-bg)', borderColor: 'var(--border)' } as const

export function CoachAvailabilityTab({ coachId, availabilitySheetUrl }: { coachId: string; availabilitySheetUrl: string | null }) {
  const [data, setData] = useState<CoachAvailabilityData | null>(null)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/coach/coaches/${coachId}/availability`)
      .then(res => res.json())
      .then(body => (body.success ? setData(body) : setError(body.error || 'Failed to load availability')))
      .catch(() => setError('Network error. Please try again.'))
  }, [coachId])

  const updateAvailability = async (eventKey: string, availability: string, note: string) => {
    setUpdating(eventKey)
    try {
      const res = await fetch(`/api/coach/coaches/${coachId}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventKey, availability, note }),
      })
      const body = await res.json()
      if (!body.success) {
        setError(body.error || 'Failed to update availability')
        return
      }
      setData(prev =>
        prev && {
          ...prev,
          events: prev.events.map(e => (e.eventKey === eventKey ? { ...e, availability: { availability, note } } : e)),
        }
      )
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setUpdating(null)
    }
  }

  const sheetLink = availabilitySheetUrl && (
    <a href={availabilitySheetUrl} target="_blank" rel="noopener noreferrer" className="hyperlink text-sm">
      See everyone&apos;s availability in the coach sheet
    </a>
  )

  if (error) {
    return (
      <Card className="shadow-lg" style={cardStyle}>
        <CardContent className="text-center py-8">
          <p style={{ color: 'var(--error-text, #f87171)' }}>{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="shadow-lg" style={cardStyle}>
        <CardContent className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p style={{ color: 'var(--secondary-text)' }}>Loading availability...</p>
        </CardContent>
      </Card>
    )
  }

  if (!data.availabilityOpen) {
    return (
      <Card className="shadow-lg" style={cardStyle}>
        <CardContent className="py-4 text-sm space-y-2" style={{ color: 'var(--primary-text)' }}>
          <p>You don&apos;t have a row in Coach Availability yet. Run Build Coach Availability from the coach sheet menu, then reload.</p>
          {sheetLink}
        </CardContent>
      </Card>
    )
  }

  const upcoming = data.events.filter(e => !e.isPast)
  const past = data.events.filter(e => e.isPast)
  const allUpcomingResponded = upcoming.length > 0 && upcoming.every(e => e.isCancelled || e.availability.availability)

  const renderCard = (event: CoachEventItem, editable: boolean) => (
    <AvailabilityCard
      key={event.eventKey}
      title={`${event.formattedDate}: ${event.title}`}
      subtitle={event.formattedTime}
      location={event.location}
      locationUrl={event.locationUrl}
      availabilityOptions={data.availabilityOptions}
      currentAvailability={event.availability.availability}
      currentNote={event.availability.note}
      onUpdateAvailability={(availability, note) => updateAvailability(event.eventKey, availability, note)}
      isUpdating={updating === event.eventKey}
      isEditable={editable}
      isCancelled={event.isCancelled}
    >
      {event.eventNote && (
        <div className="p-3 rounded-lg mt-2" style={{ background: 'var(--secondary-bg, var(--primary-bg))' }}>
          <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
            <strong>Note:</strong> {event.eventNote}
          </p>
        </div>
      )}
    </AvailabilityCard>
  )

  return (
    <div className="space-y-6">
      {sheetLink && <div>{sheetLink}</div>}

      {data.events.length > 0 && (
        <AvailabilitySummary
          title="Availability Summary"
          upcomingItems={upcoming}
          pastItems={past}
          availabilityOptions={data.availabilityOptions}
          allUpcomingResponded={allUpcomingResponded}
        />
      )}

      {upcoming.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--page-title)' }}>
            Upcoming Practices and Games
          </h2>
          {upcoming.map(event => renderCard(event, !event.isCancelled))}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--page-title)' }}>
            Past Practices and Games
          </h2>
          {[...past].reverse().map(event => renderCard(event, false))}
        </div>
      )}

      {data.events.length === 0 && (
        <Card className="shadow-lg" style={cardStyle}>
          <CardContent className="text-center py-8">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: 'var(--secondary-text)' }} />
            <p style={{ color: 'var(--secondary-text)' }}>No practices or games in Coach Availability yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
