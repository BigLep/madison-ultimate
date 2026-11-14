# Jersey check-out and check-in: design grill, round 1

Date: 2026-11-13. Answer inline; each question carries a recommended answer marked ➡️. Saying "yes" accepts the recommendation.

Facts from the data that shape the questions:

- The 2026 Fall Coach Sheets workbook already has a **Jersey Distribution** tab: one row per player keyed by **player name** (not PlayerID), all typed values (no formulas). Columns: Program Jersey Size, Checked Out Program Jersey? (checkbox, currently FALSE for all 72 rows), Family Owned Jersey Size, Family Jersey Given?, Family Owned Sweatshirt, Family Sweatshirt Given?, Notes.
- Every row has a Program Jersey Size, including the ~24 players whose family also ordered their own jersey. So today "has a family jersey" does not mean "doesn't get a program jersey".
- A **Jersey Sizes** tab is a pivot of the Signups `Jersey Size` answer (codes like `YL`, `AS`) by PlayerID: 71 players across YM, YL, AXS, AS, AM.
- Signups already stores each player's requested size (`Jersey Size`), and the portal formats codes as "Adult Small" etc.
- `/coach` (COACH_TOOLS_PASSWORD) and `/admin` (ADMIN_SECRET) share one cookie-based password gate (ADR 0008); a third gated area would reuse it.

## Q1: Vocabulary

Proposed canonical terms, so the sheet, the UI, and the glossary all say the same thing:

- **Program Jersey**: a jersey Madison Ultimate owns and lends out. Must come back.
- **Family Jersey**: a jersey a family bought and keeps. Avoid "personal jersey", "player-owned jersey".
- **Jersey Loan**: one Program Jersey lent to one Player: checked out at some point, open until checked in.
- **Check-out** / **Check-in**: starting and ending a Jersey Loan.
- **Jersey Manager**: a team parent who records check-outs and check-ins. Not a Coach.
- **Jersey Stock**: Program Jerseys the program physically has on hand right now.

➡️ Adopt these terms.

## Q2: Where the data lives

Program Jerseys outlive a season (a jersey lent this fall is back in Jersey Stock for spring), but the coach workbook is per season. Options:

- (a) A new standalone, non-seasonal workbook ("Madison Ultimate Jerseys"), keyed by PlayerID, with its own env var.
- (b) New tabs in each season's coach workbook, carrying open loans forward by hand each season.

➡️ (a) A standalone Jerseys workbook. The existing Jersey Distribution tab stays in the coach workbook for Family Jersey and sweatshirt hand-out, which is a one-time fall task this tool does not need to own.

## Q3: Are Program Jerseys individually identifiable?

Does each Program Jersey carry a number or label that distinguishes it from another of the same size (e.g. "#14, Adult Small")?

- If **no**: track Jersey Loans by size only. Jersey Stock is a count per size.
- If **yes**: track each jersey as an item, and a Jersey Loan names the jersey.

➡️ Track by size only (no per-jersey IDs). It needs no labeling, and the question you need answered ("who still has one of ours, and how many of each size are on the shelf") is answered by size.

## Q4: The core sheet shape (assuming Q2 a, Q3 by-size)

Two tabs:

- **Jersey Loans**: one row per loan. Columns: LoanID, PlayerID, Player Name (display only), Size, Checked Out At, Checked Out By, Checked In At, Checked In By, Outcome (blank while open, then `Returned` or `Lost`), Notes. Check-out appends a row; check-in fills the check-in columns on that row. An open loan is a row with no Outcome.
- **Jersey Stock**: one row per size: Size, Total Owned (typed by hand when jerseys are bought, found, or retired). On Hand is computed: Total Owned minus open loans of that size.

Rejected alternative: a pure append-only event log (one row per check-out or check-in event). More faithful as history, but every read must replay it, and it's much harder to read or hand-fix in the sheet.

➡️ Adopt the two-tab shape. The Loans tab is itself the history ("log of where our jerseys are"); nothing is ever deleted.

## Q5: Per-player "program or family jersey" field

You asked to store, per player, whether they have a Program or Family Jersey. With Jersey Loans in place, "has a Program Jersey" is just "has an open Jersey Loan". Is a separate per-player field needed for anything else (e.g. a Family Jersey player who should *not* be handed a Program Jersey at check-out)?

➡️ No separate field. A player's Program Jersey status is derived from open Jersey Loans; Family Jerseys are not tracked here at all.

## Q6: How a family checks a jersey back in

"Easy for a parent to check it back in" can mean:

- (a) **Manager-recorded**: the family hands the jersey to a Jersey Manager (or drops it in a bin at practice), and the manager taps Check-in on their phone. The Player Portal just shows "You have a Program Jersey (Adult Small); please return it to a Jersey Manager."
- (b) **Family self-report**: the family taps "I returned it" in the Player Portal, which ends the loan with no one confirming the jersey arrived.
- (c) Both: the family's tap marks it "return reported", and a manager confirms.

➡️ (a). Only the person holding the jersey can truthfully say it came back. The family's part is made easy by the portal telling them exactly what to return and to whom.

## Q7: Jersey Manager area and gate

A separate area for team parents, reusing the ADR 0008 gate mechanism with its own password, so team parents never get access to Coach Tools (which shows contact info and photos).

- Path: `/jerseys` (rather than `/jerseymanagement`), env var `JERSEY_MANAGER_PASSWORD`.
- "Checked in by who": the manager types their name once; the device remembers it and stamps it on every check-out and check-in. No list of Jersey Managers to maintain.
- Coaches can also use it (they'd just need the jersey password too).

➡️ Adopt as written.

## Q8: Seeding the current state

The Jersey Distribution tab shows every Checked Out box as FALSE. Have the Program Jerseys actually been handed out yet this fall?

- If **not yet**: the tool's first job is the hand-out itself (Check-out at practice), and nothing needs seeding.
- If **yes**: we seed one open Jersey Loan per player who has one, from a list you confirm.

➡️ Your call: tell me which is true. If handed out, seed from Jersey Distribution after you confirm the list.

## Round 1 decisions

- Q1 Vocabulary: adopted (Program Jersey, Family Jersey, Jersey Loan, Check-out, Check-in, Jersey Manager, Jersey Stock); now in `CONTEXT.md`.
- Q2 Standalone, non-seasonal Jerseys workbook keyed by PlayerID: adopted.
- Q3 Track Program Jerseys by size only: adopted.
- Q4 Two-tab shape (Jersey Loans, Jersey Stock), Loans tab is the history: adopted.
- Q5 No per-player "program or family" field, **but** keep a record of which Players have a Family Jersey, so future seasons know how many Program Jerseys they need. See Q9.
- Q6 Check-in is manager-recorded; the Player Portal tells the family what to return and to whom: adopted.
- Q7 `/jerseys`, `JERSEY_MANAGER_PASSWORD`, manager name typed once per device: adopted.
- Q8 Program Jerseys are already handed out. Seed open Jersey Loans from a list you confirm. See Q10.

# Round 2

Fact found since round 1: the family jersey order spreadsheet in Drive (Ultimate Reversible Jersey Order) is family orders only; nothing in Drive records how many Program Jerseys the program owns per size.

## Q9: Family Jersey record

A third tab, **Family Jerseys**: one row per Family Jersey. Columns: PlayerID, Player Name (display only), Size, Season Recorded (e.g. `Fall 2026`), Notes. Seeded from the "Family Owned Jersey Size" column of the coach workbook's Jersey Distribution tab (about 24 players; one player ordered two sizes, which becomes two rows). After that, a Jersey Manager can add one in `/jerseys`. Next season, "Program Jerseys needed" is Rostered Players minus those with a Family Jersey (whether it still fits is not tracked).

➡️ Adopt. Seed from what was ordered, not from the "Family Jersey Given?" box, since ordering is what means the player won't need a Program Jersey.

## Q10: Confirming the seed list for open Jersey Loans

I create the Jerseys workbook and pre-fill Jersey Loans with one open loan per Jersey Distribution row (72), size from "Program Jersey Size", Checked Out At blank, Checked Out By `Fall 2026 hand-out`. Each row is matched to a PlayerID by name; any name I can't match is listed at the top of the round-3 file. You confirm by deleting rows for players who did not actually get one (including any Family Jersey player who skipped the Program Jersey).

➡️ Adopt. Creating the workbook in the coach Drive is the only write; nothing family-facing changes until the portal work ships.

## Q11: Starting Jersey Stock

On Hand is computed from Total Owned, so the tab needs a starting Total Owned per size. Easiest for you to give: how many Program Jerseys of each size are on the shelf right now (not handed out)? Total Owned is then shelf plus open loans of that size.

➡️ You give shelf counts per size (YM, YL, AXS, AS, AM, plus any other sizes on the shelf); I compute Total Owned.

## Q12: Lost and retired jerseys

- A Jersey Loan closed as `Lost` takes that jersey out of the count automatically: On Hand = Total Owned − open loans − lost loans.
- A worn-out or found jersey is a hand edit to Total Owned, with no loan involved.
- No payment or fee tracking for lost jerseys.

➡️ Adopt as written.

## Q13: A jersey comes back but nobody knows whose

Example: a Youth Large turns up in the practice bin with no name. Options:

- (a) Check-in always requires a Player. The manager keeps it aside and figures out whose it is; until then it doesn't count as on hand.
- (b) Allow an "unattributed return" by size that adds to On Hand without closing any loan, leaving a phantom open loan somewhere.

➡️ (a). Option (b) makes On Hand and the open-loan list disagree, which is the exact confusion the tool is meant to remove.

## Q14: When Program Jerseys are due back

- (a) End of each season (after the last game), from every Player, even ones returning next season. Clean slate; sizes are re-checked each season.
- (b) Only when a Player leaves the program; loans stay open across seasons for continuing players.

➡️ (a) End of each season. Kids outgrow sizes, and a clean slate makes the open-loan list mean "jerseys we're still waiting on".

## Q15: What the Player Portal shows

On the Player Portal Home tab, for a Player with an open Jersey Loan: "You have a Program Jersey (Adult Small). Please return it to a Jersey Manager by Saturday, November 22." After Check-in: "Program Jersey returned Tuesday, November 18. Thank you!" Nothing is shown for Family Jerseys or for Players with no loans.

➡️ Adopt. The due date comes from one season-level setting, not per loan.

## Q16: What `/jerseys` shows a Jersey Manager

Three screens:

- **Check-in**: players with an open loan, searchable by name and grouped by Team; tap a player, then Check-in or Lost.
- **Check-out**: pick a Rostered Player; size defaults to their Signups Jersey Size and can be changed; warns if they already have an open loan or a Family Jersey.
- **Stock**: per size, Total Owned, Out, Lost, On Hand; below it the open-loan list.

No caretaker contact info anywhere in `/jerseys`; chasing unreturned jerseys goes through coaches (a later tool could draft reminder emails from the open-loan list).

➡️ Adopt as written.

## Round 2 decisions

- Q9 Family Jerseys tab, seeded from what was ordered: adopted.
- Q10 Create the Jerseys workbook, pre-fill open loans for you to prune: adopted, but see Q17 (the pre-fill can't simply be one loan per Jersey Distribution row).
- Q11 Starting Total Owned comes from what was ordered, not a shelf count. You'll reconcile against the garage later, and some may already be lost. See Q17 and Q19.
- Q12 Lost jerseys: track whether a fee was issued and whether it was paid. See Q18.
- Q13 Check-in always requires a Player: adopted.
- Q14 Due back at the end of each season, from every Player: adopted.
- Q15 Player Portal message, one season-level due date: adopted.
- Q16 Three `/jerseys` screens, no contact info: adopted.

# Round 3

Fact found since round 2: the 2026-09-18 email "Madison Ultimate program jersey order" ordered **70 Program Jerseys**: AL 3, AM 10, AS 27, YL 21, YM 9 (no AXS, no AXL). Your follow-up in that thread says the 2 Adult XL were for coaches, and that about 20 Family Jersey players likely didn't need a Program Jersey.

That doesn't match Jersey Distribution, whose "Program Jersey Size" column has 72 players: YL 24, AS 29, AM 8, YM 10, AXS 1. It looks like that column is the size each player *requested* at signup, not what they were handed. One loan per row would mean 29 Adult Small loans against 27 owned, and loans in a size (AXS) the program never bought.

## Q17: What the seed loan list is built from

- (a) One open loan per Jersey Distribution row, as in Q10, and you fix the sizes and delete rows by hand.
- (b) One open loan per row **except** Family Jersey players, sized from "Program Jersey Size". The workbook then shows, per size, loans vs owned, so any size where loans outnumber jerseys stands out for you to fix (most likely a player who got a size up or down).

➡️ (b). It starts from your stated assumption that Family Jersey players didn't take a Program Jersey, and makes the impossible sizes visible instead of hiding them. Total Owned starts at the ordered 70 (AL 3, AM 10, AS 27, YL 21, YM 9); the 2 Adult XL coach jerseys are not Program Jerseys.

## Q18: Lost jersey fees

On a Jersey Loan closed as `Lost`, two more columns:

- **Fee Issued**: the amount (blank means no fee was issued).
- **Fee Paid On**: the date it was paid (blank means unpaid).

The Stock screen lists unpaid fees. If a Lost jersey later turns up, the loan's Outcome changes to `Returned` and any fee note goes in Notes; no refund tracking. Fees apply only to Lost, not to damage. The Jersey Manager records both, in `/jerseys`. The Player Portal shows an unpaid fee in place of the "please return" message.

➡️ Adopt as written. Open question folded in: is there a standard fee amount to pre-fill? If not, the manager types it each time.

## Q19: Reconciling against the garage count

When you count what's actually on the shelf and it doesn't match On Hand, the difference is a jersey that went missing without a loan (or an extra). Fix it by editing Total Owned for that size, with a Stock Notes cell on that size's row explaining why ("−1 AS, garage count Dec 2026").

➡️ Adopt. No separate stock-count history; the Notes cell is enough for a program this size.

## Round 3 decisions

- Jersey Distribution "Program Jersey Size" is the requested size, not the handed-out size: confirmed.
- Q17 The seed list comes from the "Checked Out Program Jersey?" column (C), which you've now filled in and believe is accurate. Supersedes both (a) and (b).
- Total Owned starts at the 70 ordered (AL 3, AM 10, AS 27, YL 21, YM 9): adopted.
- Q18 Fee Issued / Fee Paid On on Lost loans: adopted. No standard fee amount given, so the manager types it.
- Q19 Reconcile by editing Total Owned with a Stock Notes cell: adopted, and it must be documented in a README. See Q22.

# Round 4

Fact found since round 3, re-reading column C: **49 checked out, 23 not**. Every one of the 23 not checked out has a Family Jersey. One player has both a Family Jersey and a checked-out Program Jersey. Checked out by requested size: AS 22, YL 17, YM 6, AM 3, AXS 1. Against the 70 owned, that leaves On Hand: AL 3, AM 7, AS 5, YL 4, YM 3 (22), give or take the AXS one.

## Q20: The Adult Extra Small loan

One checked-out player requested AXS, a size the program never bought, so they must have been handed something else.

➡️ Seed that loan as Adult Small (the nearest size we own) unless you know otherwise, and treat every other loan's size as the requested size. Wrong sizes surface at check-in, when the manager sees the actual jersey; the manager can correct the size on the loan then.

## Q21: The player with both jerseys

➡️ Keep the open Program Jersey loan and the Family Jersey row. Nothing about having a Family Jersey prevents a loan; it's just a signal for next season's order.

## Q22: Where the README lives

A **README** tab as the first tab of the Jerseys workbook: what each tab is, what each column means, how On Hand is computed, how to reconcile against a shelf count (Q19), how to record a Lost fee, and "don't delete loan rows". That's where a Jersey Manager or coach editing the sheet will actually look. The repo docs link to it rather than duplicating it.

➡️ Adopt.

## Q23: The old Jersey Distribution tab

After seeding, column C there goes stale the first time someone checks a jersey in through `/jerseys`. Options: leave it alone; add a note at the top saying Program Jersey loans now live in the Jerseys workbook (with a link); or clear column C.

➡️ Add the note and link, leave the data. The tab still owns Family Jersey and sweatshirt hand-out.

## Q24: Return due date setting

The single season-level due date (Q15) lives in a small **Settings** tab in the Jerseys workbook (one row: Return Due Date), so a coach changes it in the sheet without a deploy.

➡️ Adopt.

## Q25: Record this as an ADR?

"Jerseys live in a standalone, non-seasonal workbook keyed by PlayerID, tracked by size, with loans as the history" is hard to reverse once data accrues, will surprise a reader (everything else here is per season), and was a real choice against per-season tabs and per-jersey IDs.

➡️ Yes: write ADR 0009 for it.

## Round 4 decisions

- Q20 Seed the AXS loan as Adult Small; other loans use the requested size, corrected at check-in: adopted.
- Q21 The player with both a Family Jersey and a checked box took **only** the Family Jersey. Their column-C box is wrong; no loan is seeded for them. Seed is **48** open loans.
- Q22 README tab first in the Jerseys workbook: adopted.
- Q23 Note and link at the top of Jersey Distribution, data left alone: adopted.
- Q24 Due date can live in the app (set once a season). Decision: it goes in the app's season config alongside the other per-season settings; no Settings tab.
- Q25 Write ADR 0009: adopted.
- New: Jersey Managers need to leave free-form notes on the spot (about a player, a jersey, or anything else) instead of pen and paper. See Q26.

# Round 5

## Q26: Jersey Notes

A fourth tab, **Jersey Notes**, append-only: Recorded At, Recorded By (the device-remembered manager name), PlayerID (optional), Player Name (display only, optional), Size (optional), Note.

- In `/jerseys`, an "Add note" button on every screen. Opened from a player (on Check-in or Check-out) it pre-fills that player; otherwise it's a general note, with an optional size.
- A player's notes show under their name on the Check-in and Check-out screens, newest first. The Stock screen shows the 10 most recent notes.
- Notes are never shown to families, and can't be edited or deleted in the app (fix them in the sheet).
- The per-loan Notes column (Q4) stays, for things that belong to that loan (e.g. "fee waived"). Free observations go in Jersey Notes.

➡️ Adopt as written.

## Q27: Shared understanding

With Q26, every branch of the design tree is visited. Next, outside this grill: write ADR 0009; create the Jerseys workbook (README, Jersey Loans seeded with 48, Jersey Stock at 70, Family Jerseys seeded, Jersey Notes), each a write to the coach Drive I'll do only after you say go; then a build plan for `/jerseys` and the Player Portal message.

➡️ Yes, we've reached a shared understanding.

## Round 5 decisions

- Q26 Jersey Notes tab and "Add note" in `/jerseys`: adopted.
- Q27 Shared understanding reached (2026-11-13). ADR 0009 written; terms in `CONTEXT.md`. Next: create the Jerseys workbook (on your go-ahead), then a build plan.

## Correction (2026-11-13, after seeding)

Q21 was wrong for the one player it covered: that player did take a Program Jersey, and the Adult XL Family Jersey ordered under their name was for a coach, not the player. The workbook now has an open Adult Small loan for them and no Family Jersey row, so the seed is **49** open loans and **23** Family Jerseys (after also removing the earlier parent-sized row). Family jersey orders placed under a player's name can include jerseys for adults; check the size before treating one as the player's.
