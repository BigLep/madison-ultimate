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
1. Data Fetching
   ├── SPS Final Forms (CSV from Google Drive)
   ├── Team Mailing List (CSV from Google Drive) 
   └── Additional Questionnaire (Google Sheets)

2. Data Parsing
   ├── CSV parsing with multi-line field handling
   ├── Boolean conversion from strings
   └── Email extraction and normalization

3. Data Integration
   ├── Primary key: Player name from Final Forms
   ├── Fuzzy name matching for questionnaire
   ├── Email matching for mailing list
   └── Status calculation per player

4. Output Generation
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

## API Endpoints

### `/api/test-google`
- **Purpose**: Validate Google APIs connection
- **Response**: Connection status for all 3 data sources
- **Usage**: Development/debugging

### `/api/test-data-processing` 
- **Purpose**: End-to-end data processing pipeline test
- **Response**: Processed player records with completion stats
- **Usage**: Validate data integration logic

### `/api/cache-data`
- **Purpose**: Download and cache data sources locally
- **Response**: File paths and sizes for cached data
- **Usage**: Development efficiency for debugging

### `/api/debug-mailing-list`
- **Purpose**: Debug mailing list CSV parsing issues
- **Response**: Raw vs parsed mailing list data comparison
- **Usage**: Troubleshooting data parsing

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
│   │   ├── test-google/route.ts         # API connectivity tests
│   │   ├── test-data-processing/route.ts # Integration pipeline test
│   │   ├── cache-data/route.ts          # Local data caching
│   │   └── debug-mailing-list/route.ts  # Mailing list debugging
│   ├── layout.tsx                       # Next.js app layout
│   └── page.tsx                         # Home page
├── lib/
│   ├── google-api.ts                    # Google APIs integration
│   ├── data-processing.ts               # CSV parsing & data integration
│   └── types.ts                         # TypeScript type definitions
└── components/                          # UI components (planned)
```

## Environment Configuration

```bash
# Google API Configuration
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./.google-service-account.json

# Data Source IDs
ADDITIONAL_QUESTIONNAIRE_SHEET_ID=1f_PPULjdg-5q2Gi0cXvWvGz1RbwYmUtADChLqwsHuNs
SPS_FINAL_FORMS_FOLDER_ID=1SnWCxDIn3FxJCvd1JcWyoeoOMscEsQcW
TEAM_MAILING_LIST_FOLDER_ID=1pAeQMEqiA9QdK9G5yRXsqgbNVzEU7R1E
```

## Current Status (Phase 2 Complete)

✅ **Data Integration Pipeline**: Fully functional with real data processing  
✅ **Google APIs**: Authenticated and tested with all 3 sources  
✅ **Data Validation**: 72 players processed with accurate completion stats  
📝 **Next Phase**: UI component development for signup status table