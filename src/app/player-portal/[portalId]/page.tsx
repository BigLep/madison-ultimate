"use client"

import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from 'use-debounce'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Home, User, Calendar, Trophy, Clock, MapPin, MessageSquare } from 'lucide-react'
import { AvailabilityCard } from '../../../components/availability-card'
import { AvailabilitySummary } from '../../../components/availability-summary'
import { PRACTICE_CONFIG } from '../../../lib/practice-config'

interface PlayerData {
  studentId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  grade: number;
  gender: string;
  genderIdentification: string;
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
    questionnaireFilledOut?: boolean;
  };
  photos?: {
    download?: string;
    thumbnail?: string;
  };
}

interface Practice {
  date: string;
  location: string;
  startTime: string;
  endTime: string;
  note?: string;
  isPast: boolean;
  availabilityColumnIndex: number;
  noteColumnIndex: number;
  formattedDate: string;
  formattedTime: string;
  availability: {
    practiceDate: string;
    availability: string;
    note: string;
  };
}

interface PracticeData {
  player: {
    fullName: string;
    portalId: string;
  };
  practices: Practice[];
  availabilityOptions: {
    PLANNING: string;
    CANT_MAKE: string;
    NOT_SURE: string;
    OTHER: string;
  };
}

type PortalScreen = 'season-info' | 'player-info' | 'practice-availability' | 'game-availability'

export default function PlayerPortal({ params }: { params: Promise<{ portalId: string }> }) {
  const [player, setPlayer] = useState<PlayerData | null>(null)
  const [activeScreen, setActiveScreen] = useState<PortalScreen>('season-info')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Hash-to-screen mapping
  const hashToScreen: Record<string, PortalScreen> = {
    '#season': 'season-info',
    '#player': 'player-info',
    '#practices': 'practice-availability',
    '#games': 'game-availability'
  }

  const screenToHash: Record<PortalScreen, string> = {
    'season-info': '#season',
    'player-info': '#player',
    'practice-availability': '#practices',
    'game-availability': '#games'
  }

  // Handle initial hash and hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash
      const screen = hashToScreen[hash]
      if (screen) {
        setActiveScreen(screen)
      }
    }

    // Set initial screen from hash
    handleHashChange()

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Update hash when screen changes programmatically
  const changeScreen = (screen: PortalScreen) => {
    const hash = screenToHash[screen]
    window.location.hash = hash
    setActiveScreen(screen)
  }

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

  // Update page title when player data is loaded
  useEffect(() => {
    if (player?.fullName) {
      document.title = `Madison Ultimate - ${player.fullName}`
    } else {
      document.title = 'Madison Ultimate'
    }

    // Cleanup function to reset title when component unmounts
    return () => {
      document.title = 'Madison Ultimate'
    }
  }, [player?.fullName])

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
    { id: 'practice-availability' as const, label: 'Practices', icon: Calendar },
    { id: 'game-availability' as const, label: 'Games', icon: Trophy },
  ]

  const renderContent = () => {
    switch (activeScreen) {
      case 'season-info':
        return <SeasonInfoScreen />
      case 'player-info':
        return <PlayerInfoScreen player={player} />
      case 'practice-availability':
        return <PracticeAvailabilityScreen params={params} />
      case 'game-availability':
        return <GameAvailabilityScreen params={params} />
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
                  onClick={() => changeScreen(item.id)}
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
  // URL constants for easy maintenance
  const SEASON_INFO_URL = 'https://madisonultimate.notion.site/2025-Fall-Madison-Ultimate-265c4da46f7580e8ad0cc5c3fb2315f5';

  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch('/api/group-messages?maxResults=3');
        const data = await response.json();
        if (data.success) {
          setMessages(data.messages);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, []);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
        <CardHeader>
          <CardTitle style={{color: 'var(--page-title)'}}>Welcome to Madison Ultimate!</CardTitle>
          <CardDescription style={{color: 'var(--secondary-header)'}}>Fall 2025 Season</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p style={{color: 'var(--primary-text)'}}>
              You can learn more about the season at our{' '}
              <a
                href={SEASON_INFO_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{color: 'var(--accent)', textDecoration: 'underline'}}
              >
                team site
              </a>
              . This portal contains player specific information.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
        <CardHeader>
          <CardTitle style={{color: 'var(--page-title)'}}>Recent Team Updates</CardTitle>
          <CardDescription style={{color: 'var(--secondary-header)'}}>Messages from the team mailing list</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4" style={{color: 'var(--secondary-text)'}}>
              Loading recent updates...
            </div>
          ) : messages.length > 0 ? (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div key={message.id} className="pb-4 border-b last:border-b-0" style={{borderColor: 'var(--border)'}}>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-sm" style={{color: 'var(--primary-text)'}}>{message.subject}</h4>
                    <span className="text-xs" style={{color: 'var(--secondary-text)'}}>
                      {new Date(message.date).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs mb-1" style={{color: 'var(--secondary-text)'}}>From: {message.from}</p>
                  <p className="text-sm" style={{color: 'var(--primary-text)'}}>{message.snippet}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4" style={{color: 'var(--secondary-text)'}}>
              No recent team updates available.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PlayerInfoScreen({ player }: { player: PlayerData }) {
  // URL constants for easy maintenance
  const ADDITIONAL_INFO_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfOO0ybkvfs0GTBvP6tC95HT3JlGVWkSzlYghDITpw_38_hPA/viewform?usp=dialog';
  const MAILING_LIST_INFO_URL = 'https://madisonultimate.notion.site/More-Season-Info-265c4da46f7580668995df287590039f#265c4da46f75812981c1ee2b8d88e956';

  // Helper function to get mailing list status indicator
  const getMailingListIndicator = (status: string) => {
    const lowerStatus = status?.toLowerCase();
    if (lowerStatus === 'member') return '✅';
    if (lowerStatus === 'invited') return '⚠️';
    if (lowerStatus === 'not a member') return '❌';
    return '❓';
  };

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
              <p className="text-sm" style={{color: 'var(--secondary-text)'}}>Gender Identification</p>
              <p className="font-medium" style={{color: 'var(--primary-text)'}}>{player.genderIdentification || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm" style={{color: 'var(--secondary-text)'}}>Pronouns</p>
              <p className="font-medium" style={{color: 'var(--primary-text)'}}>{player.additionalInfo?.pronouns || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm" style={{color: 'var(--secondary-text)'}}>
                <a href={ADDITIONAL_INFO_FORM_URL} target="_blank" rel="noopener noreferrer" style={{color: 'var(--accent)', textDecoration: 'underline'}}>
                  Additional Info Form
                </a>
              </p>
              <p className="font-medium" style={{color: 'var(--primary-text)'}}>
                {player.additionalInfo?.questionnaireFilledOut ? '✅ Yes' : 'No'}
              </p>
            </div>
            <div>
              <p className="text-sm" style={{color: 'var(--secondary-text)'}}>Allergies</p>
              <p className="font-medium" style={{color: 'var(--primary-text)'}}>{player.additionalInfo?.allergies || 'None reported'}</p>
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
              <p className="text-sm" style={{color: 'var(--secondary-text)'}}>Caretaker 1</p>
              <p className="font-medium" style={{color: 'var(--primary-text)'}}>{player.contacts.parent1.firstName} {player.contacts.parent1.lastName}</p>
              <p style={{color: 'var(--secondary-text)'}}>{player.contacts.parent1.email}</p>
              <p className="text-xs" style={{color: 'var(--secondary-text)'}}>
                <a href={MAILING_LIST_INFO_URL} target="_blank" rel="noopener noreferrer" style={{color: 'var(--accent)', textDecoration: 'underline'}}>
                  Mailing List
                </a>: {getMailingListIndicator(player.contacts.parent1.mailingListStatus)} {player.contacts.parent1.mailingListStatus || 'Unknown'}
              </p>
            </div>
          )}

          {player.contacts.parent2 && (
            <div>
              <p className="text-sm" style={{color: 'var(--secondary-text)'}}>Caretaker 2</p>
              <p className="font-medium" style={{color: 'var(--primary-text)'}}>{player.contacts.parent2.firstName} {player.contacts.parent2.lastName}</p>
              <p style={{color: 'var(--secondary-text)'}}>{player.contacts.parent2.email}</p>
              <p className="text-xs" style={{color: 'var(--secondary-text)'}}>
                <a href={MAILING_LIST_INFO_URL} target="_blank" rel="noopener noreferrer" style={{color: 'var(--accent)', textDecoration: 'underline'}}>
                  Mailing List
                </a>: {getMailingListIndicator(player.contacts.parent2.mailingListStatus)} {player.contacts.parent2.mailingListStatus || 'Unknown'}
              </p>
            </div>
          )}

          {player.contacts.studentEmails.spsEmail && (
            <div>
              <p className="text-sm" style={{color: 'var(--secondary-text)'}}>Student SPS Email</p>
              <p className="font-medium" style={{color: 'var(--primary-text)'}}>{player.contacts.studentEmails.spsEmail}</p>
              <p className="text-xs" style={{color: 'var(--secondary-text)'}}>
                <a href={MAILING_LIST_INFO_URL} target="_blank" rel="noopener noreferrer" style={{color: 'var(--accent)', textDecoration: 'underline'}}>
                  Mailing List
                </a>: n/a
              </p>
            </div>
          )}

          {player.contacts.studentEmails.personalEmail && (
            <div>
              <p className="text-sm" style={{color: 'var(--secondary-text)'}}>Student Personal Email</p>
              <p className="font-medium" style={{color: 'var(--primary-text)'}}>{player.contacts.studentEmails.personalEmail}</p>
              <p className="text-xs" style={{color: 'var(--secondary-text)'}}>
                <a href={MAILING_LIST_INFO_URL} target="_blank" rel="noopener noreferrer" style={{color: 'var(--accent)', textDecoration: 'underline'}}>
                  Mailing List
                </a>: {getMailingListIndicator(player.contacts.studentEmails.personalEmailMailingStatus)} {player.contacts.studentEmails.personalEmailMailingStatus || 'Unknown'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PracticeAvailabilityScreen({ params }: { params: Promise<{ portalId: string }> }) {
  const [practiceData, setPracticeData] = useState<PracticeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const fetchPractices = async () => {
      try {
        const resolvedParams = await params;
        const response = await fetch(`/api/practice/${resolvedParams.portalId}`);
        const data = await response.json();

        if (data.success) {
          setPracticeData(data);
        } else {
          setError(data.error || 'Failed to load practice data');
        }
      } catch (err) {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchPractices();
  }, [params]);

  const updateAvailability = async (practiceDate: string, availability: string, note: string = '') => {
    setUpdating(practiceDate);
    try {
      const resolvedParams = await params;
      const response = await fetch(`/api/practice/${resolvedParams.portalId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          practiceDate,
          availability,
          note,
          fullName: practiceData?.player.fullName,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        setPracticeData(prev => {
          if (!prev) return prev;

          return {
            ...prev,
            practices: prev.practices.map(practice =>
              practice.date === practiceDate
                ? {
                    ...practice,
                    availability: {
                      practiceDate,
                      availability,
                      note,
                    }
                  }
                : practice
            )
          };
        });
      } else {
        setError(data.error || 'Failed to update availability');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="shadow-lg" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
          <CardContent className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p style={{color: 'var(--secondary-text)'}}>Loading practices...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !practiceData) {
    return (
      <div className="space-y-6">
        <Card className="shadow-lg" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
          <CardContent className="text-center py-8">
            <p style={{color: 'var(--error-text)'}}>{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { practices, availabilityOptions } = practiceData;
  const upcomingPractices = practices.filter(p => !p.isPast);
  const pastPractices = practices.filter(p => p.isPast);

  // Calculate summary stats
  const upcomingNoResponse = upcomingPractices.filter(p => !p.availability.availability).length;
  const upcomingPlanToMake = upcomingPractices.filter(p => p.availability.availability === availabilityOptions.PLANNING).length;
  const upcomingCantMake = upcomingPractices.filter(p => p.availability.availability === availabilityOptions.CANT_MAKE).length;
  const upcomingNotSure = upcomingPractices.filter(p => p.availability.availability === availabilityOptions.NOT_SURE).length;
  const pastWasPresent = pastPractices.filter(p => p.availability.availability === 'Was there').length;
  const pastWasntPresent = pastPractices.filter(p => p.availability.availability === "Wasn't there").length;

  // Check if all upcoming practices have responses
  const allUpcomingResponded = upcomingPractices.length > 0 && upcomingNoResponse === 0;

  return (
    <div className="space-y-6">
      {/* Practice Summary Stats */}
      {(upcomingPractices.length > 0 || pastPractices.length > 0) && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold" style={{color: 'var(--page-title)'}}>Practice Summary</h2>
            {allUpcomingResponded && (
              <span className="text-green-600 text-lg">✓</span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm">
            {/* Upcoming practices stats - always show all */}
            {upcomingPractices.length > 0 && (
              <>
                <div className={`flex justify-between items-center py-2 px-3 rounded-lg border ${upcomingNoResponse > 0 ? 'bg-blue-100 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex-1">
                    <div className={`flex items-center gap-2 ${upcomingNoResponse > 0 ? 'text-blue-800' : 'text-gray-600'}`}>
                      <span>❗</span>
                      <span>Haven't entered availability for</span>
                    </div>
                    {upcomingNoResponse > 0 && (
                      <div className="text-xs text-blue-700 mt-1">👇 Enter your availability below</div>
                    )}
                  </div>
                  <span className={`font-semibold ${upcomingNoResponse > 0 ? 'text-blue-800' : 'text-gray-600'}`}>{upcomingNoResponse}</span>
                </div>
                <div className={`flex justify-between items-center py-2 px-3 rounded-lg border ${upcomingPlanToMake > 0 ? 'bg-green-100 border-green-300' : 'bg-gray-50 border-gray-200'}`}>
                  <span className={`flex items-center gap-2 ${upcomingPlanToMake > 0 ? 'text-green-800' : 'text-gray-600'}`}>
                    <span>👍</span>
                    <span>Planning to attend</span>
                  </span>
                  <span className={`font-semibold ${upcomingPlanToMake > 0 ? 'text-green-800' : 'text-gray-600'}`}>{upcomingPlanToMake}</span>
                </div>
                <div className={`flex justify-between items-center py-2 px-3 rounded-lg border ${upcomingCantMake > 0 ? 'bg-red-100 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
                  <span className={`flex items-center gap-2 ${upcomingCantMake > 0 ? 'text-red-800' : 'text-gray-600'}`}>
                    <span>👎</span>
                    <span>Can't make it</span>
                  </span>
                  <span className={`font-semibold ${upcomingCantMake > 0 ? 'text-red-800' : 'text-gray-600'}`}>{upcomingCantMake}</span>
                </div>
                <div className={`flex justify-between items-center py-2 px-3 rounded-lg border ${upcomingNotSure > 0 ? 'bg-yellow-100 border-yellow-300' : 'bg-gray-50 border-gray-200'}`}>
                  <span className={`flex items-center gap-2 ${upcomingNotSure > 0 ? 'text-yellow-800' : 'text-gray-600'}`}>
                    <span>❓</span>
                    <span>Not sure yet</span>
                  </span>
                  <span className={`font-semibold ${upcomingNotSure > 0 ? 'text-yellow-800' : 'text-gray-600'}`}>{upcomingNotSure}</span>
                </div>
              </>
            )}
            {/* Past practices stats - always show all */}
            {pastPractices.length > 0 && (
              <>
                <div className={`flex justify-between items-center py-2 px-3 rounded-lg border ${pastWasPresent > 0 ? 'bg-blue-100 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                  <span className={pastWasPresent > 0 ? 'text-blue-800' : 'text-gray-600'}>Was present</span>
                  <span className={`font-semibold ${pastWasPresent > 0 ? 'text-blue-800' : 'text-gray-600'}`}>{pastWasPresent}</span>
                </div>
                <div className={`flex justify-between items-center py-2 px-3 rounded-lg border ${pastWasntPresent > 0 ? 'bg-gray-100 border-gray-300' : 'bg-gray-50 border-gray-200'}`}>
                  <span className={pastWasntPresent > 0 ? 'text-gray-800' : 'text-gray-600'}>Wasn't present</span>
                  <span className={`font-semibold ${pastWasntPresent > 0 ? 'text-gray-800' : 'text-gray-600'}`}>{pastWasntPresent}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Upcoming Practices */}
      {upcomingPractices.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold" style={{color: 'var(--page-title)'}}>Upcoming Practices</h2>
          {upcomingPractices.map((practice) => (
            <PracticeCard
              key={practice.date}
              practice={practice}
              availabilityOptions={availabilityOptions}
              onUpdateAvailability={updateAvailability}
              isUpdating={updating === practice.date}
              isEditable={true}
            />
          ))}
        </div>
      )}

      {/* Past Practices */}
      {pastPractices.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold" style={{color: 'var(--page-title)'}}>Past Practices</h2>
          {pastPractices.map((practice) => (
            <PracticeCard
              key={practice.date}
              practice={practice}
              availabilityOptions={availabilityOptions}
              onUpdateAvailability={updateAvailability}
              isUpdating={false}
              isEditable={false}
            />
          ))}
        </div>
      )}

      {practices.length === 0 && (
        <Card className="shadow-lg" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
          <CardContent className="text-center py-8">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" style={{color: 'var(--secondary-text)'}} />
            <p style={{color: 'var(--secondary-text)'}}>No practices scheduled yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PracticeCard({
  practice,
  availabilityOptions,
  onUpdateAvailability,
  isUpdating,
  isEditable
}: {
  practice: Practice;
  availabilityOptions: PracticeData['availabilityOptions'];
  onUpdateAvailability: (date: string, availability: string, note: string) => void;
  isUpdating: boolean;
  isEditable: boolean;
}) {
  const [selectedAvailability, setSelectedAvailability] = useState(practice.availability.availability);
  const [note, setNote] = useState(practice.availability.note);

  // Debounce the note value - wait before auto-saving
  const [debouncedNote] = useDebounce(note, PRACTICE_CONFIG.NOTE_DEBOUNCE_DELAY);

  const handleAvailabilityChange = (availability: string) => {
    setSelectedAvailability(availability);
    onUpdateAvailability(practice.date, availability, note);
  };

  const handleNoteChange = (newNote: string) => {
    setNote(newNote);
    // Note: We don't call onUpdateAvailability here anymore - it's handled by the useEffect below
  };

  // Auto-save when debounced note changes
  useEffect(() => {
    // Only save if the debounced note is different from the initial note
    // and we're not currently updating
    if (debouncedNote !== practice.availability.note && !isUpdating) {
      onUpdateAvailability(practice.date, selectedAvailability, debouncedNote);
    }
  }, [debouncedNote, practice.date, selectedAvailability, practice.availability.note, onUpdateAvailability, isUpdating]);

  // Helper function to check if a string is a URL
  const isUrl = (text: string) => {
    try {
      new URL(text);
      return true;
    } catch {
      return false;
    }
  };

  // Helper function to render location as link if it has a URL
  const renderLocation = (location: string, locationUrl?: string | null) => {
    if (locationUrl) {
      return (
        <a
          href={locationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:no-underline"
          style={{color: 'var(--accent)'}}
        >
          {location}
        </a>
      );
    }
    return location;
  };

  // Helper function to get button styling based on availability
  const getButtonStyle = (value: string, isSelected: boolean) => {
    if (!isSelected) {
      return "bg-white border-gray-300 text-gray-700 hover:bg-gray-50";
    }

    if (value === availabilityOptions.PLANNING) {
      return "bg-green-100 border-green-300 text-green-800 hover:bg-green-200";
    } else if (value === availabilityOptions.CANT_MAKE) {
      return "bg-red-100 border-red-300 text-red-800 hover:bg-red-200";
    } else {
      return "bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200";
    }
  };

  return (
    <Card className="shadow-lg" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg" style={{color: 'var(--page-title)'}}>
              {practice.formattedDate}
            </CardTitle>
            <CardDescription style={{color: 'var(--secondary-header)'}}>
              {practice.formattedTime}
            </CardDescription>
          </div>
          {practice.isPast && (
            <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-600">
              Past
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Practice Details */}
        <div className="flex items-center gap-4 text-sm" style={{color: 'var(--secondary-text)'}}>
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {renderLocation(practice.location, practice.locationUrl)}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {practice.formattedTime}
          </div>
        </div>

        {/* Coach Note */}
        {practice.note && (
          <div className="p-3 rounded-lg" style={{background: 'var(--secondary-bg)'}}>
            <p className="text-sm" style={{color: 'var(--secondary-text)'}}>
              <strong>Coach Note:</strong> {practice.note}
            </p>
          </div>
        )}

        {/* Availability Selection */}
        {isEditable ? (
          <div className="space-y-3">
            <p className="text-sm font-medium" style={{color: 'var(--primary-text)'}}>
              Your availability:
            </p>
            <div className="space-y-2">
              {Object.entries(availabilityOptions).map(([key, value]) => {
                const isSelected = selectedAvailability === value;
                return (
                  <button
                    key={key}
                    onClick={() => handleAvailabilityChange(value)}
                    disabled={isUpdating}
                    className={`w-full text-left justify-start py-3 px-4 rounded-lg border transition-colors ${getButtonStyle(value, isSelected)}`}
                  >
                    <span className="text-sm font-medium">{value}</span>
                  </button>
                );
              })}
            </div>

            {/* Note Input - Always Visible */}
            <div className="space-y-2">
              <label className="text-xs font-medium" style={{color: 'var(--primary-text)'}}>
                Note (optional):
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => handleNoteChange(e.target.value)}
                placeholder="Add a note..."
                className="w-full px-3 py-2 text-sm border rounded-md"
                style={{
                  background: 'var(--card-bg)',
                  borderColor: 'var(--border)',
                  color: 'var(--primary-text)'
                }}
                disabled={isUpdating}
              />
            </div>

            {isUpdating && (
              <div className="flex items-center gap-2 text-sm" style={{color: 'var(--secondary-text)'}}>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                Updating...
              </div>
            )}
          </div>
        ) : (
          // Read-only display for past practices
          <div className="space-y-2">
            <p className="text-sm font-medium" style={{color: 'var(--primary-text)'}}>
              Your response:
            </p>
            <div className="p-2 rounded-md" style={{background: 'var(--secondary-bg)'}}>
              <p className="text-sm" style={{color: 'var(--primary-text)'}}>
                {selectedAvailability || 'No response'}
              </p>
              {note && (
                <p className="text-xs mt-1" style={{color: 'var(--secondary-text)'}}>
                  Note: {note}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GameAvailabilityScreen({ params }: { params: Promise<{ portalId: string }> }) {
  const [gameData, setGameData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const fetchGameData = async () => {
      try {
        const resolvedParams = await params;
        const response = await fetch(`/api/game/${resolvedParams.portalId}`);
        const data = await response.json();

        if (data.success) {
          setGameData(data);
        } else {
          console.error('Failed to fetch game data:', data.error);
        }
      } catch (error) {
        console.error('Error fetching game data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGameData();
  }, [params]);

  const updateAvailability = async (gameKey: string, availability: string, note: string) => {
    if (!gameData?.player?.fullName) {
      console.error('Cannot update availability: player data not loaded yet');
      return;
    }

    setUpdating(gameKey);
    try {
      const resolvedParams = await params;
      const requestBody = {
        gameKey,
        availability,
        note,
        fullName: gameData.player.fullName,
      };

      // Debug logging
      console.log('Sending request body:', requestBody);

      const response = await fetch(`/api/game/${resolvedParams.portalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      if (result.success) {
        // Update the local state
        setGameData((prev: any) => ({
          ...prev,
          games: prev.games.map((game: any) =>
            game.gameKey === gameKey
              ? { ...game, availability: { gameKey, availability, note } }
              : game
          )
        }));
      } else {
        console.error('Failed to update availability:', result.error);
      }
    } catch (error) {
      console.error('Error updating availability:', error);
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="shadow-lg" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
          <CardContent className="text-center py-8">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" style={{color: 'var(--secondary-text)'}} />
            <p style={{color: 'var(--secondary-text)'}}>Loading game information...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!gameData) {
    return (
      <div className="space-y-6">
        <Card className="shadow-lg" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
          <CardContent className="text-center py-8">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" style={{color: 'var(--secondary-text)'}} />
            <p style={{color: 'var(--secondary-text)'}}>Unable to load game information.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { games, availabilityOptions, player } = gameData;
  const upcomingGames = games.filter((g: any) => !g.isPast);
  const pastGames = games.filter((g: any) => g.isPast);

  // Check if all upcoming games have responses
  const allUpcomingResponded = upcomingGames.length > 0 && upcomingGames.filter((g: any) => !g.availability.availability).length === 0;

  return (
    <div className="space-y-6">
      {/* Game Summary Stats */}
      {(upcomingGames.length > 0 || pastGames.length > 0) && (
        <AvailabilitySummary
          title={`${player.team} Team Game Summary`}
          upcomingItems={upcomingGames}
          pastItems={pastGames}
          availabilityOptions={availabilityOptions}
          allUpcomingResponded={allUpcomingResponded}
        />
      )}

      {/* Upcoming Games */}
      {upcomingGames.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold" style={{color: 'var(--page-title)'}}>Upcoming Games</h2>
          {upcomingGames.map((game: any) => (
            <AvailabilityCard
              key={game.gameKey}
              title={`${game.team} Game #${game.gameNumber}: ${game.formattedDate}`}
              subtitle=""
              location={game.location}
              locationUrl={game.locationUrl}
              availabilityOptions={availabilityOptions}
              currentAvailability={game.availability.availability}
              currentNote={game.availability.note}
              onUpdateAvailability={(availability, note) => updateAvailability(game.gameKey, availability, note)}
              isUpdating={updating === game.gameKey}
              isEditable={true}
            >
              <div className="space-y-1">
                <div>Arrival for warmups: {game.formattedWarmupTime}</div>
                <div>Game start: {game.formattedGameStart}</div>
                <div>Done by: {game.formattedDoneBy}</div>
                {game.note && (
                  <div className="text-xs italic mt-2" style={{color: 'var(--secondary-text)'}}>
                    Coach note: {game.note}
                  </div>
                )}
              </div>
            </AvailabilityCard>
          ))}
        </div>
      )}

      {/* Past Games */}
      {pastGames.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold" style={{color: 'var(--page-title)'}}>Past Games</h2>
          {pastGames.map((game: any) => (
            <AvailabilityCard
              key={game.gameKey}
              title={`${game.team} Game #${game.gameNumber}: ${game.formattedDate}`}
              subtitle=""
              location={game.location}
              locationUrl={game.locationUrl}
              availabilityOptions={availabilityOptions}
              currentAvailability={game.availability.availability}
              currentNote={game.availability.note}
              onUpdateAvailability={() => {}} // No updates for past games
              isUpdating={false}
              isEditable={false}
            >
              <div className="space-y-1">
                <div>Arrival for warmups: {game.formattedWarmupTime}</div>
                <div>Game start: {game.formattedGameStart}</div>
                <div>Done by: {game.formattedDoneBy}</div>
                {game.note && (
                  <div className="text-xs italic mt-2" style={{color: 'var(--secondary-text)'}}>
                    Coach note: {game.note}
                  </div>
                )}
              </div>
            </AvailabilityCard>
          ))}
        </div>
      )}

      {games.length === 0 && (
        <Card className="shadow-lg" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
          <CardContent className="text-center py-8">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" style={{color: 'var(--secondary-text)'}} />
            <p style={{color: 'var(--secondary-text)'}}>No games scheduled for the {player.team} team yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}