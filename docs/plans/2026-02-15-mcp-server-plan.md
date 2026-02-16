# MCP Server & Apps Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an MCP server with 20 read-only tools and 5 interactive chart apps to the existing Bank Explorer Express server.

**Architecture:** Integrate MCP via `@modelcontextprotocol/sdk` Streamable HTTP transport on the existing Express app at `/mcp`. Tools are thin wrappers around existing Mongoose models and services. MCP Apps are self-contained HTML bundles built with Vite + Recharts, served as `ui://` resources.

**Tech Stack:** `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`, Vite, Recharts, React (for apps only)

**Design doc:** `docs/plans/2026-02-15-mcp-server-design.md`

---

## Task 1: Install dependencies and scaffold directory structure

**Files:**
- Modify: `package.json` (root)
- Create: `server/mcp/index.js`
- Create: `server/mcp/tools/` (empty dir)
- Create: `server/mcp/apps/` (empty dir)
- Create: `mcp-apps/package.json`
- Create: `mcp-apps/vite.config.ts`
- Create: `mcp-apps/tsconfig.json`

**Step 1: Install MCP SDK packages in root project**

```bash
npm install @modelcontextprotocol/sdk @modelcontextprotocol/ext-apps
```

These get installed in the root project because the MCP server code runs inside the existing Express process.

**Step 2: Create MCP server directory structure**

```bash
mkdir -p server/mcp/tools server/mcp/apps
```

**Step 3: Create the MCP Apps project**

```bash
mkdir -p mcp-apps/src/shared
```

Create `mcp-apps/package.json`:
```json
{
  "name": "bank-explorer-mcp-apps",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch"
  }
}
```

Install MCP Apps dependencies:
```bash
cd mcp-apps && npm install react react-dom recharts @modelcontextprotocol/ext-apps && npm install -D vite vite-plugin-singlefile typescript @types/react @types/react-dom && cd ..
```

**Step 4: Create Vite config for multi-entry single-file build**

Create `mcp-apps/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readdirSync } from 'fs';
import { resolve } from 'path';

// Auto-discover all .html files in src/
const htmlFiles = readdirSync(resolve(__dirname, 'src'))
  .filter(f => f.endsWith('.html'))
  .reduce((entries, file) => {
    entries[file.replace('.html', '')] = resolve(__dirname, 'src', file);
    return entries;
  }, {} as Record<string, string>);

export default defineConfig({
  plugins: [viteSingleFile()],
  root: 'src',
  build: {
    outDir: '../dist',
    emptyDirBeforeWrite: true,
    rollupOptions: {
      input: htmlFiles,
    },
  },
});
```

Create `mcp-apps/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

**Step 5: Add build script to root package.json**

Add to the `"scripts"` section in `package.json`:
```json
"build:mcp-apps": "cd mcp-apps && npm run build"
```

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: scaffold MCP server and apps project structure"
```

---

## Task 2: Create MCP server core with Streamable HTTP transport

**Files:**
- Create: `server/mcp/index.js`
- Modify: `server/index.js` (add one line to mount MCP)

**Context:** The existing Express server is in `server/index.js`. It uses CommonJS (`require`). The MCP SDK is ESM-only, so we need dynamic `import()` in the mount function.

**Step 1: Create `server/mcp/index.js`**

This file creates the McpServer, registers all tools and app resources, and exposes a `mount(expressApp)` function.

```javascript
const path = require('path');
const fs = require('fs');

// Tool registration modules (loaded synchronously)
const bankTools = require('./tools/bankTools');
const researchTools = require('./tools/researchTools');
const tamTools = require('./tools/tamTools');
const ubprTools = require('./tools/ubprTools');
const strategicTools = require('./tools/strategicTools');
const ragTools = require('./tools/ragTools');

/**
 * Mount MCP server on an Express app at /mcp
 * Uses dynamic import() for ESM-only MCP SDK
 */
async function mount(expressApp) {
  // Dynamic import for ESM modules
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');

  const server = new McpServer({
    name: 'Bank Explorer',
    version: '1.0.0',
  });

  // Register all tools
  bankTools.register(server);
  researchTools.register(server);
  tamTools.register(server);
  ubprTools.register(server);
  strategicTools.register(server);
  ragTools.register(server);

  // Register MCP App resources
  try {
    const { registerApps } = await import('./apps/chartApps.js');
    // chartApps.js will be an ESM module since it uses ext-apps
    // We'll create it as .mjs or use dynamic import
  } catch (err) {
    console.log('MCP Apps not loaded (build mcp-apps first):', err.message);
  }

  // Mount Streamable HTTP endpoint
  expressApp.post('/mcp', async (req, res) => {
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless - no sessions needed for read-only
      });
      res.on('close', () => transport.close());
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('MCP request error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'MCP request failed' });
      }
    }
  });

  // Handle GET for SSE stream (server-to-client notifications)
  expressApp.get('/mcp', async (req, res) => {
    res.writeHead(405).end(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed. Use POST for MCP requests.' },
      id: null,
    }));
  });

  // Handle DELETE for session termination
  expressApp.delete('/mcp', async (req, res) => {
    res.writeHead(405).end(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Session management not supported (stateless server).' },
      id: null,
    }));
  });

  console.log('MCP server mounted at /mcp');
  return server;
}

module.exports = { mount };
```

**Step 2: Mount MCP in `server/index.js`**

Add after the existing route registrations (around line 59), before the health check:

```javascript
// MCP Server
const mcp = require('./mcp');
mcp.mount(app).catch(err => console.error('Failed to mount MCP server:', err));
```

**Step 3: Create stub tool registration files**

Each tool file exports a `register(server)` function. Start with stubs that we'll fill in subsequent tasks.

Create `server/mcp/tools/bankTools.js`:
```javascript
function register(server) {
  // Tools registered in Task 3
}

module.exports = { register };
```

Create identical stubs for: `researchTools.js`, `tamTools.js`, `ubprTools.js`, `strategicTools.js`, `ragTools.js`.

**Step 4: Test that the server starts without errors**

```bash
lsof -ti:5000 -ti:5001 | xargs kill -9 2>/dev/null; npm run server > /tmp/server.log 2>&1 &
```

Wait a few seconds, then check:
```bash
grep "MCP server mounted" /tmp/server.log
```

Expected: `MCP server mounted at /mcp`

**Step 5: Test MCP endpoint responds**

```bash
curl -s -X POST http://localhost:5000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | head -c 500
```

Expected: JSON response with server capabilities.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: MCP server core with Streamable HTTP transport"
```

---

## Task 3: Implement bank data tools (search-banks, get-bank-financials, get-time-series, get-peer-comparison)

**Files:**
- Modify: `server/mcp/tools/bankTools.js`

**Context:**
- `Institution` model has text index on `name` field. Use `$text: { $search }` for fuzzy search, scored by `{ $meta: 'textScore' }`.
- `FinancialStatement` model is keyed by `idrssd` + `reportingPeriod`. Get latest with `.sort({ reportingPeriod: -1 }).limit(1)`.
- Peer comparison data lives in `FinancialStatement.peerAnalysis`.
- Existing route patterns are in `server/routes/banks.js`.

**Step 1: Implement all four bank tools**

```javascript
const Institution = require('../../models/Institution');
const FinancialStatement = require('../../models/FinancialStatement');

function register(server) {
  // search-banks: fuzzy name search, returns ranked results
  server.tool(
    'search-banks',
    'Search for banks by name. Returns matching banks ranked by relevance with key financial metrics. Use this first to find a bank\'s idrssd ID, then use other tools with that ID.',
    {
      query: { type: 'string', description: 'Bank name to search for (fuzzy matching)' },
      state: { type: 'string', description: 'Optional 2-letter state code to filter by' },
      limit: { type: 'number', description: 'Max results to return (default 10)' },
    },
    async ({ query, state, limit = 10 }) => {
      try {
        const searchQuery = { $text: { $search: query } };
        if (state) searchQuery.state = state.toUpperCase();

        const institutions = await Institution.find(
          searchQuery,
          { score: { $meta: 'textScore' } }
        )
          .sort({ score: { $meta: 'textScore' } })
          .limit(limit)
          .lean();

        if (institutions.length === 0) {
          return { content: [{ type: 'text', text: `No banks found matching '${query}'.` }] };
        }

        // Get latest financial data for each match
        const idrssds = institutions.map(i => i.idrssd);
        const latestStatements = await FinancialStatement.aggregate([
          { $match: { idrssd: { $in: idrssds } } },
          { $sort: { reportingPeriod: -1 } },
          { $group: {
            _id: '$idrssd',
            reportingPeriod: { $first: '$reportingPeriod' },
            totalAssets: { $first: '$balanceSheet.assets.totalAssets' },
          }},
        ]);

        const fsMap = new Map(latestStatements.map(s => [s._id, s]));

        const results = institutions.map(inst => {
          const fs = fsMap.get(inst.idrssd);
          return {
            idrssd: inst.idrssd,
            name: inst.name,
            city: inst.city,
            state: inst.state,
            totalAssets: fs?.totalAssets || 0,
            latestPeriod: fs?.reportingPeriod?.toISOString().split('T')[0] || null,
          };
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error searching banks: ${error.message}` }], isError: true };
      }
    }
  );

  // get-bank-financials: full financial picture for a bank
  server.tool(
    'get-bank-financials',
    'Get complete financial data for a bank: balance sheet, income statement, ratios, credit quality, and loan categories. Defaults to the most recent reporting period.',
    {
      idrssd: { type: 'string', description: 'Bank ID (from search-banks results)' },
      reportingPeriod: { type: 'string', description: 'Optional reporting period (YYYY-MM-DD). Defaults to latest.' },
    },
    async ({ idrssd, reportingPeriod }) => {
      try {
        const institution = await Institution.findOne({ idrssd }).lean();
        if (!institution) {
          return { content: [{ type: 'text', text: `No bank found with idrssd '${idrssd}'.` }] };
        }

        const query = { idrssd };
        if (reportingPeriod) query.reportingPeriod = new Date(reportingPeriod);

        const fs = await FinancialStatement.findOne(query)
          .sort({ reportingPeriod: -1 })
          .lean();

        if (!fs) {
          return { content: [{ type: 'text', text: `No financial data found for bank ${idrssd}.` }] };
        }

        const result = {
          institution: {
            idrssd: institution.idrssd,
            name: institution.name,
            city: institution.city,
            state: institution.state,
          },
          reportingPeriod: fs.reportingPeriod?.toISOString().split('T')[0],
          balanceSheet: fs.balanceSheet,
          incomeStatement: fs.incomeStatement,
          ratios: fs.ratios,
          creditQuality: fs.creditQuality,
          loanCategories: fs.loanCategories,
          chargeOffsAndRecoveries: fs.chargeOffsAndRecoveries,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching financials: ${error.message}` }], isError: true };
      }
    }
  );

  // get-time-series: multi-quarter trend data
  server.tool(
    'get-time-series',
    'Get multi-quarter financial trend data for a bank. Returns time series of key metrics sorted oldest to newest. Use for trend analysis and charting.',
    {
      idrssd: { type: 'string', description: 'Bank ID' },
      periodCount: { type: 'number', description: 'Number of quarters to return (default 8)' },
    },
    async ({ idrssd, periodCount = 8 }) => {
      try {
        const statements = await FinancialStatement.find({ idrssd })
          .sort({ reportingPeriod: -1 })
          .limit(periodCount)
          .lean();

        if (statements.length === 0) {
          return { content: [{ type: 'text', text: `No financial data found for bank ${idrssd}.` }] };
        }

        // Sort oldest first for proper time-series ordering
        statements.sort((a, b) => new Date(a.reportingPeriod) - new Date(b.reportingPeriod));

        const institution = await Institution.findOne({ idrssd }).select('name').lean();

        const series = statements.map(fs => ({
          period: fs.reportingPeriod?.toISOString().split('T')[0],
          totalAssets: fs.balanceSheet?.assets?.totalAssets,
          totalLoans: fs.balanceSheet?.assets?.earningAssets?.loansAndLeases?.net,
          totalDeposits: fs.balanceSheet?.liabilities?.deposits?.total,
          totalEquity: fs.balanceSheet?.equity?.totalEquity,
          netIncome: fs.incomeStatement?.netIncome,
          netInterestIncome: fs.incomeStatement?.netInterestIncome,
          nim: fs.ratios?.netInterestMargin,
          roa: fs.ratios?.roa,
          roe: fs.ratios?.roe,
          efficiencyRatio: fs.ratios?.efficiencyRatio,
          operatingLeverage: fs.ratios?.operatingLeverage,
          tier1LeverageRatio: fs.ratios?.tier1LeverageRatio,
          nonperformingTotal: fs.creditQuality?.summary?.totalNonperforming,
          netChargeOffs: fs.chargeOffsAndRecoveries?.netChargeOffs?.total,
        }));

        const result = {
          bankName: institution?.name || idrssd,
          idrssd,
          periodCount: series.length,
          series,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching time series: ${error.message}` }], isError: true };
      }
    }
  );

  // get-peer-comparison: target bank vs 20 peers
  server.tool(
    'get-peer-comparison',
    'Compare a bank against its 20 asset-size peers across key financial ratios. Returns the target bank, peer averages, and individual peer data.',
    {
      idrssd: { type: 'string', description: 'Bank ID' },
    },
    async ({ idrssd }) => {
      try {
        // Get latest statement with peer analysis
        const targetStmt = await FinancialStatement.findOne({
          idrssd,
          'peerAnalysis.peers.peerIds.0': { $exists: true },
        })
          .sort({ reportingPeriod: -1 })
          .lean();

        if (!targetStmt || !targetStmt.peerAnalysis) {
          return { content: [{ type: 'text', text: `No peer analysis data found for bank ${idrssd}. Run peer analysis calculation first.` }] };
        }

        const peerIds = targetStmt.peerAnalysis.peers.peerIds || [];
        const allIds = [idrssd, ...peerIds];
        const period = targetStmt.reportingPeriod;

        // Get all peer statements for same period
        const statements = await FinancialStatement.find({
          idrssd: { $in: allIds },
          reportingPeriod: period,
        })
          .select('idrssd ratios balanceSheet.assets.totalAssets')
          .lean();

        const institutions = await Institution.find({ idrssd: { $in: allIds } })
          .select('idrssd name')
          .lean();
        const nameMap = new Map(institutions.map(i => [i.idrssd, i.name]));

        const banks = statements.map(stmt => ({
          idrssd: stmt.idrssd,
          name: nameMap.get(stmt.idrssd) || stmt.idrssd,
          isTarget: stmt.idrssd === idrssd,
          totalAssets: stmt.balanceSheet?.assets?.totalAssets,
          efficiencyRatio: stmt.ratios?.efficiencyRatio,
          roa: stmt.ratios?.roa,
          roe: stmt.ratios?.roe,
          nim: stmt.ratios?.netInterestMargin,
          operatingLeverage: stmt.ratios?.operatingLeverage,
          tier1LeverageRatio: stmt.ratios?.tier1LeverageRatio,
        }));

        const result = {
          period: period?.toISOString().split('T')[0],
          targetBank: idrssd,
          peerAverages: targetStmt.peerAnalysis.peerAverages,
          rankings: targetStmt.peerAnalysis.rankings,
          banks,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching peer comparison: ${error.message}` }], isError: true };
      }
    }
  );
}

module.exports = { register };
```

**Step 2: Restart server and test**

```bash
lsof -ti:5000 | xargs kill -9 2>/dev/null; npm run server > /tmp/server.log 2>&1 &
```

Wait for startup, then test `search-banks`:

```bash
curl -s -X POST http://localhost:5000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' > /dev/null

curl -s -X POST http://localhost:5000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | python3 -m json.tool | head -30
```

Expected: Should list `search-banks`, `get-bank-financials`, `get-time-series`, `get-peer-comparison`.

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: implement bank data MCP tools (search, financials, time-series, peers)"
```

---

## Task 4: Implement research tools (report, metadata, sources, podcast, presentation, term definition)

**Files:**
- Modify: `server/mcp/tools/researchTools.js`

**Context:**
- Research reports are stored in GridFS, not the ResearchReport model. Use `listFilesInGridFS` and `loadJsonFromGridFS` from `server/config/gridfs.js`.
- Podcast audio is also in GridFS. Return stream URL pattern: `/api/research/${idrssd}/podcast/stream/${filename}`.
- Sources use the `Source` model with static methods: `Source.getBySession()`, `Source.getByBank()`.
- Term definition calls the Anthropic API via the SDK.
- BankMetadata model has `.findOne({ idrssd })`.

**Step 1: Implement all six research tools**

The file should require: `Institution`, `BankMetadata`, `Source`, and the GridFS helpers (`getDocumentBucket`, `getAudioBucket`, `listFilesInGridFS`, `loadJsonFromGridFS` from `server/config/gridfs.js`). For `define-financial-term`, use the Anthropic SDK already in the project.

Key patterns for each tool:
- `get-research-report`: `listFilesInGridFS(getDocumentBucket(), { filename: { $regex: '^' + idrssd + '_.*\\.json$' } })` → sort by uploadDate desc → `loadJsonFromGridFS(getDocumentBucket(), files[0])` → return report data
- `get-bank-metadata`: `BankMetadata.findOne({ idrssd }).lean()` + `Institution.findOne({ idrssd }).lean()` → merge
- `get-sources`: `Source.findOne({ idrssd }).sort({ foundAt: -1 })` → get sessionId → `Source.getBySession(sessionId)`
- `get-podcast-info`: `listFilesInGridFS(getAudioBucket(), { filename: { $regex: '^(podcast_)?' + idrssd + '_.*\\.mp3$' } })` → sort → return metadata + streamUrl
- `get-presentation`: `listFilesInGridFS(getDocumentBucket(), { filename: regex })` → load JSON → return slide count + data
- `define-financial-term`: `new Anthropic().messages.create(...)` with banking term prompt

**Step 2: Test by listing tools and calling `get-bank-metadata` for a known bank**

```bash
curl -s -X POST http://localhost:5000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get-bank-metadata","arguments":{"idrssd":"852218"}}}' | python3 -m json.tool | head -40
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: implement research MCP tools (reports, metadata, sources, podcasts, presentations, terms)"
```

---

## Task 5: Implement TAM tools (dashboard, bank TAM, aggregate, pipeline, team sizing)

**Files:**
- Modify: `server/mcp/tools/tamTools.js`

**Context:**
- All TAM calculations go through `server/services/tamCalculationService.js` (singleton export).
- `calculateAllBanksTAM({ limit, minAssets, sortBy, sortOrder })` → returns banks array + aggregate
- `calculateBankTAM(idrssd, { period })` → returns detailed TAM for one bank
- `calculateTeamSizing({ targetBankCount })` → returns team sizing + covered banks
- `calculateCapacityBasedRevenue(coveredBanks, teamByTier, penetrationBySegment)` → capacity analysis
- `TeamRoster.getGlobalRoster()` → team roster

**Step 1: Implement all five TAM tools**

Each tool calls the tamCalculationService directly. Pattern:

```javascript
const tamService = require('../../services/tamCalculationService');
const TeamRoster = require('../../models/TeamRoster');

// get-tam-dashboard: tamService.calculateAllBanksTAM({ limit: 100 })
// get-bank-tam: tamService.calculateBankTAM(idrssd)
// get-tam-aggregate: tamService.calculateAllBanksTAM({ limit: 10000 }) → return .aggregate
// get-revenue-pipeline: tamService.calculateTeamSizing() → calculateCapacityBasedRevenue(...)
// get-team-sizing: tamService.calculateTeamSizing() → add capacity analysis
```

**Step 2: Test `get-tam-dashboard`**

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: implement TAM MCP tools (dashboard, bank TAM, aggregate, pipeline, team sizing)"
```

---

## Task 6: Implement UBPR, strategic priorities, and RAG tools

**Files:**
- Modify: `server/mcp/tools/ubprTools.js`
- Modify: `server/mcp/tools/strategicTools.js`
- Modify: `server/mcp/tools/ragTools.js`

**Context:**
- UBPR comparison: `FinancialStatement.findOne({ idrssd, reportingPeriod })` + `ubprService.fetchUBPRData(idrssd, period)`. If no period given, find latest period for the bank first.
- Strategic priorities: `StrategicPrioritiesAnalysis.getLatest()` for industry-wide. For bank-specific: also `BankMetadata.findOne({ idrssd })` and filter.
- RAG search: `groundingService.retrieveChunks(query, filters, limit)`. The grounding service handles embedding.

**Step 1: Implement UBPR tool**

`compare-ubpr`: Get latest period if not specified → fetch FinancialStatement + ubprService data → return comparison.

```javascript
const FinancialStatement = require('../../models/FinancialStatement');
const ubprService = require('../../services/ubprService');
const Institution = require('../../models/Institution');
```

**Step 2: Implement strategic priorities tools**

`get-strategic-priorities`: If idrssd provided, get bank-specific from BankMetadata + industry context. Otherwise return latest analysis.
`search-priorities`: Call `StrategicPrioritiesAnalysis.getLatest()`, then filter in-memory by query string.

```javascript
const StrategicPrioritiesAnalysis = require('../../models/StrategicPrioritiesAnalysis');
const BankMetadata = require('../../models/BankMetadata');
```

**Step 3: Implement RAG tool**

`search-documents`: Call `groundingService.retrieveChunks(query, { idrssd }, limit)`.

```javascript
const GroundingService = require('../../services/groundingService');
```

**Step 4: Test each tool with curl**

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: implement UBPR, strategic priorities, and RAG MCP tools"
```

---

## Task 7: Create shared MCP App theme and chart utilities

**Files:**
- Create: `mcp-apps/src/shared/theme.ts`
- Create: `mcp-apps/src/shared/chart-utils.ts`

**Step 1: Create theme constants**

`mcp-apps/src/shared/theme.ts`:
```typescript
export const COLORS = {
  primary: '#D97757',
  primaryLight: '#E8956F',
  primaryDark: '#C45E3F',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  // Chart palette
  chart: [
    '#D97757', '#4F46E5', '#059669', '#D97706',
    '#7C3AED', '#DC2626', '#0891B2', '#65A30D',
  ],
};

export const FONTS = {
  primary: '"Styrene A", system-ui, -apple-system, sans-serif',
  mono: '"SF Mono", "Fira Code", monospace',
};

export const CHART_DEFAULTS = {
  margin: { top: 20, right: 30, left: 20, bottom: 5 },
  height: 400,
  animationDuration: 300,
};
```

**Step 2: Create chart utility functions**

`mcp-apps/src/shared/chart-utils.ts`:
```typescript
import { COLORS, CHART_DEFAULTS } from './theme';

export function formatValue(value: number, format: string): string {
  switch (format) {
    case 'percent':
      return `${value.toFixed(2)}%`;
    case 'currency':
      if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
      if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
      if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
      return `$${value.toFixed(0)}`;
    default:
      return value.toLocaleString();
  }
}

export function getChartColor(index: number): string {
  return COLORS.chart[index % COLORS.chart.length];
}

export function parseToolResult(result: any): any {
  if (!result?.content) return null;
  const textContent = result.content.find((c: any) => c.type === 'text');
  if (!textContent?.text) return null;
  try {
    return JSON.parse(textContent.text);
  } catch {
    return textContent.text;
  }
}
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: create shared MCP App theme and chart utilities"
```

---

## Task 8: Build the Dynamic Chart MCP App

**Files:**
- Create: `mcp-apps/src/dynamic-chart.html`
- Create: `mcp-apps/src/dynamic-chart.tsx`

**Context:** This is the most important app — it renders any chart the agent constructs. The agent sends a JSON spec with chartType, data, series, axes, and this app renders it with Recharts.

**Step 1: Create the HTML entry point**

`mcp-apps/src/dynamic-chart.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bank Explorer Chart</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./dynamic-chart.tsx"></script>
</body>
</html>
```

**Step 2: Create the React chart renderer**

`mcp-apps/src/dynamic-chart.tsx` should:
1. Connect to the MCP host via `App` from `@modelcontextprotocol/ext-apps`
2. Parse the tool result to extract the chart spec
3. Dynamically render the appropriate Recharts component (`LineChart`, `BarChart`, `AreaChart`, `ScatterChart`, `PieChart`, or `ComposedChart`)
4. Apply the shared theme
5. Handle `app.callServerTool()` for refresh

The chart spec shape:
```typescript
interface ChartSpec {
  title: string;
  subtitle?: string;
  chartType: 'line' | 'bar' | 'area' | 'scatter' | 'pie' | 'composed';
  data: Record<string, any>[];
  series: { key: string; name: string; color?: string; type?: string }[];
  xAxis: { key: string; label?: string };
  yAxis: { label?: string; format?: 'percent' | 'currency' | 'number' };
  stacked?: boolean;
  height?: number;
}
```

Render logic: switch on `chartType`, create corresponding Recharts component with `<ResponsiveContainer>`, map `series` to `<Line>`, `<Bar>`, `<Area>`, etc.

**Step 3: Build and verify**

```bash
cd mcp-apps && npm run build && cd ..
ls mcp-apps/dist/dynamic-chart.html
```

Expected: File exists and is a single self-contained HTML file.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: create dynamic chart MCP App"
```

---

## Task 9: Build the Financial Trends MCP App

**Files:**
- Create: `mcp-apps/src/trends-chart.html`
- Create: `mcp-apps/src/trends-chart.tsx`

**Context:** This app renders when `get-time-series` is called. It receives the time series data and renders multi-metric trend charts. Reference the existing `client/src/components/TrendsTabCompact.jsx` for chart patterns.

**Step 1: Create HTML entry + React component**

The component should render:
- A header with bank name and period range
- Tabbed sections or a scrollable layout with:
  - Balance Sheet trends (total assets, loans, deposits) — AreaChart
  - Profitability trends (NIM, ROA, ROE) — LineChart
  - Efficiency + Operating Leverage — LineChart (note: efficiency lower is better)
  - Credit quality trends (nonperforming, net charge-offs) — BarChart
- Tooltips with formatted values
- Legend with series toggles

Data comes from the `get-time-series` tool result shape:
```typescript
{ bankName: string, idrssd: string, periodCount: number, series: TimeSeriesPoint[] }
```

**Step 2: Build and verify**

```bash
cd mcp-apps && npm run build && cd ..
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: create financial trends MCP App"
```

---

## Task 10: Build the Peer Comparison MCP App

**Files:**
- Create: `mcp-apps/src/peer-comparison.html`
- Create: `mcp-apps/src/peer-comparison.tsx`

**Context:** Renders when `get-peer-comparison` is called. Shows the target bank highlighted against its 20 peers. Reference `client/src/components/PeerComparisonTab.jsx`.

**Step 1: Create HTML entry + React component**

Should render:
- Bank name as header with "vs 20 Peers" subtitle
- Bar charts for each ratio: ROA, ROE, NIM, Efficiency Ratio, Operating Leverage, Tier 1 Leverage
- Target bank bar highlighted in primary color (#D97757), peers in gray
- Peer average line shown as reference
- Rankings displayed (e.g., "Rank: 3/21, 86th percentile")

**Step 2: Build and verify**

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: create peer comparison MCP App"
```

---

## Task 11: Build the Credit Quality and TAM Dashboard MCP Apps

**Files:**
- Create: `mcp-apps/src/credit-quality.html`
- Create: `mcp-apps/src/credit-quality.tsx`
- Create: `mcp-apps/src/tam-dashboard.html`
- Create: `mcp-apps/src/tam-dashboard.tsx`

**Step 1: Credit Quality app**

Renders from `get-bank-financials` result. Shows:
- Stacked bar chart: delinquency buckets (30-89 days, 90+ days, nonaccrual) by loan category
- Charge-offs vs recoveries bar chart
- Summary cards with total nonperforming ratios

**Step 2: TAM Dashboard app**

Renders from `get-bank-tam` result. Shows:
- Area chart: TAM by product over 12 quarters
- Penetration progress bars by segment
- Revenue summary cards

**Step 3: Build all apps**

```bash
cd mcp-apps && npm run build && cd ..
ls mcp-apps/dist/
```

Expected: `dynamic-chart.html`, `trends-chart.html`, `peer-comparison.html`, `credit-quality.html`, `tam-dashboard.html`

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: create credit quality and TAM dashboard MCP Apps"
```

---

## Task 12: Register MCP App resources and wire up tool UI metadata

**Files:**
- Create: `server/mcp/apps/chartApps.js`
- Modify: `server/mcp/index.js` (load chart apps)
- Modify: `server/mcp/tools/bankTools.js` (add `_meta.ui` to tools)

**Context:** MCP Apps need two things:
1. Resources registered with `ui://` URIs that serve the built HTML
2. Tools with `_meta.ui.resourceUri` pointing to those resources

**Step 1: Create `server/mcp/apps/chartApps.js`**

```javascript
const fs = require('fs');
const path = require('path');

const APPS_DIR = path.join(__dirname, '..', '..', '..', 'mcp-apps', 'dist');

const APP_RESOURCES = [
  { name: 'trends-chart', uri: 'ui://bank-explorer/trends-chart.html', file: 'trends-chart.html' },
  { name: 'peer-comparison', uri: 'ui://bank-explorer/peer-comparison.html', file: 'peer-comparison.html' },
  { name: 'credit-quality', uri: 'ui://bank-explorer/credit-quality.html', file: 'credit-quality.html' },
  { name: 'tam-dashboard', uri: 'ui://bank-explorer/tam-dashboard.html', file: 'tam-dashboard.html' },
  { name: 'dynamic-chart', uri: 'ui://bank-explorer/dynamic-chart.html', file: 'dynamic-chart.html' },
];

function register(server) {
  for (const app of APP_RESOURCES) {
    const filePath = path.join(APPS_DIR, app.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`MCP App HTML not found: ${filePath} (run npm run build:mcp-apps)`);
      continue;
    }

    server.resource(
      app.name,
      app.uri,
      { mimeType: 'text/html' },
      async () => {
        const html = fs.readFileSync(filePath, 'utf-8');
        return {
          contents: [{ uri: app.uri, mimeType: 'text/html', text: html }],
        };
      }
    );
  }
}

module.exports = { register };
```

**Step 2: Wire up chart apps in `server/mcp/index.js`**

Replace the try/catch block for chart apps with:
```javascript
const chartApps = require('./apps/chartApps');
chartApps.register(server);
```

**Step 3: Add `_meta.ui.resourceUri` to relevant tools**

Update tool registrations in bankTools.js, tamTools.js to include the UI metadata. For example, in `get-time-series`:

The `server.tool()` call needs the `_meta` in the tool description object. Check the SDK API — if `server.tool()` doesn't directly support `_meta`, use `registerAppTool` from `@modelcontextprotocol/ext-apps/server` instead.

For tools with apps:
- `get-time-series` → `ui://bank-explorer/trends-chart.html`
- `get-peer-comparison` → `ui://bank-explorer/peer-comparison.html`
- `get-bank-financials` → `ui://bank-explorer/credit-quality.html`
- `get-bank-tam` → `ui://bank-explorer/tam-dashboard.html`
- `render-chart` → `ui://bank-explorer/dynamic-chart.html`

**Step 4: Add `render-chart` tool**

Add to `bankTools.js` (or a new file):

```javascript
server.tool(
  'render-chart',
  'Render a custom interactive chart from a JSON specification. Use this to visualize any data you have.',
  {
    title: { type: 'string', description: 'Chart title' },
    chartType: { type: 'string', description: 'line, bar, area, scatter, pie, or composed' },
    data: { type: 'array', description: 'Array of data points' },
    series: { type: 'array', description: 'Array of {key, name, color?, type?} for each data series' },
    xAxis: { type: 'object', description: '{key, label} for X axis' },
    yAxis: { type: 'object', description: '{label, format} where format is percent|currency|number' },
    subtitle: { type: 'string', description: 'Optional subtitle' },
    stacked: { type: 'boolean', description: 'Stack series (default false)' },
    height: { type: 'number', description: 'Chart height in pixels (default 400)' },
  },
  async (args) => {
    return {
      content: [{ type: 'text', text: JSON.stringify(args, null, 2) }],
    };
  }
);
```

**Step 5: Build apps, restart server, test**

```bash
npm run build:mcp-apps
lsof -ti:5000 | xargs kill -9 2>/dev/null; npm run server > /tmp/server.log 2>&1 &
```

Test that resources are listed:
```bash
curl -s -X POST http://localhost:5000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"resources/list","params":{}}' | python3 -m json.tool
```

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: register MCP App resources and wire tool UI metadata"
```

---

## Task 13: End-to-end testing and polish

**Files:**
- Possibly modify: any files with bugs found during testing

**Step 1: Test full tool catalog via MCP protocol**

Test each tool with curl against the `/mcp` endpoint. Verify:
1. `tools/list` returns all 20 tools with descriptions
2. `search-banks` returns results for "webster", "truist", "jpmorgan"
3. `get-bank-financials` returns full data for a known idrssd
4. `get-time-series` returns sorted data (oldest first)
5. `get-peer-comparison` returns target + peers
6. `get-research-report` returns report data (if reports exist)
7. `get-bank-metadata` returns metadata
8. `get-strategic-priorities` returns analysis
9. `search-documents` returns RAG results
10. `render-chart` returns the spec back
11. `resources/list` shows all 5 app resources

**Step 2: Test MCP Apps render**

If you have the ext-apps basic-host available:
```bash
git clone https://github.com/modelcontextprotocol/ext-apps.git /tmp/ext-apps
cd /tmp/ext-apps/examples/basic-host && npm install
SERVERS='["http://localhost:5000/mcp"]' npm start
```

Navigate to `http://localhost:8080` and test each tool that has a UI resource.

**Step 3: Add `.gitignore` entries**

Add to root `.gitignore`:
```
mcp-apps/dist/
mcp-apps/node_modules/
```

**Step 4: Update `nodemon.json` to ignore mcp-apps**

Add `mcp-apps/**` to the ignore list so Vite rebuilds don't trigger server restarts.

**Step 5: Final commit**

```bash
git add -A && git commit -m "feat: MCP server and apps complete - end-to-end tested"
```

---

## Summary

| Task | What | Estimated Steps |
|------|------|-----------------|
| 1 | Dependencies + scaffold | 6 |
| 2 | MCP server core + Express mount | 6 |
| 3 | Bank data tools (4 tools) | 3 |
| 4 | Research tools (6 tools) | 3 |
| 5 | TAM tools (5 tools) | 3 |
| 6 | UBPR + strategic + RAG tools (4 tools) | 5 |
| 7 | Shared theme + chart utils | 3 |
| 8 | Dynamic chart app | 4 |
| 9 | Financial trends app | 3 |
| 10 | Peer comparison app | 3 |
| 11 | Credit quality + TAM apps | 4 |
| 12 | Wire apps to tools + render-chart | 6 |
| 13 | E2E testing + polish | 5 |
| **Total** | **20 tools + 5 apps** | **54 steps** |
