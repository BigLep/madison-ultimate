// Signup Outreach template rendering (ADR 0007). Plain JS so scripts/outreach-drafts.mjs can
// import it without a build step; src/__tests__/outreach-template.test.ts covers it.
//
// Template file: first line "Subject: ...", a blank line, then paragraphs separated by blank
// lines. Variables ({{name}}) may appear in the subject or any paragraph. A paragraph that is
// only {{statusRows}} renders as the checklist itself.

export const TEMPLATE_VARIABLES = ['preferredName', 'lastName', 'caretaker1Name', 'caretaker2Name', 'portalUrl', 'statusRows'];

const VARIABLE_PATTERN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** The six checklist rows, in the player page's order, with the page's labels (mirrors
 *  OUTREACH_CHECKLIST_ROWS in src/lib/signup-outreach.ts, which plain JS cannot import). */
export const CHECKLIST_ROWS = [
  ['finalForms', 'SPS Final Forms Status'],
  ['playerInfo', 'Player Info'],
  ['photo', 'Photo Upload'],
  ['caretakerInfo', 'Caretaker Info'],
  ['coachVolunteering', 'Coach Volunteering'],
  ['otherVolunteering', 'Other Volunteering'],
];

const FINAL_FORMS_SUB_ITEMS = [
  ['parentSigned', 'Caretaker signed'],
  ['studentSigned', 'Student signed'],
  ['physicalCleared', 'Physical cleared'],
];

/** @param {string} source */
export function parseTemplate(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const subjectMatch = /^Subject:\s*(.+)$/.exec(lines[0] || '');
  if (!subjectMatch) throw new Error('Template: first line must be "Subject: ..."');
  const subject = subjectMatch[1].trim();
  const paragraphs = lines
    .slice(1)
    .join('\n')
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);
  for (const text of [subject, ...paragraphs]) {
    for (const match of text.matchAll(VARIABLE_PATTERN)) {
      if (!TEMPLATE_VARIABLES.includes(match[1])) throw new Error(`Unknown template variable {{${match[1]}}}`);
    }
  }
  return { subject, paragraphs };
}

/** @param {string} s */
export function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The checklist as text lines and as an HTML list, from an OutreachEntry. */
export function renderStatusRows(entry) {
  const textLines = [];
  const htmlItems = [];
  for (const [key, label] of CHECKLIST_ROWS) {
    const done = entry.checklist[key];
    const status = done ? '✅ Done' : '❌ Not done';
    textLines.push(`${label}: ${status}`);
    let subHtml = '';
    if (key === 'finalForms' && !done) {
      const detail = entry.finalFormsDetail;
      const subLines = detail.found
        ? FINAL_FORMS_SUB_ITEMS.filter(([subKey]) => !detail[subKey]).map(([, subLabel]) => `${subLabel}: not done`)
        : ['Not found in Final Forms yet'];
      for (const line of subLines) textLines.push(`    ${line}`);
      subHtml = `<ul>${subLines.map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
    }
    htmlItems.push(`<li>${escapeHtml(`${label}: ${status}`)}${subHtml}</li>`);
  }
  return {
    text: textLines.join('\n'),
    html: `<ul style="padding-left:1.2em">${htmlItems.join('')}</ul>`,
  };
}

/**
 * Render one draft from an OutreachEntry (the /api/admin/outreach row shape).
 * @param {{subject: string, paragraphs: string[]}} template
 * @param {object} entry
 * @param {{rehearsal?: boolean}} [options]
 */
export function renderDraft(template, entry, options = {}) {
  const status = renderStatusRows(entry);
  const values = {
    preferredName: entry.preferredName,
    lastName: entry.lastName,
    caretaker1Name: entry.caretaker1Name || '',
    caretaker2Name: entry.caretaker2Name || '',
    portalUrl: entry.portalUrl,
  };

  const substituteText = text =>
    text.replace(VARIABLE_PATTERN, (_, name) => (name === 'statusRows' ? status.text : values[name]));

  const substituteHtml = text =>
    text
      .split(VARIABLE_PATTERN)
      .map((part, i) => {
        if (i % 2 === 0) return escapeHtml(part).replace(/\n/g, '<br>');
        if (part === 'portalUrl') return `<a href="${escapeHtml(values.portalUrl)}">${escapeHtml(values.portalUrl)}</a>`;
        if (part === 'statusRows') return status.html;
        return escapeHtml(values[part]);
      })
      .join('');

  const subject = `${options.rehearsal ? '[TEST] ' : ''}${substituteText(template.subject)}`;
  const text = template.paragraphs.map(substituteText).join('\n\n');
  const html = template.paragraphs
    .map(p => (p.replace(/\s/g, '') === '{{statusRows}}' ? status.html : `<p>${substituteHtml(p)}</p>`))
    .join('\n');

  return { subject, text, html };
}
