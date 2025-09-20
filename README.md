# Madison Ultimate App

A web application to track signup progress for Madison Middle School Ultimate Frisbee players.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd madison-ultimate
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Google API access** (see [Google API Setup](#google-api-setup) below)

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000) to see the application.

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the application for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality checks

## Documentation

- **[PROJECT REQUIREMENTS.md](./PROJECT%20REQUIREMENTS.md)** - Business requirements and feature specifications
- **[PLAN.md](./PLAN.md)** - Implementation plan, progress tracking, and development phases
- **[DESIGN.md](./DESIGN.md)** - Technical architecture, data mapping, and implementation details
- **[CLAUDE.md](./CLAUDE.md)** - Claude Code development notes and commands

## Project Structure

```
madison-ultimate/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   └── api/                # API routes for data processing
│   ├── components/             # Reusable UI components
│   ├── lib/                    # Utilities and API integrations
│   └── styles/                 # Global styles
├── tmp/                        # Cached data files (development)
├── public/                     # Static assets
└── *.md                        # Documentation files
```

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Deployment**: Vercel (planned)
- **Data Sources**: Google Sheets API, Google Drive API, Gmail API

## Development Workflow

This project uses conventional commits with emojis for fun! Please format your commit messages as:

```
type(scope): description with emojis

Examples:
feat: add player signup status table ⚽
fix: resolve data matching issue
docs: update setup instructions 📖
```

## Stage 1: Signup Steps Reporting

Currently implementing a dashboard to track player signup progress across multiple data sources:

- SPS Final Forms completion status
- Additional questionnaire responses  
- Team mailing list membership

See `PLAN.md` for detailed implementation progress.

## Google API Setup

This application requires access to Google Sheets and Google Drive to fetch player signup data. Follow these steps to set up API access:

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Note your project ID for reference

### 2. Enable Required APIs

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for and enable:
   - **Google Sheets API**
   - **Google Drive API**

### 3. Create Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the service account details:
   - Name: `madison-ultimate-service`
   - Description: `Service account for Madison Ultimate app data access`
4. Click "Create and Continue"
5. Skip role assignment (we'll grant access directly to resources)
6. Click "Done"

### 4. Generate Service Account Key

1. Click on the newly created service account
2. Go to the "Keys" tab
3. Click "Add Key" > "Create new key"
4. Select "JSON" format
5. Download the JSON key file
6. Rename it to `.google-service-account.json`
7. Place it in the root of your project directory

### 5. Grant Access to Data Sources

You must share each Google resource with the service account email (found in the JSON key file):

**For Google Sheets:**
1. Open the [Additional Questionnaire sheet](https://docs.google.com/spreadsheets/d/1f_PPULjdg-5q2Gi0cXvWvGz1RbwYmUtADChLqwsHuNs/)
2. Click "Share" button
3. Add the service account email (e.g., `service-name@project-id.iam.gserviceaccount.com`)
4. Set permission to "Viewer"
5. Uncheck "Notify people" since it's a service account

**For Google Drive Folders:**
1. Open [SPS Final Forms folder](https://drive.google.com/drive/folders/1SnWCxDIn3FxJCvd1JcWyoeoOMscEsQcW)
2. Right-click folder > "Share"
3. Add the service account email with "Viewer" permission
4. Repeat for [Team Mailing List folder](https://drive.google.com/drive/folders/1pAeQMEqiA9QdK9G5yRXsqgbNVzEU7R1E)

**For Roster Sheet (Stage 2):**
1. Open the [Team Roster sheet](https://docs.google.com/spreadsheets/d/1ZZA5TxHu8nmtyNORm3xYtN5rzP3p1jtW178UgRcxLA8/)
2. Click "Share" button
3. Add the service account email
4. Set permission to **"Editor"** (required for roster building functionality)
5. Uncheck "Notify people" since it's a service account

### 6. Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Update `.env.local` with your configuration:
   ```bash
   # Google API Configuration
   GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./.google-service-account.json
   
   # Data Source IDs
   ADDITIONAL_QUESTIONNAIRE_SHEET_ID=1f_PPULjdg-5q2Gi0cXvWvGz1RbwYmUtADChLqwsHuNs
   SPS_FINAL_FORMS_FOLDER_ID=1SnWCxDIn3FxJCvd1JcWyoeoOMscEsQcW
   TEAM_MAILING_LIST_FOLDER_ID=1pAeQMEqiA9QdK9G5yRXsqgbNVzEU7R1E
   ROSTER_SHEET_ID=1ZZA5TxHu8nmtyNORm3xYtN5rzP3p1jtW178UgRcxLA8
   ```

### 7. Security Notes

- The `.google-service-account.json` file contains sensitive credentials
- It's automatically ignored by git (listed in `.gitignore`)
- Never commit this file to version control
- For production deployment, use secure environment variable storage

## Authentication Setup

This application uses **dual authentication** for different Google APIs:

- **Service Account**: For Google Sheets and Drive APIs
- **OAuth 2.0**: For Gmail API (team message access)

For complete authentication setup instructions, see [AUTHENTICATION_SETUP.md](./AUTHENTICATION_SETUP.md).

## Deployment (Vercel)

### Required Environment Variables

Set these in Vercel Dashboard → Project → Settings → Environment Variables:

```env
# Service Account
GOOGLE_SERVICE_ACCOUNT_KEY=<full-json-content-as-string>

# Gmail OAuth
GMAIL_REFRESH_TOKEN=<your-refresh-token-from-oauth-flow>

# Resource IDs
ROSTER_SHEET_ID=<sheet-id>
SPS_FINAL_FORMS_FOLDER_ID=<folder-id>
TEAM_MAILING_LIST_FOLDER_ID=<folder-id>
ADDITIONAL_QUESTIONNAIRE_SHEET_ID=<sheet-id>
```

### Deployment Steps

1. **Complete authentication setup** following [AUTHENTICATION_SETUP.md](./AUTHENTICATION_SETUP.md)

2. **Update OAuth redirect URI** in Google Cloud Console:
   - Add production domain: `https://your-app.vercel.app/api/auth/callback`

3. **Set environment variables** in Vercel dashboard

4. **Deploy and test**:
   ```bash
   # Test the application APIs
   curl https://your-app.vercel.app/api/group-messages
   ```