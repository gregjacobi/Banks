const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const Institution = require('../models/Institution');
const FinancialStatement = require('../models/FinancialStatement');
const ClaudeService = require('../services/claudeService');
const PodcastScriptService = require('../services/podcastScriptService');
const ElevenLabsService = require('../services/elevenLabsService');
const prompts = require('../prompts/bankAnalysis');
const jobTracker = require('../services/jobTracker');

// Directories for storing research reports and podcasts
const RESEARCH_DIR = path.join(__dirname, '../data/research');
const PODCAST_DIR = path.join(__dirname, '../data/podcasts');

// Ensure directories exist
const ensureDirectories = async () => {
  try {
    await fs.mkdir(RESEARCH_DIR, { recursive: true });
    await fs.mkdir(PODCAST_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating directories:', error);
  }
};

// Initialize directories on module load
ensureDirectories();

/**
 * GET /api/research/:idrssd/latest
 * Get the most recent research report for a bank
 */
router.get('/:idrssd/latest', async (req, res) => {
  try {
    const { idrssd } = req.params;

    // Find all reports for this bank
    const files = await fs.readdir(RESEARCH_DIR);
    const bankReports = files.filter(f => f.startsWith(`${idrssd}_`) && f.endsWith('.json'));

    if (bankReports.length === 0) {
      return res.status(404).json({
        error: 'No research reports found',
        hasReport: false
      });
    }

    // Sort by timestamp (filename format: idrssd_timestamp.json)
    bankReports.sort((a, b) => {
      const timeA = parseInt(a.split('_')[1].split('.')[0]);
      const timeB = parseInt(b.split('_')[1].split('.')[0]);
      return timeB - timeA; // Most recent first
    });

    // Read the most recent report
    const latestFile = path.join(RESEARCH_DIR, bankReports[0]);
    const reportData = await fs.readFile(latestFile, 'utf-8');
    const report = JSON.parse(reportData);

    res.json({
      hasReport: true,
      report,
      generatedAt: report.generatedAt,
      fileName: bankReports[0]
    });

  } catch (error) {
    console.error('Error fetching research report:', error);
    res.status(500).json({ error: 'Failed to fetch research report' });
  }
});

/**
 * GET /api/research/:idrssd/job-status
 * Get the status of the current or most recent job for a bank
 */
router.get('/:idrssd/job-status', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { type } = req.query; // 'report' or 'podcast'

    const job = jobTracker.getLatestJob(idrssd, type || 'report');

    if (!job) {
      return res.json({ hasJob: false });
    }

    res.json({
      hasJob: true,
      job: {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        message: job.message,
        result: job.result,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

/**
 * POST /api/research/:idrssd/generate-background
 * Start report generation as a background job
 * Returns immediately with a job ID
 */
router.post('/:idrssd/generate-background', async (req, res) => {
  try {
    const { idrssd } = req.params;

    // Create a background job
    const jobId = jobTracker.createJob(idrssd, 'report');

    // Return immediately with job ID
    res.json({
      success: true,
      jobId,
      message: 'Report generation started in background'
    });

    // Start generation in background (don't await)
    generateReportInBackground(idrssd, jobId).catch(error => {
      console.error(`[Job ${jobId}] Fatal error:`, error);
      jobTracker.failJob(jobId, error);
    });

  } catch (error) {
    console.error('Error starting background job:', error);
    res.status(500).json({ error: 'Failed to start background job' });
  }
});

/**
 * GET /api/research/:idrssd/generate
 * Generate a new research report for a bank
 * This is a long-running operation that returns status updates via SSE
 * Using GET instead of POST because EventSource API only supports GET
 */
router.get('/:idrssd/generate', async (req, res) => {
  try {
    const { idrssd } = req.params;

    // Set up Server-Sent Events for real-time status updates
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.setHeader('Transfer-Encoding', 'chunked'); // Force chunked encoding

    // Disable compression for this route
    res.set('Content-Encoding', 'none');

    res.flushHeaders(); // Send headers immediately

    // Send initial comment to establish connection
    res.write(': connected\n\n');

    const sendStatus = (stage, message, data = {}) => {
      const payload = JSON.stringify({ stage, message, ...data });
      console.log('Sending SSE:', stage, message); // Debug log
      res.write(`data: ${payload}\n\n`);

      // Force flush using internal socket
      if (res.socket && res.socket.writable) {
        res.socket.uncork();
      }
    };

    // Step 1: Fetch bank information
    sendStatus('init', prompts.statusMessages.init);

    const institution = await Institution.findOne({ idrssd });
    if (!institution) {
      sendStatus('error', 'Bank not found');
      res.end();
      return;
    }

    // Step 2: Fetch time-series financial data
    sendStatus('fetching', prompts.statusMessages.fetchingData);

    const financialStatements = await FinancialStatement.find({ idrssd })
      .sort({ reportingPeriod: 1 })
      .limit(20); // Last 20 quarters (5 years max)

    if (financialStatements.length === 0) {
      sendStatus('error', 'No financial data found for this bank');
      res.end();
      return;
    }

    // Step 3: Prepare trends data
    const trendsData = prepareTrendsData(financialStatements);
    const latestStatement = financialStatements[financialStatements.length - 1];

    // Step 3.5: Fetch peer analysis data
    const peerAnalysis = latestStatement.peerAnalysis || null;
    let peerData = null;

    if (peerAnalysis && peerAnalysis.peers && peerAnalysis.peers.peerIds) {
      // Get peer bank names and latest metrics
      const peerIds = peerAnalysis.peers.peerIds;
      const peerInstitutions = await Institution.find({
        idrssd: { $in: peerIds }
      }).select('idrssd name').lean();

      const peerStatements = await FinancialStatement.find({
        idrssd: { $in: peerIds },
        reportingPeriod: latestStatement.reportingPeriod
      }).select('idrssd ratios balanceSheet.assets.totalAssets').lean();

      const peerMap = new Map(peerInstitutions.map(p => [p.idrssd, p.name]));

      peerData = {
        count: peerAnalysis.peers.count,
        rankings: peerAnalysis.rankings,
        peerAverages: peerAnalysis.peerAverages,
        peerBanks: peerStatements.map(stmt => ({
          idrssd: stmt.idrssd,
          name: peerMap.get(stmt.idrssd) || `Bank ${stmt.idrssd}`,
          totalAssets: stmt.balanceSheet?.assets?.totalAssets || 0,
          efficiencyRatio: stmt.ratios?.efficiencyRatio,
          roe: stmt.ratios?.roe,
          roa: stmt.ratios?.roa,
          nim: stmt.ratios?.netInterestMargin
        })).sort((a, b) => b.totalAssets - a.totalAssets)
      };
    }

    const bankInfo = {
      idrssd: institution.idrssd,
      name: institution.name,
      city: institution.city,
      state: institution.state,
      website: institution.website,
      totalAssets: latestStatement.balanceSheet.assets.totalAssets,
      latestPeriod: latestStatement.reportingPeriod.toISOString().split('T')[0]
    };

    // Step 4: Call Claude API for analysis with streaming
    sendStatus('analyzing', prompts.statusMessages.analyzingTrends);

    const claudeService = new ClaudeService();

    let fullThinking = '';
    let fullAnalysis = '';

    const result = await claudeService.analyzeBankPerformance(
      bankInfo,
      trendsData,
      peerData,
      (event) => {
        console.log('Streaming event received:', event.type); // Debug log
        if (event.type === 'status') {
          sendStatus(event.stage, event.message);
        } else if (event.type === 'thinking_start') {
          sendStatus('thinking', 'Claude is thinking...');
        } else if (event.type === 'thinking_delta') {
          fullThinking += event.content;
          sendStatus('thinking_stream', event.message || 'Thinking...', {
            thinkingChunk: event.content
          });
        } else if (event.type === 'text_delta') {
          fullAnalysis += event.content;
          sendStatus('text_stream', 'Generating report...', {
            textChunk: event.content
          });
        }
      }
    );

    // Step 5: Save report to file
    sendStatus('saving', 'Saving research report...');

    const timestamp = Date.now();
    const fileName = `${idrssd}_${timestamp}.json`;
    const filePath = path.join(RESEARCH_DIR, fileName);

    const reportData = {
      idrssd,
      bankName: institution.name,
      generatedAt: new Date().toISOString(),
      model: result.metadata.model,
      analysis: result.analysis.report,
      thinking: result.analysis.thinking,
      trendsData,
      metadata: result.metadata
    };

    await fs.writeFile(filePath, JSON.stringify(reportData, null, 2));

    // Step 6: Send completion status with report
    sendStatus('complete', prompts.statusMessages.complete, {
      report: reportData,
      fileName
    });

    res.end();

  } catch (error) {
    console.error('Error generating research report:', error);
    res.write(`data: ${JSON.stringify({
      stage: 'error',
      message: `Error: ${error.message}`
    })}\n\n`);
    res.end();
  }
});

/**
 * DELETE /api/research/:idrssd/:filename
 * Delete a specific research report
 */
router.delete('/:idrssd/:filename', async (req, res) => {
  try {
    const { idrssd, filename } = req.params;

    // Validate filename format and idrssd match
    if (!filename.startsWith(`${idrssd}_`) || !filename.endsWith('.json')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(RESEARCH_DIR, filename);
    await fs.unlink(filePath);

    res.json({ success: true, message: 'Report deleted successfully' });

  } catch (error) {
    console.error('Error deleting research report:', error);
    res.status(500).json({ error: 'Failed to delete research report' });
  }
});

/**
 * Helper function to prepare trends data from financial statements
 */
function prepareTrendsData(financialStatements) {
  const periods = financialStatements.map(stmt => {
    const date = new Date(stmt.reportingPeriod);
    const year = date.getFullYear();
    const quarter = Math.ceil((date.getMonth() + 1) / 3);

    // Calculate consumer and business lending
    const portfolio = stmt.balanceSheet.assets.earningAssets.loansAndLeases.portfolio;
    const consumerLending =
      (portfolio.realEstate.securedBy1To4Family.revolvingOpenEnd || 0) +
      (portfolio.realEstate.securedBy1To4Family.closedEndFirstLiens || 0) +
      (portfolio.realEstate.securedBy1To4Family.closedEndJuniorLiens || 0) +
      (portfolio.consumer.creditCards || 0) +
      (portfolio.consumer.automobileLoans || 0) +
      (portfolio.consumer.otherRevolvingCredit || 0) +
      (portfolio.consumer.otherConsumerLoans || 0) +
      (portfolio.leaseFinancingReceivables.consumerLeases || 0);

    const businessLending =
      (portfolio.realEstate.constructionAndLandDevelopment.total || 0) +
      (portfolio.realEstate.multifamily || 0) +
      (portfolio.realEstate.nonfarmNonresidential.ownerOccupied || 0) +
      (portfolio.realEstate.nonfarmNonresidential.otherNonfarmNonresidential || 0) +
      (portfolio.realEstate.farmland || 0) +
      (portfolio.commercialAndIndustrial.usAddressees || 0) +
      (portfolio.commercialAndIndustrial.nonUsAddressees || 0) +
      (portfolio.other.agriculturalProduction || 0) +
      (portfolio.other.toDepositoryInstitutions || 0) +
      (portfolio.leaseFinancingReceivables.allOtherLeases || 0) +
      (portfolio.other.allOtherLoans || 0);

    return {
      period: `${year} Q${quarter}`,
      date: stmt.reportingPeriod,
      assets: {
        total: stmt.balanceSheet.assets.totalAssets,
        consumerLending,
        businessLending,
        securities:
          stmt.balanceSheet.assets.earningAssets.securities.availableForSale +
          stmt.balanceSheet.assets.earningAssets.securities.heldToMaturity,
        cash: stmt.balanceSheet.assets.nonearningAssets.cashAndDueFromBanks,
        other:
          stmt.balanceSheet.assets.nonearningAssets.premisesAndFixedAssets +
          stmt.balanceSheet.assets.nonearningAssets.intangibleAssets +
          stmt.balanceSheet.assets.nonearningAssets.otherAssets
      },
      income: {
        netIncome: stmt.incomeStatement.netIncome,
        netInterestIncome: stmt.incomeStatement.netInterestIncome,
        noninterestIncome: stmt.incomeStatement.noninterestIncome.total,
        noninterestExpense: stmt.incomeStatement.noninterestExpense.total
      },
      ratios: {
        efficiencyRatio: stmt.ratios?.efficiencyRatio,
        roe: stmt.ratios?.roe,
        roa: stmt.ratios?.roa,
        nim: stmt.ratios?.netInterestMargin,
        operatingLeverage: stmt.ratios?.operatingLeverage
      }
    };
  });

  // Prepare lending composition for latest period
  const latestStmt = financialStatements[financialStatements.length - 1];
  const latestPortfolio = latestStmt.balanceSheet.assets.earningAssets.loansAndLeases.portfolio;

  const lendingComposition = [{
    period: periods[periods.length - 1].period,
    categories: [
      {
        name: 'Consumer Lending',
        current: periods[periods.length - 1].assets.consumerLending,
        percentage: (periods[periods.length - 1].assets.consumerLending /
                     periods[periods.length - 1].assets.total * 100).toFixed(1),
        growth: periods.length > 4 ?
          ((periods[periods.length - 1].assets.consumerLending - periods[0].assets.consumerLending) /
           periods[0].assets.consumerLending * 100) : 0,
        subcategories: [
          {
            name: 'Residential Mortgages',
            value: (latestPortfolio.realEstate.securedBy1To4Family.revolvingOpenEnd || 0) +
                   (latestPortfolio.realEstate.securedBy1To4Family.closedEndFirstLiens || 0) +
                   (latestPortfolio.realEstate.securedBy1To4Family.closedEndJuniorLiens || 0)
          },
          {
            name: 'Credit Cards',
            value: latestPortfolio.consumer.creditCards || 0
          },
          {
            name: 'Auto Loans',
            value: latestPortfolio.consumer.automobileLoans || 0
          },
          {
            name: 'Other Consumer',
            value: (latestPortfolio.consumer.otherRevolvingCredit || 0) +
                   (latestPortfolio.consumer.otherConsumerLoans || 0) +
                   (latestPortfolio.leaseFinancingReceivables.consumerLeases || 0)
          }
        ]
      },
      {
        name: 'Business Lending',
        current: periods[periods.length - 1].assets.businessLending,
        percentage: (periods[periods.length - 1].assets.businessLending /
                     periods[periods.length - 1].assets.total * 100).toFixed(1),
        growth: periods.length > 4 ?
          ((periods[periods.length - 1].assets.businessLending - periods[0].assets.businessLending) /
           periods[0].assets.businessLending * 100) : 0,
        subcategories: [
          {
            name: 'Commercial Real Estate',
            value: (latestPortfolio.realEstate.constructionAndLandDevelopment.total || 0) +
                   (latestPortfolio.realEstate.multifamily || 0) +
                   (latestPortfolio.realEstate.nonfarmNonresidential.ownerOccupied || 0) +
                   (latestPortfolio.realEstate.nonfarmNonresidential.otherNonfarmNonresidential || 0) +
                   (latestPortfolio.realEstate.farmland || 0)
          },
          {
            name: 'C&I (US)',
            value: latestPortfolio.commercialAndIndustrial.usAddressees || 0
          },
          {
            name: 'C&I (Non-US)',
            value: latestPortfolio.commercialAndIndustrial.nonUsAddressees || 0
          },
          {
            name: 'Other Business',
            value: (latestPortfolio.other.agriculturalProduction || 0) +
                   (latestPortfolio.other.toDepositoryInstitutions || 0) +
                   (latestPortfolio.leaseFinancingReceivables.allOtherLeases || 0) +
                   (latestPortfolio.other.allOtherLoans || 0)
          }
        ]
      }
    ]
  }];

  return {
    periods,
    lendingComposition
  };
}

/**
 * GET /api/research/:idrssd/podcast/latest
 * Get the most recent podcast for a bank
 */
router.get('/:idrssd/podcast/latest', async (req, res) => {
  try {
    const { idrssd } = req.params;

    // Find all podcasts for this bank
    const files = await fs.readdir(PODCAST_DIR);
    const bankPodcasts = files.filter(f => f.startsWith(`${idrssd}_`) && f.endsWith('.mp3'));

    if (bankPodcasts.length === 0) {
      return res.status(404).json({
        error: 'No podcasts found',
        podcast: null
      });
    }

    // Sort by timestamp (filename format: idrssd_timestamp.mp3)
    bankPodcasts.sort((a, b) => {
      const timeA = parseInt(a.split('_')[1].split('.')[0]);
      const timeB = parseInt(b.split('_')[1].split('.')[0]);
      return timeB - timeA; // Most recent first
    });

    const latestPodcast = bankPodcasts[0];
    const timestamp = parseInt(latestPodcast.split('_')[1].split('.')[0]);

    // Get file size to estimate duration (rough estimate: 1MB ≈ 1 minute)
    const filePath = path.join(PODCAST_DIR, latestPodcast);
    const stats = await fs.stat(filePath);
    const estimatedDuration = Math.round(stats.size / 1024 / 1024); // MB as rough minutes

    res.json({
      podcast: {
        url: `/api/research/${idrssd}/podcast/download/${latestPodcast}`,
        duration: estimatedDuration,
        generatedAt: new Date(timestamp).toISOString(),
        filename: latestPodcast
      }
    });
  } catch (error) {
    console.error('Error fetching latest podcast:', error);
    res.status(500).json({ error: 'Failed to fetch podcast' });
  }
});

/**
 * GET /api/research/:idrssd/podcast/download/:filename
 * Download a specific podcast file
 */
router.get('/:idrssd/podcast/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(PODCAST_DIR, filename);

    // Check if file exists
    await fs.access(filePath);

    // Stream the file
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading podcast:', error);
    res.status(404).json({ error: 'Podcast not found' });
  }
});

/**
 * POST /api/research/:idrssd/podcast/generate-background
 * Start podcast generation as a background job
 * Returns immediately with a job ID
 */
router.post('/:idrssd/podcast/generate-background', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { experts } = req.body;

    // Parse expert IDs
    const selectedExperts = experts || [];

    console.log(`Starting background podcast generation for ${idrssd} with experts:`, selectedExperts);

    // Create a background job
    const jobId = jobTracker.createJob(idrssd, 'podcast');

    // Return immediately with job ID
    res.json({
      success: true,
      jobId,
      message: 'Podcast generation started in background'
    });

    // Start generation in background (don't await)
    generatePodcastInBackground(idrssd, jobId, selectedExperts).catch(error => {
      console.error(`[Job ${jobId}] Fatal error:`, error);
      jobTracker.failJob(jobId, error);
    });

  } catch (error) {
    console.error('Error starting background podcast job:', error);
    res.status(500).json({ error: 'Failed to start background podcast job' });
  }
});

/**
 * GET /api/research/:idrssd/podcast/generate
 * Generate podcast for an existing research report
 * Query params: experts (comma-separated list of expert IDs)
 */
router.get('/:idrssd/podcast/generate', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { experts } = req.query;

    // Parse expert IDs
    const selectedExperts = experts ? experts.split(',').filter(e => e.length > 0) : [];

    console.log(`Generating podcast for ${idrssd} with experts:`, selectedExperts);

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.set('Content-Encoding', 'none');
    res.flushHeaders();

    // Send initial comment
    res.write(': connected\n\n');

    const sendStatus = (stage, message, data = {}) => {
      const payload = JSON.stringify({ stage, message, ...data });
      console.log('Podcast SSE:', stage, message);
      res.write(`data: ${payload}\n\n`);

      // Force flush
      if (res.socket && res.socket.writable) {
        res.socket.uncork();
      }
    };

    // Step 1: Load existing research report
    sendStatus('loading', 'Loading research report...');

    const files = await fs.readdir(RESEARCH_DIR);
    const bankReports = files.filter(f => f.startsWith(`${idrssd}_`) && f.endsWith('.json'));

    if (bankReports.length === 0) {
      sendStatus('error', 'No research report found. Please generate a report first.');
      res.end();
      return;
    }

    // Get most recent report
    bankReports.sort((a, b) => {
      const timeA = parseInt(a.split('_')[1].split('.')[0]);
      const timeB = parseInt(b.split('_')[1].split('.')[0]);
      return timeB - timeA;
    });

    const reportFile = path.join(RESEARCH_DIR, bankReports[0]);
    const reportData = JSON.parse(await fs.readFile(reportFile, 'utf-8'));

    // Step 2: Generate podcast script
    sendStatus('script', 'Bankskie is preparing the show script...');

    const podcastScriptService = new PodcastScriptService();
    const scriptResult = await podcastScriptService.generateScript(
      reportData.bankName,
      reportData.analysis,
      selectedExperts,
      reportData.trendsData,
      (event) => {
        sendStatus(event.stage, event.message);
      }
    );

    const script = scriptResult.script;
    const stats = podcastScriptService.getScriptStats(script.segments);
    const duration = podcastScriptService.estimateDuration(script.fullText);

    sendStatus('script_complete', `Script ready: ${stats.totalSegments} segments, ~${duration} minutes`, {
      stats,
      duration
    });

    // Step 3: Generate audio
    sendStatus('audio', 'Generating audio with ElevenLabs...');

    const elevenLabsService = new ElevenLabsService();
    const audioBuffer = await elevenLabsService.generatePodcastAudio(
      script.segments,
      (event) => {
        sendStatus('audio_progress', `Generating audio: ${event.current}/${event.total}`, {
          current: event.current,
          total: event.total,
          speaker: elevenLabsService.getCharacterName(event.speaker)
        });
      }
    );

    // Step 4: Save audio file
    sendStatus('saving', 'Saving podcast file...');

    const timestamp = Date.now();
    const filename = `${idrssd}_${timestamp}.mp3`;
    const filePath = path.join(PODCAST_DIR, filename);

    await elevenLabsService.saveAudioFile(audioBuffer, filePath);

    // Step 5: Update report with podcast metadata
    reportData.podcast = {
      filename,
      generatedAt: new Date().toISOString(),
      experts: selectedExperts,
      duration,
      stats,
      scriptMetadata: script.metadata
    };

    await fs.writeFile(reportFile, JSON.stringify(reportData, null, 2));

    // Send completion
    sendStatus('complete', 'Podcast generated successfully!', {
      podcast: {
        filename,
        url: `/api/research/${idrssd}/podcast/${filename}`,
        duration,
        experts: selectedExperts.map(id => elevenLabsService.getCharacterName(id))
      }
    });

    res.end();

  } catch (error) {
    console.error('Error generating podcast:', error);
    res.write(`data: ${JSON.stringify({
      stage: 'error',
      message: `Error: ${error.message}`
    })}\n\n`);
    res.end();
  }
});

/**
 * GET /api/research/:idrssd/podcast/:filename
 * Download podcast audio file
 */
router.get('/:idrssd/podcast/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(PODCAST_DIR, filename);

    // Check if file exists
    await fs.access(filePath);

    // Send file
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(filePath);

  } catch (error) {
    console.error('Error serving podcast file:', error);
    res.status(404).json({ error: 'Podcast file not found' });
  }
});

/**
 * Generate report in background (async function)
 * Updates job tracker with progress
 */
async function generateReportInBackground(idrssd, jobId) {
  try {
    console.log(`[Job ${jobId}] Starting report generation for ${idrssd}`);

    // Step 1: Fetch bank information
    jobTracker.updateJob(jobId, {
      status: 'running',
      progress: 10,
      message: 'Fetching bank information...'
    });

    const institution = await Institution.findOne({ idrssd });
    if (!institution) {
      throw new Error('Bank not found');
    }

    // Step 2: Fetch financial data
    jobTracker.updateJob(jobId, {
      progress: 20,
      message: 'Fetching financial statements...'
    });

    const financialStatements = await FinancialStatement.find({ idrssd })
      .sort({ reportingPeriod: 1 })
      .limit(20);

    if (financialStatements.length === 0) {
      throw new Error('No financial data found for this bank');
    }

    // Step 3: Prepare trends data
    jobTracker.updateJob(jobId, {
      progress: 30,
      message: 'Preparing trends data...'
    });

    const trendsData = prepareTrendsData(financialStatements);
    const latestStatement = financialStatements[financialStatements.length - 1];

    // Step 3.5: Fetch peer analysis data
    const peerAnalysis = latestStatement.peerAnalysis || null;
    let peerData = null;

    if (peerAnalysis && peerAnalysis.peers && peerAnalysis.peers.peerIds) {
      const peerIds = peerAnalysis.peers.peerIds;
      const peerInstitutions = await Institution.find({
        idrssd: { $in: peerIds }
      }).select('idrssd name').lean();

      const peerStatements = await FinancialStatement.find({
        idrssd: { $in: peerIds },
        reportingPeriod: latestStatement.reportingPeriod
      }).select('idrssd ratios balanceSheet.assets.totalAssets').lean();

      const peerMap = new Map(peerInstitutions.map(p => [p.idrssd, p.name]));

      peerData = {
        count: peerAnalysis.peers.count,
        rankings: peerAnalysis.rankings,
        peerAverages: peerAnalysis.peerAverages,
        peerBanks: peerStatements.map(stmt => ({
          idrssd: stmt.idrssd,
          name: peerMap.get(stmt.idrssd) || `Bank ${stmt.idrssd}`,
          totalAssets: stmt.balanceSheet?.assets?.totalAssets || 0,
          efficiencyRatio: stmt.ratios?.efficiencyRatio,
          roe: stmt.ratios?.roe,
          roa: stmt.ratios?.roa,
          nim: stmt.ratios?.netInterestMargin
        })).sort((a, b) => b.totalAssets - a.totalAssets)
      };
    }

    const bankInfo = {
      idrssd: institution.idrssd,
      name: institution.name,
      city: institution.city,
      state: institution.state,
      website: institution.website,
      totalAssets: latestStatement.balanceSheet.assets.totalAssets,
      latestPeriod: latestStatement.reportingPeriod.toISOString().split('T')[0]
    };

    // Step 4: Call Claude API
    jobTracker.updateJob(jobId, {
      progress: 40,
      message: 'Analyzing with Claude AI...'
    });

    const claudeService = new ClaudeService();

    const result = await claudeService.analyzeBankPerformance(
      bankInfo,
      trendsData,
      peerData,
      (event) => {
        if (event.type === 'status') {
          jobTracker.updateJob(jobId, { message: event.message });
        }
      }
    );

    // Step 5: Save report
    jobTracker.updateJob(jobId, {
      progress: 90,
      message: 'Saving report...'
    });

    const timestamp = Date.now();
    const fileName = `${idrssd}_${timestamp}.json`;
    const filePath = path.join(RESEARCH_DIR, fileName);

    const reportData = {
      idrssd,
      bankName: institution.name,
      generatedAt: new Date().toISOString(),
      model: result.metadata.model,
      analysis: result.analysis.report,
      thinking: result.analysis.thinking,
      trendsData,
      metadata: result.metadata
    };

    await fs.writeFile(filePath, JSON.stringify(reportData, null, 2));

    // Step 6: Complete job
    jobTracker.completeJob(jobId, {
      fileName,
      reportData
    });

    console.log(`[Job ${jobId}] Report generation completed successfully`);

  } catch (error) {
    console.error(`[Job ${jobId}] Error:`, error);
    jobTracker.failJob(jobId, error);
    throw error;
  }
}

/**
 * Generate podcast in background (async function)
 * For multi-user support: each bank has its own job
 */
async function generatePodcastInBackground(idrssd, jobId, selectedExperts) {
  try {
    console.log(`[Job ${jobId}] Starting podcast generation for ${idrssd}`);

    // Step 1: Load research report
    jobTracker.updateJob(jobId, {
      status: 'running',
      progress: 10,
      message: 'Loading research report...'
    });

    const files = await fs.readdir(RESEARCH_DIR);
    const bankReports = files.filter(f => f.startsWith(`${idrssd}_`) && f.endsWith('.json'));

    if (bankReports.length === 0) {
      throw new Error('No research report found. Please generate a report first.');
    }

    // Get most recent report
    bankReports.sort((a, b) => {
      const timeA = parseInt(a.split('_')[1].split('.')[0]);
      const timeB = parseInt(b.split('_')[1].split('.')[0]);
      return timeB - timeA;
    });

    const reportFile = path.join(RESEARCH_DIR, bankReports[0]);
    const reportData = JSON.parse(await fs.readFile(reportFile, 'utf-8'));

    // Step 2: Generate script
    jobTracker.updateJob(jobId, {
      progress: 30,
      message: 'Generating podcast script...'
    });

    const podcastScriptService = new PodcastScriptService();
    const scriptResult = await podcastScriptService.generateScript(
      reportData.bankName,
      reportData.analysis,
      selectedExperts,
      reportData.trendsData,
      (event) => {
        jobTracker.updateJob(jobId, { message: event.message });
      }
    );

    const script = scriptResult.script;
    const duration = podcastScriptService.estimateDuration(script.fullText);

    // Step 3: Generate audio
    jobTracker.updateJob(jobId, {
      progress: 50,
      message: 'Generating audio with ElevenLabs...'
    });

    const elevenLabsService = new ElevenLabsService();
    const audioBuffer = await elevenLabsService.generatePodcastAudio(
      script.segments,
      (event) => {
        const audioProgress = 50 + Math.round((event.current / event.total) * 40);
        jobTracker.updateJob(jobId, {
          progress: audioProgress,
          message: `Generating audio: ${event.current}/${event.total}`
        });
      }
    );

    // Step 4: Save audio file
    jobTracker.updateJob(jobId, {
      progress: 95,
      message: 'Saving podcast file...'
    });

    const timestamp = Date.now();
    const filename = `${idrssd}_${timestamp}.mp3`;
    const filePath = path.join(PODCAST_DIR, filename);

    await elevenLabsService.saveAudioFile(audioBuffer, filePath);

    // Step 5: Update report with podcast metadata
    reportData.podcast = {
      filename,
      generatedAt: new Date().toISOString(),
      experts: selectedExperts,
      duration
    };

    await fs.writeFile(reportFile, JSON.stringify(reportData, null, 2));

    // Step 6: Complete job
    jobTracker.completeJob(jobId, {
      filename,
      url: `/api/research/${idrssd}/podcast/${filename}`,
      duration,
      experts: selectedExperts
    });

    console.log(`[Job ${jobId}] Podcast generation completed successfully`);

  } catch (error) {
    console.error(`[Job ${jobId}] Error:`, error);
    jobTracker.failJob(jobId, error);
    throw error;
  }
}

module.exports = router;
