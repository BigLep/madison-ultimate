"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { APP_CONFIG } from '@/lib/app-config'
import { WhatsAppIcon } from '@/components/WhatsAppIcon'

interface TeamUpdate {
  id: string
  subject: string
  from: string
  date: string
  snippet: string
  htmlBody?: string
  body?: string
}

const linkStyle = { color: 'var(--accent)', textDecoration: 'underline' } as const
const cardStyle = { background: 'var(--card-bg)', borderColor: 'var(--border)' } as const

// Home tab, carried over from last season (docs/fall-2026/player-portal-grill.md Q10): welcome,
// Join the Community, Recent Team Updates from the Buttondown RSS, and Need Help.
export function PortalHome() {
  const [messages, setMessages] = useState<TeamUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())

  const toggleMessage = (messageId: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      return next
    })
  }

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch('/api/team-updates?maxResults=3')
        const data = await response.json()
        if (data.success) setMessages(data.messages)
      } catch (error) {
        console.error('Error fetching messages:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchMessages()
  }, [])

  return (
    <div className="space-y-6">
      <Card className="shadow-lg" style={cardStyle}>
        <CardHeader>
          <CardTitle style={{ color: 'var(--page-title)' }}>Welcome to Madison Ultimate!</CardTitle>
          <CardDescription style={{ color: 'var(--secondary-header)' }}>{APP_CONFIG.SEASON_LABEL}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p style={{ color: 'var(--primary-text)' }}>
            You can learn more about the season at our{' '}
            <a href={APP_CONFIG.SEASON_INFO_URL} target="_blank" rel="noopener noreferrer" style={linkStyle}>
              team site
            </a>
            . This portal contains player specific information.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-lg" style={cardStyle}>
        <CardHeader>
          <CardTitle style={{ color: 'var(--page-title)' }}>Join the Community</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p style={{ color: 'var(--primary-text)' }}>
            <span className="inline-flex items-center gap-1.5">
              <WhatsAppIcon className="shrink-0" />
            </span>{' '}
            Join our{' '}
            <a href={APP_CONFIG.WHATSAPP_JOIN_PATH} target="_blank" rel="noopener noreferrer" style={linkStyle}>
              WhatsApp community
            </a>{' '}
            to ask questions ❓, share photos 📸, arrange carpools 🚗, etc. (
            <a href={APP_CONFIG.WHATSAPP_LEARN_MORE_URL} target="_blank" rel="noopener noreferrer" style={linkStyle}>
              Learn more
            </a>
            .)
          </p>
          {APP_CONFIG.GAME_SNACK_SIGNUP_URL && (
            <p style={{ color: 'var(--primary-text)' }}>
              🍊{' '}
              <a href={APP_CONFIG.GAME_SNACK_SIGNUP_URL} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                Sign up to bring game snacks or a tent
              </a>
              ! Tents must be weighted or staked down, even if it doesn&apos;t look windy (league safety rule).
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg" style={cardStyle}>
        <CardHeader>
          <CardTitle style={{ color: 'var(--page-title)' }}>Recent Team Updates</CardTitle>
          <CardDescription style={{ color: 'var(--secondary-header)' }}>
            Recent posts from our{' '}
            <a href="/news" target="_blank" rel="noopener noreferrer" className="hyperlink">
              newsletter
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4" style={{ color: 'var(--secondary-text)' }}>
              Loading recent updates...
            </div>
          ) : messages.length > 0 ? (
            <div className="space-y-4">
              {messages.map(message => {
                const isExpanded = expandedMessages.has(message.id)
                return (
                  <div key={message.id} className="border border-gray-200 rounded-lg bg-white shadow-sm">
                    <button
                      type="button"
                      className="w-full text-left p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      aria-expanded={isExpanded}
                      onClick={() => toggleMessage(message.id)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-sm text-gray-900 pr-2">{message.subject}</h4>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-500">{new Date(message.date).toLocaleDateString()}</span>
                          <span className="text-gray-400" aria-hidden="true">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs mb-2 text-gray-600">From: {message.from}</p>
                      {!isExpanded && <p className="text-sm text-gray-700 line-clamp-2">{message.snippet}</p>}
                    </button>
                    {isExpanded && (
                      <div className="border-t border-gray-100 p-4">
                        <div className="text-xs text-gray-500 mb-3">
                          Sent:{' '}
                          {new Date(message.date).toLocaleString('en-US', {
                            timeZone: 'America/Los_Angeles',
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            timeZoneName: 'short',
                          })}
                        </div>
                        {message.htmlBody ? (
                          <div
                            className="email-content prose prose-sm max-w-none text-gray-900"
                            dangerouslySetInnerHTML={{ __html: message.htmlBody }}
                            style={{ backgroundColor: 'white', color: '#111827' }}
                          />
                        ) : (
                          <div className="whitespace-pre-wrap text-sm text-gray-900">{message.body || message.snippet}</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-4" style={{ color: 'var(--secondary-text)' }}>
              No recent team updates available.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg" style={cardStyle}>
        <CardHeader>
          <CardTitle style={{ color: 'var(--page-title)' }}>Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--primary-text)' }}>
            📖&nbsp;
            <a href={APP_CONFIG.PLAYER_PORTAL_DOCUMENTATION} target="_blank" rel="noopener noreferrer" className="hyperlink">
              Player Portal Guide
            </a>
          </p>
          <p className="text-sm" style={{ color: 'var(--primary-text)' }}>
            📧 Email&nbsp;
            <a href={`mailto:${APP_CONFIG.COACH_EMAIL}`} className="hyperlink">
              {APP_CONFIG.COACH_EMAIL}
            </a>
          </p>
          <ul className="space-y-2 text-sm" style={{ color: 'var(--primary-text)' }}>
            {[
              'Update your practice/game availability as soon as possible.',
              'Check this Home tab for important announcements.',
              'Add this site to your home screen for easy access.',
            ].map(tip => (
              <li key={tip} className="flex items-start gap-2">
                <span className="text-green-600" aria-hidden="true">
                  ✓
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
