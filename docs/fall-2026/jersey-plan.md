# Jersey check-out and check-in: build plan

Date: 2026-11-13. Design decisions are in `jersey-grill.md` (rounds 1 to 5), ADR 0009, and the Jerseys section of `CONTEXT.md`. This plan covers the `/jerseys` area for Jersey Managers and the Player Portal message for families.

## Starting point

- The **Madison Ultimate Jerseys** workbook exists in the coach Drive, outside any season folder: README, Jersey Loans (48 open), Jersey Stock (70 owned, 22 on hand), Family Jerseys (24), Jersey Notes (empty). Stock's Out / Lost / On Hand are sheet formulas for people editing by hand; the app computes the same numbers itself from the loan rows and never reads those formula cells.
- The app can't reach the workbook yet: it isn't shared with the app's service account and there is no env var for it.
- `/admin` and `/coach` share the cookie gate in `src/lib/password-gate.ts`, configured per area in `src/lib/gate-areas.ts` and enforced in `src/proxy.ts`.

## Phase 1: Plumbing

1. Share the Jerseys workbook with the app's service account as Editor (from the coach account, with `gog`).
2. `JERSEYS_SHEET_ID` env var (local `.env.local` and Vercel), plus `JERSEYS_SHEET_ID_TEST` pointing at a **Madison Ultimate Jerseys (Test)** copy with only fake players (`TestFirst TestLast`, `p001`), following the `SIGNUPS_SHEET_ID_TEST` pattern in `docs/TEST_DESIGN.md`. `/api/diagnostics` checks the variable and that the service account can read all five tabs.
3. `src/lib/jerseys-config.ts`: tab names and column header names (never positions), same shape as `signups-config.ts`. Sizes are the same codes Signups uses (`YM`, `YL`, `AXS`, `AS`, `AM`, `AL`, `AXL`), displayed with the existing `formatJerseySize`.

## Phase 2: Domain logic (pure, test-first)

`src/lib/jerseys.ts`, no I/O, with Vitest tests on fake rows:

- Parse each tab into typed rows by header name.
- **Open loans**: Outcome blank. **Stock per size**: Total Owned, Out (open), Lost, On Hand = Total Owned − Out − Lost; sizes with any loans but no Stock row still appear (Total Owned 0), so a typo in the sheet shows up instead of vanishing.
- **Unpaid fees**: Outcome `Lost`, Fee Issued set, Fee Paid On blank.
- **Per-player view**: open loan(s), most recent closed loan, unpaid fee, Family Jersey rows, Jersey Notes.
- Validation for writes: check-in only on an open loan; Outcome only `Returned` or `Lost`; fee only on `Lost`; check-out warns (does not block) when the player already has an open loan or a Family Jersey.

`src/lib/jerseys-sheet.ts` does the I/O through the existing `google-api.ts` helpers (`getSheetData`, `appendSheetData`, `updateSheetData`):

- **Check-out** appends a row with a new LoanID (same random-slug scheme as PlayerID).
- **Check-in, Lost, fee paid, size correction** re-read the loan row by LoanID right before writing, refuse if it has changed (e.g. two managers checking in the same jersey), and write only the affected cells, located by header.
- **Notes** and **Family Jerseys** append only.
- Timestamps are written as ISO-8601 UTC strings, like the Signups tab's Created At; the UI formats them in the viewer's timezone with `formatLocalTimestamp` / `formatFullDate`.
- No caching of jersey data: every screen load reads fresh, since two managers may be working at once and the data is small.

## Phase 3: Jersey Manager gate and login

- A third gate area in `gate-areas.ts`: cookie `madison_jersey_auth`, login page `/jerseys/login`, secret `JERSEY_MANAGER_PASSWORD`. `proxy.ts` gates `/jerseys/*` and `/api/jerseys/*` and leaves the login page and `/api/jerseys/login` open. Same fail-closed behavior as the other two. Extend `password-gate.test.ts`.
- `/jerseys/login`: "Your name" plus the password. The name is kept on the device (localStorage) and stamped as Checked Out By / Checked In By / Recorded By; a "Not you?" link on every screen changes it.
- ADR 0008 says there are two gated areas; I'd add a one-line note to it rather than a new ADR, since nothing about the mechanism changes.

## Phase 4: `/jerseys` screens (mobile first)

One page with three tabs and an "Add note" button in the header.

- **Check-in** (default tab): players with an open loan, grouped by Team, with a search box. Tapping a player shows their loan (size, checked out when and by whom), their Jersey Notes, and three actions: **Returned**, **Returned, different size** (pick the actual size; corrected on the loan), **Lost** (optional fee amount). Players with a Lost loan and an unpaid fee show a **Fee paid** action.
- **Check-out**: every Rostered Player (reusing `listRosteredPlayers`, which carries no contact info), searchable, grouped by Team. Tapping a player shows the size they asked for at signup as the default, any warnings (already has a loan, has a Family Jersey), and two actions: **Check out** (size editable) and **Has a Family Jersey** (records a Family Jersey row with a size).
- **Stock**: per size, Total Owned / Out / Lost / On Hand; unpaid fees; the 10 most recent Jersey Notes; a link to the workbook for hand edits.
- **Add note**: opened from a player, it pre-fills them; otherwise it's a general note with an optional size.

API routes, all under `/api/jerseys` (gated): `GET state` (everything the three tabs need in one read), `POST checkout`, `POST loans/[loanId]/checkin`, `POST loans/[loanId]/fee-paid`, `POST family-jerseys`, `POST notes`, `POST login`. Route tests follow `coach-routes.test.ts`.

## Phase 5: Player Portal

- `GET /api/player/[playerId]/jersey` (ungated, keyed by PlayerID like the practice and game routes) returns only that player's: open loan size, last return date, unpaid fee. Never notes, never other players.
- A card at the top of the Home tab, shown only when there is something to say:
  - Open loan: "You have a Program Jersey (Adult Small). Please return it to a Jersey Manager at the game on Saturday, November 14 or at the team party on Friday, November 20."
  - Returned this season: "Program Jersey returned Tuesday, November 18. Thank you!"
  - Lost with an unpaid fee: "Your Program Jersey was marked lost. A $X fee is due. A coach will be in touch about how to pay." (Payment will likely go through the school; the wording changes once that's settled.)
- Return dates: `APP_CONFIG.JERSEY_RETURN_EVENTS`, a list of dates and places (Fall 2026: the game on Saturday, November 14 and the team party on Friday, November 20). The card names the ones still ahead and drops each once it passes; added to the per-season checklist in `SEASON_SETUP.md`.

## Phase 6: Docs and rollout

- `CLAUDE.md` endpoint list, `SEASON_SETUP.md` (due date; check the Jerseys workbook at season start), `docs/TEST_DESIGN.md` (test workbook), ADR 0008 note.
- Verify on a phone-sized viewport against the test workbook: check out, check in, a different-size return, lost with fee, fee paid, a note, the portal card in each state.
- You set `JERSEY_MANAGER_PASSWORD` in Vercel and give it to the Jersey Managers; telling families is your call (newsletter).

## Out of scope

Reminder emails for unreturned jerseys, editing or deleting notes in the app, sweatshirts, and Family Jersey hand-out (stays in the coach workbook's Jersey Distribution tab).

## Delivery

Built directly on `main`, no branch or PR. Phases 1 to 4 first, then phase 5, each as its own conventional commit(s). Before calling it done, a Codex review of the changes, with its feedback worked through until we agree.
