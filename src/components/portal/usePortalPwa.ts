"use client"

import { useEffect } from 'react'

// Per-player PWA metadata, carried over from last season's portal (docs/fall-2026/player-portal-grill.md
// Q7): the manifest at /api/manifest/$playerId makes "Add to Home Screen" open this player's portal.
// DOM edits wait a tick so they never race hydration.
export function usePortalPwa(playerId: string, fullName: string | null) {
  useEffect(() => {
    let cancelled = false

    const ensureLink = (rel: string, href: string) => {
      let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
      if (!link) {
        link = document.createElement('link')
        link.rel = rel
        document.head.appendChild(link)
      }
      link.href = href
    }
    const ensureMeta = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
      if (!meta) {
        meta = document.createElement('meta')
        meta.name = name
        document.head.appendChild(meta)
      }
      meta.content = content
    }

    const apply = async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
      if (cancelled) return
      if (!fullName) {
        document.title = 'Madison Ultimate'
        return
      }
      document.title = `Madison Ultimate - ${fullName}`
      ensureLink('manifest', `/api/manifest/${playerId}`)
      ensureMeta('theme-color', '#1e3a8a')
      ensureLink('apple-touch-icon', '/images/madison-ultimate-logo-1/180.png')
      ensureMeta('apple-mobile-web-app-capable', 'yes')
      ensureMeta('apple-mobile-web-app-status-bar-style', 'default')
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.log('SW registration failed: ', err)
        })
      }
    }
    apply()

    return () => {
      cancelled = true
      document.title = 'Madison Ultimate'
      for (const selector of [
        'link[rel="manifest"]',
        'meta[name="theme-color"]',
        'link[rel="apple-touch-icon"]',
        'meta[name="apple-mobile-web-app-capable"]',
        'meta[name="apple-mobile-web-app-status-bar-style"]',
      ]) {
        document.querySelector(selector)?.remove()
      }
    }
  }, [playerId, fullName])
}
