"use client"

/** Inline "learn more" link for copy that points somewhere else, e.g. a Notion page. */
export function LearnMoreLink({ href, label = 'Learn more' }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline text-xs"
      style={{ color: 'var(--accent)' }}
    >
      {label}
    </a>
  )
}
