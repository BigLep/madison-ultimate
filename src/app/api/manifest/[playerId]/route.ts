import { NextRequest, NextResponse } from 'next/server'
import { findSignupByPlayerId } from '../../../../lib/signups-sheet'
import { SIGNUPS_COLUMNS } from '../../../../lib/signups-config'

// PWA Manifest versioning - increment this when making significant changes
// This helps ensure PWA installations get updated manifests when the app changes
// Examples of when to increment:
//   - Icon changes: 1.0.0 -> 1.1.0
//   - App name changes: 1.1.0 -> 1.2.0
//   - Major feature additions: 1.2.0 -> 2.0.0
// 2.0.0: Fall 2026 Player Portal at /player/$playerId (was /player-portal/$portalId).
const MANIFEST_VERSION = "2.0.0"

const ICON_SIZES = [48, 72, 96, 128, 144, 192, 256, 512]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params
    const found = await findSignupByPlayerId(playerId)
    if (!found) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    const firstName = found.record[SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME] || 'Player'
    const fullName = `${firstName} ${found.record[SIGNUPS_COLUMNS.LAST_NAME] || ''}`.trim()

    const manifest = {
      name: `🥏 ${firstName} - Madison Ultimate`,
      short_name: `🥏 ${firstName}`,
      description: `Player portal for ${fullName} - Madison Middle School Ultimate Frisbee`,
      version: MANIFEST_VERSION,
      start_url: `/player/${playerId}`,
      display: "standalone",
      background_color: "#f8fafc",
      theme_color: "#1e3a8a",
      orientation: "portrait-primary",
      scope: `/player/${playerId}`,
      icons: ICON_SIZES.map(size => ({
        src: `/images/madison-ultimate-logo-1/${size}.png`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose: size === 192 || size === 512 ? "any maskable" : "any",
      })),
      categories: ["sports", "education"],
      screenshots: [],
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
