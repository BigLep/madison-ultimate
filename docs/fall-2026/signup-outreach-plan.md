# Signup Outreach: implementation plan

Status: draft for review (2026-09-07). Decision record: `docs/fall-2026/signup-outreach-grill.md`. ADR: `docs/adr/0007-signup-outreach-per-player-drafts.md`. Glossary: `CONTEXT.md` (Checklist Complete, Signup Outreach, Outreach Wave). Nothing here is built yet.

## 1. What gets built

- `GET /api/admin/outreach`: every signup row with its six checklist rows, a Checklist Complete flag, and recipient emails. Read-only, Basic Auth via the existing `src/proxy.ts` matcher.
- `src/lib/signup-outreach.ts`: the pure logic behind the route and the script's selection rules.
- `scripts/outreach-drafts.mjs`: fetches the route, selects the audience, renders the coach's template, creates one Gmail draft per player with `gog`, writes a manifest.
- `scripts/send-outreach-drafts.mjs`: sends the manifest's drafts one every five seconds; runs only under an explicit `GOG_GMAIL_NO_SEND=` prefix.
- `scripts/lib/outreach-template.mjs`: template parsing and HTML/text rendering, shared with tests.
- `docs/fall-2026/outreach/wave-1.txt`: the wave-1 copy, written by Steve.
- Admin page: a Signup Outreach section on `/admin/final-forms` replacing the BCC textarea.
- Removal of `src/lib/seeded-outreach.ts`, its test, and `outreachEmails` from the Final Forms admin route and page.

## 2. Status logic (`src/lib/signup-outreach.ts`)

Pure functions over `SignupRecord` plus a Final Forms status, so the route stays thin and the tests need no network.

- `buildOutreachEntry(record, finalFormsStatus, baseUrl)` returns:
  - `playerId`, `preferredName`, `lastName`, `fullName` (Preferred First Name plus Last Name, trimmed, the same shape the Roster's Full Name column derives), `seeded` (Seeded At non-empty), `portalUrl` (`${baseUrl}/player/${playerId}`).
  - `checklist`: `{ finalForms, playerInfo, photo, caretakerInfo, coachVolunteering, otherVolunteering }`, each a boolean from the six functions in `signup-checklist.ts`. `finalForms` uses `isFinalFormsComplete`.
  - `checklistComplete`: all six true.
  - `finalFormsDetail`: `{ found, parentSigned, studentSigned, physicalCleared }` (all false when not found).
  - `to`: Caretaker 1 Email and Caretaker 2 Email, trimmed, lowercased, deduplicated, syntactically valid (a simple `local@domain.tld` check, the same bar as the coach sheet's `isValidEmail`). `cc`: Student Personal Email when present and valid, never Student SPS Email.
  - `warnings`: one line per dropped invalid address, naming the column.
- `isReachable(entry)`: `to` is non-empty. Unreachable entries carry `reason` ("no caretaker email" or "caretaker emails invalid").
- `selectAudience(entries, selection)`: with no selection, every reachable entry not Checklist Complete; with a list of lines, each line matched first as an exact PlayerID, then as an exact Full Name after trimming; returns the selected entries plus `skipped` (matched but Checklist Complete) and throws with the offending line on no match or more than one match. The throw happens before any draft is created.
- `sortForDisplay(entries)`: not Checklist Complete first, then by last name, then preferred name.
- Move `isSeededAndIncomplete` from `seeded-outreach.ts` into `signup-checklist.ts` (the banner still needs it); delete `outreachEmails`.

## 3. Route (`src/app/api/admin/outreach/route.ts`)

- `GET` only. `listAllSignups()`, then for each row `findFinalFormsMatch(record)` (pure; it attempts the name-plus-birthdate join for rows without SPS Student ID but persists nothing; never call `applyFirstJoinSideEffects` here), then `buildOutreachEntry` with `PORTAL_PUBLIC_URL` from `src/lib/site-config.ts` (`https://madisonultimate.org`), so a player link is the public address whether the route was called locally or in production (changed 2026-09-07 from the request origin, after the rehearsal produced localhost links).
- Response: `{ success, dataAsOf, players: sorted entries, unreachable: [{ playerId, fullName, reason }], counts: { total, notChecklistComplete, unreachable } }`. `dataAsOf` from `getFinalFormsDataAsOf` on any joined row, or null when there is no export.
- No caching beyond what `final-forms.ts` already does for the export. 107 rows against an in-memory export is well under a second.
- Add `/api/admin/outreach` to the endpoint list in `AGENTS.md` and `CLAUDE.md`.

## 4. Draft script (`scripts/outreach-drafts.mjs`)

Run from the repo root with Node 20 or later (built-in `fetch`). Loads `.env.local` the way `fetch-game-info-headers.mjs` does, for `ADMIN_SECRET` only.

Arguments:

- `--template <file>` (required): see section 6.
- `--base-url <url>` (default `https://madisonultimate.org`): where to fetch the route; the response's `portalUrl` values are used as returned and always carry the public address.
- `--players <file>`: one PlayerID or Full Name per line; blank lines and `#` comments ignored. Narrows the audience per `selectAudience`.
- `--to <email>`: rehearsal. Every draft's To becomes this one address and Cc is dropped; the body is the real content. Subject is prefixed `[TEST] ` so the duplicate check never confuses a rehearsal draft with a real one.
- `--limit <n>`: stop after n drafts.
- `--dry-run`: passes `--dry-run` to `gog`, prints what would be created, writes no manifest.

Flow:

1. Fetch the route with `Authorization: Basic` from `ADMIN_SECRET`; fail loudly on 401 or 503.
2. Select the audience. Print the table: PlayerID, Full Name, seeded or family, the six rows as ✅ or ❌, To, Cc. Then the unreachable list and any `skipped` (already Checklist Complete) names.
3. List unsent drafts once (`gog gmail drafts list --all --json`, then `gog gmail drafts get <id> --json` for the subject when the list omits it) and build a set of existing subjects.
4. For each selected player, in display order: render subject, text body, and HTML body; if the subject already exists among unsent drafts print `skipped, draft exists` and continue; otherwise write the two bodies to files under `tmp/outreach/` and run `gog gmail drafts create --to ... [--cc ...] --subject ... --body-file ... --body-html-file ...`, capturing the draft id from the JSON output (`--json`).
5. Append `{ playerId, fullName, subject, to, cc, draftId, createdAt }` to the manifest `tmp/outreach-<YYYY-MM-DD>.json` (created on first draft; `wave` is the template filename, `baseUrl` recorded). Re-running the same day appends to the same manifest.
6. Print a summary: created, skipped (draft exists), skipped (Checklist Complete), unreachable.

`tmp/` is already gitignored; the manifest and rendered bodies hold names and emails and never leave the machine.

## 5. Send script (`scripts/send-outreach-drafts.mjs`)

- Usage: `GOG_GMAIL_NO_SEND= node scripts/send-outreach-drafts.mjs tmp/outreach-2026-09-08.json [--pace-seconds 5]`.
- Refuses to start when `GOG_GMAIL_NO_SEND` is set to anything non-empty, printing the exact prefix to use. The script never modifies the environment itself; this keeps the profile's rule that the agent cannot send.
- Iterates the manifest's drafts without `sentAt`, runs `gog gmail drafts send <draftId> --json`, on success writes `sentAt` back to the manifest immediately, then sleeps `--pace-seconds` (default 5). On any non-zero exit it prints the draft id, subject, and error and stops; re-running resumes after the last success.
- Prints a final count of sent and remaining.

## 6. Template (`docs/fall-2026/outreach/wave-1.txt`)

Plain text. First line `Subject: ...`, a blank line, then the body as paragraphs separated by blank lines. Variables, in the subject or body: `{{preferredName}}`, `{{lastName}}`, `{{caretaker1Name}}`, `{{caretaker2Name}}`, `{{portalUrl}}`, `{{statusRows}}`. The template file holds no PII and is committed so the copy has a history; wave 2 gets `wave-2.txt` with a new subject.

Rendering (`scripts/lib/outreach-template.mjs`):

- Text part: paragraphs as written; `{{portalUrl}}` inserted bare; `{{statusRows}}` becomes six lines in the page's order, `SPS Final Forms Status: ✅ Done` or `❌ Not done`, and when the Final Forms row is not done, indented sub-lines for each of Caretaker signed, Student signed, Physical cleared that is not done, or `Not found in Final Forms yet` when `found` is false.
- HTML part: each paragraph HTML-escaped and wrapped in `<p>`; `{{portalUrl}}` becomes `<a href>` with the URL as its text; `{{statusRows}}` becomes a `<ul>` with the same six items and a nested `<ul>` for the Final Forms sub-items. Inline styles only, no stylesheet; the page's labels and the words Done and Not done exactly.
- Unknown `{{variables}}` fail the run before any draft is created. A paragraph that is only `{{statusRows}}` renders as the list alone, not wrapped in `<p>`.
- The starter file committed with this plan contains the six variables and placeholder prose marked for Steve to replace; the ask and the first-practice date are his copy.

## 7. Admin page (`src/app/admin/final-forms/page.tsx`)

- Remove the outreach textarea, its Copy button, and the `outreachEmails` field from the Final Forms route's `GET`.
- Add a Signup Outreach card, fetched from `/api/admin/outreach` on load with its own loading and error state: the counts line, then a table with Full Name (linking to `/player/${playerId}`), PlayerID, seeded or family, six ✅/❌ cells, To, Cc; rows not Checklist Complete first. Below it the unreachable list with reasons. Mobile: the table scrolls inside its own container.
- A short note under the card: "Drafts are built with `scripts/outreach-drafts.mjs`; see `docs/fall-2026/signup-outreach-plan.md`."

## 8. Tests (`docs/TEST_DESIGN.md` conventions, fake data only)

- `signup-outreach.test.ts`: `buildOutreachEntry` for a row with every section done and Final Forms cleared (Checklist Complete), a row missing only a volunteering answer, a row missing only Final Forms (with sub-detail), a seeded row; email trimming, lowercasing, dedupe, invalid-address drop with warning, SPS email never in Cc; unreachable reasons; `selectAudience` default, by PlayerID, by Full Name, unknown line throws, ambiguous Full Name throws, Checklist Complete entry skipped; `sortForDisplay` order.
- `outreach-template.test.ts` (imports the `.mjs`): subject parsing, variable substitution in subject and body, unknown variable fails, status rows text and HTML for done, not done, and not found cases, HTML escaping of a name containing `&`, `--to` rehearsal prefixing `[TEST] `.
- `admin-outreach-route.test.ts`: mocks `listAllSignups` and `findFinalFormsMatch`; asserts no write function is called, `portalUrl` uses the public address even on localhost, `dataAsOf` passes through, counts add up.
- Update `admin-final-forms-route.test.ts` for the removed `outreachEmails`; delete `seeded-outreach.test.ts`; add the moved `isSeededAndIncomplete` cases to the checklist tests.

## 9. Rollout

1. Build, run tests and lint, deploy. Confirm `/api/admin/outreach` prompts for Basic Auth and returns the table; confirm the admin page card renders on a phone.
2. Steve writes `docs/fall-2026/outreach/wave-1.txt` (subject with the player's full name; the ask; the first-practice date).
3. Rehearsal: `node scripts/outreach-drafts.mjs --template docs/fall-2026/outreach/wave-1.txt --to <Steve's address> --limit 3`. Read the three drafts in Gmail on a phone, fix the copy, delete the drafts.
4. Real run: the same command without `--to` and `--limit`. Read the summary; spot-check a few drafts in Gmail, including one seeded row and one family with two players.
5. Send: `GOG_GMAIL_NO_SEND= node scripts/send-outreach-drafts.mjs tmp/outreach-<date>.json`. About five minutes for fifty drafts.
6. Over the next days: fix bounced addresses on the Signups row by hand; watch the admin card's not-Checklist-Complete count fall.
7. Wave 2 after about a week: `wave-2.txt` with a new subject, same commands; or a `--players` file for the handful of families to chase individually.

## 10. Deferred

- One draft per family (needs a family key and a two-player template).
- Any tracking column on the Signups row.
- Apps Script or coach sheet involvement; Analyze Signups keeps its current sections.
- Attachments (a photo-upload how-to, for instance); `gog` supports `--attach` if ever wanted.
