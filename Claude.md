# Claude Code Development Notes

## Project Overview
Bank Explorer - Financial statement analysis app for banks and credit unions using FDIC Call Reports, UBPR data, and PDF analysis.

## 📚 Documentation

All project documentation is organized in the [`/docs/`](docs/) directory. See [Documentation Index](docs/INDEX.md) for complete navigation.

**Quick Links:**
- **Skills:** [Commercial lending skills](docs/skills/) (credit memo creation, analyst review)
- **Features:** [Feature documentation](docs/features/) (source selection, citations, logos, etc.)
- **Setup:** [Deployment and configuration](docs/setup/) guides
- **Main README:** [Project README](README.md)

**Recent Updates (2025-12-03):**
- **CI Credit Memo Skill Improvements:** Added memo detail levels, smart defaults, assumption tracking, and interactive review checkpoints. See [SKILL_IMPROVEMENTS_SUMMARY.md](SKILL_IMPROVEMENTS_SUMMARY.md) for details.

## Design System

This project uses shadcn/ui components with Tailwind CSS and Anthropic branding.

### Branding

**Colors:**
- Primary: `#D97757` (coral/terracotta) - Anthropic brand color
- Text: `#1A1A1A` - Primary text color
- Background: `#FAFAFA` - Page background
- Font: Styrene A (with system sans-serif fallback)

### Component Imports

Always import from `@/components/ui/`:
```javascript
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
```

Icons from lucide-react:
```javascript
import { Search, TrendingUp, Download, X } from "lucide-react"
```

### Styling Rules

1. **Use Tailwind utility classes only** - No inline styles or CSS modules
2. **Follow shadcn/ui patterns** for consistency
3. **Use semantic color tokens** (primary, secondary, muted, etc.)
4. **Maintain 4px/8px spacing rhythm**

## Important Development Notes

### Claude Code Skills Development

This project uses Claude Code skills for specialized banking tasks (e.g., credit memo generation, analyst review). Skills are organized as follows:

**Directory Structure:**
- `skill-dev/` - Active skill development (tracked in git)
- `.claude/skills/` - Installed skills that Claude Code uses (tracked in git)
- `skill-packages/` - Compiled .zip packages for distribution (gitignored)

**Skill Development Workflow:**

1. **Develop skills** in `skill-dev/<skill-name>/`
   - Each skill must have a `SKILL.md` file
   - Add supporting resources in `resources/` subdirectory

2. **Compile skills** when ready to use or distribute:
   ```bash
   # Compile all skills in skill-dev/
   npm run compile-skills

   # Compile specific skill
   npm run compile-skills credit-analyst-skill
   ```

3. **What compile does:**
   - Installs skill to `.claude/skills/` (for local use)
   - Creates `.zip` package in `skill-packages/` (for distribution)

4. **Distribute skills:**
   - Share the `.zip` file from `skill-packages/`
   - Recipients can unzip and install to their `.claude/skills/`

**Important:** Never develop directly in `.claude/skills/`. Always work in `skill-dev/` and compile when ready.

### Nodemon Configuration Issue (Fixed: 2025-11-01)

**Problem**: Changes to server files weren't being picked up by nodemon, requiring manual server restarts after every code change.

**Root Cause**: No nodemon configuration file existed, causing nodemon to use default settings which may not have been optimally watching all server files.

**Solution**: Created `nodemon.json` configuration file with:
- Explicit watch paths for `server` directory
- File extensions to watch: `.js` and `.json`
- Ignore paths for `server/data/**` and `node_modules/**`
- 500ms delay for restart
- Verbose mode enabled for better debugging

**Files Modified**:
1. Created `/nodemon.json` with proper configuration
2. `.env` already has `CLEAR_UBPR_CACHE_ON_STARTUP=true` which clears UBPR cache on server restart

**Verification**: After creating nodemon.json, server log should show:
```
[nodemon] reading config ./nodemon.json
[nodemon] watching path(s): server/**/*
[nodemon] watching extensions: js,json
```

### Cache Clearing

The UBPR validation system caches results in MongoDB. When making changes to UBPR calculation logic, you should:

1. **Automatic Clear on Restart**: The `.env` file has `CLEAR_UBPR_CACHE_ON_STARTUP=true` which automatically clears the cache when the server starts.

2. **Manual Clear**: If needed, you can manually delete cache entries:
   ```javascript
   const UBPRData = require('./models/UBPRData');
   await UBPRData.deleteMany({});
   ```

### Server Restart Process

**IMPORTANT**: Always check for existing processes before starting the server to avoid port conflicts.

#### Check for Running Servers
Before starting the server, check if ports are already in use:
```bash
# List processes using ports 5000 and 5001
lsof -i:5000 -i:5001

# Or just get the PIDs
lsof -ti:5000 -ti:5001
```

#### Kill Existing Servers
If ports are in use, kill the processes:
```bash
# Kill all processes on ports 5000 and 5001
lsof -ti:5000 -ti:5001 | xargs kill -9
```

#### Start Server with Logging
When starting the development server, always log output to `/tmp/server.log` for debugging:
```bash
# Start with logging (recommended)
npm run dev > /tmp/server.log 2>&1 &

# Or start in foreground (see output directly)
npm run dev
```

#### Complete Restart Process
When changes aren't being picked up or server issues occur:
1. **Check for running processes**: `lsof -i:5000 -i:5001`
2. **Kill existing servers**: `lsof -ti:5000 -ti:5001 | xargs kill -9`
3. **Start server with logging**: `npm run dev > /tmp/server.log 2>&1 &`
4. **Monitor logs**: `tail -f /tmp/server.log`
5. **Verify startup**:
   - Check that cache was cleared (if enabled)
   - Check that nodemon config was loaded
   - Wait for "Compiled successfully!" message from React client

## Architecture Notes

### PDF Metrics Extraction
- Uses Claude Sonnet 4 to read bank PDFs (investor presentations, annual reports)
- Automatically detects YTD vs annualized values
- Applies annualization factor for YTD values: Q1 (×4), Q2 (×2), Q3 (×1.33), Q4 (×1)
- Returns warnings about transformations applied

### Three-Way UBPR Validation
The system compares metrics from three sources:
1. **Our Calculations**: From Call Report data
2. **UBPR Values**: From FFIEC UBPR XBRL data
3. **PDF Values**: Extracted from bank's public reports

This allows identifying which calculation source is most accurate.

## Key Environment Variables

```
PORT=5001
MONGODB_URI=mongodb://localhost:27017/bankexplorer
ANTHROPIC_API_KEY=sk-ant-api03-...
ELEVENLABS_API_KEY=sk_...
FFIEC_API_USERNAME=...
FFIEC_API_PASSWORD=...
CLEAR_UBPR_CACHE_ON_STARTUP=true
```

## Common Issues

### Issue: Server changes not reflected
**Solution**: Check that nodemon.json exists and server was restarted

### Issue: UBPR validation showing old/cached results
**Solution**: Verify `CLEAR_UBPR_CACHE_ON_STARTUP=true` in .env, then restart server

### Issue: PDF extraction showing "N/A" for all banks
**Possible Causes**:
1. No PDFs uploaded for the bank
2. PDFs outside 6-month window of reporting period
3. Claude API timeout (should see error in logs)
4. Server crashed during PDF processing (check logs)

## Development Workflow

1. Make changes to server files
2. Nodemon should automatically detect and restart (check logs for restart message)
3. If changes not picked up, manually restart: `npm run dev`
4. For testing UBPR validation with new logic, server restart will clear cache automatically
5. Check `/tmp/dev-server.log` or console for any errors

## Testing PDF Extraction

Banks with PDFs available (as of last update):
- TRUIST (idrssd: 852218) - 2 PDFs
- WEBSTER BANK (idrssd: 413208) - 1 PDF

To test PDF extraction, run UBPR validation on these banks and check server logs for:
```
Extracting metrics from PDFs for bank [idrssd], period [date]
Found [N] PDFs for bank [idrssd]
Attaching PDF: [filename] ([size]KB)
Calling Claude API for PDF extraction...
Annualizing YTD income statement values by factor X.XX (QY)
```

## Financial Ratio Conventions (CRITICAL - DO NOT VIOLATE)

### Ratio Direction Interpretation

**Most ratios are better the HIGHER they get. However, there are key exceptions:**

1. **Efficiency Ratio**: **LOWER is better**
   - Formula: Noninterest Expense / (Net Interest Income + Noninterest Income)
   - Represents the amount of expense needed to generate revenue
   - Lower values indicate better operational efficiency
   - Examples: 45% = excellent, 55% = good, 65% = average, 75% = poor
   - When efficiency ratio decreases → improvement
   - When efficiency ratio increases → worsening performance
   - Always document this clearly in prompts and code comments

2. **Operating Leverage**: **HIGHER is better** (YoY comparison)
   - Measures how changes in revenue amplify changes in operating income (operational scalability)
   - **Formula:** Operating Leverage = (YoY % Change in PPNR) / (YoY % Change in Total Revenue)
   - **Where:**
     - **Total Revenue** = Total Interest Income + Total Non-Interest Income
     - **PPNR (Pre-Provision Net Revenue)** = Total Revenue - Total Operating Expenses
   - **Interpretation:**
     - Values > 1.0: Revenue changes have a magnified impact on operating income (positive leverage, EXCELLENT)
     - Values = 1.0: Operating income changes proportionally with revenue (neutral leverage)
     - Values < 1.0: Operating income changes less than revenue (negative leverage)
     - Higher operating leverage indicates more scalable operations (fixed costs are leveraged efficiently)
   - **Calculation Details:**
     - Uses Year-over-Year (YoY) quarterly comparison (compares same quarter in consecutive years)
     - Only calculated when a year-ago quarter is available (first year of data will be null)
     - Example: If PPNR grew 20% YoY and Total Revenue grew 10% YoY, operating leverage = 2.0x
   - **Key Points:**
     - This is a key metric podcast hosts keep getting wrong - always emphasize HIGHER is better
     - Sustained operating leverage > 1.0 over multiple quarters indicates excellent operational scalability
     - Operating leverage > 1.0 means the bank is gaining operational efficiency as it grows

3. **Other Ratios Where LOWER is Better:**
   - Delinquent loan rates
   - Charge-off rates
   - Non-performing loans ratio
   - Any ratio measuring negative outcomes (losses, defaults, etc.)

4. **Ratios Where HIGHER is Better (most ratios):**
   - Return on Equity (ROE)
   - Return on Assets (ROA)
   - Net Interest Margin (NIM)
   - Loan-to-Deposit Ratio (up to healthy limits)
   - Most profitability and efficiency metrics

**CRITICAL:** When generating content (podcasts, reports, analyses), ALWAYS verify:
- Efficiency ratio: Say "lower is better" or "decreasing efficiency ratio is improvement"
- Operating leverage: Say "higher is better" or "positive/sustained positive operating leverage is excellent"
- Never confuse these directions

## Time-Based Graph Ordering (CRITICAL - ALL GRAPHS)

**ALL time-based graphs MUST display data from OLDEST to NEWEST (left to right).**

This applies to:
- All quarter-over-quarter trend charts
- Year-over-year comparison charts (within each year line, quarters go Q1→Q4)
- Sparklines showing historical trends
- Any visualization with a time dimension

### Implementation Requirements:

1. **Component Sorting:**
   - Always sort periods chronologically before mapping to chart data: `.sort((a, b) => new Date(a.reportingPeriod) - new Date(b.reportingPeriod))`
   - Never use `.reverse()` without first ensuring proper date-based sorting
   - When fetching periods from API, sort explicitly by date, don't assume order

2. **Components Already Correct:**
   - `TrendsTab.jsx` - properly sorts statements by reportingPeriod (oldest first)
   - `TrendsTabCompact.jsx` - explicitly sorts periods chronologically
   - `BankDetail.jsx` - sorts statements oldest first

3. **Components Fixed:**
   - `PeerComparisonTab.jsx` - changed from `.reverse()` to explicit date sorting
   - `IncomeExpenseTab.jsx` - changed from `.reverse()` to explicit date sorting

4. **Year-over-Year Charts:**
   - These show multiple years as separate lines
   - Years are sorted descending (newest first in legend) which is acceptable for legend ordering
   - Within each year line, quarters go Q1→Q4 (oldest to newest), which is correct

5. **When Adding New Graph Components:**
   - ALWAYS sort periods/data by date (oldest first) before creating chart data
   - Add comment: `// Sort by period (oldest first for proper time-based chart ordering)`
   - Test with data spanning multiple years to verify chronological ordering
   - Never assume API or data comes pre-sorted

**Why This Matters:**
- Users read charts left-to-right expecting chronological progression
- Violating this causes confusion and makes trend analysis difficult
- Consistency across all charts improves user experience
