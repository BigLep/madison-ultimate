import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';

// OAuth 2.0 configuration for Gmail access
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// Load OAuth credentials from file
function loadOAuthCredentials() {
  const credentialsPath = path.join(process.cwd(), '.google-oauth.json');

  if (!fs.existsSync(credentialsPath)) {
    throw new Error('OAuth credentials file not found. Please ensure .google-oauth.json exists in the project root.');
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

  if (!credentials.web) {
    throw new Error('Invalid OAuth credentials format. Expected "web" client configuration.');
  }

  return credentials.web;
}

// Create OAuth2 client
function createOAuth2Client(): OAuth2Client {
  const credentials = loadOAuthCredentials();
  const redirectUri = 'http://localhost:3001/api/auth/callback';

  return new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    redirectUri
  );
}

// Get authorization URL for initial OAuth flow
export function getAuthUrl(): string {
  const oauth2Client = createOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Important: gets refresh token
    scope: SCOPES,
    prompt: 'consent', // Forces consent screen to ensure refresh token
  });
}

// Exchange authorization code for tokens
export async function getTokensFromCode(code: string) {
  const oauth2Client = createOAuth2Client();

  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

// Create authenticated Gmail client using refresh token
export async function getGmailClient() {
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error('Gmail refresh token not found. Please run OAuth setup first.');
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// Refresh access token if needed
export async function refreshAccessToken() {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}