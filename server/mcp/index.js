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
 * Mount MCP server on an Express app at /mcp
 * Uses dynamic import() for ESM-only MCP SDK
 */
async function mount(expressApp) {
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');

  const server = new McpServer({
    name: 'Bank Explorer',
    version: '1.0.0',
  });

  // Register all data tools
  bankTools.register(server);
  researchTools.register(server);
  tamTools.register(server);
  ubprTools.register(server);
  strategicTools.register(server);
  ragTools.register(server);

  // Register render-chart tool (generic dynamic chart)
  server.registerTool(
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
  chartApps.register(server);

  // Mount Streamable HTTP endpoint
  expressApp.post('/mcp', async (req, res) => {
    try {
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

  // OAuth Protected Resource Metadata (RFC 9728)
  // Claude.ai probes these endpoints to discover auth requirements.
  // Return 404 to signal this is an unauthenticated server.
  expressApp.get('/.well-known/oauth-protected-resource', (req, res) => {
    res.status(404).json({ error: 'This MCP server does not require authentication.' });
  });
  expressApp.get('/.well-known/oauth-protected-resource/mcp', (req, res) => {
    res.status(404).json({ error: 'This MCP server does not require authentication.' });
  });
  expressApp.get('/.well-known/oauth-authorization-server', (req, res) => {
    res.status(404).json({ error: 'This MCP server does not require authentication.' });
  });
  expressApp.get('/.well-known/openid-configuration', (req, res) => {
    res.status(404).json({ error: 'This MCP server does not require authentication.' });
  });

  console.log('MCP server mounted at /mcp');
  return server;
}

module.exports = { mount };
