"use client"

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { HelpBubble, LearnMoreLink } from '@/components/HelpBubble'
import {
  profileFormSchema,
  ProfileFormValues,
  GRADE_OPTIONS,
  JERSEY_SIZE_OPTIONS,
  PRONOUN_OPTIONS,
  GENDER_IDENTIFICATION_OPTIONS,
  ELEMENTARY_SCHOOL_OPTIONS,
  COACH_VOLUNTEERING_OPTIONS,
  VOLUNTEER_ROLE_OPTIONS,
} from '@/lib/signup-form-schema'

const fieldLabelStyle = { color: 'var(--primary-text)' }
const sectionHeadingStyle = { color: 'var(--secondary-header)' }
const selectClassName = 'flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs" style={{ color: '#f87171' }}>{message}</p>
}

function HelperText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs" style={{ color: 'var(--secondary-text)' }}>{children}</p>
}

/** Seeded field hint (ADR 0002): "this is what we have; use it or enter something different." Unmasked. */
function SeededHint({ value, onUse }: { value?: string; onUse: () => void }) {
  if (!value) return null
  return (
    <p className="text-xs flex items-center gap-2 flex-wrap" style={{ color: 'var(--secondary-text)' }}>
      <span>From Final Forms: {value}</span>
      <button type="button" className="underline py-1 px-1" style={{ color: 'var(--accent)' }} onClick={onUse}>
        Use it
      </button>
    </p>
  )
}

export function PlayerProfileForm({
  defaultValues,
  seeded = {},
  onSave,
}: {
  defaultValues: ProfileFormValues
  seeded?: Record<string, string>
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
    Boolean(defaultValues.caretaker2Name || defaultValues.caretaker2Email || seeded.caretaker2Name || seeded.caretaker2Email)
  )
  const [saveError, setSaveError] = useState('')
  const volunteerRoles = watch('volunteerRoles') || []
  const pronouns = watch('pronouns') || []
  const elementarySchool = watch('elementarySchool') || ''

  const isKnownSchool = (ELEMENTARY_SCHOOL_OPTIONS as readonly string[]).includes(elementarySchool)
  const [showOtherSchool, setShowOtherSchool] = useState(Boolean(elementarySchool) && !isKnownSchool)

  const toggleVolunteerRole = (role: string) => {
    if (volunteerRoles.includes(role)) {
      setValue('volunteerRoles', volunteerRoles.filter(r => r !== role))
    } else {
      setValue('volunteerRoles', [...volunteerRoles, role])
    }
  }

  const togglePronoun = (pronoun: string) => {
    if (pronouns.includes(pronoun)) {
      setValue('pronouns', pronouns.filter(p => p !== pronoun))
    } else {
      setValue('pronouns', [...pronouns, pronoun])
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
        <h3 className="font-semibold text-lg" style={sectionHeadingStyle}>🏃 Player</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label style={fieldLabelStyle}>Date of birth</Label>
            <Input type="date" {...register('dateOfBirth')} />
            <FieldError message={errors.dateOfBirth?.message} />
          </div>
          <div className="space-y-2">
            <Label style={fieldLabelStyle}>
              Legal first name (only if different)
              <HelpBubble text="Needed to match your player's Final Forms record when last name and birthdate alone aren't enough (e.g. twins). Never shown publicly." />
            </Label>
            <Input {...register('legalFirstName')} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label style={fieldLabelStyle}>Grade this fall *</Label>
            <select {...register('grade')} className={selectClassName}>
              <option value="">Select...</option>
              {GRADE_OPTIONS.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <SeededHint value={seeded.grade} onUse={() => setValue('grade', seeded.grade!)} />
          </div>
          <div className="space-y-2">
            <Label style={fieldLabelStyle}>Elementary school attended</Label>
            <select
              className={selectClassName}
              value={showOtherSchool ? 'Other' : elementarySchool}
              onChange={e => {
                if (e.target.value === 'Other') {
                  setShowOtherSchool(true)
                  setValue('elementarySchool', '')
                } else {
                  setShowOtherSchool(false)
                  setValue('elementarySchool', e.target.value)
                }
              }}
            >
              <option value="">Select...</option>
              {ELEMENTARY_SCHOOL_OPTIONS.map(school => (
                <option key={school} value={school}>{school}</option>
              ))}
              <option value="Other">Other</option>
            </select>
            {showOtherSchool && (
              <Input
                className="mt-2"
                placeholder="School name"
                {...register('elementarySchool')}
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label style={fieldLabelStyle}>Pronouns (select all that apply)</Label>
            <div className="space-y-1">
              {PRONOUN_OPTIONS.map(pronoun => (
                <label key={pronoun} className="flex items-center gap-2 text-sm" style={fieldLabelStyle}>
                  <input type="checkbox" checked={pronouns.includes(pronoun)} onChange={() => togglePronoun(pronoun)} />
                  {pronoun}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label style={fieldLabelStyle}>
              Gender identification
              <LearnMoreLink href="https://madisonultimate.notion.site/More-Season-Info-982c4da46f75826db2fd81b6a02568e1#4d6c4da46f7583d9a13a8176d948132c" />
            </Label>
            <div className="space-y-1">
              {GENDER_IDENTIFICATION_OPTIONS.map(option => (
                <label key={option} className="flex items-center gap-2 text-sm" style={fieldLabelStyle}>
                  <input
                    type="radio"
                    value={option}
                    checked={watch('genderIdentification') === option}
                    onChange={() => setValue('genderIdentification', option)}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Allergies or medical info coaches should know</Label>
          <Textarea {...register('allergies')} />
          <HelperText>If NONE, please list NONE.</HelperText>
        </div>

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Other sports and activities this fall (helps us plan around conflicts)</Label>
          <Textarea {...register('competingSports')} />
          <HelperText>
            It&apos;s totally fine if your athlete has competing priorities. We just want to get a sense of where
            ultimate is in the scheduling mix for this season.
          </HelperText>
        </div>

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Jersey / t-shirt size *</Label>
          <select {...register('jerseySize')} className={selectClassName}>
            <option value="">Select...</option>
            {JERSEY_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <HelperText>What size jersey does the player normally wear? Y = youth, A = adult; these are unisex sizes.</HelperText>
        </div>

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Ultimate playing experience</Label>
          <Textarea {...register('playingExperience')} />
          <HelperText>
            For example, how many past seasons has your player played? Have they attended ultimate frisbee summer
            camps? Are there other sports the player has played competitively previously?
          </HelperText>
        </div>

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>What does the player hope to get out of the season?</Label>
          <Textarea {...register('hopes')} />
          <HelperText>Is there a goal the player has for themself this season? Do they have a hope for the team this year?</HelperText>
        </div>

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Anything else we should know?</Label>
          <Textarea {...register('otherInfo')} />
          <HelperText>
            List anything else we should know about your player (e.g., if they are new, what other sports they
            have played, any barriers to participation, behaviors to be aware of).
          </HelperText>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold text-lg" style={sectionHeadingStyle}>📞 Player contact (all optional)</h3>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Player&apos;s personal email</Label>
          <Input type="email" {...register('studentPersonalEmail')} />
          <FieldError message={errors.studentPersonalEmail?.message} />
          <SeededHint value={seeded.studentPersonalEmail} onUse={() => setValue('studentPersonalEmail', seeded.studentPersonalEmail!)} />
        </div>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Player&apos;s SPS email</Label>
          <Input type="email" {...register('studentSpsEmail')} />
          <FieldError message={errors.studentSpsEmail?.message} />
          <SeededHint value={seeded.studentSpsEmail} onUse={() => setValue('studentSpsEmail', seeded.studentSpsEmail!)} />
        </div>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Player&apos;s cell phone</Label>
          <Input type="tel" {...register('studentCellPhone')} />
          <SeededHint value={seeded.studentCellPhone} onUse={() => setValue('studentCellPhone', seeded.studentCellPhone!)} />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold text-lg" style={sectionHeadingStyle}>👪 Caretakers</h3>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Caretaker 1 name *</Label>
          <Input {...register('caretaker1Name')} />
          <FieldError message={errors.caretaker1Name?.message} />
          <SeededHint value={seeded.caretaker1Name} onUse={() => setValue('caretaker1Name', seeded.caretaker1Name!)} />
        </div>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Caretaker 1 email *</Label>
          <Input type="email" {...register('caretaker1Email')} />
          <FieldError message={errors.caretaker1Email?.message} />
          <SeededHint value={seeded.caretaker1Email} onUse={() => setValue('caretaker1Email', seeded.caretaker1Email!)} />
        </div>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Caretaker 1 phone (the number to contact in an emergency)</Label>
          <Input type="tel" {...register('caretaker1Phone')} />
          <SeededHint value={seeded.caretaker1Phone} onUse={() => setValue('caretaker1Phone', seeded.caretaker1Phone!)} />
        </div>

        {!showCaretaker2 && (
          <button
            type="button"
            className="text-sm underline py-2 px-1 -mx-1"
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
              <SeededHint value={seeded.caretaker2Name} onUse={() => setValue('caretaker2Name', seeded.caretaker2Name!)} />
            </div>
            <div className="space-y-2">
              <Label style={fieldLabelStyle}>Caretaker 2 email</Label>
              <Input type="email" {...register('caretaker2Email')} />
              <FieldError message={errors.caretaker2Email?.message} />
              <SeededHint value={seeded.caretaker2Email} onUse={() => setValue('caretaker2Email', seeded.caretaker2Email!)} />
            </div>
            <div className="space-y-2">
              <Label style={fieldLabelStyle}>Caretaker 2 phone</Label>
              <Input type="tel" {...register('caretaker2Phone')} />
              <SeededHint value={seeded.caretaker2Phone} onUse={() => setValue('caretaker2Phone', seeded.caretaker2Phone!)} />
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold text-lg" style={sectionHeadingStyle}>📸 Media</h3>
        <label className="flex items-start gap-2 text-sm" style={fieldLabelStyle}>
          <input type="checkbox" className="mt-1" {...register('mediaOptOut')} />
          <span>
            Check if you do NOT want photos of your player used in team communications or shared within the
            team. (We never post players to social media either way.)
          </span>
        </label>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold text-lg" style={sectionHeadingStyle}>👊 Coach volunteering</h3>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>
            Are you interested in helping coach?
            <LearnMoreLink href="https://madisonultimate.notion.site/Volunteering-60ec4da46f7583df9a2d015cf5cb03b2" />
          </Label>
          <div className="space-y-1">
            {COACH_VOLUNTEERING_OPTIONS.map(option => (
              <label key={option} className="flex items-center gap-2 text-sm" style={fieldLabelStyle}>
                <input
                  type="radio"
                  value={option}
                  checked={watch('coachVolunteeringInterest') === option}
                  onChange={() => setValue('coachVolunteeringInterest', option)}
                />
                {option}
              </label>
            ))}
          </div>
          <HelperText>
            All coaches work together to plan and execute practice and game strategies. New coaches will be
            supported by experienced staff/coaches and utilized in a way to help you and the program succeed. You
            aren&apos;t obligated if you do say yes. You don&apos;t have to be there all the time. Prior Ultimate
            Frisbee coaching experience is not required.
          </HelperText>
          <HelperText>
            We&apos;re especially hoping to hear from moms and other women interested in coaching; the team
            benefits from more female leadership on the sideline.
          </HelperText>
          <HelperText>Already talked to Coach Steve about coaching? No need to fill this out again.</HelperText>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold text-lg" style={sectionHeadingStyle}>🙋 Other volunteering</h3>
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
          <HelperText>
            Team admin - helps organize attendance and other admin duties. Snack organizing - helps organize
            family volunteers for after game snacks. T-shirt ordering - helps collect info on who needs a jersey,
            and what sizes we need. And other opportunities.
          </HelperText>
        </div>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Anything more about how you&apos;d like to help?</Label>
          <Input {...register('volunteerNotes')} />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold text-lg" style={sectionHeadingStyle}>💬 Anything else</h3>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Anything else you want to share?</Label>
          <Textarea {...register('additionalFeedback')} />
          <HelperText>
            Feel free to pass along any other ideas, feedback, or suggestions. Alternatively feel free to email
            madisonultimate@gmail.com anytime.
          </HelperText>
        </div>
      </section>

      <div
        className="text-sm border-t pt-4"
        style={{ borderColor: 'var(--border)', color: 'var(--secondary-text)' }}
      >
        Saving subscribes the caretaker email(s) above to the Madison Ultimate newsletter, our main way of
        reaching families. You can opt out at any point, right from this page or{' '}
        <a
          href="https://buttondown.com/madisonultimate/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
          style={{ color: 'var(--accent)' }}
        >
          here
        </a>
        .
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
