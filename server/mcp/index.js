const path = require('path');
const fs = require('fs');
const { z } = require('zod');

// Tool registration modules
const bankTools = require('./tools/bankTools');
const researchTools = require('./tools/researchTools');
const tamTools = require('./tools/tamTools');
const ubprTools = require('./tools/ubprTools');
const strategicTools = require('./tools/strategicTools');
const ragTools = require('./tools/ragTools');
const chartApps = require('./apps/chartApps');

/**
 * Create a fresh McpServer instance with all tools and resources registered.
 * A new instance is needed per request for stateless (sessionless) operation,
 * because McpServer.connect() can only be called once per instance.
 *
 * @param {Function} McpServer - McpServer constructor (ESM import)
 * @param {Function} registerAppTool - ext-apps helper for tool registration
 * @param {Function} registerAppResource - ext-apps helper for resource registration
 */
function createServer(McpServer, registerAppTool, registerAppResource) {
  const server = new McpServer({
    name: 'Bank Explorer',
    version: '1.0.0',
  });

  // Register all data tools (pass registerAppTool to modules that have UI-linked tools)
  bankTools.register(server, registerAppTool);
  researchTools.register(server, registerAppTool);
  tamTools.register(server, registerAppTool);
  ubprTools.register(server);
  strategicTools.register(server);
  ragTools.register(server);

  // Register render-chart tool using ext-apps helper
  registerAppTool(
    server,
    'render-chart',
    {
      title: 'Render Chart',
      description: 'Render a custom interactive chart from a JSON specification. Use this to visualize any data — the agent constructs the chart spec and an interactive Recharts chart is rendered for the user.',
      inputSchema: {
        title: z.string().describe('Chart title'),
        chartType: z.string().describe('Chart type: line, bar, area, scatter, pie, or composed'),
        data: z.array(z.record(z.string(), z.unknown())).describe('Array of data points (objects with keys matching series)'),
        series: z.array(z.object({ key: z.string(), name: z.string(), color: z.string().optional(), type: z.string().optional() })).describe('Array of series definitions'),
        xAxis: z.object({ key: z.string(), label: z.string() }).describe('X axis configuration'),
        yAxis: z.object({ label: z.string(), format: z.string().optional() }).describe('Y axis configuration (format: percent|currency|number)'),
        subtitle: z.string().optional().describe('Optional subtitle'),
        stacked: z.boolean().optional().describe('Stack series (default false)'),
        height: z.number().optional().describe('Chart height in pixels (default 400)'),
      },
      _meta: { ui: { resourceUri: 'ui://bank-explorer/dynamic-chart.html' } },
    },
    async (args) => {
      return {
        content: [{ type: 'text', text: JSON.stringify(args, null, 2) }],
      };
    }
  );

  // Register MCP App resources (serves built HTML files)
  chartApps.register(server, registerAppResource);

  return server;
}

/**
 * Mount MCP server on an Express app at /mcp
 * Uses dynamic import() for ESM-only MCP SDK and ext-apps
 */
async function mount(expressApp) {
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
  const { registerAppTool, registerAppResource } = await import('@modelcontextprotocol/ext-apps/server');

  // Mount Streamable HTTP endpoint
  // Each request gets a fresh McpServer instance (stateless, no sessions)
  expressApp.post('/mcp', async (req, res) => {
    try {
      const server = createServer(McpServer, registerAppTool, registerAppResource);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
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

  // Handle GET /mcp — required by MCP spec for SSE fallback discovery.
  // Respond with 405 + proper headers so clients know to use POST.
  expressApp.get('/mcp', (req, res) => {
    res.status(405).set('Allow', 'POST').json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed. Use POST for MCP requests.' },
      id: null,
    });
  });

  expressApp.delete('/mcp', (req, res) => {
    res.status(405).set('Allow', 'POST').json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Session management not supported (stateless server).' },
      id: null,
    });
  });

  console.log('MCP server mounted at /mcp');
}

module.exports = { mount };
