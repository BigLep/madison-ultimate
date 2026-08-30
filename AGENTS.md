# Agent Development Notes

This file contains development guidelines and commands for AI agents and developers on this project.

## Hard requirement: no PII

**Never include personally identifiable information (PII) in:**
- **Commits** – Do not commit real names, emails, birth dates, or any data that identifies a person. Use placeholders or env/config only.
- **Comments** – Do not use real names, example emails, or real identifiers in code comments or docstrings. Use generic placeholders (e.g. `"..."`, `"FirstName"`, `"portalId=..."`).
- **Test data** – Fixtures, mocks, and test cases must use only generic or obviously fake data (e.g. `TestFirst`, `TestLast`, `p001`, `ab0512`). No real student or family data.

This applies to all files in the repo, including docs and plan files. Verify before committing.

## Hard requirement: conventional commits

**Every commit message MUST use [Conventional Commits](https://www.conventionalcommits.org/):**
- **Format**: `type(scope): description` (scope optional but preferred when relevant).
- **Types**: `feat` (feature), `fix` (bugfix), `docs` (documentation only), `test` (tests only), `chore` (tooling, deps, config), `refactor` (no behavior change).
- **Examples**: `feat(auth): normalize lookup key for compound last names`, `fix(availability): resolve note column by date header`, `docs: require conventional commits in AGENT.md`, `test: add Vitest unit tests and pre-commit hook`, `chore(scripts): add fetch-game-info-headers.mjs`.

Do not commit with plain phrases like "Add X" or "Fix Y" without a type prefix. This is required for history clarity and tooling (changelogs, semver).

## Hard requirement: clean, linear history

**Never create merge commits.** When bringing one branch's work into another (including resolving a worktree's commits into `main`), rebase or cherry-pick instead of `git merge`, so history stays a straight line of conventional-commit entries. If a merge commit is produced by accident, undo it and redo the integration as a rebase/cherry-pick before pushing.

## Git worktrees

Symlinking gitignored env and credential files into a new worktree is standing consent. Do it in the same step as `git worktree add`; do not ask.

```
ln -s <main>/.env.local <worktree>/.env.local
ln -s <main>/.google-service-account.json <worktree>/.google-service-account.json
```

Symlink; do not copy. If a safety classifier blocks the command, retry it with user approval using this standing consent.

Install a real `node_modules` with `npm ci`. A `node_modules` symlink makes Turbopack panic.

## Development Commands

- `npm run dev` - Start development server (runs on http://localhost:3001 if 3000 is occupied)
- `npm run build` - Build for production
- `npm run lint` - Check code quality

## API Endpoints for Development

- `/api/diagnostics` - Comprehensive system health check (environment variables, credentials, API access)
- `/api/team-updates` - Fetch recent team updates from Buttondown newsletter RSS
- `/api/auth/callback` - OAuth callback handler (for setup only)

## Troubleshooting

**Run diagnostics first**: Use `curl http://localhost:3001/api/diagnostics | jq '.'` to check system health:
- **Environment**: Verifies all required environment variables are set
- **Credentials**: Validates service account and OAuth credential files
- **Sheets Access**: Tests Google Sheets API access to roster and questionnaire
- **Drive Access**: Tests Google Drive API access to SPS and mailing list folders
- **Sheets/Drive**: Tests service account access to roster and Drive folders
- **Buttondown**: Lists subscribers (read) and probes subscriber write without adding anyone to the list
- **System**: Checks Node.js version, timezone, and memory usage

Look for `"status": "fail"` items to identify configuration issues.

## Commit Message Guidelines

**Required**: See "Hard requirement: conventional commits" above. All commits must use the conventional format.

Optional: add emojis for clarity (e.g. `feat: add new feature ✨`). Examples:

```bash
git commit -m "feat(scope): add new feature"
git commit -m "fix(scope): resolve bug"
git commit -m "docs: update documentation"
```

**CRITICAL COMMIT WORKFLOW**: Always show file changes summary AND execute commit commands in the same response:

### Required Steps:
1. **First**: Run `git status` and `git diff` to identify all changes
2. **Then**: Present clear file summary in this format:
```
Files changed:
✅ Added: src/lib/new-feature.ts
📝 Updated: src/app/page.tsx
❌ Removed: src/old-file.ts
```
3. **Immediately**: Execute `git add` and `git commit` commands in the same response
4. **Result**: User can review the summary and cancel the commit if needed (before it completes)

### Why This Workflow:
- Shows transparency about what files are being committed
- Usually commits are approved, so execution is immediate
- User retains ability to cancel if they spot issues
- Balances efficiency with user control over the commit process

## Agent-specific notes

- Always use TodoWrite tool to track progress on multi-step tasks
- Update PLAN.md as features are completed
- Test the development server after major changes
- Use fuzzy matching for joining player data across different sources
- Mobile-first responsive design approach with Tailwind CSS

## Data Access Guidelines

### CRITICAL: Never Use Hardcoded Column Positions

**Rule**: Always use dynamic header discovery for Google Sheets column mapping.

**Why This Matters**:
- Google Sheets are frequently modified (columns added, removed, reordered)
- Hardcoded positions like `row[3]` break when sheet structure changes
- Example: Adding "Team" column shifted all availability columns, causing data to write to wrong places

**Correct Implementation**:
```typescript
// ✅ Always do this - dynamic column discovery
const columnMapping: Record<string, number> = {};
headerRow.forEach((header, index) => {
  columnMapping[header.toString().trim()] = index;
});

const availability = playerRow[columnMapping['9/23']] || '';
const note = playerRow[columnMapping['9/23 Note']] || '';
```

**Never Do This**:
```typescript
// ❌ Never use hardcoded positions
const availability = playerRow[3 + (i - 1) * 2]; // Breaks when columns change
```

**Shared Helpers Available**:
- `src/lib/availability-helper.ts` - `findDateColumns()` for practice/game availability
- `src/lib/column-validation.ts` - `getValidatedColumnValue()` for safe column access
- Pattern: Always fetch header row first, create mapping, then access data

## Testing Guidelines

**Mobile viewport screenshots**: Always check mobile-first design at iPhone screen dimensions using the `chrome-devtools-mcp` plugin's `emulate` tool, not a real browser window resize:
- `emulate({ pageId, viewport: "375x812x3,mobile,touch" })`, then `take_screenshot({ pageId })`
- This sets device metrics via CDP on that tab only; it doesn't move or resize the actual browser window, and doesn't conflict with any other extension/session also attached to the browser
- Confirmed working 2026-08-30: opening Chrome's real DevTools device toolbar (e.g. via a Cmd+Shift+M keystroke) instead breaks any other CDP-based automation attached to that tab (screenshots start failing) — don't do that

**chrome-devtools-mcp runs its own separate Chrome, not your daily browser**: as installed (`.claude-plugin/plugin.json` in the `chrome-devtools-mcp` plugin runs plain `npx chrome-devtools-mcp@1.8.0`, no `--browserUrl`/`--autoConnect`), Puppeteer launches a dedicated, logged-out Chrome instance with its own profile. It cannot see or attach to tabs already open in your regular Chrome (that's what `claude-in-chrome` is for). This is deliberate for now: it keeps viewport/perf checks isolated and doesn't need your real session's cookies/logins.

If we ever want chrome-devtools-mcp to attach to one of your actual Chrome sessions instead:
1. Launch that Chrome with `--remote-debugging-port=9222` (must be a fresh launch — you can't turn this on for an already-running instance)
2. Add `--browserUrl=http://127.0.0.1:9222` (or `--autoConnect`) to the `args` array for the `chrome-devtools` server in that plugin's `.claude-plugin/plugin.json`
3. Know the tradeoff before doing this: it inherits whatever's logged into that browser (cookies, accounts), so it's a bigger trust step than the current sandboxed instance — only do it deliberately, not as a default.

**Signup tests**: Vitest covers identity, Final Forms join (including magic last names and `spsStudentId` handoff), mailing on/off, caretaker cap/completeness, lookup, and profile-save — see `docs/TEST_DESIGN.md` (layer 1, “Signup domain states”). To visually exercise `/signup` and the player dashboard in every Final Forms state without a real registration, use one of the magic last names documented in `docs/fall-2026/signup-test-fixtures.md` (e.g. `TestCleared`).

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
- **ALWAYS** use `ROSTER_FIRST_DATA_ROW` from `sheet-config.ts` (1-indexed; first data row of roster). For 0-based index use `ROSTER_FIRST_DATA_ROW - 1`.
  - Use `SHEET_CONFIG.METADATA_ROWS` for metadata range operations.
- Example: Use `A${ROSTER_FIRST_DATA_ROW}:Z100` instead of `A5:Z100`

### Sheet IDs
- **NEVER** hardcode sheet IDs or duplicate environment variable fallbacks
- **ALWAYS** use `SHEET_CONFIG.ROSTER_SHEET_ID` which handles the environment variable centrally

This ensures consistency across the application and makes it easy to update configuration without hunting through code files.

## Date Formatting Convention

**CRITICAL**: Family-facing dates are for a parent or student, not a computer. Never show ISO-8601 strings like `"2026-08-28T05:15:11Z"` in the UI. Use the centralized formatters in `/src/lib/date-formatters.ts`.

### Standard Date Display (practices, games, expirations)
- **NEVER** use short formats like `"September 23"` or `"9/23"`
- **ALWAYS** include day of the week: `"Tuesday, September 23"`
- **USE** centralized date formatters from `/src/lib/date-formatters.ts`

### Point-in-time timestamps (data as of, last updated)
- **NEVER** show ISO-8601 or other machine timestamps
- **ALWAYS** use the viewer's local timezone, with am/pm and no seconds: `"8/28 10:34pm"`
- **USE** `formatLocalTimestamp` from `/src/lib/date-formatters.ts`

### Available Formatters
- `formatFullDate(dateString)` - **Default**: `"Tuesday, September 23"`
- `formatShortDate(dateString)` - **Space-limited**: `"Tue, Sep 23"`
- `formatFullDateWithYear(dateString, year?)` - **With year**: `"Tuesday, September 23, 2024"`
- `formatLocalTimestamp(iso)` - **Timestamps**: `"8/28 10:34pm"` (local timezone)

### Examples
```typescript
import { formatFullDate, formatLocalTimestamp } from '@/lib/date-formatters';

// ❌ Avoid - unclear what day this falls on
const badDate = "September 23";

// ✅ Good - clear day of the week included
const goodDate = formatFullDate("9/23"); // "Tuesday, September 23"

// ❌ Avoid - ISO-8601 in the UI
const badStamp = "2026-08-28T05:15:11Z";

// ✅ Good - local time with am/pm
const goodStamp = formatLocalTimestamp(iso); // "8/28 10:34pm"
```

This convention eliminates ambiguity about which day of the week events occur, and keeps "how recent is this data" readable on a phone.

## Data Privacy Guidelines

**CRITICAL (see also "Hard requirement: no PII" at top of this file)**: Never commit or introduce personal or student information anywhere:
- **Commits**: No real names, emails, birth dates, or identifiers in any committed file.
- **Comments**: No real names or identifiers in code comments; use placeholders only.
- **Test data**: Use only generic/fake data in fixtures and tests (see `src/__tests__/fixtures/` and `docs/TEST_DESIGN.md`).
- The `/tmp` directory is gitignored and contains cached data files.
- Always verify `.gitignore` includes sensitive data directories before committing.

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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

