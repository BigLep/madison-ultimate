import { JerseyManager } from '@/components/jerseys/JerseyManager'
import { JERSEYS_SHEET_CONFIG } from '@/lib/jerseys-config'

// Jersey Manager tools (CONTEXT.md: Jerseys; ADR 0009), behind the /jerseys password gate.
// Rendered per request so the workbook link reflects the deployed JERSEYS_SHEET_ID.
export const dynamic = 'force-dynamic'

export default function JerseysPage() {
  const id = JERSEYS_SHEET_CONFIG.JERSEYS_SHEET_ID
  return <JerseyManager workbookUrl={id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : ''} />
}
