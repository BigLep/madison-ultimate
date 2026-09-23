import { coachInitials } from '@/lib/coaches-table'

// A Coach Photo, or the coach's initials until they upload one (grill Q32). `version` busts the
// browser cache after an upload.
export function CoachAvatar({ coachId, name, hasPhoto, size = 96, version }: { coachId: string; name: string; hasPhoto: boolean; size?: number; version?: number }) {
  const style = { width: size, height: size }
  if (hasPhoto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/coaches/${coachId}/photo${version ? `?v=${version}` : ''}`}
        alt={name}
        className="rounded-full object-cover shrink-0"
        style={style}
      />
    )
  }
  return (
    <div
      aria-hidden="true"
      className="rounded-full shrink-0 flex items-center justify-center font-semibold bg-[var(--border)] text-[var(--secondary-header)]"
      style={{ ...style, fontSize: size / 3 }}
    >
      {coachInitials(name)}
    </div>
  )
}
