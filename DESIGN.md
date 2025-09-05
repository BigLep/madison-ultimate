# Madison Ultimate App - Technical Design

This document outlines the technical implementation details, data processing pipeline, and architectural decisions for the Madison Ultimate signup tracking application.

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
- **Deployment**: Vercel (planned)

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

### Server-Side Caching with Background Refresh

The application implements a sophisticated caching strategy to minimize Google API calls and provide fast page loads:

#### **Cache Manager Features**
- **Cache Duration**: 30 minutes (configurable via `CACHE_DURATION_MINUTES`)
- **Storage Location**: `/tmp/integrated-data.json` (disk-based)
- **Background Refresh**: Automatic every 30 minutes
- **Stale-While-Revalidate**: Serves stale cache if Google APIs fail
- **Force Refresh**: Debug endpoints trigger fresh data fetch

#### **Performance Characteristics**
- **Cache Hit**: ~50-100ms response time (disk read)
- **Cache Miss**: ~3-5 seconds (Google API calls)
- **API Usage Reduction**: ~95% fewer Google API calls
- **Graceful Degradation**: Continues serving stale data during API outages

#### **Cache Behavior**
```
┌─────────────────┬──────────────────┬─────────────────┐
│ Scenario        │ Action           │ Response Time   │
├─────────────────┼──────────────────┼─────────────────┤
│ Fresh cache     │ Serve from cache │ ~50-100ms      │
│ Expired cache   │ Fetch + cache    │ ~3-5 seconds   │
│ API failure     │ Serve stale      │ ~50-100ms      │
│ No cache + fail │ Return error     │ ~3-5 seconds   │
│ Debug endpoint  │ Force refresh    │ ~3-5 seconds   │
└─────────────────┴──────────────────┴─────────────────┘
```

## API Endpoints

### `/api/players` (Main Data API)
- **Purpose**: Serve integrated player signup data
- **Caching**: Uses cache manager with 30-minute expiry
- **Response**: Complete PlayerSignupStatus[] with statistics
- **Performance**: ~50ms (cached) / ~3-5s (fresh)

### `/api/debug` (Debug & Force Refresh)
- **Purpose**: Email matching analysis + force cache refresh
- **Caching**: Always fetches fresh data and updates cache
- **Response**: Matched/unmatched email breakdown
- **Usage**: Troubleshooting email matching issues

### Legacy Endpoints (Deprecated)
- `/api/test-google` - Replaced by cache manager
- `/api/test-data-processing` - Replaced by main data pipeline  
- `/api/cache-data` - Replaced by automatic caching
- `/api/debug-mailing-list` - Replaced by `/api/debug`

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
└── tmp/
    └── integrated-data.json             # Cached data (30min expiry)
```

## Environment Configuration

```bash
# Google API Configuration
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./.google-service-account.json

# Data Source IDs
ADDITIONAL_QUESTIONNAIRE_SHEET_ID=1f_PPULjdg-5q2Gi0cXvWvGz1RbwYmUtADChLqwsHuNs
SPS_FINAL_FORMS_FOLDER_ID=1SnWCxDIn3FxJCvd1JcWyoeoOMscEsQcW
TEAM_MAILING_LIST_FOLDER_ID=1pAeQMEqiA9QdK9G5yRXsqgbNVzEU7R1E

# Cache Configuration
CACHE_DURATION_MINUTES=30
```

## Current Status (Production Ready)

✅ **Data Integration Pipeline**: Fully functional with real data processing  
✅ **Google APIs**: Authenticated and tested with all 3 sources  
✅ **Server-Side Caching**: 30-minute cache with background refresh  
✅ **UI Components**: Responsive signup table with mobile/desktop views  
✅ **Privacy Protection**: Student name obfuscation (e.g., "Bob F.")  
✅ **Debug Tools**: Email matching analysis and cache diagnostics  
✅ **Performance Optimized**: ~50ms response times via caching  
✅ **Production Features**: 
  - Data source timestamps in Pacific timezone
  - Stale-while-revalidate for reliability  
  - Comprehensive statistics and progress tracking
  - Mobile-first responsive design
  - First name alphabetical sorting
  
🚀 **Ready for Deployment**: All core features implemented and tested