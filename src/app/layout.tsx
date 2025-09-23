import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Madison Ultimate App',
  description: 'Signup tracking for Madison Middle School Ultimate Frisbee team',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
  icons: {
    icon: [
      {
        url: '/images/madison-ultimate-logo-1/favicon.svg',
        type: 'image/svg+xml',
      },
      {
        url: '/images/madison-ultimate-logo-1/192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/images/madison-ultimate-logo-1/32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/images/madison-ultimate-logo-1/16.png',
        sizes: '16x16',
        type: 'image/png',
      },
    ],
    apple: [
      {
        url: '/images/madison-ultimate-logo-1/180.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        url: '/images/madison-ultimate-logo-1/152.png',
        sizes: '152x152',
        type: 'image/png',
      },
      {
        url: '/images/madison-ultimate-logo-1/167.png',
        sizes: '167x167',
        type: 'image/png',
      },
      {
        url: '/images/madison-ultimate-logo-1/120.png',
        sizes: '120x120',
        type: 'image/png',
      },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}