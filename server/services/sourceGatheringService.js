const Institution = require('../models/Institution');
const BankMetadata = require('../models/BankMetadata');
const Source = require('../models/Source');
const ClaudeService = require('./claudeService');

// Import helper functions from routes
// Note: In a future refactor, these could also be moved to a utilities file
const claudeService = new ClaudeService();

/**
 * Gather sources and metadata for a bank
 *
 * @param {string} idrssd - Bank IDRSSD
 * @param {object} options - Configuration options
 * @param {string} options.sessionId - Optional session ID
 * @param {array} options.categories - Categories to search (defaults to all 4)
 * @param {function} options.onProgress - Progress callback for SSE: (event) => {}
 *   event: { stage, message, category, ...data }
 * @param {object} options.helpers - Helper functions (required)
 *   - searchSourcesForCategory(bank, category)
 *   - rankAndRecommendSources(sources, category)
 *   - downloadAndUploadToRAG(source, idrssd)
 * @returns {Promise<object>} { success, sessionId, sourcesFound, sourcesByCategory, metadata, error }
 */
async function gatherSourcesForBank(idrssd, options = {}) {
  const {
    sessionId,
    categories = ['investorPresentation', 'earningsTranscript', 'strategyAnalysis', 'analystReports'],
    onProgress,
    helpers
  } = options;

  if (!helpers || !helpers.searchSourcesForCategory || !helpers.rankAndRecommendSources || !helpers.downloadAndUploadToRAG) {
    throw new Error('Helper functions (searchSourcesForCategory, rankAndRecommendSources, downloadAndUploadToRAG) are required');
  }

  const { searchSourcesForCategory, rankAndRecommendSources, downloadAndUploadToRAG } = helpers;

  // Helper to send progress updates
  const sendProgress = (stage, message, data = {}) => {
    if (onProgress) {
      onProgress({ stage, message, ...data });
    }
    console.log(`[Source Gathering] ${stage}: ${message}`);
  };

  try {
    // Get bank info
    const bank = await Institution.findOne({ idrssd });
    if (!bank) {
      throw new Error('Bank not found');
    }

    sendProgress('init', `Starting source gathering for ${bank.name}`, { bankName: bank.name });

    // Generate session ID if not provided
    const sid = sessionId || `session-${Date.now()}`;

    let totalSources = 0;
    const sourcesByCategory = {};
    const sourcesCollected = {}; // Collect before ranking

    // PHASE 1: Search and collect sources from all categories (don't save yet)
    for (const category of categories) {
      try {
        sendProgress('category_start', `Searching ${category}...`, { category });

        // Use Claude to search for sources in this category
        const sources = await searchSourcesForCategory(bank, category);
        sourcesCollected[category] = sources || [];

        sendProgress('category_complete', `${category}: Found ${sources.length} sources`, {
          category,
          foundCount: sources.length
        });

      } catch (error) {
        console.error(`[Source Gathering] Error searching for ${category}:`, error);
        sourcesCollected[category] = [];

        sendProgress('category_error', `Error in ${category}: ${error.message}`, {
          category,
          error: error.message
        });
      }
    }

    // PHASE 2: Rank globally and select top 5
    sendProgress('ranking', 'Ranking sources globally and selecting top 5...');

    const rankedByCategory = rankAndRecommendSources(sourcesCollected, null, {
      global: true,
      topN: 5,
      minScore: 60
    });

    // PHASE 3: Save all sources and auto-download only the top 5 recommended ones
    const downloadResults = {
      attempted: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0
    };

    const recommendedSources = [];

    for (const [category, rankedSources] of Object.entries(rankedByCategory)) {
      sourcesByCategory[category] = rankedSources.length;

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

        sendProgress('source_found', `Found: ${source.title}`, {
          category,
          source: {
            id: source.sourceId,
            title: source.title,
            url: source.url,
            recommended: source.recommended,
            score: source.score
          }
        });

        if (source.recommended) {
          recommendedSources.push(source);
        }
      }
    }

    // PHASE 4: Auto-download the top 5 recommended sources
    sendProgress('downloading', `Auto-downloading top ${recommendedSources.length} sources to RAG...`);

    for (const source of recommendedSources) {
      downloadResults.attempted++;
      console.log(`[Source Gathering] Auto-downloading recommended source: ${source.title}`);

      const downloadResult = await downloadAndUploadToRAG(source, idrssd);

      if (downloadResult.success) {
        downloadResults.succeeded++;
        console.log(`[Source Gathering] ✓ Auto-download succeeded: ${downloadResult.chunkCount} chunks`);
      } else if (downloadResult.skipped) {
        downloadResults.skipped++;
        console.log(`[Source Gathering] ⏭ Auto-download skipped: ${downloadResult.reason}`);
      } else {
        downloadResults.failed++;
        console.log(`[Source Gathering] ✗ Auto-download failed: ${downloadResult.error}`);
      }
    }

    sendProgress('sources_complete', `Completed source gathering: Top ${recommendedSources.length} of ${totalSources} sources selected and downloaded to RAG`, {
      totalSources,
      recommended: recommendedSources.length,
      sourcesByCategory,
      downloadResults
    });

    // Gather metadata (logo, ticker, org chart)
    sendProgress('metadata_start', 'Starting metadata gathering (logo, ticker, org chart)...');

    const metadata = await BankMetadata.getOrCreate(idrssd, bank.name);
    const metadataResults = {
      logo: false,
      ticker: false,
      orgChart: false
    };

    // 1. Gather Logo
    try {
      sendProgress('metadata_logo', 'Gathering logo...');
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
        sendProgress('metadata_logo_success', 'Logo found and saved');
      } else if (logoResult && logoResult.existing) {
        metadataResults.logo = true;
        sendProgress('metadata_logo_success', 'Logo already exists');
      } else {
        sendProgress('metadata_logo_failed', 'Logo not found');
      }
    } catch (logoError) {
      console.error(`[Source Gathering] Error gathering logo:`, logoError.message);
      sendProgress('metadata_logo_error', `Logo error: ${logoError.message}`);
    }

    // 2. Gather Ticker Symbol
    try {
      sendProgress('metadata_ticker', 'Gathering ticker symbol...');
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
            isPubliclyTraded: true
          });
          metadataResults.ticker = true;
          sendProgress('metadata_ticker_success', `Ticker found: ${tickerData.symbol} (${tickerData.exchange})`);
        }
      }
    } catch (tickerError) {
      console.error(`[Source Gathering] Error gathering ticker:`, tickerError.message);
      sendProgress('metadata_ticker_error', `Ticker error: ${tickerError.message}`);
    }

    // 3. Gather Org Chart
    try {
      sendProgress('metadata_orgchart', 'Gathering organizational chart...');
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
          sendProgress('metadata_orgchart_success', `Org chart found: ${orgChartData.executives?.length || 0} executives, ${orgChartData.boardMembers?.length || 0} board members`);
        }
      }
    } catch (orgChartError) {
      console.error(`[Source Gathering] Error gathering org chart:`, orgChartError.message);
      sendProgress('metadata_orgchart_error', `Org chart error: ${orgChartError.message}`);
    }

    sendProgress('complete', 'Source gathering complete', {
      totalSources,
      metadata: metadataResults
    });

    // Update Phase 1 status in BankMetadata
    try {
      await metadata.updatePhase('phase1', 'completed');
      console.log(`[Source Gathering] ✓ Marked Phase 1 as completed in BankMetadata`);
    } catch (phaseError) {
      console.error(`[Source Gathering] Warning: Failed to update phase status:`, phaseError.message);
    }

    return {
      success: true,
      sessionId: sid,
      sourcesFound: totalSources,
      sourcesByCategory,
      metadata: metadataResults,
      bank: {
        idrssd: bank.idrssd,
        name: bank.name
      }
    };

  } catch (error) {
    console.error('[Source Gathering Service] Error:', error);
    sendProgress('error', `Error: ${error.message}`);

    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  gatherSourcesForBank
};
