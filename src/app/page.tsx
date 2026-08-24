import Image from 'next/image';
import { Button } from '@/components/ui/button';

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
            className="text-4xl font-bold mb-8"
            style={{ color: 'var(--page-title)' }}
          >
            Madison Ultimate
          </h1>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              size="lg"
              className="text-white font-semibold hover:opacity-90 transition-opacity"
              style={{ background: 'var(--accent)' }}
            >
              <a href="/info">ℹ️ Learn More</a>
            </Button>
            <Button
              asChild
              size="lg"
              className="border font-semibold hover:opacity-90 transition-opacity"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--border)',
                color: 'var(--primary-text)',
              }}
            >
              <a href="/subscribe">📬 Join the Mailing List</a>
            </Button>
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