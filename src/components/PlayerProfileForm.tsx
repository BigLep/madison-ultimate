"use client"

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LearnMoreLink } from '@/components/HelpBubble'
import { PhotoUpload } from '@/components/PhotoUpload'
import { MailingStatusInline } from '@/components/MailingStatusInline'
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
  NOT_THIS_SEASON,
} from '@/lib/signup-form-schema'

const fieldLabelStyle = { color: 'var(--primary-text)' }
const sectionHeadingStyle = { color: 'var(--secondary-header)' }
const selectClassName = 'flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs" style={{ color: '#f87171' }}>{message}</p>
}

/** Required-field marker, colored to stand out from the label text instead of blending in. */
function Req() {
  return <span style={{ color: '#f87171' }}> *</span>
}

/** Sits between a label and its input. */
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
  playerId,
  defaultValues,
  seeded = {},
  hasPhoto,
  onPhotoUploaded,
  refreshSignal,
  onSave,
}: {
  playerId: string
  defaultValues: ProfileFormValues
  seeded?: Record<string, string>
  hasPhoto: boolean
  onPhotoUploaded: () => void
  /** Bumped after each save so mailing-status widgets re-fetch against the just-saved emails. */
  refreshSignal?: number
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
  const coachVolunteeringInterest = watch('coachVolunteeringInterest')

  const isKnownSchool = (ELEMENTARY_SCHOOL_OPTIONS as readonly string[]).includes(elementarySchool)
  const [showOtherSchool, setShowOtherSchool] = useState(Boolean(elementarySchool) && !isKnownSchool)

  const toggleVolunteerRole = (role: string) => {
    if (role === NOT_THIS_SEASON) {
      setValue('volunteerRoles', volunteerRoles.includes(NOT_THIS_SEASON) ? [] : [NOT_THIS_SEASON])
      return
    }
    const withoutNotThisSeason = volunteerRoles.filter(r => r !== NOT_THIS_SEASON)
    if (withoutNotThisSeason.includes(role)) {
      setValue('volunteerRoles', withoutNotThisSeason.filter(r => r !== role))
    } else {
      setValue('volunteerRoles', [...withoutNotThisSeason, role])
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
    <form onSubmit={handleSubmit(submit)} className="space-y-8 pb-24">
      <section id="player-info" className="space-y-4 scroll-mt-4">
        <h3 className="font-semibold text-lg" style={sectionHeadingStyle}>🏃 Player</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label style={fieldLabelStyle}>Preferred first name<Req /></Label>
            <Input {...register('preferredFirstName')} />
            <FieldError message={errors.preferredFirstName?.message} />
          </div>
          <div className="space-y-2">
            <Label style={fieldLabelStyle}>Last name<Req /></Label>
            <Input {...register('lastName')} />
            <FieldError message={errors.lastName?.message} />
          </div>
        </div>

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Legal first name</Label>
          <HelperText>
            Only if different from preferred. Needed to match your player&apos;s Final Forms record when last name
            and birthdate alone aren&apos;t enough (e.g. twins). Never shown publicly.
          </HelperText>
          <Input {...register('legalFirstName')} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label style={fieldLabelStyle}>Date of birth<Req /></Label>
            <Input type="date" {...register('dateOfBirth')} />
            <FieldError message={errors.dateOfBirth?.message} />
          </div>
          <div className="space-y-2">
            <Label style={fieldLabelStyle}>Grade this fall<Req /></Label>
            <select {...register('grade')} className={selectClassName}>
              <option value="">Select...</option>
              {GRADE_OPTIONS.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <SeededHint value={seeded.grade} onUse={() => setValue('grade', seeded.grade!)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label style={fieldLabelStyle}>Pronouns (select all that apply)<Req /></Label>
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
            <Label style={fieldLabelStyle}>Gender identification<Req /></Label>
            <HelperText>
              <LearnMoreLink href="https://madisonultimate.notion.site/More-Season-Info-982c4da46f75826db2fd81b6a02568e1#4d6c4da46f7583d9a13a8176d948132c" />
            </HelperText>
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
          <Label style={fieldLabelStyle}>Elementary school attended<Req /></Label>
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

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Jersey / t-shirt size<Req /></Label>
          <HelperText>What size jersey does the player normally wear? Y = youth, A = adult; these are unisex sizes.</HelperText>
          <select {...register('jerseySize')} className={selectClassName}>
            <option value="">Select...</option>
            {JERSEY_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Allergies or medical info coaches should know<Req /></Label>
          <HelperText>If NONE, please list NONE.</HelperText>
          <Textarea {...register('allergies')} />
        </div>

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Other sports and activities this fall<Req /></Label>
          <HelperText>
            It&apos;s totally fine if your athlete has competing priorities. We just want to get a sense of where
            ultimate is in the scheduling mix for this season.
          </HelperText>
          <Textarea {...register('competingSports')} />
        </div>

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Ultimate playing experience<Req /></Label>
          <HelperText>
            For example, how many past seasons has your player played? Have they attended ultimate frisbee summer
            camps? Are there other sports the player has played competitively previously?
          </HelperText>
          <Textarea {...register('playingExperience')} />
        </div>

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>What does the player hope to get out of the season?<Req /></Label>
          <HelperText>Is there a goal the player has for themself this season? Do they have a hope for the team this year?</HelperText>
          <Textarea {...register('hopes')} />
        </div>

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Anything else we should know?</Label>
          <HelperText>
            List anything else we should know about your player (e.g., if they are new, what other sports they
            have played, any barriers to participation, behaviors to be aware of).
          </HelperText>
          <Textarea {...register('otherInfo')} />
        </div>
      </section>

      <section id="photo-upload" className="space-y-4 scroll-mt-4">
        <h3 className="font-semibold text-lg" style={sectionHeadingStyle}>📷 Player Photo<Req /></h3>
        <PhotoUpload playerId={playerId} hasPhoto={hasPhoto} onUploaded={onPhotoUploaded} />
      </section>

      <section id="player-contact" className="space-y-4 scroll-mt-4">
        <h3 className="font-semibold text-lg" style={sectionHeadingStyle}>📞 Player contact</h3>
        <HelperText>
          Player contact information isn&apos;t essential. We&apos;ll communicate during practices, but they are
          welcome to provide it and join team communication channels.
        </HelperText>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Player&apos;s personal email</Label>
          <Input type="email" {...register('studentPersonalEmail')} />
          <FieldError message={errors.studentPersonalEmail?.message} />
          <SeededHint value={seeded.studentPersonalEmail} onUse={() => setValue('studentPersonalEmail', seeded.studentPersonalEmail!)} />
          <MailingStatusInline playerId={playerId} matchLabel="Student personal email" refreshSignal={refreshSignal} />
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

      <section id="caretaker-info" className="space-y-4 scroll-mt-4">
        <h3 className="font-semibold text-lg" style={sectionHeadingStyle}>👪 Caretakers</h3>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Caretaker 1 name<Req /></Label>
          <Input {...register('caretaker1Name')} />
          <FieldError message={errors.caretaker1Name?.message} />
          <SeededHint value={seeded.caretaker1Name} onUse={() => setValue('caretaker1Name', seeded.caretaker1Name!)} />
        </div>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Caretaker 1 email<Req /></Label>
          <Input type="email" {...register('caretaker1Email')} />
          <FieldError message={errors.caretaker1Email?.message} />
          <SeededHint value={seeded.caretaker1Email} onUse={() => setValue('caretaker1Email', seeded.caretaker1Email!)} />
          <MailingStatusInline playerId={playerId} matchLabel="Caretaker 1" refreshSignal={refreshSignal} />
        </div>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Caretaker 1 phone (the number to contact in an emergency)</Label>
          <Input type="tel" {...register('caretaker1Phone')} />
          <SeededHint value={seeded.caretaker1Phone} onUse={() => setValue('caretaker1Phone', seeded.caretaker1Phone!)} />
        </div>

        {!showCaretaker2 && (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowCaretaker2(true)}>
            + Add a second caretaker
          </Button>
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
              <MailingStatusInline playerId={playerId} matchLabel="Caretaker 2" refreshSignal={refreshSignal} />
            </div>
            <div className="space-y-2">
              <Label style={fieldLabelStyle}>Caretaker 2 phone</Label>
              <Input type="tel" {...register('caretaker2Phone')} />
              <SeededHint value={seeded.caretaker2Phone} onUse={() => setValue('caretaker2Phone', seeded.caretaker2Phone!)} />
            </div>
          </div>
        )}
      </section>

      <section id="media" className="space-y-4 scroll-mt-4">
        <h3 className="font-semibold text-lg" style={sectionHeadingStyle}>📸 Media</h3>
        <label className="flex items-start gap-2 text-sm" style={fieldLabelStyle}>
          <input type="checkbox" className="mt-1" {...register('mediaOptOut')} />
          <span>
            Check if you do NOT want photos of your player used in team communications or shared within the
            team. (We never post players to social media either way.)
          </span>
        </label>
      </section>

      <section id="coach-volunteering" className="space-y-4 scroll-mt-4">
        <h3 className="font-semibold text-lg" style={sectionHeadingStyle}>👊 Coach volunteering</h3>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Are you interested in helping coach?<Req /></Label>
          <HelperText>
            All coaches work together to plan and execute practice and game strategies. New coaches will be
            supported by experienced staff/coaches and utilized in a way to help you and the program succeed. You
            aren&apos;t obligated if you do say yes. You don&apos;t have to be there all the time. Prior Ultimate
            Frisbee coaching experience is not required.{' '}
            <LearnMoreLink href="https://madisonultimate.notion.site/Volunteering-60ec4da46f7583df9a2d015cf5cb03b2" />
          </HelperText>
          <div
            className="rounded-md p-3 text-sm flex items-start gap-2"
            style={{ backgroundColor: 'rgba(96, 165, 250, 0.15)', border: '1px solid rgba(96, 165, 250, 0.4)', color: 'var(--primary-text)' }}
          >
            <span aria-hidden="true">🙋‍♀️</span>
            <span>
              We&apos;re especially hoping to hear from moms and other women interested in coaching; the team
              benefits from more female leadership on the sideline.
            </span>
          </div>
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
        </div>

        {coachVolunteeringInterest === 'Yes' && (
          <HelperText>
            If you already coached in the past or talked to Coach Steve about coaching this season, you don&apos;t
            need to fill in the next two questions again.
          </HelperText>
        )}

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Have you played or coached Ultimate before? What&apos;s been your experience?</Label>
          <HelperText>There are no wrong answers here.</HelperText>
          <Textarea {...register('coachUltimateExperience')} />
        </div>

        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Have you played or coached other team sports? What&apos;s been your experience?</Label>
          <HelperText>Again, there are no right answers here.</HelperText>
          <Textarea {...register('coachOtherSportsExperience')} />
        </div>
      </section>

      <section id="other-volunteering" className="space-y-4 scroll-mt-4">
        <h3 className="font-semibold text-lg" style={sectionHeadingStyle}>🙋 Other volunteering</h3>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Ways you might help this season (check any)<Req /></Label>
          <div className="space-y-1">
            {VOLUNTEER_ROLE_OPTIONS.map(role => (
              <div key={role}>
                <label className="flex items-center gap-2 text-sm" style={fieldLabelStyle}>
                  <input
                    type="checkbox"
                    checked={volunteerRoles.includes(role)}
                    onChange={() => toggleVolunteerRole(role)}
                  />
                  {role}
                </label>
                {role === 'Team admin / communications' && (
                  <p className="text-xs ml-6" style={{ color: 'var(--secondary-text)' }}>Helps organize attendance and other admin duties.</p>
                )}
                {role === 'Snacks / logistics' && (
                  <p className="text-xs ml-6" style={{ color: 'var(--secondary-text)' }}>Helps organize family volunteers for after-game snacks.</p>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label style={fieldLabelStyle}>Anything more about how you&apos;d like to help?</Label>
          <Input {...register('volunteerNotes')} />
        </div>
      </section>

      <section id="anything-else" className="space-y-4 scroll-mt-4">
        <h3 className="font-semibold text-lg" style={sectionHeadingStyle}>💬 Anything else</h3>
        <div className="space-y-2">
          <HelperText>
            Feel free to pass along any other ideas, feedback, or suggestions. Alternatively feel free to email{' '}
            <a href="mailto:madisonultimate@gmail.com" className="underline" style={{ color: 'var(--accent)' }}>
              madisonultimate@gmail.com
            </a>{' '}
            anytime.
          </HelperText>
          <Textarea {...register('additionalFeedback')} />
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

      {/* Sticky save bar: always visible while scrolling, so families don't have to hunt for Save. */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t p-3 z-20"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-2xl mx-auto">
          <Button
            type="submit"
            className="w-full text-white font-semibold"
            style={{ background: 'var(--accent)' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </form>
  )
}
