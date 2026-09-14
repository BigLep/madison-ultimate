# Fall 2026 Player Portal: design grill, round 1

Date: 2026-09-14. Answer inline; each question carries a recommended answer marked ➡️. Agreement can be as short as "yes".

Facts from the code and the live sheets that shape the questions:

- `/player` (no id) does not exist today: `src/app/player/` has only a layout and `[playerId]/page.tsx`. The only login is `/signup`, which needs preferred first name, last name, and birthdate, and creates a row when nothing matches.
- The legacy portal lives at `/player-portal/[portalId]` (1,299 lines, hash-routed tabs Home / Player / Practices / Games, sticky header with avatar and "Team | Gender | Grade", bottom nav, PWA manifest per player). Its login and every API under it (`/api/player/[portalId]`, `/api/player/lookup`, `/api/practice/[portalId]`, `/api/game/[portalId]`) key off `Player Portal Lookup Key` and `Player Portal ID` columns in the coach Roster tab.
- `ROSTER_SHEET_ID` in `.env.local` still points at "2026 Spring Coach Sheets". The "2026 Fall Coach Sheets" workbook exists in Drive. Its Roster tab has 116 rows keyed by `PlayerID` (plus `SPS Student ID`, `Full Name`, `Team`, `Grade`, `Gender Identification`, `Include In Generated Rosters`, `Tryout Group`, and others) and has no Portal ID or Lookup Key column at all. Every Team is `TBD`; every Include flag is `TRUE`.
- The Fall workbook's `Practice Availability` and `Game Availability` tabs still carry the spring headers and dates (`Full Name, Grade, Gender Identification, 2/27, ...`). They have not been rebuilt. Practice Info has this fall's dates; Game Info has 9/26 and 10/3 with everything else `TBD`.
- The portal locates a player's availability row by exact `Full Name` string match on column A of the availability tabs, then writes individual cells by date-named headers. The coach sheet glossary says the same: Full Name is "the human-readable key every Generated Roster and availability sheet uses"; only the Roster is keyed by PlayerID.
- The header switcher already exists on `/player/[playerId]` (`PlayerSwitcher` variant `header`: home link, signup link, current player, menu with switch / remove / "Sign up another player"). `/signup` already renders the two-path chooser with remembered players. Both read the same localStorage list.
- `/player/[playerId]` today shows: deadline banner, seeded-signup banner, the Signup Status card (six checklist rows plus the Final Forms panel), then the full editable profile form in one long card with a sticky Save bar.
- Photo GET already exists (`/api/signup/player/[playerId]/photo`), so a read-only view can show the Player Photo.
- Glossary check: `CONTEXT.md` defines Player Lookup as "normalized last name and full birthdate must match exactly, and normalized preferred name disambiguates only when several rows share both (twins)". Your request ("last name and date of birth, then let them select") changes that definition. It also says "find a match within the roster"; in the glossary, Roster is the coach sheet's derived tab, and the Signups sheet is the system of record that the Roster mirrors one row per row.

## Q1: One login or two

`/signup` and the new `/player` login are nearly the same screen: remembered players on top, an identity form below. The differences are that `/player` needs no preferred first name and never creates a row, while `/signup` creates a row after the near-match check. Options: (a) one shared identity component rendered by both routes, each with its own mode (`/signup` = find or create; `/player` = find only); (b) make `/signup` redirect to `/player` once new signups close on 9/18, so there is one login for the rest of the season; (c) two separate pages.

➡️ (a), and keep `/signup` alive all season as the "start a new player" door (it already shows the closed-signups copy C8 after the deadline while still finding existing rows). `/player` becomes the door families use from here on: links in newsletters, the landing page, and the WhatsApp community point at `/player`. The landing page's primary action flips from "Sign Up" to "Player Portal" once signups close.

## Q2: What the lookup matches against, and the new rule

The lookup should run against the Signups sheet, not the coach Roster tab: it is the system of record, it has PlayerID, and every Roster row is a Signups row anyway. Matching rule: normalized last name plus full birthdate, exactly as today, but with preferred first name dropped from the form. Zero matches: error. One match: go. Two or more (twins, or a duplicate signup): show each candidate's preferred first name and let the family tap one. That replaces the glossary's "preferred name disambiguates" clause with "the family picks", so `CONTEXT.md`'s Player Lookup entry gets rewritten.

➡️ Yes to all of it. One refinement: when there are multiple matches, show preferred first name only (no grade, no photo), since whoever typed a correct last name plus birthdate is the family, and the names are the only thing that tells twins apart.

## Q3: Who gets a portal after tryouts

"Find a match within the roster" could mean any Signups row, or only players who are actually on the team. Today all 116 signups have Include In Generated Rosters TRUE and Team TBD, but cuts and no-shows will change that. What should a player who signed up but is not rostered see at `/player/$id`? Options: (a) the full portal, and the Practices and Games tabs simply show no availability row (they are not in the availability tabs, which are built from Generated Rosters); (b) only the Player tab (profile and signup status), with Practices and Games hidden; (c) a "not on the roster this season, contact the coaches" page.

➡️ (a). It needs no extra flag, the coach's Include decision already controls who has an availability row, and the profile stays editable for the coach's own records. The Practices and Games tabs, when the player has no availability row, show the schedule with a short line: "Availability tracking isn't open for you yet. If you think that's wrong, email the coaches."

## Q4: No-match path

When last name plus birthdate finds nothing, what does the family do next? Options: (a) an error with a link to `/signup` ("Not signed up yet? Start here", which after 9/18 shows the closed copy and the coach email) plus the coach email; (b) an error with only the coach email; (c) fall through to `/signup` automatically with the fields carried over.

➡️ (a). The copy: "We couldn't find a player with that last name and birthdate. Check the birthdate (it must match what you entered at signup). Not signed up yet? Sign up here. Still stuck? Email madisonultimate@gmail.com." Reuse the existing honeypot and minimum-time-to-submit guard and the birthdate picker bounds.

## Q5: How the portal finds a player's availability row

Today it is exact `Full Name` match on column A. With the new identity model, Full Name is Preferred First Name plus Last Name, and a family can edit either on the profile form, which silently breaks the match until the coach rebuilds the availability tab. Options: (a) keep Full Name as the key, computed by the portal from the Signups row, and accept the edit-then-mismatch gap; (b) have Build Practice/Game Availability write a `PlayerID` column A (Full Name moves to B) and the portal matches on PlayerID; (c) match on Full Name but fall back to a PlayerID column when present.

➡️ (b). ADR 0001's whole point is that everything durable hangs off PlayerID, and availability writes are the one place the portal writes into the coach workbook; a name edit should not be able to redirect them. It is a small change in `Availability.gs` in the admin repo, the tabs have not been built yet this season, and the Generated Rosters can keep using Full Name unchanged.

## Q6: What the portal reads from the coach workbook

`ROSTER_SHEET_ID` flips to the Fall workbook. Everything about the player (name, grade, gender, contacts, photo) can come from the Signups row. The one thing only the coach workbook knows is `Team` (and, if we want it, the Include flag). Should the portal read the Fall Roster tab by PlayerID for Team, or leave Team out of the header this fall?

➡️ Read Team by PlayerID from the Roster tab and show it in the header as "Team | Grade" once it is not TBD (hide it while TBD). Everything else comes from the Signups row. The multi-team Game Info redesign (one row per team-game, which the plan flags as its own design pass) stays out of this grill; while every Team is TBD the Games tab behaves exactly like last season.

## Q7: Fate of the legacy portal

Once `/player` works end to end, is `/player-portal/*` deleted (with a redirect from `/player-portal` to `/player`), or kept reachable for a while? Deleting also retires `Player Portal Lookup Key`, `portal-cache.ts` lookup-key logic, `/api/player/lookup`, the legacy `/api/player/[portalId]` extractor, the hardcoded birth-year dropdown, and settles the open TODO about the Drive-CSV mailing-list feature (it dies with the legacy page).

➡️ Delete it in the same milestone, with a permanent redirect from `/player-portal` and `/player-portal/[anything]` to `/player`. Old bookmarks land on the login, and remembered players on that device make it one tap. The practice and game API routes get rebuilt under `/api/player/[playerId]/...` keyed by PlayerID.

## Q8: Page structure and the header

The tabbed page (Home / Player / Practices / Games) comes back at `/player/$playerId` with hash routing (`#home`, `#player`, `#practices`, `#games`) as before, so bookmarks and the PWA still work. The header merges the two headers that exist today: the `PlayerSwitcher` header (home link, switch / remove / another player) and the legacy identity header (avatar, name, "Team | Grade" line). Glossary: shall we call the tabbed page the **Player Portal** and the `/player` screen the **Portal Login**, and retire "player page" and "player dashboard"?

➡️ Yes: one sticky header that shows the avatar, name, and "Team | Grade" line, and is itself the tap target for the switcher menu; bottom nav with the four tabs; hash routing. Adopt Player Portal and Portal Login as the terms.

## Q9: The Player tab, static and edit views

Your sketch: a static view, then an edit view that looks like today's form. Proposed static view, top to bottom: the Signup Status card exactly as today (six checklist rows and the Final Forms panel, since that card is the one thing outreach emails point families at); then a read-only profile grouped by the form's own sections (Player, Photo, Player contact, Caretakers, Media, Coach volunteering, Other volunteering, Communication), each with an "Edit" link; then the coach-contact line. Tapping any Edit opens the full form scrolled to that section, with the same sticky Save bar; Save returns to the static view. Which tab does `/player/$id` open on: Home (as last season) or Player?

➡️ Static view as sketched, with one exception: the Newsletter join/leave buttons and the WhatsApp invite stay live on the static view (they are actions, not profile fields). Open on Home, as last season; outreach links to `/player/$id#player` land on the Player tab directly.

## Q10: Home tab content

Home stays as last season: welcome card with season label, Join the Community (WhatsApp, game snacks), Recent Team Updates from Buttondown RSS, Need Help (Player Portal Guide, coach email, quick tips). Links that need a decision: the season label ("Fall 2026 Season"); `SEASON_INFO_URL` already points at the fall Notion page; `WHATSAPP_LEARN_MORE_URL` and `GAME_SNACK_SIGNUP_URL` point at the fall More Season Info page; `PLAYER_PORTAL_DOCUMENTATION` points at the Player Portal Notion guide (unchanged from spring); the spring `MAILING_LIST_INFO_URL` constant goes away with the legacy Player tab. Anything to add or drop on Home this season?

➡️ Keep the four cards. Season label becomes "Fall 2026 Season". Confirm the Player Portal Guide page is still accurate once the new portal ships (the login step changed); everything else carries over. No new cards.

## Round 1 decisions (2026-09-14)

- Q1 settled: one shared identity component; `/signup` stays the "start a new player" door all season, `/player` is the Portal Login families use from here on.
- Q2 settled: lookup runs against the Signups sheet on normalized last name plus full birthdate; multiple matches show preferred first names only and the family picks. Steve's note: the Signups sheet has no team assignment, so the portal must be resilient to a player being cut or not; Q3 covers that. Glossary rewritten (see `CONTEXT.md`, Player Lookup).
- Q3 settled: every Signups row gets the full portal; a missing availability row shows the schedule plus a short "availability tracking isn't open for you yet" line.
- Q4 settled: no-match error links to `/signup` and the coach email; honeypot, minimum-time guard, and birthdate bounds reused.
- Q5 accepted as (b), but the round 1 text understated the scope: `Availability.gs` only builds date columns and never seeds player rows, and the practice and game roster prep sheets XLOOKUP availability cells by Full Name against column A of the availability tabs. Q12 restates the change with the real scope for re-confirmation.
- Q6: Team is read by PlayerID from the Fall Roster tab. Steve asked whether all reads could come from the Roster tab instead; Q11 answers with the facts.
- Q7 settled: delete `/player-portal/*` in the same milestone with permanent redirects to `/player`; practice and game APIs rebuilt under `/api/player/[playerId]/...`. The per-player PWA manifest carries over with `start_url` and `scope` at `/player/$playerId`.
- Q8 settled: one sticky header (avatar, name, "Team | Grade", tap for the switcher menu), bottom nav, hash routing. Glossary gains Player Portal and Portal Login.
- Q9 settled: static view as sketched with Newsletter and WhatsApp actions live; opens on Home; `#player` lands on the Player tab.
- Q10 settled: four Home cards, "Fall 2026 Season" label. New Player Portal Guide link from Steve: https://madisonultimate.notion.site/Player-Portal-345c4da46f758323926e01c5aec75afc (replaces `PLAYER_PORTAL_DOCUMENTATION` in `app-config.ts`).

# Round 2

Facts that shape this round:

- The Fall Roster tab carries most Signups fields (identity, grade, gender, pronouns, allergies, competing sports, jersey, playing experience, hopes, other info, caretaker names and emails, student emails, media, photo) but not caretaker phones, student cell phone, the coach and other volunteering answers, additional feedback, or the created/updated/seeded timestamps. Every Roster cell is a per-row formula over Signups, so a value the family just saved shows up there only after Sheets recalculates and the portal's 5-minute sheet cache expires.
- `Availability.gs` creates the availability tab with a `Full Name` header in column A and adds date columns; it never adds player rows. Player rows were pasted in by hand last season. `BuildPracticeRoster.gs` and `BuildGameRosterPrepSheet.gs` fill their availability cells with `XLOOKUP(<Full Name>, '<Availability tab>'!A:A, ...)`, so whatever sits in column A is what the prep sheets key on.
- The landing page has a disabled "Current Players Login (coming soon)" button behind `SHOW_CURRENT_PLAYERS_LOGIN = false`, and "Sign Up" is the primary action. `getDeadlineState()` returns `open` until 9/8, `late` until 9/18, then `closed`.
- The practice API still reads Practice Info by hardcoded column indices (`PRACTICE_CONFIG.PRACTICE_INFO_COLUMNS`), which the signup plan already flags as a violation of the never-hardcode-positions rule.

## Q11: Read everything from the Roster tab, or Signups plus Team

Your question on Q6: can all reads come from the Roster tab? It could serve the header and most of the static view, but it lacks the phone numbers, volunteering answers, and feedback the Player tab shows, and it is a formula mirror: the edit form writes to Signups, so a static view read from the Roster would show stale values right after Save until the cache and recalculation catch up. Options: (a) Signups for everything the family authored, Roster tab by PlayerID for Team only; (b) Roster tab for the header and the read-only view, Signups only inside the edit form; (c) Roster tab for everything, and add the missing columns there.

➡️ (a). One read path for family-authored data, the same one the edit form already uses, so Save and the static view can never disagree. The Roster read stays a single small lookup (PlayerID to Team) that fails soft: if the workbook is unshared or the column is missing, the header just omits Team.

## Q12: PlayerID in the availability tabs, real scope

To key availability rows by PlayerID without breaking the coach's prep sheets, the coach-sheet change is: (1) the availability tabs gain a `PlayerID` column, found by header name, not by position; column A stays `Full Name` so every existing `A:A` XLOOKUP in the prep sheets keeps working untouched; (2) Build Practice Availability and Build Game Availability also append a row (PlayerID plus Full Name) for every Roster player with Include In Generated Rosters TRUE that is not already present, never deleting or reordering rows, the same rule Sync Extra Player Info follows; (3) the portal resolves a player's row by the PlayerID column and never by name. Alternative: keep Full Name as the only key (no coach-sheet change) and accept that a preferred-name edit orphans the row until a coach fixes it by hand.

➡️ Do the three-part change. It is contained to `Availability.gs` plus a README and glossary amendment in the admin repo, the prep sheets need no edits, the hand-paste step goes away, and the portal's only write into the coach workbook becomes name-proof. Full Name remains the human-readable key on every printout; it just stops being what the portal matches on.

## Q13: Landing page actions

Once the Portal Login ships, the landing page needs a live "Player Portal" action. Options: (a) Player Portal becomes the primary button now, Sign Up drops to a secondary button and stays all season (it shows the closed copy after 9/18); (b) keep Sign Up primary until `closed`, then swap them automatically from the deadline state; (c) both primary side by side.

➡️ (a). Most families are already signed up, tryouts are done, and the deadline banner on `/signup` already explains the late and closed states. The disabled "coming soon" button and its flag go away.

## Q14: The switcher menu's "another player" entry

The header menu today says "Sign up another player" and links to `/signup`. With the Portal Login in place, should it read "Add another player" and link to `/player` (find only, with its "not signed up yet?" link to `/signup`), or keep linking to `/signup`?

➡️ "Add another player", linking to `/player`. Once signups close, `/signup` is a dead end for most taps; the Portal Login covers both cases through its no-match copy.

## Q15: Edit view mechanics

Each section's Edit link opens the full profile form scrolled to that section, with the existing sticky Save bar. Proposed: Save writes the row and returns to the static view; a Cancel button next to Save returns without writing and discards edits, no confirmation; switching bottom-nav tabs mid-edit keeps the form state (the tabs are one client page), so no unsaved-changes guard is needed; a full reload drops unsaved edits, as today.

➡️ Adopt as proposed. Cancel without confirmation matches the rest of the app's low-ceremony style, and the form already shows a visible "Saved" state so the family knows when a write happened.

## Q16: Fix the hardcoded Practice Info columns while rebuilding

The practice API moves under `/api/player/[playerId]/practice` anyway. Do we switch Practice Info reads to header-name discovery in the same change (Game Info already resolves by header), or leave the hardcoded indices alone to keep the move purely mechanical?

➡️ Fix it in the same change. The route is being rewritten around PlayerID regardless, the rule is written in `AGENTS.md`, and the fall Practice Info tab is the moment a column shift would bite.

## Q17: Decision records and docs

Proposed records: one ADR in the admin repo's coach-sheet context ("availability rows keyed by PlayerID, Full Name kept as the printout key"), because it is a trade-off that will look odd to a coach who sees an opaque ID column and is costly to undo once availability data accumulates; a short `DESIGN.md` section here describing the Player Portal structure (Portal Login, tabbed page, hash routing, data sources per tab); `SEASON_SETUP.md` updated so the per-season checklist points at `/player` instead of `/player-portal` and drops the retired settings (birth-year list, `MAILING_LIST_INFO_URL`, `SHOW_ADDITIONAL_INFO_FORM`); glossary entries already written. No ADR for the portal itself: it is a rebuild of last season's shape, not a surprising choice.

➡️ Adopt as proposed.

## Q18: Delivery order

Proposed order, each step landing on `main` on its own: (1) flip `ROSTER_SHEET_ID` to the Fall workbook and share it with the service account; (2) Portal Login at `/player` plus the shared identity component; (3) Player Portal shell with header, bottom nav, Home tab, and the Player tab's static and edit views; (4) coach-sheet availability change in the admin repo, then the Practices and Games tabs against the new PlayerID column; (5) delete the legacy portal and add the redirects; (6) landing page and docs. Steps 2 and 3 ship before the availability tabs exist, which Q3 already handles.

➡️ Adopt as proposed. Step 1 is a two-minute env change that unblocks everything else, and shipping the login and Player tab early means outreach can point at `/player` while the availability tabs are still being built.

## Round 2 decisions (2026-09-14)

- Q11 settled: Signups for everything family-authored, Roster tab by PlayerID for Team only, failing soft.
- Q12 settled: three-part coach-sheet change (PlayerID column by header, Full Name stays in column A, Build Availability appends missing rows for Include TRUE players). Steve's note: Include In Generated Rosters will be TRUE for every player who made the cut, and later set FALSE for anyone who drops out. Q21 covers the ordering consequence.
- Q13 settled: Player Portal primary on the landing page, Sign Up secondary, the disabled "coming soon" button and its flag removed. Refined by Q20.
- Q14: "Add another player" to `/player` accepted for this season, with Steve's note that at the beginning of next season it should drive to `/signup`. Q20 makes that season-phase aware.
- Q15 settled: Save returns to the static view, Cancel discards without confirmation, tab switches keep form state.
- Q16 settled: Practice Info reads move to header-name discovery in the same change.
- Q17: docs adopted; Steve does not care about the "looks odd to a coach" argument, which was one of the three ADR criteria. Q22 proposes dropping the ADR.
- Q18 settled: six-step delivery order, each step landing on `main`.
- New from Steve (general comment): a fully signed-up player should not see the full Signup Status panel; collapse it to "Signup Status ✅" and let it expand on tap. Q19 pins down the rule.

# Round 3

## Q19: Collapsed Signup Status

Proposed rule: the Signup Status card is collapsed to a single "Signup Status ✅" row when the player is Checklist Complete (all six rows done, including SPS Final Forms Status, computed live as today), and expanded otherwise. Tapping the collapsed row expands it; the Final Forms panel and refresh link live inside, so a family can still check clearance mid-season. If a row later stops being done (a physical clearance expires, the family clears a required field), the card comes back expanded on the next load. No remembered collapse state on the device.

➡️ Adopt. Checklist Complete is the existing term for "fully signed up", and driving the collapse off it means the card never needs its own flag.

## Q20: Season-phase link targets

Three places now depend on where we are in the season: the landing page's primary action (Q13), the switcher's "another player" entry (Q14), and the Portal Login's no-match link. Next season they should point families at `/signup` again. Options: (a) derive from `getDeadlineState()`: `open` and `late` mean signup season (Sign Up primary, "Sign up another player" to `/signup`); `closed` means portal season (Player Portal primary, "Add another player" to `/player`); the no-match link always goes to `/signup`; (b) a separate `SEASON_PHASE` constant in `app-config.ts` flipped by hand each season; (c) hardcode this season's targets and change them next season.

➡️ (a). The deadline dates are already the per-season configuration and already gate row creation, so no second switch can drift from them. One consequence worth knowing: today is `late` until 9/18, so if the Player Portal ships before then the landing page keeps Sign Up primary for those few days.

## Q21: Include flags before the first availability build

Build Availability appends a row for every Include TRUE player and never deletes one. Today all 116 signups are TRUE. If the first build runs before the cut players are flagged FALSE, every signup gets an availability row and the cut players' rows stay forever (harmless to the portal, cluttering for coaches). Options: (a) set Include FALSE for cut players before the first build, and say so in the README; (b) have Build Availability also remove rows whose player is now Include FALSE, unless that row has any availability data; (c) leave it as append-only and let coaches delete rows by hand.

➡️ (a). Cuts are known now (tryouts were 9/9 and 9/11) and the tabs have not been built, so a one-line README note on ordering is enough; a deleting build is the kind of script coaches learn to fear.

## Q22: Drop the ADR

With the "surprising to a coach" argument gone, the availability change is a plain trade-off documented where a coach would look: the admin repo README's "Full Name as the downstream key" section (amended to say availability rows are matched by PlayerID and Full Name stays the printout key) and the coach-sheet glossary. No ADR in either repo; `DESIGN.md` and `SEASON_SETUP.md` updates from Q17 stand.

➡️ Adopt.

## Q23: The deadline banner on the Player Portal

`/player/[playerId]` shows the deadline banner today (deadline copy until 9/8, late copy until 9/18, closed copy after). On the Player Portal it is signup noise for a family that is done. Proposed: show it on the Player tab only, only while the player is not Checklist Complete, and never in the `closed` state (the closed copy is for `/signup`, where a new family might still land). The Portal Login shows no banner.

➡️ Adopt.

## Round 3 decisions (2026-09-14)

- Q19 settled: Signup Status collapses to "Signup Status ✅" when Checklist Complete, expanded otherwise, no device-remembered state.
- Q20 settled: landing page primary action and the switcher's "another player" entry derive from the deadline state (`open`/`late` = signup season, `closed` = portal season); the no-match link always goes to `/signup`.
- Q21 settled: set Include In Generated Rosters FALSE for cut players before the first availability build; README note, no deleting build.
- Q22 settled: no ADR; admin README and coach-sheet glossary amended instead.
- Q23 settled: deadline banner only on the Player tab, only while not Checklist Complete, never in the `closed` state; none on the Portal Login.
- New from Steve: three teams plus a practice squad this fall (🟦 Blue, 🟨 Gold, 🪙 Silver, Practice Squad); nobody is assigned yet, Team is TBD for everyone who was not cut, and assignment happens later this week. Round 4 covers what that changes.

# Round 4

Facts that shape this round:

- The legacy Games tab is single-team: the game API shows every Game Info row to every player and labels each with the player's own Team for display; Game Info has no Team column, and the coach script's `hasTeam` config is `false`. The legacy team display map knows Blue, Gold, Practice Squad, and "Varsity Team" only.
- Build Game Availability creates one `M/D Availability | Activation Status | Note` triple per Game Info row per date, adding "(Game 2)" and "(Game 3)" suffixes when several rows share a date. Three team rows on 9/26 would today produce three column triples as if one team played a triple-header.
- Practice Info has no Team column either; every practice shows to every player.
- The signup plan already records the intended shape for multi-team games: one Game Info row per team-game, not the Fall 2025 Gold/Blue column pairs. First game is 9/26.

## Q24: Team display

The header shows "Team | Grade" once Team is not TBD. Proposed display map, in one config: 🟦 Blue, 🟨 Gold, 🪙 Silver, 🏋️ Practice Squad; TBD and blank hide the Team segment; any other value shows as typed. Does the practice squad get the 🏋️ emoji from last season or none?

➡️ Adopt the map with 🏋️ Practice Squad, carried over from last season.

## Q25: Multi-team Games tab, now or a separate grill

Teams are assigned this week and games start 9/26, so the Games tab cannot stay single-team for this milestone. Proposed rule, settling the design pass the plan deferred: Game Info gains a `Team` column, one row per team-game; a game row shows to a player when its Team equals the player's Team, or when its Team is blank (an all-team event); a player whose Team is TBD or Practice Squad sees only blank-Team rows; Build Game Availability numbers "(Game 2)" per date and per team rather than per date alone, so three teams playing on 9/26 share one `9/26 Availability` triple and only a real double-header for the same team gets a "(Game 2)" set. The portal keeps writing availability by date-named header exactly as today. Alternative: ship the Games tab single-team now and hold a separate grill after teams are assigned.

➡️ Settle it here as proposed. The only new authoring for coaches is a Team cell per Game Info row, and the availability tabs stay date-keyed, which is what makes the portal side small. The coach-script change rides along with the Q12 work in the admin repo.

## Q26: Practices per team

Do all four groups practice together on the Practice Info schedule, so Practice Info stays team-agnostic and the Practices tab shows every row to every player? Or will teams (or the practice squad) have separate practice days, needing the same Team rule as Q25?

➡️ Keep Practice Info team-agnostic this season unless you already know the practice squad practices separately; if a split appears later, the Q25 rule (Team column, blank means everyone) applies to Practice Info unchanged.

## Round 4 decisions (2026-09-14)

- Q24 settled: team display map 🟦 Blue, 🟨 Gold, 🪙 Silver, 🏋️ Practice Squad; TBD and blank hide the Team segment.
- Q25 settled: Team column in Game Info, one row per team-game; a row shows to a player when Team matches or is blank; TBD and Practice Squad players see only blank-Team rows; Build Game Availability numbers "(Game 2)" per date and per team.
- Q26 settled: Practice Info stays team-agnostic this season.

# Shared understanding (grill closed 2026-09-14)

Every branch visited; nothing below is assumed silently. This is the decision record the implementation plan builds on.

**Portal Login (`/player`).** One shared identity component serves `/signup` (find or create) and `/player` (find only). `/player` shows the device's remembered players and a last name plus birthdate form; Player Lookup runs against the Signups sheet; multiple matches show preferred first names to pick from; no match shows an error linking to `/signup` and the coach email. Honeypot, minimum-time guard, and birthdate bounds reused. No deadline banner.

**Player Portal (`/player/$playerId`).** Hash-routed tabs Home, Player, Practices, Games; one sticky header with avatar, name, "Team | Grade" (Team hidden while TBD), tapping it opens the switcher menu whose "another player" entry is season-phase aware; bottom nav; per-player PWA manifest carried over. Opens on Home; `#player` lands on the Player tab. Every Signups row gets the full portal, cut or not.

**Data sources.** Family-authored data is read from and written to the Signups row. The Fall Roster tab is read by PlayerID for Team only, failing soft. Availability tabs are matched by a PlayerID column found by header; Full Name stays column A for the coach prep sheets. Practice Info and Game Info reads use header-name discovery.

**Player tab.** Signup Status card as today, collapsed to "Signup Status ✅" when Checklist Complete; deadline banner only while not Checklist Complete and never after close; read-only profile grouped by the form's sections with per-section Edit links, Newsletter and WhatsApp actions live; Edit opens the full form scrolled to the section, Save returns to the read-only view, Cancel discards without confirmation, tab switches keep form state.

**Home tab.** Four cards as last season, "Fall 2026 Season", new Player Portal Guide link, no mailing-list link.

**Practices and Games tabs.** As last season against the Fall workbook. A player with no availability row sees the schedule plus "availability tracking isn't open for you yet". Games: Team column in Game Info, one row per team-game, blank means everyone, TBD and Practice Squad see only blank-Team rows. Practices: team-agnostic.

**Coach sheet (admin repo).** Availability tabs gain a PlayerID column; Build Practice/Game Availability appends a row per Include TRUE player never present before, never deletes; "(Game 2)" numbered per date and per team; README ordering note (set Include before the first build) and glossary amendment; no ADR.

**Landing page and links.** Deadline state drives the primary action (Sign Up during `open`/`late`, Player Portal when `closed`); the disabled "coming soon" button and its flag go away.

**Retirement.** `/player-portal/*` deleted with permanent redirects to `/player`; legacy lookup-key APIs, `portal-cache` key logic, birth-year dropdown, and the Drive-CSV mailing-list feature retire with it.

**Docs.** `CONTEXT.md` (done: Player Lookup, Portal Login, Player Portal), `DESIGN.md` portal section, `SEASON_SETUP.md` checklist, admin README and coach-sheet glossary.

**Delivery order.** (1) flip `ROSTER_SHEET_ID` and share the workbook; (2) Portal Login; (3) portal shell, Home, Player tab; (4) coach-sheet availability change, then Practices and Games tabs; (5) delete legacy and redirect; (6) landing page and docs.
