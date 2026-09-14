"use client"

import { useEffect, useState } from 'react'
import { Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { AvailabilityCard } from '@/components/availability-card'
import { AvailabilitySummary } from '@/components/availability-summary'
import { APP_CONFIG } from '@/lib/app-config'

interface PracticeItem {
  date: string
  location: string
  locationUrl?: string | null
  startTime: string
  endTime: string
  note?: string
  isPast: boolean
  isCancelled: boolean
  formattedDate: string
  formattedTime: string
  availability: {
    practiceDate: string
    availability: string
    note: string
  }
}

interface PracticeData {
  player: { fullName: string; playerId: string }
  availabilityOpen: boolean
  practices: PracticeItem[]
  availabilityOptions: {
    PLANNING: string
    CANT_MAKE: string
    NOT_SURE: string
  }
}

const cardStyle = { background: 'var(--card-bg)', borderColor: 'var(--border)' } as const

/** Shown when the player has no row in Practice Availability yet (docs/fall-2026/player-portal-grill.md Q3). */
export function AvailabilityNotOpenNotice() {
  return (
    <Card className="shadow-lg" style={cardStyle}>
      <CardContent className="py-4 text-sm" style={{ color: 'var(--primary-text)' }}>
        Availability tracking isn&apos;t open for you yet. If you think that&apos;s wrong, email the coaches at{' '}
        <a href={`mailto:${APP_CONFIG.COACH_EMAIL}`} className="underline" style={{ color: 'var(--accent)' }}>
          {APP_CONFIG.COACH_EMAIL}
        </a>
        .
      </CardContent>
    </Card>
  )
}

export function PracticesTab({ playerId }: { playerId: string }) {
  const [practiceData, setPracticeData] = useState<PracticeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    const fetchPractices = async () => {
      try {
        const response = await fetch(`/api/player/${playerId}/practice`)
        const data = await response.json()
        if (data.success) setPracticeData(data)
        else setError(data.error || 'Failed to load practice data')
      } catch {
        setError('Network error. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchPractices()
  }, [playerId])

  const updateAvailability = async (practiceDate: string, availability: string, note: string = '') => {
    setUpdating(practiceDate)
    try {
      const response = await fetch(`/api/player/${playerId}/practice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceDate, availability, note }),
      })
      const data = await response.json()
      if (data.success) {
        setPracticeData(prev =>
          prev
            ? {
                ...prev,
                practices: prev.practices.map(practice =>
                  practice.date === practiceDate ? { ...practice, availability: { practiceDate, availability, note } } : practice
                ),
              }
            : prev
        )
      } else {
        setError(data.error || 'Failed to update availability')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return (
      <Card className="shadow-lg" style={cardStyle}>
        <CardContent className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p style={{ color: 'var(--secondary-text)' }}>Loading practices...</p>
        </CardContent>
      </Card>
    )
  }

  if (error || !practiceData) {
    return (
      <Card className="shadow-lg" style={cardStyle}>
        <CardContent className="text-center py-8">
          <p style={{ color: 'var(--error-text, #f87171)' }}>{error || 'Unable to load practice information.'}</p>
        </CardContent>
      </Card>
    )
  }

  const { practices, availabilityOptions, availabilityOpen } = practiceData
  const upcomingPractices = practices.filter(p => !p.isPast)
  const pastPractices = practices.filter(p => p.isPast)
  const upcomingNoResponse = upcomingPractices.filter(p => !p.availability.availability).length
  const allUpcomingResponded = upcomingPractices.length > 0 && upcomingNoResponse === 0

  const renderCard = (practice: PracticeItem, editable: boolean) => (
    <AvailabilityCard
      key={practice.date}
      title={practice.formattedDate}
      subtitle={practice.formattedTime}
      location={practice.location}
      locationUrl={practice.locationUrl}
      availabilityOptions={availabilityOptions}
      currentAvailability={practice.availability.availability}
      currentNote={practice.availability.note}
      onUpdateAvailability={(availability, note) => updateAvailability(practice.date, availability, note)}
      isUpdating={updating === practice.date}
      isEditable={editable}
      isCancelled={practice.isCancelled}
    >
      {practice.note && (
        <div className="p-3 rounded-lg mt-2" style={{ background: 'var(--secondary-bg, var(--primary-bg))' }}>
          <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
            <strong>Coach Note:</strong> {practice.note}
          </p>
        </div>
      )}
      {practice.isPast && (
        <div className="text-right">
          <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-600">Past</span>
        </div>
      )}
    </AvailabilityCard>
  )

  return (
    <div className="space-y-6">
      {!availabilityOpen && <AvailabilityNotOpenNotice />}

      {availabilityOpen && (upcomingPractices.length > 0 || pastPractices.length > 0) && (
        <AvailabilitySummary
          title="Practice Summary"
          upcomingItems={upcomingPractices}
          pastItems={pastPractices}
          availabilityOptions={availabilityOptions}
          allUpcomingResponded={allUpcomingResponded}
          pastPresentValue="Was there"
          pastAbsentValue="Wasn't there"
        />
      )}

      {upcomingPractices.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--page-title)' }}>
            Upcoming Practices
          </h2>
          {upcomingPractices.map(practice => renderCard(practice, availabilityOpen))}
        </div>
      )}

      {pastPractices.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--page-title)' }}>
            Past Practices
          </h2>
          {pastPractices.map(practice => renderCard(practice, false))}
        </div>
      )}

      {practices.length === 0 && (
        <Card className="shadow-lg" style={cardStyle}>
          <CardContent className="text-center py-8">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: 'var(--secondary-text)' }} />
            <p style={{ color: 'var(--secondary-text)' }}>No practices scheduled yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
