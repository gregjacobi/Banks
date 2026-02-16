# MCP Server & Apps Design for Bank Explorer

**Date:** 2026-02-15
**Status:** Approved

## Overview

Expose all Bank Explorer data and insights as a remote MCP server with interactive chart visualization via MCP Apps. The MCP layer integrates into the existing Express server on port 5001, sharing DB connections, models, and services. Read-only access only.

## Architecture

### Project Structure

```
Banks/
├── server/
│   ├── mcp/
│   │   ├── index.js              # McpServer setup, Express mount at /mcp
│   │   ├── tools/
│   │   │   ├── bankTools.js       # Bank search, detail, financials
│   │   │   ├── researchTools.js   # Reports, metadata, sources, podcasts
│   │   │   ├── tamTools.js        # TAM calculations, pipeline, team sizing
│   │   │   ├── ubprTools.js       # UBPR comparison data
│   │   │   ├── strategicTools.js  # Strategic priorities
│   │   │   └── ragTools.js        # RAG/grounding search
│   │   └── apps/
│   │       └── chartApps.js       # MCP App resource registrations
│   ├── index.js                   # adds: require('./mcp').mount(app)
│   └── ...existing
├── mcp-apps/
│   ├── package.json               # Vite + Recharts + ext-apps
│   ├── vite.config.ts
│   └── src/
│       ├── trends-chart.html      # Financial trends app
│       ├── trends-chart.ts
│       ├── peer-comparison.html   # Peer comparison app
│       ├── peer-comparison.ts
│       ├── credit-quality.html    # Credit quality app
│       ├── credit-quality.ts
│       ├── tam-dashboard.html     # TAM visualization app
│       ├── tam-dashboard.ts
│       ├── dynamic-chart.html     # Generic chart renderer
│       ├── dynamic-chart.ts
│       └── shared/
│           ├── theme.ts           # Anthropic branding
│           └── chart-utils.ts     # Shared Recharts config
```

### Key Decisions

- **Integrated on existing Express server** — single `/mcp` endpoint, shares MongoDB connection and all existing models/services
- **Streamable HTTP transport** — stateless, no session management (read-only server)
- **Tools are thin wrappers** around existing Mongoose models and service calls — no business logic duplication
- **MCP Apps built with Vite + vite-plugin-singlefile** — produces self-contained HTML bundles served as `ui://` resources
- **Same charting library (Recharts)** as the existing React client

### Dependencies

Server (added to root `package.json`):
- `@modelcontextprotocol/sdk`
- `@modelcontextprotocol/ext-apps`

MCP Apps (`mcp-apps/package.json`):
- `vite`, `vite-plugin-singlefile`
- `recharts`, `react`, `react-dom`
- `@modelcontextprotocol/ext-apps` (client-side App class)

## MCP Tools (19 tools, all read-only)

### Conventions

- `idrssd` is always required (agent resolves via `search-banks` first)
- All tools default to the **most recent reporting period** unless `reportingPeriod` is explicitly passed
- `search-banks` supports fuzzy name matching

### Bank Data Tools (`bankTools.js`)

| Tool | Input | Returns |
|------|-------|---------|
| `search-banks` | `query` (fuzzy name), optional `state`, `limit` (default 10) | Matching banks ranked by relevance (name, idrssd, city, state, total assets, latest period) |
| `get-bank-financials` | `idrssd`, optional `reportingPeriod` | Full picture: institution info, balance sheet, income statement, ratios, credit quality, loan categories |
| `get-time-series` | `idrssd`, optional `metrics[]`, `periodCount` (default 8) | Multi-quarter trend data; all metrics if none specified |
| `get-peer-comparison` | `idrssd` | Target bank vs 20 peers across key ratios |

### Research Tools (`researchTools.js`)

| Tool | Input | Returns |
|------|-------|---------|
| `get-research-report` | `idrssd` | Latest AI research report |
| `get-bank-metadata` | `idrssd` | Logo, ticker, org chart, strategic insights with citations |
| `get-sources` | `idrssd` | External sources discovered for this bank |
| `get-podcast-info` | `idrssd` | Latest podcast metadata + audio URL |
| `get-presentation` | `idrssd` | Latest generated presentation data |
| `define-financial-term` | `term` | Claude-powered financial term definition |

### TAM Tools (`tamTools.js`)

| Tool | Input | Returns |
|------|-------|---------|
| `get-tam-dashboard` | none | All banks with TAM calculations |
| `get-bank-tam` | `idrssd` | Detailed TAM for one bank (by product, segment) |
| `get-tam-aggregate` | none | Portfolio-level totals |
| `get-revenue-pipeline` | none | Forecast vs capacity |
| `get-team-sizing` | none | Team sizing + roster with hiring plan |

### UBPR Tools (`ubprTools.js`)

| Tool | Input | Returns |
|------|-------|---------|
| `compare-ubpr` | `idrssd` | Calculated vs UBPR metric comparison (latest period) |

### Strategic Priorities Tools (`strategicTools.js`)

| Tool | Input | Returns |
|------|-------|---------|
| `get-strategic-priorities` | optional `idrssd` | Industry-wide if no idrssd, bank-specific with industry context if provided |
| `search-priorities` | `query` | Search priorities by keyword |

### RAG Tools (`ragTools.js`)

| Tool | Input | Returns |
|------|-------|---------|
| `search-documents` | `query`, optional `idrssd`, `limit` | Vector similarity search across grounding docs |

## MCP Apps (5 interactive chart apps)

### Pre-built Apps

| App | Triggered by tool | Visualization |
|-----|-------------------|---------------|
| **Financial Trends** | `get-time-series` | Area/line charts: NIM, ROA, ROE, efficiency ratio, assets, loans, deposits over quarters |
| **Peer Comparison** | `get-peer-comparison` | Bar charts: target bank vs peer averages across key ratios |
| **Credit Quality** | `get-bank-financials` | Stacked bars: delinquency buckets by loan type, charge-off trends |
| **TAM Dashboard** | `get-bank-tam` | Area chart: 12-quarter TAM projections by product, penetration curves |

### Dynamic Chart App

| App | Tool | Visualization |
|-----|------|---------------|
| **Dynamic Chart** | `render-chart` | Any chart built from agent-constructed JSON spec |

The `render-chart` tool accepts:
```
render-chart:
  title: string
  chartType: "line" | "bar" | "area" | "scatter" | "pie" | "composed"
  data: [{ label: "Q1 2024", value1: 3.2, value2: 2.9 }, ...]
  series: [{ key: "value1", name: "Display Name", color: "#D97757", type?: "line" }, ...]
  xAxis: { key: "label", label: "Quarter" }
  yAxis: { label: "Metric (%)", format: "percent" | "currency" | "number" }
  optional:
    subtitle: string
    stacked: boolean
    height: number
```

### App Data Flow

1. Agent calls a tool (e.g. `get-time-series`)
2. Tool returns raw data as JSON text (agent can reason about it)
3. Tool's `_meta.ui.resourceUri` points to the app (e.g. `ui://bank-explorer/trends-chart.html`)
4. Host fetches the HTML resource, renders in sandboxed iframe
5. App receives tool result via `app.ontoolresult`, parses data, renders Recharts charts
6. User can interact: hover tooltips, toggle metrics, drill down

### Shared Theme

All apps use Anthropic branding:
- Primary: `#D97757` (coral)
- Text: `#1A1A1A`
- Background: `#FAFAFA`
- Font: Styrene A with system sans-serif fallback

## Error Handling

- **Bank not found:** "No bank found matching '{query}'. Try a different name."
- **No data for period:** Returns latest available with note: "No data for Q3 2025. Returning latest: Q2 2025."
- **MongoDB errors:** Standard MCP error response with `isError: true`
- **App render errors:** Fallback message in iframe ("Unable to render chart")
- **Missing built HTML:** Error logged at server startup if `mcp-apps/dist/` files not found

## Build & Dev Workflow

### New npm scripts (root package.json)

- `npm run build:mcp-apps` — Vite build in `mcp-apps/`

### Dev workflow

1. Edit MCP tools in `server/mcp/` — nodemon auto-restarts
2. Edit MCP App UIs in `mcp-apps/src/` — run `npm run build:mcp-apps`
3. Test with any MCP client at `http://localhost:5001/mcp`

### Integration point

Single line added to `server/index.js`:
```javascript
require('./mcp').mount(app);
```

No other changes to existing code.
