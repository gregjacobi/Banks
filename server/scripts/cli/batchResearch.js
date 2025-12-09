#!/usr/bin/env node

/**
 * Batch Research CLI Tool
 *
 * Run research pipeline for banks - either batch mode or single bank
 *
 * Usage:
 *   # Single bank mode
 *   node server/scripts/cli/batchResearch.js --idrssd 852218
 *   node server/scripts/cli/batchResearch.js --idrssd 852218 --max-phase 3
 *   node server/scripts/cli/batchResearch.js --idrssd 852218 --force
 *
 *   # Batch mode (top N banks)
 *   node server/scripts/cli/batchResearch.js --count 10
 *   node server/scripts/cli/batchResearch.js --count 25 --max-phase 2
 *   node server/scripts/cli/batchResearch.js --count 25 --max-phase 3 --force
 *
 *   # Batch mode with concurrent processing
 *   node server/scripts/cli/batchResearch.js --count 25 --threads 4
 *
 *   # List mode
 *   node server/scripts/cli/batchResearch.js --list
 *
 * Options:
 *   --idrssd            Run for a specific bank by IDRSSD (single bank mode)
 *   --count, -c         Number of banks to process in batch mode (default: 10)
 *   --max-phase, -p     Maximum phase to complete: 1, 2, or 3 (default: 1)
 *                       Phase 1: Gather sources from web
 *                       Phase 2: Extract insights from RAG documents
 *                       Phase 3: Generate AI research report, podcast, and presentation
 *   --threads, -t       Number of concurrent threads for batch processing (default: 1)
 *   --force, -f         Force re-run phases even if already completed
 *   --list, -l          List banks and their current research phase status
 */

const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');
const logger = require('../../utils/logger');

// Check for --production flag
const isProduction = process.argv.includes('--production');

// Load appropriate .env file
if (isProduction) {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env.production') });
  console.log('🚀 Running in PRODUCTION mode');
} else {
  require('dotenv').config();
  console.log('🔧 Running in DEVELOPMENT mode');
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bankexplorer';
const API_BASE = process.env.API_BASE || (isProduction ? 'https://bank-explorer-app-1a03f2c2e57a.herokuapp.com/api' : 'http://localhost:5000/api');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.findIndex(arg => arg === flag || arg === flag.replace('--', '-'));
  return index !== -1 ? args[index + 1] : null;
};
const hasFlag = (flag) => args.includes(flag) || args.includes(flag.replace('--', '-'));

const idrssd = getArg('--idrssd');
const count = parseInt(getArg('--count') || getArg('-c') || '10');
const maxPhase = parseInt(getArg('--max-phase') || getArg('-p') || '1');
const threads = parseInt(getArg('--threads') || getArg('-t') || '1');
const force = hasFlag('--force') || hasFlag('-f');
const listOnly = hasFlag('--list') || hasFlag('-l');
const showHelp = hasFlag('--help') || hasFlag('-h');

// Show help
if (showHelp) {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║         Bank Explorer - Batch Research Pipeline Tool          ║
╚════════════════════════════════════════════════════════════════╝

DESCRIPTION:
  Run research pipeline for banks - either batch mode or single bank.
  Supports three phases: web sources, AI reports, podcasts/presentations.

USAGE:
  node server/scripts/cli/batchResearch.js [OPTIONS]

OPTIONS:
  --idrssd <id>        Run for a specific bank by IDRSSD (single bank mode)
  --count, -c <num>    Number of banks to process in batch mode (default: 10)
  --max-phase, -p <n>  Maximum phase to complete: 1, 2, or 3 (default: 1)
                       Phase 1: Gather sources from web
                       Phase 2: Extract insights from RAG documents
                       Phase 3: Generate AI research report, podcast, and presentation
  --threads, -t <num>  Number of concurrent threads for batch processing (default: 1)
  --force, -f          Force re-run phases even if already completed
  --list, -l           List banks and their current research phase status
  --help, -h           Show this help message

EXAMPLES:
  # Single bank - Phase 1 only (gather sources)
  node server/scripts/cli/batchResearch.js --idrssd 852218

  # Single bank - Through Phase 2 (sources + insights extraction)
  node server/scripts/cli/batchResearch.js --idrssd 852218 --max-phase 2

  # Single bank - All phases (sources, insights, report, podcast, presentation)
  node server/scripts/cli/batchResearch.js --idrssd 852218 --max-phase 3

  # Single bank - Force re-run all phases
  node server/scripts/cli/batchResearch.js --idrssd 852218 --max-phase 3 --force

  # Batch mode - Top 10 banks, Phase 1 only
  node server/scripts/cli/batchResearch.js --count 10

  # Batch mode - Top 25 banks, through Phase 2 (insights only)
  node server/scripts/cli/batchResearch.js --count 25 --max-phase 2

  # Batch mode - Top 25 banks, all phases
  node server/scripts/cli/batchResearch.js --count 25 --max-phase 3

  # Batch mode - Top 25 banks with 4 concurrent threads
  node server/scripts/cli/batchResearch.js --count 25 --threads 4

  # List all banks with research status
  node server/scripts/cli/batchResearch.js --list

NOTES:
  - Uses same API endpoints as the web builder interface
  - Phase 2 (insights extraction) takes 1-2 minutes per bank
  - Phase 3 (report + podcast + presentation) takes 5-10 minutes per bank
  - Results are saved to server/data/research, /podcasts, /presentations
`);
  process.exit(0);
}

// Validate maxPhase
if (maxPhase < 1 || maxPhase > 3) {
  console.error('❌ Error: --max-phase must be 1, 2, or 3');
  console.error('Run with --help for usage information');
  process.exit(1);
}

// Validate threads
if (threads < 1 || threads > 10) {
  console.error('❌ Error: --threads must be between 1 and 10');
  console.error('Run with --help for usage information');
  process.exit(1);
}

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

async function getTopBanks(limit) {
  const Institution = require('../../models/Institution');
  const FinancialStatement = require('../../models/FinancialStatement');

  // Get latest statements to determine top banks by assets
  const latestStatements = await FinancialStatement.aggregate([
    {
      $sort: { reportingPeriod: -1 }
    },
    {
      $group: {
        _id: '$idrssd',
        latestPeriod: { $first: '$reportingPeriod' },
        totalAssets: { $first: '$balanceSheet.assets.totalAssets' }
      }
    },
    {
      $match: {
        totalAssets: { $gt: 0 }
      }
    },
    {
      $sort: { totalAssets: -1 }
    },
    {
      $limit: limit
    }
  ]);

  const idrssdList = latestStatements.map(s => s._id);
  const institutions = await Institution.find({ idrssd: { $in: idrssdList } }).lean();

  // Combine and sort by assets
  const banksWithAssets = latestStatements.map(stmt => {
    const institution = institutions.find(i => i.idrssd === stmt._id);
    return {
      idrssd: stmt._id,
      name: institution?.name || 'Unknown',
      city: institution?.city,
      state: institution?.state,
      totalAssets: stmt.totalAssets,
      latestPeriod: stmt.latestPeriod
    };
  });

  return banksWithAssets;
}

async function getBankResearchStatus(idrssd) {
  try {
    const response = await axios.get(`${API_BASE}/research/${idrssd}/status`);
    return response.data.status;
  } catch (error) {
    // If endpoint doesn't exist yet, return default status
    return {
      phase1: 'not_started',
      phase2: 'not_started',
      phase3: 'not_started',
      phase4: 'not_started'
    };
  }
}

async function listBanksWithStatus() {
  console.log('\n📊 Bank Research Status Report\n');
  console.log('=' .repeat(100));
  console.log(sprintf('%-10s %-50s %-15s %-8s %-8s %-8s %-8s',
    'ID RSSD', 'Bank Name', 'Assets', 'Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'));
  console.log('='.repeat(100));

  const banks = await getTopBanks(count);

  for (const bank of banks) {
    const status = await getBankResearchStatus(bank.idrssd);
    const assets = formatAssets(bank.totalAssets);

    const p1 = getPhaseIcon(status.phase1);
    const p2 = getPhaseIcon(status.phase2);
    const p3 = getPhaseIcon(status.phase3);
    const p4 = getPhaseIcon(status.phase4);

    console.log(sprintf('%-10s %-50s %-15s %-8s %-8s %-8s %-8s',
      bank.idrssd,
      truncate(bank.name, 48),
      assets,
      p1, p2, p3, p4
    ));
  }

  console.log('='.repeat(100));
  console.log('\nLegend:');
  console.log('  ⏳ not_started   🔄 in_progress   ✅ completed   ❌ failed');
  console.log('\nPhases:');
  console.log('  Phase 1: Gather sources from web');
  console.log('  Phase 2: Extract insights from RAG documents');
  console.log('  Phase 3: Generate AI research report, podcast, and presentation');
  console.log('  Phase 4: (Reserved for future use)');
}

async function extractInsightsForBank(bank, log) {
  log.info('Starting insight extraction from RAG documents...');

  try {
    // SSE streaming endpoint for insight extraction
    const response = await axios.post(
      `${API_BASE}/research/${bank.idrssd}/extract-insights-batch`,
      {},
      {
        timeout: 600000, // 10 minute timeout
        responseType: 'stream' // Handle SSE stream
      }
    );

    // Parse SSE stream for Phase 2
    let phase2Result = null;
    await new Promise((resolve, reject) => {
      let buffer = '';

      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));

              // Log progress updates
              if (data.stage === 'init' || data.stage === 'starting' || data.stage === 'checking') {
                log.info(`  ${data.message}`);
              } else if (data.stage === 'found' || data.stage === 'querying') {
                log.info(`  ${data.message}`);
              } else if (data.stage === 'priorities' || data.stage === 'metrics' || data.stage === 'tech') {
                log.info(`  ${data.message}`);
              } else if (data.stage === 'analyzing' || data.stage === 'parsing' || data.stage === 'parsed') {
                log.info(`  ${data.message}`);
              } else if (data.stage === 'saving') {
                log.info(`  ${data.message}`);
              } else if (data.stage === 'complete') {
                phase2Result = data;
                log.info('Phase 2 completed successfully');
                resolve();
              } else if (data.stage === 'error') {
                // Don't fail - just warn and continue
                log.warn(`Phase 2 warning: ${data.message}`);
                phase2Result = { success: true, insights: null, warning: data.message };
                resolve();
              }
            } catch (parseError) {
              // Ignore parse errors for heartbeat or malformed lines
            }
          }
        }
      });

      response.data.on('end', () => {
        if (!phase2Result) {
          log.warn('Stream ended without completion - treating as non-fatal');
          phase2Result = { success: true, insights: null, warning: 'Stream ended without completion' };
        }
        resolve();
      });

      response.data.on('error', (err) => {
        log.warn(`Stream error (non-fatal): ${err.message}`);
        phase2Result = { success: true, insights: null, warning: err.message };
        resolve(); // Don't fail - continue to report generation
      });
    });

    if (phase2Result && phase2Result.success) {
      const priorityCount = phase2Result.insights?.priorities?.length || 0;
      if (priorityCount > 0) {
        log.info(`Phase 2 completed: ${priorityCount} strategic priorities found`);
      }
      return { success: true, insights: phase2Result.insights };
    } else {
      return { success: true, insights: null, warning: phase2Result?.warning || 'No insights extracted' };
    }

  } catch (error) {
    const errorDetails = error.response?.data?.error || error.response?.data?.message || error.message;
    log.warn(`Insight extraction error (non-fatal): ${errorDetails}`);
    // Don't fail - continue to report generation
    return { success: true, insights: null, warning: errorDetails };
  }
}

async function runPhase2ForBank(bank, sessionId, log) {
  log.info('Starting Phase 2: Extract insights from RAG documents...');

  const insightsResult = await extractInsightsForBank(bank, log);

  if (insightsResult.success) {
    if (insightsResult.warning) {
      log.info(`Phase 2 completed with warning: ${insightsResult.warning}`);
    } else {
      log.info('Phase 2 completed: Insights extracted successfully');
    }
    return { success: true, insights: insightsResult.insights };
  } else {
    log.warn('Phase 2 completed: No insights extracted (non-fatal)');
    return { success: true, insights: null, warning: 'No insights extracted' };
  }
}

async function generateReportForBank(bank, sessionId, log) {
  log.info('Generating AI research report (this may take 5-10 minutes)...');

  try {
    // SSE streaming endpoint for report generation
    const response = await axios.post(
      `${API_BASE}/research/${bank.idrssd}/generate-agent-batch`,
      { sessionId },
      {
        timeout: 1200000, // 20 minute timeout
        responseType: 'stream' // Handle SSE stream
      }
    );

    // Parse SSE stream for Phase 3
    let phase3Result = null;
    await new Promise((resolve, reject) => {
      let buffer = '';

      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));

              // Log progress updates (agentReportService sends many stage updates)
              if (data.message) {
                log.info(`  ${data.message}`);
              }

              if (data.stage === 'complete') {
                phase3Result = data;
                log.info('Research report generated successfully');
                if (data.report?.generatedAt) {
                  log.info(`Report timestamp: ${data.report.generatedAt}`);
                }
                resolve();
              } else if (data.stage === 'error') {
                reject(new Error(data.message || 'Report generation failed'));
              }
            } catch (parseError) {
              // Ignore parse errors for heartbeat or malformed lines
            }
          }
        }
      });

      response.data.on('end', () => {
        if (!phase3Result) {
          reject(new Error('Stream ended without completion'));
        } else {
          resolve();
        }
      });

      response.data.on('error', (err) => {
        reject(err);
      });
    });

    if (phase3Result && phase3Result.success && phase3Result.report) {
      return { success: true, report: phase3Result.report };
    } else {
      log.error(`Report generation failed: ${phase3Result?.error || 'No report in response'}`);
      return { success: false, error: phase3Result?.error || 'No report in response' };
    }

  } catch (error) {
    // Extract detailed error info from axios response
    const errorDetails = error.response?.data?.error || error.response?.data?.message || error.message;
    const statusCode = error.response?.status || 'N/A';
    log.error(`Report generation error (HTTP ${statusCode}): ${errorDetails}`);
    if (error.response?.data?.stack) {
      log.error(`Server stack trace: ${error.response.data.stack}`);
    }
    return { success: false, error: errorDetails };
  }
}

async function runPhase3ForBank(bank, sessionId, log, existingArtifacts = {}) {
  log.info('Starting Phase 3: Generate AI report, podcast, and presentation...');

  const { hasReport = false, reportData = null, hasPodcastScript = false, hasPodcastAudio = false } = existingArtifacts;

  // Step 1: Generate report if not already done
  let finalReportData = reportData;
  let reportGenerated = hasReport;

  if (!hasReport) {
    log.info('Step 1: Generating AI research report...');
    const reportResult = await generateReportForBank(bank, sessionId, log);
    if (reportResult.success) {
      finalReportData = reportResult.report;
      reportGenerated = true;
    } else {
      log.error(`Phase 3 failed: Report generation failed - ${reportResult.error}`);
      return { success: false, error: `Report generation failed: ${reportResult.error}` };
    }
  } else {
    log.info('Step 1: Report already exists, skipping...');
  }

  let podcastScriptGenerated = hasPodcastScript;
  let podcastAudioGenerated = hasPodcastAudio;
  let podcastError = null;
  let presentationGenerated = false;
  let presentationError = null;

  // Step 2: Try to generate podcast (don't let failure block presentation)
  try {
    if (hasPodcastScript && hasPodcastAudio) {
      log.info('Step 2: Podcast script and audio already exist, skipping...');
    } else if (hasPodcastScript && !hasPodcastAudio) {
      // Script exists, just try to generate audio from it
      log.info('Step 2: Podcast script exists, generating audio from existing script...');
      const podcastResponse = await axios.post(
        `${API_BASE}/research/${bank.idrssd}/podcast/generate-background`,
        { experts: ['WARREN_VAULT'], useExistingScript: true },
        { timeout: 180000 }
      );
      podcastAudioGenerated = podcastResponse.data?.success || false;
      if (!podcastAudioGenerated) {
        podcastError = podcastResponse.data?.error || 'Unknown error';
        log.warn(`Podcast audio generation failed: ${podcastError}`);
      } else {
        log.info('Podcast audio generation started from existing script');
      }
    } else {
      // Need to generate script (and optionally audio)
      log.info('Step 2: Generating podcast script...');
      const podcastResponse = await axios.post(
        `${API_BASE}/research/${bank.idrssd}/podcast/generate-background`,
        { experts: ['WARREN_VAULT'], scriptOnly: false }, // Generate both script and audio
        { timeout: 180000 }
      );
      podcastScriptGenerated = podcastResponse.data?.success || false;
      if (!podcastScriptGenerated) {
        podcastError = podcastResponse.data?.error || 'Unknown error';
        log.warn(`Podcast generation failed: ${podcastError}`);
      } else {
        log.info('Podcast generation started successfully');
      }
    }
  } catch (error) {
    podcastError = error.response?.data?.message || error.message;
    log.warn(`Podcast generation failed: ${podcastError}`);
  }

  // Step 3: Always try to generate presentation, even if podcast failed
  try {
    log.info('Step 3: Generating presentation...');
    // Extract timestamp from report (e.g., "2025-11-21T14:44:14.385Z" -> epoch ms)
    const reportTimestamp = finalReportData?.generatedAt ? new Date(finalReportData.generatedAt).getTime() : null;

    // Presentation endpoint now uses SSE streaming - we need to handle the stream
    const presentationResponse = await axios.post(
      `${API_BASE}/research/${bank.idrssd}/presentation/generate`,
      { reportTimestamp },
      {
        timeout: 180000, // 3 minute timeout
        responseType: 'stream' // Handle SSE stream
      }
    );

    // Parse SSE stream to get final result
    await new Promise((resolve, reject) => {
      let buffer = '';
      let lastStage = '';

      presentationResponse.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));

              if (data.stage === 'loading' || data.stage === 'generating' || data.stage === 'saving') {
                lastStage = data.stage;
                log.info(`  ${data.message}`);
              } else if (data.stage === 'complete') {
                presentationGenerated = true;
                log.info('Presentation generated successfully');
                resolve();
              } else if (data.stage === 'error') {
                presentationError = data.message;
                reject(new Error(data.message));
              }
            } catch (parseError) {
              // Ignore parse errors for heartbeat or malformed lines
            }
          }
        }
      });

      presentationResponse.data.on('end', () => {
        if (!presentationGenerated) {
          presentationError = 'Stream ended without completion';
          reject(new Error(presentationError));
        } else {
          resolve();
        }
      });

      presentationResponse.data.on('error', (err) => {
        presentationError = err.message;
        reject(err);
      });
    });
  } catch (error) {
    if (!presentationError) {
      presentationError = error.response?.data?.error || error.response?.data?.message || error.message;
    }
    log.warn(`Presentation generation failed: ${presentationError}`);
  }

  // Determine overall success
  // PRIORITY: Report + Presentation are the primary deliverables - if they succeed, Phase 3 is successful
  // Podcast script is optional, audio is optional
  if (reportGenerated && presentationGenerated) {
    if (podcastScriptGenerated) {
      log.info(`Phase 3 completed: Report generated, presentation generated, podcast script ${hasPodcastScript ? 'existed' : 'generated'}, audio ${podcastAudioGenerated ? 'exists/generating' : 'skipped'}`);
    } else {
      log.info(`Phase 3 completed: Report and presentation generated (podcast skipped: ${podcastError})`);
    }
    return {
      success: true,
      report: finalReportData,
      podcastScript: podcastScriptGenerated,
      podcastAudio: podcastAudioGenerated,
      presentation: true,
      podcastError: podcastScriptGenerated ? null : podcastError
    };
  } else if (reportGenerated && !presentationGenerated) {
    // Report succeeded but presentation failed
    log.warn(`Phase 3 partially completed: Report generated but presentation failed (${presentationError})`);
    return {
      success: false,
      error: `Presentation generation failed: ${presentationError}`,
      report: finalReportData,
      podcastScript: podcastScriptGenerated,
      podcastAudio: podcastAudioGenerated,
      presentation: false,
      presentationError
    };
  } else {
    // Report failed (shouldn't reach here since we return early on report failure)
    log.error('Phase 3 failed: Report generation failed');
    return {
      success: false,
      error: 'Report generation failed',
      report: null,
      podcastScript: false,
      podcastAudio: false,
      presentation: false
    };
  }
}

async function runPhase1ForBank(bank, bankLogger = null) {
  // Create logger with RSSD context if not provided
  const log = bankLogger || logger.createLogger({ idrssd: bank.idrssd });

  log.info(`Starting processing: ${bank.name} (${bank.idrssd})`);
  log.info(`Assets: ${formatAssets(bank.totalAssets)}`);

  try {
    // STEP 1: Check if RAG documents already exist
    // If they do and we're not forcing a re-run, we can skip Phase 1 entirely
    let existingSourceCount = 0;
    let hasRAGDocs = false;
    let ragDocCount = 0;

    try {
      // Check for existing sources
      const checkResponse = await axios.get(`${API_BASE}/research/${bank.idrssd}/sources/latest`);
      existingSourceCount = checkResponse.data?.sources?.length || 0;

      // Check for existing RAG documents
      const ragStatsResponse = await axios.get(`${API_BASE}/research/${bank.idrssd}/rag-stats`);
      ragDocCount = ragStatsResponse.data?.stats?.documentCount || 0;
      hasRAGDocs = ragDocCount > 0;

      if (hasRAGDocs) {
        log.info(`Found ${existingSourceCount} sources with ${ragDocCount} RAG documents already loaded`);
      } else if (existingSourceCount > 0) {
        log.info(`Found ${existingSourceCount} sources but no RAG documents (sources not uploaded yet)`);
      }
    } catch (checkError) {
      // If 404, no sources/RAG docs exist yet - that's fine, we'll create them
      if (checkError.response?.status !== 404) {
        log.warn(`Failed to check existing sources/RAG: ${checkError.message}`);
      }
    }

    // STEP 2: If RAG docs already exist and not forcing, skip Phase 1 but CONTINUE to check subsequent phases
    if (hasRAGDocs && !force) {
      log.info('RAG documents already loaded, skipping Phase 1 (use --force to re-run)');

      const result = { success: true, skipped: true, reason: 'RAG documents already exist', completedPhase: 1 };
      const sessionId = `batch-${Date.now()}-${bank.idrssd}`;

      // Continue to Phase 2 if maxPhase >= 2 (insights extraction)
      if (maxPhase >= 2) {
        // Phase 2 is insight extraction - always run (it's fast and idempotent)
        log.info('Running Phase 2: Extract insights from RAG documents...');
        const phase2Result = await runPhase2ForBank(bank, sessionId, log);
        result.phase2 = phase2Result;

        if (phase2Result.success) {
          result.completedPhase = 2;

          // Continue to Phase 3 if maxPhase >= 3 (report + podcast + presentation)
          if (maxPhase >= 3) {
            // Check for existing artifacts
            let hasReport = false;
            let reportData = null;
            try {
              const reportResponse = await axios.get(`${API_BASE}/research/${bank.idrssd}/latest`);
              if (reportResponse.data && reportResponse.data.analysis) {
                hasReport = true;
                reportData = reportResponse.data;
                log.info(`Found existing research report from ${reportData.generatedAt || 'unknown date'}`);
              }
            } catch (err) {
              if (err.response?.status !== 404) {
                log.warn(`Error checking for report: ${err.message}`);
              }
            }

            let hasPresentation = false;
            try {
              const presentationResponse = await axios.get(`${API_BASE}/research/${bank.idrssd}/presentation/latest`);
              if (presentationResponse.data && presentationResponse.data.slides) {
                hasPresentation = true;
                log.info(`Found existing presentation with ${presentationResponse.data.slides.length} slides`);
              }
            } catch (err) {
              if (err.response?.status !== 404) {
                log.warn(`Error checking for presentation: ${err.message}`);
              }
            }

            let hasPodcastScript = false;
            try {
              const scriptResponse = await axios.get(`${API_BASE}/research/${bank.idrssd}/podcast/script/latest`);
              if (scriptResponse.data && scriptResponse.data.script) {
                hasPodcastScript = true;
                log.info(`Found existing podcast script (duration: ~${scriptResponse.data.script.duration || 'unknown'} minutes)`);
              }
            } catch (err) {
              if (err.response?.status !== 404) {
                log.warn(`Error checking for podcast script: ${err.message}`);
              }
            }

            let hasPodcastAudio = false;
            try {
              const audioResponse = await axios.get(`${API_BASE}/research/${bank.idrssd}/podcast/latest`);
              if (audioResponse.data && audioResponse.data.podcast) {
                hasPodcastAudio = true;
                log.info(`Found existing podcast audio: ${audioResponse.data.podcast.filename}`);
              }
            } catch (err) {
              if (err.response?.status !== 404) {
                log.warn(`Error checking for podcast audio: ${err.message}`);
              }
            }

            // Phase 3 is complete if we have report AND presentation (podcast is optional)
            if (hasReport && hasPresentation && !force) {
              log.info('Report and presentation exist, skipping Phase 3 (use --force to re-run)');
              result.completedPhase = 3;
              result.phase3 = { success: true, skipped: true, report: reportData, podcastScript: hasPodcastScript, podcastAudio: hasPodcastAudio, presentation: true };
            } else {
              // Need to run Phase 3
              log.info(`Phase 3 artifacts missing (report: ${hasReport}, presentation: ${hasPresentation}, script: ${hasPodcastScript}), running...`);
              const phase3Result = await runPhase3ForBank(bank, sessionId, log, { hasReport, reportData, hasPodcastScript, hasPodcastAudio });
              result.phase3 = phase3Result;
              if (phase3Result.success) {
                result.completedPhase = 3;
              }
            }
          }
        } else {
          log.warn('Stopping at Phase 2 due to failure');
        }
      }

      return result;
    }

    // STEP 3: If we're here, we need to run Phase 1
    // First, clear any existing sources/RAG data to ensure we only have top 5
    if (existingSourceCount > 0 || hasRAGDocs) {
      log.info(`Clearing ${existingSourceCount} existing sources and RAG data before gathering new sources...`);
      try {
        const deleteResponse = await axios.delete(`${API_BASE}/research/${bank.idrssd}/sources`);
        const deleted = deleteResponse.data.deleted;
        log.info(`Cleared: ${deleted.sources} sources, ${deleted.documents} RAG docs, ${deleted.chunks} chunks`);
      } catch (deleteError) {
        log.warn(`Failed to clear old sources/RAG: ${deleteError.message}`);
      }
    }

    log.info('Starting Phase 1: Gather sources and metadata...');

    // Start Phase 1 (gather sources) - now uses SSE streaming
    const sessionId = `batch-${Date.now()}-${bank.idrssd}`;

    // SSE streaming endpoint for source gathering
    const response = await axios.post(
      `${API_BASE}/research/${bank.idrssd}/gather-sources-batch`,
      {
        sessionId,
        config: {
          categories: ['investorPresentation', 'earningsTranscript']
        }
      },
      {
        timeout: 1200000, // 20 minute timeout
        responseType: 'stream' // Handle SSE stream
      }
    );

    // Parse SSE stream for Phase 1
    let phase1Result = null;
    await new Promise((resolve, reject) => {
      let buffer = '';

      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));

              // Log progress updates
              if (data.stage === 'init' || data.stage === 'starting' || data.stage === 'phase1' ||
                  data.stage === 'phase2' || data.stage === 'phase3' || data.stage === 'phase4') {
                log.info(`  ${data.message}`);
              } else if (data.stage === 'searching' || data.stage === 'found') {
                log.info(`  ${data.message}`);
              } else if (data.stage === 'downloading' || data.stage === 'downloaded') {
                log.info(`  ${data.message}`);
              } else if (data.stage === 'metadata' || data.stage === 'logo' || data.stage === 'ticker' || data.stage === 'orgchart') {
                log.info(`  ${data.message}`);
              } else if (data.stage === 'complete') {
                phase1Result = data;
                log.info('Phase 1 completed successfully');
                resolve();
              } else if (data.stage === 'error') {
                reject(new Error(data.message));
              }
            } catch (parseError) {
              // Ignore parse errors for heartbeat or malformed lines
            }
          }
        }
      });

      response.data.on('end', () => {
        if (!phase1Result) {
          reject(new Error('Stream ended without completion'));
        } else {
          resolve();
        }
      });

      response.data.on('error', (err) => {
        reject(err);
      });
    });

    if (phase1Result && phase1Result.success) {
      log.info(`Phase 1 completed: ${phase1Result.sourcesFound} sources found`);

      // Show metadata gathering results
      if (phase1Result.metadata) {
        const m = phase1Result.metadata;
        log.info(`Metadata gathered: Logo=${m.logo ? 'Yes' : 'No'}, Ticker=${m.ticker ? 'Yes' : 'No'}, OrgChart=${m.orgChart ? 'Yes' : 'No'}`);
      }

      const result = {
        success: true,
        sourcesFound: phase1Result.sourcesFound,
        metadata: phase1Result.metadata,
        completedPhase: 1
      };

      // Continue to Phase 2 if maxPhase >= 2 (insights extraction)
      if (maxPhase >= 2) {
        const phase2Result = await runPhase2ForBank(bank, sessionId, log);
        result.phase2 = phase2Result;

        if (phase2Result.success) {
          result.completedPhase = 2;

          // Continue to Phase 3 if maxPhase >= 3 (report + podcast + presentation)
          if (maxPhase >= 3) {
            const phase3Result = await runPhase3ForBank(bank, sessionId, log, {});
            result.phase3 = phase3Result;

            if (phase3Result.success) {
              result.completedPhase = 3;
            }
          }
        } else {
          log.warn('Stopping at Phase 2 due to failure');
        }
      }

      return result;
    } else {
      log.error(`Phase 1 failed: ${response.data.error}`);
      return { success: false, error: response.data.error };
    }

  } catch (error) {
    log.error(`Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runSingleBank() {
  const Institution = require('../../models/Institution');
  const FinancialStatement = require('../../models/FinancialStatement');

  console.log('\n🏦 Single Bank Mode\n');
  console.log(`IDRSSD: ${idrssd}`);
  console.log(`Max Phase: ${maxPhase}`);
  console.log(`Force re-run: ${force ? 'Yes' : 'No'}\n`);

  // Get bank info
  const institution = await Institution.findOne({ idrssd });
  if (!institution) {
    console.log(`❌ Error: Bank with IDRSSD ${idrssd} not found in database`);
    return;
  }

  // Get latest assets
  const latestStatement = await FinancialStatement.findOne({ idrssd })
    .sort({ reportingPeriod: -1 })
    .limit(1);

  const bank = {
    idrssd: institution.idrssd,
    name: institution.name,
    city: institution.city,
    state: institution.state,
    totalAssets: latestStatement?.balanceSheet?.assets?.totalAssets || 0,
    latestPeriod: latestStatement?.reportingPeriod
  };

  console.log(`Bank: ${bank.name}`);
  console.log(`Location: ${bank.city}, ${bank.state}`);
  console.log(`Assets: ${formatAssets(bank.totalAssets)}\n`);

  const result = await runPhase1ForBank(bank);

  console.log('\n' + '='.repeat(80));
  if (result.success) {
    console.log(`✅ Success! Completed up to Phase ${result.completedPhase}`);

    // Phase 1
    if (result.skipped) {
      console.log(`   - Phase 1: ⏭️  Skipped (RAG docs exist)`);
    } else {
      console.log(`   - Phase 1: ${result.sourcesFound} sources found`);
    }

    // Phase 2
    if (result.phase2) {
      if (result.phase2.skipped) {
        console.log(`   - Phase 2: ⏭️  Skipped (insights already extracted)`);
      } else {
        console.log(`   - Phase 2: ${result.phase2.success ? '✅ Insights extracted' : '❌ Failed'}`);
      }
    }

    // Phase 3
    if (result.phase3) {
      if (result.phase3.skipped) {
        console.log(`   - Phase 3: ⏭️  Skipped (report & presentation exist)`);
      } else {
        console.log(`   - Phase 3: ${result.phase3.success ? '✅ Report, Podcast & Presentation generated' : '⚠️  Partially completed'}`);
        if (result.phase3.podcastError) {
          console.log(`             Podcast: ❌ ${result.phase3.podcastError}`);
        }
        if (result.phase3.presentationError) {
          console.log(`             Presentation: ❌ ${result.phase3.presentationError}`);
        }
      }
    }
  } else {
    console.log(`❌ Failed: ${result.error}`);
  }
  console.log('='.repeat(80));
}

/**
 * Process banks concurrently with a worker pool pattern
 */
async function processBanksConcurrently(banks, maxConcurrency) {
  const results = {
    total: banks.length,
    completed: 0,
    skipped: 0,
    failed: 0
  };

  const queue = [...banks];
  let currentIndex = 0;

  // Worker function that processes banks from the queue
  async function worker() {
    while (queue.length > 0) {
      const bank = queue.shift();
      if (!bank) break;

      const index = currentIndex++;
      const bankLog = logger.createLogger({ idrssd: bank.idrssd });

      logger.info(`[${index + 1}/${banks.length}] Starting: ${bank.name}`);

      const result = await runPhase1ForBank(bank, bankLog);

      if (result.success) {
        if (result.skipped) {
          results.skipped++;
        } else {
          results.completed++;
        }
      } else {
        results.failed++;
      }

      // Add a small delay between banks to avoid overwhelming the API
      await sleep(2000);
    }
  }

  // Create worker pool
  const workers = Array(Math.min(maxConcurrency, banks.length))
    .fill(null)
    .map(() => worker());

  // Wait for all workers to complete
  await Promise.all(workers);

  return results;
}

async function runBatchProcessing() {
  logger.info('🚀 Batch Research Processing');
  logger.info(`Processing top ${count} banks by total assets`);
  logger.info(`Max Phase: ${maxPhase}`);
  logger.info(`Threads: ${threads}`);
  logger.info(`Force re-run: ${force ? 'Yes' : 'No'}`);

  const banks = await getTopBanks(count);
  logger.info(`Found ${banks.length} banks to process`);

  let results;

  if (threads === 1) {
    // Sequential processing (original behavior)
    results = {
      total: banks.length,
      completed: 0,
      skipped: 0,
      failed: 0
    };

    for (let i = 0; i < banks.length; i++) {
      const bank = banks[i];
      logger.info(`[${i + 1}/${banks.length}] Starting: ${bank.name}`);

      const result = await runPhase1ForBank(bank);

      if (result.success) {
        if (result.skipped) {
          results.skipped++;
        } else {
          results.completed++;
        }
      } else {
        results.failed++;
      }

      // Add a small delay between banks to avoid overwhelming the API
      await sleep(2000);
    }
  } else {
    // Concurrent processing with worker pool
    logger.info(`Using ${threads} concurrent threads`);
    results = await processBanksConcurrently(banks, threads);
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 Batch Processing Summary');
  console.log('='.repeat(80));
  console.log(`Total banks:     ${results.total}`);
  console.log(`✅ Completed:    ${results.completed}`);
  console.log(`⏭️  Skipped:      ${results.skipped}`);
  console.log(`❌ Failed:       ${results.failed}`);
  console.log('='.repeat(80));
}

// Retry helper - retries a function on retryable errors
async function withRetry(fn, maxRetries = 2, delayMs = 10000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const isRetryable = error.code === 'ECONNRESET' ||
                         error.code === 'ETIMEDOUT' ||
                         error.code === 'ECONNABORTED' ||
                         error.message.includes('socket hang up') ||
                         error.message.includes('timeout');

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      console.log(`   ⚠️  Attempt ${attempt} failed: ${error.message}`);
      console.log(`   🔄 Retrying in ${delayMs/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// Helper functions
function formatAssets(assets) {
  if (!assets) return 'N/A';
  const millions = assets / 1000;
  if (millions >= 1000) {
    return `$${(millions / 1000).toFixed(1)}B`;
  }
  return `$${millions.toFixed(0)}M`;
}

function getPhaseIcon(status) {
  const icons = {
    'not_started': '⏳',
    'in_progress': '🔄',
    'completed': '✅',
    'failed': '❌'
  };
  return icons[status] || '⏳';
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str;
}

function sprintf(format, ...args) {
  let i = 0;
  return format.replace(/%-?(\d+)s/g, (match, width) => {
    const value = String(args[i++] || '');
    const isLeftAlign = match.startsWith('%-');
    const w = parseInt(width);
    if (isLeftAlign) {
      return value.padEnd(w);
    }
    return value.padStart(w);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main execution
async function main() {
  try {
    await connectDB();

    if (listOnly) {
      await listBanksWithStatus();
    } else if (idrssd) {
      // Single bank mode
      await runSingleBank();
    } else {
      // Batch mode
      await runBatchProcessing();
    }

    await mongoose.connection.close();
    console.log('\n✅ Done!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

main();
