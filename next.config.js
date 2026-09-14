/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fix workspace root warning
  outputFileTracingRoot: __dirname,

  // Dev-only: Next.js blocks cross-origin requests to /_next/* assets by default, which
  // silently breaks client-side hydration (buttons stay disabled, nothing becomes interactive)
  // when testing on a phone against `npm run dev` via a LAN mDNS hostname like
  // steve-macbook-pro-2023.local. *.local covers any teammate's Mac hostname.
  allowedDevOrigins: ['*.local'],

  // /whatsapp is a Route Handler (src/app/whatsapp/route.ts), not a config redirect:
  // the invite lives in WHATSAPP_COMMUNITY_JOIN_URL so it is never baked into git or the client bundle.
  async redirects() {
    return [
      {
        source: '/info',
        // Keep in sync with SEASON_INFO_URL in src/lib/app-config.ts (updated each season).
        // Not permanent: the target changes every season, so avoid hard browser/search caching.
        destination: 'https://madisonultimate.notion.site/2026-Fall-Madison-Ultimate-3bdc4da46f758073930af31f3af0cc4c',
        permanent: false,
      },
      {
        source: '/subscribe',
        // Keep in sync with MAILING_LIST_JOIN_URL in src/lib/app-config.ts.
        destination: 'https://buttondown.com/madisonultimate',
        permanent: false,
      },
      {
        source: '/news',
        destination: 'https://buttondown.com/madisonultimate/archive/',
        permanent: false,
      },
      // Fall 2026: the legacy portal is gone (docs/fall-2026/player-portal-grill.md Q7). Old
      // bookmarks land on the Portal Login; remembered players on that device are one tap away.
      {
        source: '/player-portal',
        destination: '/player',
        permanent: true,
      },
      {
        source: '/player-portal/:path*',
        destination: '/player',
        permanent: true,
      },
      {
        source: '/merch',
        destination: 'https://madisonultimate.notion.site/3dac4da46f758033bc9ed19f171f9e4c',
        permanent: false,
      },
    ]
  },
}

module.exports = nextConfig