# Fall 2026 Signup Plan

Status: in progress (updated 2026-08-24). Owner: Steve. This document is the implementation plan and rationale for the Fall 2026 season signup system. It spans this repo (the webapp), madison-ultimate-admin (coach sheet Apps Script), and a GitHub Actions job for Final Forms ingestion.

Progress so far:

- DONE: Final Forms ingestion (section 6, most of Milestone B's automation): live in madison-ultimate-admin/finalforms-export with a nightly GitHub Actions cron; no Playwright needed (plain HTTP). One design change from this plan: Drive uploads authenticate as madisonultimate@gmail.com via OAuth refresh token rather than the service account, because service accounts have no Drive storage quota and cannot create files in My Drive folders. The same constraint and solution applies to Milestone C photo uploads; read finalforms-export/README.md before building that.
- DONE: privacy policy at https://madisonultimate.org/privacy (required to publish the Google OAuth app to production; also needed for /signup anyway). Link it from the signup flow and eventually the site footer.
- DONE (2026-08-26): design grill; all open questions settled (record in `docs/fall-2026/signup-grill.md`, glossary in `CONTEXT.md`).
- NEXT: Milestone A (target Friday Aug 28): create the "2026 Fall Signups" spreadsheet in the fall Drive folder and build the complete one-pass /signup (identity lookup + full profile + photo upload + Buttondown subscribe + volunteer capture + media opt-out), then the announcement. Form spec first: `docs/fall-2026/signup-spec.md`.

## 1. Context and goals

Fall ultimate is an official SPS sport. That changes the signup shape versus spring: registration happens in SPS Final Forms (a multi-step process: parent submits and signs, student signs, Madison athletics approves, plus a sports physical), we have more players and multiple teams, and families historically get confused about which of several steps they still owe. The 2026-08-23 Final Forms export already shows the problem at scale: 66 players registered for fall ultimate, of which 40 are parent-signed, only 13 student-signed, and 15 physical-cleared.

Goals, in priority order:

1. Get signup on families' radars before school starts, with one link that tells each family exactly what they have done and what is left.
2. Collect the additional info we need (the old "Additional Info form" content) with as little friction and confusion as possible.
3. Keep every principle that worked last year: all data mastered in Google Sheets, no accounts or passwords for families, coach tooling stays in the coach sheet.
4. Set up identity once at signup so the same identity carries through tryouts, the player portal, and availability entry all season.

Non-goals for this plan: tryout evaluation tooling, multi-team Game Info redesign in the portal, and the season flip of the availability portal. Those are Phase D and get their own design pass.

## 2. Decisions already made (with rationale)

- **The additional info form moves into the webapp; the Google Form is retired.** Rationale: Google Forms file upload requires a Google sign-in (breaks the no-account principle and blocks seamless photo collection), prefill and edit-in-place are awkward, and two intake channels recreate last year's duplicate-submission mess. The webapp writes to a Google Sheet via the existing service account, so the sheets-as-source-of-truth requirement is fully preserved.
- **Families sign up and check status at madisonultimate.org/signup.** Per-family gated view, not a public all-players report. Last year's /signup-report was dropped over concern about leaking SPS player info; the gated design shows one player's status only to someone who already knows that player's name and birthdate, and it discloses only what we choose (see section 8).
- **Mailing list is subscribe-by-default**, using the Buttondown API and the parent emails collected at signup: the save action subscribes (with plain notice and always-available one-click opt-out in the UI). This deletes an entire signup step that families skipped last year.
- **Final Forms ingestion is automated** via a scheduled GitHub Actions job that logs in with Steve's Final Forms credentials, exports the student CSV, and uploads it to the designated Drive folder. Vercel Hobby has no cron; GitHub Actions scheduled workflows are free and already fit our GitHub-centric setup.
- **Multiple teams this fall.** Signup does not depend on this, but the portal work in Phase D does, and the coach sheet's `hasTeam` config gets re-enabled.

## 3. Identity model (settled 2026-08-26; glossary in CONTEXT.md)

Three identifiers, three jobs. Keeping them separate is the core design move; conflating them is what made name-matching painful before.

**PlayerID** (the row's permanent identity): a short random opaque slug minted when the signup row is created, never changed afterward, and never derived from name or birthdate. Everything durable hangs off it: `/player/$playerId` URLs and bookmarks, the device switcher, coach sheet joins, photo mapping. It is the same capability-URL pattern as the old Portal ID, which it replaces.

**Player Lookup** (how a family finds their row): field matching, not a derived key. Normalized last name and full birthdate must match exactly; normalized preferred name disambiguates only when several rows share both (the real twin pair in the current export), using as many leading letters as needed. There is no Portal Lookup Key formula column in the new sheet; the webapp matches identity columns directly, so the normalization rules live in exactly one place (code). Normalization: trim, lowercase, strip internal whitespace, strip apostrophes, fold accents to plain letters, keep hyphens.

**spsStudentId** (the Final Forms handle): the district-wide student id, written onto the signup row at the first successful Final Forms join and authoritative for every Final Forms lookup after that. Coach-writable as the designed escape hatch when the automatic join misses; once present, the webapp treats it as truth and never overwrites it.

The Final Forms join matches on birthdate + last name, disambiguated by legal first name (preferred names often differ from legal ones, so the join never depends on preferred name). The form collects preferred first name, last name, birthdate, and legal first name only if different.

Identity fields stay editable in the profile, so a typo is fixed in place on the same row: PlayerID is stable, lookups recompute from current values, nothing orphans. A content-free near-match warning at row creation (same last name + birthdate, or same birthdate + similar name) plus a coach-side duplicate report guard against accidental duplicate rows.

## 4. Family experience at /signup (settled 2026-08-26)

Governing principle: **one-pass signup**. A family works through /signup exactly once and it captures everything we want up front; every question is enumerated in `docs/fall-2026/signup-spec.md` before build.

Step 0, identity: family enters preferred first name, last name, birthdate (and legal first name only if different). Player Lookup finds an existing row, or (after the content-free near-match check) creates the row immediately and routes to **`/player/$playerId`**, the one canonical player page for the whole season: bookmarkable, history-friendly, and the page that grows availability and Player Info sections in Phase D. A "not this player?" affordance always returns to /signup; localStorage keeps a per-device list of accessed players (PlayerID + display name only) with a quick switcher and per-player remove.

Step 1, player profile (replaces the Additional Info Google Form): editable any time. Field groups (full spec in `docs/fall-2026/signup-spec.md`):

- Identity fields from step 0, plus grade and elementary school
- Pronouns, gender identification, allergies, competing sports and activities, jersey/t-shirt size, playing experience, hopes for the season, other info
- Student emails: personal and SPS, both optional; student cell phone, optional
- Parent/guardian 1 and 2: name, email, and one emergency-contact phone each
- Media opt-out: publication consent only ("no photos of my player in team communications or shared within the team"; we never post to social media for anyone). The player photo is separate and always wanted
- Mailing list: at save time the form states plainly that saving subscribes the provided parent email(s) and that opting out is available at any point; saving is the consent
- Volunteer interest: multi-select (helping coach at practices, game-day help/field manager, team photographer, team admin/communications, snacks/logistics, "not sure yet, tell me more", other) plus a free-text line. Anyone selecting coaching also gets pointed at the coach interest form/email

**Seeding from Final Forms.** Two field classes with opposite sync rules. *Final Forms Status* (parent signed, student signed, cleared, physical clearance/expiration) is always read live from the newest export and never copied; Final Forms is the only place a family can change it. *Seeded fields* (grade, student email/phone, parent names/emails/phones) are copied into empty signup-row cells on first join (ADR 0004), then ours forever after, never re-synced. A family can edit or clear any copied value; later visits do not refill empty cells. Everything displays unmasked so a parent can spot wrong Final Forms data (decided 2026-08-26; the name+birthdate gate is the accepted protection). Never imported or shown: home address, race, ImPACT, payment fields.

Step 2, status dashboard on `/player/$playerId` (the confusion-killer). Shown immediately after profile save and on every return visit:

- Profile: complete, with an edit link
- Final Forms: found/not found; if found, parent signed / student signed / physical cleared shown distinctly plus physical clearance/expiration, with a last-synced timestamp and inline refresh ("Data last synchronized with Final Forms on [time]. If you have updated Final Forms since then, click here and we'll try again"), fire-and-forget with a single-flight guard (always triggers unless a run is already in progress). If not found: both honest branches, "you may not have started Final Forms" (with links) and "our records may not match; enter your last name and legal first name exactly as they appear in Final Forms", plus contact fallback
- Photo: current photo shown if we have one, drag-and-drop upload if not; shown for everyone regardless of media opt-out (it is coach identification, not publication)
- Mailing list: live subscription status next to each parent email (and optional student personal email), with one-click join and opt-out actions right there; SPS student addresses are never offered subscription (external mail bounces)

**Deadline and lifecycle.** Published deadline: complete signup and Final Forms by end of day Wednesday, September 9, with recommend-finishing-earlier messaging since the school needs processing time. The consequence is stated plainly and is SPS rule: Final Forms not fully complete means the player cannot set foot on the field at tryouts (Sept 10-11). After Sept 9 the form stays open with a banner: "Tryout registration has closed. Late signups are not guaranteed. Go ahead and submit and contact the coaches at madisonultimate@gmail.com." About a week after tryouts (~Sept 18) new-player creation closes fully; the lookup keeps working all season so existing families on a new device can still reach their player page.

## 5. Data model

A new **"2026 Fall Signups" spreadsheet** in the 2026 Fall Ultimate Drive folder (1Brc9zzvSUAxneLNclpN7JtB_eCyzyiLe), with a `Signups` tab, one row per player. Rationale for a separate spreadsheet rather than a tab in the coach sheet: it plays the same role the Form Responses sheet did last year (webapp-writable intake that the coach sheet XLOOKUPs from), it limits the webapp's write access blast radius, and the coach sheet gets rebuilt per season anyway.

Column groups (final list settled during build):

- System: PlayerID, Created At, Updated At (no lookup-key formula column; Player Lookup matches the identity columns in code)
- Identity: Preferred First Name, Legal First Name, Last Name, Date of Birth, Grade, Elementary School
- Profile: Pronouns, Gender Identification, Allergies, Competing Sports and Activities, Jersey Size, Playing Experience, Hopes, Other Info
- Student contact: Personal Email, SPS Email, Cell Phone (all optional)
- Family: Caretaker 1 Name/Email/Phone, Caretaker 2 Name/Email/Phone, Media Opt-Out, Subscribed At (per-email subscription state itself is read live from Buttondown, not stored)
- Volunteer: Coach Volunteering Interest (added round 2, 2026-08-27; split out from Roles so coaching interest is its own question), Coach Ultimate Experience, Coach Other Sports Experience (both added round 3, 2026-08-27; restored from the old Google Form's coaching-experience questions, not yet implemented in the form UI as of this column-list update), Roles (multi-select), Notes
- Feedback: Additional Feedback (added round 2, 2026-08-27; general feedback closing question, restored from the old Google Form)
- Joins: spsStudentId (written back once matched, coach-writable, authoritative once present), Photo Drive File ID

The webapp is the only writer of system/identity/profile columns; coaches may add manual columns to the right, which the webapp ignores (same convention as the roster's Manual columns). The coach sheet's `📋 Roster` pulls Additional-Info-type columns from here by PlayerID/StudentID instead of the old exact-Full-Name INDEX/MATCH, which retires the Full Name Diff chore.

**Roster population (no manual PlayerID entry).** An Apps Script menu function ("Sync players from Signups", part of the Milestone D coach sheet deploy) reads the Signups sheet and appends a roster row (PlayerID, names, StudentID if known) for any player not already present, matching by PlayerID. It only ever appends missing players; it never rewrites existing rows, deliberately avoiding the `updateRosterStudentIdsInternal()` clobbering pattern. The same run reports duplicates-suspected signups and unmatched signups-vs-Final-Forms, covering the coach-side reports promised in the grill (Q1, Q5).

This sheet also becomes the source for the portal's **Player Info screen** in Phase D: what the family entered is what the player sees, closing the loop on "we collected it up front, the portal displays it."

## 6. Final Forms ingestion (GitHub Actions)

Live (see Progress at top): a scheduled workflow in madison-ultimate-admin/finalforms-export. Cadence settled 2026-08-26: nightly baseline, bumped to every 2-3 hours during the signup window (Aug 26 to Sept 9, back to nightly after), plus workflow_dispatch. The dashboard's refresh button triggers workflow_dispatch on demand with a single-flight guard: it always starts a run unless one is already in progress (GitHub Actions concurrency group or an in-progress check), in which case the UI reports a sync is already underway. The job:

1. Logs into seattleschools-wa.finalforms.com with `FINALFORMS_EMAIL` / `FINALFORMS_PASSWORD` from GitHub Actions secrets (plain HTTP, no Playwright needed)
2. Downloads the students export (the same "students basic" CSV Steve exported by hand)
3. Uploads it to Drive folder `1WgD4hY0fIZlQEBt7ekOlHIECA-HgOMIZ` named `students_basic_YYYY_MM_DD.csv`, matching the existing convention, using the service account (needs Editor on that folder)

The webapp and coach sheet both already ingest "newest CSV in a folder," so downstream nothing changes except pointing `SPS_FINAL_FORMS_FOLDER_ID` and the Apps Script `CONFIG.finalForms.folderId` at this folder. The 2026-08-23 export was verified against the ingestion code: the column layout (StudentID in A, names in D/E, signature flags in P/Q, gender U, grade W, DOB X, physical clearance AB, parent contact AM-AO and AS-AU) is identical to Fall 2025, so existing parsers work unmodified. The workflow should still assert the header row matches expectations and fail loudly if SPS changes the export, since every downstream formula depends on those positions.

Risks and fallbacks: MFA or bot detection on Final Forms login could block automation (to be discovered in the first spike); the fallback is the workflow emailing/failing visibly and Steve exporting manually, which is exactly today's process, so the automation is pure upside. Credentials live only in GitHub secrets. The coach sheet's `reportDataDifferences()` diff (added/removed/modified players) becomes much more useful on a nightly cadence for spotting new registrations during the signup window.

**Triggering the workflow from the webapp (configured 2026-08-29).** `FINALFORMS_GITHUB_TOKEN`/`FINALFORMS_GITHUB_REPO`/`FINALFORMS_GITHUB_WORKFLOW_FILE`/`FINALFORMS_GITHUB_REF` (see `src/app/api/signup/finalforms-refresh/route.ts`) are a separate credential from the export job's own GitHub secrets above; they let madison-ultimate's server call the GitHub API to dispatch the workflow on demand. Fine-grained PATs don't work for this: a fine-grained token's repository access is restricted to repos owned by whichever "resource owner" (personal account or org) it's created under, so a token can never see `BigLep/madison-ultimate-admin` unless it's created directly under Steve's own personal account — not an option here since we wanted the credential owned by Madison Ultimate's own identity, not Steve's. The working setup is a **classic PAT**, which has no such restriction (it acts on any repo the owning account can reach, including ones it's just a collaborator on):

- Owned by a dedicated GitHub account for Madison Ultimate automation (madisonultimate@gmail.com), added as a collaborator on `BigLep/madison-ultimate-admin`.
- Scope: `public_repo` only (the repo is public). No `workflow` scope — that scope is for editing `.github/workflows/*.yml` files, not for dispatching/listing/canceling runs.
- Expires 2027-08-01; rotate before then (tracked in `TODO.md`).
- Stored as a Vercel Sensitive environment variable (never revealable again via dashboard or CLI after creation) and in local `.env.local` (gitignored).
- `/api/diagnostics` verifies this credential end-to-end without ever starting a real sync: a read check (`GET` the workflow) plus a write-permission probe that attempts to cancel an already-*completed* run — GitHub checks permission before run state, so a token missing write access gets `403` while one with write access gets `409` ("already completed"), and no run is ever affected either way.

## 7. Mailing list automation

Settled 2026-08-29 (amending 2026-08-26). On first Final Forms join, and again at profile save, auto-subscribe caretaker 1/2 and student personal emails via the Buttondown API with `type: "regular"` (skips double opt-in). Look up each address first: already subscribed is a no-op; `type: unsubscribed` is left opted out and never re-added by auto-subscribe (the form's Join button is the only resubscribe). SPS addresses are never offered subscription. The form shows live per-email status next to each eligible address (`Newsletter: subscribed|not subscribed` plus join or leave). Buttondown is the single newsletter system of record (Google Groups retired in spring 2026); pay for whatever tier covers the subscriber count.

## 8. Privacy posture

- Status is gated per player behind name+birthdate knowledge; there is no all-players page and no roster enumeration endpoint. Lookups are not rate-limited: two abuse-free seasons made this an explicitly accepted risk (decided 2026-08-26), revisited only if abuse appears
- Final Forms data shown back is limited to: found/not-found, the three status booleans, physical clearance/expiration, and the seeded contact fields (grade, student email/phone, parent names/emails/phones). Seeded contact info displays unmasked so parents can verify it (decided 2026-08-26, reversing the earlier masked-email posture; the name+birthdate gate is the accepted protection). Never imported or shown: home address, race, ImPACT, payment fields
- /signup pages are noindex; the signups spreadsheet lives in the coach Drive with the same access as last year's form responses
- The repo's no-PII rule continues to apply to code, fixtures, and commits

## 9. Build order and timeline

Revised 2026-08-26 after the design grill. Key dates: tryouts Thursday Sept 10 and Friday Sept 11 (signup and Final Forms must be fully complete before tryouts; published deadline EOD Wednesday Sept 9, recommend-earlier messaging); regular practices start the week of Sept 14; SPS/DiscNW team registration closes Sept 18; first game Sept 26. Governing principle: one-pass signup; a family works through /signup exactly once and it captures everything up front.

- **Milestone A (target Friday Aug 28): complete /signup, announce-ready.** Signups spreadsheet created and shared with the service account (Editor). /signup with identity lookup + full profile form (every question specified field-by-field before build), volunteer capture, Buttondown auto-subscribe (`type: regular`, save-time consent notice, per-email status with one-click join/opt-out), media opt-out, and player photo upload (via the finalforms-export OAuth refresh-token identity; the service account cannot create Drive files). dub.sh short link created; Notion Newcomer Info updated (signup link, deadline, remove the Google Form reference); announcement email drafted for Steve to send.
- **Milestone B (target ~Sept 2): status dashboard.** Final Forms join + three signature/clearance booleans + physical clearance/expiration + seeded contact display + on-demand refresh button (single-flight workflow_dispatch); not-found guidance messaging; "data as of" timestamp. Must be live for the Sept 2-9 chase window.
- **Milestone C: retired.** Photo upload moved into A (coaches need ID photos at tryouts Sept 10-11).
- **Milestone D (mid-Sept onward): season ops.** Portal login switched to the new field-matching Player Lookup; Player Info screen backed by the Signups sheet; multi-team support (one Game Info row per team-game rather than resurrecting the Fall 2025 Gold/Blue column pairs); coach sheet season deploy (new bound script, `hasTeam: true`, config folder IDs updated, mailing-list columns off the dead Google Groups join); tryout/cut workflow designed separately.

Sequencing rationale: A is the whole family-facing ask in one pass before school starts; B lands at the start of the Sept 2-9 signature-chase window, which is when nagging matters most now that tryouts (not the Sept 18 registration close) are the binding deadline. D is gated on tryouts anyway.

## 10. Configuration and ops checklist

- DONE 2026-08-26: Signups spreadsheet created (`1VmASr_xvc_pFtzsoGwfd6qdCJiY0dJ7ihE8mF2zsCWk`, in the fall Drive folder, `Signups` tab with the 32 spec columns) and shared with stevel@cedar-scene-471205-t3.iam.gserviceaccount.com as Editor. Still to share: Final Forms exports folder (1WgD4hY0fIZlQEBt7ekOlHIECA-HgOMIZ) and photos folder (folder itself not yet created)
- TODO (round 2, 2026-08-27): the live sheet's header row is now behind the spec — Steve needs to manually add header cells for `Coach Volunteering Interest` and `Additional Feedback` before those fields can be implemented; the webapp discovers columns by name dynamically but never creates them.
- TODO (round 3, 2026-08-27): two more header cells needed, `Coach Ultimate Experience` and `Coach Other Sports Experience` (36 columns total across both TODOs above), once the round 3 form changes are implemented.
- Widen the service account OAuth scope from drive.readonly to include write for the photo upload and CSV upload (drive.file where possible)
- Vercel env: SIGNUPS_SHEET_ID=1VmASr_xvc_pFtzsoGwfd6qdCJiY0dJ7ihE8mF2zsCWk (new), SPS_FINAL_FORMS_FOLDER_ID → 1WgD4hY0fIZlQEBt7ekOlHIECA-HgOMIZ, BUTTONDOWN_API_KEY (exists), PHOTOS_FOLDER_ID (new), OAuth refresh-token credentials for photo upload (same identity as finalforms-export)
- GitHub secrets: FINALFORMS_EMAIL, FINALFORMS_PASSWORD, GOOGLE_SERVICE_ACCOUNT_KEY
- Apps Script CONFIG for the fall coach sheet: finalForms.folderId, additional-info source → Signups sheet, mailingList, TEAM_CALENDAR_ID, gameRosterPrep.hasTeam = true, new .clasp.json scriptId
- dub.sh/2026FallMadisonInfo (and possibly dub.sh/2026FallMadisonSignup) created; Notion 🚧 placeholders filled

## 11. Open questions: all resolved

Every open question (the original six plus seventeen more surfaced during the 2026-08-26 design grill) is settled; decisions are folded into the sections above, with the full question-by-question record in `docs/fall-2026/signup-grill.md` and the settled vocabulary in `CONTEXT.md`. Remaining pre-build artifact: the field-by-field form spec and family-facing copy pack in `docs/fall-2026/signup-spec.md`, which Steve approves before build.

## Appendix: Reference context (where things live, how seasons work)

Findings from the 2026-08-23/24 research and build sessions. This is the background a working session needs; the decisions themselves are in the body above.

### Repos and branch model

- `madison-ultimate` (this repo, github.com/BigLep/madison-ultimate): the family-facing Next.js 15 App Router portal, deployed to Vercel (Hobby plan, no cron, `maxDuration: 60` on API routes) on every push to `main`. Vitest suite runs as a Husky pre-commit hook. Conventional commits required. Hard no-PII rule for code, commits, and test fixtures (real player names never enter the repo).
- `madison-ultimate-admin` (github.com/BigLep/madison-ultimate-admin): coach-side tooling. Contains `coach-sheet-apps-script/` (Google Apps Script bound to the season's coach workbook, deployed via clasp; `.clasp.json` scriptId is per-season and `SCRIPT_VERSION` in Code.gs must be bumped every push), `finalforms-export/` (the nightly Final Forms ingestion, live as of 2026-08-25), `photo-mapper/` (Next+Flask photo-to-player mapper, still hardcoded to the Fall 2025 sheet and column offsets), and one-off Python debug scripts (also hardcoded to Fall 2025).
- In both repos the `2025-fall` branch is a strict ancestor of `main`; main = spring 2026 work layered on fall. Nothing exists only on the fall branches except code spring deliberately replaced (portal per-team Gold/Blue Game Info columns; the coach sheet kept its Team support behind `CONFIG.gameRosterPrep.hasTeam`). Build fall 2026 on `main`.
- `CoachAdmin/` (not a git repo): coaching-ops workspace. Todos live in the Notion Coach Ops hub (Tasks db `6094ff968b7d45fb977aa27ee0c138db`), not in files. `coaches.md` has the Fall 2026 volunteer coach roster (8 volunteers; Gabriel Scheer and Andrew Holloway can lead games).
- `madisonultimate.org/` directory: domain plan. Apex domain on Vercel pointing at this repo; `www` 308-redirects to apex; `next.config.js` provides on-domain redirects `/info` (Fall 2026 Notion site), `/subscribe` (Buttondown), `/news` (Buttondown archive). `/whatsapp` is a Route Handler that 302s to `WHATSAPP_COMMUNITY_JOIN_URL` (env only — the invite must not live in `next.config.js`). `/privacy` is a real page in this repo.

### Google identities and auth

- All coach Google assets belong to `madisonultimate@gmail.com` (consumer Gmail, no Workspace, so no Shared Drives). CLI access via `gog` (the claude-ultimate profile is pre-bound to this account).
- Service account `stevel@cedar-scene-471205-t3.iam.gserviceaccount.com`: used by the portal (reads/writes the season workbook; the workbook must be shared with it as Editor each season; this is the classic "portal login broken" cause) and by the Apps Script tooling. Current portal scopes: spreadsheets + drive.readonly. Hard limit learned 2026-08-24: service accounts have zero Drive storage quota and cannot create files in My Drive folders (they can update existing user-owned files). Any feature that creates Drive files must use user OAuth instead.
- OAuth app: GCP project `cedar-scene-471205-t3` ("Madison Ultimate App", shared between madisonultimate@gmail.com and steven@loeppky.com; also hosts the service account). Published to production external mode on 2026-08-24. Google requires app name, support email, homepage URL, and privacy policy URL on the Branding page before external production publish; this undocumented-until-tooltip requirement is why publishing looked broken, and Testing-status apps expire refresh tokens every 7 days (the likely cause of Fall 2025's weekly Gmail OAuth pain). Desktop client "finalforms-export" (id 461551540864-2ekd...); `finalforms-export/authorize_drive.py` mints/rotates refresh tokens and `--gh-secrets` pushes them to GitHub. The same OAuth identity is the intended solution for photo uploads (Milestone C).

### Season data model (how a season works today)

- One coach workbook per season holds everything: Spring 2026 `1kV3Y_GST_Y-X9PZFXu9yFkCzGWvhk9f7G24Y8QNuayU`, Fall 2025 `1ZZA5TxHu8nmtyNORm3xYtN5rzP3p1jtW178UgRcxLA8`. Tabs: `📋 Roster`, `📍Practice Info`, `📍Game Info`, `📍Fields`, `Practice Availability`, `Game Availability`, `🏃 Attendance`, plus import tabs `Final Forms`, `Additional Info`, `Mailing List` and generated per-event roster/prep tabs.
- Roster joins: Final Forms columns XLOOKUP by StudentID; Additional Info columns INDEX/MATCH by a manually maintained `Full Name` column (exact string match; the Full Name Diff and Additional Info Analysis menu tools exist because families type names differently); mailing list status VLOOKUP by email. `Preferred Name` is a manual column that currently never reaches the portal. The plan above replaces the Full Name join with PlayerID/StudentID from the Signups sheet.
- Availability model: columns in the availability tabs are named by date, `M/D` + `M/D Note` for practices, `M/D Availability` + `M/D Activation Status` + `M/D Note` for games, with ` (Game 2)` suffixes for double-headers. The Apps Script "Build Practice/Game Availability" menu items create the columns; the portal writes individual cells. Activation Status (Active/Inactive/TBD) is the coach-set "who is rostered this game" layer, added in spring.
- Portal login today: first initial + last name + birth MM + YY, normalized (lowercase, strip spaces, keep hyphens), matched against a `Portal Lookup Key` formula column in the roster; `Portal ID` is a pseudo-secret URL slug. Birth-year dropdown is hardcoded 2011-2015 in `src/app/player-portal/page.tsx`. The portal parses Final Forms status columns (`finalFormsStatus`) but never renders them. `SHOW_ADDITIONAL_INFO_FORM` flag is off for spring. The old all-players signup report survives at `/signup-report-hidden` with hardcoded Fall 2025 copy; the Fall 2026 Notion page advertises `/signup-report`, which does not exist.
- Portal env vars: `ROSTER_SHEET_ID`, `ADDITIONAL_QUESTIONNAIRE_SHEET_ID`, `SPS_FINAL_FORMS_FOLDER_ID`, `TEAM_MAILING_LIST_FOLDER_ID`, `BUTTONDOWN_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_KEY(_FILE)`. `SEASON_SETUP.md` in this repo is the per-season flip checklist (sheet id, data start row, season labels, Notion deep links, form flag, birth years, team display).

### Fall 2026 specifics

- Fall is an official SPS sport (free). Registration = Final Forms at seattleschools-wa.finalforms.com: parent submits and signs, student signs (the classic stall), school athletics approves, plus a sports physical within 2 years. Spring is DiscNW paid registration instead; that inversion is the big seasonal difference.
- Key dates: practices start week of Sept 8-10, mandatory DiscNW coaches meeting Sept 8, team registration closes Sept 18, first game Sept 26, playoffs Nov 7 and 14. New 5-level division structure this fall. Branding is "Madison Ultimate" (not Mad Dogs). Multiple teams confirmed, which later requires `hasTeam: true` in the coach sheet and a portal Game Info redesign (one row per team-game, not the old Gold/Blue column pairs).
- Live registration data (2026-08-24 export): 68 fall ultimate registrants (53 sixth, 8 seventh, 7 eighth grade); 41 parent-signed, 13 student-signed, 15 physical-cleared. A real twins pair shares last name + full birthdate (the reason the identity key uses two letters of preferred name).
- Final Forms ingestion (done): nightly 6am Pacific GitHub Actions cron in madison-ultimate-admin uploads `students_basic_YYYY_MM_DD.csv` to Drive folder `1WgD4hY0fIZlQEBt7ekOlHIECA-HgOMIZ`. Export layout verified identical to Fall 2025: StudentID A, names D/E, parent/student signed P/Q, gender U, grade W, DOB X, physical clearance AB, parent contact AM-AO and AS-AU; the script fails loudly on layout drift. GitHub auto-disables cron workflows after ~60 days of repo inactivity (re-enable is a season-bootup step).
- Other fall assets: fall Drive folder `1Brc9zzvSUAxneLNclpN7JtB_eCyzyiLe`; 2026 Additional Info Google Form `16Cy2nfzBcvX4vCNoGS3KyjnIvnuJfL24BhZ_Sn53nMA` (being retired by /signup; never announce it); volunteer coach interest form `18AaG3X_hHaJIYsDaV4z8YTlKdko8-I5_BnDGiVTknqQ` with responses sheet `1YZv1pj7oYLPtjD3kE20vy76843gk3j-vgJSYQ1TtNmI`; Fall 2026 Notion site root `3bdc4da46f758073930af31f3af0cc4c` with Newcomer Info page `7f7c4da46f7583ea981281c25ee76b28` (has 🚧 placeholders for short link, deadline, division); Fall 2025 lessons learned live in Google Doc `199ouIX854krDglOi4ahyE7AxVz8LLdf3_JjZYKd5To0` (Lessons Learned and Season Debrief sections).
- Communication stack: Buttondown newsletter (API key already in portal env; sending domain mail.madisonultimate.org; nearing the free-tier subscriber limit), Gmail drafts only (sending disabled in the coach profile; Steve reviews and sends).

### Known quirks and landmines

- Coach sheet Code.gs has two conflicting row-layout constants: spring introduced `ROSTER_FIRST_DATA_ROW = 2` but many functions still hardcode the fall 5-metadata-row layout (data row 6). Pick one layout for fall 2026 and reconcile.
- `showStatistics()` in Code.gs references an undefined `additionalInfoCol` and will throw until fixed.
- The portal's `practice-config.ts` still reads `📍Practice Info` by hardcoded column indices, violating the repo's own never-hardcode-positions rule (it has broken before).
- `updateRosterStudentIdsInternal()` rewrites the StudentID column in Final Forms row order, clobbering manually added roster rows for players not yet in Final Forms.
- The Apps Script CONFIG in main still points at Fall 2025 folder ids for Final Forms and mailing list; set these deliberately during the coach sheet deploy.
- Anything that would have the service account create a Drive file will 403 (storage quota); use the OAuth identity instead.
