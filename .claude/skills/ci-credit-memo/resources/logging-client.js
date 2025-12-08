#!/usr/bin/env node

/**
 * Google Cloud Logging Client for Claude Code Skills
 *
 * This module provides structured logging to Google Cloud Logging
 * for audit trail and event tracking in credit analysis workflows.
 *
 * Configuration:
 * - GCP_PROJECT_ID: Your Google Cloud project ID
 * - GCP_LOG_NAME: Log name (default: claude-credit-skills)
 * - GCP_AUTH_TOKEN: OAuth2 access token or service account key
 *
 * Usage:
 *   const { logEvent } = require('./logging-client');
 *   await logEvent('CREDIT_MEMO_GENERATED', { borrower, loanAmount, riskRating });
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  projectId: process.env.GCP_PROJECT_ID,
  logName: process.env.GCP_LOG_NAME || 'claude-credit-skills',
  authToken: process.env.GCP_AUTH_TOKEN,
  timeout: 5000, // 5 second timeout
  retries: 2
};

// Local fallback logging
const LOCAL_LOG_DIR = process.env.LOCAL_LOG_DIR || '/tmp/claude-credit-logs';
const LOCAL_LOG_FILE = path.join(LOCAL_LOG_DIR, 'audit-trail.jsonl');

/**
 * Ensure local log directory exists
 */
function ensureLogDirectory() {
  if (!fs.existsSync(LOCAL_LOG_DIR)) {
    fs.mkdirSync(LOCAL_LOG_DIR, { recursive: true });
  }
}

/**
 * Write log entry to local file (fallback/redundancy)
 */
function logLocally(entry) {
  try {
    ensureLogDirectory();
    const logLine = JSON.stringify(entry) + '\n';
    fs.appendFileSync(LOCAL_LOG_FILE, logLine);
  } catch (error) {
    // Last resort - write to stderr
    console.error('[LOGGING ERROR]', error.message);
  }
}

/**
 * Generate correlation ID for tracking related events
 */
function generateCorrelationId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Send log entry to Google Cloud Logging
 *
 * @param {string} logName - Name of the log
 * @param {object} entry - Log entry to send
 * @returns {Promise<boolean>} - Success status
 */
async function sendToGCP(logName, entry) {
  if (!config.projectId || !config.authToken) {
    throw new Error('GCP_PROJECT_ID and GCP_AUTH_TOKEN environment variables required');
  }

  const url = `https://logging.googleapis.com/v2/entries:write`;

  const payload = JSON.stringify({
    logName: `projects/${config.projectId}/logs/${logName}`,
    resource: {
      type: 'generic_task',
      labels: {
        project_id: config.projectId,
        task_id: 'claude-code-skill'
      }
    },
    entries: [
      {
        severity: entry.severity || 'INFO',
        timestamp: new Date().toISOString(),
        jsonPayload: entry.data,
        labels: entry.labels || {}
      }
    ]
  });

  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.authToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: config.timeout
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          reject(new Error(`GCP Logging API error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Log an event with automatic retry and fallback
 *
 * @param {string} eventType - Type of event (e.g., 'CREDIT_MEMO_GENERATED')
 * @param {object} data - Event data
 * @param {object} options - Optional parameters
 * @returns {Promise<boolean>} - Success status
 */
async function logEvent(eventType, data, options = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    eventType,
    correlationId: options.correlationId || generateCorrelationId(),
    severity: options.severity || 'INFO',
    data: {
      ...data,
      skill: options.skill || 'unknown',
      user: options.user || process.env.USER || 'unknown',
      hostname: require('os').hostname()
    },
    labels: {
      eventType,
      skill: options.skill || 'unknown'
    }
  };

  // Always log locally first (redundancy)
  logLocally(entry);

  // Attempt to send to GCP with retry
  if (config.projectId && config.authToken) {
    let attempts = 0;
    while (attempts < config.retries) {
      try {
        await sendToGCP(config.logName, entry);
        return true;
      } catch (error) {
        attempts++;
        if (attempts >= config.retries) {
          console.error(`[LOGGING] Failed to send to GCP after ${attempts} attempts:`, error.message);
          return false;
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  }

  return true; // Local logging succeeded even if GCP failed
}

/**
 * Log credit memo generation
 */
async function logCreditMemoGenerated(data) {
  return logEvent('CREDIT_MEMO_GENERATED', data, {
    skill: 'ci-credit-memo',
    severity: 'NOTICE'
  });
}

/**
 * Log RAROC calculation
 */
async function logRAROCCalculation(data) {
  return logEvent('RAROC_CALCULATION', data, {
    skill: data.skill || 'unknown',
    severity: 'INFO'
  });
}

/**
 * Log risk rating assignment
 */
async function logRiskRating(data) {
  return logEvent('RISK_RATING_ASSIGNED', data, {
    skill: data.skill || 'unknown',
    severity: 'NOTICE'
  });
}

/**
 * Log analyst review completion
 */
async function logAnalystReview(data) {
  return logEvent('ANALYST_REVIEW_COMPLETED', data, {
    skill: 'credit-analyst-skill',
    severity: 'NOTICE'
  });
}

/**
 * Log pricing exception
 */
async function logPricingException(data) {
  return logEvent('PRICING_EXCEPTION_REQUESTED', data, {
    severity: 'WARNING'
  });
}

/**
 * Log error events
 */
async function logError(error, context = {}) {
  return logEvent('ERROR', {
    error: error.message,
    stack: error.stack,
    ...context
  }, {
    severity: 'ERROR'
  });
}

// CLI interface for testing
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: node logging-client.js [command] [options]

Commands:
  test                    Send a test log entry
  tail [--lines N]        Tail local log file
  check-config            Verify configuration

Environment Variables:
  GCP_PROJECT_ID          Google Cloud project ID (required)
  GCP_LOG_NAME            Log name (default: claude-credit-skills)
  GCP_AUTH_TOKEN          OAuth2 token or service account key (required)
  LOCAL_LOG_DIR           Local log directory (default: /tmp/claude-credit-logs)

Examples:
  # Send test log
  node logging-client.js test

  # View local logs
  node logging-client.js tail --lines 50

  # Check configuration
  node logging-client.js check-config
`);
    process.exit(0);
  }

  const command = args[0];

  switch (command) {
    case 'test':
      console.log('Sending test log entry...');
      logEvent('TEST_EVENT', {
        message: 'This is a test log entry from logging-client.js',
        timestamp: new Date().toISOString()
      }, { skill: 'test' })
        .then(() => {
          console.log('✓ Test log sent successfully');
          console.log(`Local log: ${LOCAL_LOG_FILE}`);
        })
        .catch(error => {
          console.error('✗ Failed to send test log:', error.message);
          process.exit(1);
        });
      break;

    case 'tail':
      const lines = args.includes('--lines')
        ? parseInt(args[args.indexOf('--lines') + 1])
        : 20;

      try {
        ensureLogDirectory();
        if (!fs.existsSync(LOCAL_LOG_FILE)) {
          console.log('No local logs yet');
          process.exit(0);
        }

        const content = fs.readFileSync(LOCAL_LOG_FILE, 'utf8');
        const logLines = content.trim().split('\n').slice(-lines);

        logLines.forEach(line => {
          try {
            const entry = JSON.parse(line);
            console.log(`[${entry.timestamp}] ${entry.eventType} - ${JSON.stringify(entry.data, null, 2)}`);
          } catch {
            console.log(line);
          }
        });
      } catch (error) {
        console.error('Error reading logs:', error.message);
        process.exit(1);
      }
      break;

    case 'check-config':
      console.log('Configuration Check:');
      console.log(`  GCP_PROJECT_ID: ${config.projectId ? '✓ Set' : '✗ Not set'}`);
      console.log(`  GCP_LOG_NAME: ${config.logName}`);
      console.log(`  GCP_AUTH_TOKEN: ${config.authToken ? '✓ Set' : '✗ Not set'}`);
      console.log(`  LOCAL_LOG_DIR: ${LOCAL_LOG_DIR}`);
      console.log(`  LOCAL_LOG_FILE: ${LOCAL_LOG_FILE}`);

      if (!config.projectId || !config.authToken) {
        console.log('\n⚠ Warning: GCP logging will not work without required environment variables');
        console.log('Local logging will still function as fallback');
      }
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run with --help for usage information');
      process.exit(1);
  }
}

module.exports = {
  logEvent,
  logCreditMemoGenerated,
  logRAROCCalculation,
  logRiskRating,
  logAnalystReview,
  logPricingException,
  logError,
  generateCorrelationId
};
