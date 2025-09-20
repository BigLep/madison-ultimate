# Authentication Setup for Madison Ultimate Portal

This document explains the dual authentication system used in the Madison Ultimate Portal and how to set it up.

## Overview

The portal uses **two different authentication methods** for accessing different Google APIs:

1. **Service Account** - For Google Sheets and Drive APIs
2. **OAuth 2.0** - For Gmail API access

## Why Two Authentication Methods?

### Service Account (Sheets/Drive)
- **Purpose**: Access roster data from Google Sheets and files from Google Drive
- **Works well** because these APIs can be accessed by service accounts with proper permissions
- **No user interaction** required once configured

### OAuth 2.0 (Gmail)
- **Purpose**: Access Google Group messages sent to `madisonultimatefall25@googlegroups.com`
- **Required because**: Gmail API with service accounts requires domain-wide delegation, which only works with Google Workspace domains
- **Problem**: `madisonultimate@gmail.com` is a regular Gmail account, not a Google Workspace account
- **Solution**: Use OAuth 2.0 to authenticate as the specific Gmail user who has access to the group messages

## Google Groups Message Access Challenge

### The Problem
We want to display recent team messages from the Google Group `madisonultimatefall25@googlegroups.com` in the portal. However:

1. **No Google Groups API** exists for reading messages/conversations
2. **Gmail API is the only way** to access group messages programmatically
3. **Service accounts can't access regular Gmail accounts** without domain-wide delegation
4. **Domain-wide delegation only works** with Google Workspace domains
5. **Our Gmail account** (`madisonultimate@gmail.com`) is a regular Gmail account, not Workspace

### The Solution
Use OAuth 2.0 to authenticate once as `madisonultimate@gmail.com`, store the refresh token, and use it to access Gmail messages automatically.

## Current Authentication Files

### Service Account
- **File**: `.google-service-account.json`
- **Environment**: `GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./.google-service-account.json`
- **Used for**: Google Sheets API, Google Drive API
- **Scopes**:
  - `https://www.googleapis.com/auth/spreadsheets`
  - `https://www.googleapis.com/auth/drive.readonly`

### OAuth 2.0
- **File**: `.google-oauth.json`
- **Environment**: `GMAIL_REFRESH_TOKEN=<refresh-token-from-oauth-flow>`
- **Used for**: Gmail API
- **Scopes**:
  - `https://www.googleapis.com/auth/gmail.readonly`

## Setup Instructions for New Environments

### Prerequisites
1. **Google Cloud Project** with the following APIs enabled:
   - Google Sheets API
   - Google Drive API
   - Gmail API

### Step 1: Service Account Setup (Sheets/Drive)

1. **Create Service Account**:
   - Go to Google Cloud Console → IAM & Admin → Service Accounts
   - Create new service account
   - Download JSON credentials file
   - Rename to `.google-service-account.json`

2. **Grant Permissions**:
   - Share roster Google Sheet with service account email
   - Share Drive folders with service account email

3. **Environment Variable**:
   ```env
   GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./.google-service-account.json
   ```

### Step 2: OAuth 2.0 Setup (Gmail)

1. **Create OAuth 2.0 Credentials**:
   - Go to Google Cloud Console → APIs & Services → Credentials
   - Create OAuth 2.0 Client ID (Web application)
   - Add authorized redirect URI: `http://localhost:3001/api/auth/callback`
   - Download JSON credentials file
   - Rename to `.google-oauth.json`

2. **Configure OAuth Consent Screen**:
   - Set up OAuth consent screen (External)
   - Add required information (app name, contact emails)
   - Add test users: include `madisonultimate@gmail.com`

3. **Run OAuth Flow**:
   ```bash
   # Start development server
   npm run dev

   # Get authorization URL
   curl http://localhost:3001/api/auth/gmail

   # Follow the returned authUrl in browser
   # Sign in with madisonultimate@gmail.com
   # Grant Gmail read permissions
   # Copy refresh token from callback response
   ```

4. **Environment Variable**:
   ```env
   GMAIL_REFRESH_TOKEN=<refresh-token-from-oauth-flow>
   ```

### Step 3: Verify Setup

1. **Test Sheets/Drive APIs**:
   ```bash
   curl http://localhost:3001/api/roster/metadata
   ```

2. **Test Gmail API**:
   ```bash
   curl http://localhost:3001/api/group-messages
   ```

## Security Considerations

### Service Account
- **Keep JSON file secure** - never commit to version control
- **Principle of least privilege** - only grant necessary permissions
- **Regular audit** - review what the service account has access to

### OAuth Refresh Token
- **Keep token secure** - store in environment variables only
- **Limited scope** - only Gmail readonly access
- **Refresh tokens can expire** if:
  - User changes password
  - User revokes access
  - App is unused for extended periods (testing mode)

## Maintenance

### When OAuth Token Expires
1. **Symptoms**: Gmail API returns authentication errors
2. **Solution**: Re-run OAuth flow to get new refresh token
3. **Frequency**: Rarely needed (usually months/years)

### When Service Account Access Breaks
1. **Symptoms**: Sheets/Drive APIs return permission errors
2. **Solutions**:
   - Re-share resources with service account
   - Regenerate service account credentials
   - Check API quotas/limits


## Files in Project

### Authentication Modules
- `src/lib/google-api.ts` - Service account authentication for Sheets/Drive
- `src/lib/gmail-oauth.ts` - OAuth 2.0 authentication for Gmail
- `src/lib/gmail-api.ts` - Gmail API functions using OAuth

### API Endpoints
- `src/app/api/auth/gmail/route.ts` - Get OAuth authorization URL
- `src/app/api/auth/callback/route.ts` - Handle OAuth callback
- `src/app/api/group-messages/route.ts` - Fetch group messages

### Environment Files
- `.env.local` - Environment variables (not committed)
- `.google-service-account.json` - Service account credentials (not committed)
- `.google-oauth.json` - OAuth client credentials (not committed)

## Troubleshooting

### "Access blocked" during OAuth
- **Cause**: Gmail account not added as test user
- **Solution**: Add `madisonultimate@gmail.com` to OAuth consent screen test users

### "Precondition check failed" in Gmail API
- **Cause**: Invalid or expired refresh token
- **Solution**: Re-run OAuth flow to get fresh token

### "Permission denied" for Sheets/Drive
- **Cause**: Service account lacks access to resources
- **Solution**: Re-share Google Sheets/Drive folders with service account email

### No messages returned from Gmail API
- **Cause**: Gmail account not member of Google Group, or no recent messages
- **Solution**: Verify `madisonultimate@gmail.com` is subscribed to the group