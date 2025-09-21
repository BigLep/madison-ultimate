import { NextRequest, NextResponse } from 'next/server'

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
      name: `Madison Ultimate - ${playerName}`,
      short_name: `MU - ${player.firstName}`,
      description: `Player portal for ${playerName} - Madison Middle School Ultimate Frisbee`,
      start_url: `/player-portal/${portalId}`,
      display: "standalone",
      background_color: "#f8fafc",
      theme_color: "#1e3a8a",
      orientation: "portrait-primary",
      scope: `/player-portal/${portalId}`,
      icons: [
        {
          src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🥏</text></svg>",
          sizes: "192x192",
          type: "image/svg+xml",
          purpose: "any maskable"
        },
        {
          src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🥏</text></svg>",
          sizes: "512x512",
          type: "image/svg+xml",
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