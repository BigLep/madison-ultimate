import { PasswordGateForm } from '@/components/PasswordGateForm'

export default function CoachLoginPage() {
  return <PasswordGateForm title="Coach Tools" loginApiPath="/api/coach/login" defaultNext="/coach" />
}
