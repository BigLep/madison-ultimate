'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Package } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BottomTabNav, type BottomTabItem } from '@/components/portal/PortalNav'
import { formatJerseySize, JERSEY_SIZE_OPTIONS } from '@/lib/signup-form-schema'
import { formatLocalTimestamp, formatFullDate } from '@/lib/date-formatters'
import { formatTeamOrTbd, compareTeams } from '@/lib/team-display'
import { getJerseyManagerName, rememberJerseyManagerName } from '@/lib/jersey-session'
import {
  computeStock,
  stockTotals,
  hasUnpaidFee,
  isOpenLoan,
  newestFirst,
  MAX_MANAGER_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  type JerseyLoan,
  type StockRow,
  type FamilyJersey,
  type JerseyNote,
} from '@/lib/jerseys'

// The /jerseys screens (ADR 0009; docs/fall-2026/jersey-plan.md phase 4): Check-in, Check-out,
// and Stock tabs, a player panel with every action for that player, and Add note. All data comes
// from one GET /api/jerseys/state; after any write the page re-reads it.

type Screen = 'checkin' | 'checkout' | 'stock'

const TABS: Array<BottomTabItem<Screen>> = [
  { id: 'checkin', label: 'Check-in', icon: ArrowDownToLine },
  { id: 'checkout', label: 'Check-out', icon: ArrowUpFromLine },
  { id: 'stock', label: 'Stock', icon: Package },
]

interface JerseyPlayer {
  playerId: string
  fullName: string
  team: string
  jerseySize: string
}

interface JerseyState {
  players: JerseyPlayer[]
  loans: JerseyLoan[]
  stock: StockRow[]
  familyJerseys: FamilyJersey[]
  notes: JerseyNote[]
}

/** Who a panel or note is about: a Rostered Player, or someone only the loan rows still know. */
interface Subject {
  playerId: string
  fullName: string
  team: string
  jerseySize: string
}

const cardStyle = { background: 'var(--card-bg)', borderColor: 'var(--border)' } as const
const mutedStyle = { color: 'var(--secondary-text)' }
const textStyle = { color: 'var(--primary-text)' }
const titleStyle = { color: 'var(--page-title)' }
const warnStyle = { color: 'var(--availability-unsure-border)' }
const errorStyle = { color: 'var(--error-text, #f87171)' }
const selectClassName = 'flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'

const NOT_ON_ROSTER = 'Not on Roster'
/** The main action in a group; the theme's default button is too close to the card color. */
const primaryButton = 'bg-[var(--accent)] text-white hover:bg-[var(--accent)] hover:opacity-90'

function sizeLabel(code: string): string {
  return code ? `${formatJerseySize(code)} (${code})` : 'size not recorded'
}

/** Compact size name for the stock table ("Youth M"), from the signup form's own labels. */
function shortSizeLabel(code: string): string {
  return JERSEY_SIZE_OPTIONS.find(o => o.value === code)?.label || code
}

function whenText(iso: string): string {
  return iso ? formatLocalTimestamp(iso) : ''
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function matchesSearch(name: string, search: string): boolean {
  return name.toLowerCase().includes(search.trim().toLowerCase())
}

function groupByTeam<T>(items: T[], teamOf: (item: T) => string): Array<[string, T[]]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const team = teamOf(item)
    groups.set(team, [...(groups.get(team) || []), item])
  }
  return [...groups.entries()].sort(([a], [b]) => (a === NOT_ON_ROSTER ? 1 : b === NOT_ON_ROSTER ? -1 : compareTeams(a, b)))
}

function SizeSelect({ value, onChange, label, allowBlank }: { value: string; onChange: (v: string) => void; label: string; allowBlank?: boolean }) {
  return (
    <select aria-label={label} className={selectClassName} value={value} onChange={e => onChange(e.target.value)}>
      {allowBlank && <option value="">No size</option>}
      {!allowBlank && !value && <option value="">Pick a size…</option>}
      {JERSEY_SIZE_OPTIONS.map(o => (
        <option key={o.value} value={o.value}>
          {sizeLabel(o.value)}
        </option>
      ))}
    </select>
  )
}

export function JerseyManager({ workbookUrl }: { workbookUrl: string }) {
  const [state, setState] = useState<JerseyState | null>(null)
  const [loadError, setLoadError] = useState('')
  const [screen, setScreen] = useState<Screen>('checkin')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Subject | null>(null)
  const [noteFor, setNoteFor] = useState<Subject | 'general' | null>(null)
  const [managerName, setManagerName] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/jerseys/state', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setLoadError(data.error || 'Could not load the Jerseys workbook.')
        return
      }
      setLoadError('')
      setState(data)
    } catch {
      setLoadError('Network error loading the Jerseys workbook.')
    }
  }, [])

  useEffect(() => {
    setManagerName(getJerseyManagerName())
    load()
  }, [load])

  /** Posts a write stamped with the manager name; on success re-reads everything. */
  const write = useCallback(
    async (url: string, body: Record<string, unknown>, success: string): Promise<boolean> => {
      setMessage('')
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, by: managerName }),
        })
        const data = await res.json()
        if (!res.ok || !data.success) {
          setMessage(`⚠️ ${data.error || 'That did not save.'}`)
          await load()
          return false
        }
        setMessage(`✅ ${success}`)
        await load()
        return true
      } catch {
        setMessage('⚠️ Network error: nothing was saved. Try again.')
        return false
      }
    },
    [managerName, load]
  )

  const playersById = useMemo(() => new Map((state?.players || []).map(p => [p.playerId, p])), [state])

  const subjectFor = useCallback(
    (playerId: string, fallbackName: string): Subject =>
      playersById.get(playerId) || { playerId, fullName: fallbackName || playerId, team: NOT_ON_ROSTER, jerseySize: '' },
    [playersById]
  )

  if (managerName === null) return null
  if (!managerName) return <NamePrompt onSave={name => { rememberJerseyManagerName(name); setManagerName(name) }} />

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--primary-bg)' }}>
      <header className="border-b" style={cardStyle}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold" style={titleStyle}>
              Jerseys
            </h1>
            <p className="text-xs" style={mutedStyle}>
              Signed in as {managerName}.{' '}
              <button type="button" className="underline" onClick={() => setManagerName('')}>
                Not you?
              </button>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setNoteFor(selected || 'general')}>
            Add note
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 space-y-4">
        {message && (
          <p role="status" className="text-sm" style={textStyle}>
            {message}
          </p>
        )}
        {loadError && (
          <p className="text-sm" style={errorStyle}>
            {loadError}
          </p>
        )}
        {!state && !loadError && <p style={mutedStyle}>Loading…</p>}

        {state && noteFor && (
          <NoteForm
            subject={noteFor === 'general' ? null : noteFor}
            onCancel={() => setNoteFor(null)}
            onSave={async (note, size) => {
              const ok = await write(
                '/api/jerseys/notes',
                { note, size, playerId: noteFor === 'general' ? '' : noteFor.playerId },
                'Note saved.'
              )
              if (ok) setNoteFor(null)
            }}
          />
        )}

        {state && selected && (
          <PlayerPanel
            subject={selected}
            state={state}
            write={write}
            onClose={() => setSelected(null)}
            onAddNote={() => setNoteFor(selected)}
          />
        )}

        {state && !selected && screen !== 'stock' && (
          <Input aria-label="Search players" placeholder="Search by name" value={search} onChange={e => setSearch(e.target.value)} />
        )}

        {state && !selected && screen === 'checkin' && (
          <CheckInList state={state} search={search} subjectFor={subjectFor} onPick={setSelected} />
        )}
        {state && !selected && screen === 'checkout' && <CheckOutList state={state} search={search} onPick={setSelected} />}
        {state && !selected && screen === 'stock' && <StockView state={state} workbookUrl={workbookUrl} subjectFor={subjectFor} onPick={setSelected} />}
      </main>

      <BottomTabNav
        label="Jerseys"
        items={TABS}
        active={screen}
        onChange={s => {
          setScreen(s)
          setSelected(null)
          setMessage('')
        }}
      />
    </div>
  )
}

function NamePrompt({ onSave }: { onSave: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <div className="container mx-auto px-4 py-12 max-w-sm">
      <Card className="shadow-lg" style={cardStyle}>
        <CardContent className="pt-6 space-y-4">
          <h1 className="text-xl font-bold" style={titleStyle}>
            Who is checking jerseys?
          </h1>
          <p className="text-sm" style={mutedStyle}>
            Your name is saved on this device and recorded with every check-out, check-in, and note.
          </p>
          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault()
              if (name.trim()) onSave(name.trim())
            }}
          >
            <Input aria-label="Your name" placeholder="Your name" autoFocus maxLength={MAX_MANAGER_NAME_LENGTH} value={name} onChange={e => setName(e.target.value)} />
            <Button type="submit" className={`w-full ${primaryButton}`} disabled={!name.trim()}>
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function PlayerRow({ name, detail, onClick }: { name: string; detail?: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="w-full text-left py-2 flex items-center justify-between gap-2">
        <span className="font-medium" style={textStyle}>
          {name}
        </span>
        {detail && (
          <span className="text-sm shrink-0" style={mutedStyle}>
            {detail}
          </span>
        )}
      </button>
    </li>
  )
}

function TeamGroups<T>({ groups, render }: { groups: Array<[string, T[]]>; render: (item: T) => React.ReactNode }) {
  return (
    <>
      {groups.map(([team, items]) => (
        <Card key={team} style={cardStyle}>
          <CardContent className="pt-4">
            <h2 className="text-sm font-semibold mb-1" style={titleStyle}>
              {team === NOT_ON_ROSTER ? team : formatTeamOrTbd(team)} ({items.length})
            </h2>
            <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {items.map(render)}
            </ul>
          </CardContent>
        </Card>
      ))}
    </>
  )
}

function CheckInList({
  state,
  search,
  subjectFor,
  onPick,
}: {
  state: JerseyState
  search: string
  subjectFor: (playerId: string, name: string) => Subject
  onPick: (s: Subject) => void
}) {
  const open = state.loans.filter(isOpenLoan).filter(l => matchesSearch(l.playerName || l.playerId, search))
  const items = open.map(loan => ({ loan, subject: subjectFor(loan.playerId, loan.playerName) })).sort((a, b) => a.subject.fullName.localeCompare(b.subject.fullName))
  const unpaid = state.loans.filter(hasUnpaidFee).filter(l => matchesSearch(l.playerName || l.playerId, search))
  const outCount = state.loans.filter(isOpenLoan).length

  return (
    <div className="space-y-4">
      <p className="text-sm" style={mutedStyle}>
        {outCount} Program {outCount === 1 ? 'Jersey' : 'Jerseys'} still out. Tap a player to check theirs in.
      </p>
      {items.length === 0 && <p style={mutedStyle}>No open loans{search ? ' match that name' : ''}.</p>}
      <TeamGroups
        groups={groupByTeam(items, i => i.subject.team)}
        render={({ loan, subject }) => <PlayerRow key={loan.loanId} name={subject.fullName} detail={loan.size} onClick={() => onPick(subject)} />}
      />
      {unpaid.length > 0 && (
        <Card style={cardStyle}>
          <CardContent className="pt-4">
            <h2 className="text-sm font-semibold mb-1" style={titleStyle}>
              Unpaid Lost Jersey Fees
            </h2>
            <ul>
              {unpaid.map(l => (
                <PlayerRow key={l.loanId} name={l.playerName || l.playerId} detail={`$${l.feeIssued}`} onClick={() => onPick(subjectFor(l.playerId, l.playerName))} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function CheckOutList({ state, search, onPick }: { state: JerseyState; search: string; onPick: (s: Subject) => void }) {
  const openBy = new Set(state.loans.filter(isOpenLoan).map(l => l.playerId))
  const familyBy = new Set(state.familyJerseys.map(f => f.playerId))
  const players = state.players.filter(p => matchesSearch(p.fullName, search))
  return (
    <div className="space-y-4">
      <p className="text-sm" style={mutedStyle}>
        Every Rostered Player. Tap one to check out a Program Jersey or record a Family Jersey.
      </p>
      <TeamGroups
        groups={groupByTeam(players, p => p.team)}
        render={p => (
          <PlayerRow
            key={p.playerId}
            name={p.fullName}
            detail={openBy.has(p.playerId) ? 'Has a Program Jersey' : familyBy.has(p.playerId) ? 'Family Jersey' : p.jerseySize}
            onClick={() => onPick(p)}
          />
        )}
      />
    </div>
  )
}

function StockView({
  state,
  workbookUrl,
  subjectFor,
  onPick,
}: {
  state: JerseyState
  workbookUrl: string
  subjectFor: (playerId: string, name: string) => Subject
  onPick: (s: Subject) => void
}) {
  const lines = computeStock(state.stock, state.loans)
  const totals = stockTotals(lines)
  const unpaid = state.loans.filter(hasUnpaidFee)
  const recentNotes = newestFirst(state.notes, n => n.recordedAt).slice(0, 10)
  const cell = 'py-1 px-2 text-right'
  return (
    <div className="space-y-4">
      <Card style={cardStyle}>
        <CardContent className="pt-4 overflow-x-auto">
          <table className="w-full text-sm" style={textStyle}>
            <thead style={mutedStyle}>
              <tr>
                <th className="py-1 px-2 text-left">Size</th>
                <th className={cell}>Owned</th>
                <th className={cell}>Out</th>
                <th className={cell}>Lost</th>
                <th className={cell}>On hand</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(l => (
                <tr key={l.size} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="py-1 px-2 whitespace-nowrap">{shortSizeLabel(l.size)}</td>
                  <td className={cell}>{l.totalOwned}</td>
                  <td className={cell}>{l.out}</td>
                  <td className={cell}>{l.lost}</td>
                  <td className={cell} style={l.onHand < 0 ? warnStyle : undefined}>
                    {l.onHand}
                  </td>
                </tr>
              ))}
              <tr className="border-t font-semibold" style={{ borderColor: 'var(--border)' }}>
                <td className="py-1 px-2">Total</td>
                <td className={cell}>{totals.totalOwned}</td>
                <td className={cell}>{totals.out}</td>
                <td className={cell}>{totals.lost}</td>
                <td className={cell}>{totals.onHand}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs mt-2" style={mutedStyle}>
            On hand = owned − out − lost. To change what the program owns (bought, found, retired, or a shelf count that doesn&apos;t match), edit Total Owned in the{' '}
            {workbookUrl ? (
              <a href={workbookUrl} target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--accent)' }}>
                Jerseys workbook
              </a>
            ) : (
              'Jerseys workbook'
            )}{' '}
            and say why in that size&apos;s Notes.
          </p>
        </CardContent>
      </Card>

      <Card style={cardStyle}>
        <CardContent className="pt-4">
          <h2 className="text-sm font-semibold mb-1" style={titleStyle}>
            Unpaid Lost Jersey Fees
          </h2>
          {unpaid.length === 0 ? (
            <p className="text-sm" style={mutedStyle}>
              None.
            </p>
          ) : (
            <ul>
              {unpaid.map(l => (
                <PlayerRow key={l.loanId} name={l.playerName || l.playerId} detail={`$${l.feeIssued}`} onClick={() => onPick(subjectFor(l.playerId, l.playerName))} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card style={cardStyle}>
        <CardContent className="pt-4">
          <h2 className="text-sm font-semibold mb-1" style={titleStyle}>
            Recent notes
          </h2>
          {recentNotes.length === 0 ? (
            <p className="text-sm" style={mutedStyle}>
              None yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {recentNotes.map((n, i) => (
                <NoteItem key={i} note={n} showPlayer />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function NoteItem({ note, showPlayer }: { note: JerseyNote; showPlayer?: boolean }) {
  const about = [showPlayer ? note.playerName : '', note.size].filter(Boolean).join(', ')
  return (
    <li className="text-sm">
      <p style={textStyle}>{note.note}</p>
      <p className="text-xs" style={mutedStyle}>
        {[note.recordedBy, whenText(note.recordedAt), about].filter(Boolean).join(' · ')}
      </p>
    </li>
  )
}

function NoteForm({ subject, onCancel, onSave }: { subject: Subject | null; onCancel: () => void; onSave: (note: string, size: string) => Promise<void> }) {
  const [note, setNote] = useState('')
  const [size, setSize] = useState('')
  const [saving, setSaving] = useState(false)
  return (
    <Card style={cardStyle}>
      <CardContent className="pt-4">
        <form
          className="space-y-3"
          onSubmit={async e => {
            e.preventDefault()
            setSaving(true)
            await onSave(note, size)
            setSaving(false)
          }}
        >
          <h2 className="font-semibold" style={titleStyle}>
            {subject ? `Note about ${subject.fullName}` : 'General note'}
          </h2>
          <textarea
            aria-label="Note"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            rows={3}
            maxLength={MAX_NOTE_LENGTH}
            autoFocus
            placeholder="What did you notice?"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
          <SizeSelect label="Size (optional)" value={size} onChange={setSize} allowBlank />
          <p className="text-xs" style={mutedStyle}>
            Notes are never shown to families.
          </p>
          <div className="flex gap-2">
            <Button type="submit" className={primaryButton} disabled={!note.trim() || saving}>
              {saving ? 'Saving…' : 'Save note'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

type Write = (url: string, body: Record<string, unknown>, success: string) => Promise<boolean>

function PlayerPanel({
  subject,
  state,
  write,
  onClose,
  onAddNote,
}: {
  subject: Subject
  state: JerseyState
  write: Write
  onClose: () => void
  onAddNote: () => void
}) {
  const loans = newestFirst(
    state.loans.filter(l => l.playerId === subject.playerId),
    l => l.checkedInAt || l.checkedOutAt || '0'
  )
  const open = loans.filter(isOpenLoan)
  const closed = loans.filter(l => !isOpenLoan(l))
  const family = state.familyJerseys.filter(f => f.playerId === subject.playerId)
  const notes = newestFirst(state.notes.filter(n => n.playerId === subject.playerId), n => n.recordedAt)
  const onRoster = subject.team !== NOT_ON_ROSTER

  return (
    <Card style={cardStyle}>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold" style={titleStyle}>
              {subject.fullName}
            </h2>
            <p className="text-sm" style={mutedStyle}>
              {onRoster ? formatTeamOrTbd(subject.team) : NOT_ON_ROSTER}
              {subject.jerseySize && ` · asked for ${sizeLabel(subject.jerseySize)} at signup`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Back
          </Button>
        </div>

        {open.map(loan => (
          <OpenLoan key={loan.loanId} loan={loan} write={write} />
        ))}

        {closed.filter(hasUnpaidFee).map(loan => (
          <FeePaid key={loan.loanId} loan={loan} write={write} />
        ))}

        {onRoster && <CheckOut subject={subject} hasOpenLoan={open.length > 0} hasFamilyJersey={family.length > 0} write={write} />}
        {onRoster && <RecordFamilyJersey subject={subject} family={family} write={write} />}

        <section className="space-y-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={titleStyle}>
              Notes
            </h3>
            <Button variant="outline" size="sm" onClick={onAddNote}>
              Add note
            </Button>
          </div>
          {notes.length === 0 ? (
            <p className="text-sm" style={mutedStyle}>
              None.
            </p>
          ) : (
            <ul className="space-y-2">
              {notes.map((n, i) => (
                <NoteItem key={i} note={n} />
              ))}
            </ul>
          )}
        </section>

        {closed.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-1" style={titleStyle}>
              Past loans
            </h3>
            <ul className="text-sm space-y-1" style={mutedStyle}>
              {closed.map(l => (
                <li key={l.loanId}>
                  {l.size} · {l.outcome}
                  {l.checkedInAt && ` ${whenText(l.checkedInAt)}`}
                  {l.checkedInBy && ` by ${l.checkedInBy}`}
                  {l.feeIssued && ` · fee $${l.feeIssued}${l.feePaidOn ? ` paid ${formatFullDate(l.feePaidOn)}` : ' unpaid'}`}
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  )
}

function OpenLoan({ loan, write }: { loan: JerseyLoan; write: Write }) {
  const [mode, setMode] = useState<'idle' | 'size' | 'lost'>('idle')
  const [size, setSize] = useState(loan.size)
  const [fee, setFee] = useState('')
  const [busy, setBusy] = useState(false)
  const url = `/api/jerseys/loans/${encodeURIComponent(loan.loanId)}/checkin`
  const run = async (body: Record<string, unknown>, success: string) => {
    setBusy(true)
    await write(url, body, success)
    setBusy(false)
  }
  const out = loan.checkedOutAt
    ? `Checked out ${whenText(loan.checkedOutAt)}${loan.checkedOutBy ? ` by ${loan.checkedOutBy}` : ''}`
    : loan.checkedOutBy
      ? `Checked out: ${loan.checkedOutBy}`
      : ''

  return (
    <section className="rounded-md border p-3 space-y-2" style={{ borderColor: 'var(--accent)' }}>
      <p style={textStyle}>
        Has a Program Jersey: <strong>{sizeLabel(loan.size)}</strong>
      </p>
      {out && (
        <p className="text-xs" style={mutedStyle}>
          {out}
        </p>
      )}
      {loan.notes && (
        <p className="text-xs" style={mutedStyle}>
          {loan.notes}
        </p>
      )}
      {mode === 'idle' && (
        <div className="flex flex-wrap gap-2">
          <Button className={primaryButton} disabled={busy} onClick={() => run({ outcome: 'Returned' }, `${loan.size} checked in.`)}>
            Returned
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => setMode('size')}>
            Returned, different size
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => setMode('lost')}>
            Lost
          </Button>
        </div>
      )}
      {mode === 'size' && (
        <div className="space-y-2">
          <SizeSelect label="Size actually returned" value={size} onChange={setSize} />
          <div className="flex gap-2">
            <Button className={primaryButton} disabled={busy || !size} onClick={() => run({ outcome: 'Returned', size }, `Checked in as ${size}.`)}>
              Check in as {size}
            </Button>
            <Button variant="outline" onClick={() => setMode('idle')}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {mode === 'lost' && (
        <div className="space-y-2">
          <Input aria-label="Lost Jersey Fee (optional)" inputMode="decimal" placeholder="Fee in dollars (leave blank for no fee)" value={fee} onChange={e => setFee(e.target.value)} />
          <div className="flex gap-2">
            <Button className={primaryButton} disabled={busy} onClick={() => run({ outcome: 'Lost', fee }, fee ? `Marked lost with a $${fee.replace(/^\$/, '')} fee.` : 'Marked lost.')}>
              Mark lost
            </Button>
            <Button variant="outline" onClick={() => setMode('idle')}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function FeePaid({ loan, write }: { loan: JerseyLoan; write: Write }) {
  const [paidOn, setPaidOn] = useState(todayIso())
  const [busy, setBusy] = useState(false)
  return (
    <section className="rounded-md border p-3 space-y-2" style={{ borderColor: 'var(--availability-unsure-border)' }}>
      <p style={textStyle}>
        Lost {loan.size}: <strong>${loan.feeIssued} fee unpaid</strong>
      </p>
      <div className="flex gap-2 items-center">
        <Input aria-label="Date paid" type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} className="max-w-[11rem]" />
        <Button
          className={primaryButton}
          disabled={busy || !paidOn}
          onClick={async () => {
            setBusy(true)
            await write(`/api/jerseys/loans/${encodeURIComponent(loan.loanId)}/fee-paid`, { paidOn }, 'Fee marked paid.')
            setBusy(false)
          }}
        >
          Fee paid
        </Button>
      </div>
    </section>
  )
}

function CheckOut({ subject, hasOpenLoan, hasFamilyJersey, write }: { subject: Subject; hasOpenLoan: boolean; hasFamilyJersey: boolean; write: Write }) {
  const [size, setSize] = useState(subject.jerseySize)
  const [busy, setBusy] = useState(false)
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold" style={titleStyle}>
        Check out a Program Jersey
      </h3>
      {hasOpenLoan && (
        <p className="text-sm" style={warnStyle}>
          Already has a Program Jersey out. Check that one in first unless you mean to lend a second.
        </p>
      )}
      {hasFamilyJersey && (
        <p className="text-sm" style={warnStyle}>
          Has a Family Jersey, so probably doesn&apos;t need a Program Jersey.
        </p>
      )}
      <div className="flex gap-2">
        <SizeSelect label="Size to check out" value={size} onChange={setSize} />
        <Button
          className={primaryButton}
          disabled={busy || !size}
          onClick={async () => {
            setBusy(true)
            await write('/api/jerseys/checkout', { playerId: subject.playerId, size }, `${size} checked out to ${subject.fullName}.`)
            setBusy(false)
          }}
        >
          Check out
        </Button>
      </div>
    </section>
  )
}

function RecordFamilyJersey({ subject, family, write }: { subject: Subject; family: FamilyJersey[]; write: Write }) {
  const [open, setOpen] = useState(false)
  const [size, setSize] = useState(subject.jerseySize)
  const [busy, setBusy] = useState(false)
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold" style={titleStyle}>
        Family Jersey
      </h3>
      {family.length > 0 ? (
        <p className="text-sm" style={textStyle}>
          {family.map(f => `${sizeLabel(f.size)}${f.seasonRecorded ? `, ${f.seasonRecorded}` : ''}`).join('; ')}
        </p>
      ) : (
        <p className="text-sm" style={mutedStyle}>
          None recorded.
        </p>
      )}
      {!open ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Has a Family Jersey
        </Button>
      ) : (
        <div className="flex gap-2">
          <SizeSelect label="Family Jersey size" value={size} onChange={setSize} />
          <Button
            className={primaryButton}
            disabled={busy || !size}
            onClick={async () => {
              setBusy(true)
              const ok = await write('/api/jerseys/family-jerseys', { playerId: subject.playerId, size }, `Family Jersey recorded for ${subject.fullName}.`)
              setBusy(false)
              if (ok) setOpen(false)
            }}
          >
            Save
          </Button>
        </div>
      )}
    </section>
  )
}
