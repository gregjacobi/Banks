# Batch Research CLI Tool

A command-line tool for running automated research workflows on multiple banks.

## Overview

The research workflow is now structured into **4 distinct phases**:

1. **Phase 1: Gather Sources & Metadata** - Search the web for investor presentations, earnings transcripts, and other research documents, plus gather bank metadata (logo, ticker symbol, org chart)
2. **Phase 2: PDF Selection & Insight Extraction** - Review and select PDFs to upload into the RAG (Retrieval-Augmented Generation) system, then extract strategic insights
3. **Phase 3: Generate Report** - Create comprehensive AI research report using all gathered data
4. **Phase 4: Generate Podcast** - Create podcast discussion from the research report

## Installation

The script is located at:
```
server/scripts/cli/batchResearch.js
```

Make sure you have:
- MongoDB running
- Server dependencies installed (`npm install`)
- Environment variables configured (`.env` file with `MONGODB_URI` and `ANTHROPIC_API_KEY`)

## Usage

### List Banks and Their Status

View the top N banks and their current research phase status:

```bash
node server/scripts/cli/batchResearch.js --list --count 20
```

Output example:
```
📊 Bank Research Status Report

====================================================================================================
ID RSSD     Bank Name                                          Assets          Phase 1  Phase 2  Phase 3  Phase 4
====================================================================================================
504713      JPMORGAN CHASE BANK, NATIONAL ASSOCIATION          $3.2T           ✅       ✅       🔄       ⏳
852218      TRUIST BANK                                        $392.4B         ✅       ⏳       ⏳       ⏳
413208      WEBSTER BANK, NATIONAL ASSOCIATION                 $75.2B          🔄       ⏳       ⏳       ⏳
====================================================================================================

Legend:
  ⏳ not_started   🔄 in_progress   ✅ completed   ❌ failed

Phases:
  Phase 1: Gather sources from web + metadata (logo, ticker, org chart)
  Phase 2: Select & upload PDFs to RAG + extract insights
  Phase 3: Generate AI research report
  Phase 4: Generate podcast
```

### Run Phase 1 for Top N Banks

Process the top N banks by total assets (default: 10):

```bash
# Process top 10 banks
node server/scripts/cli/batchResearch.js

# Process top 25 banks
node server/scripts/cli/batchResearch.js --count 25
```

### Force Re-run Phase 1

If a bank has already completed Phase 1, you can force it to re-run:

```bash
node server/scripts/cli/batchResearch.js --count 10 --force
```

**What happens during force re-run:**
- Deletes all existing sources for the bank (prevents duplicates)
- Re-gathers sources from the web
- Re-gathers metadata (logo, ticker, org chart)
- Updates Phase 1 status with new data

**Note:** Force re-run only clears sources, not PDFs, RAG documents, or reports.

## Command Line Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--count` | `-c` | Number of banks to process | 10 |
| `--force` | `-f` | Force re-run Phase 1 even if completed | false |
| `--list` | `-l` | List banks and their phase status | false |

## Examples

### Example 1: Initial Research Run

```bash
# Start Phase 1 for top 10 banks
node server/scripts/cli/batchResearch.js --count 10
```

This will:
- Query the top 10 banks by assets
- Check if Phase 1 is already completed
- Skip banks that have completed Phase 1
- Run Phase 1 (source gathering) for the rest
- Save sources to the database
- Update phase status in BankMetadata

### Example 2: Check Progress

```bash
# View current status of top 20 banks
node server/scripts/cli/batchResearch.js --list --count 20
```

### Example 3: Re-gather Sources

```bash
# Force re-run Phase 1 for top 5 banks
node server/scripts/cli/batchResearch.js --count 5 --force
```

## Phase Details

### Phase 1: Gather Sources & Metadata 🔍

**What it does:**
- Searches the web for investor presentations
- Finds earnings call transcripts
- Locates financial reports and announcements
- Gathers bank metadata:
  - Logo from Wikipedia/official website
  - Stock ticker symbol and exchange
  - Executive leadership and board of directors
- Saves discovered sources and metadata to database

**Status tracking:**
- `not_started` - Phase not begun
- `in_progress` - Currently gathering sources and metadata
- `completed` - Sources and metadata gathered and saved
- `failed` - Error occurred during gathering

**CLI automation:** ✅ Fully automated via CLI

### Phase 2: PDF Selection & Insight Extraction 📄

**What it does:**
- Review discovered sources
- Select relevant PDFs
- Upload PDFs to RAG infrastructure
- Process documents for embedding and retrieval
- Extract strategic insights from RAG:
  - Strategic priorities
  - Focus metrics
  - Technology partnerships

**Status tracking:**
- Tracks number of PDFs uploaded
- Tracks RAG processing status
- Tracks insight extraction completion

**CLI automation:** ⏳ Manual (use web UI - coming soon to CLI)

### Phase 3: Generate Report 📊

**What it does:**
- Generate comprehensive AI research report
- Include financial analysis
- Incorporate RAG insights
- Create executive summary

**Status tracking:**
- Tracks report generation status
- Stores report ID reference

**CLI automation:** ⏳ Coming soon

### Phase 4: Generate Podcast 🎙️

**What it does:**
- Create podcast discussion from research report
- Select expert perspectives (investors, academics, tech experts, CX experts)
- Generate natural conversation about bank insights
- Convert to audio using text-to-speech

**Status tracking:**
- Tracks podcast generation status
- Stores podcast ID reference

**CLI automation:** ⏳ Coming soon

## API Endpoints

The CLI uses these endpoints:

### GET /api/research/:idrssd/status

Get research phase status for a specific bank.

**Response:**
```json
{
  "status": {
    "phase1": "completed",
    "phase2": "in_progress",
    "phase3": "not_started",
    "phase4": "not_started",
    "details": {
      "phase1": {
        "status": "completed",
        "completedAt": "2025-11-16T10:30:00Z",
        "sourcesFound": 12,
        "sessionId": "batch-1699888800000-504713"
      }
    }
  }
}
```

### POST /api/research/:idrssd/gather-sources-batch

Trigger Phase 1 source gathering (non-SSE version for batch processing).

**Request Body:**
```json
{
  "sessionId": "batch-1699888800000-504713",
  "config": {
    "categories": ["investorPresentation", "earningsTranscript"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "sourcesFound": 12,
  "sessionId": "batch-1699888800000-504713"
}
```

## Monitoring Progress

The CLI provides detailed console output:

```
🚀 Batch Research Processing

Processing top 10 banks by total assets
Force re-run: No

Found 10 banks to process

[1/10]
🏦 JPMORGAN CHASE BANK, NATIONAL ASSOCIATION (504713)
   Assets: $3.2T
   ⏭️  Phase 1 already completed (use --force to re-run)

[2/10]
🏦 TRUIST BANK (852218)
   Assets: $392.4B
   🔄 Starting Phase 1: Gather sources...
   ✅ Phase 1 completed: 8 sources found

...

================================================================================
📊 Batch Processing Summary
================================================================================
Total banks:     10
✅ Completed:    7
⏭️  Skipped:      2
❌ Failed:       1
================================================================================
```

## Troubleshooting

### MongoDB Connection Error

Ensure MongoDB is running:
```bash
mongosh mongodb://localhost:27017/bankexplorer
```

### API Server Not Running

The API server must be running for the CLI to work:
```bash
npm run dev
```

### No Sources Found

Some banks may not have publicly available investor materials. This is expected behavior.

### Rate Limiting

If you're processing many banks, consider adding delays between requests to avoid rate limiting.

## Future Enhancements

- [ ] CLI automation for Phase 2 (PDF selection)
- [ ] CLI automation for Phase 3 (insight extraction)
- [ ] CLI automation for Phase 4 (report generation)
- [ ] Parallel processing option
- [ ] Progress bar for long-running operations
- [ ] Email notifications on completion
- [ ] Retry logic for failed phases

## Development

To modify the CLI script:

1. Edit `server/scripts/batchResearch.js`
2. The script uses existing API endpoints in `server/routes/research.js`
3. Phase tracking is stored in the `BankMetadata` model

## Support

For issues or questions, check:
- Server logs: Look for `[Batch]` prefixed messages
- MongoDB: Check the `bankmetadata` collection for phase status
- API endpoints: Test endpoints directly with curl or Postman
