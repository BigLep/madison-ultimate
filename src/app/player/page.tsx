import { PlayerEntryPage } from '@/components/PlayerEntryPage'

// Portal Login (CONTEXT.md): remembered players on this device, or Player Lookup by last name
// and birthdate. Finds existing players only; starting a new signup is /signup.
export default function PortalLoginPage() {
  return <PlayerEntryPage mode="login" />
}
