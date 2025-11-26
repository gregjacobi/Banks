const axios = require('axios');
const cheerio = require('cheerio');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');

/**
 * Content Fetcher Service
 * Fetches and extracts clean text from web pages
 * Handles HTML pages, PDFs (via text extraction), and various content types
 */
class ContentFetcher {
  constructor() {
    this.timeout = 30000; // 30 second timeout
    this.maxContentLength = 200000; // 200KB max content per source (after extraction)
    this.maxDownloadSize = 5000000; // 5MB max download size (before extraction)
    this.userAgent = 'Mozilla/5.0 (compatible; BankExplorer/1.0; +https://github.com/yourrepo)';
  }

  /**
   * Fetch and parse content from a URL
   * @param {string} url - URL to fetch
   * @returns {Promise<Object>} { content, contentLength, contentType, error, fetchable }
   */
  async fetchAndParse(url) {
    try {
      console.log(`[ContentFetcher] Fetching content from: ${url}`);

      // Fetch the content with browser-like headers
      const response = await axios.get(url, {
        timeout: this.timeout,
        maxContentLength: this.maxDownloadSize, // Allow up to 5MB download
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Upgrade-Insecure-Requests': '1'
        },
        responseType: 'text',
        validateStatus: (status) => {
          // Only accept 2xx responses, reject 4xx and 5xx
          return status >= 200 && status < 300;
        }
      });

      const contentType = response.headers['content-type'] || '';
      console.log(`[ContentFetcher] Response content-type: ${contentType}`);

      // Handle different content types
      if (contentType.includes('application/pdf')) {
        return await this.handlePDF(url, response);
      } else if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
        return await this.handleHTML(url, response.data);
      } else if (contentType.includes('text/plain')) {
        return this.handlePlainText(response.data);
      } else {
        // Unknown content type, try HTML parsing anyway
        console.log(`[ContentFetcher] Unknown content type, attempting HTML parsing`);
        return await this.handleHTML(url, response.data);
      }

    } catch (error) {
      const errorDetails = {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText
      };

      console.error(`[ContentFetcher] Error fetching ${url}:`, errorDetails);

      // Return detailed error information
      return {
        content: null,
        contentLength: 0,
        contentType: 'error',
        error: this.formatErrorMessage(error),
        errorDetails,
        fetchable: false
      };
    }
  }

  /**
   * Format error message for user display
   */
  formatErrorMessage(error) {
    if (error.code === 'ECONNABORTED') {
      return 'Request timeout - site took too long to respond';
    }
    if (error.code === 'ENOTFOUND') {
      return 'Domain not found - URL may be invalid';
    }
    if (error.response?.status === 403) {
      return 'Access forbidden - site blocked our request';
    }
    if (error.response?.status === 404) {
      return 'Page not found - URL may be outdated';
    }
    if (error.response?.status === 401) {
      return 'Authentication required - content behind paywall';
    }
    if (error.response?.status >= 500) {
      return 'Server error - site is temporarily unavailable';
    }
    return error.message || 'Unknown error occurred';
  }

  /**
   * Handle HTML content extraction
   */
  async handleHTML(url, html) {
    try {
      console.log(`[ContentFetcher] Attempting HTML parsing for ${url}`);

      // Try Readability first (best for articles)
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (article && article.textContent && article.textContent.trim().length > 200) {
        const content = this.cleanText(article.textContent);
        console.log(`[ContentFetcher] Successfully extracted article content: ${content.length} chars`);
        return {
          content: content.substring(0, this.maxContentLength),
          contentLength: content.length,
          contentType: 'article',
          title: article.title || null,
          excerpt: article.excerpt || null,
          fetchable: true
        };
      }

      console.log(`[ContentFetcher] Readability failed, falling back to cheerio`);

      // Fallback to cheerio for non-article content
      const $ = cheerio.load(html);

      // Remove script, style, nav, footer, header
      $('script, style, nav, footer, header, aside, .ad, .advertisement, .sidebar').remove();

      // Try to find main content
      let content = '';
      const mainSelectors = ['main', 'article', '[role="main"]', '.content', '#content', '.main'];

      for (const selector of mainSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          content = element.text();
          console.log(`[ContentFetcher] Found content using selector "${selector}": ${content.length} chars`);
          break;
        }
      }

      // If no main content found, use body
      if (!content || content.trim().length < 200) {
        content = $('body').text();
        console.log(`[ContentFetcher] Using body text: ${content.length} chars`);
      }

      content = this.cleanText(content);

      // Enhanced paywall detection
      const paywallIndicators = [
        // Login/Registration
        'sign in', 'log in', 'login', 'create account', 'register', 'create a free account',
        // Subscription
        'subscribe', 'subscription required', 'subscribers only', 'subscriber exclusive',
        'become a subscriber', 'get unlimited access', 'subscribe to continue', 'subscribe now',
        // Premium content
        'premium content', 'premium article', 'members only', 'member exclusive',
        'this content is available to', 'available to premium members', 'upgrade to read',
        // Paywall-specific
        'paywall', 'you have reached your', 'article limit', 'free articles remaining',
        'unlock this article', 'continue reading with', 'read more with',
        // Payment
        'complete your purchase', 'add payment method', 'billing information',
        // Trial
        'start your free trial', 'free trial', 'trial period'
      ];

      // Known paywall domains
      const paywallDomains = [
        'wsj.com', 'bloomberg.com', 'ft.com', 'nytimes.com', 'economist.com',
        'barrons.com', 'marketwatch.com', 'businessinsider.com', 'reuters.com',
        'dow jones', 'factset', 'capital iq', 's&p global'
      ];

      const contentLower = content.toLowerCase();
      const urlLower = url.toLowerCase();

      // Check for paywall indicators in content
      const hasPaywallIndicator = paywallIndicators.some(indicator =>
        contentLower.includes(indicator)
      );

      // Check if URL is from known paywall domain
      const isPaywallDomain = paywallDomains.some(domain =>
        urlLower.includes(domain)
      );

      if (content.length < 100) {
        console.log(`[ContentFetcher] Insufficient content extracted (${content.length} chars) - likely JavaScript-rendered`);

        // Provide a helpful message with the URL for web search
        const message = `[Limited Content Extracted]\n\nThis page may be JavaScript-rendered or have anti-scraping measures.\n\nURL: ${url}\n\nExtracted text (${content.length} chars): ${content}\n\nConsider using web search tools to access this content.`;

        return {
          content: message,
          contentLength: message.length,
          contentType: 'html',
          error: 'Insufficient content - may be JavaScript-rendered',
          fetchable: true, // We got the page, just limited extraction
          requiresWebSearch: true,
          isProbablyTruncated: true,
          isProbablyPaywalled: isPaywallDomain
        };
      }

      // Enhanced paywall and quality detection
      // Strongly indicate paywall if from known domain OR has indicators + short content
      const isProbablyPaywalled = isPaywallDomain || (hasPaywallIndicator && content.length < 1500);

      // Check content quality - is it substantive?
      const hasSubstantiveContent = content.length > 2000;
      const isProbablyTruncated = content.length < 800 && !hasPaywallIndicator && !isPaywallDomain;

      // Additional quality checks
      const sentenceCount = (content.match(/[.!?]+\s/g) || []).length;
      const avgSentenceLength = sentenceCount > 0 ? content.length / sentenceCount : 0;
      const hasNormalSentenceStructure = avgSentenceLength > 30 && avgSentenceLength < 300;

      // Check for low-quality content patterns
      const lowQualityIndicators = [
        'this article requires javascript',
        'please enable javascript',
        'browser not supported',
        'update your browser'
      ];
      const hasLowQualityIndicator = lowQualityIndicators.some(indicator =>
        contentLower.includes(indicator)
      );

      const isLowQuality = !hasNormalSentenceStructure || hasLowQualityIndicator;

      if (isProbablyPaywalled) {
        console.log(`[ContentFetcher] Content appears to be behind paywall (${content.length} chars, domain: ${isPaywallDomain}, indicators: ${hasPaywallIndicator})`);
      } else if (isProbablyTruncated) {
        console.log(`[ContentFetcher] Content may be truncated (${content.length} chars)`);
      } else if (isLowQuality) {
        console.log(`[ContentFetcher] Content may be low quality (sentence structure: ${hasNormalSentenceStructure}, indicators: ${hasLowQualityIndicator})`);
      } else if (hasSubstantiveContent) {
        console.log(`[ContentFetcher] High-quality substantive content detected (${content.length} chars, ${sentenceCount} sentences)`);
      }

      console.log(`[ContentFetcher] Successfully extracted HTML content: ${content.length} chars`);
      return {
        content: content.substring(0, this.maxContentLength),
        contentLength: content.length,
        contentType: 'html',
        fetchable: true,
        isProbablyPaywalled,
        isProbablyTruncated,
        isLowQuality,
        hasSubstantiveContent,
        sentenceCount,
        avgSentenceLength: Math.round(avgSentenceLength),
        requiresWebSearch: isProbablyPaywalled || isProbablyTruncated
      };

    } catch (error) {
      console.error(`[ContentFetcher] Error parsing HTML:`, error.message);
      return {
        content: null,
        contentLength: 0,
        contentType: 'html',
        error: error.message,
        fetchable: false
      };
    }
  }

  /**
   * Handle PDF content (basic text extraction)
   */
  async handlePDF(url, response) {
    // For PDFs, we successfully detected them and can provide the URL
    // Claude can use web search or direct PDF access for these
    console.log('[ContentFetcher] PDF detected, marking as successfully fetched with URL');

    const message = `[PDF Document Available]\n\nThis source is a PDF file that requires special handling.\n\nDirect URL: ${url}\n\nThe PDF can be accessed directly from this URL. Consider using web search tools or PDF-specific processing to extract the content.`;

    return {
      content: message,
      contentLength: message.length,
      contentType: 'pdf',
      pdfUrl: url,
      fetchable: true, // Successfully fetched - we have the URL and know it's a PDF
      isPDF: true,
      requiresWebSearch: true // Flag to use web search for deeper content extraction
    };
  }

  /**
   * Handle plain text content
   */
  handlePlainText(text) {
    const content = this.cleanText(text);

    return {
      content: content.substring(0, this.maxContentLength),
      contentLength: content.length,
      contentType: 'text',
      fetchable: true
    };
  }

  /**
   * Clean and normalize text
   */
  cleanText(text) {
    return text
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Remove multiple newlines
      .replace(/\n\s*\n/g, '\n')
      // Trim
      .trim();
  }

  /**
   * Batch fetch multiple URLs in parallel
   * @param {Array<string>} urls - Array of URLs to fetch
   * @param {number} concurrency - Max concurrent requests (default 3)
   * @returns {Promise<Array>} Array of results
   */
  async batchFetch(urls, concurrency = 3) {
    const results = [];
    const queue = [...urls];

    const fetchNext = async () => {
      if (queue.length === 0) return;

      const url = queue.shift();
      try {
        const result = await this.fetchAndParse(url);
        results.push({ url, ...result });
      } catch (error) {
        results.push({
          url,
          content: null,
          error: error.message,
          fetchable: false
        });
      }

      // Fetch next in queue
      await fetchNext();
    };

    // Start concurrent fetches
    const workers = Array(Math.min(concurrency, urls.length))
      .fill(null)
      .map(() => fetchNext());

    await Promise.all(workers);

    return results;
  }

  /**
   * Test if a URL is accessible
   * @param {string} url - URL to test
   * @returns {Promise<boolean>} True if accessible
   */
  async testAccess(url) {
    try {
      const response = await axios.head(url, {
        timeout: 5000,
        headers: { 'User-Agent': this.userAgent }
      });
      return response.status < 400;
    } catch (error) {
      return false;
    }
  }
}

module.exports = ContentFetcher;
