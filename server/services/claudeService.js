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
      apiKey: apiKey
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
   * @param {Function} streamCallback - Callback for streaming content (thinking, text, etc.)
   * @returns {Promise<Object>} Analysis report
   */
  async analyzeBankPerformance(bankInfo, trendsData, peerData = null, streamCallback = null) {
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
            content: analysisPrompt
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
        message.includes('rate limit')) {
      return true;
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
    prompt += `\n## Research Instructions\n\n`;
    prompt += `**IMPORTANT:** Conduct thorough web searches to gather comprehensive intelligence:\n\n`;

    prompt += `### 1. Job Postings & Hiring Strategy (HIGH PRIORITY)\n`;
    prompt += `Search multiple sources:\n`;
    prompt += `- "${name}" jobs site:linkedin.com\n`;
    prompt += `- "${name}" careers openings\n`;
    prompt += `- "${name}" hiring software engineer data scientist cloud\n`;
    prompt += `- "${name}" jobs technology stack AWS Azure Python Java\n`;
    prompt += `**Analyze:** Volume of openings, departments hiring, tech stack mentioned, seniority levels\n\n`;

    prompt += `### 2. Recent News & Market Context\n`;
    prompt += `- "${name}" bank news ${state} ${currentYear}\n`;
    prompt += `- "${name}" acquisition merger partnership ${currentYear}\n`;
    prompt += `- "${name}" regulatory filing OCC FDIC ${currentYear}\n`;
    prompt += `- "${name}" branch expansion closure ${currentYear}\n\n`;

    prompt += `### 3. Investor Relations & Strategy\n`;
    prompt += `- "${name}" investor relations presentation earnings\n`;
    prompt += `- "${name}" quarterly earnings Q1 Q2 Q3 Q4 ${currentYear}\n`;
    prompt += `- "${name}" bank strategic priorities annual report\n`;
    prompt += `- "${name}" investor day presentation\n\n`;

    prompt += `### 4. Leadership Intelligence\n`;
    prompt += `- "${name}" CEO executive team leadership\n`;
    prompt += `- "${name}" CTO CIO Chief Digital Officer Chief Technology\n`;
    prompt += `- "${name}" Chief AI Officer innovation digital transformation\n`;
    prompt += `- "${name}" board of directors\n`;
    prompt += `- Search for executive LinkedIn profiles and recent interviews\n\n`;

    prompt += `### 5. Technology & Digital Strategy\n`;
    prompt += `- "${name}" digital banking mobile app technology\n`;
    prompt += `- "${name}" artificial intelligence machine learning AI\n`;
    prompt += `- "${name}" cloud migration AWS Azure Google Cloud\n`;
    prompt += `- "${name}" fintech partnership API platform\n\n`;

    prompt += `### 6. Press Releases & Announcements\n`;
    prompt += `- "${name}" press release ${currentYear}\n`;
    prompt += `- "${name}" announcement product launch new service\n\n`;

    // Add peer bank news searches if peer data is available
    if (peerData && peerData.peerBanks && peerData.peerBanks.length > 0) {
      prompt += `### 7. Peer Bank Intelligence (HIGH PRIORITY)\n`;
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
      const sectionNum = peerData ? '8' : '7';
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
}

module.exports = ClaudeService;
