const path = require('path');
const fs = require('fs');

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
        title: { type: 'string', description: 'Chart title' },
        chartType: { type: 'string', description: 'Chart type: line, bar, area, scatter, pie, or composed' },
        data: { type: 'array', description: 'Array of data points (objects with keys matching series)' },
        series: { type: 'array', description: 'Array of {key, name, color?, type?} for each data series' },
        xAxis: { type: 'object', description: '{key, label} for X axis' },
        yAxis: { type: 'object', description: '{label, format} where format is percent|currency|number' },
        subtitle: { type: 'string', description: 'Optional subtitle' },
        stacked: { type: 'boolean', description: 'Stack series (default false)' },
        height: { type: 'number', description: 'Chart height in pixels (default 400)' },
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

  // GET/DELETE not supported for stateless server
  expressApp.get('/mcp', (req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed. Use POST for MCP requests.' },
      id: null,
    });
  });

  expressApp.delete('/mcp', (req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Session management not supported (stateless server).' },
      id: null,
    });
  });

  console.log('MCP server mounted at /mcp');
  return server;
}

module.exports = { mount };
