const Anthropic = require('@anthropic-ai/sdk');
const prompts = require('../prompts/bankAnalysis');

/**
 * Service for interacting with Claude API
 * Handles bank financial analysis with extended thinking and web search
 * Includes retry logic and error handling
 */
class ClaudeService {
  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.error('ERROR: ANTHROPIC_API_KEY is not set in environment variables');
      console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('ANTHROPIC')));
    } else {
      console.log('API Key loaded successfully (first 20 chars):', apiKey.substring(0, 20));
    }

    this.client = new Anthropic({
      apiKey: apiKey,
      timeout: 300000, // 5 minutes (300,000ms) - increased from default 60s
      maxRetries: 0 // Disable SDK's built-in retries, we handle our own
    });
    this.model = 'claude-sonnet-4-20250514'; // Latest Sonnet with extended thinking

    // Retry configuration
    this.maxRetries = 3;
    this.retryDelay = 1000; // Start with 1 second
    this.retryableErrors = [
      'overloaded_error',
      'rate_limit_error',
      'timeout',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND'
    ];

    // Simple in-memory cache for rate limiting protection
    // Cache format: { cacheKey: { data, timestamp } }
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Generate comprehensive bank analysis with streaming and retry logic
   * @param {Object} bankInfo - Basic bank information
   * @param {Object} trendsData - Financial trends data
   * @param {Object} peerData - Peer comparison data (rankings, averages, peer banks)
   * @param {Array} pdfs - Array of PDF documents to attach
   * @param {Function} streamCallback - Callback for streaming content (thinking, text, etc.)
   * @returns {Promise<Object>} Analysis report
   */
  async analyzeBankPerformance(bankInfo, trendsData, peerData = null, pdfs = [], streamCallback = null) {
    return this._withRetry(async (attempt) => {
      try {
        // Prepare the analysis prompt with bank data
        const analysisPrompt = this._buildAnalysisPrompt(bankInfo, trendsData, peerData);

        // Update status
        if (streamCallback) {
          const message = attempt > 1
            ? `${prompts.statusMessages.analyzingTrends} (attempt ${attempt}/${this.maxRetries})`
            : prompts.statusMessages.analyzingTrends;
          streamCallback({
            type: 'status',
            stage: 'analyzing',
            message
          });
        }

        // Prepare message content with PDFs
        const messageContent = [];

        // Add PDF documents if any
        if (pdfs && pdfs.length > 0) {
          console.log(`Attaching ${pdfs.length} PDF documents to analysis`);
          const fs = require('fs').promises;

          for (const pdf of pdfs) {
            try {
              const pdfData = await fs.readFile(pdf.getFilePath());
              const base64Data = pdfData.toString('base64');

              messageContent.push({
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64Data
                },
                cache_control: { type: 'ephemeral' } // Cache PDFs for efficiency
              });

              console.log(`Attached PDF: ${pdf.originalFilename} (${Math.round(pdf.fileSize / 1024)}KB)`);
            } catch (error) {
              console.error(`Failed to attach PDF ${pdf.originalFilename}:`, error.message);
            }
          }

          // Add instruction about PDFs
          messageContent.push({
            type: 'text',
            text: `The above ${pdfs.length} PDF document(s) contain additional research materials. Please review them and incorporate relevant information into your analysis.`
          });
        }

        // Add main analysis prompt
        messageContent.push({
          type: 'text',
          text: analysisPrompt
        });

        // Call Claude API with streaming, extended thinking and web search
        const stream = await this.client.messages.stream({
        model: this.model,
        max_tokens: 16000,
        thinking: {
          type: 'enabled',
          budget_tokens: 10000
        },
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search'
          }
        ],
        messages: [
          {
            role: 'user',
            content: messageContent
          }
        ],
        system: prompts.systemPrompt
      });

      let thinkingText = '';
      let analysisText = '';
      let metadata = {};

      // Handle streaming events
      for await (const event of stream) {
        console.log('Stream event type:', event.type); // Debug log
        if (event.type === 'content_block_start') {
          console.log('Content block type:', event.content_block?.type); // Debug log
          if (event.content_block?.type === 'thinking') {
            if (streamCallback) {
              streamCallback({
                type: 'thinking_start',
                message: 'Claude is thinking...'
              });
            }
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta?.type === 'thinking_delta') {
            // Stream thinking content
            thinkingText += event.delta.thinking;
            console.log('Thinking delta length:', event.delta.thinking?.length); // Debug log
            if (streamCallback) {
              streamCallback({
                type: 'thinking_delta',
                content: event.delta.thinking
              });
            }
          } else if (event.delta?.type === 'text_delta') {
            // Stream analysis text
            analysisText += event.delta.text;
            console.log('Text delta length:', event.delta.text?.length); // Debug log
            if (streamCallback) {
              streamCallback({
                type: 'text_delta',
                content: event.delta.text
              });
            }
          }
        } else if (event.type === 'message_start') {
          metadata = {
            model: this.model,
            generatedAt: new Date().toISOString()
          };
        } else if (event.type === 'message_delta') {
          if (event.usage) {
            metadata.outputTokens = event.usage.output_tokens;
          }
        }
      }

      // Get final message to extract usage stats
      const finalMessage = await stream.finalMessage();
      if (finalMessage.usage) {
        metadata.inputTokens = finalMessage.usage.input_tokens;
        metadata.outputTokens = finalMessage.usage.output_tokens;
      }

        return {
          success: true,
          analysis: {
            report: analysisText,
            thinking: thinkingText,
            stopReason: finalMessage.stop_reason
          },
          metadata
        };

      } catch (error) {
        console.error('Error calling Claude API:', error);
        throw error; // Let _withRetry handle retries
      }
    });
  }

  /**
   * Retry wrapper with exponential backoff
   * @param {Function} operation - Async function to retry
   * @returns {Promise} Result of the operation
   */
  async _withRetry(operation) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation(attempt);
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        const isRetryable = this._isRetryableError(error);
        const isLastAttempt = attempt === this.maxRetries;

        if (!isRetryable || isLastAttempt) {
          console.error(`Non-retryable error or max retries reached:`, error);
          throw new Error(`Claude API error: ${error.message}`);
        }

        // Calculate exponential backoff delay
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        console.warn(`Retryable error on attempt ${attempt}/${this.maxRetries}. Retrying in ${delay}ms...`, error.message);

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error(`Claude API error after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Check if an error is retryable
   * @param {Error} error - The error to check
   * @returns {boolean} Whether the error is retryable
   */
  _isRetryableError(error) {
    // Check error type
    if (error.type && this.retryableErrors.includes(error.type)) {
      return true;
    }

    // Check error code
    if (error.code && this.retryableErrors.includes(error.code)) {
      return true;
    }

    // Check error message for network issues
    const message = error.message?.toLowerCase() || '';
    if (message.includes('timeout') ||
        message.includes('econnreset') ||
        message.includes('etimedout') ||
        message.includes('overloaded') ||
        message.includes('rate limit') ||
        message.includes('terminated') ||
        message.includes('socket')) {
      return true;
    }

    // Check error.cause for nested errors (undici wrapping)
    if (error.cause) {
      const causeMessage = error.cause.message?.toLowerCase() || '';
      const causeCode = error.cause.code;
      if (causeMessage.includes('timeout') ||
          causeMessage.includes('etimedout') ||
          causeMessage.includes('econnreset') ||
          causeMessage.includes('socket') ||
          causeCode === 'ETIMEDOUT' ||
          causeCode === 'ECONNRESET') {
        return true;
      }
    }

    // Check HTTP status codes
    if (error.status === 429 || // Rate limit
        error.status === 500 || // Server error
        error.status === 502 || // Bad gateway
        error.status === 503 || // Service unavailable
        error.status === 504) { // Gateway timeout
      return true;
    }

    return false;
  }

  /**
   * Build the complete analysis prompt with all bank data
   */
  _buildAnalysisPrompt(bankInfo, trendsData, peerData = null) {
    const {
      idrssd,
      name,
      city,
      state,
      website,
      totalAssets,
      latestPeriod
    } = bankInfo;

    // Format financial data for the prompt
    const assetData = this._formatAssetData(trendsData);
    const lendingData = this._formatLendingData(trendsData);
    const incomeData = this._formatIncomeData(trendsData);
    const ratioData = this._formatRatioData(trendsData);

    // Build the main prompt
    let prompt = prompts.analysisPrompt
      .replace(/{bankName}/g, name)
      .replace(/{idrssd}/g, idrssd)
      .replace(/{city}/g, city)
      .replace(/{state}/g, state)
      .replace(/{website}/g, website || 'Not available')
      .replace(/{totalAssets}/g, this._formatCurrency(totalAssets))
      .replace(/{latestPeriod}/g, latestPeriod);

    // Add detailed financial data sections
    prompt += '\n\n## Financial Data for Analysis\n\n';
    prompt += '### Asset Composition Trends\n' + assetData + '\n\n';
    prompt += '### Lending Portfolio Breakdown\n' + lendingData + '\n\n';
    prompt += '### Income Statement Trends\n' + incomeData + '\n\n';
    prompt += '### Key Financial Ratios\n' + ratioData + '\n\n';

    // Add peer comparison data if available
    if (peerData) {
      prompt += this._formatPeerData(bankInfo, peerData) + '\n\n';
    }

    // Add search instructions
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });
    prompt += `\n## Research Instructions\n\n`;
    prompt += `**IMPORTANT:** Conduct thorough web searches to gather comprehensive intelligence. Pay special attention to the PRIORITY items needed for the Research Checklist:\n\n`;

    prompt += `### 1. PRIORITY: Investor Presentations (Last 12 Months)\n`;
    prompt += `**CRITICAL FOR CHECKLIST** - Search extensively:\n`;
    prompt += `- "${name}" investor presentation ${currentYear}\n`;
    prompt += `- "${name}" investor day ${currentYear} ${lastYear}\n`;
    prompt += `- "${name}" investor relations presentation PDF\n`;
    prompt += `- "${name}" annual report ${currentYear}\n`;
    prompt += `- "${name}" bank investor deck\n`;
    prompt += `**Document:** If found, note the date and URL for the checklist\n\n`;

    prompt += `### 2. PRIORITY: Earnings Call Transcripts\n`;
    prompt += `**CRITICAL FOR CHECKLIST** - Search for:\n`;
    prompt += `- "${name}" earnings call transcript Q1 Q2 Q3 Q4 ${currentYear}\n`;
    prompt += `- "${name}" quarterly earnings ${currentYear}\n`;
    prompt += `- "${name}" earnings release ${currentYear}\n`;
    prompt += `- "${name}" financial results conference call\n`;
    prompt += `**Document:** If found, note the quarter and year for the checklist\n\n`;

    prompt += `### 3. PRIORITY: Executive Interviews & C-Suite Coverage\n`;
    prompt += `**CRITICAL FOR CHECKLIST** - Search for:\n`;
    prompt += `- "${name}" CEO interview ${currentYear}\n`;
    prompt += `- "${name}" CFO interview ${currentYear}\n`;
    prompt += `- "${name}" executive interview American Banker\n`;
    prompt += `- "${name}" CEO ${city} business journal interview\n`;
    prompt += `- "${name}" leadership profile Forbes Fortune Bloomberg\n`;
    prompt += `**Document:** Count how many interviews you find and note examples\n\n`;

    prompt += `### 4. PRIORITY: Major News (Last 3 Months)\n`;
    prompt += `**CRITICAL FOR CHECKLIST** - Search for recent news:\n`;
    prompt += `- "${name}" bank news ${currentMonth} ${currentYear}\n`;
    prompt += `- "${name}" ${state} news after:${currentYear}-${String(new Date().getMonth() - 2).padStart(2, '0')}-01\n`;
    prompt += `- "${name}" announcement ${currentYear}\n`;
    prompt += `- "${name}" acquisition merger partnership ${currentYear}\n`;
    prompt += `**Document:** Count major stories and list headlines for the checklist\n\n`;

    prompt += `### 5. PRIORITY: AI Projects & Technology Partnerships\n`;
    prompt += `**CRITICAL FOR CHECKLIST** - Search specifically for:\n`;
    prompt += `- "${name}" artificial intelligence AI machine learning\n`;
    prompt += `- "${name}" AI partnership project initiative\n`;
    prompt += `- "${name}" fintech partnership technology\n`;
    prompt += `- "${name}" digital transformation AI strategy\n`;
    prompt += `- "${name}" innovation lab AI center\n`;
    prompt += `**Document:** List any AI projects, partnerships, or initiatives found\n\n`;

    prompt += `### 6. Job Postings & Hiring Strategy\n`;
    prompt += `Search multiple sources:\n`;
    prompt += `- "${name}" jobs site:linkedin.com\n`;
    prompt += `- "${name}" careers openings\n`;
    prompt += `- "${name}" hiring software engineer data scientist cloud\n`;
    prompt += `- "${name}" jobs technology stack AWS Azure Python Java\n`;
    prompt += `**Analyze:** Volume of openings, departments hiring, tech stack mentioned, seniority levels\n\n`;

    prompt += `### 7. Additional Market Context\n`;
    prompt += `- "${name}" bank news ${state} ${currentYear}\n`;
    prompt += `- "${name}" regulatory filing OCC FDIC ${currentYear}\n`;
    prompt += `- "${name}" branch expansion closure ${currentYear}\n\n`;

    prompt += `### 9. Leadership Intelligence\n`;
    prompt += `- "${name}" CEO executive team leadership\n`;
    prompt += `- "${name}" CTO CIO Chief Digital Officer Chief Technology\n`;
    prompt += `- "${name}" Chief AI Officer innovation digital transformation\n`;
    prompt += `- "${name}" board of directors\n`;
    prompt += `- Search for executive LinkedIn profiles and recent interviews\n\n`;

    prompt += `### 10. Technology & Digital Strategy\n`;
    prompt += `- "${name}" digital banking mobile app technology\n`;
    prompt += `- "${name}" cloud migration AWS Azure Google Cloud\n`;
    prompt += `- "${name}" fintech partnership API platform\n\n`;

    prompt += `### 11. Press Releases & Announcements\n`;
    prompt += `- "${name}" press release ${currentYear}\n`;
    prompt += `- "${name}" announcement product launch new service\n\n`;

    // Add peer bank news searches if peer data is available
    if (peerData && peerData.peerBanks && peerData.peerBanks.length > 0) {
      prompt += `### 12. Peer Bank Intelligence\n`;
      prompt += `**Search for news about peer banks to understand competitive dynamics:**\n`;

      // Get top 5 peers by asset size (excluding target)
      const topPeers = peerData.peerBanks
        .filter(p => p.idrssd !== idrssd)
        .slice(0, 5);

      topPeers.forEach(peer => {
        prompt += `- "${peer.name}" bank news ${currentYear}\n`;
      });

      prompt += `\n**Analyze:** What are peer banks doing differently? Any mergers, acquisitions, expansions, or strategic initiatives? How do their strategies compare to ${name}?\n\n`;
    }

    if (!website) {
      const sectionNum = peerData ? '13' : '12';
      prompt += `### ${sectionNum}. Bank Website & Career Portal\n`;
      prompt += `- "${name}" bank ${city} ${state} official website\n`;
      prompt += `- "${name}" careers jobs portal\n\n`;
    }

    prompt += '\n**Important:** Reference specific data points and trends in your analysis. ';
    prompt += 'Explain whether each trend is positive or negative for the bank and why. ';
    prompt += 'Cite all claims with proper inline citations as specified above.';

    return prompt;
  }

  /**
   * Format asset composition data for the prompt
   */
  _formatAssetData(trendsData) {
    if (!trendsData || !trendsData.periods || trendsData.periods.length === 0) {
      return 'No asset data available';
    }

    let output = '| Period | Consumer Lending | Business Lending | Securities | Cash | Other Assets | Total Assets |\n';
    output += '|--------|-----------------|-----------------|------------|------|--------------|-------------|\n';

    trendsData.periods.forEach(period => {
      const assets = period.assets || {};
      output += `| ${period.period} | `;
      output += `${this._formatCurrency(assets.consumerLending)} | `;
      output += `${this._formatCurrency(assets.businessLending)} | `;
      output += `${this._formatCurrency(assets.securities)} | `;
      output += `${this._formatCurrency(assets.cash)} | `;
      output += `${this._formatCurrency(assets.other)} | `;
      output += `${this._formatCurrency(assets.total)} |\n`;
    });

    return output;
  }

  /**
   * Format lending portfolio data for the prompt
   */
  _formatLendingData(trendsData) {
    if (!trendsData || !trendsData.lendingComposition || trendsData.lendingComposition.length === 0) {
      return 'No lending data available';
    }

    let output = '**Latest Period Lending Breakdown:**\n\n';

    const latest = trendsData.lendingComposition[trendsData.lendingComposition.length - 1];
    if (latest && latest.categories) {
      latest.categories.forEach(cat => {
        output += `\n**${cat.name}:** ${this._formatCurrency(cat.current)} (${cat.percentage}%)\n`;
        if (cat.subcategories) {
          cat.subcategories.forEach(sub => {
            output += `  - ${sub.name}: ${this._formatCurrency(sub.value)}\n`;
          });
        }
        output += `  Growth: ${cat.growth > 0 ? '+' : ''}${cat.growth.toFixed(1)}%\n`;
      });
    }

    return output;
  }

  /**
   * Format income statement data for the prompt
   */
  _formatIncomeData(trendsData) {
    if (!trendsData || !trendsData.periods || trendsData.periods.length === 0) {
      return 'No income data available';
    }

    let output = '| Period | Net Income | Net Interest Income | Noninterest Income | Noninterest Expense |\n';
    output += '|--------|-----------|-------------------|-------------------|--------------------|\n';

    trendsData.periods.forEach(period => {
      const income = period.income || {};
      output += `| ${period.period} | `;
      output += `${this._formatCurrency(income.netIncome)} | `;
      output += `${this._formatCurrency(income.netInterestIncome)} | `;
      output += `${this._formatCurrency(income.noninterestIncome)} | `;
      output += `${this._formatCurrency(income.noninterestExpense)} |\n`;
    });

    return output;
  }

  /**
   * Format ratio data for the prompt
   */
  _formatRatioData(trendsData) {
    if (!trendsData || !trendsData.periods || trendsData.periods.length === 0) {
      return 'No ratio data available';
    }

    let output = '| Period | Efficiency Ratio | ROE | ROA | Net Interest Margin | Operating Leverage (YoY) |\n';
    output += '|--------|-----------------|-----|-----|--------------------|-----------------------|\n';

    trendsData.periods.forEach(period => {
      const ratios = period.ratios || {};
      output += `| ${period.period} | `;
      output += `${ratios.efficiencyRatio ? ratios.efficiencyRatio.toFixed(2) + '%' : 'N/A'} | `;
      output += `${ratios.roe ? ratios.roe.toFixed(2) + '%' : 'N/A'} | `;
      output += `${ratios.roa ? ratios.roa.toFixed(2) + '%' : 'N/A'} | `;
      output += `${ratios.nim ? ratios.nim.toFixed(2) + '%' : 'N/A'} | `;
      output += `${ratios.operatingLeverage ? ratios.operatingLeverage.toFixed(2) + '%' : 'N/A'} |\n`;
    });

    return output;
  }

  /**
   * Format peer comparison data for the prompt
   */
  _formatPeerData(bankInfo, peerData) {
    if (!peerData || !peerData.rankings) {
      return '';
    }

    let output = '### Peer Comparison Analysis\n\n';
    output += `**Peer Group:** ${peerData.count} similar-sized banks (10 larger, 10 smaller by total assets)\n\n`;

    output += '**Performance Rankings (among ALL banks nationally):**\n\n';
    output += '| Metric | Bank Value | Rank | Percentile | Peer Avg |\n';
    output += '|--------|-----------|------|------------|----------|\n';

    const metrics = [
      { key: 'efficiencyRatio', name: 'Efficiency Ratio', format: 'pct', lowerBetter: true },
      { key: 'roe', name: 'Return on Equity', format: 'pct' },
      { key: 'roa', name: 'Return on Assets', format: 'pct' },
      { key: 'nim', name: 'Net Interest Margin', format: 'pct' },
      { key: 'totalAssets', name: 'Total Assets', format: 'currency' }
    ];

    metrics.forEach(metric => {
      const ranking = peerData.rankings[metric.key];
      const peerAvg = peerData.peerAverages[metric.key];

      if (ranking && ranking.value !== null) {
        let valueStr = metric.format === 'currency'
          ? this._formatCurrency(ranking.value)
          : `${ranking.value.toFixed(2)}%`;

        let peerAvgStr = peerAvg !== null
          ? (metric.format === 'currency' ? this._formatCurrency(peerAvg) : `${peerAvg.toFixed(2)}%`)
          : 'N/A';

        let rankStr = `#${ranking.rank} of ${ranking.total}`;
        let percentileStr = ranking.percentile ? `${ranking.percentile}th` : 'N/A';

        // Add context indicator
        let comparison = '';
        if (peerAvg !== null && ranking.value !== null) {
          const diff = metric.lowerBetter
            ? ((peerAvg - ranking.value) / peerAvg * 100)
            : ((ranking.value - peerAvg) / peerAvg * 100);

          if (Math.abs(diff) > 5) {
            comparison = diff > 0 ? ' ⬆️' : ' ⬇️';
          }
        }

        output += `| ${metric.name} | ${valueStr}${comparison} | ${rankStr} | ${percentileStr} | ${peerAvgStr} |\n`;
      }
    });

    output += '\n**Peer Banks (sorted by asset size):**\n\n';
    if (peerData.peerBanks && peerData.peerBanks.length > 0) {
      output += '| Rank | Bank Name | Total Assets | Efficiency | ROE | ROA | NIM |\n';
      output += '|------|-----------|--------------|------------|-----|-----|-----|\n';

      peerData.peerBanks.forEach((peer, idx) => {
        const isTarget = peer.idrssd === bankInfo.idrssd;
        const prefix = isTarget ? '**' : '';
        const suffix = isTarget ? '**' : '';

        output += `| ${idx + 1} | ${prefix}${peer.name}${suffix} | `;
        output += `${this._formatCurrency(peer.totalAssets)} | `;
        output += `${peer.efficiencyRatio ? peer.efficiencyRatio.toFixed(1) + '%' : 'N/A'} | `;
        output += `${peer.roe ? peer.roe.toFixed(1) + '%' : 'N/A'} | `;
        output += `${peer.roa ? peer.roa.toFixed(1) + '%' : 'N/A'} | `;
        output += `${peer.nim ? peer.nim.toFixed(1) + '%' : 'N/A'} |\n`;
      });
    }

    output += '\n**CRITICAL ANALYSIS REQUIREMENT:**\n';
    output += '- Compare the bank\'s metrics to both peer averages AND national rankings\n';
    output += '- Identify areas where the bank is underperforming (below peer average or low percentile)\n';
    output += '- Highlight areas of strength (above peer average or high percentile)\n';
    output += '- Be critical: if metrics are below industry benchmarks, explain the implications\n';
    output += '- Search for news about peer banks to understand what competitors are doing differently\n';

    return output;
  }

  /**
   * Extract and structure the analysis from Claude's response
   */
  _extractAnalysis(response) {
    // Extract text content from response
    let analysisText = '';
    let thinkingText = '';

    response.content.forEach(block => {
      if (block.type === 'thinking') {
        thinkingText += block.thinking + '\n\n';
      } else if (block.type === 'text') {
        analysisText += block.text;
      }
    });

    return {
      report: analysisText,
      thinking: thinkingText,
      stopReason: response.stop_reason
    };
  }

  /**
   * Helper: Format currency values
   */
  _formatCurrency(value) {
    if (value === null || value === undefined) return 'N/A';
    if (value === 0) return '$0';

    // Values are in thousands
    const millions = value / 1000;
    if (millions >= 1000) {
      return `$${(millions / 1000).toFixed(2)}B`;
    }
    return `$${millions.toFixed(2)}M`;
  }

  /**
   * Get cached data if available and not expired
   * @param {string} key - Cache key
   * @returns {any|null} Cached data or null if not found/expired
   */
  _getCached(key) {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.timestamp > this.cacheTTL) {
      // Expired, remove from cache
      this.cache.delete(key);
      return null;
    }

    console.log(`Cache hit for key: ${key}`);
    return cached.data;
  }

  /**
   * Store data in cache
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   */
  _setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    console.log(`Cached data for key: ${key}`);
  }

  /**
   * Generate cache key for bank analysis
   * @param {string} idrssd - Bank ID
   * @param {string} latestPeriod - Latest reporting period
   * @returns {string} Cache key
   */
  _getCacheKey(idrssd, latestPeriod) {
    return `bank-analysis:${idrssd}:${latestPeriod}`;
  }

  /**
   * Clean up expired cache entries (call periodically)
   */
  cleanCache() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`Cleaned ${cleaned} expired cache entries`);
    }
  }

  /**
   * ============================================================================
   * NEW METHODS: Two-Stage AI Research Workflow
   * ============================================================================
   */

  /**
   * Search for sources using Claude with web search
   * @param {string} query - Search query
   * @param {string} category - Category of sources to find
   * @param {Object} bank - Bank information
   * @param {string} refinementPrompt - Optional user refinement prompt
   * @returns {Promise<Array>} Array of discovered sources
   */
  async searchForSources(query, category, bank, refinementPrompt = null) {
    try {
      const searchPrompt = refinementPrompt
        ? `Find sources for ${bank.name} related to ${category}. User's specific request: "${refinementPrompt}"

Return a JSON array of sources found, with each source having:
- url: The URL of the source
- title: A descriptive title
- preview: A 1-2 sentence preview of the content
- date: Approximate date if available (e.g., "Q2 2025", "Oct 2025")
- confidence: Your confidence this is relevant (0.0-1.0)

Search query: ${query}

Return ONLY a valid JSON array, no other text.`
        : `Find the most relevant, recent, and non-paywalled sources for ${bank.name} in the category: ${category}.

Search for: ${query}

IMPORTANT REQUIREMENTS:
- ONLY return sources from the last 6 months (published after April 2025)
- EXCLUDE paywalled content (Wall Street Journal, Bloomberg Terminal, Dow Jones, etc.)
- EXCLUDE press release aggregators (PRNewswire, Business Wire)
- Focus on FULL documents/transcripts, NOT summaries or highlights

Return a JSON array of sources with:
- url: The URL
- title: Title of the source
- preview: Brief preview (1-2 sentences)
- date: Date if available (e.g., "Q2 2025", "October 2025")
- confidence: Relevance confidence (0.0-1.0)

Category-specific requirements:
${category === 'investorPresentation' ? `
- **CRITICAL SEARCH STRATEGY:** First, find the bank's investor relations (IR) website:
  1. Search for: "[Bank Name] investor relations" or "[Bank Name] investor relations website"
  2. Look for URLs like: investor.bankname.com, ir.bankname.com, or bankname.com/investor
  3. Once you find the IR website, search within it for "events" or "presentations"
  4. Look for investor presentation PDFs or earnings call PDF supplements
- **What to find:**
  - Investor presentation PDFs (quarterly earnings presentations, investor day decks)
  - Earnings call PDF supplements (often accompany earnings transcripts)
  - Event presentations (investor day, conferences, roadshows)
  - Look in sections like: "Events & Presentations", "Presentations", "Earnings & Events", "Investor Materials"
- **Search pattern:**
  1. First query: "[Bank Name] investor relations" to find IR site
  2. Second query: "[Bank Name] investor relations events presentations" OR "site:ir.bankname.com presentations" OR "site:investor.bankname.com events"
  3. Look specifically for PDF files - prefer filetype:pdf
- **Must be:** Official PDF documents from investor relations sites
- **EXCLUDE:** Marketing brochures, sales materials, press releases
- **Format:** PDF files only - these are the investor presentations or earnings supplements we need` : ''}
${category === 'earningsTranscript' ? `
- MUST be FULL transcripts, NOT summaries or highlights
- Look for: "earnings call transcript", "quarterly earnings transcript"
- Prefer: SeekingAlpha.com (free transcripts), Fool.com
- EXCLUDE: "Earnings Call Highlights", "Key Takeaways", "Summary"
- MUST include actual Q&A section, not just prepared remarks` : ''}
${category === 'strategyAnalysis' ? `
- MUST be detailed strategy documents or analysis (preferably PDF)
- Look for: strategic plans, digital transformation initiatives, analyst analysis
- Prefer: Consulting firm reports (McKinsey, BCG, Bain), official strategy documents
- EXCLUDE: Brief news articles, PR announcements
- MUST have substantive content (>2000 words or detailed PDF)` : ''}
${category === 'analystReports' ? `
- MUST be from reputable analyst/research firms
- Look for: Forrester, Gartner, IDC, JD Power reports
- Prefer: Full research reports, industry analysis, competitive benchmarking
- EXCLUDE: Vendor marketing materials disguised as "reports"
- MUST be independent third-party analysis` : ''}

Return ONLY a valid JSON array, no other text.`;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        tools: [{
          type: 'web_search_20250305',
          name: 'web_search'
        }],
        messages: [{
          role: 'user',
          content: searchPrompt
        }],
        system: 'You are a research assistant specialized in finding financial and business sources. Always use web search to find actual sources.'
      });

      // Extract text from response
      let responseText = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          responseText += block.text;
        }
      }

      // Try to parse JSON from response
      try {
        // Extract JSON array from response (handle case where there's extra text)
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const sources = JSON.parse(jsonMatch[0]);
          return Array.isArray(sources) ? sources : [];
        }
        return [];
      } catch (parseError) {
        console.error('Error parsing sources JSON:', parseError);
        console.error('Response text:', responseText);
        return [];
      }

    } catch (error) {
      console.error('Error searching for sources:', error);
      throw error;
    }
  }

  /**
   * Fetch content from a URL
   * Uses Claude's built-in web fetching capabilities
   * @param {string} url - URL to fetch
   * @returns {Promise<string>} Content of the URL
   */
  async fetchSourceContent(url) {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 8000,
        messages: [{
          role: 'user',
          content: `Please fetch and summarize the content from this URL: ${url}

Extract the key information, focusing on:
- Main points and findings
- Financial data or metrics mentioned
- Strategic initiatives or plans
- Quotes from executives
- Any relevant dates or timeframes

Provide a comprehensive but concise summary (2-4 paragraphs).`
        }]
      });

      let content = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          content += block.text;
        }
      }

      return content || `[Content from ${url}]`;

    } catch (error) {
      console.error(`Error fetching content from ${url}:`, error);
      throw error;
    }
  }

  /**
   * Generate report using ONLY approved sources (no new web searches)
   * @param {Object} options - Generation options
   * @param {Object} options.bank - Bank information
   * @param {Array} options.statements - Financial statements
   * @param {string} options.sourcesContext - Pre-fetched source content
   * @param {Array} options.approvedSources - List of approved sources
   * @param {Function} options.onThinking - Callback for thinking text
   * @param {Function} options.onText - Callback for analysis text
   * @returns {Promise<Object>} Generated report
   */
  async generateReportFromApprovedSources(options) {
    const { bank, statements, sourcesContext, approvedSources, onThinking, onText } = options;

    try {
      // Build modified prompt that uses ONLY provided sources
      const restrictedPrompt = `You are analyzing ${bank.name} using PRE-PROVIDED sources and financial data.

CRITICAL: Do NOT perform any web searches. Do NOT use the search tool. ALL information must come from the sources provided below.

===== FINANCIAL DATA (Call Reports) =====
${JSON.stringify(this._formatFinancialData(statements), null, 2)}

===== PRE-APPROVED EXTERNAL SOURCES =====
${sourcesContext}

===== YOUR TASK =====
Generate a comprehensive research report about ${bank.name} using ONLY the information provided above.

Follow the standard report structure:
- Executive Summary
- Asset and Lending Trends
- Income and Profitability Analysis
- Key Financial Ratios
- Competitive Positioning vs. Peers
- Leadership and Key Players (if sources available)
- Strategic Insights (based on provided sources)
- Risks and Opportunities

When referencing external sources, cite them as: [Source: Title]
For financial data, cite as: [Call Report: Q# YYYY]

You have ${approvedSources.length} pre-approved external sources plus call report data.
Do NOT search for additional information.`;

      // Call Claude API with streaming but NO web search tool
      const stream = await this.client.messages.stream({
        model: this.model,
        max_tokens: 16000,
        thinking: {
          type: 'enabled',
          budget_tokens: 10000
        },
        // NO tools - prevents web searches
        messages: [{
          role: 'user',
          content: restrictedPrompt
        }],
        system: 'You are a banking analyst. Use ONLY the provided sources and financial data. Do not search for additional information.'
      });

      let thinkingText = '';
      let analysisText = '';
      let metadata = {};

      // Handle streaming events
      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          // Track content blocks
        } else if (event.type === 'content_block_delta') {
          if (event.delta?.type === 'thinking_delta') {
            thinkingText += event.delta.thinking || '';
            if (onThinking) {
              onThinking(event.delta.thinking || '');
            }
          } else if (event.delta?.type === 'text_delta') {
            analysisText += event.delta.text || '';
            if (onText) {
              onText(event.delta.text || '');
            }
          }
        } else if (event.type === 'message_start') {
          metadata.model = event.message?.model;
          metadata.inputTokens = event.message?.usage?.input_tokens || 0;
        } else if (event.type === 'message_delta') {
          metadata.outputTokens = event.delta?.usage?.output_tokens || 0;
        }
      }

      return {
        analysis: analysisText,
        thinking: thinkingText,
        metadata,
        model: this.model,
        trendsData: this._extractTrendsData(statements)
      };

    } catch (error) {
      console.error('Error generating report from approved sources:', error);
      throw error;
    }
  }

  /**
   * Format financial data for prompt
   * @param {Array} statements - Financial statements
   * @returns {Object} Formatted data
   */
  _formatFinancialData(statements) {
    return statements.map(stmt => ({
      period: stmt.reportingPeriod,
      assets: stmt.balanceSheet?.assets?.totalAssets,
      equity: stmt.balanceSheet?.equity?.totalEquity,
      netIncome: stmt.incomeStatement?.netIncome,
      loans: stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.net
    }));
  }

  /**
   * Extract trends data from statements
   * @param {Array} statements - Financial statements
   * @returns {Object} Trends data
   */
  _extractTrendsData(statements) {
    // This would extract the same trends data used in other parts of the app
    // For now, return a simple structure
    return {
      periods: statements.map(s => s.reportingPeriod),
      assets: statements.map(s => s.balanceSheet?.assets?.totalAssets),
      equity: statements.map(s => s.balanceSheet?.equity?.totalEquity),
      netIncome: statements.map(s => s.incomeStatement?.netIncome)
    };
  }
}

module.exports = ClaudeService;
