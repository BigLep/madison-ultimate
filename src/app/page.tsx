import Image from 'next/image';
import { APP_CONFIG } from '@/lib/app-config';
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
              <a href={APP_CONFIG.SEASON_INFO_URL} target="_blank" rel="noopener noreferrer">
                Learn More About Madison Ultimate
              </a>
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
              <a href={APP_CONFIG.MAILING_LIST_JOIN_URL} target="_blank" rel="noopener noreferrer">
                Join Mailing List
              </a>
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
              Current Players Login (coming soon)
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}