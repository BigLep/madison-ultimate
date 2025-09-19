# Stage 3: Player Portal Implementation Plan

## Overview
Build a Progressive Web App (PWA) player portal where students and families can view player information and mark availability for practices and games. This stage focuses on creating a clean, maintainable implementation using popular web frameworks and live data from Google Sheets.

## Key Requirements
- Simple login using last name + birth month/year (matching Portal Lookup Key formula)
- Mobile-first responsive design with desktop compatibility
- Progressive Web App with "Add to Home Screen" functionality
- 4 main screens: Season Info, Player Info, Practice Availability, Game Availability
- **Live data integration**: Always read fresh data from Google Sheets (no caching)
- Portal URLs using Player Portal ID from spreadsheet

## Verified Data Model

### Primary Data Source
**Google Sheets**: https://docs.google.com/spreadsheets/d/1ZZA5TxHu8nmtyNORm3xYtN5rzP3p1jtW178UgRcxLA8/edit?gid=267530468#gid=267530468

### Portal Columns (Verified Working)
- **Player Portal Lookup Key** (Column AQ/42):
  - Formula: `lowercase lastname + birth month (2 digits) + birth year (2 digits)`
  - Example: `smith0814` (for Smith born 08/14)
- **Player Portal ID** (Column AR/43):
  - Formula: `grade + first letter of last name + birth month + first letter of gender + birth year`
  - Example: `6s08f14` (grade 6, Smith, 08, female, 14)

### Core Player Data Available
- Student ID, Names (First, Last, Full)
- Grade, Gender, Date of Birth
- Final Forms status (parent signed, student signed, physical cleared)
- Parent contact information (2 parents with emails)
- Additional questionnaire data (pronouns, allergies, etc.)
- Player photos (download and thumbnail URLs)

## Technical Architecture

### API Strategy - Always Fresh Data
**New APIs Required:**
1. `POST /api/player/lookup` - Find player by lookup key (lastname + birth info)
2. `GET /api/player/[portalId]` - Get player details by portal ID

**API Design Principles:**
- Every API call reads fresh data from Google Sheets
- No server-side caching or data persistence
- Dynamic column discovery (no hardcoded column positions)
- Proper error handling for Google Sheets API failures

### Authentication Flow
1. `/player-portal` - Login form: last name, birth month (2 digits), birth year (2 digits)
2. `POST /api/player/lookup` constructs: `lastname.toLowerCase() + birthMonth + birthYear`
3. Live search in Google Sheets for "Player Portal Lookup Key" column match
4. Return corresponding "Player Portal ID" if found
5. Redirect to `/player-portal/[playerPortalId]`

### URL Structure
- `/player-portal` - Login page
- `/player-portal/[playerPortalId]` - Main portal dashboard
- Navigation between 4 screens within portal context

### Progressive Web App Features
- Web app manifest for "Add to Home Screen"
- Service worker for offline UI (data always fetched fresh when online)
- App-like experience on mobile devices
- Installation prompts and PWA features

## Implementation Tasks

### Phase 1: Core Player APIs
1. **Player Lookup API**
   - `POST /api/player/lookup` - Search by lastname + birth info
   - Use dynamic column discovery to find Portal Lookup Key column
   - Return Portal ID or error for failed matches

2. **Player Details API**
   - `GET /api/player/[portalId]` - Get full player record by Portal ID
   - Dynamic column mapping for all player data
   - Return structured player object with contact info

3. **Dynamic Column Discovery Utilities**
   - Extend existing roster metadata system
   - Find columns by name patterns (no hardcoded indexes)
   - Support flexible column ordering

### Phase 2: PWA Setup & Authentication
4. **PWA Configuration**
   - Add web app manifest with proper icons
   - Configure service worker for UI caching (not data)
   - Set up "Add to Home Screen" prompts
   - Test installation on mobile devices

5. **Login System**
   - Build responsive login form with validation
   - Implement lookup logic using live Google Sheets data
   - Add proper error handling and user feedback
   - Session management for portal access

### Phase 3: Portal Shell & Navigation
6. **Portal Layout Framework**
   - Create responsive portal shell using popular UI library
   - Implement mobile bottom navigation bar
   - Add desktop sidebar/top navigation
   - Portal header with live player info display

7. **Routing & State Management**
   - Set up Next.js App Router for portal screens
   - Implement state management for portal data
   - Handle loading states and error boundaries

### Phase 4: Portal Screens (Basic Implementation)
8. **Season Info and News Screen**
   - Static content area for announcements
   - Team schedule display (placeholder data)
   - Important dates and links
   - Responsive design for mobile/desktop

9. **Player Info Screen**
   - Display live player details from API
   - Show parent/guardian contact information
   - Final Forms status overview
   - Additional questionnaire data display

10. **Practice Availability Screen (Placeholder)**
    - Basic UI structure for future availability features
    - Calendar/list view placeholder
    - Note: Availability data storage deferred to later

11. **Game Availability Screen (Placeholder)**
    - Basic UI structure for future game availability
    - Calendar/list view placeholder
    - Note: Game data storage deferred to later

### Phase 5: Polish & Deployment
12. **UI Polish & Testing**
    - Responsive design refinements
    - Loading states and error handling
    - Cross-browser testing
    - Mobile device testing

13. **Deployment & Documentation**
    - Vercel deployment with PWA optimizations
    - Environment variable setup
    - Update documentation for portal usage

## Technical Stack & Dependencies

### Core Framework (Already Available)
- Next.js 15 with App Router ✓
- React 18 ✓
- TypeScript ✓
- Tailwind CSS ✓
- Google Sheets API integration ✓

### New Dependencies Required
- **PWA**: `next-pwa` for service worker and manifest
- **UI Framework**: `shadcn/ui` - Popular, well-maintained component library built on Radix UI
- **Forms**: React Hook Form for form validation
- **State Management**: React Context for portal state
- **Icons**: Lucide React (included with shadcn/ui)
- **Date Handling**: date-fns for date formatting

### Why shadcn/ui?
- **Industry Standard**: Used by Vercel, Linear, and thousands of projects
- **Not Bespoke**: Built on proven Radix UI primitives
- **Copy-Paste**: You own the code, no black-box dependencies
- **Tailwind Native**: Perfect integration with existing Tailwind setup
- **Accessibility**: Built-in ARIA support and keyboard navigation
- **TypeScript**: Full type safety out of the box

## API Endpoints Design

### Player Management APIs
```typescript
POST /api/player/lookup
Body: { lastName: string, birthMonth: string, birthYear: string }
Response: { success: boolean, playerPortalId?: string, error?: string }

GET /api/player/[portalId]
Response: {
  success: boolean,
  player?: {
    studentId: string,
    firstName: string,
    lastName: string,
    fullName: string,
    grade: number,
    gender: string,
    dateOfBirth: string,
    finalFormsStatus: {
      parentSigned: boolean,
      studentSigned: boolean,
      physicalCleared: boolean,
      allCleared: boolean
    },
    contacts: {
      parent1?: { firstName: string, lastName: string, email: string },
      parent2?: { firstName: string, lastName: string, email: string }
    },
    additionalInfo?: {
      pronouns: string,
      allergies: string,
      jerseySize: string,
      // ... other questionnaire fields
    },
    photos?: {
      download: string,
      thumbnail: string
    }
  },
  error?: string
}
```

## Success Criteria
1. ✅ All data is always fresh from Google Sheets (no caching)
2. ✅ PWA installs successfully on mobile devices
3. ✅ Login works with existing Portal Lookup Key formulas
4. ✅ Portal URLs work with existing Portal ID formulas
5. ✅ Player info displays correctly from live roster data
6. ✅ 4 portal screens are accessible and mobile-optimized
7. ✅ No hardcoded column positions (dynamic discovery)
8. ✅ Fast, responsive UI with proper loading states

## Out of Scope (For Later)
- Availability data storage and APIs
- Practice/game scheduling data
- Push notifications
- Coach admin interfaces
- Bulk messaging features

## Next Steps for Implementation
1. Create player lookup and details APIs with dynamic column discovery
2. Set up PWA configuration and manifest
3. Build login system using existing Portal Lookup Key column
4. Implement portal shell with responsive navigation
5. Create 4 portal screens with live player data integration