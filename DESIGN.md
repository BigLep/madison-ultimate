# Madison Ultimate App - Technical Design

This document outlines the technical implementation details, data processing pipeline, and architectural decisions for the Madison Ultimate signup tracking application.

## Core Design Philosophy: Family-Centric Multi-Player Support

### Primary Design Goal
A fundamental design principle of this application is to make it **easy for families to manage multiple players from the same household**. Many families have multiple children participating in Madison Ultimate, and the system is architected to accommodate this reality seamlessly.

### Family-Friendly Features

#### Player-Specific PWAs (Progressive Web Apps)
- **Individual App Installations**: Each player gets their own installable PWA with personalized naming
- **App Name Format**: "Madison Ultimate - [Player Name]" (e.g., "Madison Ultimate - [Full Name]")
- **Separate App Icons**: Each family member appears as a distinct app on home screens and app drawers
- **Independent Management**: Parents can install separate apps for each child, making it easy to switch between players

#### Dynamic Page Titles for Easy Bookmarking
- **Player-Specific Titles**: Browser tabs and bookmarks show "Madison Ultimate - [Player Name]"
- **Easy Identification**: When multiple tabs/bookmarks are open, parents can quickly identify which child's portal they're viewing
- **Bookmark Organization**: Browser bookmarks automatically organize by player name

#### Portal-Based Architecture
- **Unique URLs**: Each player has their own portal ID (e.g., `/player-portal/abc123`)
- **Direct Access**: Parents can bookmark or share direct links to specific player portals
- **Independent Sessions**: Multiple browser tabs can be open for different players simultaneously

### Technical Implementation

#### PWA Manifest Generation
- **Dynamic API**: `/api/manifest/[portalId]` generates player-specific manifests
- **Personalized Metadata**: Each app has unique name, short name, and start URL
- **Scoped Installation**: Each PWA is scoped to its specific player portal

#### Page Title Management
- **Dynamic Updates**: `document.title` changes based on logged-in player
- **Cleanup on Navigation**: Title resets when leaving player-specific areas
- **Bookmark-Friendly**: Consistent naming for easy identification

### User Experience Benefits

#### For Parents Managing Multiple Players
- **Clear Visual Separation**: Each child appears as a distinct app
- **Quick Switching**: Easy to jump between children's information
- **Reduced Confusion**: No accidental cross-player data entry
- **Mobile-Friendly**: Touch-optimized interface for parent devices

#### For Families with Multiple Players
- **Scalable Design**: Works equally well for 1 child or 5+ children
- **Independent Tracking**: Each player's availability, forms, and info managed separately
- **Shared Device Support**: Multiple family members can use the same device with distinct experiences

### Design Decisions Rationale

#### Why Player-Specific PWAs Instead of Multi-Player Dashboard?
- **Cognitive Load**: Separate apps reduce mental overhead when managing specific player's needs
- **Mobile UX**: Dedicated apps feel more native and focused on mobile devices
- **Future Notifications**: Player-specific push notifications become possible
- **Sharing**: Easy to share specific player's portal with other caregivers (grandparents, etc.)

#### Why Portal-Based URLs?
- **Bookmarkability**: Parents can bookmark each child's portal independently
- **Direct Links**: Coaches can send player-specific links
- **Security**: Portal IDs provide secure, unguessable access without complex authentication
- **Analytics**: Track usage patterns per player for future improvements

### Future Family-Centric Enhancements
- **Family Dashboard**: Optional overview showing all family players
- **Cross-Player Calendar**: Combined view of all children's games/practices
- **Batch Operations**: Update availability for multiple players simultaneously
- **Parent Notifications**: Push notifications about upcoming events for any family player

This family-centric approach ensures Madison Ultimate scales naturally with families and adapts to real-world usage patterns, reducing friction for busy parents managing multiple young athletes.

## Data Source Mapping

The application integrates data from three sources to create a comprehensive signup status report. Here's the exact mapping from source columns to report columns:

| Report Column | Data Source | Source Column | Data Type | Validation Logic |
|---------------|-------------|---------------|-----------|------------------|
| **Player First Name** | SPS Final Forms | `"First Name"` | String | Direct mapping |
| **Player Last Name** | SPS Final Forms | `"Last Name"` | String | Direct mapping |
| **Player Grade** | SPS Final Forms | `"Grade"` | String | Direct mapping |
| **Player Gender** | SPS Final Forms | `"Gender"` | String | Direct mapping |
| **Has Caretaker Signed Final Forms** | SPS Final Forms | `"Are All Forms Parent Signed"` | String → Boolean | `=== 'true'` |
| **Has Player Signed Final Forms** | SPS Final Forms | `"Are All Forms Student Signed"` | String → Boolean | `=== 'true'` |
| **Does Player Have a Cleared Physical** | SPS Final Forms | `"Physical Clearance"` | String → Boolean | `=== 'Cleared'` |
| **Has Caretaker filled out Questionnaire** | Additional Questionnaire | `"Player Name (First & Last)"` | String → Boolean | Fuzzy name matching (>80% confidence) |
| **Has Caretaker 1 joined Mailing List** | Final Forms → Team Mailing List | `"Parent 1 Email"` → `"Email address"` | String → Boolean | Exact email match |
| **Has Caretaker 2 joined Mailing List** | Final Forms → Team Mailing List | `"Parent 2 Email"` → `"Email address"` | String → Boolean | Exact email match |

## Technical Architecture

### Tech Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Google Service Account (server-side)
- **Data Sources**: Google Sheets API + Google Drive API
- **Deployment**: Vercel (https://madison-ultimate.vercel.app)

### Data Processing Pipeline

```
1. Data Fetching (with Caching)
   ├── SPS Final Forms (CSV from Google Drive)
   ├── Team Mailing List (CSV from Google Drive) 
   └── Additional Questionnaire (Google Sheets)
   └── Cache Manager handles all API calls

2. Data Parsing
   ├── CSV parsing with multi-line field handling
   ├── Boolean conversion from strings
   └── Email extraction and normalization

3. Data Integration
   ├── Primary key: Player name from Final Forms
   ├── Fuzzy name matching for questionnaire
   ├── Email matching for mailing list
   └── Status calculation per player

4. Caching & Output
   ├── Store processed data in /tmp/integrated-data.json
   ├── Background refresh every 30 minutes
   ├── Stale-while-revalidate strategy
   └── PlayerSignupStatus[] with completion flags
```

### Fuzzy Matching Algorithm

Uses Levenshtein distance for name matching:
- **Similarity calculation**: `(maxLength - distance) / maxLength`
- **Confidence threshold**: 80% for questionnaire matching
- **Weighting**: First name (30%) + Last name (70%)

### Data Models

#### Core Types
```typescript
interface PlayerSignupStatus {
  firstName: string;
  lastName: string;
  grade: string;
  gender: string;
  hasCaretakerSignedFinalForms: boolean;
  hasPlayerSignedFinalForms: boolean;
  hasPlayerClearedPhysical: boolean;
  hasCaretakerFilledQuestionnaire: boolean;
  hasCaretaker1JoinedMailingList: boolean;
  hasCaretaker2JoinedMailingList: boolean;
}
```

#### Source Data Types
```typescript
interface SPSFinalFormsRecord {
  playerFirstName: string;
  playerLastName: string;
  playerGrade: string;
  playerGender: string;
  caretaker1Email: string;
  caretaker2Email: string;
  parentsSignedStatus: boolean;
  studentsSignedStatus: boolean;
  physicalClearanceStatus: boolean;
}

interface MailingListRecord {
  email: string;
  name: string;
  joinedDate: string;
}

interface QuestionnaireRecord {
  playerFirstName: string;
  playerLastName: string;
  caretakerEmail: string;
  submissionTimestamp: string;
}
```

## Caching Strategy

### Simplified In-Memory Caching

The application uses a simple in-memory caching strategy optimized for Vercel's serverless environment:

#### **Cache Manager Features**
- **Cache Duration**: 2 minutes (hardcoded for optimal balance)
- **Storage Location**: In-memory Map (no disk persistence)
- **Refresh Strategy**: On-demand only (no background tasks)
- **Stale-While-Revalidate**: Serves stale cache if Google APIs fail
- **Force Refresh**: Debug endpoints trigger fresh data fetch

#### **Performance Characteristics**
- **Memory Cache Hit**: ~10-20ms response time
- **Cache Miss**: ~3-5 seconds (Google API calls + processing)
- **API Usage Reduction**: ~80-90% fewer Google API calls
- **Container Persistence**: Cache survives between requests when container is reused
- **Cold Start Behavior**: Fresh fetch on new container deployment

#### **Cache Behavior**
```
┌─────────────────┬──────────────────┬─────────────────┐
│ Scenario        │ Action           │ Response Time   │
├─────────────────┼──────────────────┼─────────────────┤
│ Memory hit      │ Serve from RAM   │ ~10-20ms       │
│ Cache expired   │ Fetch + cache    │ ~3-5 seconds   │
│ API failure     │ Serve stale      │ ~10-20ms       │
│ Cold start      │ Fresh fetch      │ ~3-5 seconds   │
│ Debug endpoint  │ Force refresh    │ ~3-5 seconds   │
└─────────────────┴──────────────────┴─────────────────┘
```

#### **Vercel Serverless Optimizations**
- **No Background Timers**: Eliminates unreliable setInterval() in serverless
- **No Disk I/O**: Avoids ephemeral file system writes
- **Container Reuse**: Leverages Vercel's container persistence when available
- **Fast Response**: 2-minute cache balances freshness with performance

## API Endpoints

### `/api/players` (Main Data API)
- **Purpose**: Serve integrated player signup data
- **Caching**: Uses in-memory cache with 2-minute expiry
- **Response**: Complete PlayerSignupStatus[] with statistics
- **Performance**: ~10-20ms (cached) / ~3-5s (fresh)

### Debug endpoints

These endpoints are for development and troubleshooting. Use them when roster columns, cache, or per-player data don’t match expectations.

#### `GET /api/debug` (Debug & force refresh)
- **Purpose**: Email matching analysis and force cache refresh; optionally roster lookup keys from the sheet
- **Query params**: `rosterKeys=1` — include `rosterLookupKeys: { source, count, keys[] }` (keys only, no names); `refresh=1` with `rosterKeys=1` forces sheet cache refresh before returning keys
- **Caching**: Always fetches fresh data and updates the in-memory cache
- **Response**: Debug data including matched/unmatched email breakdown; with `rosterKeys=1`, also roster lookup keys from the sheet for comparing to login
- **When to use**: Troubleshooting email matching or when you need to force the cache to refresh; use `?rosterKeys=1` to verify what lookup keys exist in the roster sheet

#### `GET /api/system/column-health` (Roster column validation)
- **Purpose**: Validate the roster sheet’s column headers against app expectations
- **Query params**: None
- **Response**: `columnHealth` with `isValid`, `errorMessage`, `summary` (counts of required/optional/missing/extra), `details` (e.g. `missingRequired`, `missingOptional`, `extraColumns`, `portalColumns`), and `availableColumns` (first 50). No per-player data is returned.
- **When to use**: After changing the roster sheet or column names; confirms required and portal columns are present and shows which optional columns are missing or extra

#### `GET /api/debug/player-row?portalId=...` (Single-player raw row)
- **Purpose**: Return the actual column names and one player’s row values keyed by column name
- **Query params**: `portalId` (required) — the player’s portal ID from the roster
- **Response**: `columnNames`, `rowByColumn` (column name → value for that player), `columnCount`
- **When to use**: Debugging a specific player’s data (e.g. missing pronouns, contacts, or allergies); compare `rowByColumn` to what the app expects to find header or value mismatches

#### `GET /api/debug/lookup?firstName=...&lastName=...&birthMonth=...&birthYear=...` (Login key check)
- **Purpose**: Compute the login lookup key for the given name/DOB and report whether it matches a roster row (spaces in names are normalized when matching)
- **Query params**: `firstName`, `lastName`, `birthMonth` (2 digits), `birthYear` (2 or 4 digits)
- **Response**: `lookupKeyComputed`, `found`, optional `playerPortalId`; no other player data
- **When to use**: Verifying why a login failed; compare `lookupKeyComputed` to the roster’s Portal Lookup Key column (e.g. via `GET /api/debug?rosterKeys=1`)

## Data Source Details

### 1. SPS Final Forms (Google Drive CSV)
- **Location**: Google Drive folder `1SnWCxDIn3FxJCvd1JcWyoeoOMscEsQcW`
- **Format**: CSV export with 50 columns
- **Key Fields**: Student info, parent emails, form completion status
- **Special Handling**: Multi-line sports field, string boolean values

### 2. Team Mailing List (Google Drive CSV)
- **Location**: Google Drive folder `1pAeQMEqiA9QdK9G5yRXsqgbNVzEU7R1E`
- **Format**: CSV with header line to skip
- **Key Fields**: Email addresses, join dates, member status
- **Special Handling**: Remove "Members for group..." header line

### 3. Additional Questionnaire (Google Sheets)
- **Location**: Google Sheet `1f_PPULjdg-5q2Gi0cXvWvGz1RbwYmUtADChLqwsHuNs`
- **Format**: Live Google Sheets with form responses
- **Key Fields**: Player name, questionnaire responses
- **Special Handling**: Parse combined "First & Last" name field

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── players/route.ts             # Main data API (cached)
│   │   └── debug/route.ts               # Debug API (force refresh)
│   ├── debug/page.tsx                   # Debug UI for email analysis
│   ├── layout.tsx                       # Next.js app layout
│   └── page.tsx                         # Home page with signup table
├── lib/
│   ├── cache-manager.ts                 # Server-side caching with background refresh
│   ├── google-api.ts                    # Google APIs integration
│   ├── data-processing.ts               # CSV parsing & data integration
│   ├── date-utils.ts                    # Pacific timezone formatting
│   ├── privacy.ts                       # Student name obfuscation
│   └── types.ts                         # TypeScript type definitions
├── components/
│   └── SignupStatusTable.tsx            # Main UI component with responsive design
```

## Environment Configuration

### Local Development (.env.local)
```bash
# Google API Configuration (choose one method)
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./.google-service-account.json  # File path method
# OR
# GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}      # Direct JSON method

# Data Source IDs
ADDITIONAL_QUESTIONNAIRE_SHEET_ID=1f_PPULjdg-5q2Gi0cXvWvGz1RbwYmUtADChLqwsHuNs
SPS_FINAL_FORMS_FOLDER_ID=1SnWCxDIn3FxJCvd1JcWyoeoOMscEsQcW
TEAM_MAILING_LIST_FOLDER_ID=1pAeQMEqiA9QdK9G5yRXsqgbNVzEU7R1E
ROSTER_SHEET_ID=1ZZA5TxHu8nmtyNORm3xYtN5rzP3p1jtW178UgRcxLA8
```

### Vercel Deployment Environment Variables
Required environment variables for production deployment:

| Variable | Description | Value | Required |
|----------|-------------|-------|----------|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | **Recommended**: Direct JSON credentials for easy copy/paste | Complete JSON content from `.google-service-account.json` | Choose one |
| `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` | Alternative: File path to credentials (not recommended for Vercel) | Path to service account file | Choose one |
| `ADDITIONAL_QUESTIONNAIRE_SHEET_ID` | Google Sheet ID for questionnaire responses | `1f_PPULjdg-5q2Gi0cXvWvGz1RbwYmUtADChLqwsHuNs` | ✅ Yes |
| `SPS_FINAL_FORMS_FOLDER_ID` | Google Drive folder ID for SPS Final Forms CSV | `1SnWCxDIn3FxJCvd1JcWyoeoOMscEsQcW` | ✅ Yes |
| `TEAM_MAILING_LIST_FOLDER_ID` | Google Drive folder ID for mailing list CSV | `1pAeQMEqiA9QdK9G5yRXsqgbNVzEU7R1E` | ✅ Yes |
| `ROSTER_SHEET_ID` | **Stage 2**: Google Sheet ID for roster synthesis | `1ZZA5TxHu8nmtyNORm3xYtN5rzP3p1jtW178UgRcxLA8` | ✅ Yes |

#### **Google Service Account Authentication Methods**

**Method 1 (Recommended for Vercel): Direct JSON Content**
1. Navigate to Vercel project settings: Environment Variables
2. Copy JSON to clipboard: `jq -c . .google-service-account.json | pbcopy`
3. Create variable `GOOGLE_SERVICE_ACCOUNT_KEY` and paste the content

**Method 2 (Local Development): File Path**
1. Set `GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./.google-service-account.json`

**Configuration Steps:**
1. Navigate to Vercel project settings: Environment Variables
2. Run `jq -c . .google-service-account.json | pbcopy`
3. Add `GOOGLE_SERVICE_ACCOUNT_KEY` variable and paste
4. Add the three data source ID variables

## Deployment

### Vercel Production Deployment
The application is deployed on Vercel with the following configuration:

- **Production URL**: https://madison-ultimate.vercel.app
- **Build Command**: `npm run build` 
- **Framework**: Next.js 15 with App Router
- **Function Timeout**: 60 seconds (configured for Google API calls)

#### Deployment Process
```bash
# 1. Build and test locally
npm run build

# 2. Deploy to Vercel
vercel --prod --yes

# 3. Configure environment variables in Vercel dashboard
# Navigate to: Project Settings → Environment Variables
```

#### Vercel Configuration (vercel.json)
```json
{
  "version": 2,
  "framework": "nextjs", 
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "functions": {
    "src/app/api/*/route.ts": {
      "maxDuration": 60
    }
  }
}
```

**Note**: Cron jobs removed due to Hobby plan limitations. Cache uses on-demand refresh only (no background timers in serverless).

## Current Status (Production Ready)

✅ **Data Integration Pipeline**: Fully functional with real data processing
✅ **Google APIs**: Authenticated and tested with all 3 sources
✅ **Server-Side Caching**: 2-minute in-memory cache with on-demand refresh (optimized for serverless)
✅ **UI Components**: Responsive signup table with mobile/desktop views
✅ **Privacy Protection**: Student name obfuscation (e.g., "First L.")
✅ **Debug Tools**: Email matching analysis and cache diagnostics
✅ **Performance Optimized**: ~10-20ms response times via caching
✅ **Production Features**:
  - Data source timestamps in Pacific timezone
  - Stale-while-revalidate for reliability
  - Comprehensive statistics and progress tracking
  - Mobile-first responsive design
  - First name alphabetical sorting
✅ **Deployment**: Successfully deployed to Vercel production environment

🚀 **Production Status**: Live at https://madison-ultimate.vercel.app

## Stage 3: Player Portal UI Framework Decision

### Selected Framework: shadcn/ui

For the Stage 3 Player Portal implementation, we selected **shadcn/ui** as our primary UI component library. This decision prioritizes maintainability, industry standards, and long-term sustainability.

#### Why shadcn/ui?

**1. Industry Standard & Proven Track Record**
- Used by major companies: Vercel, Linear, Resend, and thousands of open-source projects
- Over 40,000 GitHub stars with active development
- Trusted by enterprise and startup teams alike

**2. Not Bespoke - Built on Proven Foundations**
- Built on **Radix UI primitives** (the gold standard for accessible React components)
- Uses **Tailwind CSS** (which we already use in the project)
- Leverages **class-variance-authority** for component variants
- No custom framework - just industry-standard building blocks

**3. Copy-Paste Architecture (You Own the Code)**
- Components are copied directly into your codebase (`src/components/ui/`)
- No runtime dependencies or black-box libraries
- Full control over customization and modifications
- Never locked into a framework - you own the components

**4. Perfect Integration with Existing Stack**
- Native Tailwind CSS integration (no CSS-in-JS conflicts)
- TypeScript-first with full type safety
- Next.js App Router compatible
- Works seamlessly with existing project structure

**5. Accessibility & Mobile-First**
- Built-in ARIA support and keyboard navigation
- Screen reader optimized
- Mobile-responsive by default
- Follows WAI-ARIA guidelines

**6. Developer Experience**
- Excellent documentation with copy-paste examples
- CLI tools for easy component installation
- Consistent API patterns across all components
- Hot-reloading and dev tools support

#### Alternatives Considered & Why They Were Rejected

**Material-UI (MUI)**
- ❌ Heavy bundle size (200kb+ runtime)
- ❌ Google Material Design doesn't fit our app aesthetic
- ❌ Complex theming system with CSS-in-JS overhead
- ❌ Runtime styling performance impact

**Ant Design**
- ❌ Enterprise-focused design language (too corporate)
- ❌ Large bundle size and Chinese company dependencies
- ❌ Less flexibility for custom styling
- ❌ Desktop-first design approach

**Mantine**
- ✅ Good alternative with similar philosophy
- ❌ Smaller community and ecosystem
- ❌ Less battle-tested in production environments
- ❌ More opinionated styling approach

**Chakra UI**
- ✅ Good developer experience
- ❌ CSS-in-JS performance overhead
- ❌ Less momentum in the React community
- ❌ More complex setup with Next.js App Router

**Headless UI + Custom Components**
- ✅ Maximum flexibility
- ❌ Requires significant custom development time
- ❌ Reinventing the wheel for common patterns
- ❌ Inconsistent design system without significant effort

#### Technical Implementation Strategy

**Component Installation Pattern**
```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add form
npx shadcn-ui@latest add navigation-menu
```

**File Structure**
```
src/
├── components/
│   ├── ui/                    # shadcn/ui components (copy-paste)
│   │   ├── button.tsx
│   │   ├── form.tsx
│   │   └── navigation-menu.tsx
│   └── portal/                # Custom portal components
│       ├── player-info.tsx
│       ├── availability-calendar.tsx
│       └── portal-navigation.tsx
```

**Customization Strategy**
- Modify copied components directly for project-specific needs
- Use Tailwind CSS custom classes for brand colors and spacing
- Extend component variants using class-variance-authority patterns
- Maintain consistency with existing project styling

#### Long-term Maintainability

**Why This Choice Supports Maintainability:**
1. **Industry Standard**: Easy to find developers familiar with shadcn/ui
2. **No Vendor Lock-in**: Components live in your codebase
3. **Gradual Migration**: Can replace individual components as needed
4. **Community Support**: Large ecosystem and extensive documentation
5. **Future-Proof**: Built on stable, well-maintained foundations

**Risk Mitigation:**
- No runtime dependencies means no breaking changes from external updates
- Copy-paste architecture allows incremental improvements
- Tailwind CSS ensures styling remains maintainable
- TypeScript provides compile-time safety for component APIs

This decision aligns with the project requirement to use "popular, common web frameworks" while avoiding bespoke solutions. shadcn/ui provides the perfect balance of functionality, maintainability, and industry adoption for the Madison Ultimate Player Portal.

## Player Authentication & Identification

### Portal ID vs Player Name Lookup Strategy

The application uses a hybrid approach for player identification to balance security and simplicity:

#### Initial Portal Access
- **Route**: `/player-portal/{playerPortalId}`
- **Method**: Portal ID lookup via `findPortalEntryByPortalId()`
- **Purpose**: Secure initial authentication to verify the player has access
- **Data Source**: Portal cache (roster sheet Portal columns)

#### Subsequent API Calls
- **Routes**: `/api/practice/{portalId}` (POST), `/api/other-features/{portalId}` (POST)
- **Method**: Full name passed in request body
- **Purpose**: Direct sheet operations without repeated portal cache lookups
- **Rationale**: This is a casual webapp - simplicity over robustness

#### Design Benefits
1. **Security**: Portal ID required for initial access
2. **Simplicity**: POST requests use human-readable full names
3. **Performance**: Avoids portal cache lookups on every mutation
4. **Maintainability**: Clear separation between authentication and operations

#### Example Flow
```
1. User visits: /player-portal/{portalId}
2. System validates portal ID → finds player
3. User submits practice availability
4. Frontend sends: { fullName: "<player full name>", availability: "👍 Planning to be there" }
5. Backend finds player in Practice Availability sheet
```

### Data Sources for Player Portal

#### Portal Cache
- **Source**: Roster sheet Portal columns (Lookup Key, Portal ID)
- **Purpose**: Map portal IDs to player lookup keys
- **Usage**: Initial authentication only

#### Player Data
- **Source**: Full roster sheet via `/api/player/{portalId}`
- **Purpose**: Complete player information
- **Usage**: Displaying player details

#### Practice Availability
- **Source**: Practice Availability sheet
- **Key**: Full Name column
- **Purpose**: Store and retrieve practice attendance responses

#### Game coach notes (plain text today; future: hyperlinks)

- **Source**: Game Info sheet / season config flows into the game API as `gameNote` (see game route helpers).
- **Current UI**: On the Game Availability portal screen, coach notes render as plain text: `Coach note: {game.gameNote}` in `src/app/player-portal/[portalId]/page.tsx` (upcoming and past game cards).
- **Limitation**: If a coach pastes a long URL (e.g. bracket spreadsheet), families see the full string instead of a short, accessible label (e.g. “See bracket”) or a single tappable link with sensible link text.
- **Future idea — hyperlink rendering**:
  1. **Auto-link URLs**: Detect `http(s)://…` in the note and render each as an `<a>` with `rel="noopener noreferrer"` and `target="_blank"` (and optionally truncate display text with ellipsis while keeping `href` full).
  2. **Optional labeled links**: Support a small, documented convention in the sheet (e.g. markdown `[label](url)` or `label|url` on its own line) so coaches can supply readable labels without raw URLs in prose.
  3. **Safety**: Sanitize or strictly whitelist tags so we never execute arbitrary HTML from the sheet; prefer linkifying + escaping over full rich HTML.
  4. **Scope**: Apply the same treatment anywhere portal-facing free text from coaches might include URLs (game notes first; extend if other fields gain long links).

### Authentication Philosophy for Player Portal

This is designed as a casual team management app, not a high-security system. The portal ID serves as a simple access token - if you have the URL, you can access that player's portal. This design prioritizes:

- **Ease of use**: Parents/players just need to bookmark their portal URL
- **Simplicity**: Minimal authentication overhead
- **Maintainability**: Straightforward troubleshooting and support

For a production system requiring higher security, consider implementing proper user accounts, sessions, and role-based access control.

## Date Formatting Standards

### Centralized Date Formatting Strategy

The application uses a consistent date formatting approach to eliminate user confusion about event timing:

#### Design Decision: Always Include Day of Week
- **Problem**: Dates like "September 23" don't indicate which day of the week the event occurs
- **Solution**: Always display as "Tuesday, September 23" format
- **Implementation**: Centralized utilities in `/src/lib/date-formatters.ts`

#### Available Formatters
- `formatFullDate()` - **Primary**: "Tuesday, September 23"
- `formatShortDate()` - **Mobile/limited space**: "Tue, Sep 23"
- `formatFullDateWithYear()` - **Cross-year events**: "Tuesday, September 23, 2024"

#### Usage Pattern
```typescript
import { formatFullDate } from '@/lib/date-formatters';

// Practice dates
const practiceDate = formatFullDate("9/23"); // "Tuesday, September 23"

// Game dates (upcoming)
const gameDate = formatFullDate("10/5"); // "Saturday, October 5"
```

#### Benefits
1. **User Clarity**: Parents/players immediately know which day events occur
2. **Consistency**: Same format across practices, games, and all features
3. **Maintainability**: Single source of truth for date formatting logic
4. **Mobile-Friendly**: Short format available when space is constrained

This standardization is especially important for sports scheduling where day-of-week matters significantly for planning attendance.

## PWA Icon Management

### Files That Need to Change When Updating PWA Icons

When updating the application's PWA (Progressive Web App) icons, the following files require updates to ensure icons display correctly across all platforms and contexts:

#### 1. PWA Manifest Generation
**File**: `src/app/api/manifest/[portalId]/route.ts`
- **Purpose**: Generates player-specific PWA manifests
- **Icon References**: Array of icon objects with src, sizes, type, and purpose
- **Platform Focus**: Android launcher icons (typically 48x48 to 512x512)
- **Cache Busting**: Increment `MANIFEST_VERSION` to force browser refresh

#### 2. Next.js Layout Metadata
**File**: `src/app/layout.tsx`
- **Purpose**: Global favicon and Apple touch icons via Next.js metadata API
- **Icon References**: `metadata.icons.icon` (favicon) and `metadata.icons.apple` (iOS)
- **Platform Focus**: Browser favicons (16x16, 32x32) and iOS (180x180)

#### 3. PWA Install Banner Component
**File**: `src/components/pwa-install-banner.tsx`
- **Purpose**: Custom install prompt with app icon preview
- **Icon Reference**: Direct `src` attribute in `<img>` tag
- **Platform Focus**: Small preview icon (typically 60x60 for 40px container)

#### 4. Player Portal Dynamic Meta Tags
**File**: `src/app/player-portal/[portalId]/page.tsx`
- **Purpose**: Dynamically sets apple-touch-icon for iOS
- **Icon Reference**: `appleTouchIcon.href = "/path/to/icon.png"`
- **Platform Focus**: iOS apple-touch-icon (180x180)

#### Best Practices for Icon Updates

**Icon Size Requirements by Platform:**
- **Favicons**: 16x16, 32x32, 192x192
- **Apple Touch Icons**: 180x180 (primary), also 120x120, 152x152, 167x167
- **Android PWA**: 48x48, 72x72, 96x96, 144x144, 192x192, 512x512
- **Windows**: Various sizes from 44x44 to 1240x1240

**Update Process:**
1. Generate comprehensive icon set (use artwork/MadisonUltimateDiscLogo as reference)
2. Copy icons to `public/icons/` directory with organized subfolders
3. Update all four file locations listed above
4. Increment manifest version to force PWA cache refresh
5. Test across devices/browsers to verify icon display

**Cache Busting Strategy:**
- Increment `MANIFEST_VERSION` in manifest route
- Add version query parameters to icon URLs if needed
- Clear browser cache during testing

**iOS/Apple Special Treatment:**
- **Apple Touch Icons**: iOS ignores PWA manifest icons and requires separate apple-touch-icon meta tags
- **Required Sizes**: 180x180 (primary), 152x152 (iPad), 167x167 (iPad Pro), 120x120 (iPhone retina)
- **Safari Quirks**: iOS Safari caches apple-touch-icons aggressively - may need cache busting
- **PWA vs Browser**: Different icon requirements for PWA vs Safari browser bookmarks
- **Multiple Declarations**: iOS requires both layout.tsx metadata AND dynamic meta tags in player portal
- **Format Requirements**: iOS prefers PNG format, will convert SVG but may not cache properly

**Common Pitfalls:**
- Missing icon size for specific platforms
- Inconsistent icon paths across files
- Forgetting to increment manifest version
- Using wrong image format (prefer PNG for icons)
- Hardcoded paths that don't match actual file locations
- **iOS-Specific**: Not setting both static (layout.tsx) and dynamic (player portal) apple-touch-icons
- **iOS-Specific**: Using only PWA manifest icons without separate Apple meta tags
- **iOS-Specific**: Wrong apple-touch-icon sizes causing blurry icons on different iOS devices

## Development Best Practices

### Sheet Data Column Mapping

**CRITICAL RULE: Never use hardcoded column positions**

❌ **Wrong Approach:**
```typescript
// This breaks when columns are added/removed/reordered
const playerName = row[0];
const grade = row[1];
const team = row[2];
const availability = row[3 + (i - 1) * 2]; // Fragile calculation
```

✅ **Correct Approach:**
```typescript
// Use dynamic header discovery
const columnMapping = {};
headerRow.forEach((header, index) => {
  columnMapping[header.toString().trim()] = index;
});

const playerName = row[columnMapping['Full Name']];
const grade = row[columnMapping['Grade']];
const team = row[columnMapping['Team']]; // Works even if Team column added later
```

**Why This Matters:**
- Google Sheets are frequently modified by coaches/administrators
- Adding columns like "Team" shifts all subsequent column positions
- Hardcoded indices cause availability tracking to write to wrong columns
- Dynamic discovery makes the system resilient to sheet structure changes

**Implementation Pattern:**
1. Always fetch header row first to create column mapping
2. Use column names (e.g., "9/23", "9/23 Note") to find data columns
3. Handle missing columns gracefully with warnings/errors
4. Use shared helpers like `findDateColumns()` for common patterns

**Files Using This Pattern:**
- `src/lib/availability-helper.ts` - Shared column discovery utilities
- `src/lib/practice-availability-helper.ts` - Practice-specific implementation
- `src/lib/game-availability-helper.ts` - Game-specific implementation
- `src/lib/column-validation.ts` - Validates expected columns exist

## Known Issues & Future Improvements

### Gmail OAuth Token Expiration

**Current Issue:**
The Gmail OAuth refresh token (`GMAIL_REFRESH_TOKEN`) requires manual regeneration approximately once per week, creating maintenance overhead.

**Problem Details:**
- **Frequency**: Token expires roughly every 7 days
- **Symptom**: Gmail API calls fail with `invalid_grant` errors
- **Current Workaround**: Manual OAuth flow re-authentication via `/api/auth/gmail` endpoint
- **Impact**: Requires administrator intervention to regenerate and update environment variable

**Possible Root Causes:**
1. **Google OAuth App Testing Mode**: If the OAuth app is in "Testing" status (not "Published"), refresh tokens expire after 7 days
2. **Refresh Token Rotation**: Google may be rotating refresh tokens, but we're not capturing the new token
3. **API Scope Changes**: Changes to requested scopes invalidate existing tokens
4. **Account Security Policies**: Google Workspace security settings may enforce shorter token lifetimes

**Future Solution Options:**

**Option 1: Publish OAuth App (Recommended)**
- Move OAuth app from "Testing" to "Published" status in Google Cloud Console
- Published apps have refresh tokens that don't expire (unless revoked)
- Requires OAuth app verification if requesting sensitive scopes
- Best long-term solution for production use

**Option 2: Automated Token Refresh & Storage**
- Implement automatic token refresh detection and storage
- Capture new refresh tokens when Google rotates them
- Store tokens in environment variable management system (Vercel API)
- Requires additional infrastructure and error handling

**Option 3: Service Account for Gmail (If Possible)**
- Use Google Workspace service account with domain-wide delegation
- No token expiration or manual OAuth flows
- Requires Google Workspace admin access and domain-wide delegation setup
- May not be possible depending on account type

**Temporary Workaround (Current Implementation):**
1. Visit production OAuth URL: `https://madison-ultimate.vercel.app/api/auth/gmail`
2. Complete Google OAuth consent flow
3. Copy refresh token from callback page
4. Update `GMAIL_REFRESH_TOKEN` in Vercel environment variables
5. Tokens valid for ~7 days before requiring regeneration

**Related Files:**
- `src/lib/gmail-oauth.ts` - OAuth client and token management
- `src/lib/gmail-api.ts` - Gmail API integration using refresh token
- `src/app/api/auth/gmail/route.ts` - OAuth authorization URL endpoint
- `src/app/api/auth/callback/route.ts` - OAuth callback handler

**Priority**: Medium - System is functional but requires regular manual maintenance