const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const Institution = require('../models/Institution');
const FinancialStatement = require('../models/FinancialStatement');
const Source = require('../models/Source');
const PDF = require('../models/PDF');
const BankMetadata = require('../models/BankMetadata');
const ClaudeService = require('../services/claudeService');
const AgentOrchestrator = require('../services/agentOrchestrator');
const ContentFetcher = require('../services/contentFetcher');
const PodcastScriptService = require('../services/podcastScriptService');
const ElevenLabsService = require('../services/elevenLabsService');
const PresentationService = require('../services/presentationService');
const prompts = require('../prompts/bankAnalysis');
const jobTracker = require('../services/jobTracker');

// GridFS storage - all research reports, scripts, and presentations stored in GridFS
const gridfs = require('../config/gridfs');
const {
  saveJsonToGridFS,
  loadJsonFromGridFS,
  listFilesInGridFS,
  deleteFileFromGridFS,
  fileExistsInGridFS
} = require('../utils/gridfsHelpers');
const { uploadToGridFS } = require('../utils/gridfsUtils');

// Helper functions to get buckets (lazy access after GridFS initialization)
const getDocumentBucket = () => gridfs.documentBucket;
const getAudioBucket = () => gridfs.audioBucket;

// Data directories
const PDFS_DIR = path.join(__dirname, '../data/research/pdfs');

// Initialize services
const claudeService = new ClaudeService();
const contentFetcher = new ContentFetcher();

/**
 * Content Quality Validation
 * Detects and rejects boilerplate content like legal disclaimers
 * Returns { isValid: boolean, reason?: string, details?: string }
 */
function validateContentQuality(content, title = '') {
  if (!content || typeof content !== 'string') {
    return { isValid: false, reason: 'Empty or invalid content' };
  }

  const contentLower = content.toLowerCase();
  const contentLength = content.length;

  // Minimum content length (excluding very short pages)
  if (contentLength < 500) {
    return { isValid: false, reason: `Content too short (${contentLength} chars, minimum 500)` };
  }

  // BOILERPLATE DETECTION: Check for high concentration of legal disclaimer phrases
  const boilerplatePhrases = [
    'investing in securities involves risks',
    'not intended as a recommendation',
    'before acting on any information',
    'member fdic',
    'member sipc',
    'registered broker-dealer',
    'not a condition to any banking service',
    'may lose value',
    'are not deposits',
    'are not bank guaranteed',
    'are not fdic insured',
    'securities offered through',
    'investment products offered through',
    'insurance and annuity products',
    'this material does not take into account',
    'opinions expressed herein are given in good faith',
    'subject to change without notice',
    'data connection required',
    'message and data rates may apply',
    'terms of use'
  ];

  let boilerplateHits = 0;
  boilerplatePhrases.forEach(phrase => {
    if (contentLower.includes(phrase)) {
      boilerplateHits++;
    }
  });

  // If more than 30% of boilerplate phrases are found, likely just disclaimers
  const boilerplateRatio = boilerplateHits / boilerplatePhrases.length;
  if (boilerplateRatio > 0.3) {
    return {
      isValid: false,
      reason: `Content appears to be legal boilerplate (${boilerplateHits}/${boilerplatePhrases.length} disclaimer phrases detected)`
    };
  }

  // Check for meaningful financial content indicators
  const meaningfulPhrases = [
    'revenue', 'earnings', 'profit', 'loss', 'growth',
    'strategy', 'initiative', 'quarter', 'fiscal year',
    'market share', 'competitive', 'outlook', 'guidance',
    'ceo', 'cfo', 'management', 'board', 'shareholders',
    'dividend', 'capital', 'assets', 'liabilities',
    'net income', 'operating income', 'efficiency ratio'
  ];

  let meaningfulHits = 0;
  meaningfulPhrases.forEach(phrase => {
    if (contentLower.includes(phrase)) {
      meaningfulHits++;
    }
  });

  // Require at least some meaningful content
  if (meaningfulHits < 3) {
    return {
      isValid: false,
      reason: `Content lacks meaningful financial information (only ${meaningfulHits} relevant terms found)`
    };
  }

  // REPETITION CHECK: Detect if same content is repeated
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  if (sentences.length > 5) {
    const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase().substring(0, 100)));
    const uniqueRatio = uniqueSentences.size / sentences.length;
    if (uniqueRatio < 0.5) {
      return {
        isValid: false,
        reason: `Content appears repetitive (${Math.round(uniqueRatio * 100)}% unique sentences)`
      };
    }
  }

  return {
    isValid: true,
    details: `${contentLength} chars, ${meaningfulHits} financial terms, ${boilerplateHits} disclaimer phrases`
  };
}

/**
 * Phase 1 Auto-Download and RAG Upload
 * Downloads high-scoring sources immediately while links are fresh
 * Handles both PDFs and web content
 */
async function downloadAndUploadToRAG(source, idrssd) {
  const axios = require('axios');
  const GroundingDocument = require('../models/GroundingDocument');
  const groundingService = require('../services/groundingService');

  console.log(`[Phase 1 Auto-Download] Starting for ${source.title} (${source.sourceId})`);
  console.log(`[Phase 1 Auto-Download] URL: ${source.url}`);
  console.log(`[Phase 1 Auto-Download] Score: ${source.score}, Recommended: ${source.recommended}`);

  try {
    // Mark as attempting Phase 1 download
    await source.startFetch();

    // Detect content type from URL
    const isPDF = source.url.toLowerCase().endsWith('.pdf') ||
                  source.url.toLowerCase().includes('.pdf?') ||
                  source.url.toLowerCase().includes('/pdf/');

    let content, contentType, fileSize, filePath, gridfsFileId;

    if (isPDF) {
      // Handle PDF download
      console.log(`[Phase 1 Auto-Download] Downloading PDF...`);

      try {
        const response = await axios.get(source.url, {
          responseType: 'arraybuffer',
          timeout: 60000,
          maxContentLength: 50 * 1024 * 1024,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/pdf,application/octet-stream,*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://bankexplorer.app/',
            'Cache-Control': 'no-cache'
          }
        });

        // Upload to GridFS
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(7);
        const filename = `${timestamp}_${randomId}.pdf`;
        const pdfBuffer = Buffer.from(response.data);
        fileSize = pdfBuffer.length;
        contentType = 'pdf';

        console.log(`[Phase 1 Auto-Download] Uploading PDF to GridFS: ${fileSize} bytes`);

        gridfsFileId = await uploadToGridFS(pdfBuffer, filename, 'application/pdf', {
          idrssd,
          sourceUrl: source.url,
          sourceId: source.sourceId
        });

        console.log(`[Phase 1 Auto-Download] PDF uploaded to GridFS with file ID: ${gridfsFileId}`);

        // Create PDF record with GridFS reference
        const pdf = new PDF({
          pdfId: `pdf_${timestamp}_${randomId}`,
          idrssd,
          originalFilename: source.title + '.pdf' || 'download.pdf',
          storedFilename: filename,
          fileSize: fileSize,
          gridfsFileId: gridfsFileId,
          contentType: 'application/pdf',
          sourceId: source.sourceId,
          sourceUrl: source.url,
          uploadType: 'from_source',
          description: source.preview,
          ragStatus: 'pending'
        });

        await pdf.save();
        console.log(`[Phase 1 Auto-Download] PDF record created: ${pdf.pdfId}`);

      } catch (pdfError) {
        console.error(`[Phase 1 Auto-Download] PDF download failed:`, pdfError.message);
        const statusCode = pdfError.response?.status;
        const isCloudFront = source.url.includes('cloudfront') || source.url.includes('d1io3yog0oux5');

        // Enhanced CloudFront and CDN error handling
        if (isCloudFront) {
          let errorReason = 'CloudFront download failed';

          if (statusCode === 403) {
            errorReason = 'CloudFront signed URL expired or access denied';
          } else if (statusCode === 404) {
            errorReason = 'CloudFront resource not found (PDF may have been moved)';
          } else if (statusCode === 503) {
            errorReason = 'CloudFront service temporarily unavailable';
          } else if (pdfError.code === 'ECONNRESET' || pdfError.code === 'ETIMEDOUT') {
            errorReason = 'CloudFront connection timeout';
          }

          console.log(`[Phase 1 Auto-Download] ${errorReason} (HTTP ${statusCode || 'N/A'})`);
          console.log(`[Phase 1 Auto-Download] TIP: CloudFront URLs are often short-lived. Try re-running source gathering to get fresh URLs.`);

          await source.markPhase1Download(false);
          await source.storeFetchedContent({
            fetchable: false,
            error: errorReason,
            contentType: 'error',
            errorDetails: {
              statusCode,
              isCloudFront: true,
              originalUrl: source.url,
              suggestion: 'Re-run source gathering to get fresh PDF URLs'
            }
          });
          return { success: false, skipped: true, reason: 'cloudfront_error', details: errorReason };
        }

        // Handle other PDF download errors (non-CloudFront)
        if (statusCode === 403) {
          console.log(`[Phase 1 Auto-Download] PDF access forbidden (may require authentication)`);
          await source.markPhase1Download(false);
          await source.storeFetchedContent({
            fetchable: false,
            error: 'PDF access forbidden - may be behind paywall',
            contentType: 'error'
          });
          return { success: false, skipped: true, reason: 'access_forbidden' };
        }

        if (statusCode === 404) {
          console.log(`[Phase 1 Auto-Download] PDF not found (URL may be outdated)`);
          await source.markPhase1Download(false);
          await source.storeFetchedContent({
            fetchable: false,
            error: 'PDF not found - URL may be outdated',
            contentType: 'error'
          });
          return { success: false, skipped: true, reason: 'not_found' };
        }

        throw pdfError;
      }

    } else {
      // Handle web content download
      console.log(`[Phase 1 Auto-Download] Fetching web content...`);

      const fetchResult = await contentFetcher.fetchAndParse(source.url);

      if (!fetchResult.fetchable) {
        console.log(`[Phase 1 Auto-Download] Content not fetchable: ${fetchResult.error}`);
        await source.markPhase1Download(false);
        await source.storeFetchedContent(fetchResult);
        return { success: false, reason: 'not_fetchable', error: fetchResult.error };
      }

      content = fetchResult.content;
      contentType = fetchResult.contentType || 'text';
      fileSize = content.length;

      // If ContentFetcher detected a PDF, download it properly
      if (contentType === 'pdf') {
        console.log(`[Phase 1 Auto-Download] ContentFetcher detected PDF, downloading actual file...`);

        try {
          const pdfResponse = await axios.get(source.url, {
            responseType: 'arraybuffer',
            timeout: 30000,
            maxContentLength: 50 * 1024 * 1024, // 50MB max
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
          });

          if (pdfResponse.status !== 200) {
            throw new Error(`HTTP ${pdfResponse.status}: ${pdfResponse.statusText}`);
          }

          const pdfBuffer = Buffer.from(pdfResponse.data);
          fileSize = pdfBuffer.length;
          isPDF = true;

          console.log(`[Phase 1 Auto-Download] PDF downloaded: ${(fileSize / 1024).toFixed(2)} KB`);

          // Upload to GridFS
          const pdfFilename = `${source.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`;
          gridfsFileId = await uploadToGridFS(pdfBuffer, pdfFilename, 'application/pdf', {
            idrssd,
            sourceUrl: source.url,
            sourceId: source.sourceId
          });

          console.log(`[Phase 1 Auto-Download] PDF uploaded to GridFS: ${gridfsFileId}`);

          // Store fetched content info in source (with PDF flag)
          await source.storeFetchedContent({
            ...fetchResult,
            contentType: 'pdf',
            actualFileSize: fileSize,
            gridfsFileId: gridfsFileId
          });

        } catch (pdfError) {
          console.error(`[Phase 1 Auto-Download] Error downloading PDF:`, pdfError.message);

          const statusCode = pdfError.response?.status;

          if (statusCode === 403) {
            console.log(`[Phase 1 Auto-Download] PDF access forbidden (paywall/auth required)`);
            await source.markPhase1Download(false);
            await source.storeFetchedContent({
              fetchable: false,
              error: 'PDF access forbidden - paywall or authentication required',
              contentType: 'error'
            });
            return { success: false, skipped: true, reason: 'access_forbidden' };
          }

          if (statusCode === 404) {
            console.log(`[Phase 1 Auto-Download] PDF not found (URL may be outdated)`);
            await source.markPhase1Download(false);
            await source.storeFetchedContent({
              fetchable: false,
              error: 'PDF not found - URL may be outdated',
              contentType: 'error'
            });
            return { success: false, skipped: true, reason: 'not_found' };
          }

          throw pdfError;
        }

      } else {
        // Regular web content (HTML, text, etc.)

        // CONTENT QUALITY VALIDATION: Reject boilerplate/legal disclaimers
        const qualityCheck = validateContentQuality(content, source.title);
        if (!qualityCheck.isValid) {
          console.log(`[Phase 1 Auto-Download] Content quality check FAILED: ${qualityCheck.reason}`);
          await source.markPhase1Download(false);
          await source.storeFetchedContent({
            fetchable: false,
            error: `Content quality check failed: ${qualityCheck.reason}`,
            contentType: 'rejected'
          });
          return { success: false, skipped: true, reason: qualityCheck.reason };
        }
        console.log(`[Phase 1 Auto-Download] Content quality check PASSED: ${qualityCheck.details}`);

        // Save web content to disk as text file
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(7);
        const filename = `${timestamp}_${randomId}.txt`;
        const bankContentDir = path.join(PDFS_DIR, idrssd, 'web-content');
        await fs.mkdir(bankContentDir, { recursive: true });
        filePath = path.join(bankContentDir, filename);

        await fs.writeFile(filePath, content, 'utf-8');

        console.log(`[Phase 1 Auto-Download] Web content saved: ${fileSize} chars`);

        // Store fetched content in source
        await source.storeFetchedContent(fetchResult);
      }
    }

    // Create GroundingDocument
    console.log(`[Phase 1 Auto-Download] Creating GroundingDocument...`);

    const groundingDocData = {
      filename: source.title + (isPDF ? '.pdf' : '.txt'),
      title: source.title || source.url,
      idrssd: idrssd,
      fileSize: fileSize,
      topics: mapDocumentTypeToTopics(source.category),
      bankTypes: ['all'],
      assetSizeRange: 'all',
      processingStatus: 'pending',
      sourceId: source.sourceId
    };

    // For PDFs, use GridFS; for text, use filePath (legacy)
    if (isPDF && gridfsFileId) {
      groundingDocData.gridfsFileId = gridfsFileId;
      groundingDocData.contentType = 'application/pdf';
    } else {
      groundingDocData.filePath = filePath;
    }

    const groundingDoc = new GroundingDocument(groundingDocData);

    await groundingDoc.save();
    console.log(`[Phase 1 Auto-Download] GroundingDocument created: ${groundingDoc._id}`);

    // Process document (chunk + embed)
    console.log(`[Phase 1 Auto-Download] Processing for RAG...`);

    await source.startRAGUpload();

    const result = await groundingService.processDocument(groundingDoc._id.toString());

    if (result.success) {
      // Update source
      await source.completeRAGUpload(groundingDoc._id);
      await source.markPhase1Download(true);

      console.log(`[Phase 1 Auto-Download] ✅ Success: ${result.chunkCount} chunks created`);

      return {
        success: true,
        documentId: groundingDoc._id,
        chunkCount: result.chunkCount,
        contentType: contentType
      };
    } else {
      throw new Error(result.error || 'Failed to process document');
    }

  } catch (error) {
    console.error(`[Phase 1 Auto-Download] Error:`, error.message);

    // Mark as failed
    await source.failRAGUpload(error.message);
    await source.markPhase1Download(false);

    return { success: false, error: error.message };
  }
}

/**
 * Map source category to RAG topics
 */
function mapDocumentTypeToTopics(category) {
  const mapping = {
    'investorPresentation': ['strategy', 'financial-performance', 'market-position'],
    'earningsTranscript': ['financial-performance', 'management-commentary', 'forward-guidance'],
    'managementInterview': ['strategy', 'leadership-insights', 'market-position'],
    'techAnnouncement': ['digital-transformation', 'technology-strategy', 'innovation'],
    'strategyAnalysis': ['strategy', 'competitive-analysis', 'market-position'],
    'analystReports': ['financial-analysis', 'market-position', 'performance-metrics']
  };

  return mapping[category] || ['general'];
}

/**
 * GET /api/research/:idrssd/latest
 * Get the most recent research report for a bank
 */
router.get('/:idrssd/latest', async (req, res) => {
  try {
    const { idrssd } = req.params;

    // Find all reports for this bank in GridFS
    const files = await listFilesInGridFS(getDocumentBucket(), {
      filename: { $regex: `^${idrssd}_.*\\.json$` }
    });
    const bankReports = files.map(f => f.filename);

    if (bankReports.length === 0) {
      return res.status(404).json({
        error: 'No research reports found',
        hasReport: false
      });
    }

    // Sort by timestamp (filename format: idrssd_timestamp.json or idrssd_agent_timestamp.json)
    bankReports.sort((a, b) => {
      // Extract timestamp from filename, handling both formats
      const partsA = a.replace('.json', '').split('_');
      const partsB = b.replace('.json', '').split('_');

      // Timestamp is last element
      const timeA = parseInt(partsA[partsA.length - 1]);
      const timeB = parseInt(partsB[partsB.length - 1]);

      return timeB - timeA; // Most recent first
    });

    // Read the most recent report from GridFS
    const report = await loadJsonFromGridFS(getDocumentBucket(), bankReports[0]);

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

    // Calculate elapsed time
    const elapsedMs = Date.now() - job.createdAt;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

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
        updatedAt: job.updatedAt,
        elapsedSeconds
      }
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

/**
 * DELETE /api/research/:idrssd/job
 * Cancel/kill a running job
 */
router.delete('/:idrssd/job', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { type } = req.query; // 'report' or 'podcast'

    const job = jobTracker.getLatestJob(idrssd, type || 'report');

    if (!job) {
      return res.status(404).json({ error: 'No active job found' });
    }

    if (job.status === 'completed' || job.status === 'failed') {
      return res.status(400).json({ error: 'Job is already finished' });
    }

    // Mark job as cancelled
    jobTracker.failJob(job.jobId, new Error('Job cancelled by user'));

    res.json({
      success: true,
      message: 'Job cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling job:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

/**
 * GET /api/research/:idrssd/generate-agent
 * Generate a bank research report using agent-based approach
 * The agent adaptively explores data, searches for context, and queries documents
 */
router.get('/:idrssd/generate-agent', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { sessionId } = req.query;

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.set('Content-Encoding', 'none');
    res.flushHeaders();
    res.write(': connected\n\n');

    const sendStatus = (stage, message, data = {}) => {
      const payload = JSON.stringify({ stage, message, ...data });
      console.log('Agent SSE:', stage, message);
      res.write(`data: ${payload}\n\n`);
      if (res.socket && res.socket.writable) {
        res.socket.uncork();
      }
    };

    // Heartbeat to prevent Heroku H15 idle connection timeout (55 seconds)
    // Send a comment line every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
        if (res.socket && res.socket.writable) {
          res.socket.uncork();
        }
      } catch (err) {
        console.error('[Heartbeat] Error:', err.message);
        clearInterval(heartbeatInterval);
      }
    }, 30000); // 30 seconds

    // Clean up heartbeat on connection close
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      console.log('[Agent] Client disconnected, heartbeat stopped');
    });

    // Step 1: Fetch bank information
    sendStatus('init', 'Initializing agent research system...');

    const institution = await Institution.findOne({ idrssd });
    if (!institution) {
      sendStatus('error', 'Bank not found');
      clearInterval(heartbeatInterval);
      res.end();
      return;
    }

    // Step 2: Fetch financial data
    sendStatus('fetching', 'Loading financial data...');

    const financialStatements = await FinancialStatement.find({ idrssd })
      .sort({ reportingPeriod: -1 })
      .limit(20);

    if (financialStatements.length === 0) {
      sendStatus('error', 'No financial data found for this bank');
      clearInterval(heartbeatInterval);
      res.end();
      return;
    }

    const trendsData = prepareTrendsData(financialStatements);
    const latestStatement = financialStatements[0];

    // Fetch peer analysis data
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

    // Step 2.5: Load strategic priorities from BankMetadata (from Phase 3 insights extraction)
    sendStatus('preparing', 'Loading strategic priorities...');
    const metadata = await BankMetadata.findOne({ idrssd });
    let existingPriorities = [];
    let existingMetrics = [];
    let existingPartnerships = [];

    if (metadata && metadata.strategicInsights) {
      existingPriorities = metadata.strategicInsights.priorities || [];
      existingMetrics = metadata.strategicInsights.focusMetrics || [];
      existingPartnerships = metadata.strategicInsights.techPartnerships || [];
      console.log(`Loaded ${existingPriorities.length} strategic priorities from BankMetadata`);
    } else {
      console.log('No existing strategic priorities found in BankMetadata - will use web search fallback');
    }

    // Step 3: Check RAG document availability
    sendStatus('preparing', 'Checking RAG document library...');
    const groundingService = require('../services/groundingService');
    const ragDocumentCount = await require('../models/GroundingDocument').countDocuments({
      idrssd,
      processingStatus: 'completed'
    });
    console.log(`Found ${ragDocumentCount} documents in RAG for bank ${idrssd}`);

    // Step 4: Get approved sources if sessionId provided (legacy sources)
    let approvedSources = [];
    if (sessionId) {
      sendStatus('preparing', 'Loading research sources...');
      approvedSources = await Source.getApprovedBySession(sessionId);
      console.log(`Found ${approvedSources.length} approved sources for session ${sessionId}`);
    }

    // Step 4: Initialize and run the agent
    sendStatus('agent_init', 'Starting agent research phase...');

    const agent = new AgentOrchestrator({
      maxIterations: 15,
      maxTimeout: 600000, // 10 minutes
      onProgress: (event) => {
        if (event.type === 'milestone') {
          sendStatus('agent_milestone', event.milestone, { details: event.details });
        } else if (event.type === 'insight') {
          sendStatus('agent_insight', event.insight.title, {
            insight: event.insight
          });
        }
      }
    });

    // Build initial prompt for agent
    const strategicPrioritiesText = existingPriorities.length > 0
      ? `\n**EXISTING STRATEGIC PRIORITIES (from Phase 3 insights extraction):**
${existingPriorities.map((p, i) => `${i + 1}. ${p}`).join('\n')}

These priorities were previously extracted from documents in RAG. START with these as your foundation.`
      : '\n**No existing strategic priorities found.** You will need to discover them using RAG queries and web search.';

    const focusMetricsText = existingMetrics.length > 0
      ? `\n**KEY FOCUS METRICS (from Phase 3):** ${existingMetrics.join(', ')}`
      : '';

    const techPartnershipsText = existingPartnerships.length > 0
      ? `\n**KNOWN TECHNOLOGY PARTNERSHIPS (from Phase 3):** ${existingPartnerships.join(', ')}`
      : '';

    const agentPrompt = `You are a financial research agent analyzing ${bankInfo.name}, a bank located in ${bankInfo.city}, ${bankInfo.state} with $${(bankInfo.totalAssets / 1000000).toFixed(0)}M in total assets.

Your mission is to conduct a comprehensive investigation of this bank's financial performance, strategic position, and future prospects. You have access to:
- ${financialStatements.length} quarters of detailed financial data
- ${peerData ? `Peer analysis comparing to ${peerData.count} similar banks` : 'No peer comparison data'}
- ${ragDocumentCount} documents in RAG system (investor presentations, earnings transcripts, annual reports, analyst reports)
  **IMPORTANT:** Use the query_bank_documents tool to search these documents for specific information
- Web search capabilities for recent news and context${strategicPrioritiesText}${focusMetricsText}${techPartnershipsText}

**Your Research Process:**
1. **Start by analyzing CRITICAL financial metrics:** Always begin by analyzing "efficiencyRatio" and "operatingLeverage" together using analyze_financials. These are the most important metrics for understanding operational efficiency and scalability.
2. Analyze additional financial trends to identify notable patterns, strengths, and concerns
3. **STRATEGIC PRIORITIES - Use existing priorities as foundation:**
   ${existingPriorities.length > 0 ? `- START with the ${existingPriorities.length} strategic priorities listed above from Phase 3
   - Use query_bank_documents to get more details on each priority (e.g., "What details are available about [Priority Name]?")
   - Use web search to find recent updates, progress, and news about these specific priorities` : `- Use query_bank_documents to discover strategic priorities: "What are the bank's strategic priorities and key initiatives?"
   - Use web search if RAG doesn't provide sufficient information:
     * "[Bank Name] strategic priorities 2024"
     * "[Bank Name] key initiatives"
     * "[Bank Name] management priorities"`}
4. **DEEP DIVE ON STRATEGIC INITIATIVES:** For EACH strategic priority identified:
   - **RAG Query:** Use query_bank_documents to get detailed information about the initiative from documents:
     * "What details are available about [Initiative Name]?"
     * "What are the goals and timeline for [Initiative Name]?"
     * "What technology partners or vendors are involved in [Initiative Name]?"
   - **Web Search:** Perform targeted web searches for recent updates:
     * "[Bank Name] [Initiative Name] 2024"
     * "[Bank Name] [Initiative Name] progress"
     * Look for recent announcements, partnerships, or challenges
   - **Financial Analysis:** Use analyze_financials to cross-reference initiatives with financial metrics:
     * For technology/digital initiatives: Analyze "efficiencyRatio" and "operatingLeverage" trends
     * For growth initiatives: Analyze revenue trends, loan growth, deposit growth
     * For cost initiatives: Analyze expense trends, cost-to-income ratios
   - **Assessment:** Determine whether financial metrics support the initiative's success:
     * Are efficiency ratios improving? (Lower is better)
     * Is operating leverage positive/sustained? (Higher = good, revenue growing faster than expenses)
     * Are expenses growing slower than revenue?
6. **AI, AGENTS, AND DIGITAL LABOR ANALYSIS:** For each strategic initiative, provide insights on how AI, agents, and digital labor could help BUILD OPERATING LEVERAGE:
   - **OPERATING LEVERAGE = Revenue Growth FASTER than Expense Growth (positive operating leverage)**
   - **For each initiative, analyze BOTH sides of operating leverage:**
     * **Cost Savings Side:** How could AI/agents reduce expenses?
       - Automation of manual processes
       - Digital labor replacing human labor in repetitive tasks
       - Process efficiency improvements
       - Headcount reduction through automation
     * **Revenue Growth Side:** How could AI/agents increase revenue?
       - Accelerating time-to-market for new products/services
       - Enabling new revenue streams (e.g., AI-powered advisory services)
       - Improving customer acquisition and retention
       - Scaling operations without proportional cost increases
       - Digital labor enabling 24/7 service capabilities
   - **For technology/digital initiatives:** How could AI agents automate processes? What digital labor opportunities exist for both cost reduction AND revenue generation?
   - **For operational efficiency initiatives:** How could AI improve the efficiency ratio? Where could agents reduce manual work? How could this enable revenue growth at lower cost?
   - **For growth initiatives:** How could AI/agents accelerate implementation? What repetitive tasks could be automated? What new revenue opportunities could digital labor enable?
   - **Generate insights** using generate_insight with type "technology_investment" or "strategic_initiative" that include:
     * Assessment of the initiative's financial impact (based on metrics)
     * Specific recommendations for how AI/agents/digital labor could help:
       - **Cost savings opportunities** (expense reduction)
       - **Revenue growth opportunities** (revenue expansion)
       - **Operating leverage impact** (how it helps achieve positive operating leverage)
     * Potential efficiency gains, cost reductions, AND revenue growth opportunities
     * Estimated impact on efficiency ratio and operating leverage metrics
5. **MANDATORY WEB SEARCHES - Additional context:**
   - **For existing strategic priorities:** Search for recent updates:
     * "[Bank Name] [Priority Name] 2024" - Recent progress and news
     * "[Bank Name] [Priority Name] update" - Latest developments
   - **ALWAYS perform these searches:**
     * "[Bank Name] news 2024" - Recent announcements
     * "[Bank Name] earnings commentary" - Latest management commentary
     * "[Bank Name] technology investment" - Technology initiatives
     * "[Bank Name] leadership team" - Key executives
   **DO NOT SKIP WEB SEARCHES** - These provide critical recent context.
6. **MANDATORY LEADERSHIP RESEARCH:** Research and profile key executives. You MUST identify and research:
   - CEO: Search "[Bank Name] CEO [Name]" to find name, background, tenure, strategic vision
   - CFO: Search "[Bank Name] CFO [Name]" - Financial leadership and capital allocation strategy
   - CIO/CTO: Search "[Bank Name] CIO" or "[Bank Name] chief information officer" - Technology leadership
   - Head of AI/Digital Innovation: Search "[Bank Name] head of AI" or "[Bank Name] chief digital officer" - AI and innovation leadership
   - Head of Procurement: Search "[Bank Name] head of procurement" or "[Bank Name] chief procurement officer" - Procurement and vendor management
   - Business Line Leaders: Search "[Bank Name] head of [business line]" - Consumer banking, commercial banking, wealth management leaders
   For EACH executive, search for their photo: "[Executive Name] [Bank Name] photo" or "[Executive Name] [Bank Name] LinkedIn" to find professional headshots
9. Generate insights as you discover important findings - incorporate document findings, web search results, leadership information, and strategic initiative assessments into your insights
10. When you have sufficient information, signal completion

**IMPORTANT:** If you complete research without performing web searches, you are missing critical information. Always use web search to find recent strategic initiatives, technology programs, and management commentary.

**Focus Areas (START with existing priorities, use RAG for details, then web search for updates):**
- **Strategic Initiative Discovery & Analysis:**
  - **STEP 1 - Start with existing priorities:** If priorities are provided from Phase 3, start with those. Otherwise, use query_rag to discover: "What are the bank's key strategic priorities and initiatives?"
  - **STEP 2 - Get details from RAG:** For each priority, use query_rag to find goals, timelines, and progress: "What details are available about [Priority Name]?"
  - **STEP 3 - Deep Dive Each Initiative:**
    * Use query_rag for document insights about the initiative
    * Perform targeted web searches for recent updates: "[Bank Name] [Initiative Name] 2024"
    * Analyze relevant financial metrics using analyze_financials:
      - Technology/digital initiatives → efficiencyRatio, operatingLeverage
      - Growth initiatives → revenue trends, loan growth, deposit growth
      - Cost initiatives → expense trends, cost ratios
    * Assess whether metrics support initiative success
  - **STEP 4 - AI/Digital Labor Recommendations:** For each initiative, analyze how AI, agents, and digital labor could help BUILD OPERATING LEVERAGE:
    * **Cost Savings Side:**
      - Identify automation opportunities that reduce expenses
      - Estimate potential cost reductions
      - Recommend digital labor use cases for expense reduction
    * **Revenue Growth Side:**
      - Identify opportunities to accelerate revenue growth
      - Estimate potential revenue expansion (new products, faster time-to-market, scale)
      - Recommend AI/agent use cases that enable new revenue streams
    * **Operating Leverage Impact:**
      - Assess how the initiative helps achieve positive operating leverage (revenue growth > expense growth)
      - Estimate combined impact on efficiency ratio and operating leverage metrics
  - **STEP 5 - Generate Insights:** Create insights for each major initiative that includes:
    * Financial metric assessment (is it working?)
    * AI/agents/digital labor recommendations covering BOTH:
      - Cost savings opportunities (expense reduction)
      - Revenue growth opportunities (revenue expansion)
    * Potential impact on efficiency ratio and operating leverage
    * Operating leverage assessment (will this help achieve positive operating leverage?)
  
- **Technology and digital initiatives (sub-set of strategic initiatives):**
  - Cross-reference ALL technology investments with efficiency ratio and operating leverage trends
  - Look for cloud migration, API platforms, mobile banking initiatives, fintech partnerships
  - Assess how current tech investments are performing using metrics
  - Provide specific recommendations on how AI/agents/digital labor could enhance or accelerate these initiatives
  - **Focus on operating leverage:** For each tech initiative, analyze how it can drive BOTH cost savings AND revenue growth to build positive operating leverage
  
- **Financial performance trends (MUST INCLUDE efficiency ratio and operating leverage):**
  - Efficiency Ratio: Analyze trends (LOWER is better). How has it changed over time? Is technology investment improving it?
  - Operating Leverage: Analyze trends (HIGHER is better). Is the bank achieving sustained positive operating leverage? What does this indicate about scalability?
  - Profitability metrics (ROE, ROA, NIM)
  - Credit quality
  
- **Recent news and market context (MANDATORY WEB SEARCH):**
  - Search for recent news, press releases, major announcements from last 6 months
  - Look for regulatory developments, market changes, competitive dynamics
  - **Example searches:** "[Bank Name] news 2024", "[Bank Name] announces", "[Bank Name] press release"
  
- Competitive positioning vs peers
- **Leadership and management quality (MANDATORY):**
  - Research and profile key executives: CEO, CFO, CIO/CTO, Head of AI/Digital Innovation, Head of Procurement, and business line leaders
  - For each executive, find: name, title, background, tenure, key initiatives, strategic focus, recent achievements
  - Search for professional headshots: "[Name] [Bank Name] photo", "[Name] [Bank Name] LinkedIn", "[Name] [Bank Name] headshot"
  - Use web searches to find executives on bank's leadership page, LinkedIn, press releases, industry publications
- Risk factors and concerns
- Growth opportunities

**CRITICAL METRIC INTERPRETATION GUIDANCE:**
When analyzing financial metrics, understand the correct direction for each:
- **Efficiency Ratio**: LOWER is better. A 45% efficiency ratio is excellent, while 75% is poor. Decreasing efficiency ratio = improvement. Increasing efficiency ratio = worsening. **Always analyze this metric when evaluating technology investments, operational improvements, or cost management initiatives.**
- **Operating Leverage**: HIGHER is better. Operating leverage measures operational scalability by measuring how changes in revenue amplify changes in operating income. **Formula:** Operating Leverage = (YoY % Change in PPNR) / (YoY % Change in Total Revenue), where Total Revenue = Total Interest Income + Total Non-Interest Income, and PPNR (Pre-Provision Net Revenue) = Total Revenue - Total Operating Expenses. Higher values (> 1.0) indicate revenue changes have a magnified impact on operating income (positive leverage, EXCELLENT). Values < 1.0 indicate operating income changes less than revenue (negative leverage) = BAD. Sustained operating leverage > 1.0 over multiple quarters indicates scalable, efficient operations. **CRITICAL: Always analyze operating leverage when evaluating technology investments or operational efficiency. Technology investments should lead to sustained operating leverage > 1.0 if successful.**
- **ROE (Return on Equity)**: HIGHER is better (15% is strong, 5% is weak).
- **NIM (Net Interest Margin)**: HIGHER is better (4% is healthy, 2% is compressed).

**MANDATORY ANALYSIS:** 
- When using analyze_financials tool, ALWAYS include both "efficiencyRatio" and "operatingLeverage" in your metrics array when analyzing:
  - Operational efficiency
  - Technology investments
  - Cost management
  - Digital transformation initiatives
  - Scalability and operational discipline

When generating insights about these metrics, always state the correct direction and what it means for the bank's performance.

Use your tools strategically to build a comprehensive understanding. Be thorough but efficient. When you've gathered sufficient insights, call complete_research.`;

    const agentContext = {
      bankInfo,
      financialData: financialStatements,
      peerData: peerData,
      sessionId: sessionId,
      approvedSources: approvedSources, // Includes both Source documents and PDF sources
      totalAssets: bankInfo.totalAssets // Add for memory context
    };

    // Run the agent
    sendStatus('agent_running', 'Agent exploring financial data...');

    const agentResult = await agent.run(agentPrompt, agentContext);

    sendStatus('agent_complete', `Research complete: ${agentResult.insights.length} insights discovered`, {
      stats: agentResult.stats
    });

    // Step 5: Synthesize final report using insights
    sendStatus('synthesizing', 'Synthesizing final report from agent insights...');

    const claudeService = new ClaudeService();

    // Build comprehensive sources list
    const allSources = [];
    let sourceIndex = 1;
    const sourceMap = new Map(); // Track source -> citation number

    // Add web search sources from agent
    if (agentResult.stats && agentResult.stats.webSearches && agentResult.stats.webSearches.length > 0) {
      agentResult.stats.webSearches.forEach(search => {
        // Use sourceDetails if available (structured data), otherwise fall back to sources array
        const sourcesToProcess = search.sourceDetails && search.sourceDetails.length > 0
          ? search.sourceDetails
          : (search.sources || []).map(url => ({ url, title: url, snippet: null }));
        
        sourcesToProcess.forEach(sourceInfo => {
          const url = typeof sourceInfo === 'string' ? sourceInfo : sourceInfo.url;
          const title = typeof sourceInfo === 'string' ? sourceInfo : (sourceInfo.title || search.query || 'Web search result');
          const sourceKey = url;
          
          if (!sourceMap.has(sourceKey)) {
            sourceMap.set(sourceKey, sourceIndex);
            allSources.push({
              number: sourceIndex,
              type: `Web Search - ${search.focus || 'General'}`,
              title: title,
              url: url,
              query: search.query,
              summary: search.summary || null,
              snippet: typeof sourceInfo === 'object' ? sourceInfo.snippet : null
            });
            sourceIndex++;
          }
        });
      });
    }

    // Add document query sources
    if (agentResult.stats.documentsQueried && agentResult.stats.documentsQueried.length > 0) {
      agentResult.stats.documentsQueried.forEach(query => {
        if (query.documents && query.documents.length > 0) {
          query.documents.forEach(doc => {
            const sourceKey = doc.url || doc.title;
            if (!sourceMap.has(sourceKey)) {
              sourceMap.set(sourceKey, sourceIndex);
              allSources.push({
                number: sourceIndex,
                type: doc.category || 'Document',
                title: doc.title,
                url: doc.url,
                date: doc.publishDate
              });
              sourceIndex++;
            }
          });
        }
      });
    }

    // Add approved sources that were made available
    if (approvedSources && approvedSources.length > 0) {
      approvedSources.forEach(source => {
        const sourceKey = source.url || source.title;
        if (!sourceMap.has(sourceKey)) {
          sourceMap.set(sourceKey, sourceIndex);
          allSources.push({
            number: sourceIndex,
            type: source.category || 'Research Source',
            title: source.title,
            url: source.url,
            date: source.publishDate
          });
          sourceIndex++;
        }
      });
    }

    // Format sources list with clickable links
    const sourcesSection = allSources.length > 0 ? `
# Available Sources for Citation

Use these source numbers in your citations: [Source 1], [Source 2], [Source 3], etc. or [1], [2], [3], etc.

${allSources.map(s => {
  let citation = `**[${s.number}] ${s.type}**`;
  if (s.title && s.url) {
    // Always include clickable link if URL exists
    citation += `: [${s.title}](${s.url})`;
  } else if (s.title && !s.url) {
    citation += `: ${s.title}`;
  } else if (s.url) {
    // If no title but has URL, use URL as both text and link
    citation += `: [${s.url}](${s.url})`;
  }
  if (s.date) citation += ` (${new Date(s.date).toLocaleDateString()})`;
  if (s.query) citation += ` - Search: "${s.query}"`;
  if (s.snippet) citation += `\n  *${s.snippet.substring(0, 150)}${s.snippet.length > 150 ? '...' : ''}*`;
  return citation;
}).join('\n\n')}

**Call Report Data Available:**
Financial statements from Q1 2021 through Q2 2025. Cite as: [Call Report: Q# YYYY]
` : '**Note:** Limited source data available. Use [Call Report: Q# YYYY] format for financial data citations.';

    // Build synthesis prompt
    const insightsSummary = agentResult.insights
      .sort((a, b) => {
        const importanceOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return importanceOrder[a.importance] - importanceOrder[b.importance];
      })
      .map((insight, idx) => {
        return `## Insight ${idx + 1}: ${insight.title} [${insight.importance.toUpperCase()}]
**Type:** ${insight.type}
${insight.content}
**Evidence:** ${insight.evidence.join(', ')}
`;
      }).join('\n\n');

    // Build leadership research reminder for synthesis
    const leadershipReminder = `**CRITICAL - LEADERSHIP PROFILES REQUIRED:**
You MUST include a comprehensive "Leadership & Management" section with detailed profiles of key executives. For each executive, use the <leader> tag format:

<leader name="Full Name" title="Job Title" image="https://photo-url.com/headshot.jpg">
Brief bio including background, tenure at ${bankInfo.name}, key initiatives they've led, strategic focus areas, and recent achievements. [Source #]
</leader>

**Required executives to profile:**
1. CEO (Chief Executive Officer) - Strategic vision, public statements, leadership style
2. CFO (Chief Financial Officer) - Financial leadership, capital allocation strategy
3. CIO/CTO (Chief Information/Technology Officer) - Technology strategy, digital transformation
4. Head of AI/Digital Innovation (or Chief Digital Officer, Chief Innovation Officer) - AI initiatives, digital capabilities
5. Head of Procurement (or Chief Procurement Officer) - Vendor management, procurement strategy
6. Key business line leaders:
   - Head of Consumer Banking
   - Head of Commercial Banking  
   - Head of Wealth Management (if applicable)
   - Other major business line leaders

**Photo search instructions:**
For each executive, you should have searched for their photo using queries like:
- "[Executive Name] ${bankInfo.name} photo"
- "[Executive Name] ${bankInfo.name} LinkedIn"
- "[Executive Name] ${bankInfo.name} headshot"

If you found a photo URL from web searches, include it in the image attribute. If no photo was found after searching, use image="" (empty string).

**Important:**
- Write leader tags directly in your response (NOT in code blocks or with backticks)
- Include specific details about each executive's background, tenure, and contributions
- Cite sources for executive information using [Source #] format
- Place all leader profiles in the "Leadership & Management" section
- Each profile should be 2-4 sentences with concrete details about their role and impact
`;

    // Build web search summary section
    const webSearchSummary = agentResult.stats.webSearches && agentResult.stats.webSearches.length > 0
      ? `\n\n# Web Search Results

The following web searches were performed to gather additional context:

${agentResult.stats.webSearches.map((search, idx) => {
  return `## Search ${idx + 1}: ${search.query || 'General search'} (Focus: ${search.focus || 'general'})
${search.summary || 'Results found but summary not available'}
${search.sources && search.sources.length > 0 ? `Sources: ${search.sources.slice(0, 5).join(', ')}` : 'No sources found'}
`;
}).join('\n')}

**IMPORTANT:** Incorporate information from these web searches into your report, especially:
- Technology initiatives and programs (e.g., T3, digital transformation, cloud migration)
- Strategic initiatives and business model changes
- Recent news and announcements
- Management commentary on strategy and performance
- Digital capabilities and innovation investments
- **Leadership and executive information:** Use web search results to build comprehensive executive profiles with names, titles, backgrounds, and headshot URLs
`
      : '\n\n**NOTE:** No web searches were performed. This may mean critical information about technology initiatives, strategic programs, and recent news is missing.';

    // Build call report citation references
    const callReportPeriods = financialStatements.map(stmt => {
      const date = new Date(stmt.reportingPeriod);
      const year = date.getFullYear();
      const quarter = Math.ceil((date.getMonth() + 1) / 3);
      return `Q${quarter} ${year}`;
    }).join(', ');

    const synthesisPrompt = `You have conducted extensive research on ${bankInfo.name}. Below are key findings you discovered during your investigation. These should be INCORPORATED directly into your report narrative - do NOT create a separate "Key Insights" or "Research Insights" section.

**CRITICAL INSTRUCTION:** DO NOT create a "Key Insights" or "Research Insights" section. Instead, INCORPORATE these findings naturally into the report narrative. For each finding:
- If it's a key strategic initiative, create a detailed section analyzing that initiative with financial metrics, progress assessment, and recommendations
- If it's a critical finding, weave it into the relevant section with supporting evidence
- If it's important enough, create visual representations using charts or expand into a dedicated subsection
- Use these findings as building blocks for comprehensive analysis, not as a separate list

${insightsSummary}

${webSearchSummary}

# Financial Data Summary

${JSON.stringify(trendsData, null, 2)}

${peerData ? `# Peer Analysis\n\n${JSON.stringify(peerData, null, 2)}` : ''}

${sourcesSection}

---

Now synthesize these insights into a comprehensive, well-structured research report. The report should:

1. **Executive Summary** - High-level overview of the bank's position and key findings
2. **Financial Performance Analysis** - Deep dive into trends, with specific metrics and charts
   - **CRITICAL:** Cite call report data using format: [Call Report: Q# YYYY] for each specific metric or data point
   - **CRITICAL - Number Labeling:** ALWAYS explicitly label what each number represents. Never list dollar amounts, percentages, or metrics without clear context.
   - **CORRECT Examples:**
     * "Total assets grew to $15.2B in Q2 2025 [Call Report: Q2 2025], representing 8% YoY growth"
     * "Business loans totaling $8.5B [Call Report: Q2 2025] represent 56% of total assets"
     * "Net interest income of $125M [Call Report: Q2 2025] increased 8% year-over-year"
     * "The efficiency ratio improved to 58% [Call Report: Q2 2025]"
   - **INCORRECT Examples (DO NOT USE):**
     * "$15.2B [Call Report: Q2 2025], representing 8% YoY growth" (missing label - what is $15.2B?)
     * "$8.5B [Call Report: Q2 2025], representing 56% of total assets" (missing label - what category?)
     * "$125M [Call Report: Q2 2025]" (missing label - what metric?)
   - When discussing trends over multiple periods: "Net income increased from $45M in Q1 2024 [Call Report: Q1 2024] to $52M in Q2 2025 [Call Report: Q2 2025]"
   - **Rule:** Every number must be preceded or immediately followed by a clear label (e.g., "Total assets of $X", "Business loans totaling $X", "Efficiency ratio of X%")
3. **Strategic Position** - Competitive positioning, differentiation, strategic initiatives
   - For strategic initiatives found in documents: Cite as [Source #] where # matches the source number
   - For initiatives from web searches: Cite as [Source #] where # matches the web search source
   - Example: "The bank's T3 technology platform [Source 3] aims to improve operational efficiency..."
4. **Technology & Innovation** - Digital capabilities, technology investments
   - Cite PDF documents and web sources when discussing technology programs
5. **Leadership & Management** - ${leadershipReminder}
6. **Risk Assessment** - Key risks and concerns
7. **Future Outlook** - Growth opportunities and challenges
8. **Sources** - List all sources referenced in the report with clickable links

**AGGRESSIVE CITATION REQUIREMENTS:**

1. **Call Report Citations:**
   - Cite EVERY financial metric, ratio, or data point with: [Call Report: Q# YYYY]
   - Examples:
     * "Efficiency ratio improved to 58% [Call Report: Q2 2025], down from 62% [Call Report: Q1 2024]"
     * "Net interest income reached $125M [Call Report: Q2 2025]"
     * "Operating leverage of 1.8x [Call Report: Q2 2025] indicates revenue growing faster than expenses"
   - When referencing balance sheet items: "Total assets of $15.2B [Call Report: Q2 2025] include $8.5B in loans [Call Report: Q2 2025]"
   - When referencing income statement: "Net income of $45M [Call Report: Q2 2025] was driven by $120M in net interest income [Call Report: Q2 2025]"

2. **PDF Document Citations:**
   - When referencing information from PDFs (investor presentations, earnings transcripts, etc.): Use [Source #] where # is the source number
   - Example: "According to the Q2 2025 earnings transcript [Source 5], management emphasized digital transformation..."
   - Include specific page references or quotes when available: "The investor presentation [Source 7] states: 'We are investing $50M in digital capabilities...'"

3. **Web Source Citations:**
   - When referencing news, articles, or web content: Use [Source #] where # is the source number
   - Example: "Recent news [Source 12] indicates the bank is expanding into new markets..."
   - For leadership information: "The CEO, John Smith [Source 8], has led the bank since 2020..."

4. **Citation Format Rules:**
   - Place citations IMMEDIATELY after the fact or statement: "Revenue grew 10% [Call Report: Q2 2025] [Source 3]"
   - Multiple citations are fine: "The bank announced a new initiative [Source 5] that aligns with its efficiency goals [Call Report: Q2 2025]"
   - For paragraphs with multiple facts, cite each: "Assets increased to $15B [Call Report: Q2 2025]. The bank's strategy [Source 7] focuses on digital transformation. Efficiency improved to 58% [Call Report: Q2 2025]."
   - Be GENEROUS with citations - it's better to over-cite than under-cite

5. **Sources Section Format:**
   At the end of the report, include a comprehensive "Sources" section:
   
   ## Sources
   
   **Call Report Data:**
   - Q1 2021 through Q2 2025 - Federal Financial Institutions Examination Council (FFIEC) Call Reports, accessed via regulatory databases
   
   **PDF Documents:**
   [List all PDF sources with clickable links - ONLY include sources you actually cited in the report]
   - [1] [Title](URL) - [Date if available]
   - [2] [Title](URL) - [Date if available]
   
   **Web Sources:**
   [List all web sources with clickable links - ONLY include sources you actually cited in the report]
   - [3] [Title](URL) - [Search query if relevant]
   - [4] [Title](URL) - [Search query if relevant]
   
   **CRITICAL:** 
   - For web sources, use the actual URL from the source. Format as: [Title](URL) where URL is the actual clickable link.
   - ONLY list sources that you actually cited in the report body using [Source #] or [#] format.
   - Group sources by type (PDF Documents, Web Sources) for clarity.
   - Include the search query for web sources when it provides context about what information was found.

**Chart Instructions:**
Use chart tags where appropriate (use kebab-case for metric names):
- <chart:net-income /> for income trends
- <chart:asset-composition /> for asset breakdowns
- <chart:loan-portfolio /> for lending analysis
- <chart:efficiency-ratio /> for efficiency metrics
- <chart:roe /> for return on equity
- <chart:nim /> for net interest margin
Available metric names: net-income, asset-composition, loan-portfolio, income-breakdown, expense-breakdown, efficiency-ratio, roe, roa, nim, operating-leverage, fte-trends

Write in a professional, analytical tone suitable for investors and executives. Ensure all factual claims are properly cited.`;

    let fullReport = '';

    // Use Claude to synthesize the report
    const Anthropic = require('@anthropic-ai/sdk');
    const modelResolver = require('../services/modelResolver');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Get latest model
    const latestModel = await modelResolver.getLatestKitModel();

    const synthesisStream = await anthropic.messages.stream({
      model: latestModel,
      max_tokens: 16000,
      thinking: {
        type: 'enabled',
        budget_tokens: 10000
      },
      messages: [{
        role: 'user',
        content: synthesisPrompt
      }]
    });

    for await (const event of synthesisStream) {
      if (event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta') {
        const chunk = event.delta.text;
        fullReport += chunk;
        sendStatus('synthesis_stream', 'Generating report...', {
          textChunk: chunk
        });
      }
    }

    // Step 6: Save report
    sendStatus('saving', 'Saving research report...');

    const timestamp = Date.now();
    const fileName = `${idrssd}_agent_${timestamp}.json`;

    // Extract web search sources for tracking
    const webSearchSources = [];
    if (agentResult.stats && agentResult.stats.webSearches && agentResult.stats.webSearches.length > 0) {
      agentResult.stats.webSearches.forEach(search => {
        const sourcesToProcess = search.sourceDetails && search.sourceDetails.length > 0
          ? search.sourceDetails
          : (search.sources || []).map(url => ({ url, title: url, snippet: null }));
        
        sourcesToProcess.forEach(sourceInfo => {
          const url = typeof sourceInfo === 'string' ? sourceInfo : sourceInfo.url;
          const title = typeof sourceInfo === 'string' ? sourceInfo : (sourceInfo.title || search.query || 'Web search result');
          
          webSearchSources.push({
            url: url,
            title: title,
            query: search.query,
            focus: search.focus || 'General',
            snippet: typeof sourceInfo === 'object' ? sourceInfo.snippet : null,
            summary: search.summary || null
          });
        });
      });
    }

    const reportData = {
      idrssd,
      bankName: institution.name,
      generatedAt: new Date().toISOString(),
      method: 'agent-based',
      model: latestModel,
      analysis: fullReport,
      agentInsights: agentResult.insights,
      agentStats: agentResult.stats,
      trendsData,
      sessionId: sessionId || null,
      webSearchSources: webSearchSources // Track web search sources for citation tracking
    };

    // Save report to GridFS (primary storage)
    const fileId = await saveJsonToGridFS(getDocumentBucket(), fileName, reportData, {
      idrssd,
      type: 'agent-report',
      method: 'agent-based'
    });
    console.log(`Report saved to GridFS for bank ${idrssd}, fileId: ${fileId}`);

    // Also save to ResearchReport collection for history tracking
    const ResearchReport = require('../models/ResearchReport');
    await ResearchReport.create({
      idrssd,
      title: `${institution.name} Analysis - ${new Date().toLocaleDateString()}`,
      reportData: reportData,
      gridfsFileId: fileId,
      fileName,
      agentVersion: 'v2.0'
    });

    console.log(`Report saved to ResearchReport collection for bank ${idrssd}`);

    // Step 7: Complete
    sendStatus('complete', 'Agent-based report generated successfully', {
      report: reportData,
      fileName
    });

    clearInterval(heartbeatInterval);
    res.end();

  } catch (error) {
    console.error('Error in agent-based report generation:', error);
    res.write(`data: ${JSON.stringify({
      stage: 'error',
      message: `Error: ${error.message}`
    })}\n\n`);
    clearInterval(heartbeatInterval);
    res.end();
  }
});

/**
 * POST /api/research/:idrssd/generate-agent-batch
 * SSE streaming version of generate-agent for batch processing
 * Sends progress updates to prevent Heroku H12/H15 timeouts
 */
router.post('/:idrssd/generate-agent-batch', async (req, res) => {
  const { idrssd } = req.params;
  const { sessionId } = req.body;

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendStatus = (stage, message, data = {}) => {
    res.write(`data: ${JSON.stringify({ stage, message, ...data })}\n\n`);
  };

  // Heartbeat to prevent H15 idle connection timeout (55 seconds)
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
      if (res.socket && res.socket.writable) {
        res.socket.uncork();
      }
    } catch (err) {
      console.error('[Batch Generate Agent Heartbeat] Error:', err.message);
      clearInterval(heartbeatInterval);
    }
  }, 30000); // 30 seconds

  try {
    console.log(`[Batch] Starting agent report generation for bank ${idrssd}`);
    sendStatus('init', 'Initializing agent report generation...');

    // Use the agent report service (shared logic with SSE endpoint)
    const agentReportService = require('../services/agentReportService');

    // Pass onProgress callback to send SSE updates
    const result = await agentReportService.generateAgentReport(
      idrssd,
      sessionId,
      {
        onProgress: (progressData) => {
          const { stage, message, ...data } = progressData;
          sendStatus(stage, message, data);
        }
      }
    );

    clearInterval(heartbeatInterval);

    if (result.success) {
      console.log(`[Batch] Agent report generated successfully: ${result.fileName}`);
      // Don't send full report object - it's too large for SSE and causes parsing issues
      // Just send key metadata - the report is already saved to the database
      sendStatus('complete', 'Report generation complete', {
        success: true,
        fileName: result.fileName,
        generatedAt: result.report?.generatedAt,
        bankName: result.report?.bankName
      });
      res.end();
    } else {
      console.error(`[Batch] Agent report generation failed: ${result.error}`);
      sendStatus('error', result.error || 'Failed to generate report');
      res.end();
    }

  } catch (error) {
    console.error('[Batch] Error in generate-agent-batch:', error.message);
    console.error('[Batch] Stack:', error.stack);
    clearInterval(heartbeatInterval);
    sendStatus('error', error.message || 'Failed to generate report');
    res.end();
  }
});

/**
 * DELETE /api/research/:idrssd/clear-all
 * Clear all data for a bank: sources, reports, and podcasts
 * NOTE: This route MUST come before /:idrssd/:filename to avoid wildcard matching
 */
router.delete('/:idrssd/clear-all', async (req, res) => {
  try {
    const { idrssd } = req.params;

    console.log(`[ClearAll] Clearing all data for bank: ${idrssd}`);

    // 1. Delete all sources for this bank
    const sourcesResult = await Source.deleteMany({ idrssd });
    console.log(`[ClearAll] Deleted ${sourcesResult.deletedCount} sources`);

    // 2. Delete all report files for this bank from GridFS
    let deletedReports = 0;
    try {
      const reportFiles = await listFilesInGridFS(getDocumentBucket(), {
        filename: { $regex: `^${idrssd}_.*\\.json$` }
      });
      for (const file of reportFiles) {
        await deleteFileFromGridFS(getDocumentBucket(), file.filename);
        deletedReports++;
      }
      console.log(`[ClearAll] Deleted ${deletedReports} report files from GridFS`);
    } catch (err) {
      console.error('[ClearAll] Error deleting reports:', err.message);
    }

    // 3. Delete all podcast files for this bank (from GridFS getAudioBucket())
    let deletedPodcasts = 0;
    try {
      const podcastFiles = await listFilesInGridFS(getAudioBucket(), {
        filename: { $regex: `^${idrssd}_.*\\.mp3$` }
      });
      for (const file of podcastFiles) {
        await deleteFileFromGridFS(getAudioBucket(), file.filename);
        deletedPodcasts++;
      }
      console.log(`[ClearAll] Deleted ${deletedPodcasts} podcast files`);
    } catch (err) {
      console.error('[ClearAll] Error deleting podcasts:', err.message);
    }

    res.json({
      success: true,
      deletedSources: sourcesResult.deletedCount,
      deletedReports,
      deletedPodcasts,
      message: `Cleared all data: ${sourcesResult.deletedCount} sources, ${deletedReports} reports, ${deletedPodcasts} podcasts`
    });

  } catch (error) {
    console.error('[ClearAll] Error:', error);
    res.status(500).json({
      error: 'Failed to clear all data',
      details: error.message
    });
  }
});

/**
 * DELETE /api/research/:idrssd/delete-rag
 * Delete entire RAG environment for a bank (all grounding documents and chunks)
 * NOTE: This route MUST come before /:idrssd/:filename to avoid wildcard matching
 */
router.delete('/:idrssd/delete-rag', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const GroundingDocument = require('../models/GroundingDocument');
    const GroundingChunk = require('../models/GroundingChunk');
    const groundingService = require('../services/groundingService');

    console.log(`\n========== DELETE RAG REQUEST ==========`);
    console.log(`[Delete RAG] Starting deletion for bank ${idrssd}`);
    console.log(`[Delete RAG] Request received at ${new Date().toISOString()}`);

    // Find all grounding documents for this bank
    const documents = await GroundingDocument.find({ idrssd });

    console.log(`[Delete RAG] Query for documents with idrssd="${idrssd}"`);
    console.log(`[Delete RAG] Found ${documents.length} documents`);

    if (documents.length > 0) {
      console.log(`[Delete RAG] Document IDs:`, documents.map(d => d._id.toString()));
      console.log(`[Delete RAG] Document titles:`, documents.map(d => d.title));
    }

    if (documents.length === 0) {
      console.log(`[Delete RAG] No documents found - returning success`);
      return res.json({
        success: true,
        message: 'No RAG documents found for this bank',
        deletedDocuments: 0
      });
    }

    console.log(`[Delete RAG] Starting to delete ${documents.length} documents`);

    // Delete all grounding documents (this will cascade delete chunks via groundingService)
    let deletedCount = 0;
    let errorCount = 0;

    for (const doc of documents) {
      try {
        console.log(`[Delete RAG] Deleting document: ${doc.title} (ID: ${doc._id})`);
        await groundingService.deleteDocument(doc._id);
        deletedCount++;
        console.log(`[Delete RAG] ✓ Successfully deleted document ${doc.title}`);
      } catch (err) {
        console.error(`[Delete RAG] ✗ Error deleting document ${doc._id}:`, err.message);
        errorCount++;
      }
    }

    console.log(`[Delete RAG] Deletion summary: ${deletedCount} succeeded, ${errorCount} failed`);

    // Check how many chunks exist before deletion
    const chunkCount = await GroundingChunk.countDocuments({ idrssd });
    console.log(`[Delete RAG] Found ${chunkCount} chunks for this bank`);

    // Delete any orphaned chunks (safety measure)
    const chunkDeleteResult = await GroundingChunk.deleteMany({ idrssd });
    console.log(`[Delete RAG] Deleted ${chunkDeleteResult.deletedCount} chunks`);

    // Reset RAG status for all PDFs
    console.log(`[Delete RAG] Resetting PDF statuses...`);
    const pdfUpdateResult = await PDF.updateMany(
      { idrssd: idrssd },
      {
        $set: {
          ragStatus: 'not_uploaded',
          ragDocumentId: null,
          ragUploadedAt: null,
          ragError: null
        }
      }
    );

    console.log(`[Delete RAG] Reset ${pdfUpdateResult.modifiedCount} PDFs (matched ${pdfUpdateResult.matchedCount})`);

    // Reset strategic insights in metadata
    console.log(`[Delete RAG] Resetting strategic insights metadata...`);
    const BankMetadata = require('../models/BankMetadata');
    const metadata = await BankMetadata.findOne({ idrssd });
    if (metadata && metadata.strategicInsights) {
      metadata.strategicInsights = {
        priorities: [],
        focusMetrics: [],
        techPartnerships: [],
        status: 'not_extracted',
        lastExtracted: null,
        extractionError: null
      };
      await metadata.save();
      console.log(`[Delete RAG] ✓ Reset strategic insights in metadata`);
    } else {
      console.log(`[Delete RAG] No metadata found for bank ${idrssd}, skipping insights reset`);
    }

    const responseData = {
      success: true,
      message: `Successfully deleted RAG environment`,
      deletedDocuments: deletedCount,
      deletedChunks: chunkDeleteResult.deletedCount,
      resetPDFs: pdfUpdateResult.modifiedCount,
      errors: errorCount
    };

    console.log(`[Delete RAG] ✓ COMPLETE - Sending response:`, responseData);
    console.log(`========================================\n`);

    res.json(responseData);

  } catch (error) {
    console.error('[Delete RAG] ✗ FATAL ERROR:', error);
    console.error('[Delete RAG] Stack trace:', error.stack);
    console.log(`========================================\n`);
    res.status(500).json({ error: 'Failed to delete RAG environment: ' + error.message });
  }
});

/**
 * DELETE /api/research/:idrssd/sources
 * Clear all sources and RAG data for a bank (used when re-running Phase 1 with --force)
 */
router.delete('/:idrssd/sources', async (req, res) => {
  try {
    const { idrssd } = req.params;

    console.log(`[Cleanup] Starting cleanup for bank ${idrssd}...`);

    const GroundingDocument = require('../models/GroundingDocument');
    const GroundingChunk = require('../models/GroundingChunk');

    // 1. Delete Sources from MongoDB
    const sourcesDeleted = await Source.deleteMany({ idrssd });
    console.log(`[Cleanup] Deleted ${sourcesDeleted.deletedCount} sources from MongoDB`);

    // 2. Delete RAG documents and chunks
    const documentsDeleted = await GroundingDocument.deleteMany({ idrssd: idrssd });
    console.log(`[Cleanup] Deleted ${documentsDeleted.deletedCount} RAG documents from MongoDB`);

    const chunksDeleted = await GroundingChunk.deleteMany({ idrssd: idrssd });
    console.log(`[Cleanup] Deleted ${chunksDeleted.deletedCount} RAG chunks from MongoDB`);

    // 3. Delete PDF files from disk
    const pdfDir = path.join(PDFS_DIR, idrssd);
    try {
      await fs.rm(pdfDir, { recursive: true, force: true });
      console.log(`[Cleanup] Deleted PDF directory: ${pdfDir}`);
    } catch (fsError) {
      // Directory might not exist, that's okay
      console.log(`[Cleanup] PDF directory not found or already deleted: ${pdfDir}`);
    }

    console.log(`[Cleanup] ✅ Cleanup complete for bank ${idrssd}`);

    res.json({
      success: true,
      deleted: {
        sources: sourcesDeleted.deletedCount,
        documents: documentsDeleted.deletedCount,
        chunks: chunksDeleted.deletedCount,
        pdfsDir: pdfDir
      }
    });

  } catch (error) {
    console.error('[Cleanup] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
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

    // Delete from GridFS
    await deleteFileFromGridFS(getDocumentBucket(), filename);

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
  // Ensure statements are sorted by date (oldest first) for proper chart ordering
  const sortedStatements = [...financialStatements].sort((a, b) => 
    new Date(a.reportingPeriod) - new Date(b.reportingPeriod)
  );
  
  const periods = sortedStatements.map(stmt => {
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
        // Granular loan breakdown for chart
        residentialMortgages: (portfolio.realEstate.securedBy1To4Family.revolvingOpenEnd || 0) +
          (portfolio.realEstate.securedBy1To4Family.closedEndFirstLiens || 0) +
          (portfolio.realEstate.securedBy1To4Family.closedEndJuniorLiens || 0),
        creditCards: portfolio.consumer.creditCards || 0,
        autoLoans: portfolio.consumer.automobileLoans || 0,
        otherConsumer: (portfolio.consumer.otherRevolvingCredit || 0) +
          (portfolio.consumer.otherConsumerLoans || 0) +
          (portfolio.leaseFinancingReceivables.consumerLeases || 0),
        commercialRealEstate: (portfolio.realEstate.constructionAndLandDevelopment.total || 0) +
          (portfolio.realEstate.multifamily || 0) +
          (portfolio.realEstate.nonfarmNonresidential.ownerOccupied || 0) +
          (portfolio.realEstate.nonfarmNonresidential.otherNonfarmNonresidential || 0) +
          (portfolio.realEstate.farmland || 0),
        cAndI: (portfolio.commercialAndIndustrial.usAddressees || 0) +
          (portfolio.commercialAndIndustrial.nonUsAddressees || 0),
        otherBusiness: (portfolio.other.agriculturalProduction || 0) +
          (portfolio.other.toDepositoryInstitutions || 0) +
          (portfolio.leaseFinancingReceivables.allOtherLeases || 0) +
          (portfolio.other.allOtherLoans || 0),
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
        interestIncome: stmt.incomeStatement.interestIncome.total,
        noninterestIncome: stmt.incomeStatement.noninterestIncome.total,
        noninterestExpense: stmt.incomeStatement.noninterestExpense.total
      },
      expenses: {
        salariesAndBenefits: stmt.incomeStatement.noninterestExpense.salariesAndBenefits,
        occupancy: stmt.incomeStatement.noninterestExpense.premisesExpense,
        other: stmt.incomeStatement.noninterestExpense.other
      },
      fte: stmt.incomeStatement.fullTimeEquivalentEmployees,
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
  const latestStmt = sortedStatements[sortedStatements.length - 1];
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

    // Find all podcasts for this bank (from GridFS getAudioBucket())
    // Match both old format (idrssd_timestamp.mp3) and new format (podcast_idrssd_timestamp.mp3)
    const files = await listFilesInGridFS(getAudioBucket(), {
      filename: { $regex: `^(podcast_)?${idrssd}_.*\\.mp3$` }
    });

    if (files.length === 0) {
      return res.status(404).json({
        error: 'No podcasts found',
        podcast: null
      });
    }

    // Sort by timestamp (filename format: idrssd_timestamp.mp3 or podcast_idrssd_timestamp.mp3)
    const bankPodcasts = files.map(f => f.filename).sort((a, b) => {
      // Extract timestamp - it's always the last segment before .mp3
      const partsA = a.replace('.mp3', '').split('_');
      const partsB = b.replace('.mp3', '').split('_');
      const timeA = parseInt(partsA[partsA.length - 1]);
      const timeB = parseInt(partsB[partsB.length - 1]);
      return timeB - timeA; // Most recent first
    });

    const latestPodcast = bankPodcasts[0];
    const latestPodcastFile = files.find(f => f.filename === latestPodcast);
    // Extract timestamp - it's always the last segment before .mp3
    const parts = latestPodcast.replace('.mp3', '').split('_');
    const timestamp = parseInt(parts[parts.length - 1]);

    // Get file size to estimate duration (rough estimate: 1MB ≈ 1 minute)
    const estimatedDuration = Math.round(latestPodcastFile.length / 1024 / 1024); // MB as rough minutes

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
 * GET /api/research/:idrssd/podcast/script/latest
 * Get the most recent podcast script for a bank (without audio)
 */
router.get('/:idrssd/podcast/script/latest', async (req, res) => {
  try {
    const { idrssd } = req.params;

    // Find all scripts for this bank (from GridFS getDocumentBucket())
    const files = await listFilesInGridFS(getDocumentBucket(), {
      filename: { $regex: `^${idrssd}_.*\\.json$` },
      'metadata.type': 'podcast-script'
    });

    if (files.length === 0) {
      return res.status(404).json({
        error: 'No podcast scripts found',
        script: null
      });
    }

    // Sort by timestamp (filename format: idrssd_timestamp.json)
    const bankScripts = files.map(f => f.filename).sort((a, b) => {
      const timeA = parseInt(a.split('_')[1].split('.')[0]);
      const timeB = parseInt(b.split('_')[1].split('.')[0]);
      return timeB - timeA; // Most recent first
    });

    const latestScript = bankScripts[0];
    const scriptData = await loadJsonFromGridFS(getDocumentBucket(), latestScript);

    res.json({
      script: scriptData,
      filename: latestScript
    });
  } catch (error) {
    console.error('Error fetching latest podcast script:', error);
    res.status(500).json({ error: 'Failed to fetch podcast script' });
  }
});

/**
 * GET /api/research/:idrssd/podcast/download/:filename
 * Download a specific podcast file (from GridFS getAudioBucket())
 */
router.get('/:idrssd/podcast/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    // Get file metadata to check if it exists and get size
    const files = await listFilesInGridFS(getAudioBucket(), { filename });
    if (files.length === 0) {
      return res.status(404).json({ error: 'Podcast not found' });
    }

    const fileInfo = files[0];

    // Set proper headers for audio streaming with duration support
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', fileInfo.length);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    // Stream the file from GridFS
    const downloadStream = getAudioBucket().openDownloadStreamByName(filename);
    downloadStream.on('error', (error) => {
      console.error('Error streaming podcast:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream podcast' });
      }
    });
    downloadStream.pipe(res);
  } catch (error) {
    console.error('Error downloading podcast:', error);
    res.status(404).json({ error: 'Podcast not found' });
  }
});

/**
 * DELETE /api/research/:idrssd/podcast/:filename
 * Delete a specific podcast file (from GridFS getAudioBucket())
 */
router.delete('/:idrssd/podcast/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    // Check if file exists in GridFS
    const exists = await fileExistsInGridFS(getAudioBucket(), filename);
    if (!exists) {
      return res.status(404).json({ error: 'Podcast not found' });
    }

    // Delete the file from GridFS
    await deleteFileFromGridFS(getAudioBucket(), filename);
    console.log(`[Podcast Delete] Deleted podcast file: ${filename}`);

    // Also update the report JSON if it has podcast metadata
    try {
      const files = await listFilesInGridFS(getDocumentBucket(), {
        filename: { $regex: `^${req.params.idrssd}_.*\\.json$` }
      });
      const reportFiles = files.map(f => f.filename);

      if (reportFiles.length > 0) {
        // Sort by timestamp (most recent first)
        reportFiles.sort((a, b) => {
          const partsA = a.replace('.json', '').split('_');
          const partsB = b.replace('.json', '').split('_');
          const timeA = parseInt(partsA[partsA.length - 1]);
          const timeB = parseInt(partsB[partsB.length - 1]);
          return timeB - timeA;
        });

        // Check the most recent report
        const reportData = await loadJsonFromGridFS(getDocumentBucket(), reportFiles[0]);

        if (reportData.podcast && reportData.podcast.filename === filename) {
          delete reportData.podcast;
          await saveJsonToGridFS(getDocumentBucket(), reportFiles[0], reportData, { idrssd: req.params.idrssd, type: 'research', updated: true });
          console.log(`[Podcast Delete] Removed podcast metadata from report`);
        }
      }
    } catch (err) {
      console.warn('[Podcast Delete] Could not update report metadata:', err.message);
      // Not a fatal error - continue
    }

    res.json({
      success: true,
      message: 'Podcast deleted successfully'
    });

  } catch (error) {
    console.error('[Podcast Delete] Error:', error);
    res.status(500).json({ error: 'Failed to delete podcast' });
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
    const { experts, useExistingScript, scriptOnly } = req.body;

    // Parse expert IDs
    const selectedExperts = experts || [];

    // Build options object
    const options = {
      useExistingScript: useExistingScript === true,
      scriptOnly: scriptOnly === true
    };

    console.log(`Starting background podcast generation for ${idrssd} with experts:`, selectedExperts, 'options:', options);

    // Create a background job
    const jobId = jobTracker.createJob(idrssd, 'podcast');

    // Return immediately with job ID
    res.json({
      success: true,
      jobId,
      message: options.scriptOnly
        ? 'Podcast script generation started in background'
        : options.useExistingScript
        ? 'Audio generation from existing script started in background'
        : 'Podcast generation started in background'
    });

    // Start generation in background (don't await)
    generatePodcastInBackground(idrssd, jobId, selectedExperts, options).catch(error => {
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

    // Step 1: Load existing research report from MongoDB
    sendStatus('loading', 'Loading research report...');

    const ResearchReport = require('../models/ResearchReport');
    const latestReport = await ResearchReport.findOne({ idrssd })
      .sort({ createdAt: -1 })
      .lean();

    if (!latestReport) {
      sendStatus('error', 'No research report found. Please generate a report first.');
      res.end();
      return;
    }

    const reportData = latestReport.reportData;

    // Validate that agent insights exist (podcast requires AI-generated report with insights)
    const hasAgentInsights = reportData.agentInsights && reportData.agentInsights.length > 0;
    if (!hasAgentInsights) {
      sendStatus('error', 'Podcast generation requires an AI report with insights. Please generate an AI report first (not just a basic report).');
      res.end();
      return;
    }

    console.log(`[Podcast] Validated report has ${reportData.agentInsights.length} agent insights`);

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
      },
      reportData.agentInsights || null,  // Pass agent insights if available
      reportData.agentStats || null       // Pass agent stats if available
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

    // Step 4: Save script to MongoDB
    const PodcastScript = require('../models/PodcastScript');
    const podcastScript = await PodcastScript.create({
      idrssd,
      reportingPeriod: new Date(reportData.trendsData?.statements?.[0]?.reportingPeriod || Date.now()),
      scriptData: {
        segments: script.segments,
        metadata: script.metadata,
        fullText: script.fullText,
        experts: selectedExperts
      },
      duration
    });

    console.log(`Podcast script saved to MongoDB: ${podcastScript._id}`);

    // Step 5: Save audio file to GridFS
    sendStatus('saving', 'Saving podcast audio to GridFS...');

    const audioId = await elevenLabsService.saveAudioFile(audioBuffer, idrssd, podcastScript._id);

    // Step 6: Update script with audio reference
    podcastScript.audioFileId = audioId;
    await podcastScript.save();

    console.log(`Podcast audio saved to GridFS: ${audioId}`);

    // Send completion
    sendStatus('complete', 'Podcast generated successfully!', {
      podcast: {
        audioId,
        url: `/api/research/${idrssd}/podcast/${audioId}`,
        duration,
        experts: selectedExperts.map(id => elevenLabsService.getCharacterName(id))
      }
    });

    res.end();

  } catch (error) {
    console.error('Error generating podcast:', error);

    // Check if this is an ElevenLabs quota/credit error
    const errorMessage = error.message || '';
    let userFriendlyMessage = `Error: ${errorMessage}`;

    // Try to parse ElevenLabs error body for quota information
    let quotaDetails = null;
    try {
      // Check if error message contains JSON body
      const bodyMatch = errorMessage.match(/Body:\s*({[\s\S]*})/);
      if (bodyMatch) {
        const body = JSON.parse(bodyMatch[1]);
        if (body.detail?.status === 'quota_exceeded' && body.detail?.message) {
          quotaDetails = body.detail.message;
        }
      }
    } catch (parseError) {
      // Failed to parse error body, continue with basic error handling
    }

    // Check for quota/credit errors
    if (quotaDetails ||
        errorMessage.includes('quota') || errorMessage.includes('credit') ||
        errorMessage.includes('exceeded') || errorMessage.includes('insufficient') ||
        error.response?.status === 401 || error.response?.status === 402) {

      if (quotaDetails) {
        // Extract credits remaining and required from the quota message
        const remainingMatch = quotaDetails.match(/You have (\d+) credits remaining/);
        const requiredMatch = quotaDetails.match(/(\d+) credits are required/);

        const remaining = remainingMatch ? remainingMatch[1] : 'unknown';
        const required = requiredMatch ? requiredMatch[1] : 'unknown';

        userFriendlyMessage = `ElevenLabs quota exceeded: You have ${remaining} credits remaining, but ${required} credits are required for this podcast. Please add credits to your ElevenLabs account to continue.`;
      } else {
        userFriendlyMessage = 'ElevenLabs API quota exceeded or insufficient credits. Please check your ElevenLabs account and add credits to continue generating podcasts.';
      }
    }

    res.write(`data: ${JSON.stringify({
      stage: 'error',
      message: userFriendlyMessage
    })}\n\n`);
    res.end();
  }
});

/**
 * GET /api/research/:idrssd/podcast/:filename
 * Download podcast audio file
 */
router.get('/:idrssd/podcast/:audioId', async (req, res) => {
  try {
    const { audioId } = req.params;
    const PodcastAudio = require('../models/PodcastAudio');

    // Find audio by ID
    const audio = await PodcastAudio.findById(audioId);

    if (!audio) {
      return res.status(404).json({ error: 'Podcast audio not found' });
    }

    // Stream audio from GridFS
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${audio.filename}"`);

    const readStream = audio.getReadStream();
    readStream.pipe(res);

    readStream.on('error', (error) => {
      console.error('Error streaming podcast audio:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming audio' });
      }
    });

  } catch (error) {
    console.error('Error serving podcast file:', error);
    res.status(404).json({ error: 'Podcast file not found' });
  }
});

/**
 * Generate podcast in background (async function)
 * For multi-user support: each bank has its own job
 * @param {string} idrssd - Bank ID
 * @param {string} jobId - Job tracking ID
 * @param {string[]} selectedExperts - Expert IDs
 * @param {Object} options - Optional settings
 * @param {boolean} options.useExistingScript - If true, use existing script instead of generating new one
 * @param {boolean} options.scriptOnly - If true, only generate script (no audio)
 */
async function generatePodcastInBackground(idrssd, jobId, selectedExperts, options = {}) {
  const { useExistingScript = false, scriptOnly = false } = options;

  try {
    console.log(`[Job ${jobId}] Starting podcast generation for ${idrssd} (useExistingScript=${useExistingScript}, scriptOnly=${scriptOnly})`);

    // Step 1: Load research report
    jobTracker.updateJob(jobId, {
      status: 'running',
      progress: 10,
      message: 'Loading research report...'
    });

    const files = await listFilesInGridFS(getDocumentBucket(), {
      filename: { $regex: `^${idrssd}_.*\\.json$` }
    });
    const bankReports = files.map(f => f.filename);

    if (bankReports.length === 0) {
      throw new Error('No research report found. Please generate a report first.');
    }

    // Get most recent report
    bankReports.sort((a, b) => {
      const timeA = parseInt(a.split('_')[1].split('.')[0]);
      const timeB = parseInt(b.split('_')[1].split('.')[0]);
      return timeB - timeA;
    });

    const reportData = await loadJsonFromGridFS(getDocumentBucket(), bankReports[0]);

    // Validate that agent insights exist (podcast requires AI-generated report with insights)
    const hasAgentInsights = reportData.agentInsights && reportData.agentInsights.length > 0;
    if (!hasAgentInsights) {
      throw new Error('Podcast generation requires an AI report with insights. Please generate an AI report first (not just a basic report).');
    }

    console.log(`[Job ${jobId}] Validated report has ${reportData.agentInsights.length} agent insights`);

    let script, duration, stats, scriptFilename;
    const podcastScriptService = new PodcastScriptService();

    // Step 2: Get script (either from existing file or generate new)
    if (useExistingScript) {
      // Try to load existing script from GridFS
      jobTracker.updateJob(jobId, {
        progress: 30,
        message: 'Loading existing podcast script...'
      });

      const scriptFiles = await listFilesInGridFS(getDocumentBucket(), {
        filename: { $regex: `^${idrssd}_.*\\.json$` },
        'metadata.type': 'podcast-script'
      });

      if (scriptFiles.length === 0) {
        throw new Error('No existing script found. Generate a script first or set useExistingScript=false.');
      }

      // Get most recent script
      const bankScripts = scriptFiles.map(f => f.filename).sort((a, b) => {
        const timeA = parseInt(a.split('_')[1].split('.')[0]);
        const timeB = parseInt(b.split('_')[1].split('.')[0]);
        return timeB - timeA;
      });

      scriptFilename = bankScripts[0];
      const scriptData = await loadJsonFromGridFS(getDocumentBucket(), scriptFilename);

      script = scriptData.script;
      duration = scriptData.duration;
      stats = scriptData.stats;

      console.log(`[Job ${jobId}] Loaded existing script: ${scriptFilename}`);
    } else {
      // Generate new script
      jobTracker.updateJob(jobId, {
        progress: 30,
        message: 'Generating podcast script...'
      });

      const scriptResult = await podcastScriptService.generateScript(
        reportData.bankName,
        reportData.analysis,
        selectedExperts,
        reportData.trendsData,
        (event) => {
          jobTracker.updateJob(jobId, { message: event.message });
        },
        reportData.agentInsights || null,
        reportData.agentStats || null
      );

      script = scriptResult.script;
      duration = podcastScriptService.estimateDuration(script.fullText);
      stats = podcastScriptService.getScriptStats(script.segments);

      // Save script to GridFS (before audio generation)
      const scriptTimestamp = Date.now();
      scriptFilename = `${idrssd}_${scriptTimestamp}.json`;

      const scriptData = {
        idrssd,
        bankName: reportData.bankName,
        generatedAt: new Date().toISOString(),
        experts: selectedExperts,
        duration,
        stats,
        script: {
          fullText: script.fullText,
          segments: script.segments,
          metadata: script.metadata
        }
      };

      await saveJsonToGridFS(getDocumentBucket(), scriptFilename, scriptData, { idrssd, type: 'podcast-script' });
      console.log(`[Job ${jobId}] Script saved to ${scriptFilename}`);
    }

    // If scriptOnly, complete now without generating audio
    if (scriptOnly) {
      jobTracker.completeJob(jobId, {
        scriptOnly: true,
        scriptFilename,
        duration,
        experts: selectedExperts,
        message: 'Script generated successfully. Audio generation skipped.'
      });
      console.log(`[Job ${jobId}] Script-only generation completed`);
      return;
    }

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

    // Step 4: Save audio file to GridFS
    jobTracker.updateJob(jobId, {
      progress: 95,
      message: 'Saving podcast file...'
    });

    const timestamp = Date.now();
    const filename = `${idrssd}_${timestamp}.mp3`;

    // Save audio to GridFS getAudioBucket()
    const { Readable } = require('stream');
    const uploadStream = getAudioBucket().openUploadStream(filename, {
      contentType: 'audio/mpeg',
      metadata: { idrssd, type: 'podcast', uploadedAt: new Date() }
    });
    const readableStream = Readable.from(audioBuffer);
    await new Promise((resolve, reject) => {
      uploadStream.on('error', reject);
      uploadStream.on('finish', resolve);
      readableStream.pipe(uploadStream);
    });

    // Step 5: Update report with podcast metadata
    reportData.podcast = {
      filename,
      generatedAt: new Date().toISOString(),
      experts: selectedExperts,
      duration,
      stats,
      scriptMetadata: script.metadata
    };

    // Save updated report back to GridFS
    await saveJsonToGridFS(getDocumentBucket(), bankReports[0], reportData, { idrssd, type: 'research', updated: true });

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

    // Check if this is an ElevenLabs quota/credit error
    const errorMessage = error.message || '';
    let userFriendlyMessage = errorMessage;

    if (errorMessage.includes('quota') || errorMessage.includes('credit') ||
        errorMessage.includes('exceeded') || errorMessage.includes('insufficient') ||
        error.response?.status === 401 || error.response?.status === 402) {
      userFriendlyMessage = 'ElevenLabs API quota exceeded or insufficient credits. Please check your ElevenLabs account and add credits to continue generating podcasts.';
    }

    // Create error with user-friendly message
    const friendlyError = new Error(userFriendlyMessage);
    friendlyError.originalError = error;

    jobTracker.failJob(jobId, friendlyError);
    throw friendlyError;
  }
}

/**
 * ============================================================================
 * NEW ENDPOINTS: Two-Stage AI Research Workflow
 * ============================================================================
 */

/**
 * GET /api/research/:idrssd/gather-sources
 * Stage 1: Gather data sources with SSE streaming
 * Searches for sources and streams them as they're found
 */
router.get('/:idrssd/gather-sources', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { sessionId, config } = req.query;

    const userConfig = config ? JSON.parse(decodeURIComponent(config)) : {};

    // Get bank info
    const bank = await Institution.findOne({ idrssd });
    if (!bank) {
      return res.status(404).json({ error: 'Bank not found' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent('progress', { progress: 0, message: 'Starting source gathering...' });

    // Always search all 4 streamlined categories (focused on high-quality, recent sources)
    const categoriesToSearch = [
      'investorPresentation',
      'earningsTranscript',
      'strategyAnalysis',
      'analystReports'
    ];

    // PHASE 1: Collect sources from all categories (don't save yet)
    const totalCategories = categoriesToSearch.length;
    let completedCategories = 0;
    const sourcesByCategory = {};

    sendEvent('progress', { progress: 0, message: 'Searching for sources across all categories...' });

    for (const category of categoriesToSearch) {
      try {
        sendEvent('progress', {
          progress: Math.round((completedCategories / totalCategories) * 50),
          message: `Searching ${category}...`
        });

        // Use Claude to search for sources in this category
        const sources = await searchSourcesForCategory(bank, category);
        sourcesByCategory[category] = sources || [];

        completedCategories++;
        sendEvent('category-complete', { category, foundCount: sources.length });

      } catch (error) {
        console.error(`Error searching for ${category}:`, error);
        sourcesByCategory[category] = [];
        sendEvent('category-complete', { category, foundCount: 0, error: error.message });
        completedCategories++;
      }
    }

    // PHASE 2: Rank globally and select top 5
    sendEvent('progress', { progress: 50, message: 'Ranking sources globally...' });

    const rankedByCategory = rankAndRecommendSources(sourcesByCategory, null, {
      global: true,
      topN: 5,
      minScore: 60
    });

    // PHASE 3: Save all sources and auto-download only the top 5 recommended ones
    sendEvent('progress', { progress: 60, message: 'Saving sources to database...' });

    let totalSaved = 0;
    let totalRecommended = 0;
    const recommendedSources = [];

    for (const [category, rankedSources] of Object.entries(rankedByCategory)) {
      for (const sourceData of rankedSources) {
        const source = new Source({
          sourceId: `src_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          idrssd,
          sessionId,
          category,
          ...sourceData,
          status: 'pending',
          fetchStatus: 'not_fetched'
        });

        await source.save();
        totalSaved++;

        // Stream the source to frontend
        sendEvent('source-found', {
          category,
          source: {
            id: source.sourceId,
            url: source.url,
            title: source.title,
            preview: source.preview,
            date: source.date,
            status: source.status,
            confidence: source.confidence,
            recommended: source.recommended,
            score: source.score,
            fetchStatus: 'not_fetched'
          }
        });

        if (source.recommended) {
          totalRecommended++;
          recommendedSources.push(source);
        }
      }
    }

    // PHASE 4: Auto-download the top 5 recommended sources
    sendEvent('progress', {
      progress: 70,
      message: `Auto-downloading top ${totalRecommended} sources to RAG...`
    });

    let autoDownloadedCount = 0;
    for (const source of recommendedSources) {
      sendEvent('auto-download-start', {
        sourceId: source.sourceId,
        title: source.title,
        current: autoDownloadedCount + 1,
        total: totalRecommended
      });

      const downloadResult = await downloadAndUploadToRAG(source, idrssd);

      if (downloadResult.success) {
        autoDownloadedCount++;
        sendEvent('auto-download-complete', {
          sourceId: source.sourceId,
          success: true,
          chunkCount: downloadResult.chunkCount,
          contentType: downloadResult.contentType
        });
      } else {
        sendEvent('auto-download-complete', {
          sourceId: source.sourceId,
          success: false,
          skipped: downloadResult.skipped || false,
          reason: downloadResult.reason || downloadResult.error
        });
      }
    }

    // PHASE 5: Fetch logo if not already present
    sendEvent('progress', {
      progress: 95,
      message: 'Checking for bank logo...'
    });

    try {
      const { findLogoForBank } = require('../scripts/cli/findLogos');
      const logoResult = await findLogoForBank({
        idrssd: bank.idrssd,
        name: bank.name,
        city: bank.city,
        state: bank.state,
        totalAssets: 0
      });

      if (logoResult && logoResult.success && !logoResult.existing) {
        sendEvent('logo-fetched', { success: true, existing: false });
      } else if (logoResult && logoResult.existing) {
        sendEvent('logo-fetched', { success: true, existing: true });
      } else {
        sendEvent('logo-fetched', { success: false });
      }
    } catch (logoError) {
      console.error('Error fetching logo:', logoError);
      sendEvent('logo-fetched', { success: false, error: logoError.message });
    }

    sendEvent('progress', {
      progress: 100,
      message: `Complete! Selected top ${totalRecommended} sources out of ${totalSaved} found.`
    });

    sendEvent('complete', { message: 'Source gathering complete' });
    res.end();

  } catch (error) {
    console.error('Error in gather-sources:', error);
    res.status(500).json({ error: 'Failed to gather sources' });
  }
});

/**
 * POST /api/research/:idrssd/gather-sources-batch
 * SSE streaming version of gather-sources for CLI tools and scripting
 * Sends progress updates to prevent Heroku H12/H15 timeouts
 */
router.post('/:idrssd/gather-sources-batch', async (req, res) => {
  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendStatus = (stage, message, data = {}) => {
    res.write(`data: ${JSON.stringify({ stage, message, ...data })}\n\n`);
  };

  // Heartbeat to prevent H15 idle connection timeout (55 seconds)
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
      if (res.socket && res.socket.writable) {
        res.socket.uncork();
      }
    } catch (err) {
      console.error('[Batch Source Gathering Heartbeat] Error:', err.message);
      clearInterval(heartbeatInterval);
    }
  }, 30000); // 30 seconds
  try {
    const { idrssd } = req.params;
    const { sessionId, config } = req.body;

    const userConfig = config || {};

    sendStatus('init', 'Initializing source gathering...');

    // Get bank info
    const bank = await Institution.findOne({ idrssd });
    if (!bank) {
      clearInterval(heartbeatInterval);
      sendStatus('error', 'Bank not found');
      return res.end();
    }

    console.log(`[Batch] Starting source gathering for ${bank.name} (${idrssd})`);
    sendStatus('starting', `Starting source gathering for ${bank.name}`);

    // Generate session ID if not provided
    const sid = sessionId || `batch-${Date.now()}`;

    // Categories to search
    const categoriesToSearch = [
      'investorPresentation',
      'earningsTranscript',
      'strategyAnalysis',
      'analystReports'
    ];

    // PHASE 1: Collect sources from all categories (don't save yet)
    const sourcesByCategory = {};
    console.log(`[Batch] Phase 1: Collecting sources from all categories...`);
    sendStatus('phase1', 'Searching for sources across all categories...');

    for (const category of categoriesToSearch) {
      try {
        console.log(`[Batch] Searching ${category} for ${bank.name}...`);
        sendStatus('searching', `Searching ${category}...`, { category });
        const sources = await searchSourcesForCategory(bank, category);
        sourcesByCategory[category] = sources || [];
        console.log(`[Batch] ${category}: Found ${sources.length} sources`);
        sendStatus('found', `Found ${sources.length} sources in ${category}`, { category, count: sources.length });
      } catch (error) {
        console.error(`[Batch] Error searching for ${category}:`, error);
        sourcesByCategory[category] = [];
        sendStatus('error_category', `Error searching ${category}: ${error.message}`, { category });
      }
    }

    // PHASE 2: Rank globally and select top 5
    console.log(`[Batch] Phase 2: Ranking sources globally and selecting top 5...`);
    sendStatus('phase2', 'Ranking sources and selecting top 5...');
    const rankedByCategory = rankAndRecommendSources(sourcesByCategory, null, {
      global: true,
      topN: 5,
      minScore: 60
    });

    // PHASE 3: Save all sources and collect recommended ones
    console.log(`[Batch] Phase 3: Saving sources to database...`);
    sendStatus('phase3', 'Saving sources to database...');
    let totalSources = 0;
    const recommendedSources = [];
    const sourceCounts = {};

    for (const [category, rankedSources] of Object.entries(rankedByCategory)) {
      sourceCounts[category] = rankedSources.length;

      for (const sourceData of rankedSources) {
        const source = new Source({
          sourceId: `src_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          idrssd,
          sessionId: sid,
          category,
          ...sourceData,
          status: 'pending',
          fetchStatus: 'not_fetched'
        });

        await source.save();
        totalSources++;

        if (source.recommended) {
          recommendedSources.push(source);
        }
      }
    }

    console.log(`[Batch] Saved ${totalSources} sources (${recommendedSources.length} recommended for auto-download)`);
    sendStatus('saved', `Saved ${totalSources} sources (${recommendedSources.length} recommended)`, { totalSources, recommendedCount: recommendedSources.length });

    // PHASE 4: Auto-download only the top 5 recommended sources
    console.log(`[Batch] Phase 4: Auto-downloading top ${recommendedSources.length} sources to RAG...`);
    sendStatus('phase4', `Auto-downloading top ${recommendedSources.length} sources...`);
    const downloadResults = {
      attempted: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0
    };

    for (const source of recommendedSources) {
      downloadResults.attempted++;
      console.log(`[Batch] Auto-downloading: ${source.title}`);
      sendStatus('downloading', `Downloading: ${source.title}`, { current: downloadResults.attempted, total: recommendedSources.length });

      const downloadResult = await downloadAndUploadToRAG(source, idrssd);

      if (downloadResult.success) {
        downloadResults.succeeded++;
        console.log(`[Batch] ✓ Auto-download succeeded: ${downloadResult.chunkCount} chunks`);
        sendStatus('downloaded', `Downloaded: ${source.title} (${downloadResult.chunkCount} chunks)`, { succeeded: downloadResults.succeeded });
      } else if (downloadResult.skipped) {
        downloadResults.skipped++;
        console.log(`[Batch] ⏭ Auto-download skipped: ${downloadResult.reason}`);
        sendStatus('skipped', `Skipped: ${source.title}`, { reason: downloadResult.reason });
      } else {
        downloadResults.failed++;
        console.log(`[Batch] ✗ Auto-download failed: ${downloadResult.error}`);
        sendStatus('download_failed', `Failed: ${source.title}`, { error: downloadResult.error });
      }
    }

    console.log(`[Batch] Completed: ${totalSources} sources saved, top ${recommendedSources.length} downloaded (${downloadResults.succeeded} succeeded)`);
    sendStatus('downloads_complete', `Downloads complete: ${downloadResults.succeeded}/${recommendedSources.length} succeeded`);

    // Gather metadata (logo, ticker, org chart)
    console.log(`[Batch] Starting metadata gathering (logo, ticker, org chart)...`);
    sendStatus('metadata', 'Gathering metadata (logo, ticker, org chart)...');

    const metadata = await BankMetadata.getOrCreate(idrssd, bank.name);
    const metadataResults = {
      logo: false,
      ticker: false,
      orgChart: false
    };

    // 1. Gather Logo
    try {
      console.log(`[Batch] Gathering logo...`);
      sendStatus('logo', 'Searching for bank logo...');
      const { findLogoForBank } = require('../scripts/cli/findLogos');
      const logoResult = await findLogoForBank({
        idrssd: bank.idrssd,
        name: bank.name,
        city: bank.city,
        state: bank.state,
        totalAssets: 0
      });

      if (logoResult && logoResult.success && !logoResult.existing) {
        metadataResults.logo = true;
        console.log(`[Batch] ✓ Logo found and saved`);
        sendStatus('logo_found', 'Logo found and saved');
      } else if (logoResult && logoResult.existing) {
        metadataResults.logo = true;
        console.log(`[Batch] ✓ Logo already exists`);
        sendStatus('logo_exists', 'Logo already exists');
      } else {
        console.log(`[Batch] ⚠ Logo not found`);
        sendStatus('logo_not_found', 'Logo not found');
      }
    } catch (logoError) {
      console.error(`[Batch] Error gathering logo:`, logoError.message);
      sendStatus('logo_error', `Error gathering logo: ${logoError.message}`);
    }

    // 2. Gather Ticker Symbol
    try {
      console.log(`[Batch] Gathering ticker symbol...`);
      sendStatus('ticker', 'Searching for ticker symbol...');

      // For JP Morgan Chase Bank NA, search for parent company ticker
      let searchName = bank.name;
      if (bank.name.includes('JPMORGAN') || bank.name.includes('CHASE')) {
        searchName = 'JPMorgan Chase & Co';
      } else if (bank.name.includes('BANK OF AMERICA')) {
        searchName = 'Bank of America Corporation';
      } else if (bank.name.includes('WELLS FARGO')) {
        searchName = 'Wells Fargo & Company';
      } else if (bank.name.includes('CITIBANK')) {
        searchName = 'Citigroup Inc';
      }

      const tickerPrompt = `Search the web and find the stock ticker symbol for the publicly traded bank holding company "${searchName}".

IMPORTANT: Return your response as ONLY a JSON object with NO additional text before or after. The JSON must be valid and parseable.

{
  "symbol": "TICKER_SYMBOL_HERE",
  "exchange": "NYSE",
  "found": true
}

If not publicly traded, return: {"found": false}`;

      const tickerResponse = await claudeService.sendMessage([{
        role: 'user',
        content: tickerPrompt
      }], {
        temperature: 0.1,
        model: 'claude-sonnet-4-5-20250929',
        tools: [{ type: 'web_search_20250305', name: 'web_search' }]
      });

      const tickerText = tickerResponse.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
      console.log(`[Batch] Ticker response:`, tickerText.substring(0, 500));

      // More robust JSON extraction
      const jsonMatch = tickerText.match(/\{[\s\S]*?"found"[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          const tickerData = JSON.parse(jsonMatch[0]);
          if (tickerData.found && tickerData.symbol) {
            await metadata.updateTicker({
              symbol: tickerData.symbol,
              exchange: tickerData.exchange || 'NYSE',
              isPubliclyTraded: true,
              source: 'Claude web search'
            });
            metadataResults.ticker = true;
            console.log(`[Batch] ✓ Ticker found: ${tickerData.symbol} (${tickerData.exchange})`);
            sendStatus('ticker_found', `Ticker found: ${tickerData.symbol}`, { symbol: tickerData.symbol, exchange: tickerData.exchange });
          } else {
            console.log(`[Batch] ⚠ Ticker not found or not publicly traded`);
            sendStatus('ticker_not_found', 'Ticker not found or not publicly traded');
          }
        } catch (parseError) {
          console.error(`[Batch] Error parsing ticker JSON:`, parseError.message);
          console.error(`[Batch] JSON string was:`, jsonMatch[0]);
          sendStatus('ticker_parse_error', 'Error parsing ticker response');
        }
      } else {
        console.log(`[Batch] ⚠ No JSON found in ticker response`);
        sendStatus('ticker_no_json', 'No valid ticker data found');
      }
    } catch (tickerError) {
      console.error(`[Batch] Error gathering ticker:`, tickerError);
      sendStatus('ticker_error', `Error gathering ticker: ${tickerError.message}`);
    }

    // 3. Gather Org Chart
    try {
      console.log(`[Batch] Gathering organizational chart...`);
      sendStatus('orgchart', 'Searching for organizational chart...');

      // For JP Morgan Chase Bank NA, search for parent company executives
      let searchName = bank.name;
      if (bank.name.includes('JPMORGAN') || bank.name.includes('CHASE')) {
        searchName = 'JPMorgan Chase & Co';
      } else if (bank.name.includes('BANK OF AMERICA')) {
        searchName = 'Bank of America Corporation';
      } else if (bank.name.includes('WELLS FARGO')) {
        searchName = 'Wells Fargo & Company';
      } else if (bank.name.includes('CITIBANK')) {
        searchName = 'Citigroup Inc';
      }

      const orgChartPrompt = `Search the web and find the current executive leadership team AND board of directors for "${searchName}".

Find:
1. C-suite executives (CEO, CFO, COO, CTO, CRO, etc.)
2. Board of Directors members

IMPORTANT: Return your response as ONLY a JSON object with NO additional text before or after. The JSON must be valid and parseable.

{
  "executives": [
    {
      "name": "Jamie Dimon",
      "title": "Chairman & CEO"
    },
    {
      "name": "Jeremy Barnum",
      "title": "CFO"
    }
  ],
  "boardMembers": [
    {
      "name": "Stephen Burke",
      "title": "Lead Independent Director"
    },
    {
      "name": "Linda Bammann",
      "title": "Director"
    }
  ],
  "found": true
}

If you cannot find executives, return: {"found": false, "executives": [], "boardMembers": []}`;

      const orgChartResponse = await claudeService.sendMessage([{
        role: 'user',
        content: orgChartPrompt
      }], {
        temperature: 0.1,
        model: 'claude-sonnet-4-5-20250929',
        tools: [{ type: 'web_search_20250305', name: 'web_search' }]
      });

      const orgChartText = orgChartResponse.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
      console.log(`[Batch] Org chart response:`, orgChartText.substring(0, 500));

      // More robust JSON extraction - look for the found field
      const jsonMatch = orgChartText.match(/\{[\s\S]*?"found"[\s\S]*?\}(?:\s*\})?/);
      if (jsonMatch) {
        try {
          // Clean up the matched JSON - sometimes there's an extra closing brace
          let jsonStr = jsonMatch[0];
          // Try to parse, and if it fails, try removing last character
          let orgChartData;
          try {
            orgChartData = JSON.parse(jsonStr);
          } catch (e) {
            // Try removing trailing characters
            jsonStr = jsonStr.replace(/\}+\s*$/, '}');
            orgChartData = JSON.parse(jsonStr);
          }

          if (orgChartData.found && orgChartData.executives?.length > 0) {
            await metadata.updateOrgChart({
              executives: orgChartData.executives || [],
              boardMembers: orgChartData.boardMembers || [],
              source: 'Claude web search',
              lastUpdated: new Date()
            });
            metadataResults.orgChart = true;
            console.log(`[Batch] ✓ Org chart found: ${orgChartData.executives?.length || 0} executives, ${orgChartData.boardMembers?.length || 0} board members`);
            sendStatus('orgchart_found', `Org chart found: ${orgChartData.executives?.length || 0} executives`, { executiveCount: orgChartData.executives?.length, boardCount: orgChartData.boardMembers?.length });
          } else {
            console.log(`[Batch] ⚠ Org chart not found or empty`);
            sendStatus('orgchart_not_found', 'Org chart not found or empty');
          }
        } catch (parseError) {
          console.error(`[Batch] Error parsing org chart JSON:`, parseError.message);
          console.error(`[Batch] JSON string was:`, jsonMatch[0]);
          sendStatus('orgchart_parse_error', 'Error parsing org chart response');
        }
      } else {
        console.log(`[Batch] ⚠ No JSON found in org chart response`);
        sendStatus('orgchart_no_json', 'No valid org chart data found');
      }
    } catch (orgChartError) {
      console.error(`[Batch] Error gathering org chart:`, orgChartError);
      sendStatus('orgchart_error', `Error gathering org chart: ${orgChartError.message}`);
    }

    console.log(`[Batch] Metadata gathering complete:`, metadataResults);
    sendStatus('metadata_complete', 'Metadata gathering complete', metadataResults);

    // Update Phase 1 status in BankMetadata
    try {
      await metadata.updateResearchPhase('phase1', 'completed', {
        sourcesFound: totalSources,
        completedAt: new Date()
      });
      console.log(`[Batch] ✓ Marked Phase 1 as completed in BankMetadata`);
      sendStatus('phase_updated', 'Phase 1 marked as completed');
    } catch (phaseError) {
      console.error(`[Batch] Warning: Failed to update phase status:`, phaseError.message);
      sendStatus('phase_update_warning', `Warning: Failed to update phase status: ${phaseError.message}`);
    }

    console.log(`[Batch] Phase 1 complete for ${bank.name}`);

    // Send final completion message
    clearInterval(heartbeatInterval);
    sendStatus('complete', 'Source gathering complete', {
      success: true,
      sessionId: sid,
      sourcesFound: totalSources,
      sourcesByCategory: sourceCounts,
      metadata: metadataResults,
      bank: {
        idrssd: bank.idrssd,
        name: bank.name
      }
    });
    res.end();

  } catch (error) {
    console.error('[Batch] Error in gather-sources-batch:', error);
    clearInterval(heartbeatInterval);
    sendStatus('error', error.message || 'Failed to gather sources');
    res.end();
  }
});

/**
 * POST /api/research/:idrssd/extract-insights-batch
 * SSE streaming version of extract-insights for batch processing
 * Sends progress updates to prevent Heroku H12/H15 timeouts
 */
router.post('/:idrssd/extract-insights-batch', async (req, res) => {
  const { idrssd } = req.params;

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendStatus = (stage, message, data = {}) => {
    res.write(`data: ${JSON.stringify({ stage, message, ...data })}\n\n`);
  };

  // Heartbeat to prevent H15 idle connection timeout (55 seconds)
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
      if (res.socket && res.socket.writable) {
        res.socket.uncork();
      }
    } catch (err) {
      console.error('[Batch Extract Insights Heartbeat] Error:', err.message);
      clearInterval(heartbeatInterval);
    }
  }, 30000); // 30 seconds

  try {
    console.log(`\n[Batch Extract Insights] Starting for bank ${idrssd}`);
    sendStatus('init', 'Initializing insight extraction...');

    // Get or create bank metadata
    const BankMetadata = require('../models/BankMetadata');
    const Institution = require('../models/Institution');
    const GroundingDocument = require('../models/GroundingDocument');

    const institution = await Institution.findOne({ idrssd });
    if (!institution) {
      clearInterval(heartbeatInterval);
      sendStatus('error', `Institution ${idrssd} not found`);
      res.end();
      return;
    }

    console.log(`[Batch Extract Insights] Found institution: ${institution.name}`);
    sendStatus('starting', `Starting insight extraction for ${institution.name}`);

    const metadata = await BankMetadata.getOrCreate(idrssd, institution.name);
    await metadata.startInsightExtraction();
    await metadata.updateResearchPhase('phase3', 'in_progress');

    console.log('[Batch Extract Insights] Checking RAG documents...');
    sendStatus('checking', 'Checking RAG documents...');

    // Check if there are any documents in RAG
    const documentCount = await GroundingDocument.countDocuments({ idrssd });
    if (documentCount === 0) {
      await metadata.updateResearchPhase('phase3', 'failed', {
        error: 'No documents found in RAG'
      });
      clearInterval(heartbeatInterval);
      sendStatus('error', 'No documents found in RAG. Please upload documents first.');
      res.end();
      return;
    }

    console.log(`[Batch Extract Insights] Found ${documentCount} documents in RAG`);
    sendStatus('found', `Found ${documentCount} documents in RAG`, { documentCount });

    // Get all documents for this bank
    const documents = await GroundingDocument.find({ idrssd })
      .select('title filename topics')
      .lean();

    console.log('[Batch Extract Insights] Querying RAG for strategic priorities...');
    sendStatus('querying', 'Querying RAG for strategic priorities...');

    // Query RAG for strategic priorities using groundingService
    const groundingService = require('../services/groundingService');
    const priorityChunks = await groundingService.retrieveChunks(
      `What are the top strategic priorities mentioned by executives and management? Include digital transformation, technology initiatives, and growth strategies.`,
      { idrssd },
      10
    );
    console.log(`[Batch Extract Insights] Retrieved ${priorityChunks.length} priority chunks`);
    sendStatus('priorities', `Retrieved ${priorityChunks.length} priority chunks`, { count: priorityChunks.length });

    console.log('[Batch Extract Insights] Querying RAG for focus metrics...');
    sendStatus('querying', 'Querying RAG for focus metrics...');

    // Query for focus metrics
    const metricsChunks = await groundingService.retrieveChunks(
      `What key performance metrics, KPIs, and financial metrics are emphasized by management and analysts? Include efficiency metrics, profitability metrics, and growth metrics.`,
      { idrssd },
      10
    );
    console.log(`[Batch Extract Insights] Retrieved ${metricsChunks.length} metrics chunks`);
    sendStatus('metrics', `Retrieved ${metricsChunks.length} metrics chunks`, { count: metricsChunks.length });

    console.log('[Batch Extract Insights] Querying RAG for technology partnerships...');
    sendStatus('querying', 'Querying RAG for technology partnerships...');

    // Query for tech partnerships
    const techChunks = await groundingService.retrieveChunks(
      `What technology partnerships, fintech collaborations, and vendor relationships are mentioned? Include AI initiatives, cloud partnerships, and digital banking platforms.`,
      { idrssd },
      10
    );
    console.log(`[Batch Extract Insights] Retrieved ${techChunks.length} tech partnership chunks`);
    sendStatus('tech', `Retrieved ${techChunks.length} tech partnership chunks`, { count: techChunks.length });

    console.log('[Batch Extract Insights] Analyzing results with Claude...');
    sendStatus('analyzing', 'Analyzing results with Claude API...');

    // Use Claude to analyze and structure the insights
    const ClaudeService = require('../services/claudeService');
    const claudeService = new ClaudeService();
    const analysisPrompt = `Analyze the following information extracted from bank documents and create structured insights.

STRATEGIC PRIORITIES CONTEXT:
${priorityChunks.map((c, i) => `[${i + 1}] From "${c.documentTitle}" (page ${c.pageNumber}): ${c.content}`).join('\n\n')}

FOCUS METRICS CONTEXT:
${metricsChunks.map((c, i) => `[${i + 1}] From "${c.documentTitle}" (page ${c.pageNumber}): ${c.content}`).join('\n\n')}

TECHNOLOGY PARTNERSHIPS CONTEXT:
${techChunks.map((c, i) => `[${i + 1}] From "${c.documentTitle}" (page ${c.pageNumber}): ${c.content}`).join('\n\n')}

Extract and structure the following insights in JSON format:

{
  "priorities": [
    {
      "title": "Brief priority title",
      "description": "Detailed description of this strategic priority",
      "citations": [
        {
          "documentTitle": "Document name",
          "citedText": "Exact quote from document",
          "pageNumber": page_number
        }
      ],
      "methodology": "How this priority was determined"
    }
  ],
  "focusMetrics": [
    {
      "metric": "Metric name (e.g., 'Efficiency Ratio', 'ROE')",
      "commentary": "Management or analyst commentary about this metric",
      "citations": [
        {
          "documentTitle": "Document name",
          "citedText": "Exact quote",
          "pageNumber": page_number
        }
      ],
      "methodology": "How this was identified"
    }
  ],
  "techPartnerships": [
    {
      "partner": "Partner name",
      "description": "Description of partnership",
      "announcedDate": "When announced",
      "citations": [
        {
          "documentTitle": "Document name",
          "citedText": "Exact quote",
          "pageNumber": page_number
        }
      ],
      "methodology": "How this was found"
    }
  ]
}

Only include items that are explicitly mentioned in the context. Use exact quotes for citations. Return ONLY the JSON object, no additional text or markdown.`;

    console.log('[Batch Extract Insights] Calling Claude API...');
    const response = await claudeService.sendMessage(
      [{ role: 'user', content: analysisPrompt }],
      {
        temperature: 0.3,
        max_tokens: 4000
      }
    );

    const analysis = response.content[0].text;
    console.log(`[Batch Extract Insights] Received response from Claude (${analysis.length} chars)`);
    sendStatus('parsing', 'Parsing Claude response...');

    // Parse the JSON response
    let insights;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = analysis.match(/```json\s*([\s\S]*?)\s*```/) || analysis.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : analysis;
      insights = JSON.parse(jsonStr);
      console.log('[Batch Extract Insights] Successfully parsed insights JSON');
      console.log(`  - Priorities: ${insights.priorities?.length || 0}`);
      console.log(`  - Focus Metrics: ${insights.focusMetrics?.length || 0}`);
      console.log(`  - Tech Partnerships: ${insights.techPartnerships?.length || 0}`);
      sendStatus('parsed', 'Successfully parsed insights', {
        priorities: insights.priorities?.length || 0,
        focusMetrics: insights.focusMetrics?.length || 0,
        techPartnerships: insights.techPartnerships?.length || 0
      });
    } catch (parseError) {
      console.error('[Batch Extract Insights] Failed to parse Claude response:', parseError);
      console.error('[Batch Extract Insights] Raw response:', analysis.substring(0, 500));
      await metadata.updateResearchPhase('phase3', 'failed', {
        error: 'Failed to parse insights from AI response'
      });
      clearInterval(heartbeatInterval);
      sendStatus('error', 'Failed to parse insights from AI response');
      res.end();
      return;
    }

    console.log('[Batch Extract Insights] Saving insights to database...');
    sendStatus('saving', 'Saving insights to database...');

    // Update metadata with insights
    await metadata.updateStrategicInsights({
      priorities: insights.priorities || [],
      focusMetrics: insights.focusMetrics || [],
      techPartnerships: insights.techPartnerships || [],
      source: `RAG analysis of ${documentCount} documents`,
      extractionMethodology: `Analyzed ${documentCount} documents using Claude with RAG retrieval. Extracted strategic information from investor presentations, earnings transcripts, and other documents.`
    });

    // Mark phase 3 as completed
    await metadata.updateResearchPhase('phase3', 'completed', {
      insightsExtracted: true
    });

    console.log('[Batch Extract Insights] ✅ Insight extraction complete!');

    clearInterval(heartbeatInterval);
    sendStatus('complete', 'Insight extraction complete', {
      success: true,
      insightsExtracted: true,
      documentCount,
      insights: {
        priorities: insights.priorities || [],
        focusMetrics: insights.focusMetrics || [],
        techPartnerships: insights.techPartnerships || []
      }
    });
    res.end();

  } catch (error) {
    console.error('[Batch Extract Insights] Error:', error);

    // Update metadata to failed
    try {
      const BankMetadata = require('../models/BankMetadata');
      const metadata = await BankMetadata.findOne({ idrssd });
      if (metadata) {
        await metadata.failInsightExtraction(error.message);
        await metadata.updateResearchPhase('phase3', 'failed', {
          error: error.message
        });
      }
    } catch (updateError) {
      console.error('[Batch Extract Insights] Failed to update error status:', updateError);
    }

    clearInterval(heartbeatInterval);
    sendStatus('error', error.message || 'Failed to extract insights');
    res.end();
  }
});

/**
 * Helper: Rank and recommend sources based on quality and recency
 * NOW USING: New comprehensive sourceSelectionService with proper authority/depth/freshness scoring
 */
/**
 * Rank and recommend sources
 * @param {Array|Object} sources - Either array of sources (per-category) or object with category keys (global)
 * @param {string} category - Category name (for per-category mode)
 * @param {Object} options - Ranking options
 * @param {boolean} options.global - If true, rank across all categories (sources must be object)
 * @param {number} options.topN - Number of top sources to recommend (default: 3 per category, or 5 global)
 * @param {number} options.minScore - Minimum score threshold (default: 60)
 * @returns {Array|Object} - Scored sources (array for per-category, object for global)
 */
function rankAndRecommendSources(sources, category, options = {}) {
  const {
    global = false,
    topN = global ? 5 : 3,
    minScore = 60
  } = options;

  // Initialize the source selection service
  const SourceSelectionService = require('../services/sourceSelectionService');
  const selectionService = new SourceSelectionService();

  // GLOBAL MODE: Rank across all categories
  if (global) {
    if (!sources || typeof sources !== 'object') {
      console.error('[Source Ranking] Global mode requires sources object with category keys');
      return sources;
    }

    // Collect all sources from all categories
    const allSources = [];
    Object.entries(sources).forEach(([cat, catSources]) => {
      if (Array.isArray(catSources)) {
        catSources.forEach(source => {
          allSources.push({ ...source, category: cat });
        });
      }
    });

    if (allSources.length === 0) {
      console.log('[Source Ranking] Global: No sources to rank');
      return sources;
    }

    // DEDUPLICATION: Remove duplicate URLs, keeping the one with best title/metadata
    const urlMap = new Map();
    allSources.forEach(source => {
      const normalizedUrl = source.url?.toLowerCase().replace(/\/$/, '').replace(/\?.*$/, '');
      if (!normalizedUrl) return;

      const existing = urlMap.get(normalizedUrl);
      if (!existing) {
        urlMap.set(normalizedUrl, source);
      } else {
        // Keep the source with longer/better title or from a higher-priority category
        const categoryPriority = { investorPresentation: 4, earningsTranscript: 3, strategyAnalysis: 2, analystReports: 1 };
        const existingPriority = categoryPriority[existing.category] || 0;
        const newPriority = categoryPriority[source.category] || 0;

        if (newPriority > existingPriority ||
            (newPriority === existingPriority && (source.title?.length || 0) > (existing.title?.length || 0))) {
          urlMap.set(normalizedUrl, source);
        }
      }
    });

    const deduplicatedSources = Array.from(urlMap.values());
    const duplicatesRemoved = allSources.length - deduplicatedSources.length;
    if (duplicatesRemoved > 0) {
      console.log(`[Source Ranking] Global: Removed ${duplicatesRemoved} duplicate URLs`);
    }

    // FILTER: Remove landing/index pages that don't contain actual content
    const landingPagePatterns = [
      /\/presentations\/?$/i,
      /\/investor-day\/?$/i,
      /\/events-and-presentations\/?$/i,
      /\/events\/?$/i,
      /\/investor-relations\/?$/i,
      /\/ir\/?$/i,
      /\/news\/?$/i,
      /\/press-releases\/?$/i
    ];

    const filteredSources = deduplicatedSources.filter(source => {
      const url = source.url || '';
      const isLandingPage = landingPagePatterns.some(pattern => pattern.test(url));
      if (isLandingPage) {
        console.log(`[Source Ranking] Filtering out landing page: ${url}`);
      }
      return !isLandingPage;
    });

    const landingPagesRemoved = deduplicatedSources.length - filteredSources.length;
    if (landingPagesRemoved > 0) {
      console.log(`[Source Ranking] Global: Removed ${landingPagesRemoved} landing/index pages`);
    }

    // Score all sources (using filtered list)
    const scoredSources = filteredSources.map(source => {
      const scoring = selectionService.scoreSource(source);
      return {
        ...source,
        score: scoring.totalScore,
        categoryMultiplier: scoring.categoryMultiplier,
        confidence: scoring.totalScore / 100,
        scoring: scoring.breakdown
      };
    });

    // Sort by score (highest first)
    scoredSources.sort((a, b) => b.score - a.score);

    // Select top N that meet minimum threshold
    const topSources = scoredSources
      .filter(s => s.score >= minScore)
      .slice(0, topN);

    // Mark top sources as recommended
    scoredSources.forEach(source => {
      source.recommended = topSources.some(top => top.url === source.url);
    });

    console.log(`[Source Ranking] Global: Scored ${scoredSources.length} sources. Top ${topN} selected:`);
    topSources.forEach((s, idx) => {
      console.log(`  ${idx + 1}. [${s.category}] Score: ${s.score} (×${s.categoryMultiplier}) - ${s.title?.substring(0, 60) || 'No title'}...`);
    });

    // Group back by category for return
    const result = {};
    Object.keys(sources).forEach(cat => {
      result[cat] = scoredSources.filter(s => s.category === cat);
    });

    return result;
  }

  // PER-CATEGORY MODE (legacy)
  if (!sources || sources.length === 0) return sources;

  // Score each source
  const scoredSources = sources.map(source => {
    const scoring = selectionService.scoreSource(source);
    return {
      ...source,
      score: scoring.totalScore,
      categoryMultiplier: scoring.categoryMultiplier,
      confidence: scoring.totalScore / 100,
      scoring: scoring.breakdown
    };
  });

  // Sort by score (highest first)
  scoredSources.sort((a, b) => b.score - a.score);

  // Mark top sources as recommended
  scoredSources.forEach((source, idx) => {
    source.recommended = (idx < topN && source.score >= minScore);
  });

  console.log(`[Source Ranking] ${category}: Scored ${scoredSources.length} sources. Top scores: ${scoredSources.slice(0, 3).map(s => `${s.score} (×${s.categoryMultiplier})`).join(', ')}`);

  return scoredSources;
}

/**
 * Helper: Search for sources in a specific category
 */
async function searchSourcesForCategory(bank, category) {
  const sources = [];

  // Calculate date for 12 months ago (was 6, but that's too restrictive)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const dateFilter = `after:${twelveMonthsAgo.getFullYear()}-${String(twelveMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

  console.log(`[Source Search] Date filter: ${dateFilter} (last 12 months)`);

  // Extract domain from website URL for targeted searching
  let domain = '';
  if (bank.website) {
    try {
      const url = new URL(bank.website.startsWith('http') ? bank.website : `https://${bank.website}`);
      domain = url.hostname.replace('www.', '');
    } catch (e) {
      domain = bank.website.replace('www.', '');
    }
  }

  // For investor presentations, use a two-step search strategy
  if (category === 'investorPresentation') {
    try {
      console.log(`[Investor Presentations] Starting search for ${bank.name}`);
      console.log(`[Investor Presentations] Bank domain: ${domain}`);
      console.log(`[Investor Presentations] Date filter: ${dateFilter}`);

      // Step 1: First find the investor relations website
      let irSiteQuery = domain ?
        `"${bank.name}" investor relations site:${domain} OR site:investor.${domain} OR site:ir.${domain} OR site:${domain}/investor OR site:${domain}/ir` :
        `"${bank.name}" investor relations website`;

      console.log(`[Investor Presentations] Step 1 - Finding IR site with query: ${irSiteQuery}`);

      const irSiteResults = await claudeService.searchForSources(irSiteQuery, category, bank, 
        `CRITICAL: Find ${bank.name}'s investor relations (IR) website URL. Look for URLs containing "investor" or "ir" such as:
- investor.bankname.com
- ir.bankname.com  
- bankname.com/investor
- bankname.com/ir
- bankname.com/investor-relations

Return the actual IR website URL (the main investor relations page URL), not PDFs. This will be used to search for presentations. If the IR site URL is found, return it as a source with the URL field containing the IR site address.`
      );

      console.log(`[Investor Presentations] Step 1 - Received ${irSiteResults?.length || 0} results from IR site search`);

      // Extract IR site URL from results if found
      let irSiteUrl = null;
      if (irSiteResults && irSiteResults.length > 0) {
        console.log(`[Investor Presentations] Step 1 - Analyzing results to find IR site URL...`);
        // Try to find an IR site URL in the results - check URL, title, and preview
        for (const result of irSiteResults) {
          // Check URL field
          const urlToCheck = result.url || '';
          // Also check title and preview for URLs
          const textToCheck = `${urlToCheck} ${result.title || ''} ${result.preview || ''}`.toLowerCase();
          
          if (textToCheck.includes('investor.') || 
              textToCheck.includes('ir.') || 
              textToCheck.includes('/ir') || 
              textToCheck.includes('/investor') ||
              textToCheck.includes('investor-relations')) {
            // Prefer the URL if it's an IR site, otherwise try to extract from text
            if (urlToCheck && (
              urlToCheck.includes('investor.') || 
              urlToCheck.includes('ir.') || 
              urlToCheck.includes('/ir') || 
              urlToCheck.includes('/investor')
            )) {
              irSiteUrl = urlToCheck;
            } else {
              // Try to extract URL from text
              const urlMatch = textToCheck.match(/(https?:\/\/[^\s]*investor[^\s]*|https?:\/\/[^\s]*\/ir[^\s]*)/);
              if (urlMatch) {
                irSiteUrl = urlMatch[1];
              }
            }
            if (irSiteUrl) break;
          }
        }
      }

      console.log(`[Investor Presentations] Step 1 - IR site URL found: ${irSiteUrl || 'NOT FOUND'}`);

      // Step 2: Search for presentations/events PAGES (not forcing PDFs, no strict date filter)
      let presentationsQuery;
      if (irSiteUrl) {
        // Extract domain from IR site URL
        try {
          const irUrl = new URL(irSiteUrl.startsWith('http') ? irSiteUrl : `https://${irSiteUrl}`);
          const irDomain = irUrl.hostname.replace('www.', '');
          // Search for events/presentations PAGES (not forcing PDFs anymore)
          // PRIORITIZE: Conference presentations and Investor Day - these are richer in strategy
          presentationsQuery = `site:${irDomain} (presentations OR events OR "investor day" OR "investor conference" OR "conference presentation" OR "investor presentations" OR "earnings presentations" OR "quarterly presentations" OR "events and presentations")`;
        } catch (e) {
          // Fallback to broader search
          presentationsQuery = domain ?
            `"${bank.name}" ("investor day" OR "investor conference" OR "conference presentation" OR presentations OR events OR "investor presentations" OR "earnings presentations") (site:investor.${domain} OR site:ir.${domain})` :
            `"${bank.name}" investor relations ("investor day" OR "investor conference" OR presentations OR events)`;
        }
      } else {
        // If IR site not found, do broader search
        presentationsQuery = domain ?
          `"${bank.name}" ("investor day" OR "investor conference" OR "conference presentation" OR presentations OR events OR "investor presentations" OR "earnings presentations") (site:investor.${domain} OR site:ir.${domain})` :
          `"${bank.name}" investor relations ("investor day" OR "investor conference" OR presentations OR events)`;
      }

      console.log(`[Investor Presentations] Step 2 - Searching for presentations PAGES with query: ${presentationsQuery}`);

      const presentationResults = await claudeService.searchForSources(presentationsQuery, category, bank,
        `PRIORITY ORDER for ${bank.name} (HIGHEST TO LOWEST VALUE):

1. **INVESTOR DAY & CONFERENCE PRESENTATIONS** (ABSOLUTE HIGHEST PRIORITY - Most Strategic Content)
   - ⭐ INVESTOR DAY presentations (these contain the most strategic insights!)
   - ⭐ Conference presentations (industry conferences, investor conferences)
   - ⭐ Roadshow presentations
   - These typically have richer strategy, business model insights, and long-term plans
   - Look for titles containing: "Investor Day", "Conference", "Summit", "Forum"
   - Files ending in .pdf

2. **QUARTERLY EARNINGS PRESENTATIONS** (HIGH PRIORITY)
   - Quarterly earnings presentation PDFs
   - Earnings call PDF supplements
   - Files ending in .pdf

3. **EARNINGS TRANSCRIPTS** (MEDIUM PRIORITY)
   - Full earnings call transcripts
   - Q&A session transcripts
   - Management discussion transcripts

4. **EVENTS & PRESENTATIONS LANDING PAGES** (LOWER PRIORITY - only if they link to PDFs)
   - Main "Events & Presentations" page (if it links to PDFs)
   - "Investor Events" page
   - "Earnings & Events" page
   - "Investor Materials" page

CRITICAL INSTRUCTIONS:
- **INVESTOR DAY and CONFERENCE presentations are GOLD** - prioritize these above all else!
- **PDF files are ALWAYS preferred** over HTML pages
- Look IN THE CONTENT of presentation pages to find direct PDF download links
- If you find a presentations page, EXTRACT the PDF links from that page and return those PDFs as separate sources
- Return actual PDF URLs (ending in .pdf) whenever possible
- Conference/Investor Day presentations > Quarterly presentations > Transcripts > Landing pages

Return sources with INVESTOR DAY/CONFERENCE PDFs at the very top, followed by quarterly presentation PDFs.`
      );

      console.log(`[Investor Presentations] Step 2 - Received ${presentationResults?.length || 0} results`);
      if (presentationResults && presentationResults.length > 0) {
        console.log(`[Investor Presentations] First result: ${presentationResults[0].title} (${presentationResults[0].url})`);
      }

      return presentationResults || [];
    } catch (error) {
      console.error(`[Investor Presentations] Error in two-step search:`, error);
      // Fallback to single search (without forcing PDFs or strict date filter)
      const fallbackQuery = domain ?
        `"${bank.name}" investor relations (presentations OR events) (site:investor.${domain} OR site:ir.${domain})` :
        `"${bank.name}" investor relations presentations`;
      console.log(`[Investor Presentations] Using fallback query: ${fallbackQuery}`);
      const fallbackResults = await claudeService.searchForSources(
        fallbackQuery,
        category,
        bank,
        `Find investor presentation pages or PDF links for ${bank.name}. PRIORITIZE Investor Day and conference presentations (these contain the richest strategic content), then quarterly earnings presentations. Look for Events & Presentations pages on their IR site, or direct PDF links to presentations.`
      ) || [];
      console.log(`[Investor Presentations] Fallback returned ${fallbackResults.length} results`);
      return fallbackResults;
    }
  }

  // For other categories, use standard single search
  console.log(`[Source Search] Searching for category: ${category}`);
  const searchQueries = {
    // Full earnings call transcripts - exclude summaries and paywalls
    earningsTranscript: `"${bank.name}" ("earnings call transcript" OR "quarterly earnings transcript") ${dateFilter} (site:seekingalpha.com OR site:fool.com) -"summary" -"highlights only" -subscribe -paywall`,

    // Detailed strategy documents and analysis - recent, non-paywalled
    strategyAnalysis: `"${bank.name}" (strategy OR "strategic plan" OR "digital transformation" OR "strategic initiatives") ${dateFilter} (filetype:pdf OR site:mckinsey.com OR site:bcg.com OR site:bain.com) -prnewswire -businesswire -subscribe -paywall`,

    // Analyst reports from reputable firms - recent only
    analystReports: `"${bank.name}" ("analyst report" OR "industry report" OR "research report") ${dateFilter} (site:forrester.com OR site:gartner.com OR site:idc.com OR site:jdpower.com OR filetype:pdf) -subscribe -paywall`
  };

  const query = searchQueries[category];
  console.log(`[Source Search] Query for ${category}: ${query}`);

  try {
    // Use Claude with search to find relevant sources
    const searchResults = await claudeService.searchForSources(query, category, bank);
    console.log(`[Source Search] ${category} returned ${searchResults?.length || 0} results`);

    // Parse results and extract source information
    // This would be implemented in ClaudeService
    return searchResults || [];

  } catch (error) {
    console.error(`[Source Search] Error searching for ${category}:`, error);
    return [];
  }
}

/**
 * GET /api/research/:idrssd/sources/latest
 * Get sources from the latest session for this bank
 */
router.get('/:idrssd/sources/latest', async (req, res) => {
  try {
    const { idrssd } = req.params;
    console.log(`GET /api/research/${idrssd}/sources/latest - Request received`);

    // Find the most recent source for this bank to get its session ID
    const latestSource = await Source.findOne({ idrssd })
      .sort({ foundAt: -1 })
      .limit(1);

    console.log('Latest source found:', latestSource ? latestSource.sessionId : 'none');

    if (!latestSource) {
      console.log('No sources found for bank:', idrssd);
      return res.json({ sources: [], sessionId: null });
    }

    // Get all sources from that session
    const sources = await Source.getBySession(latestSource.sessionId);
    console.log(`Found ${sources.length} sources from session ${latestSource.sessionId}`);

    res.json({
      sessionId: latestSource.sessionId,
      sources: sources.map(s => ({
        id: s.sourceId,
        category: s.category,
        url: s.url,
        title: s.title,
        preview: s.preview,
        date: s.date,
        status: s.status,
        confidence: s.confidence,
        recommended: s.recommended,
        fetchStatus: s.fetchStatus,
        fetchError: s.fetchError,
        contentLength: s.contentLength,
        contentType: s.contentType,
        fetchable: s.fetchable,
        hasContent: !!s.content,
        isProbablyPaywalled: s.isProbablyPaywalled,
        isProbablyTruncated: s.isProbablyTruncated,
        requiresWebSearch: s.requiresWebSearch,
        foundAt: s.foundAt
      }))
    });

  } catch (error) {
    console.error('Error fetching latest sources:', error);
    res.status(500).json({ error: 'Failed to fetch latest sources' });
  }
});

/**
 * GET /api/research/:idrssd/sources
 * Get all sources for a session
 */
router.get('/:idrssd/sources', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { sessionId } = req.query;

    const sources = await Source.getBySession(sessionId);

    res.json({
      sessionId,
      sources: sources.map(s => ({
        id: s.sourceId,
        category: s.category,
        url: s.url,
        title: s.title,
        preview: s.preview,
        date: s.date,
        status: s.status,
        confidence: s.confidence,
        recommended: s.recommended,
        fetchStatus: s.fetchStatus,
        fetchError: s.fetchError,
        contentLength: s.contentLength,
        contentType: s.contentType,
        fetchable: s.fetchable,
        hasContent: !!s.content,
        isProbablyPaywalled: s.isProbablyPaywalled,
        isProbablyTruncated: s.isProbablyTruncated,
        requiresWebSearch: s.requiresWebSearch,
        foundAt: s.foundAt
      }))
    });

  } catch (error) {
    console.error('Error fetching sources:', error);
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

/**
 * POST /api/research/:idrssd/sources/:sourceId/approve
 * Approve a source (no automatic content fetching - user downloads PDFs manually)
 */
router.post('/:idrssd/sources/:sourceId/approve', async (req, res) => {
  try {
    const { sourceId } = req.params;

    console.log(`[Approve] Approving source: ${sourceId}`);

    const source = await Source.findOne({ sourceId });
    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    await source.approve();

    res.json({
      success: true,
      source: {
        id: source.sourceId,
        status: source.status,
        approvedAt: source.approvedAt,
        url: source.url,
        title: source.title
      }
    });

  } catch (error) {
    console.error('Error approving source:', error);
    res.status(500).json({ error: 'Failed to approve source' });
  }
});

/**
 * POST /api/research/:idrssd/sources/:sourceId/ignore
 * Ignore a source (won't be used in report)
 */
router.post('/:idrssd/sources/:sourceId/ignore', async (req, res) => {
  try {
    const { sourceId } = req.params;

    const source = await Source.findOne({ sourceId });
    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    await source.ignore();

    res.json({
      success: true,
      source: {
        id: source.sourceId,
        status: source.status
      }
    });

  } catch (error) {
    console.error('Error ignoring source:', error);
    res.status(500).json({ error: 'Failed to ignore source' });
  }
});

/**
 * POST /api/research/:idrssd/sources/:sourceId/fetch-content
 * Fetch content for a specific source
 */
router.post('/:idrssd/sources/:sourceId/fetch-content', async (req, res) => {
  try {
    const { sourceId } = req.params;

    console.log(`[FetchContent] Request to fetch content for source: ${sourceId}`);

    const source = await Source.findOne({ sourceId });
    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    // Mark fetch as in progress
    await source.startFetch();

    // Fetch content
    console.log(`[FetchContent] Fetching content from: ${source.url}`);
    const fetchResult = await contentFetcher.fetchAndParse(source.url);

    // Store result
    await source.storeFetchedContent(fetchResult);

    console.log(`[FetchContent] Fetch complete. Status: ${source.fetchStatus}, Fetchable: ${source.fetchable}`);

    // Return updated source
    res.json({
      success: true,
      source: {
        id: source.sourceId,
        fetchStatus: source.fetchStatus,
        fetchable: source.fetchable,
        contentLength: source.contentLength,
        contentType: source.contentType,
        fetchError: source.fetchError,
        hasContent: !!source.content
      }
    });

  } catch (error) {
    console.error('[FetchContent] Error:', error);

    // Try to mark source as failed
    try {
      const source = await Source.findOne({ sourceId: req.params.sourceId });
      if (source) {
        await source.markFetchFailed(error.message);
      }
    } catch (saveError) {
      console.error('[FetchContent] Error saving failure status:', saveError);
    }

    res.status(500).json({
      error: 'Failed to fetch content',
      details: error.message
    });
  }
});

/**
 * POST /api/research/:idrssd/find-better-source
 * User-guided search for better sources
 */
router.post('/:idrssd/find-better-source', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { category, sessionId, refinementPrompt } = req.body;

    const bank = await Institution.findOne({ idrssd });
    if (!bank) {
      return res.status(404).json({ error: 'Bank not found' });
    }

    // Use Claude to perform targeted search based on user's refinement
    const customQuery = `${bank.name} ${refinementPrompt}`;
    const searchResults = await claudeService.searchForSources(customQuery, category, bank, refinementPrompt);

    if (searchResults && searchResults.length > 0) {
      // Save the new source(s)
      const newSources = [];
      for (const sourceData of searchResults) {
        const source = new Source({
          sourceId: `src_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          idrssd,
          sessionId,
          category,
          ...sourceData,
          status: 'pending'
        });

        await source.save();
        newSources.push({
          id: source.sourceId,
          url: source.url,
          title: source.title,
          preview: source.preview,
          date: source.date,
          status: source.status
        });
      }

      res.json({
        success: true,
        sources: newSources
      });
    } else {
      res.json({
        success: false,
        message: 'No additional sources found'
      });
    }

  } catch (error) {
    console.error('Error finding better source:', error);
    res.status(500).json({ error: 'Failed to find better source' });
  }
});

/**
 * GET /api/research/:idrssd/generate-with-sources
 * Stage 2: Generate report using ONLY approved sources + call report data
 * No new web searches performed
 */
router.get('/:idrssd/generate-with-sources', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { sourceIds, sessionId } = req.query;

    console.log('=== STAGE 2: GENERATE WITH SOURCES ===');
    console.log('Bank ID:', idrssd);
    console.log('Session ID:', sessionId);
    console.log('Raw sourceIds:', sourceIds);

    const approvedSourceIds = sourceIds ? JSON.parse(decodeURIComponent(sourceIds)) : [];
    console.log('Parsed approved source IDs:', approvedSourceIds);

    // Get bank and approved sources
    const bank = await Institution.findOne({ idrssd });
    if (!bank) {
      console.error('Bank not found:', idrssd);
      return res.status(404).json({ error: 'Bank not found' });
    }
    console.log('Bank found:', bank.name);

    const approvedSources = await Source.getByIds(approvedSourceIds);
    console.log('Approved sources fetched:', approvedSources.length);
    approvedSources.forEach((s, idx) => {
      console.log(`  Source ${idx + 1}: ${s.title}`);
      console.log(`    - URL: ${s.url}`);
      console.log(`    - Has content: ${!!s.content}`);
      console.log(`    - Content length: ${s.contentLength || 0}`);
      console.log(`    - Fetchable: ${s.fetchable}`);
    });

    // Get financial data (always included)
    // Sort ascending (oldest first) for proper chronological order in charts
    const statements = await FinancialStatement.find({ idrssd })
      .sort({ reportingPeriod: 1 })
      .limit(20);
    console.log('Financial statements found:', statements.length);

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent('status', { phase: 'analysis', progress: 34, message: 'Analyzing with approved sources...' });

    try {
      console.log('Starting generateReportWithApprovedSources...');

      // Generate report using approved sources
      await generateReportWithApprovedSources(
        idrssd,
        bank,
        statements,
        approvedSources,
        sessionId,
        sendEvent
      );

      console.log('Report generation completed successfully');
      sendEvent('complete', { message: 'Report generation complete' });
    } catch (error) {
      console.error('ERROR in report generation:', error);
      console.error('Error stack:', error.stack);
      sendEvent('error', { message: error.message });
    } finally {
      res.end();
    }

  } catch (error) {
    console.error('ERROR in generate-with-sources endpoint:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * Helper: Generate report using approved sources
 */
async function generateReportWithApprovedSources(idrssd, bank, statements, approvedSources, sessionId, sendEvent) {
  try {
    console.log('\n=== generateReportWithApprovedSources START ===');
    console.log('Bank:', bank.name);
    console.log('Statements count:', statements.length);
    console.log('Approved sources count:', approvedSources.length);
    console.log('Session ID:', sessionId);

    sendEvent('status', { phase: 'analysis', progress: 40, message: 'Preparing approved sources...' });

    // Use pre-fetched content from Stage 1 (RAG pipeline)
    // No additional web fetching required - content was already downloaded
    const sourcesWithContent = approvedSources.map((source) => {
      if (!source.content || !source.fetchable) {
        console.warn(`Source ${source.sourceId} has no content or was not fetchable`);
        source.content = `[Content for "${source.title}" (${source.url}) was not available. Reason: ${source.contentType === 'error' ? 'fetch error' : 'not fetchable'}]`;
      }
      return source;
    });

    console.log(`Using ${sourcesWithContent.length} approved sources with pre-fetched content`);
    sendEvent('status', { phase: 'analysis', progress: 50, message: 'Generating comprehensive analysis...' });

    // Build prompt with approved sources
    const sourceContext = sourcesWithContent.map((s, idx) => `
Source ${idx + 1}: ${s.title}
URL: ${s.url}
Category: ${s.category}
Content:
${s.content}

---
`).join('\n');

    // Call Claude with streaming, providing ONLY approved sources
    // (Modified prompt to prevent new web searches)
    console.log('Calling claudeService.generateReportFromApprovedSources...');
    console.log('Source context length:', sourceContext.length, 'characters');

    const result = await claudeService.generateReportFromApprovedSources({
      bank,
      statements,
      sourcesContext: sourceContext,
      approvedSources: sourcesWithContent,
      onThinking: (text) => {
        sendEvent('thinking', { text });
      },
      onText: (text) => {
        sendEvent('text', { text });
        sendEvent('status', { phase: 'synthesis', progress: 75, message: 'Synthesizing final report...' });
      }
    });

    console.log('Claude service call completed');
    console.log('Result keys:', Object.keys(result));

    // Save report with source references
    const timestamp = Date.now();
    const filename = `${idrssd}_${timestamp}.json`;

    const reportData = {
      idrssd,
      bankName: bank.name,
      generatedAt: new Date().toISOString(),
      model: result.model || 'Claude Sonnet 4.5',
      analysis: result.analysis,
      thinking: result.thinking,
      trendsData: result.trendsData,
      sessionId,
      sourcesUsed: approvedSources.map(s => ({
        id: s.sourceId,
        category: s.category,
        title: s.title,
        url: s.url,
        date: s.date
      })),
      metadata: result.metadata
    };

    console.log('Saving report to GridFS:', filename);
    const fileId = await saveJsonToGridFS(getDocumentBucket(), filename, reportData, { idrssd, type: 'research', sessionId });
    console.log('Report saved to GridFS successfully');

    // Also save to ResearchReport collection for history tracking
    const ResearchReport = require('../models/ResearchReport');
    try {
      await ResearchReport.create({
        idrssd,
        title: `${bankName} Analysis - ${new Date().toLocaleDateString()}`,
        reportData: reportData,
        gridfsFileId: fileId,
        fileName: filename
      });
      console.log('Report saved to ResearchReport collection');
    } catch (mongoError) {
      console.error('Warning: Failed to save to ResearchReport collection:', mongoError.message);
    }

    // Update source usage tracking
    console.log('Updating source usage tracking...');
    for (const source of approvedSources) {
      source.referencedCount = (source.referencedCount || 0) + 1;
      source.usedInReports.push(filename);
      await source.save();
    }
    console.log('Source tracking updated');

    sendEvent('status', { phase: 'synthesis', progress: 100, message: 'Report saved successfully' });
    console.log('=== generateReportWithApprovedSources END ===\n');

  } catch (error) {
    console.error('\n!!! ERROR in generateReportWithApprovedSources !!!');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw error;
  }
}

/**
 * ============================================================================
 * PDF MANAGEMENT ENDPOINTS
 * ============================================================================
 */

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const { idrssd } = req.params;
    const bankPdfDir = path.join(PDFS_DIR, idrssd);

    // Ensure bank's PDF directory exists
    try {
      await fs.mkdir(bankPdfDir, { recursive: true });
      cb(null, bankPdfDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}_${randomId}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit per file
  },
  fileFilter: (req, file, cb) => {
    // Only allow PDF files
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

/**
 * POST /api/research/:idrssd/pdfs/upload
 * Upload a PDF file for a bank
 */
router.post('/:idrssd/pdfs/upload', upload.single('pdf'), async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { description, sourceId, sourceUrl } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    console.log(`[PDF Upload] Received PDF for bank ${idrssd}: ${req.file.originalname} (${req.file.size} bytes)`);

    // Check total PDF count and size for this bank
    const existingCount = await PDF.getCount(idrssd);
    const existingSize = await PDF.getTotalSize(idrssd);

    if (existingCount >= 20) {
      // Delete the uploaded file
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'Maximum of 20 PDFs per bank reached' });
    }

    if (existingSize + req.file.size > 100 * 1024 * 1024) { // 100MB total limit
      // Delete the uploaded file
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'Total PDF size limit (100MB) exceeded' });
    }

    // Create PDF record
    const pdf = new PDF({
      pdfId: `pdf_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      idrssd,
      originalFilename: req.file.originalname,
      storedFilename: req.file.filename,
      fileSize: req.file.size,
      sourceId: sourceId || undefined,
      sourceUrl: sourceUrl || undefined,
      uploadType: sourceId ? 'from_source' : 'manual',
      description: description || undefined
    });

    await pdf.save();

    console.log(`[PDF Upload] Saved PDF record: ${pdf.pdfId}`);

    res.json({
      success: true,
      pdf: {
        id: pdf.pdfId,
        filename: pdf.originalFilename,
        size: pdf.fileSize,
        uploadedAt: pdf.uploadedAt,
        description: pdf.description
      }
    });

  } catch (error) {
    console.error('[PDF Upload] Error:', error);
    res.status(500).json({ error: 'Failed to upload PDF' });
  }
});

/**
 * POST /api/research/:idrssd/pdfs/download-from-source
 * Download a PDF from a source URL and add to library
 */
router.post('/:idrssd/pdfs/download-from-source', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { sourceId } = req.body;

    if (!sourceId) {
      return res.status(400).json({ error: 'sourceId is required' });
    }

    console.log(`[PDF Download] Downloading PDF from source ${sourceId} for bank ${idrssd}`);

    // Get the source
    const source = await Source.findOne({ sourceId });
    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    // Check if URL is a PDF
    const url = source.url;
    const isPdfUrl = url.toLowerCase().endsWith('.pdf') || source.contentType === 'pdf';

    if (!isPdfUrl) {
      return res.status(400).json({ error: 'Source is not a PDF file' });
    }

    // Check total PDF count and size for this bank
    const existingCount = await PDF.getCount(idrssd);
    const existingSize = await PDF.getTotalSize(idrssd);

    if (existingCount >= 20) {
      return res.status(400).json({ error: 'Maximum of 20 PDFs per bank reached' });
    }

    // Download the PDF
    console.log(`[PDF Download] Fetching PDF from: ${url}`);
    const axios = require('axios');
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      maxContentLength: 50 * 1024 * 1024, // 50MB max
      timeout: 60000 // 60 second timeout
    });

    const pdfBuffer = Buffer.from(response.data);
    const fileSize = pdfBuffer.length;

    console.log(`[PDF Download] Downloaded ${fileSize} bytes`);

    // Check size limits
    if (existingSize + fileSize > 100 * 1024 * 1024) {
      return res.status(400).json({ error: 'Total PDF size limit (100MB) exceeded' });
    }

    // Generate filename from source title or URL
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const originalFilename = source.title ?
      `${source.title.substring(0, 50).replace(/[^a-z0-9]/gi, '_')}.pdf` :
      `source_${randomId}.pdf`;
    const storedFilename = `${timestamp}_${randomId}.pdf`;

    // Ensure directory exists
    const bankPdfDir = path.join(PDFS_DIR, idrssd);
    await fs.mkdir(bankPdfDir, { recursive: true });

    // Write file
    const filePath = path.join(bankPdfDir, storedFilename);
    await fs.writeFile(filePath, pdfBuffer);

    console.log(`[PDF Download] Saved to: ${filePath}`);

    // Create PDF record
    const pdf = new PDF({
      pdfId: `pdf_${timestamp}_${randomId}`,
      idrssd,
      originalFilename,
      storedFilename,
      fileSize,
      sourceId,
      sourceUrl: url,
      uploadType: 'from_source',
      description: source.preview || `Downloaded from ${url}`
    });

    await pdf.save();

    console.log(`[PDF Download] Created PDF record: ${pdf.pdfId}`);

    res.json({
      success: true,
      pdf: {
        id: pdf.pdfId,
        filename: pdf.originalFilename,
        size: pdf.fileSize,
        uploadedAt: pdf.uploadedAt,
        sourceId: pdf.sourceId,
        description: pdf.description
      }
    });

  } catch (error) {
    console.error('[PDF Download] Error:', error);
    if (error.response) {
      res.status(500).json({ error: `Failed to download PDF: ${error.response.status} ${error.response.statusText}` });
    } else if (error.code === 'ECONNABORTED') {
      res.status(500).json({ error: 'Download timed out - PDF may be too large' });
    } else {
      res.status(500).json({ error: 'Failed to download PDF from source' });
    }
  }
});

/**
 * GET /api/research/:idrssd/pdfs
 * List all PDFs for a bank
 */
router.get('/:idrssd/pdfs', async (req, res) => {
  try {
    const { idrssd } = req.params;

    const pdfs = await PDF.getByBank(idrssd);
    const totalSize = await PDF.getTotalSize(idrssd);

    res.json({
      success: true,
      pdfs: pdfs.map(p => ({
        id: p.pdfId,
        filename: p.originalFilename,
        size: p.fileSize,
        sourceId: p.sourceId,
        sourceUrl: p.sourceUrl,
        uploadType: p.uploadType,
        description: p.description,
        uploadedAt: p.uploadedAt,
        ragStatus: p.ragStatus,
        ragChunkCount: p.ragChunkCount,
        ragProcessedAt: p.ragProcessedAt,
        ragError: p.ragError
      })),
      totalSize,
      count: pdfs.length
    });

  } catch (error) {
    console.error('[PDF List] Error:', error);
    res.status(500).json({ error: 'Failed to list PDFs' });
  }
});

/**
 * GET /api/research/:idrssd/pdfs/:pdfId/download
 * Download a PDF file
 */
router.get('/:idrssd/pdfs/:pdfId/download', async (req, res) => {
  try {
    const { pdfId } = req.params;

    const pdf = await PDF.findOne({ pdfId });
    if (!pdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    const filePath = pdf.getFilePath();

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'PDF file not found on disk' });
    }

    res.download(filePath, pdf.originalFilename);

  } catch (error) {
    console.error('[PDF Download] Error:', error);
    res.status(500).json({ error: 'Failed to download PDF' });
  }
});

/**
 * DELETE /api/research/:idrssd/pdfs/:pdfId
 * Delete a PDF file
 */
router.delete('/:idrssd/pdfs/:pdfId', async (req, res) => {
  try {
    const { pdfId } = req.params;

    const pdf = await PDF.findOne({ pdfId });
    if (!pdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    // Delete file from disk
    const filePath = pdf.getFilePath();
    try {
      await fs.unlink(filePath);
      console.log(`[PDF Delete] Deleted file: ${filePath}`);
    } catch (error) {
      console.warn(`[PDF Delete] File not found on disk: ${filePath}`);
    }

    // Delete database record
    await PDF.deleteOne({ pdfId });
    console.log(`[PDF Delete] Deleted PDF record: ${pdfId}`);

    res.json({ success: true });

  } catch (error) {
    console.error('[PDF Delete] Error:', error);
    res.status(500).json({ error: 'Failed to delete PDF' });
  }
});

/**
 * POST /api/research/:idrssd/sources/:sourceId/download-pdf
 * Download a source as PDF (if it's already a PDF URL)
 */
router.post('/:idrssd/sources/:sourceId/download-pdf', async (req, res) => {
  try {
    const { idrssd, sourceId } = req.params;

    const source = await Source.findOne({ sourceId });
    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    // Check if the URL is a PDF
    if (!source.url.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({
        error: 'Source is not a PDF. Please download manually from your browser and upload it.'
      });
    }

    console.log(`[PDF Download from Source] Downloading PDF from: ${source.url}`);

    // Download the PDF
    const axios = require('axios');
    const response = await axios.get(source.url, {
      responseType: 'arraybuffer',
      timeout: 60000, // 60 second timeout
      maxContentLength: 50 * 1024 * 1024, // 50MB limit
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    // Save to disk
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const filename = `${timestamp}_${randomId}.pdf`;
    const bankPdfDir = path.join(PDFS_DIR, idrssd);
    await fs.mkdir(bankPdfDir, { recursive: true });
    const filePath = path.join(bankPdfDir, filename);

    await fs.writeFile(filePath, response.data);

    // Create PDF record
    const pdf = new PDF({
      pdfId: `pdf_${timestamp}_${randomId}`,
      idrssd,
      originalFilename: source.title + '.pdf' || 'download.pdf',
      storedFilename: filename,
      fileSize: response.data.length,
      sourceId: source.sourceId,
      sourceUrl: source.url,
      uploadType: 'from_source',
      description: source.preview
    });

    await pdf.save();

    console.log(`[PDF Download from Source] Saved PDF: ${pdf.pdfId}`);

    res.json({
      success: true,
      pdf: {
        id: pdf.pdfId,
        filename: pdf.originalFilename,
        size: pdf.fileSize,
        uploadedAt: pdf.uploadedAt
      }
    });

  } catch (error) {
    console.error('[PDF Download from Source] Error:', error);
    res.status(500).json({
      error: 'Failed to download PDF',
      details: error.message
    });
  }
});

/**
 * POST /api/research/:idrssd/sources/:sourceId/upload-to-rag
 * Upload a source's PDF to RAG
 */
router.post('/:idrssd/sources/:sourceId/upload-to-rag', async (req, res) => {
  try {
    const { idrssd, sourceId } = req.params;

    const source = await Source.findOne({ sourceId });
    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    // Check if source has a documentType set
    if (!source.documentType) {
      return res.status(400).json({
        error: 'Document type not set. Please set a document type before uploading to RAG.'
      });
    }

    // Check if the source URL is a PDF
    if (!source.url.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({
        error: 'Source is not a PDF. Only PDFs can be uploaded to RAG.'
      });
    }

    // Check if already uploaded
    if (source.ragStatus === 'completed') {
      return res.status(400).json({
        error: 'Source already uploaded to RAG'
      });
    }

    console.log(`[Upload to RAG] Starting upload for source ${sourceId}`);

    // Mark as uploading
    await source.startRAGUpload();

    let pdf = null; // Declare outside try block so it's accessible in catch

    try {
      // Step 1: Download PDF if not already downloaded
      pdf = await PDF.findOne({ sourceId: source.sourceId });

      if (!pdf) {
        console.log(`[Upload to RAG] Downloading PDF from: ${source.url}`);

        const axios = require('axios');
        const response = await axios.get(source.url, {
          responseType: 'arraybuffer',
          timeout: 60000,
          maxContentLength: 50 * 1024 * 1024,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/pdf,*/*',
            'Referer': 'https://bankexplorer.app/',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache'
          }
        });

        // Save to disk
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(7);
        const filename = `${timestamp}_${randomId}.pdf`;
        const bankPdfDir = path.join(PDFS_DIR, idrssd);
        await fs.mkdir(bankPdfDir, { recursive: true });
        const filePath = path.join(bankPdfDir, filename);

        await fs.writeFile(filePath, response.data);

        // Create PDF record
        pdf = new PDF({
          pdfId: `pdf_${timestamp}_${randomId}`,
          idrssd,
          originalFilename: source.title + '.pdf' || 'download.pdf',
          storedFilename: filename,
          fileSize: response.data.length,
          sourceId: source.sourceId,
          sourceUrl: source.url,
          uploadType: 'from_source',
          description: source.preview,
          ragStatus: 'pending'
        });

        await pdf.save();
        console.log(`[Upload to RAG] Downloaded and saved PDF: ${pdf.pdfId}`);
      }

      // Step 2: Create GroundingDocument
      const GroundingDocument = require('../models/GroundingDocument');
      const groundingService = require('../services/groundingService');

      const groundingDoc = new GroundingDocument({
        filename: pdf.originalFilename,
        title: source.title || pdf.originalFilename,
        idrssd: idrssd,
        filePath: pdf.getFilePath(),
        fileSize: pdf.fileSize,
        topics: mapDocumentTypeToTopics(source.documentType),
        bankTypes: ['all'], // Can be refined based on bank size
        assetSizeRange: 'all',
        processingStatus: 'pending'
      });

      await groundingDoc.save();
      console.log(`[Upload to RAG] Created GroundingDocument: ${groundingDoc._id}`);

      // Step 3: Process document (chunk + embed)
      pdf.ragStatus = 'processing';
      await pdf.save();

      const result = await groundingService.processDocument(groundingDoc._id.toString());

      if (result.success) {
        // Update source
        await source.completeRAGUpload(groundingDoc._id);

        // Update PDF
        pdf.ragStatus = 'completed';
        pdf.ragProcessedAt = new Date();
        pdf.ragChunkCount = result.chunkCount;
        pdf.ragDocumentId = groundingDoc._id;
        await pdf.save();

        console.log(`[Upload to RAG] Successfully processed: ${result.chunkCount} chunks`);

        res.json({
          success: true,
          documentId: groundingDoc._id,
          chunkCount: result.chunkCount,
          pdfId: pdf.pdfId
        });
      } else {
        throw new Error(result.error || 'Failed to process document');
      }

    } catch (processError) {
      console.error('[Upload to RAG] Processing error:', processError);

      // Mark as failed
      await source.failRAGUpload(processError.message);

      if (pdf) {
        pdf.ragStatus = 'failed';
        pdf.ragError = processError.message;
        await pdf.save();
      }

      throw processError;
    }

  } catch (error) {
    console.error('[Upload to RAG] Error:', error);
    res.status(500).json({
      error: 'Failed to upload to RAG',
      details: error.message
    });
  }
});

/**
 * POST /api/research/:idrssd/pdfs/:pdfId/upload-to-rag
 * Upload a PDF to RAG
 */
router.post('/:idrssd/pdfs/:pdfId/upload-to-rag', async (req, res) => {
  try {
    const { idrssd, pdfId } = req.params;

    const pdf = await PDF.findOne({ pdfId });
    if (!pdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    // Check if already uploaded
    if (pdf.ragStatus === 'completed') {
      return res.status(400).json({
        error: 'PDF already uploaded to RAG'
      });
    }

    console.log(`[Upload PDF to RAG] Starting upload for PDF ${pdfId}`);

    // Step 1: Create GroundingDocument
    const GroundingDocument = require('../models/GroundingDocument');
    const groundingService = require('../services/groundingService');

    const groundingDoc = new GroundingDocument({
      filename: pdf.originalFilename,
      title: pdf.originalFilename.replace('.pdf', ''),
      idrssd: idrssd,
      filePath: pdf.getFilePath(),
      fileSize: pdf.fileSize,
      topics: ['general'], // Default topic, can be refined
      bankTypes: ['all'],
      assetSizeRange: 'all',
      processingStatus: 'pending'
    });

    await groundingDoc.save();
    console.log(`[Upload PDF to RAG] Created GroundingDocument: ${groundingDoc._id}`);

    // Step 2: Process document (chunk + embed)
    pdf.ragStatus = 'processing';
    await pdf.save();

    try {
      const result = await groundingService.processDocument(groundingDoc._id.toString());

      if (result.success) {
        // Update PDF
        pdf.ragStatus = 'completed';
        pdf.ragProcessedAt = new Date();
        pdf.ragChunkCount = result.chunkCount;
        pdf.ragDocumentId = groundingDoc._id;
        await pdf.save();

        // Update source if linked
        if (pdf.sourceId) {
          const source = await Source.findOne({ sourceId: pdf.sourceId });
          if (source) {
            await source.completeRAGUpload(groundingDoc._id);
          }
        }

        console.log(`[Upload PDF to RAG] Successfully processed: ${result.chunkCount} chunks`);

        res.json({
          success: true,
          documentId: groundingDoc._id,
          chunkCount: result.chunkCount
        });
      } else {
        throw new Error(result.error || 'Failed to process document');
      }

    } catch (processError) {
      console.error('[Upload PDF to RAG] Processing error:', processError);

      pdf.ragStatus = 'failed';
      pdf.ragError = processError.message;
      await pdf.save();

      throw processError;
    }

  } catch (error) {
    console.error('[Upload PDF to RAG] Error:', error);
    res.status(500).json({
      error: 'Failed to upload PDF to RAG',
      details: error.message
    });
  }
});

/**
 * POST /api/research/:idrssd/sources/:sourceId/set-document-type
 * Set document type for a source
 */
router.post('/:idrssd/sources/:sourceId/set-document-type', async (req, res) => {
  try {
    const { idrssd, sourceId } = req.params;
    const { documentType } = req.body;

    if (!documentType) {
      return res.status(400).json({ error: 'documentType is required' });
    }

    const source = await Source.findOne({ sourceId });
    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    await source.setDocumentType(documentType);
    console.log(`[Set Document Type] Updated source ${sourceId} to type: ${documentType}`);

    res.json({
      success: true,
      message: 'Document type set successfully'
    });

  } catch (error) {
    console.error('[Set Document Type] Error:', error);
    res.status(500).json({
      error: 'Failed to set document type',
      details: error.message
    });
  }
});

/**
 * POST /api/research/:idrssd/pdfs/:pdfId/set-document-type
 * Set document type for a PDF
 */
router.post('/:idrssd/pdfs/:pdfId/set-document-type', async (req, res) => {
  try {
    const { idrssd, pdfId } = req.params;
    const { documentType } = req.body;

    if (!documentType) {
      return res.status(400).json({ error: 'documentType is required' });
    }

    const pdf = await PDF.findOne({ pdfId });
    if (!pdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    // Add documentType field to PDF (it's stored in source, but we can track it here too)
    // Actually, looking at the models, PDF doesn't have documentType but Source does
    // So if this PDF is linked to a source, update the source's documentType

    if (pdf.sourceId) {
      const source = await Source.findOne({ sourceId: pdf.sourceId });
      if (source) {
        await source.setDocumentType(documentType);
        console.log(`[Set Document Type] Updated source ${pdf.sourceId} to type: ${documentType}`);
      }
    }

    res.json({
      success: true,
      message: 'Document type set successfully'
    });

  } catch (error) {
    console.error('[Set Document Type] Error:', error);
    res.status(500).json({
      error: 'Failed to set document type',
      details: error.message
    });
  }
});

/**
 * GET /api/research/:idrssd/rag-stats
 * Get RAG statistics for a bank (number of documents, chunks, etc.)
 */
router.get('/:idrssd/rag-stats', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const GroundingDocument = require('../models/GroundingDocument');
    const GroundingChunk = require('../models/GroundingChunk');

    // Count documents for this bank
    const documentCount = await GroundingDocument.countDocuments({ idrssd });

    // Count chunks for this bank
    const chunkCount = await GroundingChunk.countDocuments({ idrssd });

    // Get document details
    const documents = await GroundingDocument.find({ idrssd })
      .select('title filename topics processingStatus createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      stats: {
        documentCount,
        chunkCount,
        documents
      }
    });
  } catch (error) {
    console.error('[RAG Stats] Error:', error);
    res.status(500).json({
      error: 'Failed to get RAG stats',
      details: error.message
    });
  }
});

/**
 * GET /api/research/:idrssd/metadata
 * Get comprehensive metadata for a bank including strategic insights
 */
router.get('/:idrssd/metadata', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const Institution = require('../models/Institution');
    const BankMetadata = require('../models/BankMetadata');

    const institution = await Institution.findOne({ idrssd });

    if (!institution) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    // Get or create BankMetadata document
    const bankMetadata = await BankMetadata.findOne({ idrssd });

    // Merge institution data with bank metadata
    const metadata = {
      idrssd: institution.idrssd,
      name: institution.name,
      city: institution.city,
      state: institution.state,
      charter: institution.charter,
      address: institution.address,
      zip: institution.zip
    };

    // Add BankMetadata fields if they exist
    if (bankMetadata) {
      metadata.logo = bankMetadata.logo;
      metadata.ticker = bankMetadata.ticker;
      metadata.orgChart = bankMetadata.orgChart;
      metadata.strategicInsights = bankMetadata.strategicInsights;
      metadata.researchPhases = bankMetadata.researchPhases;
    }

    console.log(`[Metadata] Returning metadata for ${institution.name}:`);
    console.log(`  - Logo: ${metadata.logo?.localPath ? 'Yes' : 'No'}`);
    console.log(`  - Ticker: ${metadata.ticker?.symbol || 'No'}`);
    console.log(`  - Org Chart: ${metadata.orgChart ? 'Yes' : 'No'}`);
    console.log(`  - Strategic Insights Status: ${metadata.strategicInsights?.status || 'not_extracted'}`);
    if (metadata.strategicInsights?.status === 'completed') {
      console.log(`    - Priorities: ${metadata.strategicInsights.priorities?.length || 0}`);
      console.log(`    - Focus Metrics: ${metadata.strategicInsights.focusMetrics?.length || 0}`);
      console.log(`    - Tech Partnerships: ${metadata.strategicInsights.techPartnerships?.length || 0}`);
    }

    res.json({
      success: true,
      metadata
    });
  } catch (error) {
    console.error('[Metadata] Error:', error);
    res.status(500).json({
      error: 'Failed to get metadata',
      details: error.message
    });
  }
});

/**
 * GET /api/research/:idrssd/status
 * Get research workflow phase status for a bank (lightweight endpoint for list views)
 */
router.get('/:idrssd/status', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const BankMetadata = require('../models/BankMetadata');

    const bankMetadata = await BankMetadata.findOne({ idrssd });

    // Use the model method for consistent status logic across the app
    const status = bankMetadata
      ? bankMetadata.getResearchStatus()
      : {
          phase1: 'not_started',
          phase2: 'not_started',
          phase3: 'not_started',
          phase4: 'not_started'
        };

    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('[Status] Error:', error);
    res.status(500).json({
      error: 'Failed to get status',
      details: error.message
    });
  }
});

/**
 * GET /api/research/:idrssd/history
 * Get history of research reports for a bank
 */
router.get('/:idrssd/history', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const ResearchReport = require('../models/ResearchReport');

    // Query MongoDB ResearchReport collection
    const reports = await ResearchReport.find({ idrssd })
      .sort({ createdAt: -1 })
      .select('reportData.generatedAt reportData.method reportData.model reportData.bankName createdAt')
      .lean();

    console.log(`[History] Found ${reports.length} reports for bank ${idrssd}`);

    // Format history entries
    const history = reports.map(report => ({
      timestamp: new Date(report.createdAt).getTime(),
      generatedAt: report.reportData?.generatedAt || report.createdAt.toISOString(),
      method: report.reportData?.method || 'agent-based',
      model: report.reportData?.model || 'unknown',
      hasAnalysis: !!report.reportData?.analysis,
      bankName: report.reportData?.bankName
    }));

    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('[History] Error:', error);
    res.status(500).json({
      error: 'Failed to get history',
      details: error.message
    });
  }
});

/**
 * GET /api/research/:idrssd/document-checklist
 * Get document checklist for RAG pipeline
 */
router.get('/:idrssd/document-checklist', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const Source = require('../models/Source');

    const checklist = await Source.getDocumentChecklist(idrssd);

    res.json({
      success: true,
      checklist
    });
  } catch (error) {
    console.error('[Document Checklist] Error:', error);
    res.status(500).json({
      error: 'Failed to get document checklist',
      details: error.message
    });
  }
});

/**
 * GET /api/research/:idrssd/status-stream
 * SSE endpoint for status updates
 */
router.get('/:idrssd/status-stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

/**
 * POST /api/research/:idrssd/refresh-rag
 * Refresh RAG system
 */
router.post('/:idrssd/refresh-rag', async (req, res) => {
  try {
    // TODO: Implement RAG refresh logic
    res.json({
      success: true,
      message: 'RAG refresh initiated'
    });
  } catch (error) {
    console.error('[Refresh RAG] Error:', error);
    res.status(500).json({
      error: 'Failed to refresh RAG',
      details: error.message
    });
  }
});

/**
 * POST /api/research/:idrssd/delete-insights
 * Delete extracted insights
 */
router.post('/:idrssd/delete-insights', async (req, res) => {
  try {
    // TODO: Implement insights deletion
    res.json({
      success: true,
      message: 'Insights deleted'
    });
  } catch (error) {
    console.error('[Delete Insights] Error:', error);
    res.status(500).json({
      error: 'Failed to delete insights',
      details: error.message
    });
  }
});

/**
 * GET /api/research/:idrssd/extract-insights
 * SSE endpoint for extracting insights
 */
router.get('/:idrssd/extract-insights', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const { idrssd } = req.params;

  const sendEvent = (type, data) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    console.log(`\n[Extract Insights] Starting for bank ${idrssd}`);
    sendEvent('status', { message: 'Starting insight extraction...', progress: 0 });

    // Get or create bank metadata
    const BankMetadata = require('../models/BankMetadata');
    const Institution = require('../models/Institution');
    const GroundingDocument = require('../models/GroundingDocument');

    const institution = await Institution.findOne({ idrssd });
    if (!institution) {
      throw new Error(`Institution ${idrssd} not found`);
    }

    console.log(`[Extract Insights] Found institution: ${institution.name}`);
    const metadata = await BankMetadata.getOrCreate(idrssd, institution.name);
    await metadata.startInsightExtraction();
    await metadata.updateResearchPhase('phase3', 'in_progress');

    console.log('[Extract Insights] Checking RAG documents...');
    sendEvent('status', { message: 'Checking RAG documents...', progress: 10 });

    // Check if there are any documents in RAG
    const documentCount = await GroundingDocument.countDocuments({ idrssd });
    if (documentCount === 0) {
      throw new Error('No documents found in RAG. Please upload documents first.');
    }

    console.log(`[Extract Insights] Found ${documentCount} documents in RAG`);
    sendEvent('status', { message: `Found ${documentCount} documents in RAG`, progress: 20 });

    // Get all documents for this bank
    const documents = await GroundingDocument.find({ idrssd })
      .select('title filename topics')
      .lean();

    console.log('[Extract Insights] Querying RAG for strategic priorities...');
    sendEvent('status', { message: 'Querying RAG for strategic priorities...', progress: 30 });

    // Query RAG for strategic priorities using groundingService
    const groundingService = require('../services/groundingService');
    const priorityChunks = await groundingService.retrieveChunks(
      `What are the top strategic priorities mentioned by executives and management? Include digital transformation, technology initiatives, and growth strategies.`,
      { idrssd },
      10
    );
    console.log(`[Extract Insights] Retrieved ${priorityChunks.length} priority chunks`);

    console.log('[Extract Insights] Querying RAG for focus metrics...');
    sendEvent('status', { message: 'Querying RAG for focus metrics...', progress: 50 });

    // Query for focus metrics
    const metricsChunks = await groundingService.retrieveChunks(
      `What key performance metrics, KPIs, and financial metrics are emphasized by management and analysts? Include efficiency metrics, profitability metrics, and growth metrics.`,
      { idrssd },
      10
    );
    console.log(`[Extract Insights] Retrieved ${metricsChunks.length} metrics chunks`);

    console.log('[Extract Insights] Querying RAG for technology partnerships...');
    sendEvent('status', { message: 'Querying RAG for technology partnerships...', progress: 70 });

    // Query for tech partnerships
    const techChunks = await groundingService.retrieveChunks(
      `What technology partnerships, fintech collaborations, and vendor relationships are mentioned? Include AI initiatives, cloud partnerships, and digital banking platforms.`,
      { idrssd },
      10
    );
    console.log(`[Extract Insights] Retrieved ${techChunks.length} tech partnership chunks`);

    console.log('[Extract Insights] Analyzing results with Claude...');
    sendEvent('status', { message: 'Analyzing results with Claude...', progress: 80 });

    // Use Claude to analyze and structure the insights
    const ClaudeService = require('../services/claudeService');
    const claudeService = new ClaudeService();
    const analysisPrompt = `Analyze the following information extracted from bank documents and create structured insights.

STRATEGIC PRIORITIES CONTEXT:
${priorityChunks.map((c, i) => `[${i + 1}] From "${c.documentTitle}" (page ${c.pageNumber}): ${c.content}`).join('\n\n')}

FOCUS METRICS CONTEXT:
${metricsChunks.map((c, i) => `[${i + 1}] From "${c.documentTitle}" (page ${c.pageNumber}): ${c.content}`).join('\n\n')}

TECHNOLOGY PARTNERSHIPS CONTEXT:
${techChunks.map((c, i) => `[${i + 1}] From "${c.documentTitle}" (page ${c.pageNumber}): ${c.content}`).join('\n\n')}

Extract and structure the following insights in JSON format:

{
  "priorities": [
    {
      "title": "Brief priority title",
      "description": "Detailed description of this strategic priority",
      "citations": [
        {
          "documentTitle": "Document name",
          "citedText": "Exact quote from document",
          "pageNumber": page_number
        }
      ],
      "methodology": "How this priority was determined"
    }
  ],
  "focusMetrics": [
    {
      "metric": "Metric name (e.g., 'Efficiency Ratio', 'ROE')",
      "commentary": "Management or analyst commentary about this metric",
      "citations": [
        {
          "documentTitle": "Document name",
          "citedText": "Exact quote",
          "pageNumber": page_number
        }
      ],
      "methodology": "How this was identified"
    }
  ],
  "techPartnerships": [
    {
      "partner": "Partner name",
      "description": "Description of partnership",
      "announcedDate": "When announced",
      "citations": [
        {
          "documentTitle": "Document name",
          "citedText": "Exact quote",
          "pageNumber": page_number
        }
      ],
      "methodology": "How this was found"
    }
  ]
}

Only include items that are explicitly mentioned in the context. Use exact quotes for citations. Return ONLY the JSON object, no additional text or markdown.`;

    console.log('[Extract Insights] Calling Claude API...');
    const response = await claudeService.sendMessage(
      [{ role: 'user', content: analysisPrompt }],
      {
        temperature: 0.3,
        max_tokens: 4000
      }
    );

    const analysis = response.content[0].text;
    console.log(`[Extract Insights] Received response from Claude (${analysis.length} chars)`);

    // Parse the JSON response
    let insights;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = analysis.match(/```json\s*([\s\S]*?)\s*```/) || analysis.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : analysis;
      insights = JSON.parse(jsonStr);
      console.log('[Extract Insights] Successfully parsed insights JSON');
      console.log(`  - Priorities: ${insights.priorities?.length || 0}`);
      console.log(`  - Focus Metrics: ${insights.focusMetrics?.length || 0}`);
      console.log(`  - Tech Partnerships: ${insights.techPartnerships?.length || 0}`);
    } catch (parseError) {
      console.error('[Extract Insights] Failed to parse Claude response:', parseError);
      console.error('[Extract Insights] JSON string length:', (jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : analysis).length);
      console.error('[Extract Insights] Error position:', parseError.message);

      // Log more context around the error
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : analysis;
      const errorPosition = parseError.message.match(/position (\d+)/);
      if (errorPosition) {
        const pos = parseInt(errorPosition[1]);
        const contextStart = Math.max(0, pos - 200);
        const contextEnd = Math.min(jsonStr.length, pos + 200);
        console.error('[Extract Insights] Context around error:');
        console.error(jsonStr.substring(contextStart, contextEnd));
      }

      // Save the full response to a file for debugging
      const fs = require('fs').promises;
      const debugPath = `/tmp/insights-parse-error-${idrssd}-${Date.now()}.txt`;
      await fs.writeFile(debugPath, analysis);
      console.error(`[Extract Insights] Full response saved to: ${debugPath}`);

      throw new Error(`Failed to parse insights from AI response: ${parseError.message}`);
    }

    console.log('[Extract Insights] Saving insights to database...');
    sendEvent('status', { message: 'Saving insights...', progress: 90 });

    // Update metadata with insights
    await metadata.updateStrategicInsights({
      priorities: insights.priorities || [],
      focusMetrics: insights.focusMetrics || [],
      techPartnerships: insights.techPartnerships || [],
      source: `RAG analysis of ${documentCount} documents`,
      extractionMethodology: `Analyzed ${documentCount} documents using Claude with RAG retrieval. Extracted strategic information from investor presentations, earnings transcripts, and other documents.`
    });

    // Mark phase 3 as completed
    await metadata.updateResearchPhase('phase3', 'completed', {
      insightsExtracted: true
    });

    console.log('[Extract Insights] ✅ Insight extraction complete!');
    sendEvent('status', { message: 'Insight extraction complete!', progress: 100 });
    sendEvent('complete', {
      insights: {
        priorities: insights.priorities || [],
        focusMetrics: insights.focusMetrics || [],
        techPartnerships: insights.techPartnerships || []
      }
    });

    res.end();

  } catch (error) {
    console.error('[Extract Insights] Error:', error);

    // Update metadata to failed
    try {
      const BankMetadata = require('../models/BankMetadata');
      const metadata = await BankMetadata.findOne({ idrssd });
      if (metadata) {
        await metadata.failInsightExtraction(error.message);
        await metadata.updateResearchPhase('phase3', 'failed', {
          error: error.message
        });
      }
    } catch (updateError) {
      console.error('[Extract Insights] Failed to update error status:', updateError);
    }

    sendEvent('error', { message: error.message });
    res.end();
  }
});

/**
 * GET /api/research/:idrssd/gather-metadata
 * SSE endpoint for gathering metadata
 */
router.get('/:idrssd/gather-metadata', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    const { idrssd } = req.params;

    // Get bank info
    const bank = await Institution.findOne({ idrssd });
    if (!bank) {
      sendEvent('error', { message: 'Bank not found' });
      return res.end();
    }

    sendEvent('started', { message: 'Starting metadata gathering' });
    sendEvent('progress', { step: 0, total: 3, message: 'Initializing...' });

    const metadata = await BankMetadata.getOrCreate(idrssd, bank.name);
    const metadataResults = {
      logo: false,
      ticker: false,
      orgChart: false
    };

    // 1. Gather Logo
    try {
      sendEvent('progress', { step: 1, total: 3, message: 'Gathering logo...' });
      const { findLogoForBank } = require('../scripts/cli/findLogos');
      const logoResult = await findLogoForBank({
        idrssd: bank.idrssd,
        name: bank.name,
        city: bank.city,
        state: bank.state,
        totalAssets: 0
      });

      if (logoResult && logoResult.success && !logoResult.existing) {
        metadataResults.logo = true;
        sendEvent('logo-complete', { success: true, message: 'Logo found and saved' });
      } else if (logoResult && logoResult.existing) {
        metadataResults.logo = true;
        sendEvent('logo-complete', { success: true, message: 'Logo already exists' });
      } else {
        sendEvent('logo-complete', { success: false, message: 'Logo not found' });
      }
    } catch (logoError) {
      console.error(`[Metadata] Error gathering logo:`, logoError.message);
      sendEvent('logo-complete', { success: false, message: 'Error gathering logo', error: logoError.message });
    }

    // 2. Gather Ticker Symbol
    try {
      sendEvent('progress', { step: 2, total: 3, message: 'Gathering ticker symbol...' });
      const tickerPrompt = `Find the stock ticker symbol for "${bank.name}". Return ONLY a JSON object:
{
  "symbol": "TICKER",
  "exchange": "NYSE" or "NASDAQ" or other exchange,
  "found": true or false
}`;

      const tickerResponse = await claudeService.sendMessage([{
        role: 'user',
        content: tickerPrompt
      }], {
        temperature: 0.3,
        model: 'claude-sonnet-4-5-20250929',
        tools: [{ type: 'web_search_20250305', name: 'web_search' }]
      });

      const tickerText = tickerResponse.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
      const tickerMatch = tickerText.match(/\{[\s\S]*\}/);
      if (tickerMatch) {
        const tickerData = JSON.parse(tickerMatch[0]);
        if (tickerData.found && tickerData.symbol) {
          await metadata.updateTicker({
            symbol: tickerData.symbol,
            exchange: tickerData.exchange,
            isPubliclyTraded: true  // Enable stock widget display
          });
          metadataResults.ticker = true;
          sendEvent('ticker-complete', {
            success: true,
            message: `Ticker found: ${tickerData.symbol}`,
            symbol: tickerData.symbol,
            exchange: tickerData.exchange
          });
        } else {
          sendEvent('ticker-complete', { success: false, message: 'Ticker not found' });
        }
      } else {
        sendEvent('ticker-complete', { success: false, message: 'Failed to parse ticker response' });
      }
    } catch (tickerError) {
      console.error(`[Metadata] Error gathering ticker:`, tickerError.message);
      sendEvent('ticker-complete', { success: false, message: 'Error gathering ticker', error: tickerError.message });
    }

    // 3. Gather Org Chart
    try {
      sendEvent('progress', { step: 3, total: 3, message: 'Gathering organizational chart...' });
      const orgChartPrompt = `Find the executive leadership team and board of directors for "${bank.name}". Return ONLY a JSON object:
{
  "executives": [
    {
      "name": "Full Name",
      "title": "CEO" or other title,
      "photoUrl": "URL to headshot if available"
    }
  ],
  "boardMembers": [
    {
      "name": "Full Name",
      "role": "Chairman" or "Director"
    }
  ],
  "found": true or false
}`;

      const orgChartResponse = await claudeService.sendMessage([{
        role: 'user',
        content: orgChartPrompt
      }], {
        temperature: 0.3,
        model: 'claude-sonnet-4-5-20250929',
        tools: [{ type: 'web_search_20250305', name: 'web_search' }]
      });

      const orgChartText = orgChartResponse.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
      const orgChartMatch = orgChartText.match(/\{[\s\S]*\}/);
      if (orgChartMatch) {
        const orgChartData = JSON.parse(orgChartMatch[0]);
        if (orgChartData.found && (orgChartData.executives?.length > 0 || orgChartData.boardMembers?.length > 0)) {
          await metadata.updateOrgChart({
            executives: orgChartData.executives || [],
            boardMembers: orgChartData.boardMembers || []
          });
          metadataResults.orgChart = true;
          sendEvent('orgchart-complete', {
            success: true,
            message: `Org chart found: ${orgChartData.executives?.length || 0} executives, ${orgChartData.boardMembers?.length || 0} board members`,
            executives: orgChartData.executives?.length || 0,
            boardMembers: orgChartData.boardMembers?.length || 0
          });
        } else {
          sendEvent('orgchart-complete', { success: false, message: 'Org chart not found' });
        }
      } else {
        sendEvent('orgchart-complete', { success: false, message: 'Failed to parse org chart response' });
      }
    } catch (orgChartError) {
      console.error(`[Metadata] Error gathering org chart:`, orgChartError.message);
      sendEvent('orgchart-complete', { success: false, message: 'Error gathering org chart', error: orgChartError.message });
    }

    sendEvent('completed', {
      message: 'Metadata gathering complete',
      results: metadataResults
    });
    res.end();

  } catch (error) {
    console.error('[Metadata] Error in gather-metadata:', error);
    sendEvent('error', { message: 'Failed to gather metadata', error: error.message });
    res.end();
  }
});

/**
 * GET /api/research/:idrssd/report/:timestamp
 * Get a specific research report from MongoDB
 */
router.get('/:idrssd/report/:timestamp', async (req, res) => {
  try {
    const { idrssd, timestamp } = req.params;
    const ResearchReport = require('../models/ResearchReport');

    console.log(`[Get Report] Querying MongoDB for bank ${idrssd}, timestamp ${timestamp}`);

    // Query MongoDB ResearchReport collection by timestamp (createdAt)
    const report = await ResearchReport.findOne({
      idrssd,
      createdAt: new Date(parseInt(timestamp))
    }).lean();

    if (!report) {
      console.log(`[Get Report] Report not found for bank ${idrssd} at timestamp ${timestamp}`);
      return res.status(404).json({
        success: false,
        error: 'Report not found',
        details: `No report exists for bank ${idrssd} at timestamp ${timestamp}`
      });
    }

    console.log(`[Get Report] Loaded report for bank ${idrssd}, timestamp ${timestamp}`);

    res.json({
      success: true,
      report: report.reportData
    });
  } catch (error) {
    console.error('[Get Report] Error:', error);
    res.status(500).json({
      error: 'Failed to get report',
      details: error.message
    });
  }
});

/**
 * GET /api/research/:idrssd/podcast/for-report/:reportTimestamp
 * Get podcast for a specific report
 */
router.get('/:idrssd/podcast/for-report/:reportTimestamp', async (req, res) => {
  try {
    // TODO: Implement podcast retrieval by report
    res.json({
      success: true,
      podcast: null
    });
  } catch (error) {
    console.error('[Get Podcast for Report] Error:', error);
    res.status(500).json({
      error: 'Failed to get podcast',
      details: error.message
    });
  }
});

/**
 * GET /api/research/:idrssd/pdfs/:pdfId/view
 * View/serve a PDF file
 */
router.get('/:idrssd/pdfs/:pdfId/view', async (req, res) => {
  try {
    const { idrssd, pdfId } = req.params;
    const PDF = require('../models/PDF');
    const pdf = await PDF.findOne({ pdfId });

    if (!pdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    const filePath = pdf.getFilePath();
    res.sendFile(filePath);
  } catch (error) {
    console.error('[View PDF] Error:', error);
    res.status(500).json({
      error: 'Failed to view PDF',
      details: error.message
    });
  }
});

/**
 * POST /api/research/:idrssd/pdfs/:pdfId/reprocess
 * Reprocess a PDF file
 */
router.post('/:idrssd/pdfs/:pdfId/reprocess', async (req, res) => {
  try {
    // TODO: Implement PDF reprocessing
    res.json({
      success: true,
      message: 'PDF reprocessing initiated'
    });
  } catch (error) {
    console.error('[Reprocess PDF] Error:', error);
    res.status(500).json({
      error: 'Failed to reprocess PDF',
      details: error.message
    });
  }
});

/**
 * GET /api/research/:idrssd/logo
 * Get bank full logo from GridFS (variant: 'logo')
 */
router.get('/:idrssd/logo', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const BankLogo = require('../models/BankLogo');

    // Find full logo variant
    const logo = await BankLogo.getForBank(idrssd, 'logo');

    if (!logo) {
      return res.status(404).json({ error: 'Logo not found' });
    }

    // Set content type header
    res.setHeader('Content-Type', logo.contentType || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day

    // Stream logo from GridFS
    const readStream = logo.getReadStream();
    readStream.pipe(res);

    readStream.on('error', (err) => {
      console.error('[Get Logo] Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream logo' });
      }
    });

  } catch (error) {
    console.error('[Get Logo] Error:', error);
    res.status(500).json({
      error: 'Failed to get logo',
      details: error.message
    });
  }
});

/**
 * GET /api/research/:idrssd/logo-symbol
 * Get bank symbol logo from GridFS (variant: 'symbol')
 * Falls back to icon, then full logo if symbol not available
 */
router.get('/:idrssd/logo-symbol', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const BankLogo = require('../models/BankLogo');

    // Try to find symbol logo first
    let logo = await BankLogo.getForBank(idrssd, 'symbol');

    // Fall back to icon if symbol not found
    if (!logo) {
      logo = await BankLogo.getForBank(idrssd, 'icon');
    }

    // Fall back to full logo if neither symbol nor icon found
    if (!logo) {
      logo = await BankLogo.getForBank(idrssd, 'logo');
    }

    if (!logo) {
      return res.status(404).json({ error: 'Logo not found' });
    }

    // Set content type header
    res.setHeader('Content-Type', logo.contentType || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day

    // Stream logo from GridFS
    const readStream = logo.getReadStream();
    readStream.pipe(res);

    readStream.on('error', (err) => {
      console.error('[Get Logo Symbol] Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream logo' });
      }
    });

  } catch (error) {
    console.error('[Get Logo Symbol] Error:', error);
    res.status(500).json({
      error: 'Failed to get logo symbol',
      details: error.message
    });
  }
});

/**
 * GET /api/research/:idrssd/logo-icon
 * Get bank icon logo from GridFS (variant: 'icon')
 * Falls back to symbol, then full logo if icon not available
 */
router.get('/:idrssd/logo-icon', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const BankLogo = require('../models/BankLogo');

    // Try to find icon logo first
    let logo = await BankLogo.getForBank(idrssd, 'icon');

    // Fall back to symbol if icon not found
    if (!logo) {
      logo = await BankLogo.getForBank(idrssd, 'symbol');
    }

    // Fall back to full logo if neither icon nor symbol found
    if (!logo) {
      logo = await BankLogo.getForBank(idrssd, 'logo');
    }

    if (!logo) {
      return res.status(404).json({ error: 'Logo not found' });
    }

    // Set content type header
    res.setHeader('Content-Type', logo.contentType || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day

    // Stream logo from GridFS
    const readStream = logo.getReadStream();
    readStream.pipe(res);

    readStream.on('error', (err) => {
      console.error('[Get Logo Icon] Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream logo' });
      }
    });

  } catch (error) {
    console.error('[Get Logo Icon] Error:', error);
    res.status(500).json({
      error: 'Failed to get logo icon',
      details: error.message
    });
  }
});

/**
 * POST /api/research/:idrssd/presentation/generate
 * Generate HTML presentation from research report (SSE stream)
 */
router.post('/:idrssd/presentation/generate', async (req, res) => {
  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendStatus = (stage, message) => {
    res.write(`data: ${JSON.stringify({ stage, message })}\n\n`);
  };

  // Heartbeat to prevent Heroku H15 idle connection timeout (55 seconds)
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
      if (res.socket && res.socket.writable) {
        res.socket.uncork();
      }
    } catch (err) {
      console.error('[Presentation Heartbeat] Error:', err.message);
      clearInterval(heartbeatInterval);
    }
  }, 30000); // 30 seconds

  req.on('close', () => {
    clearInterval(heartbeatInterval);
    console.log('[Presentation] Client disconnected, heartbeat stopped');
  });

  try {
    const { idrssd } = req.params;
    const { reportTimestamp } = req.body;

    console.log(`[Presentation] Generating for bank ${idrssd}, report timestamp: ${reportTimestamp}`);
    sendStatus('loading', 'Loading research report...');

    // Load report from MongoDB ResearchReport collection
    const ResearchReport = require('../models/ResearchReport');
    const report = await ResearchReport.findOne({
      idrssd,
      createdAt: new Date(parseInt(reportTimestamp))
    }).lean();

    if (!report) {
      sendStatus('error', `Report not found for bank ${idrssd} at timestamp ${reportTimestamp}`);
      clearInterval(heartbeatInterval);
      res.end();
      return;
    }

    const reportData = report.reportData;

    // Check if presentation already exists for this report (in GridFS)
    if (reportData.presentation && reportData.presentation.filename) {
      const exists = await fileExistsInGridFS(getDocumentBucket(), reportData.presentation.filename);
      if (exists) {
        console.log(`[Presentation] Using existing presentation: ${reportData.presentation.filename}`);
        sendStatus('complete', 'Presentation already exists');
        res.write(`data: ${JSON.stringify({
          stage: 'complete',
          presentation: {
            filename: reportData.presentation.filename,
            url: `/presentations/${idrssd}/${reportData.presentation.filename}`,
            timestamp: reportData.presentation.generatedAt,
            slideCount: reportData.presentation.slideCount
          }
        })}\n\n`);
        clearInterval(heartbeatInterval);
        res.end();
        return;
      } else {
        // File doesn't exist, continue with generation
        console.log(`[Presentation] Existing presentation file not found, generating new one`);
      }
    }

    // Mark phase4 as in_progress (phase4 = podcast/presentation outputs)
    try {
      const metadata = await BankMetadata.getOrCreate(idrssd, reportData.bankName);
      await metadata.updateResearchPhase('phase4', 'in_progress', {
        startedAt: new Date()
      });
      console.log(`[Presentation] Marked phase4 as in_progress for bank ${idrssd}`);
    } catch (phaseError) {
      console.error(`[Presentation] Warning: Failed to update phase status:`, phaseError.message);
    }

    // Generate presentation
    sendStatus('generating', 'Analyzing report and creating slides...');
    const presentationService = new PresentationService();
    const result = await presentationService.generatePresentation(idrssd, reportData);

    // Update report with presentation metadata in MongoDB
    sendStatus('saving', 'Saving presentation...');
    reportData.presentation = {
      filename: result.filename,
      generatedAt: new Date().toISOString(),
      slideCount: result.slideCount
    };

    // Save updated report back to MongoDB
    await ResearchReport.updateOne(
      { _id: report._id },
      { $set: { 'reportData.presentation': reportData.presentation } }
    );
    console.log(`[Presentation] Updated MongoDB report ${report._id} with presentation metadata`);

    // Mark phase4 as completed (phase4 = podcast/presentation outputs)
    try {
      const metadata = await BankMetadata.getOrCreate(idrssd, reportData.bankName);
      await metadata.updateResearchPhase('phase4', 'completed', {
        presentationFile: result.filename,
        presentationGenerated: true,
        completedAt: new Date()
      });
      console.log(`[Presentation] Marked phase4 as completed for bank ${idrssd}`);
    } catch (phaseError) {
      console.error(`[Presentation] Warning: Failed to update phase status:`, phaseError.message);
    }

    sendStatus('complete', 'Presentation generated successfully');
    res.write(`data: ${JSON.stringify({
      stage: 'complete',
      presentation: result
    })}\n\n`);

    clearInterval(heartbeatInterval);
    res.end();

  } catch (error) {
    console.error('[Presentation] Error generating presentation:', error.message);
    console.error('[Presentation] Stack:', error.stack);

    // Mark phase4 as failed (phase4 = podcast/presentation outputs)
    try {
      const { idrssd } = req.params;
      const metadata = await BankMetadata.getOrCreate(idrssd, null);
      await metadata.updateResearchPhase('phase4', 'failed', {
        error: error.message,
        failedAt: new Date()
      });
      console.log(`[Presentation] Marked phase4 as failed for bank ${idrssd}`);
    } catch (phaseError) {
      console.error(`[Presentation] Warning: Failed to update phase status:`, phaseError.message);
    }

    sendStatus('error', `Failed to generate presentation: ${error.message}`);
    clearInterval(heartbeatInterval);
    res.end();
  }
});

/**
 * GET /api/research/:idrssd/presentation/latest
 * Get latest presentation for a bank
 */
router.get('/:idrssd/presentation/latest', async (req, res) => {
  try {
    const { idrssd } = req.params;

    // Find latest report file from GridFS
    const files = await listFilesInGridFS(getDocumentBucket(), {
      filename: { $regex: `^${idrssd}_agent_.*\\.json$` }
    });
    const reportFiles = files
      .map(f => f.filename)
      .sort()
      .reverse();

    if (reportFiles.length === 0) {
      return res.json({ presentation: null });
    }

    // Check latest report for presentation
    const reportData = await loadJsonFromGridFS(getDocumentBucket(), reportFiles[0]);

    if (reportData.presentation && reportData.presentation.filename) {
      // Verify presentation file exists in GridFS
      const exists = await fileExistsInGridFS(getDocumentBucket(), reportData.presentation.filename);
      if (exists) {
        res.json({
          presentation: {
            filename: reportData.presentation.filename,
            url: `/presentations/${idrssd}/${reportData.presentation.filename}`,
            generatedAt: reportData.presentation.generatedAt,
            slideCount: reportData.presentation.slideCount
          }
        });
      } else {
        // Presentation file doesn't exist
        res.json({ presentation: null });
      }
    } else {
      res.json({ presentation: null });
    }

  } catch (error) {
    console.error('[Presentation] Error loading latest presentation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/research/:idrssd/presentation/:filename
 * Serve HTML presentation file (from GridFS getDocumentBucket())
 */
router.get('/:idrssd/presentation/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    // Check if file exists in GridFS
    const exists = await fileExistsInGridFS(getDocumentBucket(), filename);
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Presentation not found'
      });
    }

    // Read and return JSON presentation data from GridFS
    const presentationData = await loadJsonFromGridFS(getDocumentBucket(), filename);
    res.json(presentationData);

  } catch (error) {
    console.error('[Presentation] Error serving presentation:', error);
    res.status(404).json({
      success: false,
      error: 'Presentation not found'
    });
  }
});

/**
 * DELETE /api/research/:idrssd/presentation/:filename
 * Delete a presentation (from GridFS getDocumentBucket())
 */
router.delete('/:idrssd/presentation/:filename', async (req, res) => {
  try {
    const { idrssd, filename } = req.params;

    console.log(`[Presentation] Deleting presentation: ${filename}`);

    // Delete presentation file from GridFS (handle both .html and .json formats)
    try {
      await deleteFileFromGridFS(getDocumentBucket(), filename);
      console.log(`[Presentation] Deleted file: ${filename}`);
    } catch (deleteError) {
      // File might not exist or have different extension
      console.log(`[Presentation] File not found or already deleted: ${filename}`);

      // Try alternate format (HTML vs JSON)
      const baseFilename = filename.replace(/\.(html|json)$/, '');
      const alternateExt = filename.endsWith('.html') ? '.json' : '.html';
      const alternateFilename = baseFilename + alternateExt;

      try {
        await deleteFileFromGridFS(getDocumentBucket(), alternateFilename);
        console.log(`[Presentation] Deleted alternate format: ${alternateFilename}`);
      } catch (altError) {
        console.log(`[Presentation] Neither format found, continuing with metadata cleanup`);
      }
    }

    // Find and update report to remove presentation metadata
    const files = await listFilesInGridFS(getDocumentBucket(), {
      filename: { $regex: `^${idrssd}_agent_.*\\.json$` }
    });
    for (const file of files) {
      const reportData = await loadJsonFromGridFS(getDocumentBucket(), file.filename);

      // Check both exact match and base filename match (for format migration)
      const baseFilename = filename.replace(/\.(html|json)$/, '');
      const metadataFilename = reportData.presentation?.filename?.replace(/\.(html|json)$/, '');

      if (reportData.presentation && (
        reportData.presentation.filename === filename ||
        metadataFilename === baseFilename
      )) {
        delete reportData.presentation;
        await saveJsonToGridFS(getDocumentBucket(), file.filename, reportData, { idrssd, type: 'research', updated: true });
        console.log(`[Presentation] Removed presentation metadata from report: ${file.filename}`);
        break;
      }
    }

    res.json({
      success: true,
      message: 'Presentation deleted successfully'
    });

  } catch (error) {
    console.error('[Presentation] Error deleting presentation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/research/term-definition
 * Get definition of a banking term using Claude
 */
router.get('/term-definition', async (req, res) => {
  try {
    const { term } = req.query;

    if (!term) {
      return res.status(400).json({ error: 'Term parameter is required' });
    }

    console.log(`[Term Definition] Getting definition for: ${term}`);

    // Use a simple Claude call to get the definition
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Provide a clear, concise definition of the banking term "${term}" in 2-3 sentences. Focus on:
1. What it means
2. Why it's important in banking
3. How it's typically used or measured

Format your response as HTML with <p> tags.`
      }]
    });

    const definition = response.content[0].text;

    res.json({ term, definition });
  } catch (error) {
    console.error('[Term Definition] Error:', error);
    res.status(500).json({ error: 'Failed to get term definition' });
  }
});

/**
 * Helper: Map document type to RAG topics
 */
function mapDocumentTypeToTopics(documentType) {
  const mapping = {
    'investor_presentation': ['strategy', 'earnings', 'growth'],
    'management_interview': ['strategy', 'general'],
    'earnings_transcript': ['earnings', 'general'],
    'tech_announcement': ['technology', 'strategy'],
    'strategy_analysis': ['strategy', 'general'],
    'analyst_report': ['earnings', 'strategy', 'general'],
    'other': ['general']
  };
  return mapping[documentType] || ['general'];
}

// Directory for storing exported PDFs
const EXPORTED_PDFS_DIR = path.join(__dirname, '../data/research/exported-pdfs');

/**
 * GET /api/research/:idrssd/export-pdf
 * Export the latest research report as a professional PDF
 * Saves a copy locally and streams to browser
 */
router.get('/:idrssd/export-pdf', async (req, res) => {
  try {
    const { idrssd } = req.params;
    console.log(`[PDF Export] Starting PDF export for bank ${idrssd}`);

    // 1. Find the latest report for this bank from GridFS
    const files = await listFilesInGridFS(getDocumentBucket(), {
      filename: { $regex: `^${idrssd}_.*\\.json$` }
    });
    const bankReports = files.map(f => f.filename);

    if (bankReports.length === 0) {
      return res.status(404).json({ error: 'No research report found for this bank' });
    }

    // Sort by timestamp to get the most recent
    bankReports.sort((a, b) => {
      const partsA = a.replace('.json', '').split('_');
      const partsB = b.replace('.json', '').split('_');
      const timeA = parseInt(partsA[partsA.length - 1]);
      const timeB = parseInt(partsB[partsB.length - 1]);
      return timeB - timeA;
    });

    const reportData = await loadJsonFromGridFS(getDocumentBucket(), bankReports[0]);

    // 2. Get bank metadata for logo
    const metadata = await BankMetadata.findOne({ idrssd });
    let logoPath = null;
    if (metadata && metadata.branding && metadata.branding.symbolLogo) {
      logoPath = path.join(__dirname, '../data/logos', metadata.branding.symbolLogo);
      // Check if file exists
      try {
        await fs.access(logoPath);
      } catch {
        logoPath = null;
      }
    }

    // 3. Generate PDF using the enhanced PDF generator
    const { generateProfessionalPDF } = require('../utils/pdfGenerator');

    const pdfBuffer = await generateProfessionalPDF({
      markdown: reportData.analysis,
      title: `${reportData.bankName} Research Report`,
      bankName: reportData.bankName,
      bankLogoPath: logoPath,
      generatedAt: reportData.generatedAt,
      trendsData: reportData.trendsData,
      peerData: reportData.peerData
    });

    // 4. Save PDF locally
    const safeFilename = reportData.bankName.replace(/[^a-z0-9]/gi, '_');
    const timestamp = Date.now();
    const pdfFilename = `${idrssd}_${safeFilename}_${timestamp}.pdf`;

    // Ensure directory exists
    await fs.mkdir(EXPORTED_PDFS_DIR, { recursive: true });

    const localPdfPath = path.join(EXPORTED_PDFS_DIR, pdfFilename);
    await fs.writeFile(localPdfPath, pdfBuffer);
    console.log(`[PDF Export] Saved PDF locally: ${localPdfPath}`);

    // 5. Send PDF response to browser
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}_Research_Report.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('X-PDF-Local-Path', pdfFilename); // Include local filename in header
    res.send(pdfBuffer);

    console.log(`[PDF Export] Successfully exported PDF for ${reportData.bankName}`);

  } catch (error) {
    console.error('[PDF Export] Error:', error);
    res.status(500).json({ error: 'Failed to export PDF: ' + error.message });
  }
});

/**
 * GET /api/research/:idrssd/pdfs
 * List all exported PDFs for a bank
 */
router.get('/:idrssd/pdfs', async (req, res) => {
  try {
    const { idrssd } = req.params;

    // Ensure directory exists
    await fs.mkdir(EXPORTED_PDFS_DIR, { recursive: true });

    const files = await fs.readdir(EXPORTED_PDFS_DIR);
    const bankPdfs = files
      .filter(f => f.startsWith(`${idrssd}_`) && f.endsWith('.pdf'))
      .map(filename => {
        const parts = filename.replace('.pdf', '').split('_');
        const timestamp = parseInt(parts[parts.length - 1]);
        return {
          filename,
          timestamp,
          createdAt: new Date(timestamp).toISOString(),
          url: `/api/research/${idrssd}/pdfs/${filename}`
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp); // Most recent first

    res.json({
      count: bankPdfs.length,
      pdfs: bankPdfs
    });

  } catch (error) {
    console.error('[PDF List] Error:', error);
    res.status(500).json({ error: 'Failed to list PDFs: ' + error.message });
  }
});

/**
 * GET /api/research/:idrssd/pdfs/:filename
 * Download a specific saved PDF
 */
router.get('/:idrssd/pdfs/:filename', async (req, res) => {
  try {
    const { idrssd, filename } = req.params;

    // Validate filename belongs to this bank
    if (!filename.startsWith(`${idrssd}_`) || !filename.endsWith('.pdf')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const pdfPath = path.join(EXPORTED_PDFS_DIR, filename);

    try {
      await fs.access(pdfPath);
    } catch {
      return res.status(404).json({ error: 'PDF not found' });
    }

    const pdfBuffer = await fs.readFile(pdfPath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('[PDF Download] Error:', error);
    res.status(500).json({ error: 'Failed to download PDF: ' + error.message });
  }
});

module.exports = router;
