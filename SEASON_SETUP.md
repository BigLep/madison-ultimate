# Season Setup Guide

Use this checklist at the start of each season so the portal and APIs point to the right data and show the right options.

---

## 1. Environment variables

| What | Where | Notes |
|------|--------|------|
| **ROSTER_SHEET_ID** | `.env.local` | Google Sheet ID of the **season workbook** (roster + Practice Info, Game Info, availability tabs). |
| **TEAM_MAILING_LIST_FOLDER_ID** | `.env.local` | Optional. Google Drive folder for mailing list CSV if you use that feature. |
| **BUTTONDOWN_API_KEY** | `.env.local` | Optional. Buttondown API key so the player page can show whether contact emails are on the newsletter. Team updates use the public RSS and do not require this. |

After changing `ROSTER_SHEET_ID`, restart the dev/server process.

---

## 2. Google Sheets access

- **Share the season roster spreadsheet** with the app’s service account so it can read (and optionally write) data.  
  In the sheet: **Share** → add the service account email (e.g. from `.google-service-account.json` → `client_email`) with at least **Viewer** (or **Editor** if the app writes availability).  
  Without this, login and roster loading will fail with permission errors.
- Ensure all tabs and data in that workbook are updated for the new season (Roster, Practice Info, Game Info, Practice Availability, Game Availability).

See [AUTHENTICATION_SETUP.md](AUTHENTICATION_SETUP.md) for service account details.

---

## 3. Roster sheet layout (first data row)

If your roster sheet has a different layout than “row 1 = header, row 2 = first player,” update the constant so portal login and roster reads use the correct row.

| What | Where | Notes |
|------|--------|------|
| **ROSTER_FIRST_DATA_ROW** | `src/lib/sheet-config.ts` | First data row **1-indexed** (e.g. `2` = row 2). Row 1 = header by default; increase if you have more header/metadata rows. |

---

## 4. Portal UI and links (player-facing)

All of these live in **`src/app/player-portal/[portalId]/page.tsx`**. Decide each season and update as needed.

| Setting | Where in code | What to decide |
|--------|----------------|-----------------|
| **Season label** | `HomeScreen`: `<CardDescription>… Season</CardDescription>` (e.g. “Spring 2026 Season”) | Exact label shown on the portal home. |
| **SEASON_INFO_URL** | `HomeScreen`: `const SEASON_INFO_URL = '…'` | Notion (or other) URL for “team site” / season info. |
| **MAILING_LIST_INFO_URL** | Top of file: `const MAILING_LIST_INFO_URL = '…'` | Notion (or other) URL for mailing list / more info. |
| **Show “Additional Info Form”** | Top of file: `const SHOW_ADDITIONAL_INFO_FORM = true \| false` | Whether to show the “Additional Info Form” link and questionnaire status in **Player Info**. Set to `false` to hide for seasons that don’t use it (e.g. Spring 2026). |

**Join the Community** (WhatsApp and game snack links on the portal home) are in **`src/lib/app-config.ts`**:

| Setting | What to decide |
|--------|-----------------|
| **WHATSAPP_COMMUNITY_JOIN_URL** | WhatsApp invite link for the team community. |
| **WHATSAPP_LEARN_MORE_URL** | Notion (or other) "learn more" page for the WhatsApp community. |
| **GAME_SNACK_SIGNUP_URL** | Notion (or other) page for game snack signup. |

---

## 5. Team updates and newsletter (Buttondown)

- **Recent Team Updates** on the portal home come from the **public Buttondown RSS** at `https://buttondown.com/madisonultimate/rss` (cached 5 minutes). No API key needed. Ensure web archives are enabled in Buttondown so the RSS feed is available.
- **Mailing list status** on the player page (whether parent/student emails are subscribed) uses the Buttondown Subscribers API when `BUTTONDOWN_API_KEY` is set (cached 5 minutes). See [AUTHENTICATION_SETUP.md](AUTHENTICATION_SETUP.md#getting-a-buttondown-api-key) for how to get the key.

---

## 6. Game and team setup

In **`src/lib/game-config.ts`**:

- **TEAM_DISPLAY_NAME** (e.g. `"Varsity Team"`): Used when the roster has no team column or a single team. Change if your season uses a different label.

Sheet structure (single team vs Blue/Gold, etc.) is configured in the codebase and in the workbook; if you change how teams work, update game-config and the Game Info/Game Availability sheet layout to match.

---

## 7. Special portal behaviors (Bye, Cancelled, etc.)

These behaviors are driven by values in the **Practice Info** and **Game Info** sheets.

- **Cancelled practices**
  - Sheet: **Practice Info** → `Note` column.
  - If the note **contains `Cancelled`** (any capitalization), the portal will:
    - Show a “Practice Cancelled” card for that date.
    - **Hide availability buttons** for that practice (players cannot change availability).
    - Block updates to availability for that practice via the API.
  - To cancel a practice: put something like `Cancelled` or `Cancelled – rainout` in the Note cell for that practice row.

- **Bye games**
  - Sheet: **Game Info** → `Game #` column.
  - If `Game #` is `bye` (any capitalization), the portal will:
    - Show a “Bye Week – No Game Scheduled” card instead of the usual availability card.
    - Not show availability buttons for that game.

- **Field Name / Field Location / Fields sheet**
  - `Field Name` in **Game Info** and **Practice Info** must match a row in the **📍Fields** sheet to get a Google Map link.
  - `Field Location` is a free-text subfield (e.g. `East`).
  - The portal displays location as `Field Name (Field Location)` when both are set, e.g. `Madison (All)`. If `Field Location` is empty, it just shows `Field Name`.

- **Practice and game times**
  - Times are read from **Practice Info** (`Start`, `End`) and **Game Info** (`Warmup Arrival`, `Game Start`, `Done By`).
  - Values can be either:
    - Already formatted with AM/PM (e.g. `3:55 PM`), or
    - 24‑hour `HH:MM` (e.g. `15:55`), which the portal converts to `3:55 PM`.
  - For practices, make sure the columns are:  
    `Date, Field Name, Field Location, Start, End, Duration, Note, Google Calendar Event ID`.
    The portal uses **Start** and **End** and ignores Duration and the calendar ID.

- **Ignored Game Info columns**
  - Extra columns like `Google Calendar Event ID` and `Google Calendar Warmup Event ID` are safe to use; the portal ignores them and only reads the named Game Info columns documented in `src/lib/game-config.ts`.

---

## Quick reference: files to touch each season

- **`.env.local`** – `ROSTER_SHEET_ID`; optionally `TEAM_MAILING_LIST_FOLDER_ID`, `BUTTONDOWN_API_KEY`.
- **`src/lib/sheet-config.ts`** – `ROSTER_FIRST_DATA_ROW` if your roster has more than one header row (e.g. first data row is not row 2).
- **`src/app/player-portal/[portalId]/page.tsx`** – Season label, `MAILING_LIST_INFO_URL`, `SHOW_ADDITIONAL_INFO_FORM`.
- **`src/lib/app-config.ts`** – `SEASON_INFO_URL`; Join the Community: `WHATSAPP_COMMUNITY_JOIN_URL`, `WHATSAPP_LEARN_MORE_URL`, `GAME_SNACK_SIGNUP_URL`.
- **`src/lib/game-config.ts`** – `TEAM_DISPLAY_NAME` if you use a different default team name.
- **Google Sheet** – Share with service account; update tabs and data.
- **Buttondown** – RSS is public; set `BUTTONDOWN_API_KEY` if you want mailing list status on the player page.

For auth details (service account, OAuth, tokens), see [AUTHENTICATION_SETUP.md](AUTHENTICATION_SETUP.md).
