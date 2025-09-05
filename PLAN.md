# Madison Ultimate App - Stage 1 Implementation Plan

## Overview
Building a web application to track signup progress for Madison Middle School ultimate frisbee players. Stage 1 focuses on creating a comprehensive signup status dashboard.

## Stage 1: Signup Steps Reporting

### Goal
Create a nicely formatted table showing player signup progress across multiple data sources with columns:
- Player First Name, Last Name, Grade, Gender
- Has Caretaker Signed Final Forms
- Has Player Signed Final Forms  
- Does Player Have a Cleared Physical
- Has a Caretaker filled out the "Additional Questionnaire for Coaches"
- Has Caretaker 1/2 joined the "Team Mailing List"

### Data Sources Analysis
1. **SPS Final Forms**: Google Drive exports with player and caretaker info (3 stages: Parents Signed, Students Signed, Physical Clearance)
2. **Additional Questionnaire**: Google Sheets with coach questionnaire responses
3. **Team Mailing List**: Google Drive exports of mailing list members

### Technical Architecture

#### Tech Stack
- **Framework**: Next.js 14 with App Router (modern, SSR, easy Vercel deployment)
- **Styling**: Tailwind CSS (mobile-first responsive design)
- **Data Integration**: Google Sheets API + Google Drive API
- **Authentication**: Google OAuth (for accessing private sheets/drive)
- **Deployment**: Vercel (free tier, automatic deployments)
- **Development**: Local npm server with hot reload

#### Data Processing Strategy
1. **Join Keys**: Primary on player name, fallback to email addresses
2. **Fuzzy Matching**: Implement string similarity algorithms for name variations
3. **Translation Layer**: Manual mapping table for known mismatches
4. **Data Refresh**: Periodic fetch from Google APIs (consider caching strategy)

### Implementation Plan

#### Phase 1: Project Setup
- [ ] Initialize Next.js project with TypeScript
- [ ] Configure Tailwind CSS for mobile-first design
- [ ] Set up Google APIs (Sheets + Drive) integration
- [ ] Configure environment variables and authentication
- [ ] Set up development scripts and conventional commits

#### Phase 2: Data Integration
- [ ] Implement Google Drive file fetching (latest exports by timestamp)
- [ ] Implement Google Sheets API integration
- [ ] Create data models/types for each source
- [ ] Build CSV parsing utilities for Final Forms and Mailing List exports
- [ ] Implement fuzzy matching algorithms (Levenshtein distance, Jaro-Winkler)

#### Phase 3: Data Processing Engine
- [ ] Create join logic across all three data sources
- [ ] Implement fuzzy name matching with confidence scores
- [ ] Build translation layer for known name variations
- [ ] Create unified player status calculation
- [ ] Add data validation and error handling

#### Phase 4: UI Components
- [ ] Build responsive signup status table component
- [ ] Implement search/filter functionality
- [ ] Add sorting capabilities by any column
- [ ] Create mobile-optimized card view as table alternative
- [ ] Add progress indicators and status badges

#### Phase 5: Polish & Deployment
- [ ] Implement error boundaries and loading states
- [ ] Add refresh mechanisms for data updates
- [ ] Configure production environment variables
- [ ] Deploy to Vercel with custom domain
- [ ] Test mobile responsiveness across devices
- [ ] Document usage and maintenance procedures

### File Structure
```
madison-ultimate/
├── src/
│   ├── app/                    # Next.js app router
│   ├── components/             # Reusable UI components
│   ├── lib/                    # Utilities and API integrations
│   │   ├── google-api.ts       # Google Sheets/Drive integration
│   │   ├── data-processing.ts  # Join logic and fuzzy matching
│   │   └── types.ts            # TypeScript definitions
│   └── styles/                 # Global styles
├── public/                     # Static assets
├── PLAN.md                     # This file
├── README.md                   # Setup and usage documentation
└── package.json                # Dependencies and scripts
```

### Risk Mitigation
1. **Data Quality**: Implement robust fuzzy matching and manual override capabilities
2. **API Limits**: Cache data and implement incremental updates
3. **Authentication**: Handle OAuth flows gracefully with proper error handling
4. **Mobile Performance**: Optimize for slow networks and smaller screens
5. **Data Privacy**: Ensure proper access controls and no data leakage

### Success Criteria
- [ ] Table displays all required columns with accurate data
- [ ] Mobile-friendly responsive design works on phones/tablets
- [ ] Data refreshes show latest information from all sources
- [ ] Fuzzy matching successfully links players across data sources
- [ ] Public URL accessible by coaches and parents
- [ ] Fast loading times (<3 seconds initial load)

### Future Considerations (Post-Stage 1)
- Real-time data synchronization
- Player availability tracking for practices/games
- Administrative tools for coaches
- Parent portal for individual player status
- Automated notifications for missing requirements