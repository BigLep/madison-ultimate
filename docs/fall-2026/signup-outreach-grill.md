# Signup Outreach: design grill, round 1

Date: 2026-09-07. Answer inline; each question carries a recommended answer marked ➡️. Questions that depend on these answers (template variables, subject line, test flow, admin page details) come in round 2.

Facts from the code, the live sheet, and the tools that shape the questions (aggregate counts only):

- Live Signups sheet today: 107 rows; 38 Seeded Signups, none finished yet; 52 rows not Profile Complete (38 seeded, 14 family-created). Of the 52: 3 have no caretaker email at all; 6 rows (three families) share a caretaker email with another incomplete row; 8 carry a Student Personal Email; 45 have a Caretaker 2 Email. Beyond the 52, 3 Profile Complete rows still lack a volunteering answer, and an unknown number are not yet Final Forms cleared (that needs the export join; the tool's preview would show it).
- "Done" per section exists in exactly one place: `src/lib/signup-checklist.ts` (six functions). The coach sheet Roster carries every input for five of the six sections (Grade comes from Final Forms with a Signups fallback, so it would not reflect an empty signup cell) and none of the volunteering answers. Coach sheet ADR 0001 and portal ADR 0005 both chose not to reimplement portal logic in Apps Script.
- Final Forms Status is read live from the newest export in both places: the portal via `findFinalFormsMatch` (by SPS Student ID), the coach sheet via its Final Forms tab. The family route `GET /api/signup/player/[playerId]/finalforms` also runs first-join side effects, so an admin status endpoint must call the pure match function, not the family route.
- `/admin` and `/api/admin` are gated by Basic Auth with `ADMIN_SECRET`; a script can call an admin JSON route with `curl -u ":$ADMIN_SECRET"`. `listAllSignups` plus the six checklist functions make a per-player status endpoint about forty lines.
- `gog gmail drafts create` (v0.39.1) supports `--to`, `--cc`, `--bcc`, `--reply-to`, `--subject`, `--body-file`, `--body-html-file` (both together give a multipart message), and `--dry-run`. `gog gmail drafts send <draftId>` exists. `GOG_GMAIL_NO_SEND=1` blocks `gmail send` and `drafts send` but not `drafts create` or `drafts update`, and the block is a client-side flag: a shell that unsets it sends for real. No pacing flag anywhere; pacing is a loop with `sleep`.
- Coach sheet `BuildEmailList.gs` takes pasted Full Names, looks up both caretaker emails on the Roster, dedupes per email (not per family), ignores student emails, and copies the list to the clipboard. It never sends. Analyze Signups section 6 lists Seeded Signups not Profile Complete as PlayerID, Full Name, Seeded At (no emails).
- The admin repo is Apps Script (`coach-sheet-apps-script`) plus Python one-offs and two Python tools (`finalforms-export`, `photo-mapper`); it has no Node scripts and no access to the checklist functions. The portal already has `scripts/` with a `.mjs` script and every library the tool needs.
- Gmail's consumer cap is about 500 recipients a day. Today's audience is roughly 52 drafts and about 100 recipient addresses, well inside it.
- Portal production URL: `https://madison-ultimate.vercel.app` (also `madisonultimate.org`); the player link is `/player/$playerId`.

## Q1: Where the tool lives

The "brain" (which of the six rows is done, live Final Forms join, caretaker emails by PlayerID) can only come cheaply from the portal, so some portal endpoint exists in every option. The choice is what the rest looks like:

- A: A gated portal route `GET /api/admin/outreach` returns one JSON entry per player in the audience (PlayerID, preferred and last name, portal URL, the six rows as done or not done, recipient emails). A Node script in the portal's `scripts/` fetches it, renders Steve's template, and calls `gog gmail drafts create` once per player. One repo, one ADR, no coach sheet change.
- B: The same portal route, but the draft-building script lives in `madison-ultimate-admin`. Two repos to keep in step over a JSON shape, and the admin repo gains its first Node or gog script.
- C: The portal writes six per-section columns onto the Signups row on every write (as it does Profile Complete), the Roster passes them through, and Apps Script builds the drafts with `GmailApp.createDraft`. Six new sheet columns, Apps Script HTML templating, and Apps Script's own 100-recipients-a-day consumer send quota if it ever sent; the Final Forms row would come from the coach sheet's join instead.
- D: Apps Script recomputes "done" from Roster columns. Rejected by ADR 0001 and 0005 reasoning; the Grade and volunteering gaps make it wrong today.

➡️ A. The checklist is portal knowledge, the audience is a portal query, and the admin repo has nothing to add except distance. ADR 0007 and the plan live in the portal; the coach sheet is untouched.

## Q2: Audience and its name

Two candidate audiences:

- Not Profile Complete (52 today). Volunteering-only and Final Forms-only gaps get no email.
- Any of the six checklist rows not done, including SPS Final Forms Status and both volunteering rows (52 plus 3 volunteering-only plus however many are not Final Forms cleared).

The email shows all six rows, so the second is self-explaining: a family that gets it always sees at least one "Not done". The glossary needs a name for "every row done" since Profile Complete deliberately excludes Final Forms and volunteering. Proposed term: **Checklist Complete**, every row of the Signup Status checklist done, including SPS Final Forms Status. The audience is then "every signup not Checklist Complete". (Your phrase "fully signed up" collides with the glossary's avoid-list for Profile Complete, so I would not use it as the term.)

Seeded and family-created rows get the same email; the email lists what is missing either way, and the seeded banner on the player page carries the "started from Final Forms" explanation.

Rows with no caretaker email (3 today) cannot be reached; the tool reports them by name and PlayerID and drafts nothing.

➡️ Audience is every signup not Checklist Complete; one copy for seeded and family-created; unreachable rows listed in the tool's report.

## Q3: One draft per player or per family

Three families have two incomplete players today. Per player means those families get two emails minutes apart, each with its own link and its own status rows. Per family means one email with two player blocks, but needs a family key (shared caretaker email), a two-player template, and per-family idempotency.

➡️ Per player, as settled in the seeding grill (R2-Q5). Simpler tool, and each email is about exactly one link. Three families get two emails; the copy can say "if you have more than one player, you will get one of these per player".

## Q4: Recipients

- To: Caretaker 1 Email and Caretaker 2 Email when present (about 45 of 52 have both).
- Student Personal Email (8 rows): Cc, or leave out?
- Reply-To: not needed. Drafts are sent from `madisonultimate@gmail.com`, and replies land in that inbox.
- From: the account itself, no send-as alias.

➡️ Both caretakers on To, no student email (the actions are the caretaker's: Final Forms signing, caretaker info, photo), no Reply-To.

## Q5: Content

- Format: HTML body with a plain-text alternative, both generated from one template (gog accepts both files in one call). HTML gives a real link and a readable list on a phone; the text part covers plain-text clients.
- Status rows: the same six labels and order as the player page, each rendered as `✅ Done` or `❌ Not done`, exactly the words the page uses. When SPS Final Forms Status is not done, add the sub-items that are not done (Caretaker signed, Student signed, Physical cleared) or "not found in Final Forms", so the family knows which side to fix. No other row gets sub-detail; the page shows it.
- One call to action: the `/player/$playerId` link. No `/signup` link in this email (Player Lookup is not needed when we hand them the direct link).
- Deadline: the seeding grill settled "before the first practice, with the date". That date and all other copy is yours, written into the template; the tool only substitutes variables.

➡️ Adopt. Round 2 asks about the exact template variables and subject line.

## Q6: Waves and idempotency

A wave is one run of the tool: fetch the audience, draft for each player, and write a local manifest (gitignored `tmp/`) listing PlayerID, draft id, subject, and recipients. Re-running within a wave must not draft twice: before creating, the tool lists Gmail drafts and skips any player whose draft (matched by subject, which includes the player's name) is still sitting unsent. A later wave runs after the previous wave's drafts are all sent, so the Drafts folder is empty of them and the audience is simply recomputed live; families who finished have dropped out on their own. No "Outreach Sent At" column (settled in the seeding grill, R2-Q6); Gmail's Sent folder is the record of who was emailed when.

➡️ Adopt. Each wave gets its own template file (you write new copy for wave 2), and the manifest is what the send loop reads.

## Q7: Sending

- Command you run, from the portal repo, after reviewing drafts in Gmail: `GOG_GMAIL_NO_SEND= scripts/send-outreach-drafts.sh tmp/outreach-<date>.json`, which loops over the manifest, calls `gog gmail drafts send <id>`, and sleeps a fixed interval between sends. The script never unsets the variable itself; the explicit prefix on your command is the only way the loop can send, which keeps the profile's no-send rule intact for the agent.
- Pace: one every 20 seconds; 52 drafts take about 17 minutes. Gmail's throttling is about bursts and volume, and this is far under both.
- Bounces come back to the inbox as mailer-daemon replies; fix the address on the Signups row by hand and redraft that player in the next wave. The tool pre-checks email syntax and reports bad addresses instead of drafting to them.
- Buttondown: not involved. Per-recipient content is the point, and Buttondown's audience is the newsletter list, not "families with an incomplete signup".
- The script records each sent draft id in the manifest so an interrupted loop can resume without double-sending.

➡️ Adopt.

## Q8: Coach sheet follow-up

Options: leave the coach sheet alone (Analyze Signups section 6 keeps listing seeded rows not Profile Complete, and the tool's own report is the outreach list); or add a Roster filter view or Analyze Signups section for "not Checklist Complete", which would need the volunteering answers and the checklist logic sheet-side (back to Q1 option C or D).

➡️ Leave the coach sheet alone. The tool prints its audience as a table (PlayerID, name, rows not done, recipients, or "no email") before drafting, and that report is the follow-up list.

## Q9: The BCC list on the admin page

Once drafts are per player, the generic BCC list on `/admin/final-forms` is superseded. Options: delete it and its helper; keep it as a fallback; replace it with a read-only preview of the outreach audience on the admin page.

➡️ Delete the BCC textarea and `seeded-outreach.ts`. The admin page gets a small "Signup Outreach" section that shows the audience table from the new route (the same JSON the script uses), so you can eyeball the list in the browser before running the script.

## Round 1 decisions (2026-09-07, via Plannotator)

- Q1 adopted: option A. Gated portal route plus a Node script in the portal's `scripts/`; ADR 0007 and the plan live in the portal; the coach sheet is untouched.
- Q2 adopted: audience is every signup not Checklist Complete (new glossary term); one copy for seeded and family-created rows; rows with no caretaker email are reported, not drafted.
- Q3 adopted: one draft per player. Keeps it simple for now.
- Q4 changed: both caretakers on To, and the Student Personal Email on Cc when present, so the student is in the loop. No Reply-To.
- Q5 adopted, with a doubt noted: Steve wondered whether to drop the status rows and make families click the link, then leaned toward keeping them ("nice to not make people click"). Final Forms sub-items when that row is not done: yes. Confirmed in round 2.
- Q6 adopted: waves, local manifest, skip players with an unsent draft, no tracking column, one template per wave.
- Q7 adopted, with the pace changed to one send every 5 seconds.
- Q8 not annotated; treated as accepted (coach sheet untouched, the tool's report is the follow-up list). Confirmed in round 2.
- Q9 adopted: delete the BCC textarea and `seeded-outreach.ts`; the admin page gets a Signup Outreach audience table.

# Round 2

Facts that shape this round:

- The app's Signups reads always go to `SIGNUPS_SHEET_ID`; `SIGNUPS_SHEET_ID_TEST` is used only by the integration tests. A rehearsal therefore runs against live data, and the safe way to rehearse is to redirect every draft's recipients to your own address.
- The portal has no Markdown renderer in its dependencies, and no email-syntax helper in `src/lib`.
- `gog gmail drafts create` has no way to attach a custom header, so the only handle the tool has on an existing draft is its subject line.
- The admin page already fetches its route on load; a second fetch for the outreach audience is the same pattern.

## R2-Q1: Status rows stay in the email

Your round-1 note wondered whether to drop the six rows and make families click. Keeping them costs nothing in the tool (the route returns them either way) and means a caretaker reading on a phone sees "Photo Upload: Not done" without a tap. The Final Forms sub-items are the one place where the email says something the page says only after a click.

➡️ Keep the six rows plus the Final Forms sub-items. Q8 also stands as accepted: coach sheet untouched.

## R2-Q2: Template format and variables

Options for the file you write:

- A: Plain text with blank lines between paragraphs and `{{variable}}` placeholders. The tool wraps each paragraph in `<p>` for the HTML part, replaces `{{statusRows}}` with a list (HTML) or indented lines (text), and turns `{{portalUrl}}` into a link in HTML and a bare URL in text. One file, no dependency, no markup to learn.
- B: Markdown, rendered with a new dev dependency (`marked`). More expressive (bold, headings), one more package.
- C: Two files per wave, one HTML and one text, both hand-written. Full control, duplicated copy.

Variables offered in every option: `{{preferredName}}`, `{{lastName}}`, `{{caretaker1Name}}`, `{{caretaker2Name}}`, `{{portalUrl}}`, `{{statusRows}}`. The subject line is the first line of the file, prefixed `Subject:`, and may use the same variables. Anything else (the first-practice date, the team name, your sign-off) is literal copy.

Template files live at `docs/fall-2026/outreach/wave-1.txt` (and `wave-2.txt` later): family-facing copy with no PII, so committing them is fine and gives the copy a history.

➡️ A. Your copy is prose plus one link plus one list; plain paragraphs cover it.

## R2-Q3: Greeting

The caretaker name cells hold full names as families typed them (or as Final Forms exported them for seeded rows), so a first-name greeting would need name-splitting that will misfire on some rows. Options: address the email to the player ("Hello, family of {{preferredName}} {{lastName}}" or similar, your wording), or greet the caretakers by full name ("Hello {{caretaker1Name}} and {{caretaker2Name}}", with the tool dropping "and ..." when Caretaker 2 is empty), or no name in the greeting at all.

➡️ Address it to the player, not the caretakers. It reads naturally with one or two caretakers, works for seeded rows where the caretaker names came from Final Forms, and puts the player's name (the thing the email is about) first. The tool still exposes the caretaker name variables if you want them.

## R2-Q4: Subject line and the duplicate check

The subject is the tool's only handle on an existing draft, so it must include the player's name, for example `Madison Ultimate: finish {{preferredName}} {{lastName}}'s signup` (your wording). The duplicate check skips a player when an unsent draft with exactly that subject exists. Consequence: if you deliberately leave a wave-1 draft unsent and later run wave 2 with the same subject line, wave 2 skips that player; a different wave-2 subject avoids that. Twins share a last name but not a preferred name, so subjects stay distinct.

➡️ Adopt: subject carries the player's full name; the check matches on exact subject among unsent drafts; wave 2 uses a new subject or you delete the stale draft first. The tool prints "skipped, draft exists" per player so nothing is silent.

## R2-Q5: Rehearsal

Because the route reads live data, the rehearsal is: run the draft script with `--to <your address>` (every To and Cc replaced by that one address, the real content untouched) and `--limit 3`, read the three drafts in Gmail, delete them, then run for real. The route itself is read-only, so previewing the audience on the admin page or with `curl` is always safe. The send loop needs no rehearsal beyond sending those three test drafts to yourself if you want to see the pacing.

➡️ Adopt. The two flags are the whole test story; no test-sheet mode.

## R2-Q6: Where the script points, and its inputs

The draft script needs the audience JSON and a template. It reads `ADMIN_SECRET` from `.env.local` and takes `--base-url` (default `https://madison-ultimate.vercel.app`, so it runs against the deployed route and the same data the admin page shows) and `--template <file>`. Output: the audience table on stdout (PlayerID, name, rows not done, To, Cc, or "no caretaker email"), then one line per draft created or skipped, and the manifest at `tmp/outreach-<date>.json`. A `--dry-run` flag passes through to `gog --dry-run` and writes no manifest.

➡️ Adopt. Names: `scripts/outreach-drafts.mjs` (build) and `scripts/send-outreach-drafts.sh` (send loop, run only by you with the explicit `GOG_GMAIL_NO_SEND=` prefix).

## R2-Q7: Send loop failure behavior

If `gog gmail drafts send` fails mid-loop (network, a deleted draft, Gmail refusing), the loop stops at that draft, prints the id and the error, and leaves the manifest marking everything sent so far. Re-running the same command resumes after the last success. Alternative: skip the failure and continue, reporting failures at the end.

➡️ Stop on first failure. A Gmail refusal is the one case where continuing is exactly wrong.

## R2-Q8: Route shape

`GET /api/admin/outreach` returns `{ dataAsOf, players: [{ playerId, preferredName, lastName, portalUrl, seeded, checklist: { finalForms, playerInfo, photo, caretakerInfo, coachVolunteering, otherVolunteering }, finalFormsDetail: { found, parentSigned, studentSigned, physicalCleared }, to: [...], cc: [...] }], unreachable: [{ playerId, preferredName, lastName, reason }] }`, audience only (Checklist Complete rows are not in the payload). The Final Forms status comes from the pure match function with no first-join side effects; `dataAsOf` is the export timestamp so the report can say how fresh the Final Forms rows are.

➡️ Adopt. The admin page section renders `players` and `unreachable` as two tables; the script consumes the same JSON.

## R2-Q9: Glossary entries

Proposed CONTEXT.md entries: **Checklist Complete** (every row of the Signup Status checklist done, including SPS Final Forms Status; stricter than Profile Complete, which never counts Final Forms or volunteering), **Signup Outreach** (the per-player email to the caretakers of every signup not Checklist Complete, listing the checklist and linking the player page; drafted by the tool, sent by a coach in waves), and **Outreach Wave** (one run of Signup Outreach; the audience is recomputed live each time, so a family drops out by finishing).

➡️ Adopt all three, or fold Outreach Wave into the Signup Outreach entry if three feels like too many.

## Round 2 decisions (2026-09-07, via Plannotator)

- R2-Q1 adopted: six rows plus Final Forms sub-items stay in the email; coach sheet untouched.
- R2-Q2 adopted: plain-text template with `{{variable}}` placeholders, one file per wave under `docs/fall-2026/outreach/`.
- R2-Q3 adopted: the email is addressed to the player.
- R2-Q4 adopted: subject carries the player's full name; duplicate check on exact subject among unsent drafts.
- R2-Q5 adopted: rehearsal is `--to <your address>` plus `--limit 3`.
- R2-Q6 not settled: Steve asked whether the input could instead be a list of player names or PlayerIDs, with the tool fetching everything else. Reviewed in round 3.
- R2-Q7 adopted: the send loop stops on first failure and resumes from the manifest.
- R2-Q8, R2-Q9 not annotated; treated as accepted, confirmed in round 3.

# Round 3

## R3-Q1: Selecting who gets a draft

Your suggestion: give the tool a list of player names or PlayerIDs and let it fetch the rest. That fits the coach sheet's convention (BuildEmailList takes pasted Full Names; Full Name and PlayerID are both Roster columns) and covers the "follow up with these four families" case that a computed audience does not. It also changes the route slightly: instead of returning only the audience, `GET /api/admin/outreach` returns the checklist status and recipients for every signup row, with a `checklistComplete` flag, and selection moves into the script.

Proposed selection rules for `scripts/outreach-drafts.mjs`:

- No `--players` argument: the audience is every row not Checklist Complete (the wave-1 case).
- `--players <file>`: one entry per line, either a PlayerID or a Full Name (Preferred First Name plus Last Name, exact match after trimming, as BuildEmailList does). A line that matches no row, or matches more than one row, stops the run before any draft is created and names the line. Entries that are already Checklist Complete are skipped with a note, since there is nothing to ask of them.
- Both cases go through the same duplicate check, `--to`, `--limit`, and `--dry-run`.

The admin page table shows every row with its six statuses, sorted with not Checklist Complete first, so you can pick names from it or from the Roster.

➡️ Adopt: computed audience by default, a names-or-IDs file to narrow it, and the route returns all rows.

## R3-Q2: Round-2 items you did not annotate, treated as accepted

- R2-Q8: route JSON shape as written, amended by R3-Q1 to return every row with a `checklistComplete` flag; admin page renders the table plus the unreachable list.
- R2-Q9: three glossary entries: Checklist Complete, Signup Outreach, Outreach Wave.

➡️ Confirm, or mark any you want changed. If nothing else comes up, this closes the frontier and I write ADR 0007, the glossary entries, and the plan.

## Round 3 decisions (2026-09-07, via Plannotator)

- R3-Q1 adopted: computed audience (every row not Checklist Complete) by default; an optional file of PlayerIDs or Full Names narrows it; the route returns every row with a `checklistComplete` flag.
- R3-Q2 confirmed: route shape as amended; three glossary entries (Checklist Complete, Signup Outreach, Outreach Wave).

Frontier empty. Outputs: `docs/adr/0007-signup-outreach-per-player-drafts.md`, glossary entries in `CONTEXT.md`, and `docs/fall-2026/signup-outreach-plan.md`.
