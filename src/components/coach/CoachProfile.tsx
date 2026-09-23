'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PhotoUpload } from '@/components/PhotoUpload'
import { Markdown } from '@/components/Markdown'
import { CoachAvatar } from './CoachAvatar'
import type { CoachProfile as CoachProfileData } from '@/lib/coaches-table'

// The Me tab of Coach Home: a coach's own Coach Photo, contact info, and About, with a read-only
// view and an edit form (grill Q9, Q14). About is Markdown with a live preview.

export function CoachProfile({ coach, onSaved, photoUploadEnabled }: { coach: CoachProfileData; onSaved: (coach: CoachProfileData) => void; photoUploadEnabled: boolean }) {
  const [editing, setEditing] = useState(false)
  const [photoVersion, setPhotoVersion] = useState(0)

  return (
    <div className="space-y-4">
      <Card className="shadow-lg surface-card">
        <CardContent className="pt-6 space-y-3">
          <h2 className="font-semibold" style={{ color: 'var(--secondary-header)' }}>
            Photo
          </h2>
          {!photoUploadEnabled ? (
            <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
              Photo upload isn&apos;t set up yet for this season (COACH_PHOTOS_FOLDER_ID is not set).
            </p>
          ) : (
          <PhotoUpload
            uploadUrl={`/api/coach/coaches/${coach.coachId}/photo`}
            photoUrl={`/api/coaches/${coach.coachId}/photo`}
            hasPhoto={coach.hasPhoto}
            helpText="Shown with your About on the public Coaches page."
            onUploaded={() => {
              setPhotoVersion(Date.now())
              onSaved({ ...coach, hasPhoto: true })
            }}
          />
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg surface-card">
        <CardContent className="pt-6">
          {editing ? (
            <CoachProfileForm
              coach={coach}
              onCancel={() => setEditing(false)}
              onSaved={saved => {
                onSaved(saved)
                setEditing(false)
              }}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <CoachAvatar coachId={coach.coachId} name={coach.name} hasPhoto={coach.hasPhoto} size={64} version={photoVersion} />
                <div className="min-w-0">
                  <p className="font-semibold text-lg" style={{ color: 'var(--primary-text)' }}>
                    {coach.name}
                  </p>
                  <p className="text-sm break-words" style={{ color: 'var(--secondary-text)' }}>
                    {coach.email || 'No email'} · {coach.phone || 'No phone'}
                  </p>
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--secondary-text)' }}>
                Email and phone are visible to other coaches only. Your name, photo, and About are on the public Coaches page.
              </p>
              {coach.about ? <Markdown>{coach.about}</Markdown> : <p className="text-sm italic" style={{ color: 'var(--secondary-text)' }}>No About yet.</p>}
              <Button type="button" className="min-h-[44px] text-white font-semibold bg-[var(--accent)]" onClick={() => setEditing(true)}>
                Edit
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CoachProfileForm({ coach, onCancel, onSaved }: { coach: CoachProfileData; onCancel: () => void; onSaved: (coach: CoachProfileData) => void }) {
  const [values, setValues] = useState({ name: coach.name, email: coach.email, phone: coach.phone, about: coach.about })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (field: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues(v => ({ ...v, [field]: e.target.value }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/coach/coaches/${coach.coachId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const body = await res.json()
      if (!res.ok || !body.success) {
        setError(body.error || 'Save failed')
        return
      }
      onSaved(body.coach)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const labelClass = 'text-sm font-medium text-[var(--primary-text)]'

  return (
    <form onSubmit={save} className="space-y-4">
      <label className="block space-y-1">
        <span className={labelClass}>Name</span>
        <Input value={values.name} onChange={set('name')} required />
      </label>
      <label className="block space-y-1">
        <span className={labelClass}>Email</span>
        <Input type="email" value={values.email} onChange={set('email')} />
      </label>
      <label className="block space-y-1">
        <span className={labelClass}>Phone</span>
        <Input type="tel" value={values.phone} onChange={set('phone')} />
      </label>
      <label className="block space-y-1">
        <span className={labelClass}>About</span>
        <span className="block text-xs text-[var(--secondary-text)]">
          Markdown supported: <code>**bold**</code>, <code>- list item</code>, <code>[link](https://…)</code>.
        </span>
        <Textarea value={values.about} onChange={set('about')} rows={8} />
      </label>
      {values.about && (
        <div className="rounded-md border p-3 border-[var(--border)]">
          <p className="text-xs mb-2 text-[var(--secondary-text)]">Preview</p>
          <Markdown>{values.about}</Markdown>
        </div>
      )}
      {error && <p className="text-sm" style={{ color: 'var(--error-text, #f87171)' }}>{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1 min-h-[44px] text-white font-semibold bg-[var(--accent)]" disabled={saving || !values.name.trim()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="outline" className="min-h-[44px]" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
