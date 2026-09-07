# Signup Outreach: per-player Gmail drafts from a portal status route, sent by a coach in paced waves

Status: accepted (2026-09-07). Amends ADR 0006: the generic BCC list on `/admin/final-forms` is replaced by this tool.

Halfway through fall 2026 signups, about half of the signup rows (38 Seeded Signups and a dozen family-created rows) had at least one Signup Status checklist item not done, and the only outreach was a generic BCC email pointing at `/signup`. ADR 0006 chose that BCC list "for now" and deferred a templated per-family draft generator, possibly in `madison-ultimate-admin`. We decided that **Signup Outreach** lives entirely in the portal: a Basic-Auth-gated route, `GET /api/admin/outreach`, returns every signup row with the same six checklist rows the player page shows (SPS Final Forms Status from the live export join with no first-join side effects, plus Player Info, Photo Upload, Caretaker Info, Coach Volunteering, Other Volunteering from `signup-checklist.ts`), a **Checklist Complete** flag, and the recipient emails; a Node script in the portal's `scripts/` selects the audience (every row not Checklist Complete, or a coach-supplied list of PlayerIDs or Full Names), renders the coach's plain-text template into one Gmail draft per player with `gog gmail drafts create` as `madisonultimate@gmail.com`, and writes a local manifest; the coach reviews the drafts in Gmail and sends them with a second script that runs only under an explicit `GOG_GMAIL_NO_SEND=` prefix, one draft every five seconds, stopping on the first failure and resuming from the manifest. The checklist is defined once, in the portal, and both ADR 0001 (coach sheet) and ADR 0005 (portal) already refused to reimplement portal logic sheet-side, so the only place the tool could compute "done" honestly is the portal; the admin repo has no Node, no gog, and nothing to add but distance.

## Considered options

- **The draft script in `madison-ultimate-admin`, consuming the portal route.** Rejected: two repos kept in step over one JSON shape, and the admin repo's first Node script, for no gain.
- **Portal-written per-section columns on the Signups row, passed through the Roster, with Apps Script building drafts via `GmailApp.createDraft`.** Rejected: six new sheet columns, a second HTML templating stack, and Apps Script's consumer send quota of about 100 recipients a day if it ever sent; the Roster is a formula-only view and gains nothing from carrying checklist state.
- **Apps Script recomputing "done" from Roster columns.** Rejected by the ADR 0001 and 0005 reasoning; the Roster's Grade column falls back to Final Forms and it carries no volunteering answers, so the recompute would be wrong today.
- **Audience of "not Profile Complete" only.** Rejected: a family whose only gap is Final Forms clearance or a volunteering answer still has something to do, and the email shows all six rows, so every recipient sees at least one "Not done".
- **One draft per family.** Rejected for now: three families have two incomplete players today; per-player drafts keep one link per email and need no family key. Revisit if sibling volume grows.
- **An "Outreach Sent At" column.** Rejected, as in the seeding grill: the audience shrinks on its own as families finish, Gmail's Sent folder records who was emailed when, and the duplicate check within a wave works off unsent drafts by subject.
- **Buttondown.** Rejected: per-recipient content is the point, and Buttondown's audience is the newsletter, not "families with an incomplete signup".
- **Sending from the draft script, or a send loop that unsets the no-send flag itself.** Rejected: the profile's rule is that the agent never sends mail; the coach's explicit prefix on the send command is the only path that sends, and the send script refuses to run while the flag is set.

## Consequences

- Every checklist row in an outreach email comes from the same functions the player page uses, so the email and the page can never disagree. The Final Forms row is read from the export at draft time, so a family that cleared Final Forms after the draft was written sees a stale row in the email; the page is always current.
- The route is read-only and safe to call at any time; the admin page shows the same table. A rehearsal is the real script with `--to <coach address>` and `--limit`, against live data.
- The tool's only handle on an existing draft is its subject line, which therefore carries the player's full name. A second wave that reuses a subject skips any player whose earlier draft was left unsent.
- Gmail's consumer cap of about 500 recipients a day is far above a wave of roughly 50 drafts and 100 addresses; the five-second pace is a courtesy, not a limit.
- Bounces arrive in the coach inbox as mailer-daemon replies and are fixed by hand on the Signups row; the next wave picks the family up again.
- The coach sheet is untouched. Analyze Signups section 6 keeps listing Seeded Signups not Profile Complete; the tool's own report is the outreach follow-up list.
- `seeded-outreach.ts` and the BCC textarea are deleted; ADR 0006's "copyable BCC list" is no longer true.

Glossary: `CONTEXT.md` (Checklist Complete, Signup Outreach, Outreach Wave). Decision record: `docs/fall-2026/signup-outreach-grill.md`. Plan: `docs/fall-2026/signup-outreach-plan.md`.
