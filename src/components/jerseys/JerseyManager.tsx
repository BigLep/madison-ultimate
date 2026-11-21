'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownToLine, ChevronRight, Users, Package } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BottomTabNav, type BottomTabItem } from '@/components/portal/PortalNav'
import { formatJerseySize, JERSEY_SIZE_OPTIONS } from '@/lib/signup-form-schema'
import { formatLocalTimestamp, formatFullDate } from '@/lib/date-formatters'
import { formatTeamOrTbd, compareTeams } from '@/lib/team-display'
import { getJerseyManagerName, rememberJerseyManagerName } from '@/lib/jersey-session'
import { jerseyReminderEmail, mailtoUrl, type FamilyContact } from '@/lib/jersey-reminder'
import { APP_CONFIG } from '@/lib/app-config'
import { parseJerseyHash, jerseyHash, filtersForUrl, filterQuery, type JerseyScreen } from '@/lib/jersey-url'
import {
  computeStock,
  stockTotals,
  hasUnpaidFee,
  isOpenLoan,
  newestFirst,
  jerseyStatusesFor,
  filterOptions,
  matchesJerseyFilters,
  NOT_ON_ROSTER,
  type JerseyFilters,
  keepAvailable,
  JERSEY_STATUSES,
  type JerseyStatus,
  MAX_MANAGER_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  type JerseyLoan,
  type StockRow,
  type FamilyJersey,
  type JerseyNote,
} from '@/lib/jerseys'

// The /jerseys screens (ADR 0009; docs/fall-2026/jersey-plan.md phase 4): Check-in, Players
// (where check-out happens), and Stock tabs, with the Player Directory's team and gender filters
// plus a jersey status filter, a player panel with every action for that player, and Add note. All data comes
// from one GET /api/jerseys/state; after any write the page re-reads it.

type Screen = JerseyScreen

const TABS: Array<BottomTabItem<Screen>> = [
  { id: 'checkin', label: 'Check-in', icon: ArrowDownToLine },
  { id: 'players', label: 'Players', icon: Users },
  { id: 'stock', label: 'Stock', icon: Package },
]

interface JerseyPlayer {
  playerId: string
  fullName: string
  team: string
  gender: string
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
  gender: string
  jerseySize: string
}

/** Checkbox filters, as in the Player Directory: OR within a group, AND across groups, none = all. */
type Filters = JerseyFilters

// A Jersey Manager's filters are a per-device convenience, like the Player Directory's.
const FILTER_STORAGE_KEYS = { teams: 'jerseys-filter-teams', genders: 'jerseys-filter-genders', statuses: 'jerseys-filter-statuses' } as const

function loadStoredList(key: string): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function storeList(key: string, values: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(values))
  } catch {
    // Blocked storage: the filter just won't persist.
  }
}

function matchesFilters(subject: Subject, statuses: Set<JerseyStatus>, filters: Filters, useStatus: boolean): boolean {
  return matchesJerseyFilters(subject, statuses, filters, useStatus)
}

const cardStyle = { background: 'var(--card-bg)', borderColor: 'var(--border)' } as const
const mutedStyle = { color: 'var(--secondary-text)' }
const textStyle = { color: 'var(--primary-text)' }
const titleStyle = { color: 'var(--page-title)' }
const warnStyle = { color: 'var(--availability-unsure-border)' }
const selectClassName = 'flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900'

// Button styles match the rest of the portal (PlayerProfileForm, CoachProfile, PasswordGateForm):
// the main action is accent-filled, everything else is the outline variant, and both are at least
// 44px tall so they are easy to tap.
const primaryButton = 'min-h-[44px] text-white font-semibold bg-[var(--accent)] hover:bg-[var(--accent)] hover:opacity-90'
const secondaryButton = 'min-h-[44px]'

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
  // The tab and open player come from the URL hash (jersey-url.ts), so the back button and
  // bookmarks work like the Player Portal's tabs; navigate() only ever changes the hash.
  const [screen, setScreen] = useState<Screen>('checkin')
  const [selectedId, setSelectedId] = useState('')
  const [filters, setFilters] = useState<Filters>({ search: '', teams: [], genders: [], statuses: [] })
  const [filtersReady, setFiltersReady] = useState(false)
  const [noteFor, setNoteFor] = useState<Subject | 'general' | null>(null)
  const [managerName, setManagerName] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

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

  // The URL is the source of truth for tab, open player, and filters. It is applied on first load
  // and on every history move (back/forward can change the query, the hash, or both), so the page
  // always shows exactly what the current entry says. On first load only, a URL naming no
  // filters falls back to this device's saved ones.
  useEffect(() => {
    const applyUrl = (initial: boolean) => {
      const location = parseJerseyHash(window.location.hash)
      setScreen(location.screen)
      setSelectedId(location.playerId)
      setNoteFor(null)
      const saved = {
        search: '',
        teams: loadStoredList(FILTER_STORAGE_KEYS.teams),
        genders: loadStoredList(FILTER_STORAGE_KEYS.genders),
        statuses: loadStoredList(FILTER_STORAGE_KEYS.statuses),
      }
      const next = filtersForUrl(window.location.search, { initial, saved })
      setFilters({ ...next, statuses: next.statuses as JerseyStatus[] })
      setFiltersReady(true)
    }
    const onHistory = () => applyUrl(false)
    applyUrl(true)
    window.addEventListener('popstate', onHistory)
    window.addEventListener('hashchange', onHistory)
    return () => {
      window.removeEventListener('popstate', onHistory)
      window.removeEventListener('hashchange', onHistory)
    }
  }, [])

  /** Every tab change or player tap is its own history entry, as in the Player Portal. */
  const navigate = useCallback((next: Screen, playerId = '') => {
    setMessage(null)
    window.location.hash = jerseyHash({ screen: next, playerId })
  }, [])

  // Like the portal's "✓ Saved" button, a success confirmation is brief; errors stay until the next action.
  useEffect(() => {
    if (message?.kind !== 'success') return
    const timer = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [message])

  const options = useMemo(() => filterOptions(state?.players || []), [state])

  // Saved choices for a team or gender no longer on the roster are dropped, never left hiding
  // everyone behind a checkbox that isn't shown.
  const activeFilters = useMemo<Filters>(
    () =>
      state
        ? { ...filters, teams: keepAvailable(filters.teams, options.teams), genders: keepAvailable(filters.genders, options.genders) }
        : filters,
    [filters, options, state]
  )

  // Filters edit the query string in place (no history entry per checkbox), keeping the hash.
  useEffect(() => {
    if (!filtersReady) return
    const url = window.location.pathname + filterQuery(activeFilters) + window.location.hash
    if (url !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(null, '', url)
  }, [activeFilters, filtersReady])

  const toggleFilter = (group: 'teams' | 'genders' | 'statuses', value: string) => {
    const current = activeFilters[group] as string[]
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
    storeList(FILTER_STORAGE_KEYS[group], next)
    setFilters(f => ({ ...f, [group]: next }))
  }

  const clearFilters = () => {
    for (const key of Object.values(FILTER_STORAGE_KEYS)) storeList(key, [])
    setFilters({ search: '', teams: [], genders: [], statuses: [] })
  }

  /** Posts a write stamped with the manager name; on success re-reads everything. */
  const write = useCallback(
    async (url: string, body: Record<string, unknown>, success: string): Promise<boolean> => {
      setMessage(null)
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, by: managerName }),
        })
        const data = await res.json()
        if (!res.ok || !data.success) {
          setMessage({ kind: 'error', text: data.error || 'That did not save.' })
          await load()
          return false
        }
        setMessage({ kind: 'success', text: success })
        await load()
        return true
      } catch {
        setMessage({ kind: 'error', text: 'Network error. Nothing was saved; please try again.' })
        return false
      }
    },
    [managerName, load]
  )

  const playersById = useMemo(() => new Map((state?.players || []).map(p => [p.playerId, p])), [state])

  const subjectFor = useCallback(
    (playerId: string, fallbackName: string): Subject =>
      playersById.get(playerId) || { playerId, fullName: fallbackName || playerId, team: NOT_ON_ROSTER, gender: '', jerseySize: '' },
    [playersById]
  )

  const selected = useMemo<Subject | null>(() => {
    if (!selectedId || !state) return null
    return subjectFor(selectedId, state.loans.find(l => l.playerId === selectedId)?.playerName || '')
  }, [selectedId, state, subjectFor])

  const pick = useCallback((subject: Subject) => navigate(screen, subject.playerId), [navigate, screen])

  if (managerName === null) return null
  if (!managerName) return <NamePrompt onSave={name => { rememberJerseyManagerName(name); setManagerName(name) }} />

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--primary-bg)' }}>
      <header className="border-b" style={cardStyle}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <Breadcrumbs screen={screen} playerName={selected?.fullName} />
            <p className="text-xs" style={mutedStyle}>
              Signed in as {managerName}.{' '}
              <button type="button" className="underline" onClick={() => setManagerName('')}>
                Not you?
              </button>
            </p>
          </div>
          {!selected && (
            <Button variant="outline" size="sm" className={secondaryButton} onClick={() => setNoteFor('general')}>
              Add note
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 space-y-4">
        {message && <SaveBanner message={message} />}
        {loadError && <SaveBanner message={{ kind: 'error', text: loadError }} />}
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
            onAddNote={() => setNoteFor(selected)}
          />
        )}

        {state && !selected && screen !== 'stock' && (
          <FilterBar
            options={options}
            filters={activeFilters}
            showStatus={screen === 'players'}
            onSearch={search => setFilters(f => ({ ...f, search }))}
            onToggle={toggleFilter}
            onClear={clearFilters}
          />
        )}

        {state && !selected && screen === 'checkin' && (
          <CheckInList state={state} filters={activeFilters} subjectFor={subjectFor} onPick={pick} />
        )}
        {state && !selected && screen === 'players' && <PlayersList state={state} filters={activeFilters} onPick={pick} />}
        {state && !selected && screen === 'stock' && <StockView state={state} workbookUrl={workbookUrl} subjectFor={subjectFor} onPick={pick} />}
      </main>

      <BottomTabNav
        label="Jerseys"
        items={TABS}
        active={screen}
        onChange={s => navigate(s)}
      />
    </div>
  )
}

/**
 * Save feedback in the Player Portal's style: its error banner (PlayerProfileForm's save bar), and
 * the same shape in green for success, since here the button that was tapped usually disappears.
 */
function SaveBanner({ message }: { message: { kind: 'success' | 'error'; text: string } }) {
  return message.kind === 'error' ? (
    <div role="alert" aria-live="assertive" className="border px-4 py-3 rounded font-medium bg-red-50 border-red-200 text-red-600">
      {message.text}
    </div>
  ) : (
    <div role="status" aria-live="polite" className="border px-4 py-3 rounded font-medium bg-green-50 border-green-200 text-green-800">
      ✓ {message.text}
    </div>
  )
}

const SCREEN_LABELS: Record<Screen, string> = { checkin: 'Check-in', players: 'Players', stock: 'Stock' }

/** "Jerseys › Check-in › Player": every crumb but the last is a link, so it replaces a Back button. */
function Breadcrumbs({ screen, playerName }: { screen: Screen; playerName?: string }) {
  const link = 'underline-offset-4 hover:underline'
  const crumbs: Array<{ label: string; href?: string }> = [
    { label: 'Jerseys', href: '#checkin' },
    { label: SCREEN_LABELS[screen], href: playerName ? `#${screen}` : undefined },
    ...(playerName ? [{ label: playerName }] : []),
  ]
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-1 text-lg font-bold" style={titleStyle}>
        {crumbs.map((c, i) => (
          <li key={i} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight className="w-4 h-4 shrink-0" style={mutedStyle} aria-hidden="true" />}
            {c.href ? (
              <a href={c.href} className={link}>
                {c.label}
              </a>
            ) : (
              <span aria-current="page" className="truncate">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
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

/** A tappable player row, styled like the Player Directory's, with a chevron so it reads as a link. */
function PlayerRow({ name, detail, onClick }: { name: string; detail?: string; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left min-h-[44px] py-2 -mx-2 px-2 rounded-md flex items-center gap-2 cursor-pointer hover:bg-[var(--primary-bg)] transition-colors"
      >
        <span className="font-medium flex-1" style={textStyle}>
          {name}
        </span>
        {detail && (
          <span className="text-sm shrink-0" style={mutedStyle}>
            {detail}
          </span>
        )}
        <ChevronRight className="w-4 h-4 shrink-0" style={mutedStyle} aria-hidden="true" />
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

function FilterBar({
  options,
  filters,
  showStatus,
  onSearch,
  onToggle,
  onClear,
}: {
  options: { teams: string[]; genders: string[] }
  filters: Filters
  showStatus: boolean
  onSearch: (search: string) => void
  onToggle: (group: 'teams' | 'genders' | 'statuses', value: string) => void
  onClear: () => void
}) {
  const { teams, genders } = options
  const active = filters.teams.length + filters.genders.length + (showStatus ? filters.statuses.length : 0)

  const group = (legend: string, name: 'teams' | 'genders' | 'statuses', options: Array<{ value: string; label: string }>) =>
    options.length > 0 && (
      <fieldset>
        <legend className="text-sm mb-2" style={mutedStyle}>
          {legend}
        </legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {options.map(o => (
            <label key={o.value} className="flex items-center gap-2 text-sm" style={textStyle}>
              <input type="checkbox" className="h-4 w-4" checked={(filters[name] as string[]).includes(o.value)} onChange={() => onToggle(name, o.value)} />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
    )

  return (
    <div className="space-y-4">
      {group('Filter by team', 'teams', teams.map(t => ({ value: t, label: formatTeamOrTbd(t) })))}
      {group('Filter by gender', 'genders', genders.map(g => ({ value: g, label: g })))}
      {showStatus && group('Filter by jersey status', 'statuses', JERSEY_STATUSES.map(st => ({ value: st.id, label: st.label })))}
      {(active > 0 || filters.search) && (
        <Button variant="outline" size="sm" className={secondaryButton} onClick={onClear}>
          Clear filters
        </Button>
      )}
      <Input aria-label="Search players" placeholder="Search by name" value={filters.search} onChange={e => onSearch(e.target.value)} />
    </div>
  )
}

function CheckInList({
  state,
  filters,
  subjectFor,
  onPick,
}: {
  state: JerseyState
  filters: Filters
  subjectFor: (playerId: string, name: string) => Subject
  onPick: (s: Subject) => void
}) {
  const none = new Set<JerseyStatus>()
  const items = state.loans
    .filter(isOpenLoan)
    .map(loan => ({ loan, subject: subjectFor(loan.playerId, loan.playerName) }))
    .filter(i => matchesFilters(i.subject, none, filters, false))
    .sort((a, b) => a.subject.fullName.localeCompare(b.subject.fullName))
  const unpaid = state.loans.filter(hasUnpaidFee).filter(l => matchesFilters(subjectFor(l.playerId, l.playerName), none, filters, false))
  const outCount = state.loans.filter(isOpenLoan).length
  const filtered = items.length !== outCount

  return (
    <div className="space-y-4">
      <p className="text-sm" style={mutedStyle}>
        {outCount} Program {outCount === 1 ? 'Jersey' : 'Jerseys'} still out{filtered ? `, ${items.length} shown` : ''}. Tap a player to check theirs in.
      </p>
      {items.length > 0 && (
        <Button asChild variant="outline" size="sm" className={secondaryButton}>
          <a href={`/api/jerseys/outstanding-xlsx${filterQuery({ ...filters, statuses: [] })}`} download>
            Download as XLSX{filtered ? ` (${items.length} shown)` : ''}
          </a>
        </Button>
      )}
      {items.length === 0 && <p style={mutedStyle}>No open loans{filtered ? ' match these filters' : ''}.</p>}
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

/** What a player's row says at a glance, most pressing first. */
function statusDetail(statuses: Set<JerseyStatus>, openSize: string | undefined, requestedSize: string): string {
  if (statuses.has('unpaid-fee')) return 'Unpaid fee'
  if (statuses.has('outstanding')) return `Has ${openSize || 'a jersey'}`
  if (statuses.has('lost')) return 'Lost'
  if (statuses.has('returned')) return 'Returned'
  if (statuses.has('family')) return 'Family Jersey'
  return requestedSize
}

function PlayersList({ state, filters, onPick }: { state: JerseyState; filters: Filters; onPick: (s: Subject) => void }) {
  const rows = state.players.map(p => ({
    player: p,
    statuses: jerseyStatusesFor(p.playerId, state.loans, state.familyJerseys),
    openSize: state.loans.find(l => l.playerId === p.playerId && isOpenLoan(l))?.size,
  }))
  const shown = rows.filter(r => matchesFilters(r.player, r.statuses, filters, true))
  return (
    <div className="space-y-4">
      <p className="text-sm" style={mutedStyle}>
        {shown.length === rows.length ? `All ${rows.length} Rostered Players.` : `${shown.length} of ${rows.length} Rostered Players.`} Tap one to check out a Program Jersey or record a Family Jersey.
      </p>
      {shown.length === 0 && <p style={mutedStyle}>No players match these filters.</p>}
      <TeamGroups
        groups={groupByTeam(shown, r => r.player.team)}
        render={r => (
          <PlayerRow key={r.player.playerId} name={r.player.fullName} detail={statusDetail(r.statuses, r.openSize, r.player.jerseySize)} onClick={() => onPick(r.player)} />
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
            <Button type="button" variant="outline" size="sm" className={secondaryButton} onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

type Write = (url: string, body: Record<string, unknown>, success: string) => Promise<boolean>

/**
 * One player, laid out for a Jersey Manager working through a line of families: what they have out
 * and the Returned / Lost actions first, then notes. Checking out is up front only when nothing is
 * out (that is why you opened them); otherwise it sits with Family Jersey and past loans under a
 * collapsed "More options".
 */
function PlayerPanel({
  subject,
  state,
  write,
  onAddNote,
}: {
  subject: Subject
  state: JerseyState
  write: Write
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
  const checkOut = onRoster && <CheckOut subject={subject} hasOpenLoan={open.length > 0} hasFamilyJersey={family.length > 0} write={write} />
  // Parent contacts load only once More options is opened, so browsing never pulls family emails.
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <Card style={cardStyle}>
      <CardContent className="pt-4 space-y-4">
        {/* The name is also in the breadcrumb, but this is where a manager's eyes land before tapping Returned. */}
        <div>
          <h2 className="text-xl font-bold" style={titleStyle}>
            {subject.fullName}
          </h2>
          <p className="text-sm" style={mutedStyle}>
            {onRoster ? formatTeamOrTbd(subject.team) : NOT_ON_ROSTER}
            {open.length === 0 && subject.jerseySize && ` · asked for ${sizeLabel(subject.jerseySize)} at signup`}
          </p>
        </div>

        {open.map(loan => (
          <OpenLoan key={loan.loanId} loan={loan} write={write} />
        ))}

        {closed.filter(hasUnpaidFee).map(loan => (
          <FeePaid key={loan.loanId} loan={loan} write={write} />
        ))}

        {open.length === 0 && checkOut}

        <Button variant="outline" size="sm" className={secondaryButton} onClick={onAddNote}>
          Add note
        </Button>

        {notes.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold" style={titleStyle}>
              Notes
            </h3>
            <ul className="space-y-2">
              {notes.map((n, i) => (
                <NoteItem key={i} note={n} />
              ))}
            </ul>
          </section>
        )}

        {(onRoster || closed.length > 0) && (
          <details className="border-t pt-3" style={{ borderColor: 'var(--border)' }} onToggle={e => setMoreOpen((e.currentTarget as HTMLDetailsElement).open)}>
            <summary className="text-sm cursor-pointer min-h-[44px] flex items-center" style={mutedStyle}>
              More options
            </summary>
            <div className="space-y-4 pt-2">
              {onRoster && moreOpen && <ContactParents subject={subject} openSizes={open.map(l => l.size)} />}
              {open.length > 0 && checkOut}
              {onRoster && <RecordFamilyJersey subject={subject} family={family} write={write} />}
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
            </div>
          </details>
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
            {busy ? 'Saving…' : 'Returned'}
          </Button>
          <Button variant="outline" size="sm" className={secondaryButton} disabled={busy} onClick={() => setMode('size')}>
            Returned, different size
          </Button>
          <Button variant="outline" size="sm" className={secondaryButton} disabled={busy} onClick={() => setMode('lost')}>
            Lost
          </Button>
        </div>
      )}
      {mode === 'size' && (
        <div className="space-y-2">
          <SizeSelect label="Size actually returned" value={size} onChange={setSize} />
          <div className="flex gap-2">
            <Button className={primaryButton} disabled={busy || !size} onClick={() => run({ outcome: 'Returned', size }, `Checked in as ${size}.`)}>
              {busy ? 'Saving…' : `Check in as ${size}`}
            </Button>
            <Button variant="outline" size="sm" className={secondaryButton} onClick={() => setMode('idle')}>
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
              {busy ? 'Saving…' : 'Mark lost'}
            </Button>
            <Button variant="outline" size="sm" className={secondaryButton} onClick={() => setMode('idle')}>
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
          {busy ? 'Saving…' : 'Fee paid'}
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
        Check out
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
          {busy ? 'Saving…' : 'Check out'}
        </Button>
      </div>
    </section>
  )
}

/**
 * A player's parents, for following up on a jersey that hasn't come back: each name with a mailto
 * link, plus a ready-to-edit reminder email (jersey-reminder.ts) to all of them when a jersey is
 * out. The manager's own mail app sends it; the app never does.
 */
function ContactParents({ subject, openSizes }: { subject: Subject; openSizes: string[] }) {
  const [contacts, setContacts] = useState<FamilyContact[] | null>(null)
  const [cc, setCc] = useState<string[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch(`/api/jerseys/players/${encodeURIComponent(subject.playerId)}/contacts`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        if (data.success) {
          setContacts(data.contacts)
          setCc(data.cc || [])
        }
        else setError(data.error || 'Could not load parent contacts.')
      })
      .catch(() => !cancelled && setError('Network error loading parent contacts.'))
    return () => {
      cancelled = true
    }
  }, [subject.playerId])

  const reminder =
    contacts && contacts.length > 0 && openSizes.length > 0
      ? mailtoUrl(
          jerseyReminderEmail({
            contacts,
            cc,
            playerName: subject.fullName,
            sizes: openSizes,
            returnEvents: APP_CONFIG.JERSEY_RETURN_EVENTS,
            today: todayIso(),
          })
        )
      : ''

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold" style={titleStyle}>
        Parents
      </h3>
      {!contacts && !error && (
        <p className="text-sm" style={mutedStyle}>
          Loading…
        </p>
      )}
      {error && <SaveBanner message={{ kind: 'error', text: error }} />}
      {contacts && contacts.length === 0 && (
        <p className="text-sm" style={mutedStyle}>
          No parent email on file.
        </p>
      )}
      {contacts && contacts.length > 0 && (
        <ul className="space-y-1 text-sm">
          {contacts.map(c => (
            <li key={c.email} style={textStyle}>
              {c.name || 'Parent'}:{' '}
              <a href={`mailto:${c.email}`} className="underline break-all" style={{ color: 'var(--accent)' }}>
                {c.email}
              </a>
            </li>
          ))}
        </ul>
      )}
      {reminder && (
        <Button asChild variant="outline" size="sm" className={secondaryButton}>
          <a href={reminder}>Email a jersey reminder</a>
        </Button>
      )}
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
        <Button variant="outline" size="sm" className={secondaryButton} onClick={() => setOpen(true)}>
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
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      )}
    </section>
  )
}
