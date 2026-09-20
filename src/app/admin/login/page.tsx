import { PasswordGateForm } from '@/components/PasswordGateForm'

export default function AdminLoginPage() {
  return <PasswordGateForm title="Admin Login" loginApiPath="/api/admin/login" defaultNext="/admin/final-forms" />
}
