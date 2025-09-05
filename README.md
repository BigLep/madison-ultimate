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

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000) to see the application.

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the application for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint for code quality checks

## Project Structure

```
madison-ultimate/
├── src/
│   ├── app/                    # Next.js app router pages
│   ├── components/             # Reusable UI components
│   ├── lib/                    # Utilities and API integrations
│   └── styles/                 # Global styles
├── public/                     # Static assets
├── PLAN.md                     # Implementation plan and progress
└── PROJECT REQUIREMENTS.md     # Full project requirements
```

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Deployment**: Vercel (planned)
- **Data Sources**: Google Sheets API, Google Drive API (planned)

## Development Workflow

This project uses conventional commits with emojis for fun! Please format your commit messages as:

```
emoji type(scope): description

Examples:
✨ feat: add player signup status table
🐛 fix: resolve data matching issue  
📚 docs: update setup instructions
🎨 style: improve mobile responsive design
♻️ refactor: reorganize data processing logic
⚡ perf: optimize table rendering
🧪 test: add unit tests for fuzzy matching
🔧 chore: update dependencies
```

### Common Commit Emojis
- ✨ `:sparkles:` - New features
- 🐛 `:bug:` - Bug fixes  
- 📚 `:books:` - Documentation
- 🎨 `:art:` - UI/styling improvements
- ♻️ `:recycle:` - Refactoring
- ⚡ `:zap:` - Performance improvements
- 🧪 `:test_tube:` - Tests
- 🔧 `:wrench:` - Configuration/tooling

## Stage 1: Signup Steps Reporting

Currently implementing a dashboard to track player signup progress across multiple data sources:

- SPS Final Forms completion status
- Additional questionnaire responses  
- Team mailing list membership

See `PLAN.md` for detailed implementation progress.