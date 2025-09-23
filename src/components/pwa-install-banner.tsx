"use client"

import { useState, useEffect } from 'react'
import { X, Download } from 'lucide-react'
import PWAPrompt from 'react-ios-pwa-prompt'

interface PWAInstallBannerProps {
  playerName: string
}

export function PWAInstallBanner({ playerName }: PWAInstallBannerProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showAndroidBanner, setShowAndroidBanner] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  useEffect(() => {
    // Check if running as PWA
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
                            (window.navigator as any).standalone === true

    // Check if banner was previously dismissed (for this session)
    const dismissed = sessionStorage.getItem(`pwa-banner-dismissed-${playerName}`)

    setIsStandalone(isStandaloneMode)
    setBannerDismissed(dismissed === 'true')

    // Show Android banner if not already installed and not dismissed
    if (!isStandaloneMode && !dismissed) {
      // Delay showing banner by 3 seconds to not overwhelm user
      const timer = setTimeout(() => {
        setShowAndroidBanner(true)
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [playerName])

  useEffect(() => {
    // Listen for PWA install prompt (Android Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleAndroidInstallClick = async () => {
    if (deferredPrompt) {
      // Android Chrome - use native prompt
      deferredPrompt.prompt()
      const choiceResult = await deferredPrompt.userChoice

      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted PWA install')
      }
      setDeferredPrompt(null)
      setShowAndroidBanner(false)
    }
  }

  const handleAndroidDismiss = () => {
    setShowAndroidBanner(false)
    setBannerDismissed(true)
    sessionStorage.setItem(`pwa-banner-dismissed-${playerName}`, 'true')
  }

  const showIOSPrompt = !isStandalone && !bannerDismissed

  return (
    <>
      {/* PWA Install Banner - Temporarily disabled */}
      {false && showIOSPrompt && (
        <PWAPrompt
          timesToShow={3}
          iconSrc="/images/madison-ultimate-logo-1/180.png"
        />
      )}

      {/* Android/Desktop PWA Banner - Temporarily disabled */}
      {false && showAndroidBanner && deferredPrompt && !isStandalone && (
        <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4" style={{
            background: 'var(--card-bg)',
            borderColor: 'var(--border)',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
          }}>
            {/* Close button */}
            <button
              onClick={handleAndroidDismiss}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Dismiss installation banner"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>

            {/* Content */}
            <div className="flex items-start gap-3 pr-6">
              <div className="flex-shrink-0 mt-1">
                <div className="w-10 h-10 flex items-center justify-center overflow-hidden">
                  <img
                    src="/images/madison-ultimate-logo-1/favicon.svg"
                    alt="Madison Ultimate Logo"
                    className="w-8 h-8 object-contain"
                  />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm mb-1" style={{color: 'var(--primary-text)'}}>
                  Install Madison Ultimate
                </h3>
                <p className="text-xs mb-3" style={{color: 'var(--secondary-text)'}}>
                  Add {playerName}'s portal to your home screen for quick access.
                </p>

                {/* Install button */}
                <button
                  onClick={handleAndroidInstallClick}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-3 rounded-md transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Install App
                </button>
              </div>
            </div>

            {/* Benefits */}
            <div className="mt-3 pt-3 border-t border-gray-100" style={{borderColor: 'var(--border)'}}>
              <div className="flex items-center gap-4 text-xs" style={{color: 'var(--secondary-text)'}}>
                <span>✓ Faster loading</span>
                <span>✓ Offline access</span>
                <span>✓ Home screen icon</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}