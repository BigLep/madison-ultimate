'use client'

import { useState } from 'react'
import Image from 'next/image'
import { SiteHeader } from '@/components/SiteHeader'

const CALENDAR_ID = '21081b4ccff3c7ad50dc835ce259ff76a09e0f05d1a66d727fafff195a7af612@group.calendar.google.com'
const GOOGLE_CALENDAR_ADD_URL =
  'https://calendar.google.com/calendar/u/0?cid=MjEwODFiNGNjZmYzYzdhZDUwZGM4MzVjZTI1OWZmNzZhMDllMGYwNWQxYTY2ZDcyN2ZhZmZmMTk1YTdhZjYxMkBncm91cC5jYWxlbmRhci5nb29nbGUuY29t'
const ICS_URL = `https://calendar.google.com/calendar/ical/${encodeURIComponent(CALENDAR_ID)}/public/basic.ics`
const WEBCAL_URL = `webcal://calendar.google.com/calendar/ical/${encodeURIComponent(CALENDAR_ID)}/public/basic.ics`
const EMBED_URL = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(CALENDAR_ID)}&ctz=America%2FLos_Angeles`

function LinkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--secondary-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}

function SubscribeCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-[18px]" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--primary-bg)' }}>
          {icon}
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="text-base font-semibold" style={{ color: 'var(--primary-text)' }}>{title}</div>
          <div className="text-sm leading-relaxed" style={{ color: 'var(--secondary-text)' }}>{description}</div>
        </div>
      </div>
      {children}
    </div>
  )
}

function CopyLinkRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be denied by the browser; the link is still visible/selectable below.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="flex h-[46px] items-center gap-2 rounded-lg border px-3.5 text-left"
      style={{ background: 'var(--primary-bg)', borderColor: 'var(--border)' }}
    >
      <span
        className="min-w-0 flex-1 truncate text-xs"
        style={{ color: 'var(--secondary-text)', fontFamily: 'ui-monospace, monospace' }}
      >
        {url}
      </span>
      <span className="shrink-0 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
        {copied ? 'Copied!' : 'Copy'}
      </span>
    </button>
  )
}

export default function CalendarPage() {
  return (
    <>
      <SiteHeader label="Calendar" />
      <main className="flex flex-col items-center" style={{ background: 'var(--primary-bg)', minHeight: '100vh' }}>
        <div className="flex w-full max-w-xl flex-col gap-7 px-5 py-8">

          <div className="flex flex-col items-center gap-3.5 text-center">
            <Image
              src="/images/madison-ultimate-logo-1/512.png"
              alt="Madison Ultimate logo"
              width={88}
              height={88}
              className="rounded-full"
            />
            <div className="flex flex-col gap-1.5">
              <h1 className="text-[28px] font-bold leading-tight" style={{ color: 'var(--page-title)' }}>Team Calendar</h1>
              <p className="mx-auto max-w-[420px] text-[15px] leading-relaxed" style={{ color: 'var(--secondary-text)' }}>
                Subscribe once, and every practice, game, and last-minute change shows up on your device automatically.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3.5">
            <SubscribeCard
              icon={<img src="/images/icons/google-calendar.svg" alt="" width={24} height={24} />}
              title="Google Calendar"
              description="On the web, or the Google Calendar app on Android or iPhone."
            >
              <a
                href={GOOGLE_CALENDAR_ADD_URL}
                className="flex h-[46px] items-center justify-center rounded-lg text-[15px] font-semibold text-white no-underline"
                style={{ background: 'var(--accent)' }}
              >
                Add to Google Calendar
              </a>
            </SubscribeCard>

            <SubscribeCard
              icon={<img src="/images/icons/apple-calendar.svg" alt="" width={24} height={24} />}
              title="iPhone & Mac Calendar"
              description="Apple's built-in Calendar app, for families who don't use the Google Calendar app."
            >
              <a
                href={WEBCAL_URL}
                className="flex h-[46px] items-center justify-center rounded-lg border text-[15px] font-semibold no-underline"
                style={{ background: 'var(--primary-bg)', borderColor: 'var(--border)', color: 'var(--primary-text)' }}
              >
                Subscribe on iPhone or Mac
              </a>
            </SubscribeCard>

            <SubscribeCard
              icon={<LinkIcon />}
              title="Windows Outlook, or anything else"
              description={'Copy this link and paste it into your app’s "Add by URL" or "Subscribe" option.'}
            >
              <CopyLinkRow url={ICS_URL} />
            </SubscribeCard>
          </div>

          <div className="flex gap-2.5 rounded-lg border p-3.5" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
            <InfoIcon />
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--secondary-text)' }}>
              Opened this from WhatsApp or Notion&apos;s built-in browser and nothing happened? Tap the &ldquo;&bull;&bull;&bull;&rdquo; menu and choose{' '}
              <span style={{ color: 'var(--primary-text)' }}>Open in Safari</span> (or Chrome), then tap the button again.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
            <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--secondary-text)' }}>Just want to look?</div>
            <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
          </div>

          <div className="flex flex-col gap-2.5">
            <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--secondary-text)' }}>
              No need to subscribe to browse upcoming practices and games below.
            </p>
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--card-bg)' }}>
              <iframe
                src={EMBED_URL}
                title="Madison Ultimate team calendar"
                className="block w-full"
                style={{ height: 600, border: 0, colorScheme: 'light' }}
                loading="lazy"
              />
            </div>
          </div>

        </div>
      </main>
    </>
  )
}
