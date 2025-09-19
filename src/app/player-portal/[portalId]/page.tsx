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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading player portal...</p>
        </div>
      </div>
    )
  }

  if (error || !player) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{error}</p>
            <Button
              onClick={() => window.location.href = '/player-portal'}
              className="w-full mt-4"
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {player.firstName[0]}{player.lastName[0]}
              </span>
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">{player.fullName}</h1>
              <p className="text-sm text-gray-600">Grade {player.grade}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 pb-24">
        {renderContent()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-lg mx-auto">
          <nav className="flex">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeScreen === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveScreen(item.id)}
                  className={`flex-1 py-3 px-2 text-center transition-colors ${
                    isActive
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-blue-600'
                  }`}
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
      <Card>
        <CardHeader>
          <CardTitle>Welcome to Madison Ultimate!</CardTitle>
          <CardDescription>Fall 2024 Season</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Season Schedule</h3>
            <p className="text-gray-600">Practices: Tuesdays & Thursdays, 3:30-5:00 PM</p>
            <p className="text-gray-600">Games: Saturdays (schedule varies)</p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Important Dates</h3>
            <ul className="text-gray-600 space-y-1">
              <li>• Team Photos: October 15th</li>
              <li>• End of Season Tournament: November 20th</li>
              <li>• Awards Ceremony: December 5th</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">What to Bring</h3>
            <ul className="text-gray-600 space-y-1">
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
      <Card>
        <CardHeader>
          <CardTitle>Player Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Full Name</p>
              <p className="font-medium">{player.fullName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Grade</p>
              <p className="font-medium">{player.grade}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Birth Date</p>
              <p className="font-medium">{player.dateOfBirth}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Jersey Size</p>
              <p className="font-medium">{player.additionalInfo?.jerseySize || 'Not specified'}</p>
            </div>
          </div>

          {player.additionalInfo?.pronouns && (
            <div>
              <p className="text-sm text-gray-600">Pronouns</p>
              <p className="font-medium">{player.additionalInfo.pronouns}</p>
            </div>
          )}

          {player.additionalInfo?.allergies && (
            <div>
              <p className="text-sm text-gray-600">Allergies</p>
              <p className="font-medium">{player.additionalInfo.allergies}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Final Forms Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span>Parent Signed</span>
              <span className={`px-2 py-1 rounded text-sm ${
                player.finalFormsStatus.parentSigned ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {player.finalFormsStatus.parentSigned ? 'Complete' : 'Pending'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Student Signed</span>
              <span className={`px-2 py-1 rounded text-sm ${
                player.finalFormsStatus.studentSigned ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {player.finalFormsStatus.studentSigned ? 'Complete' : 'Pending'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Physical Clearance</span>
              <span className={`px-2 py-1 rounded text-sm ${
                player.finalFormsStatus.physicalCleared ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {player.finalFormsStatus.physicalCleared ? 'Cleared' : 'Pending'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {player.contacts.parent1 && (
            <div>
              <p className="text-sm text-gray-600">Parent/Guardian 1</p>
              <p className="font-medium">{player.contacts.parent1.firstName} {player.contacts.parent1.lastName}</p>
              <p className="text-gray-600">{player.contacts.parent1.email}</p>
            </div>
          )}

          {player.contacts.parent2 && (
            <div>
              <p className="text-sm text-gray-600">Parent/Guardian 2</p>
              <p className="font-medium">{player.contacts.parent2.firstName} {player.contacts.parent2.lastName}</p>
              <p className="text-gray-600">{player.contacts.parent2.email}</p>
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
      <Card>
        <CardHeader>
          <CardTitle>Practice Availability</CardTitle>
          <CardDescription>Mark your availability for upcoming practices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
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
      <Card>
        <CardHeader>
          <CardTitle>Game Availability</CardTitle>
          <CardDescription>Mark your availability for upcoming games</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Game availability tracking</p>
            <p className="text-sm">Coming soon!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}