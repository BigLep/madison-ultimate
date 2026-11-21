// A ready-to-edit reminder email a Jersey Manager can send a family whose Program Jersey is still
// out (CONTEXT.md: Jersey Loan). Opens in the manager's own mail app via a mailto: link, so the
// manager reviews, edits, signs, and sends it themselves; the app never sends email. Pure.

import { formatJerseySize } from './signup-form-schema';
import { formatFullDate } from './date-formatters';
import { upcomingReturnEvents, type ReturnEvent } from './jerseys';

export interface FamilyContact {
  name: string;
  email: string;
}

/** "Sam", "Sam and Alex", "Sam, Alex and Kim": first names, or "there" when none are known. */
function greetingNames(contacts: FamilyContact[]): string {
  const firsts = contacts.map(c => c.name.trim().split(/\s+/)[0]).filter(Boolean);
  if (firsts.length === 0) return 'there';
  if (firsts.length === 1) return firsts[0];
  return `${firsts.slice(0, -1).join(', ')} and ${firsts[firsts.length - 1]}`;
}

/** "at the team party on Friday, November 20", or "as soon as you can" once every event has passed. */
function whenPhrase(events: ReturnEvent[], today: string): string {
  const upcoming = upcomingReturnEvents(events, today);
  if (upcoming.length === 0) return 'as soon as you can';
  const parts = upcoming.map(e => `${e.where} on ${formatFullDate(e.date)}`);
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}`;
}

export function jerseyReminderEmail(input: {
  contacts: FamilyContact[];
  /** Copied on every reminder (the lead Jersey Manager and the team inbox); parents are never duplicated here. */
  cc?: string[];
  playerName: string;
  sizes: string[];
  returnEvents: readonly ReturnEvent[];
  /** YYYY-MM-DD in the manager's local time. */
  today: string;
}): { to: string[]; cc: string[]; subject: string; body: string } {
  const to = input.contacts.map(c => c.email.trim()).filter(Boolean);
  const seen = new Set(to.map(a => a.toLowerCase()));
  const cc = (input.cc || [])
    .map(a => a.trim())
    .filter(a => a && !seen.has(a.toLowerCase()) && seen.add(a.toLowerCase()));
  const jersey =
    input.sizes.length > 1
      ? `${input.sizes.length} Madison Ultimate program jerseys (${input.sizes.map(s => formatJerseySize(s) || s).join(' and ')})`
      : `a Madison Ultimate program jersey${input.sizes[0] ? ` (${formatJerseySize(input.sizes[0]) || input.sizes[0]})` : ''}`;
  const it = input.sizes.length > 1 ? 'them' : 'it';
  const body = [
    `Hi ${greetingNames(input.contacts)},`,
    '',
    `Our records show ${input.playerName} still has ${jersey}. Could you return ${it} to a jersey manager ${whenPhrase([...input.returnEvents], input.today)}?`,
    '',
    `If ${it}'s already been returned, or lost, just reply and let us know so we can update our records.`,
    '',
    'Thank you!',
  ].join('\n');
  return { to, cc, subject: `Madison Ultimate jersey return: ${input.playerName}`, body };
}

/** Plain addresses only, so nothing in a sheet cell can inject extra mailto: fields. */
const SIMPLE_EMAIL = /^[^\s@,;?&#]+@[^\s@,;?&#]+\.[^\s@,;?&#]+$/;

/**
 * One address for a mailto: URL, or null when it isn't a plain address. The local part and domain
 * are percent-encoded separately and the "@" kept literal, so a "%" in the address survives
 * (RFC 6068 section 2) and nothing in a sheet cell can add mailto: fields.
 */
export function mailtoAddress(address: string): string | null {
  const a = address.trim();
  if (!SIMPLE_EMAIL.test(a)) return null;
  const at = a.lastIndexOf('@');
  return `${encodeURIComponent(a.slice(0, at))}@${encodeURIComponent(a.slice(at + 1))}`;
}

/** A single-address mailto: link, or null for anything that isn't a plain address. */
export function mailtoForAddress(address: string): string | null {
  const encoded = mailtoAddress(address);
  return encoded ? `mailto:${encoded}` : null;
}

/** A mailto: URL for the email; invalid addresses are dropped. */
export function mailtoUrl({ to, cc = [], subject, body }: { to: string[]; cc?: string[]; subject: string; body: string }): string {
  const clean = (list: string[]) => list.map(mailtoAddress).filter((a): a is string => a !== null);
  const ccPart = clean(cc).length > 0 ? `cc=${clean(cc).join(',')}&` : '';
  return `mailto:${clean(to).join(',')}?${ccPart}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** The Cc list for reminders: JERSEY_REMINDER_CC (comma-separated) plus the team inbox, deduplicated. */
export function reminderCcList(envValue: string | undefined, teamEmail: string): string[] {
  const all = [...(envValue || '').split(','), teamEmail].map(a => a.trim()).filter(Boolean);
  return all.filter((a, i) => all.findIndex(b => b.toLowerCase() === a.toLowerCase()) === i);
}
