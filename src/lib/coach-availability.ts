// Coach Availability (CONTEXT.md): practices and games in one list, every game regardless of team.
// Column headers mirror madison-ultimate-admin coach-sheet-apps-script/CoachAvailability.gs, which
// creates them; change both together. Pure: the route does the sheet I/O.

import type { PracticeInfoRow, GameInfoRow } from './schedule-info';
import { isPracticeCancelled } from './practice-config';
import { parseMMDDDate } from './date-formatters';

export type CoachEventKind = 'practice' | 'game';

export interface CoachEventHeaders {
  availabilityHeader: string;
  noteHeader: string;
}

export function coachAvailabilityHeaders(event: { kind: CoachEventKind; date: string; team?: string; ordinalForDate?: number }): CoachEventHeaders {
  let base: string;
  if (event.kind === 'practice') {
    base = `${event.date} Practice`;
  } else {
    const team = (event.team || '').trim();
    const ordinal = event.ordinalForDate || 1;
    base = `${event.date}${team ? ` ${team}` : ''} Game${ordinal > 1 ? ` ${ordinal}` : ''}`;
  }
  return { availabilityHeader: base, noteHeader: `${base} Note` };
}

export interface CoachEvent extends CoachEventHeaders {
  kind: CoachEventKind;
  /** Canonical "M/D" */
  date: string;
  /** Blank for practices and all-teams games */
  team: string;
  /** Game Info Label, e.g. "Game 1"; blank for practices */
  label: string;
  fieldName: string;
  fieldLocation: string;
  startTime: string;
  endTime: string;
  /** Games only */
  warmupTime: string;
  opponent: string;
  /** Practice Info Note or Game Info Game Note */
  note: string;
  isCancelled: boolean;
}

/** Every practice and game, in date order, practices before games on a shared date, games in Game Info order. */
export function buildCoachEvents(practices: PracticeInfoRow[], games: Array<GameInfoRow & { ordinalForDate: number }>): CoachEvent[] {
  const practiceEvents: CoachEvent[] = practices.map(p => ({
    kind: 'practice',
    date: p.date,
    team: '',
    label: '',
    fieldName: p.fieldName,
    fieldLocation: p.fieldLocation,
    startTime: p.startTime,
    endTime: p.endTime,
    warmupTime: '',
    opponent: '',
    note: p.note,
    isCancelled: isPracticeCancelled(p.note),
    ...coachAvailabilityHeaders({ kind: 'practice', date: p.date }),
  }));
  const gameEvents: CoachEvent[] = games.map(g => ({
    kind: 'game',
    date: g.date,
    team: g.team,
    label: g.label,
    fieldName: g.fieldName,
    fieldLocation: g.fieldLocation,
    startTime: g.gameStart,
    endTime: g.doneBy,
    warmupTime: g.warmupTime,
    opponent: g.opponent,
    note: g.gameNote,
    isCancelled: false,
    ...coachAvailabilityHeaders({ kind: 'game', date: g.date, team: g.team, ordinalForDate: g.ordinalForDate }),
  }));
  const time = (e: CoachEvent) => parseMMDDDate(e.date).getTime();
  const kindRank = (e: CoachEvent) => (e.kind === 'practice' ? 0 : 1);
  // Array.prototype.sort is stable, so games on the same date keep Game Info order.
  return [...practiceEvents, ...gameEvents].sort((a, b) => time(a) - time(b) || kindRank(a) - kindRank(b));
}

export interface CoachEventAvailability {
  event: CoachEvent;
  availability: string;
  note: string;
  /** 0-based column indexes in Coach Availability */
  availabilityColumn: number;
  noteColumn: number;
}

/**
 * This coach's answers for each event that has a column pair in Coach Availability. Events the
 * sheet has no column for yet (Build Coach Availability not re-run) are left out, as the player
 * Practices and Games tabs do.
 */
export function readCoachAvailability(events: CoachEvent[], headerRow: unknown[], row: unknown[]): CoachEventAvailability[] {
  const index: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    const name = (h ?? '').toString().trim();
    if (name && index[name] === undefined) index[name] = i;
  });
  const cell = (i: number) => (row[i] ?? '').toString().trim();
  const out: CoachEventAvailability[] = [];
  for (const event of events) {
    const availabilityColumn = index[event.availabilityHeader];
    const noteColumn = index[event.noteHeader];
    if (availabilityColumn === undefined || noteColumn === undefined) continue;
    out.push({ event, availability: cell(availabilityColumn), note: cell(noteColumn), availabilityColumn, noteColumn });
  }
  return out;
}
