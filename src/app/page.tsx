import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Hide until portal login is ready for families this season. Flip to true to show again.
const SHOW_CURRENT_PLAYERS_LOGIN = false;

const secondaryButtonClass = 'border font-semibold hover:opacity-90 transition-opacity';
const secondaryButtonStyle = {
  backgroundColor: 'var(--card-bg)',
  borderColor: 'var(--border)',
  color: 'var(--primary-text)',
} as const;

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Image
            src="/images/madison-ultimate-logo-1/512.png"
            alt="Madison Ultimate logo"
            width={160}
            height={160}
            className="mx-auto mb-6 rounded-full"
            priority
          />
          <h1
            className="text-4xl font-bold mb-4"
            style={{ color: 'var(--page-title)' }}
          >
            Madison Ultimate
          </h1>
          <p
            className="max-w-lg mx-auto mb-8 text-base leading-relaxed"
            style={{ color: 'var(--secondary-text)' }}
          >
            Fall 2026 tryouts are scheduled for Wednesday, September 9 and
            Friday, September 11. Signup and Final Forms are due Tuesday, September 8.{' '}
            <a
              href="/info"
              className="underline hover:opacity-80 transition-opacity"
              style={{ color: 'var(--accent)' }}
            >
              Learn about the season
            </a>{' '}
            first if you&apos;re new.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              size="lg"
              className="text-white font-semibold hover:opacity-90 transition-opacity"
              style={{ background: 'var(--accent)' }}
            >
              <Link href="/signup">🏁 Sign Up</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className={secondaryButtonClass}
              style={secondaryButtonStyle}
            >
              <a href="/info">ℹ️ Learn More</a>
            </Button>
            <Button
              asChild
              size="lg"
              className={secondaryButtonClass}
              style={secondaryButtonStyle}
            >
              <a href="/subscribe">📬 Join the Newsletter</a>
            </Button>
            {SHOW_CURRENT_PLAYERS_LOGIN && (
              <Button
                size="lg"
                disabled
                className="font-semibold cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  color: 'var(--secondary-text)',
                  opacity: 0.6,
                }}
              >
                🔒 Current Players Login (coming soon)
              </Button>
            )}
          </div>
          <a
            href="/news"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-6 text-sm underline hover:opacity-80 transition-opacity"
            style={{ color: 'var(--secondary-text)' }}
          >
            📰 Recent News
          </a>
        </div>
      </div>
    </main>
  )
}
