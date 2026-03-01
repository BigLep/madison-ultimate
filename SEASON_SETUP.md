# Season Setup Guide

Use this checklist at the start of each season so the portal and APIs point to the right data and show the right options.

---

## 1. Environment variables

| What | Where | Notes |
|------|--------|------|
| **ROSTER_SHEET_ID** | `.env.local` | Google Sheet ID of the **season workbook** (roster + Practice Info, Game Info, availability tabs). |
| **TEAM_MAILING_LIST_FOLDER_ID** | `.env.local` | Optional. Google Drive folder for mailing list CSV if you use that feature. |

After changing `ROSTER_SHEET_ID`, restart the dev/server process.

---

## 2. Google Sheets access

- **Share the season roster spreadsheet** with the app’s service account so it can read (and optionally write) data.  
  In the sheet: **Share** → add the service account email (e.g. from `.google-service-account.json` → `client_email`) with at least **Viewer** (or **Editor** if the app writes availability).  
  Without this, login and roster loading will fail with permission errors.
- Ensure all tabs and data in that workbook are updated for the new season (Roster, Practice Info, Game Info, Practice Availability, Game Availability).

See [AUTHENTICATION_SETUP.md](AUTHENTICATION_SETUP.md) for service account details.

---

## 3. Portal UI and links (player-facing)

All of these live in **`src/app/player-portal/[portalId]/page.tsx`**. Decide each season and update as needed.

| Setting | Where in code | What to decide |
|--------|----------------|-----------------|
| **Season label** | `HomeScreen`: `<CardDescription>… Season</CardDescription>` (e.g. “Spring 2026 Season”) | Exact label shown on the portal home. |
| **SEASON_INFO_URL** | `HomeScreen`: `const SEASON_INFO_URL = '…'` | Notion (or other) URL for “team site” / season info. |
| **MAILING_LIST_INFO_URL** | Top of file: `const MAILING_LIST_INFO_URL = '…'` | Notion (or other) URL for mailing list / more info. |
| **Show “Additional Info Form”** | Top of file: `const SHOW_ADDITIONAL_INFO_FORM = true \| false` | Whether to show the “Additional Info Form” link and questionnaire status in **Player Info**. Set to `false` to hide for seasons that don’t use it (e.g. Spring 2026). |

---

## 4. Google Group and Gmail (team messages)

If the portal shows team messages from a Google Group:

- Create or choose the **season Google Group** (e.g. `madisonultimatespring26@googlegroups.com`).
- Update every reference to the group (e.g. search for the previous season’s group name in this repo and in `PROJECT REQUIREMENTS.md`).
- **Gmail OAuth**: The refresh token can expire after ~7 days of inactivity. Re-run the OAuth flow at `/api/auth/gmail` if messages stop loading. See [AUTHENTICATION_SETUP.md](AUTHENTICATION_SETUP.md).

---

## 5. Game and team setup

In **`src/lib/game-config.ts`**:

- **TEAM_DISPLAY_NAME** (e.g. `"Varsity Team"`): Used when the roster has no team column or a single team. Change if your season uses a different label.

Sheet structure (single team vs Blue/Gold, etc.) is configured in the codebase and in the workbook; if you change how teams work, update game-config and the Game Info/Game Availability sheet layout to match.

---

## Quick reference: files to touch each season

- **`.env.local`** – `ROSTER_SHEET_ID` (and optionally `TEAM_MAILING_LIST_FOLDER_ID`).
- **`src/app/player-portal/[portalId]/page.tsx`** – Season label, `SEASON_INFO_URL`, `MAILING_LIST_INFO_URL`, `SHOW_ADDITIONAL_INFO_FORM`.
- **`src/lib/game-config.ts`** – `TEAM_DISPLAY_NAME` if you use a different default team name.
- **Google Sheet** – Share with service account; update tabs and data.
- **Google Group / Gmail** – If using team messages: group name and OAuth as above.

For auth details (service account, OAuth, tokens), see [AUTHENTICATION_SETUP.md](AUTHENTICATION_SETUP.md).
