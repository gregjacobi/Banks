#!/usr/bin/env node

/**
 * Test script for SSE metadata gathering endpoint
 * Connects to /api/research/:idrssd/gather-metadata and logs events
 */

const https = require('https');
const http = require('http');

const IDRSSD = '852218'; // JPMorgan Chase
const BASE_URL = 'http://localhost:5001';

console.log('\n='.repeat(80));
console.log('TESTING SSE METADATA GATHERING ENDPOINT');
console.log('='.repeat(80));
console.log(`Bank: ${IDRSSD} (JPMorgan Chase)`);
console.log(`Endpoint: ${BASE_URL}/api/research/${IDRSSD}/gather-metadata`);
console.log('='.repeat(80));
console.log('');

const url = new URL(`${BASE_URL}/api/research/${IDRSSD}/gather-metadata`);

const req = http.request({
  hostname: url.hostname,
  port: url.port,
  path: url.pathname,
  method: 'GET',
  headers: {
    'Accept': 'text/event-stream',
    'Cache-Control': 'no-cache'
  }
}, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log('');

  let buffer = '';

  res.on('data', (chunk) => {
    buffer += chunk.toString();

    // Process complete events (separated by double newlines)
    const events = buffer.split('\n\n');
    buffer = events.pop(); // Keep incomplete event in buffer

    events.forEach(event => {
      if (event.trim()) {
        const lines = event.split('\n');
        lines.forEach(line => {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              const timestamp = new Date().toISOString().substring(11, 19);

              // Format output based on event type
              if (data.type === 'started') {
                console.log(`[${timestamp}] 🚀 ${data.message}`);
              } else if (data.type === 'progress') {
                console.log(`[${timestamp}] 📊 Progress: ${data.step}/${data.total} - ${data.message}`);
              } else if (data.type === 'logo-complete') {
                console.log(`[${timestamp}] ${data.success ? '✓' : '✗'} Logo: ${data.message}`);
              } else if (data.type === 'ticker-complete') {
                if (data.success) {
                  console.log(`[${timestamp}] ✓ Ticker: ${data.symbol} (${data.exchange})`);
                } else {
                  console.log(`[${timestamp}] ✗ Ticker: ${data.message}`);
                }
              } else if (data.type === 'orgchart-complete') {
                if (data.success) {
                  console.log(`[${timestamp}] ✓ Org Chart: ${data.executives} executives, ${data.boardMembers} board members`);
                } else {
                  console.log(`[${timestamp}] ✗ Org Chart: ${data.message}`);
                }
              } else if (data.type === 'completed') {
                console.log(`[${timestamp}] ✅ ${data.message}`);
                console.log('');
                console.log('Results:');
                console.log(`  Logo:      ${data.results.logo ? '✓' : '✗'}`);
                console.log(`  Ticker:    ${data.results.ticker ? '✓' : '✗'}`);
                console.log(`  Org Chart: ${data.results.orgChart ? '✓' : '✗'}`);
              } else if (data.type === 'error') {
                console.log(`[${timestamp}] ❌ Error: ${data.message}`);
                if (data.error) {
                  console.log(`   ${data.error}`);
                }
              }
            } catch (e) {
              console.error('Failed to parse event:', line);
            }
          }
        });
      }
    });
  });

  res.on('end', () => {
    console.log('');
    console.log('='.repeat(80));
    console.log('SSE CONNECTION CLOSED');
    console.log('='.repeat(80));
    console.log('');
  });
});

req.on('error', (error) => {
  console.error('Request error:', error.message);
  process.exit(1);
});

// Set timeout
req.setTimeout(120000, () => {
  console.error('Request timed out after 2 minutes');
  req.destroy();
  process.exit(1);
});

req.end();
