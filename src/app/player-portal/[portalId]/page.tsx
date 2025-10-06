"use client"

import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from 'use-debounce'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Home, User, Calendar, Trophy, Clock, MapPin, MessageSquare, HelpCircle } from 'lucide-react'
import { AvailabilityCard } from '../../../components/availability-card'
import { AvailabilitySummary } from '../../../components/availability-summary'
import { PWAInstallBanner } from '../../../components/pwa-install-banner'
import { PRACTICE_CONFIG } from '../../../lib/practice-config'
import { APP_CONFIG } from '../../../lib/app-config'

// URL constants for easy maintenance
const ADDITIONAL_INFO_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfOO0ybkvfs0GTBvP6tC95HT3JlGVWkSzlYghDITpw_38_hPA/viewform?usp=dialog';
const MAILING_LIST_INFO_URL = 'https://madisonultimate.notion.site/More-Season-Info-265c4da46f7580668995df287590039f#265c4da46f75812981c1ee2b8d88e956';

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
  locationUrl?: string | null;
  startTime: string;
  endTime: string;
  note?: string;
  isPast: boolean;
  isCancelled: boolean;
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

type PortalScreen = 'home' | 'player-info' | 'practice-availability' | 'game-availability'

// Helper function to get team display
const getTeamDisplay = (team?: string) => {
  if (!team) return 'Not assigned';

  switch (team.toLowerCase()) {
    case 'blue':
      return '🟦 Blue';
    case 'gold':
      return '🟨 Gold';
    case 'practice squad':
      return '🏋️ Practice Squad';
    default:
      return team;
  }
};

export default function PlayerPortal({ params }: { params: Promise<{ portalId: string }> }) {
  const [player, setPlayer] = useState<PlayerData | null>(null)
  const [activeScreen, setActiveScreen] = useState<PortalScreen>('home')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Hash-to-screen mapping
  const hashToScreen: Record<string, PortalScreen> = {
    '#home': 'home',
    '#season': 'home', // Legacy support
    '#help': 'home', // Legacy support
    '#player': 'player-info',
    '#practices': 'practice-availability',
    '#games': 'game-availability'
  }

  const screenToHash: Record<PortalScreen, string> = {
    'home': '#home',
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

  // Update page title and PWA metadata when player data is loaded
  // Delay DOM manipulation until after hydration to prevent hydration errors
  useEffect(() => {
    const updatePWAMetadata = async () => {
      // Wait for next tick to ensure hydration is complete
      await new Promise(resolve => setTimeout(resolve, 0))

      if (player?.fullName) {
        document.title = `Madison Ultimate - ${player.fullName}`

        // Add PWA metadata
        const resolvedParams = await params
        const portalId = resolvedParams.portalId

        // Add manifest link
        let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement
        if (!manifestLink) {
          manifestLink = document.createElement('link')
          manifestLink.rel = 'manifest'
          document.head.appendChild(manifestLink)
        }
        manifestLink.href = `/api/manifest/${portalId}`

        // Add theme color meta tag
        let themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement
        if (!themeColorMeta) {
          themeColorMeta = document.createElement('meta')
          themeColorMeta.name = 'theme-color'
          document.head.appendChild(themeColorMeta)
        }
        themeColorMeta.content = '#1e3a8a'

        // Add apple touch icon meta tags for iOS
        let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement
        if (!appleTouchIcon) {
          appleTouchIcon = document.createElement('link')
          appleTouchIcon.rel = 'apple-touch-icon'
          document.head.appendChild(appleTouchIcon)
        }
        appleTouchIcon.href = "/images/madison-ultimate-logo-1/180.png"

        // Add apple mobile web app capable
        let appleMobileCapable = document.querySelector('meta[name="apple-mobile-web-app-capable"]') as HTMLMetaElement
        if (!appleMobileCapable) {
          appleMobileCapable = document.createElement('meta')
          appleMobileCapable.name = 'apple-mobile-web-app-capable'
          document.head.appendChild(appleMobileCapable)
        }
        appleMobileCapable.content = 'yes'

        // Add apple mobile web app status bar style
        let appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]') as HTMLMetaElement
        if (!appleStatusBar) {
          appleStatusBar = document.createElement('meta')
          appleStatusBar.name = 'apple-mobile-web-app-status-bar-style'
          document.head.appendChild(appleStatusBar)
        }
        appleStatusBar.content = 'default'

        // Register service worker
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
              console.log('SW registered: ', registration)
            })
            .catch((registrationError) => {
              console.log('SW registration failed: ', registrationError)
            })
        }
      } else {
        document.title = 'Madison Ultimate'
      }
    }

    updatePWAMetadata()

    // Cleanup function to reset title and remove PWA metadata when component unmounts
    return () => {
      document.title = 'Madison Ultimate'
      // Remove PWA-specific metadata on cleanup
      const manifestLink = document.querySelector('link[rel="manifest"]')
      const themeColorMeta = document.querySelector('meta[name="theme-color"]')
      const appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]')
      const appleMobileCapable = document.querySelector('meta[name="apple-mobile-web-app-capable"]')
      const appleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')

      manifestLink?.remove()
      themeColorMeta?.remove()
      appleTouchIcon?.remove()
      appleMobileCapable?.remove()
      appleStatusBar?.remove()
    }
  }, [player?.fullName, params])

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
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'player-info' as const, label: 'Player', icon: User },
    { id: 'practice-availability' as const, label: 'Practices', icon: Calendar },
    { id: 'game-availability' as const, label: 'Games', icon: Trophy },
  ]

  const renderContent = () => {
    switch (activeScreen) {
      case 'home':
        return <HomeScreen />
      case 'player-info':
        return <PlayerInfoScreen player={player} />
      case 'practice-availability':
        return <PracticeAvailabilityScreen params={params} />
      case 'game-availability':
        return <GameAvailabilityScreen params={params} />
      default:
        return <HomeScreen />
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{background: 'var(--primary-bg)'}}>
      {/* Header - Always visible */}
      <div className="sticky top-0 z-50 shadow-sm border-b" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg" style={{background: 'var(--accent)'}}>
              <span className="text-white font-semibold text-sm">
                {player.firstName[0]}{player.lastName[0]}
              </span>
            </div>
            <div>
              <h1 className="font-semibold" style={{color: 'var(--page-title)'}}>{player.fullName}</h1>
              <p className="text-sm" style={{color: 'var(--secondary-text)'}}>
                {((player as any).team ? getTeamDisplay((player as any).team) : 'Not assigned')} | {player.genderIdentification || 'Not specified'} | Grade {player.grade}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content - Scrollable area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-6 pb-24">
          {renderContent()}
        </div>
      </div>

      {/* Bottom Navigation - Always visible with Safari-safe spacing */}
      <div className="sticky bottom-0 z-50 border-t shadow-lg" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
        <div className="max-w-lg mx-auto">
          <nav className="flex" style={{paddingBottom: 'env(safe-area-inset-bottom)'}}>
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeScreen === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => changeScreen(item.id)}
                  className="flex-1 py-2 px-1 text-center transition-colors"
                  style={{
                    color: isActive ? 'var(--page-title)' : 'var(--secondary-text)',
                    backgroundColor: isActive ? 'var(--primary-bg)' : 'transparent'
                  }}
                >
                  <Icon className="w-5 h-5 mx-auto mb-1" />
                  <span className="text-xs font-medium leading-tight">{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* PWA Installation Banner */}
      <PWAInstallBanner playerName={player.fullName} />
    </div>
  )
}

function HomeScreen() {
  // URL constants for easy maintenance
  const SEASON_INFO_URL = 'https://madisonultimate.notion.site/2025-Fall-Madison-Ultimate-265c4da46f7580e8ad0cc5c3fb2315f5';

  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  const toggleMessage = (messageId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

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
          <CardDescription style={{color: 'var(--secondary-header)'}}>
            Messages from the{' '}
            <a
              href={MAILING_LIST_INFO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hyperlink"
            >
              team mailing list
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4" style={{color: 'var(--secondary-text)'}}>
              Loading recent updates...
            </div>
          ) : messages.length > 0 ? (
            <div className="space-y-4">
              {messages.map((message, index) => {
                const isExpanded = expandedMessages.has(message.id);
                return (
                  <div key={message.id} className="border border-gray-200 rounded-lg bg-white shadow-sm">
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => toggleMessage(message.id)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-sm text-gray-900 pr-2">{message.subject}</h4>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-500">
                            {new Date(message.date).toLocaleDateString()}
                          </span>
                          <span className="text-gray-400">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs mb-2 text-gray-600">From: {message.from}</p>
                      {!isExpanded && (
                        <p className="text-sm text-gray-700 line-clamp-2">{message.snippet}</p>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 p-4">
                        <div className="text-xs text-gray-500 mb-3">
                          Sent: {new Date(message.date).toLocaleString('en-US', {
                            timeZone: 'America/Los_Angeles',
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            timeZoneName: 'short'
                          })}
                        </div>
                        {message.htmlBody ? (
                          <div>
                            <style dangerouslySetInnerHTML={{
                              __html: `
                                .email-content ul {
                                  list-style-type: disc !important;
                                  margin-left: 1.5rem !important;
                                  padding-left: 0.5rem !important;
                                  margin-top: 0.75rem !important;
                                  margin-bottom: 0.75rem !important;
                                }
                                .email-content ol {
                                  list-style-type: decimal !important;
                                  margin-left: 1.5rem !important;
                                  padding-left: 0.5rem !important;
                                  margin-top: 0.75rem !important;
                                  margin-bottom: 0.75rem !important;
                                }
                                .email-content li {
                                  margin-bottom: 0.25rem !important;
                                  padding-left: 0.25rem !important;
                                }
                                .email-content p {
                                  margin-top: 0.75rem !important;
                                  margin-bottom: 0.75rem !important;
                                }
                              `
                            }} />
                            <div
                              className="email-content prose prose-sm max-w-none text-gray-900"
                              dangerouslySetInnerHTML={{ __html: message.htmlBody }}
                              style={{
                                backgroundColor: 'white',
                                color: '#111827',
                              }}
                            />
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap text-sm text-gray-900">
                            {message.body || message.snippet}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4" style={{color: 'var(--secondary-text)'}}>
              No recent team updates available.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card className="shadow-lg" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
        <CardHeader>
          <CardTitle style={{color: 'var(--page-title)'}}>Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Documentation Link */}
          <div>
            <p className="text-sm mb-2" style={{color: 'var(--primary-text)'}}>
              📖&nbsp;
              <a
                href={APP_CONFIG.PLAYER_PORTAL_DOCUMENTATION}
                target="_blank"
                rel="noopener noreferrer"
                className="hyperlink"
              >
                Player Portal Guide
              </a>
            </p>
          </div>

          {/* Contact */}
          <div>
            <p className="text-sm mb-2" style={{color: 'var(--primary-text)'}}>
              📧 Email&nbsp;
              <a
                href={`mailto:${APP_CONFIG.COACH_EMAIL}`}
                className="hyperlink"
              >
                {APP_CONFIG.COACH_EMAIL}
              </a>
            </p>
          </div>

          {/* Quick Tips */}
          <div className="space-y-2 text-sm" style={{color: 'var(--primary-text)'}}>
            <div className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Update your practice/game availability as soon as possible.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Check this Home tab for important announcements.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Add this site to your home screen for easy access.</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


function PlayerInfoScreen({ player }: { player: PlayerData }) {

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
              <p className="text-sm" style={{color: 'var(--secondary-text)'}}>Team</p>
              <p className="font-medium" style={{color: 'var(--primary-text)'}}>{getTeamDisplay((player as any).team)}</p>
            </div>
          </div>
          <div>
            <p className="text-sm" style={{color: 'var(--secondary-text)'}}>Grade</p>
            <p className="font-medium" style={{color: 'var(--primary-text)'}}>{player.grade}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
              <p style={{color: 'var(--primary-text)'}}>{player.contacts.parent1.email}</p>
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
              <p style={{color: 'var(--primary-text)'}}>{player.contacts.parent2.email}</p>
              <p className="text-xs" style={{color: 'var(--secondary-text)'}}>
                <a href={MAILING_LIST_INFO_URL} target="_blank" rel="noopener noreferrer" style={{color: 'var(--accent)', textDecoration: 'underline'}}>
                  Mailing List
                </a>: {getMailingListIndicator(player.contacts.parent2.mailingListStatus)} {player.contacts.parent2.mailingListStatus || 'Unknown'}
              </p>
            </div>
          )}

          <div>
            <p className="text-sm" style={{color: 'var(--secondary-text)'}}>Player SPS Email</p>
            <p className="font-medium" style={{color: 'var(--primary-text)'}}>{player.contacts.studentEmails.spsEmail || 'Not provided'}</p>
          </div>

          <div>
            <p className="text-sm" style={{color: 'var(--secondary-text)'}}>Player Personal Email</p>
            <p className="font-medium" style={{color: 'var(--primary-text)'}}>{player.contacts.studentEmails.personalEmail || 'Not provided'}</p>
            <p className="text-xs" style={{color: 'var(--secondary-text)'}}>
              <a href={MAILING_LIST_INFO_URL} target="_blank" rel="noopener noreferrer" style={{color: 'var(--accent)', textDecoration: 'underline'}}>
                Mailing List
              </a>: {getMailingListIndicator(player.contacts.studentEmails.personalEmailMailingStatus || '')} {player.contacts.studentEmails.personalEmailMailingStatus || 'Unknown'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg" style={{background: 'var(--card-bg)', borderColor: 'var(--border)'}}>
        <CardContent className="pt-6">
          <p className="text-sm text-center" style={{color: 'var(--secondary-text)'}}>
            Email{' '}
            <a
              href="mailto:madisonultimate@gmail.com"
              style={{color: 'var(--accent)', textDecoration: 'underline'}}
              className="hover:opacity-80 transition-opacity"
            >
              Madison Coaches
            </a>
            {' '}if any of this information is incorrect.
          </p>
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
  const handleUpdateAvailability = (availability: string, note: string) => {
    onUpdateAvailability(practice.date, availability, note);
  };

  return (
    <AvailabilityCard
      title={practice.formattedDate}
      subtitle={practice.formattedTime}
      location={practice.location}
      locationUrl={practice.locationUrl}
      availabilityOptions={availabilityOptions}
      currentAvailability={practice.availability.availability}
      currentNote={practice.availability.note}
      onUpdateAvailability={handleUpdateAvailability}
      isUpdating={isUpdating}
      isEditable={isEditable}
      isCancelled={practice.isCancelled}
    >
      {/* Coach Note */}
      {practice.note && (
        <div className="p-3 rounded-lg mt-2" style={{background: 'var(--secondary-bg)'}}>
          <p className="text-sm" style={{color: 'var(--secondary-text)'}}>
            <strong>Coach Note:</strong> {practice.note}
          </p>
        </div>
      )}

      {/* Past indicator */}
      {practice.isPast && (
        <div className="text-right">
          <span className="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-600">
            Past
          </span>
        </div>
      )}
    </AvailabilityCard>
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

  // Filter out byes for statistics (but keep them for display)
  const upcomingGamesForStats = upcomingGames.filter((g: any) => !g.isBye);
  const pastGamesForStats = pastGames.filter((g: any) => !g.isBye);

  // Check if all upcoming games have responses (excluding byes)
  const allUpcomingResponded = upcomingGamesForStats.length > 0 && upcomingGamesForStats.filter((g: any) => !g.availability.availability).length === 0;

  return (
    <div className="space-y-6">
      {/* Game Summary Stats */}
      {(upcomingGamesForStats.length > 0 || pastGamesForStats.length > 0) && (
        <AvailabilitySummary
          title={`${player.team} Team Game Summary`}
          upcomingItems={upcomingGamesForStats}
          pastItems={pastGamesForStats}
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
              title={game.isBye ? game.formattedDate : `${game.team} Game #${game.gameNumber}: ${game.formattedDate}`}
              subtitle={!game.isBye ? `Warmups: ${game.formattedWarmupTime} • Start: ${game.formattedGameStart} • Done: ${game.formattedDoneBy}` : ''}
              location={game.location}
              locationUrl={game.locationUrl}
              availabilityOptions={availabilityOptions}
              currentAvailability={game.availability.availability}
              currentNote={game.availability.note}
              onUpdateAvailability={(availability, note) => updateAvailability(game.gameKey, availability, note)}
              isUpdating={updating === game.gameKey}
              isEditable={true}
              isBye={game.isBye}
            >
              {game.gameNote && (
                <div className="text-xs italic mt-2" style={{color: 'var(--secondary-text)'}}>
                  Coach note: {game.gameNote}
                </div>
              )}
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
              title={game.isBye ? game.formattedDate : `${game.team} Game #${game.gameNumber}: ${game.formattedDate}`}
              subtitle={!game.isBye ? `Warmups: ${game.formattedWarmupTime} • Start: ${game.formattedGameStart} • Done: ${game.formattedDoneBy}` : ''}
              location={game.location}
              locationUrl={game.locationUrl}
              availabilityOptions={availabilityOptions}
              currentAvailability={game.availability.availability}
              currentNote={game.availability.note}
              onUpdateAvailability={() => {}} // No updates for past games
              isUpdating={false}
              isEditable={false}
              isBye={game.isBye}
            >
              {game.gameNote && (
                <div className="text-xs italic mt-2" style={{color: 'var(--secondary-text)'}}>
                  Coach note: {game.gameNote}
                </div>
              )}
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