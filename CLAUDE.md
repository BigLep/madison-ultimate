# Claude Code Development Notes

This file contains development guidelines and commands for working with Claude Code on this project.

## Development Commands

- `npm run dev` - Start development server (runs on http://localhost:3001 if 3000 is occupied)
- `npm run build` - Build for production
- `npm run lint` - Check code quality

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

## Data Sources for Stage 1

1. **SPS Final Forms** - Google Drive exports (CSV format)
2. **Additional Questionnaire** - Google Sheets responses  
3. **Team Mailing List** - Google Drive member exports

## Next Steps

1. Set up Google APIs integration (Sheets + Drive)
2. Implement data fetching and processing
3. Build signup status table component
4. Deploy to Vercel