"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Home, User, Calendar, Trophy } from 'lucide-react'

interface PlayerData {
  studentId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  grade: number;
  gender: string;
  dateOfBirth: string;
  finalFormsStatus: {
    parentSigned: boolean;
    studentSigned: boolean;
    physicalCleared: boolean;
    allCleared: boolean;
  };
  contacts: {
    parent1?: {
      firstName: string;
      lastName: string;
      email: string;
      mailingListStatus: string;
    };
    parent2?: {
      firstName: string;
      lastName: string;
      email: string;
      mailingListStatus: string;
    };
    studentEmails: {
      spsEmail?: string;
      personalEmail?: string;
      personalEmailMailingStatus?: string;
    };
  };
  additionalInfo?: {
    pronouns?: string;
    allergies?: string;
    competingSports?: string;
    jerseySize?: string;
    playingExperience?: string;
    playerHopes?: string;
    otherInfo?: string;
  };
  photos?: {
    download?: string;
    thumbnail?: string;
  };
}

type PortalScreen = 'season-info' | 'player-info' | 'practice-availability' | 'game-availability'

export default function PlayerPortal({ params }: { params: Promise<{ portalId: string }> }) {
  const [player, setPlayer] = useState<PlayerData | null>(null)
  const [activeScreen, setActiveScreen] = useState<PortalScreen>('season-info')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchPlayer = async () => {
      try {
        const resolvedParams = await params
        const response = await fetch(`/api/player/${resolvedParams.portalId}`)
        const data = await response.json()

        if (data.success) {
          setPlayer(data.player)
        } else {
          setError(data.error || 'Failed to load player data')
        }
      } catch (err) {
        setError('Network error. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchPlayer()
  }, [params])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading player portal...</p>
        </div>
      </div>
    )
  }

  if (error || !player) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-border/50 backdrop-blur-sm bg-card/95">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-card-foreground">{error}</p>
            <Button
              onClick={() => window.location.href = '/player-portal'}
              className="w-full mt-4 madison-gradient text-white hover:opacity-90"
            >
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const navItems = [
    { id: 'season-info' as const, label: 'Season Info', icon: Home },
    { id: 'player-info' as const, label: 'Player Info', icon: User },
    { id: 'practice-availability' as const, label: 'Practice', icon: Calendar },
    { id: 'game-availability' as const, label: 'Games', icon: Trophy },
  ]

  const renderContent = () => {
    switch (activeScreen) {
      case 'season-info':
        return <SeasonInfoScreen />
      case 'player-info':
        return <PlayerInfoScreen player={player} />
      case 'practice-availability':
        return <PracticeAvailabilityScreen />
      case 'game-availability':
        return <GameAvailabilityScreen />
      default:
        return <SeasonInfoScreen />
    }
  }

  return (
    <div className="min-h-screen" style={{background: 'var(--primary-bg)'}}>
      {/* Header */}
      <div className="shadow-sm border-b" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg" style={{background: 'var(--accent)'}}>
              <span className="text-white font-semibold text-sm">
                {player.firstName[0]}{player.lastName[0]}
              </span>
            </div>
            <div>
              <h1 className="font-semibold" style={{color: 'var(--page-title)'}}>{player.fullName}</h1>
              <p className="text-sm" style={{color: 'var(--secondary-text)'}}>Grade {player.grade}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 pb-24">
        {renderContent()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 border-t shadow-lg" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
        <div className="max-w-lg mx-auto">
          <nav className="flex">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeScreen === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveScreen(item.id)}
                  className="flex-1 py-3 px-2 text-center transition-colors"
                  style={{
                    color: isActive ? 'var(--page-title)' : 'var(--secondary-text)',
                    backgroundColor: isActive ? 'var(--primary-bg)' : 'transparent'
                  }}
                >
                  <Icon className="w-6 h-6 mx-auto mb-1" />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
  )
}

function SeasonInfoScreen() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
        <CardHeader>
          <CardTitle style={{color: 'var(--page-title)'}}>Welcome to Madison Ultimate!</CardTitle>
          <CardDescription style={{color: 'var(--secondary-header)'}}>Fall 2024 Season</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2" style={{color: 'var(--primary-text)'}}>Season Schedule</h3>
            <p style={{color: 'var(--secondary-text)'}}>Practices: Tuesdays & Thursdays, 3:30-5:00 PM</p>
            <p style={{color: 'var(--secondary-text)'}}>Games: Saturdays (schedule varies)</p>
          </div>

          <div>
            <h3 className="font-semibold mb-2" style={{color: 'var(--primary-text)'}}>Important Dates</h3>
            <ul className="space-y-1" style={{color: 'var(--secondary-text)'}}>
              <li>• Team Photos: October 15th</li>
              <li>• End of Season Tournament: November 20th</li>
              <li>• Awards Ceremony: December 5th</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2" style={{color: 'var(--primary-text)'}}>What to Bring</h3>
            <ul className="space-y-1" style={{color: 'var(--secondary-text)'}}>
              <li>• Water bottle</li>
              <li>• Athletic shoes with cleats (recommended)</li>
              <li>• Weather-appropriate clothing</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function PlayerInfoScreen({ player }: { player: PlayerData }) {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
        <CardHeader>
          <CardTitle style={{color: 'var(--page-title)'}}>Player Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm" style={{color: 'var(--secondary-text)'}}>Full Name</p>
              <p className="font-medium" style={{color: 'var(--primary-text)'}}>{player.fullName}</p>
            </div>
            <div>
              <p className="text-sm" style={{color: 'var(--secondary-text)'}}>Grade</p>
              <p className="font-medium" style={{color: 'var(--primary-text)'}}>{player.grade}</p>
            </div>
            <div>
              <p className="text-sm" style={{color: 'var(--secondary-text)'}}>Birth Date</p>
              <p className="font-medium" style={{color: 'var(--primary-text)'}}>{player.dateOfBirth}</p>
            </div>
            <div>
              <p className="text-sm" style={{color: 'var(--secondary-text)'}}>Jersey Size</p>
              <p className="font-medium" style={{color: 'var(--primary-text)'}}>{player.additionalInfo?.jerseySize || 'Not specified'}</p>
            </div>
          </div>

          {player.additionalInfo?.pronouns && (
            <div>
              <p className="text-sm" style={{color: 'var(--secondary-text)'}}>Pronouns</p>
              <p className="font-medium" style={{color: 'var(--primary-text)'}}>{player.additionalInfo.pronouns}</p>
            </div>
          )}

          {player.additionalInfo?.allergies && (
            <div>
              <p className="text-sm" style={{color: 'var(--secondary-text)'}}>Allergies</p>
              <p className="font-medium" style={{color: 'var(--primary-text)'}}>{player.additionalInfo.allergies}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
        <CardHeader>
          <CardTitle style={{color: 'var(--page-title)'}}>Final Forms Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span style={{color: 'var(--primary-text)'}}>Parent Signed</span>
              <span className="px-2 py-1 rounded text-sm font-medium" style={{
                backgroundColor: player.finalFormsStatus.parentSigned ? '#dcfce7' : '#fef2f2',
                color: player.finalFormsStatus.parentSigned ? '#166534' : '#dc2626'
              }}>
                {player.finalFormsStatus.parentSigned ? 'Complete' : 'Pending'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{color: 'var(--primary-text)'}}>Student Signed</span>
              <span className="px-2 py-1 rounded text-sm font-medium" style={{
                backgroundColor: player.finalFormsStatus.studentSigned ? '#dcfce7' : '#fef2f2',
                color: player.finalFormsStatus.studentSigned ? '#166534' : '#dc2626'
              }}>
                {player.finalFormsStatus.studentSigned ? 'Complete' : 'Pending'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span style={{color: 'var(--primary-text)'}}>Physical Clearance</span>
              <span className="px-2 py-1 rounded text-sm font-medium" style={{
                backgroundColor: player.finalFormsStatus.physicalCleared ? '#dcfce7' : '#fef2f2',
                color: player.finalFormsStatus.physicalCleared ? '#166534' : '#dc2626'
              }}>
                {player.finalFormsStatus.physicalCleared ? 'Cleared' : 'Pending'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
        <CardHeader>
          <CardTitle style={{color: 'var(--page-title)'}}>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {player.contacts.parent1 && (
            <div>
              <p className="text-sm" style={{color: 'var(--secondary-text)'}}>Parent/Guardian 1</p>
              <p className="font-medium" style={{color: 'var(--primary-text)'}}>{player.contacts.parent1.firstName} {player.contacts.parent1.lastName}</p>
              <p style={{color: 'var(--secondary-text)'}}>{player.contacts.parent1.email}</p>
            </div>
          )}

          {player.contacts.parent2 && (
            <div>
              <p className="text-sm" style={{color: 'var(--secondary-text)'}}>Parent/Guardian 2</p>
              <p className="font-medium" style={{color: 'var(--primary-text)'}}>{player.contacts.parent2.firstName} {player.contacts.parent2.lastName}</p>
              <p style={{color: 'var(--secondary-text)'}}>{player.contacts.parent2.email}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PracticeAvailabilityScreen() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
        <CardHeader>
          <CardTitle style={{color: 'var(--page-title)'}}>Practice Availability</CardTitle>
          <CardDescription style={{color: 'var(--secondary-header)'}}>Mark your availability for upcoming practices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8" style={{color: 'var(--secondary-text)'}}>
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Practice availability tracking</p>
            <p className="text-sm">Coming soon!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function GameAvailabilityScreen() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
        <CardHeader>
          <CardTitle style={{color: 'var(--page-title)'}}>Game Availability</CardTitle>
          <CardDescription style={{color: 'var(--secondary-header)'}}>Mark your availability for upcoming games</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8" style={{color: 'var(--secondary-text)'}}>
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Game availability tracking</p>
            <p className="text-sm">Coming soon!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}