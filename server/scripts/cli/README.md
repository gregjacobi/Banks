# CLI Scripts

Command-line tools for batch processing and automation of bank research workflows.

## Quick Help

All scripts support `--help` or `-h` flag:
```bash
node server/scripts/cli/batchResearch.js --help
node server/scripts/cli/batchDelete.js --help
node server/scripts/cli/findLogos.js --help
```

## Available Scripts

### 1. Batch Research Tool (`batchResearch.js`)

Automates the research pipeline for multiple banks: sources, AI reports, podcasts, and presentations.

**Quick Start:**
```bash
# Phase 1 only (gather sources)
node server/scripts/cli/batchResearch.js --count 10

# All phases (sources, report, podcast, presentation)
node server/scripts/cli/batchResearch.js --count 10 --max-phase 3

# Show help
node server/scripts/cli/batchResearch.js --help
```

**Key Features:**
- Phase 1: Gather web sources
- Phase 2: Generate AI research report
- Phase 3: Create podcast and presentation
- Process top N banks by assets
- Force re-run capability
- Phase status tracking

---

### 2. Batch Delete Tool (`batchDelete.js`)

Safely deletes research metadata without touching Call Report data.

**Quick Start:**
```bash
# See what would be deleted (dry run)
node server/scripts/cli/batchDelete.js --idrssd 852218 --dry-run

# Delete all research data for a bank
node server/scripts/cli/batchDelete.js --idrssd 852218

# Show help
node server/scripts/cli/batchDelete.js --help
```

**Key Features:**
- Delete Phase 1, 2, 3 data selectively
- Clear ticker, org chart, strategic insights, logos
- Optional RAG document deletion
- Dry-run mode (shows what would be deleted)
- Confirmation prompts for safety
- Protects Call Report data

---

### 3. Logo Finder Tool (`findLogos.js`)

Finds and downloads bank logos with verbose logging for strategy improvement.

**Quick Start:**
```bash
# Find logos for top 10 banks
node server/scripts/cli/findLogos.js --count 10

# Find logo for specific bank
node server/scripts/cli/findLogos.js --idrssd 504713

# Show help
node server/scripts/cli/findLogos.js --help
```

**Key Features:**
- Multi-strategy logo discovery (Brandfetch, Wikipedia, official sites)
- Both full and symbol logo versions
- Verbose logging for strategy analysis
- Force re-find capability
- Logo status listing

---

## Common Usage Patterns

### Get Help

```bash
# Show help for any script
node server/scripts/cli/batchResearch.js --help
node server/scripts/cli/batchDelete.js --help
node server/scripts/cli/findLogos.js --help
```

### List Current Status

```bash
# Check research phases
node server/scripts/cli/batchResearch.js --list --count 20

# Check logo status
node server/scripts/cli/findLogos.js --list --count 20

# Check research data (for deletion planning)
node server/scripts/cli/batchDelete.js --list
```

### Process Top Banks

```bash
# Run Phase 1 (sources)
node server/scripts/cli/batchResearch.js --count 10

# Run all phases (sources, report, podcast, presentation)
node server/scripts/cli/batchResearch.js --count 10 --max-phase 3

# Find logos only
node server/scripts/cli/findLogos.js --count 10
```

### Clean Up Data

```bash
# Dry run to see what would be deleted
node server/scripts/cli/batchDelete.js --idrssd 852218 --dry-run

# Delete all research data for a bank
node server/scripts/cli/batchDelete.js --idrssd 852218

# Delete specific phases only
node server/scripts/cli/batchDelete.js --idrssd 852218 --phases 1,2

# Delete everything including RAG
node server/scripts/cli/batchDelete.js --count 10 --include-rag
```

### Force Re-run

```bash
# Force re-run all phases
node server/scripts/cli/batchResearch.js --count 5 --max-phase 3 --force

# Force re-find logos
node server/scripts/cli/findLogos.js --count 5 --force
```

### Target Specific Bank

```bash
# Research by ID
node server/scripts/cli/batchResearch.js --idrssd 504713 --max-phase 3

# Logo by ID or name
node server/scripts/cli/findLogos.js --idrssd 504713
node server/scripts/cli/findLogos.js --name "JPMorgan Chase"

# Delete by ID
node server/scripts/cli/batchDelete.js --idrssd 504713
```

### Capture Verbose Logs

```bash
# Save logs for analysis
node server/scripts/cli/findLogos.js --count 10 > analysis.log 2>&1

# Feed to Claude for strategy improvement
cat analysis.log | pbcopy  # macOS
```

## Prerequisites

All scripts require:
- MongoDB running (`mongod`)
- Environment variables configured (`.env` file)
- Server dependencies installed (`npm install`)

## Script Organization

```
server/scripts/
├── cli/                      # Command-line tools
│   ├── README.md            # This file
│   ├── batchResearch.js     # Batch research pipeline (Phases 1-3)
│   ├── batchDelete.js       # Batch metadata deletion tool
│   └── findLogos.js         # Logo finder with verbose logging
└── [other scripts]          # Non-CLI utility scripts
```

## Development

### Adding New CLI Scripts

1. Create script in `server/scripts/cli/`
2. Add shebang: `#!/usr/bin/env node`
3. Make executable: `chmod +x script.js`
4. Document in this README
5. Create detailed documentation in project root if complex

### CLI Best Practices

- Use consistent argument parsing (see existing scripts)
- **ALWAYS include `--help` and `-h` flags** with comprehensive usage info
- Provide both long and short flags (`--count` and `-c`)
- Include `--list` option for status checking
- Include `--force` option when applicable
- Use clear, descriptive logging with emoji icons
- Handle errors gracefully with helpful messages
- Document all options in script header
- Show examples in help text
- Exit with appropriate codes (0 for success, 1 for errors)

## Troubleshooting

### MongoDB Connection Issues

Ensure MongoDB is running:
```bash
mongosh mongodb://localhost:27017/bankexplorer
```

### Missing Environment Variables

Check `.env` file exists with:
```
MONGODB_URI=mongodb://localhost:27017/bankexplorer
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Script Not Executable

```bash
chmod +x server/scripts/cli/*.js
```

### Rate Limiting

Scripts include delays between requests. For large batches, consider:
- Processing in smaller chunks
- Running during off-peak hours
- Checking API rate limits

## Future Scripts

Planned CLI tools:
- [x] Phase 2-3 automation (AI report, podcast, presentation) - **DONE** (via `batchResearch.js --max-phase 3`)
- [x] Data cleanup utilities - **DONE** (via `batchDelete.js`)
- [ ] Validation and quality checking tools
- [ ] Export and reporting tools
- [ ] UBPR validation utilities
- [ ] Performance benchmarking tools
