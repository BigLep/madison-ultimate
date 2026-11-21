import { describe, it, expect } from 'vitest';
import { jerseyReminderEmail, mailtoUrl, reminderCcList } from '@/lib/jersey-reminder';

const EVENTS = [
  { date: '2026-11-14', where: 'at the game' },
  { date: '2026-11-20', where: 'at the team party' },
];
const CONTACTS = [
  { name: 'TestParentA TestLast', email: 'a@example.com' },
  { name: 'TestParentB TestLast', email: 'b@example.com' },
];

describe('jerseyReminderEmail', () => {
  it('addresses every caretaker, names the player and size, and the next return event', () => {
    const email = jerseyReminderEmail({ contacts: CONTACTS, playerName: 'TestFirst TestLast', sizes: ['YL'], returnEvents: EVENTS, today: '2026-11-15' });
    expect(email.to).toEqual(['a@example.com', 'b@example.com']);
    expect(email.subject).toBe('Madison Ultimate jersey return: TestFirst TestLast');
    expect(email.body).toContain('Hi TestParentA and TestParentB,');
    expect(email.body).toContain('TestFirst TestLast still has a Madison Ultimate program jersey (Youth Large)');
    expect(email.body).toContain('to a jersey manager at the team party on Friday, November 20?');
    expect(email.body).not.toContain('November 14');
  });

  it('asks for it "as soon as you can" once every event has passed, and handles no names', () => {
    const email = jerseyReminderEmail({ contacts: [{ name: '', email: 'a@example.com' }], playerName: 'TestFirst TestLast', sizes: ['AS'], returnEvents: EVENTS, today: '2026-11-21' });
    expect(email.body).toContain('Hi there,');
    expect(email.body).toContain('as soon as you can?');
  });

  it('pluralizes for two jerseys and skips blank emails', () => {
    const email = jerseyReminderEmail({ contacts: [...CONTACTS, { name: 'TestNoEmail', email: ' ' }], playerName: 'P', sizes: ['YL', 'AS'], returnEvents: [], today: '2026-11-21' });
    expect(email.to).toEqual(['a@example.com', 'b@example.com']);
    expect(email.body).toContain('2 Madison Ultimate program jerseys (Youth Large and Adult Small)');
    expect(email.body).toContain('return them');
  });
});

describe('mailtoUrl', () => {
  it('encodes subject and body so they survive spaces, line breaks, and "&"', () => {
    const url = mailtoUrl({ to: ['a@example.com', 'b@example.com'], subject: 'A & B', body: 'line 1\nline 2' });
    expect(url).toBe('mailto:a@example.com,b@example.com?subject=A%20%26%20B&body=line%201%0Aline%202');
  });

  it('drops addresses that could smuggle extra mailto fields', () => {
    expect(mailtoUrl({ to: ['a@example.com?bcc=x@evil.test', 'not-an-email', 'b@example.com'], subject: 's', body: 'b' })).toBe('mailto:b@example.com?subject=s&body=b');
  });
});

describe('Cc on reminders', () => {
  it('copies the lead manager and team inbox, without repeating a parent who is also on the list', () => {
    const email = jerseyReminderEmail({ contacts: CONTACTS, cc: ['manager@example.com', 'A@example.com', 'team@example.com'], playerName: 'P', sizes: ['YL'], returnEvents: [], today: '2026-11-21' });
    expect(email.cc).toEqual(['manager@example.com', 'team@example.com']);
    expect(mailtoUrl(email)).toMatch(/^mailto:a@example\.com,b@example\.com\?cc=manager@example\.com,team@example\.com&subject=/);
  });

  it('builds the Cc list from the env var plus the team inbox, deduplicated', () => {
    expect(reminderCcList(' manager@example.com , ', 'team@example.com')).toEqual(['manager@example.com', 'team@example.com']);
    expect(reminderCcList(undefined, 'team@example.com')).toEqual(['team@example.com']);
    expect(reminderCcList('Team@example.com', 'team@example.com')).toEqual(['Team@example.com']);
  });

  it('omits cc= entirely when there is nobody to copy', () => {
    expect(mailtoUrl({ to: ['a@example.com'], cc: [], subject: 's', body: 'b' })).toBe('mailto:a@example.com?subject=s&body=b');
  });
});
