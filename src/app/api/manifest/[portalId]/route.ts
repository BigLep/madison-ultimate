import { NextRequest, NextResponse } from 'next/server'

// PWA Manifest versioning - increment this when making significant changes
// This helps ensure PWA installations get updated manifests when the app changes
// Examples of when to increment:
//   - Icon changes: 1.0.0 -> 1.1.0
//   - App name changes: 1.1.0 -> 1.2.0
//   - Major feature additions: 1.2.0 -> 2.0.0
const MANIFEST_VERSION = "1.2.0"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ portalId: string }> }
) {
  try {
    const resolvedParams = await params
    const { portalId } = resolvedParams

    // Fetch player data to get their name
    const playerResponse = await fetch(`${request.nextUrl.origin}/api/player/${portalId}`)
    const playerData = await playerResponse.json()

    if (!playerData.success) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    const player = playerData.player
    const playerName = player.fullName

    // Generate player-specific manifest
    const manifest = {
      name: `🥏 ${player.firstName} - Madison Ultimate`,
      short_name: `🥏 ${player.firstName}`,
      description: `Player portal for ${playerName} - Madison Middle School Ultimate Frisbee`,
      version: MANIFEST_VERSION,
      start_url: `/player-portal/${portalId}`,
      display: "standalone",
      background_color: "#f8fafc",
      theme_color: "#1e3a8a",
      orientation: "portrait-primary",
      scope: `/player-portal/${portalId}`,
      icons: [
        {
          src: "/images/madison-ultimate-logo-1/48.png",
          sizes: "48x48",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "/images/madison-ultimate-logo-1/72.png",
          sizes: "72x72",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "/images/madison-ultimate-logo-1/96.png",
          sizes: "96x96",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "/images/madison-ultimate-logo-1/128.png",
          sizes: "128x128",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "/images/madison-ultimate-logo-1/144.png",
          sizes: "144x144",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "/images/madison-ultimate-logo-1/192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable"
        },
        {
          src: "/images/madison-ultimate-logo-1/256.png",
          sizes: "256x256",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "/images/madison-ultimate-logo-1/512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable"
        }
      ],
      categories: ["sports", "education"],
      screenshots: []
    }

    return NextResponse.json(manifest, {
      headers: {
        'Content-Type': 'application/manifest+json',
      },
    })
  } catch (error) {
    console.error('Error generating manifest:', error)
    return NextResponse.json({ error: 'Failed to generate manifest' }, { status: 500 })
  }
}