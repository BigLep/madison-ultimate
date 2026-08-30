# Authentication Setup for Madison Ultimate Portal

This document explains how the portal authenticates with external services.

## Seasonal Setup Checklist

**Use [SEASON_SETUP.md](SEASON_SETUP.md) as the main checklist** for everything that must be set or decided each season (env, Sheets, portal labels and links, Additional Info Form visibility, signup birth-year window, Buttondown, etc.). The rest of this file covers auth only.

For each new season you will need to:

1. **Google Sheets**: Set `ROSTER_SHEET_ID` in `.env.local` and **share that spreadsheet** with the service account (see "Grant Permissions" below).
2. **Portal and links**: Update season label, `SEASON_INFO_URL`, `MAILING_LIST_INFO_URL`, `WHATSAPP_LEARN_MORE_URL` (season-specific Notion deep link — do not leave last season's More Season Info URL), and `SHOW_ADDITIONAL_INFO_FORM` — see [SEASON_SETUP.md](SEASON_SETUP.md).
3. **Signup birth-year window**: Bump `PLAYER_BIRTHDATE_MIN` / `MAX` / picker default in `src/lib/player-birthdates.ts` (and the portal login year list if that login is still in use) so the date picker stays on current 6th–8th graders.
4. **Buttondown** (optional): Set `BUTTONDOWN_API_KEY` in `.env.local` with **subscriber write** if you want the player page to show newsletter status and Join / Leave. Confirm with `/api/diagnostics` (Subscriber Read + Subscriber Write). Team updates use the public Buttondown RSS and do not require an API key.

## Overview

The portal uses a **service account** for Google Sheets and Google Drive. Team updates come from the **public Buttondown newsletter RSS** (no auth). Newsletter status on the player page can optionally use the **Buttondown API** (API key).

### Service Account (Sheets/Drive)
- **Purpose**: Access roster data from Google Sheets and files from Google Drive
- **No user interaction** required once configured

### Team Updates (Buttondown RSS)
- **Purpose**: "Recent Team Updates" on the portal home
- **Source**: Public RSS at `https://buttondown.com/madisonultimate/rss` (cached 5 minutes)
- **No API key** required

### Newsletter status (Buttondown API, optional)
- **Purpose**: Show subscribed / not subscribed, Join / Leave, and auto-subscribe on first Final Forms join and profile save
- **Source**: Buttondown Subscribers API (list is cached 5 minutes)
- **Requires**: `BUTTONDOWN_API_KEY` in `.env.local` with **subscriber write** (a read-only key lists status but Join / Leave fails with 403)

## Getting a Buttondown API key

The Buttondown API key is **optional**. You only need it if you want the player page to show newsletter status and let families Join / Leave. Team updates (Recent Team Updates on the portal home) use the public RSS and do **not** require an API key.

To get a key:

1. **Log in to Buttondown** at [buttondown.com](https://buttondown.com) with the account that owns the Madison Ultimate newsletter (`madisonultimate`).
2. **Open API keys**: Buttondown → **API → Keys** (not the older read-only “API requests” token if that is all you have).
3. **Create or edit a key** with **subscriber** access set to **write**. Listing-only keys still show subscribed / not subscribed; Join / Leave and auto-subscribe fail with HTTP 403.
4. **Add it to `.env.local`**:
   ```env
   BUTTONDOWN_API_KEY=your-key-here
   ```
   Also set the same key on Vercel Production if you rotate it. If you only change permissions on the existing key, you do not need a new env value.
5. **Restart the dev server** so the app picks up a new variable.
6. **Confirm write access**: `curl -s http://localhost:3001/api/diagnostics | jq '.results[] | select(.category=="Buttondown")'`. Subscriber Read and Subscriber Write should both be `pass`. The write check PATCHes a reserved nonexistent address (`madison-ultimate-diagnostics-probe@invalid`): 404 means the key can write; 403 means it is still read-only. It never adds anyone to the list.

Never commit the key. Subscriber list reads are cached for 5 minutes.

## Current Authentication Files

### Service Account
- **File**: `.google-service-account.json`
- **Environment**: `GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./.google-service-account.json`
- **Used for**: Google Sheets API, Google Drive API
- **Scopes**:
  - `https://www.googleapis.com/auth/spreadsheets`
  - `https://www.googleapis.com/auth/drive.readonly`

### OAuth Drive identity (photo upload)
- **File**: `src/lib/google-oauth-drive.ts`
- **Environment**: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`, `PHOTOS_FOLDER_ID`
- **Used for**: Uploading player photos to Google Drive. Google service accounts have no Drive storage quota and cannot create files in a "My Drive" folder, so photo uploads authenticate as a real Google account (the coach account) via OAuth refresh token instead of the service account above.
- **Confirm setup**: `/api/diagnostics` reports "Photo Upload" checks (missing env vars, missing `PHOTOS_FOLDER_ID`, or an invalid/expired refresh token all show up there).

## Setup Instructions for New Environments

### Prerequisites
1. **Google Cloud Project** with the following APIs enabled:
   - Google Sheets API
   - Google Drive API

### Step 1: Service Account Setup (Sheets/Drive)

1. **Create Service Account**:
   - Go to Google Cloud Console → IAM & Admin → Service Accounts
   - Create new service account
   - Download JSON credentials file
   - Rename to `.google-service-account.json`

2. **Grant Permissions** (required each season when using a new workbook):
   - **Share the season roster spreadsheet** with the service account email (e.g. `stevel@cedar-scene-471205-t3.iam.gserviceaccount.com` — or use the `client_email` from `.google-service-account.json`). In Google Sheets: open the workbook → Share → add that email with at least **Viewer** (or **Editor** if the app writes to the sheet). Without this, the app will get "permission denied" and login will fail.
   - Share any Drive folders the app needs with the same service account email.

3. **Environment Variable**:
   ```env
   GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./.google-service-account.json
   ```

### Step 2: Verify Setup

1. **Test Sheets/Drive APIs**:
   ```bash
   curl http://localhost:3001/api/roster/metadata
   ```

2. **Test Team Updates** (Buttondown RSS):
   ```bash
   curl http://localhost:3001/api/team-updates
   ```

## Security Considerations

### Service Account
- **Keep JSON file secure** - never commit to version control
- **Principle of least privilege** - only grant necessary permissions
- **Regular audit** - review what the service account has access to

### Buttondown API Key
- **Keep key secure** - store in environment variables only
- **Optional** - the portal works without it; newsletter status, Join / Leave, and auto-subscribe need it
- **Subscriber write** is required; `/api/diagnostics` is the check that a listing-only key will fail

## Maintenance

### When Service Account Access Breaks
1. **Symptoms**: Sheets/Drive APIs return permission errors
2. **Solutions**:
   - Re-share resources with service account
   - Regenerate service account credentials
   - Check API quotas/limits

## Files in Project

### Authentication / External APIs
- `src/lib/google-api.ts` - Service account authentication for Sheets/Drive
- `src/lib/buttondown-rss.ts` - Fetch and cache Buttondown newsletter RSS (team updates)
- `src/lib/buttondown-api.ts` - Buttondown Subscribers API (status, Join / Leave, auto-subscribe, diagnostics probe)

### API Endpoints
- `src/app/api/team-updates/route.ts` - Fetch recent team updates from Buttondown RSS

### Environment Files
- `.env.local` - Environment variables (not committed)
- `.google-service-account.json` - Service account credentials (not committed)

## Troubleshooting

### "Permission denied" for Sheets/Drive
- **Cause**: Service account lacks access to resources
- **Solution**: Re-share Google Sheets/Drive folders with service account email

### Team updates not loading
- **Cause**: Buttondown RSS URL or network issue
- **Solution**: Check that https://buttondown.com/madisonultimate/rss is accessible; RSS is cached 5 minutes

### Newsletter status shows roster value or "Unknown"
- **Cause**: `BUTTONDOWN_API_KEY` not set or invalid
- **Solution**: Set the key in `.env.local` from Buttondown → API → Keys; confirm `/api/diagnostics` Subscriber Read is `pass`. List reads are cached 5 minutes.

### Join / Leave does nothing or shows "Couldn't update newsletter status"
- **Cause**: Key can list subscribers but lacks **subscriber write** (HTTP 403)
- **Solution**: Buttondown → API → Keys → set subscriber access to write. `/api/diagnostics` Subscriber Write should then pass. Restart the server if you replaced `BUTTONDOWN_API_KEY`.
