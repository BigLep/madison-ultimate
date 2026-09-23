import { CoachHome, CoachTool } from '@/components/coach/CoachHome'
import { coachKeyLinks, coachSheetUrl } from '@/lib/coach-links'
import { getSheetMetadata } from '@/lib/google-api'
import { SHEET_CONFIG } from '@/lib/sheet-config'

// Coach Home (CONTEXT.md, ADR 0008). Rendered per request so the season's link env vars and the
// Coach Availability tab's gid are read live; the rest happens client-side for the remembered coach.
export const dynamic = 'force-dynamic'

const TOOLS: CoachTool[] = [
  {
    href: '/coach/player-directory',
    icon: '🔍',
    title: 'Player Directory',
    description: "Look up a rostered player's photo, contact info, and availability.",
  },
  {
    href: '/coaches',
    icon: '🧑‍🏫',
    title: 'Coaches page',
    description: 'The public page families see, with every coach’s photo and About.',
  },
]

async function coachAvailabilityTabGid(): Promise<number | undefined> {
  const metadata = await getSheetMetadata(SHEET_CONFIG.ROSTER_SHEET_ID)
  return metadata?.sheets.find(s => s.title === SHEET_CONFIG.COACH_AVAILABILITY_SHEET_NAME)?.sheetId
}

export default async function CoachHomePage() {
  const links = coachKeyLinks({
    rosterSheetId: SHEET_CONFIG.ROSTER_SHEET_ID,
    practicePlansDocUrl: process.env.COACH_PRACTICE_PLANS_DOC_URL,
    commsDocUrl: process.env.COACH_COMMS_DOC_URL,
  })
  const availabilitySheetUrl = coachSheetUrl(SHEET_CONFIG.ROSTER_SHEET_ID, await coachAvailabilityTabGid())
  return (
    <CoachHome
      links={links}
      tools={TOOLS}
      availabilitySheetUrl={availabilitySheetUrl}
      photoUploadEnabled={Boolean(process.env.COACH_PHOTOS_FOLDER_ID)}
    />
  )
}
