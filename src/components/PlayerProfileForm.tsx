"use client"

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  profileFormSchema,
  ProfileFormValues,
  GRADE_OPTIONS,
  JERSEY_SIZE_OPTIONS,
  VOLUNTEER_ROLE_OPTIONS,
} from '@/lib/signup-form-schema'

const fieldLabelStyle = { color: 'var(--primary-text)' }
const sectionHeadingStyle = { color: 'var(--secondary-header)' }

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs" style={{ color: '#f87171' }}>{message}</p>
}

export function PlayerProfileForm({
  defaultValues,
  onSave,
}: {
  defaultValues: ProfileFormValues
  onSave: (values: ProfileFormValues) => Promise<void>
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues,
  })

  const [showCaretaker2, setShowCaretaker2] = useState(
    Boolean(defaultValues.caretaker2Name || defaultValues.caretaker2Email)
  )
  const [saveError, setSaveError] = useState('')
  const volunteerRoles = watch('volunteerRoles') || []

  const toggleVolunteerRole = (role: string) => {
    if (volunteerRoles.includes(role)) {
      setValue('volunteerRoles', volunteerRoles.filter(r => r !== role))
    } else {
      setValue('volunteerRoles', [...volunteerRoles, role])
    }
  }

  const submit = async (values: ProfileFormValues) => {
    setSaveError('')
    try {
      await onSave(values)
    } catch {
      setSaveError('Could not save. Please try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-8">
      <section className="space-y-4">
        <h3 className="font-semibold text-lg" style={sectionHeadingStyle}>Player</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label style={fieldLabelStyle}>Preferred first name</Label>
            <Input {...register('preferredFirstName')} />
            <FieldError message={errors.preferredFirstName?.message} />
          </div>
          <div className="space-y-2">
            <Label style={fieldLabelStyle}>Last name</Label>
            <Input {...register('lastName')} />
            <FieldError message={errors.lastName?.message} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label style={fieldLabelStyle}>Date of birth</Label>
            <Input type="date" {...register('dateOfBirth')} />
            <FieldError message={errors.dateOfBirth?.message} />
          </div>
          <div className="space-y-2">
            <Label style={fieldLabelStyle}>Legal first name, only if different</Label>
            <Input {...register('legalFirstName')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label style={fieldLabelStyle}>Grade this fall</Label>
            <select {...register('grade')} className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
              {GRADE_OPTIONS.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <FieldError message={errors.grade?.message} />
          </div>
          <div className="space-y-2">
            <Label style={fieldLabelStyle}>Elementary school attended</Label>
            <Input {...register('elementarySchool')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label style={fieldLabelStyle}>Pronouns</Label>
            <Input {...register('pronouns')} />
          </div>
          <div className="space-y-2">
            <Label style={fieldLabelStyle}>Gender identification</Label>
            <Input {...register('genderIdentification')} />
          </div>
        </div>

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Allergies or medical info coaches should know</Label>
          <Textarea {...register('allergies')} />
        </div>

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Other sports and activities this fall (helps us plan around conflicts)</Label>
          <Textarea {...register('competingSports')} />
        </div>

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Jersey / t-shirt size</Label>
          <select {...register('jerseySize')} className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
            {JERSEY_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <FieldError message={errors.jerseySize?.message} />
        </div>

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Ultimate playing experience</Label>
          <Textarea {...register('playingExperience')} />
        </div>

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>What does the player hope to get out of the season?</Label>
          <Textarea {...register('hopes')} />
        </div>

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Anything else we should know?</Label>
          <Textarea {...register('otherInfo')} />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold text-lg" style={sectionHeadingStyle}>Player contact (all optional)</h3>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Player&apos;s personal email</Label>
          <Input type="email" {...register('studentPersonalEmail')} />
          <FieldError message={errors.studentPersonalEmail?.message} />
        </div>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Player&apos;s SPS email</Label>
          <Input type="email" {...register('studentSpsEmail')} />
          <FieldError message={errors.studentSpsEmail?.message} />
        </div>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Player&apos;s cell phone</Label>
          <Input type="tel" {...register('studentCellPhone')} />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold text-lg" style={sectionHeadingStyle}>Caretakers</h3>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Caretaker 1 name</Label>
          <Input {...register('caretaker1Name')} />
          <FieldError message={errors.caretaker1Name?.message} />
        </div>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Caretaker 1 email</Label>
          <Input type="email" {...register('caretaker1Email')} />
          <FieldError message={errors.caretaker1Email?.message} />
        </div>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Caretaker 1 phone (the number to contact in an emergency)</Label>
          <Input type="tel" {...register('caretaker1Phone')} />
        </div>

        {!showCaretaker2 && (
          <button
            type="button"
            className="text-sm underline"
            style={{ color: 'var(--accent)' }}
            onClick={() => setShowCaretaker2(true)}
          >
            + Add a second caretaker
          </button>
        )}

        {showCaretaker2 && (
          <div className="space-y-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <div className="space-y-2">
              <Label style={fieldLabelStyle}>Caretaker 2 name</Label>
              <Input {...register('caretaker2Name')} />
            </div>
            <div className="space-y-2">
              <Label style={fieldLabelStyle}>Caretaker 2 email</Label>
              <Input type="email" {...register('caretaker2Email')} />
              <FieldError message={errors.caretaker2Email?.message} />
            </div>
            <div className="space-y-2">
              <Label style={fieldLabelStyle}>Caretaker 2 phone</Label>
              <Input type="tel" {...register('caretaker2Phone')} />
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold text-lg" style={sectionHeadingStyle}>Media</h3>
        <label className="flex items-start gap-2 text-sm" style={fieldLabelStyle}>
          <input type="checkbox" className="mt-1" {...register('mediaOptOut')} />
          <span>
            Check if you do NOT want photos of your player used in team communications or shared within the
            team. (We never post players to social media either way.)
          </span>
        </label>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold text-lg" style={sectionHeadingStyle}>Volunteering</h3>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Ways you might help this season (check any)</Label>
          <div className="space-y-1">
            {VOLUNTEER_ROLE_OPTIONS.map(role => (
              <label key={role} className="flex items-center gap-2 text-sm" style={fieldLabelStyle}>
                <input
                  type="checkbox"
                  checked={volunteerRoles.includes(role)}
                  onChange={() => toggleVolunteerRole(role)}
                />
                {role}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Anything more about how you&apos;d like to help?</Label>
          <Input {...register('volunteerNotes')} />
        </div>
      </section>

      <div
        className="text-sm border-t pt-4"
        style={{ borderColor: 'var(--border)', color: 'var(--secondary-text)' }}
      >
        Saving subscribes the caretaker email(s) above to the Madison Ultimate newsletter, our main way of
        reaching families. You can opt out at any point, right from this page.
      </div>

      {saveError && (
        <div className="border px-4 py-3 rounded font-medium" style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }}>
          {saveError}
        </div>
      )}

      <Button
        type="submit"
        className="w-full text-white font-semibold"
        style={{ background: 'var(--accent)' }}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Saving...' : 'Save'}
      </Button>
    </form>
  )
}
