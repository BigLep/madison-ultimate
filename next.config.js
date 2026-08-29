/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fix workspace root warning
  outputFileTracingRoot: __dirname,

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
    ]
  },
}

module.exports = nextConfig