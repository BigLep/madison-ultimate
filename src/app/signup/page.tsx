import { PlayerEntryPage } from '@/components/PlayerEntryPage'

// Step 0 of signup: find an existing player or start a new one. Shares its screen with the
// Portal Login at /player (docs/fall-2026/player-portal-grill.md Q1).
export default function SignupPage() {
  return <PlayerEntryPage mode="signup" />
}
