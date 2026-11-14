'use client'

import { useEffect, useState } from 'react'
import { PasswordGateForm } from '@/components/PasswordGateForm'
import { Input } from '@/components/ui/input'
import { getJerseyManagerName, rememberJerseyManagerName } from '@/lib/jersey-session'
import { MAX_MANAGER_NAME_LENGTH } from '@/lib/jerseys'

// Jersey Manager login (ADR 0009): your name plus the shared Jersey Manager password. The password
// becomes the gate cookie (ADR 0008); the name is remembered on this device and stamped on every
// check-out, check-in, and note.

export default function JerseyLoginPage() {
  const [name, setName] = useState('')

  useEffect(() => {
    setName(getJerseyManagerName())
  }, [])

  return (
    <PasswordGateForm
      title="Jersey Manager Login"
      loginApiPath="/api/jerseys/login"
      defaultNext="/jerseys"
      canSubmit={Boolean(name.trim())}
      onSuccess={() => rememberJerseyManagerName(name)}
    >
      <Input
        aria-label="Your name"
        placeholder="Your name"
        autoComplete="name"
        maxLength={MAX_MANAGER_NAME_LENGTH}
        value={name}
        onChange={e => setName(e.target.value)}
      />
    </PasswordGateForm>
  )
}
