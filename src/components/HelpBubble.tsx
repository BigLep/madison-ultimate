"use client"

import { useState } from 'react'

/** Small "i" bubble that reveals explanatory text on click/focus. For copy that isn't a link. */
export function HelpBubble({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  return (
    <span className="relative inline-block align-middle ml-1">
      <button
        type="button"
        aria-label="More info"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-xs leading-none"
        style={{ background: 'var(--border)', color: 'var(--secondary-text)' }}
        onClick={() => setOpen(o => !o)}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      {open && (
        <span
          className="absolute z-10 left-0 top-6 w-56 text-xs rounded-md border p-2 shadow-lg"
          style={{ background: 'var(--card-bg)', borderColor: 'var(--border)', color: 'var(--secondary-text)' }}
        >
          {text}
        </span>
      )}
    </span>
  )
}

/** Inline "learn more" link for copy that points somewhere else, e.g. a Notion page. */
export function LearnMoreLink({ href, label = 'Learn more' }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline text-xs ml-1"
      style={{ color: 'var(--accent)' }}
    >
      {label}
    </a>
  )
}
