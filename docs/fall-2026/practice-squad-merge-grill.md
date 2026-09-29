# Merge Practice Squad into Silver: design grill, round 1

Date: 2026-09-28. Answer inline; each question carries a recommended answer marked ➡️.

Goal: drop the Practice Squad team for fall 2026. Every Practice Squad player becomes Silver, and Silver uses per-game Activation Status (as in spring 2026), so coaches can rotate players into games and reward effort.

Facts that shape the questions:

- Live Roster today: Silver has 18 players (15 in 6th grade, 2 in 7th, 1 in 8th). Practice Squad has 12 (9 in 6th, 3 in 7th). A merged Silver would have 30. Silver plays in the 6th grade A division.
- Game Info has Blue, Gold and Silver rows for 9/26, 10/3 and 10/10. From 10/17 on, the rows are blank-Team placeholders. The next Silver game is this Saturday, 10/3.
- Game Availability already has an `M/D Activation Status` column for every date. They were left over from spring, and D22 said to delete them by hand; they are still there. There is one set of columns per date, shared by every team playing that day.
- Activation Status is per player, per game: Active, Inactive, or TBD. It is switched on or off for the whole season by one flag in each repo (`hasActivationStatus` in the Apps Script, `HAS_ACTIVATION_STATUS` in the web app). Both are off now. Nothing in either repo can limit it to one team.
- Practice Squad special cases today:
  - Web app: Practice Squad (and TBD) players see only blank-Team game rows (`isGameRowVisibleToPlayer`). The Games tab has Practice Squad copy ("Practice Squad Game Summary", "No games scheduled for the Practice Squad yet"). The team label and sort order also include it.
  - Apps Script: `CONFIG.teams` sort order, the calendar label, and the parent game roster filter, which hides `Practice Squad` and `Dropped`.
- With the flag on, the portal shows an Active / Inactive / TBD pill on each game, treats an empty cell as TBD, and links the label to `ACTIVATION_STATUS_INFO_URL` (empty now). It also changes the prompt to "Select your availability assuming activated".
- Notion: More Season Info (Fall 2026) is the only public page that describes Practice Squad. It has a four-tier Team Structure list and a "Practice Squad" subsection. Spring 2026 More Season Info has an "Activation Status: Who gets to play during games" section we can adapt.

## Q1: Which teams get Activation Status

Silver only, or every team? The Game Availability columns are shared, so the options are:

- (a) Silver only. Blue and Gold cells stay blank. The portal shows the pill only to Silver players, and the Apps Script coach prep sheets simply show blank for Blue and Gold.
- (b) Every team. Coaches mark every Blue and Gold player Active for every game, even though nobody on those teams is ever held out.

➡️ (a) Silver only. Turn both season flags on. Add one config value in each repo listing the teams that use activation (`['Silver']`). The web app uses it to decide who sees the pill. The Apps Script uses it only where a blank would otherwise mislead, for example the Active/Inactive summary counts on the coach prep sheet.

## Q2: Remove "Practice Squad" completely

Once the 12 players are moved to Silver, should Practice Squad disappear from both codebases? That means removing it from `CONFIG.teams`, the team labels, the sort order, the portal copy, and the "hide Practice Squad players from team games" rule. Or keep it as a dormant value for future seasons?

➡️ Remove it completely. If a future season needs it back, git history has it. Keep the parent roster's `Dropped` filter, since that is a separate concept. Game Info rows keep TBD players seeing only blank-Team games.

## Q3: Moving the 12 players

The Team value lives in Extra Player Info, which coaches author. Who changes the 12 rows from Practice Squad to Silver: you in the sheet, or me with `gog` (reading each row first and confirming after)? And does the 6th grade A division limit matter for the 3 seventh graders? Silver already carries 2 seventh graders and 1 eighth grader.

➡️ I do it with `gog` after you confirm, and report a before/after count. The grade question is a coaching call that the tools do not enforce; flag it only if DiscNW rules actually cap non-6th graders.

## Q4: When activation starts, and what blank means

This Saturday (10/3) is the next Silver game. Should 10/3 be the first activated game, or 10/10? And should an empty Activation Status for a Silver player mean TBD (the portal default today), or Inactive?

➡️ Start with 10/10. That leaves this week for the family announcement, and 10/3 is Saturday with the email going out before then. Blank means TBD, as it does now. Leave 9/26 and 10/3 blank.

## Q5: How families learn who is active

Spring announced the active players by name in the Sunday newsletter, and the portal showed each player's status. Do the same for Silver, or use the portal only (no names in the newsletter)?

➡️ Portal status plus a Sunday newsletter line that says activation is set and to check the portal, with no list of names. There are 30 Silver families, and names in a list make "who got left out" very visible for sixth graders.

## Q6: Parent game roster for a Silver game

Spring's parent roster showed everyone, sorted by activation. Today's fall parent roster hides Practice Squad entirely. For a Silver game, should the parent roster hide Inactive players, or show everyone sorted Active first?

➡️ Hide Inactive players. This keeps the parent roster meaning "who is playing Saturday", which is what fall's Practice Squad filter did. TBD players still show.

## Q7: Notion edits

Proposed edits to More Season Info (Fall 2026):

1. Team Structure: cut to three tiers (Blue, Gold, Silver), and say Silver players are activated game by game.
2. Replace the "Practice Squad" subsection with a "Silver: Activation Status" subsection adapted from spring's text. Key points: more Silver players than one game roster holds; activation reflects effort, attendance, and team values; practices are for everyone; activation is separate from availability; status shows in the Player Portal.
3. Snack line: add "or isn't active that week".
4. Point the portal's `ACTIVATION_STATUS_INFO_URL` at the new subsection's anchor.

Optional: add one line about activation to the Player Portal page, and replace Newcomer Info's stale "we don't yet know our roster or divisions" line with a link to Team Structure.

➡️ Do 1 through 4, plus the Player Portal line. Skip Newcomer Info. I draft the new text here in the next round for your review before touching Notion.

## Q8: Family announcement

The 12 Practice Squad families, and the 18 current Silver families (whose kids now share game spots), need to hear about this. Is that in scope here, as a Newsletter Block in the Comms Doc?

➡️ Yes. One Newsletter Block to all Silver families (old and new) this week, drafted after the Notion text is settled so it can link to it. Blue and Gold families need nothing.

## Round 1 decisions

- Q1: Silver only. Both season flags on, plus one config value per repo listing the teams that use activation (`['Silver']`).
- Q2: Keep Practice Squad as a dormant value rather than removing it, so it is easy to resurrect in a later season.
- Q3: I move the 12 players with `gog` after confirmation and report before/after counts. Grade is not a concern; DiscNW is fine with the current Silver division.
- Q4: Activation starts with 10/3 (this Saturday). Blank means TBD. 9/26 stays blank.
- Q5: Portal only for who is active. Steven may send a reminder email this week himself.
- Q6: Parent game roster hides Inactive players; TBD still shows.
- Q7: More Season Info edits 1 through 4, the Player Portal line, and Newcomer Info too.
- Q8: No separate Newsletter Block from me; Steven folds it into the weekly newsletter he has not sent yet.

# Round 2

Date: 2026-09-28. Answer inline as before.

## Q9: What "dormant" means for Practice Squad

Round 1 kept Practice Squad as a dormant value. The simplest reading is that no Practice Squad code changes at all. It stays in `CONFIG.teams` (so it stays in the Extra Player Info Team dropdown), in the team labels and sort order, in the portal's Practice Squad wording, in the "only blank-Team games" rule, and in the parent roster filter. It just has no players.

➡️ Yes: no Practice Squad code changes. Only the glossary and season docs change, to say it is unused in fall 2026.

## Q10: Ship date, given activation starts 10/3

For Silver families to see 10/3 status in the portal, the web app (flag on, Silver-only pill, info link) and the Apps Script (flag on, Silver-only summary counts, parent roster hides Inactive) have to ship before coaches set 10/3 statuses. When do coaches set activation for a given Saturday? Spring promised Sunday evening.

➡️ Ship both repos by Tuesday 9/29. Say "by Thursday evening before each game" in Notion. That lets coaches use Tuesday's practice, and families still have Friday to plan. If you would rather not commit to a day in writing, say "before each Saturday" instead.

## Q11: Portal behavior for Silver players

With the flag on and the teams list set to Silver, a Silver player sees the "Activation Status" label linked to Notion, the Active / Inactive / TBD pill, and the prompt "Select your availability assuming activated: ... Enter regardless of activation status." This shows on every game they see, including the blank-Team placeholder rows from 10/17 on. Blue, Gold, and TBD players see exactly what they see today.

➡️ Accept as described. No new portal wording.

## Q12: Leftovers from turning the flag on in the Apps Script

With `hasActivationStatus` on, a few spring features come back for every team:

- Build Practice Roster gets a "next game activation" column.
- Coach prep sheets get activation columns and grouping.
- Convert to Actual Attendance counts only Active players as "Was there" when two columns are selected.

For Blue and Gold these cells are blank. The attendance rule would then miss Blue and Gold players who were "Planning" but have a blank status.

➡️ Keep the features. Fix the attendance rule so a blank status counts as Active when the player's Team is not in the activation teams list. The practice roster and prep sheet blanks are harmless.

## Q13: Where the decision is recorded

- Glossaries: add Team and Activation Status entries to this repo's `CONTEXT.md`. In the Apps Script `CONTEXT.md`, update the Team entry (Practice Squad unused in fall 2026) and add Activation Status (per player per game; only for teams in the activation list; fall 2026 is Silver).
- Decisions: add D24 to the Apps Script `docs/plans/2026-09-roster-rebuild-decisions.md`. In the web app, update `SEASON_SETUP.md` and `DESIGN.md` where they describe Practice Squad and the activation flag.
- No ADR: this is a season setting, cheap to reverse.

➡️ As listed.

## Q14: Notion draft text

**More Season Info, Team Structure**: replace the four-tier list with:

> We have three teams this season:
> - 🟦 **Blue** plays in the B division
> - 🟨 **Gold** plays in the C/D division (combined this season)
> - 🪙 **Silver** plays in the 6th grade A division, with players activated game by game (see Silver Activation Status below)

Keep the rest of Team Structure unchanged: the division link, "Blue, Gold, and Silver all play in Saturday DiscNW games", and both placement paragraphs.

**Replace `### Practice Squad` with `### Silver Activation Status: who plays each Saturday`**:

> Silver has more players than fit on one game roster. Rather than splitting players into a game team and a practice squad, every Silver player is on the team, and a subset of Silver players will be "active" each Saturday. Securing a game spot is a function of the player's effort, demonstrated abilities, modeling of Team Values and Expectations (particularly at that week's practices), and practice attendance. This lets us give more players game opportunities over the season and reward effort. It also means some players may be activated for more games than others, and play time at any given game may not be equal. Inclusivity of wherever a player is at and "spirit of the game" are still core to the program.
>
> Additional info:
> - Activation for each Saturday is set in the Player Portal by Thursday evening.
> - Activation status doesn't account for whether a player is available for a given game. Please enter availability for every game regardless; it helps if we need extra numbers.
> - Practices are for all Silver players, active or not.
> - Players who aren't active are welcome (but not expected) to come to games, join warmups, and cheer from the sideline.
> - Blue and Gold players are not affected.

**Game Snacks**: "If you signed up for a week and your player isn't able to come, isn't active that week, or has been moved to a different team, you aren't expected to come ..."

**Newcomer Info**: replace "🚧 We don't yet know our roster or which division(s) we'll land in." with "This season we have Blue (B division), Gold (C/D), and Silver (6th grade A); see Team Structure." Link Team Structure.

**Player Portal page**: add under "Entering Availability":

> Silver players also see an **Activation Status** on each game: Active, Inactive, or TBD (not set yet). See Silver Activation Status on More Season Info. Enter availability regardless of activation status.

After the heading exists, I copy its block link into `ACTIVATION_STATUS_INFO_URL`.

➡️ Approve with any edits you mark inline. I apply them in Notion with the `notion` MCP.

## Q15: Order of work

1. Move the 12 players to Silver with `gog` (before/after counts).
2. Web app change on `main`.
3. Apps Script change, then `clasp push`.
4. Notion edits, then set the info URL.
5. Glossaries and decision docs.

Commits go straight to `main` in each repo, in conventional format. Is that right, and should I also run the Apps Script `clasp push` myself?

➡️ Yes to the order and to direct-to-`main` commits. I run `clasp push`; you rebuild any open prep sheets.

## Round 2 decisions

- Q9: No Practice Squad code changes. Only the glossary and season docs say it is unused in fall 2026.
- Q10: Ship both repos by Tuesday 9/29. The Notion text says activation is set "before each Saturday", not a specific day, so the first bullet of the Silver Activation Status draft becomes "Activation for each Saturday is set in the Player Portal before each Saturday."
- Q11: Portal behavior as described; no new wording.
- Q12: Keep the Apps Script activation features. Convert to Actual Attendance treats a blank status as Active for players whose Team is not in the activation teams list.
- Q13: Not annotated; taken as accepted (glossaries in both repos, D24, SEASON_SETUP.md and DESIGN.md, no ADR).
- Q14: Notion drafts approved, with the Q10 wording change.
- Q15: Order approved. Commits go straight to `main` in each repo, and I run `clasp push`.
