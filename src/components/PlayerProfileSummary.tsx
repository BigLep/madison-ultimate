"use client"

import { Button } from '@/components/ui/button'
import { MailingStatusInline } from '@/components/MailingStatusInline'
import { WhatsAppIcon } from '@/components/WhatsAppIcon'
import { APP_CONFIG } from '@/lib/app-config'
import { SignupRecord } from '@/lib/signups-sheet'
import { SIGNUPS_COLUMNS } from '@/lib/signups-config'
import { formatBirthdate } from '@/lib/date-formatters'
import { formatJerseySize } from '@/lib/signup-form-schema'

// Read-only view of the profile for the Player tab (docs/fall-2026/player-portal-grill.md Q9):
// the same sections as PlayerProfileForm, each with an Edit link that opens the form scrolled to
// that section. Newsletter Join/Leave and the WhatsApp invite stay live here because they are
// actions, not profile fields.

export type ProfileSectionId =
  | 'player-info'
  | 'photo-upload'
  | 'player-contact'
  | 'caretaker-info'
  | 'media'
  | 'coach-volunteering'
  | 'other-volunteering'
  | 'communication'

const headingStyle = { color: 'var(--secondary-header)' }
const labelStyle = { color: 'var(--secondary-text)' }
const valueStyle = { color: 'var(--primary-text)' }
const linkStyle = { color: 'var(--accent)' }

function Field({ label, value, placeholder = 'Not provided' }: { label: string; value?: string; placeholder?: string }) {
  const text = (value || '').trim()
  return (
    <div>
      <dt className="text-sm" style={labelStyle}>
        {label}
      </dt>
      <dd className={`whitespace-pre-wrap ${text ? 'font-medium' : 'italic'}`} style={text ? valueStyle : labelStyle}>
        {text || placeholder}
      </dd>
    </div>
  )
}

function Section({
  id,
  title,
  onEdit,
  children,
}: {
  id: ProfileSectionId
  title: string
  onEdit: (section: ProfileSectionId) => void
  children: React.ReactNode
}) {
  return (
    <section id={id} className="space-y-3 scroll-mt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-lg" style={headingStyle}>
          {title}
        </h3>
        <Button type="button" variant="outline" size="sm" className="min-h-[44px]" onClick={() => onEdit(id)} aria-label={`Edit ${title}`}>
          ✏️ Edit
        </Button>
      </div>
      {children}
    </section>
  )
}

function list(value: string): string {
  return value
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .join(', ')
}

export function PlayerProfileSummary({
  playerId,
  record,
  hasPhoto,
  refreshSignal,
  onEdit,
}: {
  playerId: string
  record: SignupRecord
  hasPhoto: boolean
  /** Bumped after each save so newsletter status re-fetches against the just-saved emails. */
  refreshSignal?: number
  onEdit: (section: ProfileSectionId) => void
}) {
  const v = (column: string) => record[column] || ''
  const mediaOptOut = v(SIGNUPS_COLUMNS.MEDIA_OPT_OUT) === 'true'

  return (
    <div className="space-y-8">
      <Section id="player-info" title="🏃 Player" onEdit={onEdit}>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Preferred first name" value={v(SIGNUPS_COLUMNS.PREFERRED_FIRST_NAME)} />
          <Field label="Last name" value={v(SIGNUPS_COLUMNS.LAST_NAME)} />
          <Field label="Legal first name" value={v(SIGNUPS_COLUMNS.LEGAL_FIRST_NAME)} placeholder="Same as preferred" />
          <Field label="Date of birth" value={formatBirthdate(v(SIGNUPS_COLUMNS.DATE_OF_BIRTH))} />
          <Field label="Grade this fall" value={v(SIGNUPS_COLUMNS.GRADE)} />
          <Field label="Elementary school attended" value={v(SIGNUPS_COLUMNS.ELEMENTARY_SCHOOL)} />
          <Field label="Pronouns" value={list(v(SIGNUPS_COLUMNS.PRONOUNS))} />
          <Field label="Gender identification" value={v(SIGNUPS_COLUMNS.GENDER_IDENTIFICATION)} />
          <Field label="Jersey / t-shirt size" value={formatJerseySize(v(SIGNUPS_COLUMNS.JERSEY_SIZE))} />
          <Field label="Allergies or medical info" value={v(SIGNUPS_COLUMNS.ALLERGIES)} />
          <Field label="Other sports and activities this fall" value={v(SIGNUPS_COLUMNS.COMPETING_SPORTS_AND_ACTIVITIES)} />
          <Field label="Ultimate playing experience" value={v(SIGNUPS_COLUMNS.PLAYING_EXPERIENCE)} />
          <Field label="Hopes for the season" value={v(SIGNUPS_COLUMNS.HOPES)} />
          <Field label="Anything else we should know" value={v(SIGNUPS_COLUMNS.OTHER_INFO)} />
        </dl>
      </Section>

      <Section id="photo-upload" title="📷 Player Photo" onEdit={onEdit}>
        {hasPhoto ? (
          <img
            src={`/api/signup/player/${playerId}/photo?v=${refreshSignal ?? 0}`}
            alt="Player photo"
            className="h-32 w-32 rounded-lg object-cover border"
            style={{ borderColor: 'var(--border)' }}
          />
        ) : (
          <p className="italic" style={labelStyle}>
            No photo yet. Coaches use it to learn names.
          </p>
        )}
      </Section>

      <Section id="player-contact" title="📞 Player contact" onEdit={onEdit}>
        <dl className="space-y-3">
          <div>
            <Field label="Player's personal email" value={v(SIGNUPS_COLUMNS.STUDENT_PERSONAL_EMAIL)} />
            <MailingStatusInline playerId={playerId} matchLabel="Student personal email" refreshSignal={refreshSignal} />
          </div>
          <Field label="Player's SPS email" value={v(SIGNUPS_COLUMNS.STUDENT_SPS_EMAIL)} />
          <Field label="Player's cell phone" value={v(SIGNUPS_COLUMNS.STUDENT_CELL_PHONE)} />
        </dl>
      </Section>

      <Section id="caretaker-info" title="👪 Caretakers" onEdit={onEdit}>
        <dl className="space-y-3">
          <Field label="Caretaker 1 name" value={v(SIGNUPS_COLUMNS.CARETAKER_1_NAME)} />
          <div>
            <Field label="Caretaker 1 email" value={v(SIGNUPS_COLUMNS.CARETAKER_1_EMAIL)} />
            <MailingStatusInline playerId={playerId} matchLabel="Caretaker 1" refreshSignal={refreshSignal} />
          </div>
          <Field label="Caretaker 1 phone (emergency contact)" value={v(SIGNUPS_COLUMNS.CARETAKER_1_PHONE)} />
          <Field label="Caretaker 2 name" value={v(SIGNUPS_COLUMNS.CARETAKER_2_NAME)} placeholder="None" />
          <div>
            <Field label="Caretaker 2 email" value={v(SIGNUPS_COLUMNS.CARETAKER_2_EMAIL)} placeholder="None" />
            {v(SIGNUPS_COLUMNS.CARETAKER_2_EMAIL) && (
              <MailingStatusInline playerId={playerId} matchLabel="Caretaker 2" refreshSignal={refreshSignal} />
            )}
          </div>
          <Field label="Caretaker 2 phone" value={v(SIGNUPS_COLUMNS.CARETAKER_2_PHONE)} placeholder="None" />
        </dl>
      </Section>

      <Section id="media" title="📸 Media" onEdit={onEdit}>
        <p style={valueStyle}>
          {mediaOptOut
            ? 'Opted out: photos of this player will not be used in team communications or shared within the team.'
            : 'Photos of this player may appear in team communications and be shared within the team. (We never post players to social media either way.)'}
        </p>
      </Section>

      <Section id="coach-volunteering" title="👊 Coach volunteering" onEdit={onEdit}>
        <dl className="space-y-3">
          <Field label="Interested in helping coach?" value={v(SIGNUPS_COLUMNS.COACH_VOLUNTEERING_INTEREST)} placeholder="Not answered" />
          <Field label="Ultimate experience" value={v(SIGNUPS_COLUMNS.COACH_ULTIMATE_EXPERIENCE)} />
          <Field label="Other team sports experience" value={v(SIGNUPS_COLUMNS.COACH_OTHER_SPORTS_EXPERIENCE)} />
        </dl>
      </Section>

      <Section id="other-volunteering" title="🙋 Other volunteering" onEdit={onEdit}>
        <dl className="space-y-3">
          <Field label="Ways you might help this season" value={list(v(SIGNUPS_COLUMNS.VOLUNTEER_ROLES))} placeholder="Not answered" />
          <Field label="More about how you'd like to help" value={v(SIGNUPS_COLUMNS.VOLUNTEER_NOTES)} />
        </dl>
      </Section>

      <Section id="communication" title="💬 Communication" onEdit={onEdit}>
        <dl className="space-y-3">
          <Field label="Anything else you want to share" value={v(SIGNUPS_COLUMNS.ADDITIONAL_FEEDBACK)} />
        </dl>
        <div className="text-sm border-t pt-4 space-y-3" style={{ borderColor: 'var(--border)', color: 'var(--secondary-text)' }}>
          <p className="flex items-start gap-2">
            <WhatsAppIcon className="shrink-0 mt-0.5" />
            <span>
              Join our{' '}
              <a href={APP_CONFIG.WHATSAPP_JOIN_PATH} target="_blank" rel="noopener noreferrer" className="underline" style={linkStyle}>
                WhatsApp community
              </a>{' '}
              to ask questions ❓, share photos 📸, arrange carpools 🚗, etc. (
              <a href={APP_CONFIG.WHATSAPP_LEARN_MORE_URL} target="_blank" rel="noopener noreferrer" className="underline" style={linkStyle}>
                Learn more
              </a>
              )
            </span>
          </p>
          <p>
            Manage your{' '}
            <a href={APP_CONFIG.MAILING_LIST_JOIN_URL} target="_blank" rel="noopener noreferrer" className="underline" style={linkStyle}>
              Madison Ultimate newsletter
            </a>{' '}
            subscription with the Join and Leave buttons next to each email above, or on the newsletter page.
          </p>
          <p>
            Questions? Email{' '}
            <a href={`mailto:${APP_CONFIG.COACH_EMAIL}`} className="underline" style={linkStyle}>
              {APP_CONFIG.COACH_EMAIL}
            </a>
            .
          </p>
        </div>
      </Section>
    </div>
  )
}
