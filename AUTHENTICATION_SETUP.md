# Authentication Setup for Madison Ultimate Portal

This document explains how the portal authenticates with external services.

## Seasonal Setup Checklist

**Use [SEASON_SETUP.md](SEASON_SETUP.md) as the main checklist** for everything that must be set or decided each season (env, Sheets, portal labels and links, Additional Info Form visibility, Buttondown, etc.). The rest of this file covers auth only.

For each new season you will need to:

1. **Google Sheets**: Set `ROSTER_SHEET_ID` in `.env.local` and **share that spreadsheet** with the service account (see "Grant Permissions" below).
2. **Portal and links**: Update season label, `SEASON_INFO_URL`, `MAILING_LIST_INFO_URL`, and `SHOW_ADDITIONAL_INFO_FORM` in the player portal — see [SEASON_SETUP.md](SEASON_SETUP.md).
3. **Buttondown** (optional): Set `BUTTONDOWN_API_KEY` in `.env.local` if you want the player page to show whether contact emails are on the newsletter. See **Getting a Buttondown API key** below. Team updates (Recent Team Updates) use the public Buttondown RSS and do not require an API key.

## Overview

The portal uses a **service account** for Google Sheets and Google Drive. Team updates come from the **public Buttondown newsletter RSS** (no auth). Mailing list status on the player page can optionally use the **Buttondown API** (API key).

### Service Account (Sheets/Drive)
- **Purpose**: Access roster data from Google Sheets and files from Google Drive
- **No user interaction** required once configured

### Team Updates (Buttondown RSS)
- **Purpose**: "Recent Team Updates" on the portal home
- **Source**: Public RSS at `https://buttondown.com/madisonultimate/rss` (cached 5 minutes)
- **No API key** required

### Mailing List Status (Buttondown API, optional)
- **Purpose**: Show "Subscribed" / "Not subscribed" for parent and student emails on the player page
- **Source**: Buttondown Subscribers API (cached 5 minutes)
- **Requires**: `BUTTONDOWN_API_KEY` in `.env.local`

## Getting a Buttondown API key

The Buttondown API key is **optional**. You only need it if you want the player page to show whether each contact email is subscribed to the newsletter. Team updates (Recent Team Updates on the portal home) use the public RSS and do **not** require an API key.

To get a key:

1. **Log in to Buttondown** at [buttondown.com](https://buttondown.com) with the account that owns the Madison Ultimate newsletter (`madisonultimate`).
2. **Open API requests**: Go to [buttondown.com/requests](https://buttondown.com/requests) (or in the dashboard: Settings → API).
3. **Create or copy your API key**: On the API requests page you’ll see your token. If you don’t have one yet, create one. The key is a long string (e.g. starts with a prefix like `abc123...`).
4. **Add it to `.env.local`**:
   ```env
   BUTTONDOWN_API_KEY=your-key-here
   ```
5. **Restart the dev server** so the app picks up the new variable.

The app uses this key only to **list subscribers** (read-only). Subscriber data is cached for 5 minutes so the API isn’t called on every player page load. Never commit the key to version control; keep it in `.env.local` (which is gitignored).

## Current Authentication Files

### Service Account
- **File**: `.google-service-account.json`
- **Environment**: `GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./.google-service-account.json`
- **Used for**: Google Sheets API, Google Drive API
- **Scopes**:
  - `https://www.googleapis.com/auth/spreadsheets`
  - `https://www.googleapis.com/auth/drive.readonly`

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
- **Optional** - the portal works without it; only mailing list status on the player page uses it

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
- `src/lib/buttondown-api.ts` - Buttondown Subscribers API (mailing list status)

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

### Mailing list status shows roster value or "Unknown"
- **Cause**: `BUTTONDOWN_API_KEY` not set or invalid
- **Solution**: Set the key in `.env.local` from Buttondown → API requests; subscriber list is cached 5 minutes
