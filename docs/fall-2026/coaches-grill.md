# Coaches: design grill

Date: 2026-09-23. Answer inline; each question carries a recommended answer marked ➡️. Unannotated recommendations count as accepted.

Facts from the code that shape the questions:

- `/coach` today is Coach Tools: one shared password (`COACH_TOOLS_PASSWORD`) checked by the cookie gate from ADR 0008. The httpOnly cookie holds the password itself, lasts ~90 days, and knows nothing about *which* coach is logged in. There is no logout.
- Players are keyed by PlayerID (a random slug, ADR 0001) everywhere durable: URLs, photo files, availability rows. Availability tabs find a row by a PlayerID column located by header name.
- Player availability columns are `{date}` plus `{date} Note`; games use `{date} Availability` / `{date} Note`, with a `(Game 2)` suffix for a second game that day. Game Info has one row per team-game (blank Team means all teams).
- Player Photos are uploaded to the `PHOTOS_FOLDER_ID` Drive folder and served back through an API route (families have no Drive access), with the Drive file ID stored on the row.
- The coach workbook (`ROSTER_SHEET_ID`) already holds Practice Info, Game Info, and both availability tabs; its Apps Script (`madison-ultimate-admin/coach-sheet-apps-script/Code.gs`) owns Build Practice Availability and Build Game Availability.
- No Markdown renderer is installed yet.

## Q1: Where the Coaches and Coach Availability tabs live

Options: (a) two new tabs in the existing seasonal coach workbook, next to Practice Info and Game Info; (b) a separate standing "Coaches" spreadsheet that outlives seasons.

➡️ (a). Build Coach Availability can read Practice Info and Game Info in the same workbook, the "Coach spreadsheet" link is that workbook, and each new season copies the Coaches tab forward along with everything else.

## Q2: Coach identity key

Should a coach have a CoachID (a short random slug like PlayerID) as a column on Coaches and Coach Availability, or be keyed by Name?

➡️ CoachID, same scheme as PlayerID. Names get corrected ("Steve" to "Steven"), and a rename should not orphan an availability row or a photo. Build Coach Availability mints a CoachID for any Coaches row that lacks one, so nobody types IDs by hand.

## Q3: What the login's "name" field is

You asked for a text box for name plus the shared password. A free-text name has to be matched against the sheet (typos, "Steve" vs "Steven"). Alternatives: (a) free text, normalized and matched against Name, error on no match; (b) a dropdown of coach names from the Coaches tab.

➡️ (b) a dropdown. Nothing to mistype, and the names are already public on `/coaches`. The password still gates everything.

## Q4: How strong "which coach" is

With one shared password, any coach can pick any other coach's name and edit that coach's availability or photo. Is that acceptable (the same trust level families get with last name plus birthdate)?

➡️ Yes, accept it. Coaches are a small trusted group; per-coach passwords are not worth the setup.

## Q5: Remembering the login

Today the password lives in an httpOnly cookie. You asked for localStorage. Proposal: keep the existing gate cookie for the password (so server routes stay protected), and remember the chosen coach (CoachID) in localStorage. Logout clears both, returning to the login screen.

➡️ Adopt as written.

## Q6: URL shape

Players get `/player/{playerId}`. For coaches: (a) `/coach` renders the remembered coach's page (identity from localStorage), tools stay at `/coach/player-directory`; (b) `/coach/{coachId}` mirroring players.

➡️ (a). One bookmarkable URL per coach phone, and no route clash with the tool pages.

## Q7: What goes on Coach Availability

Combined practices and games, one row per coach. Which games: every Game Info row regardless of Team, or only the teams a coach is assigned to (which would need a Team column on Coaches)?

➡️ Every practice and every game row. No team assignment for coaches yet.

## Q8: Availability values

Same three choices players get (👍 Planning to be there, 👎 Can't make it, ❓ Not sure yet) plus a free-text note per event?

➡️ Yes, identical values and note behavior (debounced autosave), so the coach sheet's formatting and formulas work unchanged.

## Q9: Editing contact info and About

On the coach's own page, can they edit Name, Email, Phone, and About, or are those read-only (maintained by Steve in the sheet) with only the photo uploadable?

➡️ Read-only for now, photo uploadable. About is Markdown and easiest to write in the sheet; an edit form can come later.

## Q10: Coach photos storage

Store coach photos in the same `PHOTOS_FOLDER_ID` folder (named by CoachID), or a separate folder with its own env var?

➡️ Same folder, file named by CoachID. No new env var or folder setup per season.

## Q11: Who appears on the public `/coaches` page

Every row on the Coaches tab, in sheet order, showing photo, name, and rendered About (never email or phone)? Or a "Show on Coaches Page" checkbox column?

➡️ Every row, in sheet order. A coach without a photo shows a placeholder. Add the checkbox later only if someone asks to be hidden.

## Q12: Key links

Three links on the coach page: Coach spreadsheet, Practice Plans doc, Communication doc. The coach spreadsheet URL can be derived from `ROSTER_SHEET_ID` with no new env var; the two docs become `COACH_PRACTICE_PLANS_DOC_URL` and `COACH_COMMS_DOC_URL`. A link whose env var is unset is hidden.

➡️ Adopt as written.

## Q13: Naming

Glossary proposal: **Coach** (a row on the Coaches tab), **CoachID**, **Coach Login** (the `/coach/login` screen), **Coach Home** (the `/coach` page: info, photo, links, tools, availability), **Coach Availability**, **Coaches Page** (the public `/coaches`). "Coach Tools" keeps meaning the gated area as a whole.

➡️ Adopt as written.

## Round 1 decisions

- Q1 to Q8, Q11 to Q13: accepted as recommended.
- Q9: contact info and About are **editable** by the coach on Coach Home (not read-only).
- Q10: Coach Photos go in a **separate "Coach Photos" Drive folder**, not the Player Photos folder.
- Glossary terms added to `CONTEXT.md`: Coach, CoachID, Coach Login, Coach Logout, Coach Home, Coach Photo, Coach Availability, Coaches Page.

# Round 2

## Q14: Which fields a coach can edit, and how

Editable: Name, Email, Phone, About. Proposal: mirror the Player tab, a read-only view with an Edit button that opens a form with an explicit Save (not autosave). About is a plain textarea with a "Markdown supported" hint and a live preview under it.

➡️ Adopt as written. Name is editable too, since CoachID means a rename orphans nothing.

## Q15: Coach Photos folder setup

A new env var `COACH_PHOTOS_FOLDER_ID`. Coach Photo upload is disabled (with a message) when it is unset. I can create the "Coach Photos" folder myself with `gog drive` next to the existing Player Photos folder, share it the same way, and add the env var locally; you'd add it in Vercel.

➡️ Adopt as written, including me creating the folder.

## Q16: Coaches tab columns

`CoachID`, `Name`, `Email`, `Phone`, `About`, `Photo Drive File ID`, all found by header name. Anything to add (for example a Role or Title like "Head Coach", shown on the Coaches Page)?

➡️ Exactly these six. Anything like a title can go at the top of About.

## Q17: Coach Availability column naming

Practices and games share one tab, and a date can have a practice and a game, or two games. Proposal:

- `CoachID` and `Name` first (Name is a lookup formula from Coaches, so renames flow through).
- Practice: `{date} Practice` and `{date} Practice Note`.
- Game: `{date} Game` and `{date} Game Note` for the first Game Info row on that date, `{date} Game 2` and `{date} Game 2 Note` for the second, matching how players' `(Game 2)` columns map to Game Info row order.
- Columns in date order, practice before game on the same date.

The Coach Home list shows each event with its details (time, field, and for games the Team and opponent) pulled from Practice Info and Game Info.

➡️ Adopt as written.

## Q18: What Build Coach Availability does

A new item in the coach sheet menu, idempotent and safe to re-run whenever Practice Info, Game Info, or Coaches change:

- Mints a CoachID for any Coaches row that lacks one.
- Adds a Coach Availability row for any CoachID not yet there (never deletes rows).
- Adds any missing event columns in date order (never deletes columns, so answers for a cancelled event are kept).
- Applies the same dropdown validation and formatting the player availability tabs use.

➡️ Adopt as written.

## Q19: Coach Home layout

Tabs, like the Player Portal: (a) **Home** (key links and the Coach Tools list), **Me** (photo, contact, About, edit), **Availability**; or (b) one scrolling page.

➡️ (a) three tabs, with Logout in the header next to the coach's name.

## Q20: Past events in Coach Availability

Same as the player Practices and Games tabs: upcoming events first, past events read-only (collapsed or at the bottom, as players see them).

➡️ Same behavior as players.

## Q21: Public access to Coach Photos

The Coaches Page is public, so Coach Photos need a public route (for example `/api/coaches/{coachId}/photo`), while every coach-editing route stays behind the Coach Tools gate. OK for photos and About to be public?

➡️ Yes. That is the point of the Coaches Page.

## Q22: Seeing other coaches' availability

Should Coach Home show who else is coming to a given practice or game (a count or names), or is that out of scope (visible in the sheet)?

➡️ Out of scope for now; the sheet already shows it.

## Q23: The Notion "More Season Info" coaches section

Once `/coaches` is deployed, replace that Notion section's content with a link to `/coaches`. I can make the edit through the Notion MCP after you confirm the deploy, or you do it by hand.

➡️ I make the edit after deploy, once you say go.

## Q24: Seeding the Coaches tab

To start, someone has to fill in the Coaches tab. I can copy the current coach names, About text (converted to Markdown), and photos from the Notion section into the new tab and Coach Photos folder. Contact info would come from you.

➡️ I seed Name and About from Notion, and upload the Notion photos as Coach Photos; you fill in Email and Phone.

## Round 2 decisions

- Q14, Q15, Q16, Q18, Q19, Q20, Q21, Q23: accepted as recommended.
- Q17: game columns must say **which team** the game is for (see Q25).
- Q21 follow-up: a smarter photo pipeline (a cache of web-friendly resized images, for Player and Coach Photos alike) is wanted but **punted** to separate work (see Q27).
- Q22: seeing other coaches' availability stays out of scope, but Coach Home should **link straight to the Coach Availability tab** so a coach can check it (see Q28).
- Q24: coach emails come from searching the coach Gmail; Steve supplied some phone numbers in a screenshot (not recorded here) and will send the rest.

# Round 3

Facts found since round 2:

- Game Info today has one row per team-game for 9/26, 10/3, and 10/10 (Blue, Gold, Silver, one game each per Saturday). 10/17 onward are single placeholder rows with a blank Team, which will later be split into per-team rows once DiscNW schedules them.
- The Notion coaches section has **no photos**, only names and text. It lists 10 people, Steve first.
- One coach's last name is spelled differently in the coach WhatsApp group than in Notion.
- One listed coach is a high school student (a minor), and not in the coach WhatsApp group.
- The coach sheet Apps Script deploys with `clasp push` from `madison-ultimate-admin/coach-sheet-apps-script/`.

## Q25: Game column names with the team

Proposal: `{date} {Team} Game` and `{date} {Team} Game Note` (for example `9/26 Blue Game`), and `{date} Game` for a blank-Team (all-teams) row. A second game for the same team on the same date gets ` 2` (`9/26 Blue Game 2`), counting Game Info rows for that team on that date in sheet order.

➡️ Adopt as written.

## Q26: A blank-Team game later split into team games

When the 10/17 placeholder becomes Blue, Gold, and Silver rows, `10/17 Game` stops matching any Game Info row, and three new team columns appear empty. What happens to answers a coach already gave on `10/17 Game`?

(a) Build Coach Availability copies each coach's answer and note from the old all-teams column into each new team column that is still empty for that coach, then leaves the old column in place (hidden from the portal because it no longer matches a Game Info row).
(b) Nothing carries over; coaches answer again.

➡️ (a). A coach who said "Can't make it" to 10/17 still can't make it after the split, and nobody should have to answer twice.

## Q27: The photo pipeline follow-up

Should I open a GitHub issue now for "serve web-friendly resized Player and Coach Photos from a cache" so it is not lost, and build Coach Photos in this change the same way Player Photos work today?

➡️ Yes to both.

## Q28: Where the Coach Availability sheet link goes

On the Availability tab of Coach Home, a "See everyone's availability" link that opens the coach workbook directly on the Coach Availability tab (a `#gid=` deep link, resolved from the tab's name at request time).

➡️ Adopt as written.

## Q29: Who is on the Coaches tab at launch

Seed the ten people from the Notion section, in Notion's order (Steve first), with Name and About converted from the Notion text to Markdown?

➡️ Yes, all ten in Notion order, pending Q30.

## Q30: A minor as a Coach

Two separate concerns: (1) the public Coaches Page would show a minor's photo and bio (the Notion page already shows their name and bio, but no photo); (2) as a Coach they could log in to Coach Tools and see the Player Directory, which shows families' contact info. Options:

(a) Include them like everyone else.
(b) Include them on the Coaches tab and Coaches Page, but they do not get the Coach Tools password (nothing technical changes; being a Coach doesn't grant access, knowing the password does).
(c) Leave them off the Coaches tab for now.

➡️ (b). The Coaches Page matches what Notion already shows; access to family contact info stays a separate decision about who gets the password. Their photo is their choice to upload.

## Q31: A coach's last name

The Notion spelling or the WhatsApp spelling?

➡️ The Notion spelling, which matches their business's name; please confirm.

## Q32: Photos at launch

Notion has no coach photos, so every Coach starts without one and each coach uploads their own from Coach Home. The Coaches Page shows a placeholder (initials) until then.

➡️ Adopt as written.

## Q33: Steve's contact details inside his About

Steve's Notion bio ends with his personal email and phone. The Coaches Page never shows the Email and Phone columns, but About is rendered as written. Keep that sentence in his About, or drop it now that contact info has its own columns?

➡️ Drop it from About. The Coaches Page directs people to the coaches' address instead, as the Notion page already does.

## Q34: Order of work

1. Apps Script: Coaches and Coach Availability tab setup plus Build Coach Availability (in `madison-ultimate-admin`, deployed with `clasp push` after you review).
2. Seed the Coaches tab (names, About, emails from Gmail, phones you've sent), then run the build.
3. Portal: Coach Login and Logout, Coach Home (Home, Me, Availability), Coach Photo, Coaches Page, key-link env vars.
4. After deploy and your go: point the Notion section at `/coaches`.

➡️ Adopt as written; each step committed separately.

## Round 3 decisions

- Q25 to Q30, Q34: accepted as recommended. The student coach is on the Coaches tab and Coaches Page; the Coach Tools password is a separate decision.
- Q31: the **Notion** spelling is correct.
- Q32: accepted, with a suggestion to pull photos from LinkedIn (see Q35).
- Q33: **keep** Steve's email and phone in his About, so parents know how to reach him.

# Round 4

## Q35: Photos from LinkedIn

You suggested pulling coach photos from LinkedIn (starting from one coach's profile). Two problems: LinkedIn shows profile photos in full only to logged-in members and prohibits scraping, and a photo someone chose for a professional profile is theirs to decide about for a team page. Options:

(a) Coaches upload their own from Coach Home (the Q32 plan), and the announcement to coaches asks each one to add a photo.
(b) For a coach who says yes, you (or they) send me the image and I upload it as their Coach Photo.
(c) I fetch LinkedIn photos myself.

➡️ (a), with (b) as the fallback for anyone who would rather not do it themselves. Not (c).

## Q36: Ready to build

With Q35 settled, the design tree is empty: I'd start on step 1 (Apps Script), then continue through step 4 as agreed in Q34, checking in before `clasp push`, before any live sheet write beyond the Coaches tab seed, and before the Notion edit.

➡️ Go.

## Round 4 decisions

- Q33 revised: **drop** Steve's personal email and phone from his About; families can reach him through WhatsApp.
- Q35: (a). Coaches upload their own photos; the coach announcement asks each to add one.
- Q36: approved; the design tree is empty. Build proceeds in the Q34 order.
