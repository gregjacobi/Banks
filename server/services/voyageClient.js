const axios = require('axios');

class VoyageClient {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.VOYAGE_AI_API_KEY || process.env.VOYAGE_API_KEY;
    this.baseURL = 'https://api.voyageai.com/v1';
    this.model = 'voyage-3';  // 1024 dimensions

    if (!this.apiKey) {
      console.warn('[VoyageAI] No API key found. Set VOYAGE_AI_API_KEY or VOYAGE_API_KEY in .env');
    }
  }

  /**
   * Sleep helper for rate limiting
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate embeddings for one or more texts with retry logic
   * @param {string|string[]} input - Text or array of texts to embed
   * @param {string} inputType - 'document' or 'query'
   * @param {number} retries - Number of retries for rate limits
   * @returns {Promise<number[]|number[][]>} Embedding(s)
   */
  async embed(input, inputType = 'document', retries = 3) {
    if (!this.apiKey) {
      throw new Error('Voyage AI API key not configured');
    }

    const isArray = Array.isArray(input);
    const texts = isArray ? input : [input];

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await axios.post(
          `${this.baseURL}/embeddings`,
          {
            input: texts,
            model: this.model,
            input_type: inputType  // 'document' for chunked content, 'query' for search queries
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const embeddings = response.data.data.map(item => item.embedding);

        // Return single embedding or array
        return isArray ? embeddings : embeddings[0];

      } catch (error) {
        const status = error.response?.status;
        const errorCode = error.code;
        const errorMessage = error.message?.toLowerCase() || '';

        // Determine if error is retryable
        const isRateLimit = status === 429;
        const isNetworkError = errorCode === 'ECONNRESET' ||
                               errorCode === 'ETIMEDOUT' ||
                               errorCode === 'ENOTFOUND' ||
                               errorCode === 'ECONNREFUSED' ||
                               errorMessage.includes('socket') ||
                               errorMessage.includes('timeout') ||
                               errorMessage.includes('network');
        const isServerError = status >= 500 && status < 600; // 500, 502, 503, 504, etc.

        const isRetryable = isRateLimit || isNetworkError || isServerError;

        // If retryable and we have retries left, wait and retry
        if (isRetryable && attempt < retries) {
          const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
          const errorType = isRateLimit ? 'Rate limited' :
                           isNetworkError ? 'Network error' :
                           'Server error';
          console.log(`[VoyageAI] ${errorType} (${errorCode || status || 'unknown'}). Retrying in ${waitTime/1000}s (attempt ${attempt + 1}/${retries})...`);
          await this.sleep(waitTime);
          continue;
        }

        // Otherwise throw the error
        console.error('[VoyageAI] Embedding error:', error.response?.data || error.message);
        console.error('[VoyageAI] Error code:', errorCode);
        throw new Error(`Voyage AI embedding failed: ${error.response?.data?.message || error.message}`);
      }
    }
  }

  /**
   * Generate embedding for a single document chunk
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} Embedding vector
   */
  async embedDocument(text) {
    return this.embed(text, 'document');
  }

  /**
   * Generate embedding for a search query
   * @param {string} query - Query text
   * @returns {Promise<number[]>} Embedding vector
   */
  async embedQuery(query) {
    return this.embed(query, 'query');
  }

  /**
   * Batch embed multiple documents efficiently with rate limiting
   * @param {string[]} texts - Array of texts to embed
   * @returns {Promise<number[][]>} Array of embeddings
   */
  async embedBatch(texts) {
    // Voyage AI supports batch embedding - process up to 128 at once
    const batchSize = 128;
    const allEmbeddings = [];
    const batchCount = Math.ceil(texts.length / batchSize);

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;

      console.log(`[VoyageAI] Embedding batch ${batchNum}/${batchCount} (${batch.length} chunks)...`);

      const embeddings = await this.embed(batch, 'document');
      allEmbeddings.push(...embeddings);

      console.log(`[VoyageAI] ✓ Batch ${batchNum}/${batchCount} completed`);

      // Add delay between batches to avoid rate limits (except for last batch)
      if (i + batchSize < texts.length) {
        const delayMs = 1000; // 1 second between batches
        console.log(`[VoyageAI] Waiting ${delayMs/1000}s before next batch...`);
        await this.sleep(delayMs);
      }
    }

    return allEmbeddings;
  }

  /**
   * Calculate cost estimate for embedding
   * @param {number} tokenCount - Number of tokens to embed
   * @returns {number} Cost in USD
   */
  calculateCost(tokenCount) {
    // Voyage-3 pricing: $0.06 per 1M tokens
    return (tokenCount / 1_000_000) * 0.06;
  }
}

// Export singleton instance
module.exports = new VoyageClient();
module.exports.VoyageClient = VoyageClient;
