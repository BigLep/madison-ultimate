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

