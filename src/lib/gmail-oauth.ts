import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';

// OAuth 2.0 configuration for Gmail access
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// Load OAuth credentials from file
function loadOAuthCredentialsFromFile() {
  const credentialsPath = process.env.GOOGLE_OAUTH_JSON_PATH || path.join(process.cwd(), '.google-oauth.json');

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`OAuth credentials file not found at: ${credentialsPath}`);
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

  if (!credentials.web) {
    throw new Error('Invalid OAuth credentials format. Expected "web" client configuration.');
  }

  return credentials.web;
}

// Get OAuth credentials from environment variables or file
function getOAuthCredentials() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  // Option 1: Use individual environment variables
  if (clientId && clientSecret) {
    return { client_id: clientId, client_secret: clientSecret };
  }

  // Option 2: Use OAuth JSON file path (only if explicitly set)
  if (process.env.GOOGLE_OAUTH_JSON_PATH) {
    try {
      return loadOAuthCredentialsFromFile();
    } catch (error) {
      throw new Error(`Failed to load OAuth credentials from file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Neither option available
  throw new Error(
    'Gmail OAuth credentials not configured. Please set either:\n' +
    '1. GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET environment variables, or\n' +
    '2. GOOGLE_OAUTH_JSON_PATH environment variable pointing to your OAuth JSON file'
  );
}

// Create OAuth2 client
function createOAuth2Client(): OAuth2Client {
  const credentials = getOAuthCredentials();

  const redirectUri = process.env.NODE_ENV === 'production'
    ? 'https://madison-ultimate.vercel.app/api/auth/callback'
    : 'http://localhost:3001/api/auth/callback';

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