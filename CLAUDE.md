# Claude Code Development Notes

This file contains development guidelines and commands for working with Claude Code on this project.

## Development Commands

- `npm run dev` - Start development server (runs on http://localhost:3001 if 3000 is occupied)
- `npm run build` - Build for production
- `npm run lint` - Check code quality

## API Endpoints for Development

- `/api/diagnostics` - Comprehensive system health check (environment variables, credentials, API access)
- `/api/group-messages` - Fetch recent team messages from Google Groups
- `/api/auth/gmail` - Get Gmail OAuth authorization URL (for setup only)
- `/api/auth/callback` - OAuth callback handler (for setup only)

## Troubleshooting

**Run diagnostics first**: Use `curl http://localhost:3001/api/diagnostics | jq '.'` to check system health:
- **Environment**: Verifies all required environment variables are set
- **Credentials**: Validates service account and OAuth credential files
- **Sheets Access**: Tests Google Sheets API access to roster and questionnaire
- **Drive Access**: Tests Google Drive API access to SPS and mailing list folders
- **Gmail Access**: Tests Gmail API authentication and message search
- **System**: Checks Node.js version, timezone, and memory usage

Look for `"status": "fail"` items to identify configuration issues.

## Commit Message Guidelines

Use conventional commits with emojis for fun:

```bash
git commit -m "feat: add new feature ✨"
git commit -m "fix: resolve bug 🔧"  
git commit -m "docs: update documentation 📚"
```

## Claude Code Specific Notes

- Always use TodoWrite tool to track progress on multi-step tasks
- Update PLAN.md as features are completed
- Test the development server after major changes
- Use fuzzy matching for joining player data across different sources
- Mobile-first responsive design approach with Tailwind CSS

## Testing Guidelines

**Puppeteer Screenshots**: Always use iPhone screen dimensions for testing mobile-first design:
- Use width: 375, height: 812 for iPhone screen size
- Example: `puppeteer_screenshot({name: "test", width: 375, height: 812})`
- This ensures screenshots reflect the actual mobile user experience

## Styling Guidelines

**CRITICAL**: Prefer CSS classes and CSS variables over JavaScript-based styling:

### CSS Classes vs JavaScript Functions
- **NEVER** use JavaScript functions to generate style strings or class names dynamically
- **ALWAYS** use CSS classes with conditional logic: `className={condition ? 'style-a' : 'style-b'}`
- **PREFER** Tailwind CSS utility classes for consistent, maintainable styling

### Principle
- **REFER** to existing CSS patterns in the codebase for consistent styling
- **LOOK** at similar components to understand the established visual language
- **DEFINE** reusable CSS classes when patterns are repeated across components

### Examples
```typescript
// ❌ Avoid - JavaScript function returning styles
const getButtonStyle = (type) => {
  switch(type) {
    case 'success': return 'bg-green-100 text-green-800';
    case 'error': return 'bg-red-100 text-red-800';
  }
};

// ✅ Good - Direct CSS classes with conditional logic
<div className={`base-classes ${isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>

// ✅ Best - CSS variables for dynamic values
<div style={{color: 'var(--primary-text)'}} className="bg-green-100 border-green-300">
```

## Design Decision Documentation

**CRITICAL**: Always document important architectural decisions in `DESIGN.md`:

### When to Document
- New authentication/authorization patterns
- Data flow changes between APIs
- Major UI/UX architectural choices
- Performance optimization strategies
- Security design decisions
- API design patterns

### How to Document
1. Add to the appropriate section in `DESIGN.md`
2. Include rationale for the decision
3. Document alternatives considered and why they were rejected
4. Provide concrete examples of implementation
5. Note any trade-offs or limitations

### Example Design Decisions Already Documented
- Player Portal authentication strategy (Portal ID vs Full Name lookup)
- shadcn/ui framework selection with alternatives analysis
- Caching strategy for serverless deployment
- Data source integration patterns

This ensures architectural knowledge is preserved and new developers understand the reasoning behind implementation choices.

## Configuration Management Guidelines

**CRITICAL**: Always use centralized configuration instead of hardcoded values:

### Sheet Names
- **NEVER** hardcode sheet names like `'📋 Roster'`, `'📍Practice Info'`, `'Practice Availability'`
- **ALWAYS** use values from `SHEET_CONFIG` in `/src/lib/sheet-config.ts`
- Example: Use `SHEET_CONFIG.ROSTER_SHEET_NAME` instead of `'📋 Roster'`

### Row Numbers and Metadata
- **NEVER** hardcode row numbers like `5`, `A5:`, `:5`, etc.
- **ALWAYS** use metadata constants from `SHEET_CONFIG`:
  - Use `SHEET_CONFIG.DATA_START_ROW` (1-indexed, for ranges like `A5:Z100`)
  - Use `SHEET_CONFIG.DATA_START_ROW_INDEX` (0-indexed, for array operations)
  - Use `SHEET_CONFIG.METADATA_ROWS` for metadata range operations
- Example: Use `A${SHEET_CONFIG.DATA_START_ROW}:Z100` instead of `A5:Z100`

### Sheet IDs
- **NEVER** hardcode sheet IDs or duplicate environment variable fallbacks
- **ALWAYS** use `SHEET_CONFIG.ROSTER_SHEET_ID` which handles the environment variable centrally

This ensures consistency across the application and makes it easy to update configuration without hunting through code files.

## Date Formatting Convention

**CRITICAL**: Always use full date formats including day of the week to avoid confusion:

### Standard Date Display
- **NEVER** use short formats like `"September 23"` or `"9/23"`
- **ALWAYS** include day of the week: `"Tuesday, September 23"`
- **USE** centralized date formatters from `/src/lib/date-formatters.ts`

### Available Formatters
- `formatFullDate(dateString)` - **Default**: `"Tuesday, September 23"`
- `formatShortDate(dateString)` - **Space-limited**: `"Tue, Sep 23"`
- `formatFullDateWithYear(dateString, year?)` - **With year**: `"Tuesday, September 23, 2024"`

### Examples
```typescript
// ❌ Avoid - unclear what day this falls on
const badDate = "September 23";

// ✅ Good - clear day of the week included
import { formatFullDate } from '@/lib/date-formatters';
const goodDate = formatFullDate("9/23"); // "Tuesday, September 23"
```

This convention eliminates ambiguity about which day of the week events occur.

## Data Privacy Guidelines

**CRITICAL**: Never commit personal or student information to the repository:
- The `/tmp` directory is gitignored and contains cached data files
- Never add actual student names, emails, or personal data to version control
- Use placeholder/anonymized data for development and testing
- Always verify `.gitignore` includes sensitive data directories before committing

## Credential Security Guidelines

**CRITICAL**: Never commit authentication credentials to the repository:
- `.google-service-account.json` - Service account credentials (in `.gitignore`)
- `.google-oauth.json` - OAuth client credentials (in `.gitignore`)
- `.env.local` - Environment variables including refresh tokens (in `.gitignore`)
- Never include actual tokens, keys, or credentials in documentation or code comments

## Data Sources for Stage 1

1. **SPS Final Forms** - Google Drive exports (CSV format)
2. **Additional Questionnaire** - Google Sheets responses  
3. **Team Mailing List** - Google Drive member exports

## Next Steps

1. Set up Google APIs integration (Sheets + Drive)
2. Implement data fetching and processing
3. Build signup status table component
4. Deploy to Vercel

