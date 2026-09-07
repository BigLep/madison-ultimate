// Template rendering for Signup Outreach drafts (ADR 0007). The renderer is plain JS under
// scripts/lib so the draft script can import it without a build step; tests import it directly.
import { describe, it, expect } from 'vitest';
import { parseTemplate, renderDraft, renderStatusRows } from '../../scripts/lib/outreach-template.mjs';
import type { OutreachEntry } from '@/lib/signup-outreach';

const entry: OutreachEntry = {
  playerId: 'p001',
  preferredName: 'TestFirst',
  lastName: 'O&Last',
  fullName: 'TestFirst O&Last',
  caretaker1Name: 'Ct One',
  caretaker2Name: '',
  seeded: true,
  portalUrl: 'https://portal.example.test/player/p001',
  checklist: { finalForms: false, playerInfo: true, photo: false, caretakerInfo: true, coachVolunteering: true, otherVolunteering: true },
  checklistComplete: false,
  finalFormsDetail: { found: true, parentSigned: true, studentSigned: false, physicalCleared: false },
  to: ['ct1@example.com'],
  cc: [],
  warnings: [],
  unreachableReason: null,
};

const TEMPLATE = `Subject: Finish {{preferredName}} {{lastName}}'s signup

Hello, family of {{preferredName}} {{lastName}},

{{statusRows}}

Open {{portalUrl}} to finish.

Thanks, {{caretaker1Name}}.`;

describe('parseTemplate', () => {
  it('takes the subject from the first line and the rest as paragraphs', () => {
    expect(parseTemplate(TEMPLATE)).toEqual({
      subject: "Finish {{preferredName}} {{lastName}}'s signup",
      paragraphs: [
        'Hello, family of {{preferredName}} {{lastName}},',
        '{{statusRows}}',
        'Open {{portalUrl}} to finish.',
        'Thanks, {{caretaker1Name}}.',
      ],
    });
  });

  it('rejects a file without a Subject line', () => {
    expect(() => parseTemplate('Hello\n\nBody')).toThrow('first line must be "Subject: ..."');
  });

  it('rejects an unknown variable before any draft is created', () => {
    expect(() => parseTemplate('Subject: x\n\nHi {{nickname}}')).toThrow('Unknown template variable {{nickname}}');
  });
});

describe('renderStatusRows', () => {
  it('lists the six rows in the page order with the page wording, plus Final Forms sub-items when not done', () => {
    expect(renderStatusRows(entry).text).toBe(
      [
        'SPS Final Forms Status: ❌ Not done',
        '    Student signed: not done',
        '    Physical cleared: not done',
        'Player Info: ✅ Done',
        'Photo Upload: ❌ Not done',
        'Caretaker Info: ✅ Done',
        'Coach Volunteering: ✅ Done',
        'Other Volunteering: ✅ Done',
      ].join('\n')
    );
  });

  it('says not found when the player has no Final Forms record', () => {
    const notFound = { ...entry, finalFormsDetail: { found: false, parentSigned: false, studentSigned: false, physicalCleared: false } };
    expect(renderStatusRows(notFound).text).toContain('SPS Final Forms Status: ❌ Not done\n    Not found in Final Forms yet');
    expect(renderStatusRows(notFound).html).toContain('<li>SPS Final Forms Status: ❌ Not done<ul><li>Not found in Final Forms yet</li></ul></li>');
  });

  it('renders the HTML list with nested sub-items', () => {
    const html = renderStatusRows(entry).html;
    expect(html).toContain('<li>SPS Final Forms Status: ❌ Not done<ul><li>Student signed: not done</li><li>Physical cleared: not done</li></ul></li>');
    expect(html).toContain('<li>Player Info: ✅ Done</li>');
    expect(html.startsWith('<ul')).toBe(true);
  });
});

describe('renderDraft', () => {
  const draft = renderDraft(parseTemplate(TEMPLATE), entry);

  it('substitutes variables in the subject', () => {
    expect(draft.subject).toBe("Finish TestFirst O&Last's signup");
  });

  it('renders the text part with paragraphs, the bare link, and the status lines', () => {
    expect(draft.text).toBe(
      [
        'Hello, family of TestFirst O&Last,',
        '',
        renderStatusRows(entry).text,
        '',
        'Open https://portal.example.test/player/p001 to finish.',
        '',
        'Thanks, Ct One.',
      ].join('\n')
    );
  });

  it('renders the HTML part with escaped text, an anchor, and the list not wrapped in a paragraph', () => {
    expect(draft.html).toContain('<p>Hello, family of TestFirst O&amp;Last,</p>');
    expect(draft.html).toContain('<p>Open <a href="https://portal.example.test/player/p001">https://portal.example.test/player/p001</a> to finish.</p>');
    expect(draft.html).not.toContain('<p><ul');
    expect(draft.html).toContain(renderStatusRows(entry).html);
  });

  it('a rehearsal prefixes the subject so the duplicate check never mistakes it for a real draft', () => {
    const rehearsal = renderDraft(parseTemplate(TEMPLATE), entry, { rehearsal: true });
    expect(rehearsal.subject).toBe("[TEST] Finish TestFirst O&Last's signup");
  });
});

describe('renderDraft: line breaks inside a paragraph', () => {
  it('keeps a single newline as a line break in both parts (a sign-off on two lines)', () => {
    const template = parseTemplate('Subject: s\n\nThanks,\nMadison Coaches');
    const draft = renderDraft(template, entry);
    expect(draft.text).toBe('Thanks,\nMadison Coaches');
    expect(draft.html).toBe('<p>Thanks,<br>Madison Coaches</p>');
  });
});
