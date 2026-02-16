const fs = require('fs');
const path = require('path');

const APPS_DIR = path.join(__dirname, '..', '..', '..', 'mcp-apps', 'dist');

const MIME_TYPE = 'text/html;profile=mcp-app';

const APP_RESOURCES = [
  { name: 'trends-chart', uri: 'ui://bank-explorer/trends-chart.html', file: 'trends-chart.html' },
  { name: 'peer-comparison', uri: 'ui://bank-explorer/peer-comparison.html', file: 'peer-comparison.html' },
  { name: 'credit-quality', uri: 'ui://bank-explorer/credit-quality.html', file: 'credit-quality.html' },
  { name: 'tam-dashboard', uri: 'ui://bank-explorer/tam-dashboard.html', file: 'tam-dashboard.html' },
  { name: 'dynamic-chart', uri: 'ui://bank-explorer/dynamic-chart.html', file: 'dynamic-chart.html' },
  { name: 'research-report', uri: 'ui://bank-explorer/research-report.html', file: 'research-report.html' },
];

/**
 * Register MCP App resources with the correct MIME type.
 * @param {object} server - McpServer instance
 * @param {function} [registerAppResource] - Optional ext-apps helper (ESM import)
 */
function register(server, registerAppResource) {
  for (const app of APP_RESOURCES) {
    const filePath = path.join(APPS_DIR, app.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`MCP App not found: ${app.file} (run npm run build:mcp-apps)`);
      continue;
    }

    const readCallback = async () => {
      const html = fs.readFileSync(filePath, 'utf-8');
      return {
        contents: [{ uri: app.uri, mimeType: MIME_TYPE, text: html }],
      };
    };

    if (registerAppResource) {
      // Use the official ext-apps helper (handles metadata normalization)
      registerAppResource(server, app.name, app.uri, {}, readCallback);
    } else {
      // Fallback to raw SDK method
      server.resource(app.name, app.uri, { mimeType: MIME_TYPE }, readCallback);
    }
  }
}

module.exports = { register };
