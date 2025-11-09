const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

/**
 * Model Resolver Service
 * Fetches the latest available Claude models and selects the latest Sonnet with thinking support
 */
class ModelResolver {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    // Cache for model name (refresh every hour)
    this.cachedModel = null;
    this.cacheTimestamp = null;
    this.cacheTTL = 60 * 60 * 1000; // 1 hour
    
    // Fallback model if API call fails
    this.fallbackModel = 'claude-sonnet-4-20250514';
  }

  /**
   * Get the latest Sonnet model with thinking support
   * Tries to fetch from API, falls back to known latest model
   */
  async getLatestSonnetModel() {
    // Check cache first
    if (this.cachedModel && this.cacheTimestamp && 
        (Date.now() - this.cacheTimestamp) < this.cacheTTL) {
      return this.cachedModel;
    }

    // Check environment variable first (allows override)
    if (process.env.CLAUDE_MODEL) {
      console.log(`Using model from CLAUDE_MODEL env var: ${process.env.CLAUDE_MODEL}`);
      this.cachedModel = process.env.CLAUDE_MODEL;
      this.cacheTimestamp = Date.now();
      return this.cachedModel;
    }

    try {
      console.log('='.repeat(60));
      console.log('MODEL RESOLVER: Fetching available Claude models from API...');
      console.log('='.repeat(60));
      console.log(`API Key present: ${!!this.client.apiKey}`);
      console.log(`API Key preview: ${this.client.apiKey ? this.client.apiKey.substring(0, 20) + '...' : 'MISSING'}`);
      console.log('-'.repeat(60));

      // Fetch list of available models from Anthropic API
      let modelsResponse;
      try {
        modelsResponse = await axios.get('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': this.client.apiKey,
            'anthropic-version': '2023-06-01'
          },
          timeout: 10000
        });
        console.log(`✓ Successfully fetched models list from API`);
        console.log(`  → Total models available: ${modelsResponse.data.data?.length || 0}`);
      } catch (apiError) {
        console.error(`✗ Failed to fetch models list from API:`, apiError.message);
        console.log(`  → Falling back to known model list`);
        throw apiError; // Will be caught by outer catch
      }

      // Filter for Sonnet models and find the latest one
      const allModels = modelsResponse.data.data || [];
      
      // Log all models for debugging
      console.log(`\nAll available models (${allModels.length}):`);
      allModels.forEach(m => {
        console.log(`  - ${m.id}${m.display_name ? ` (${m.display_name})` : ''}${m.created_at ? ` [${m.created_at}]` : ''}`);
      });
      
      // Filter for Sonnet models - be more inclusive to catch 4.5, 4.0, etc.
      const sonnetModels = allModels.filter(model => 
        model.id && (
          model.id.includes('sonnet-4') || 
          model.id.includes('sonnet-3-5') ||
          model.id.includes('sonnet-4.5') ||
          (model.display_name && model.display_name.toLowerCase().includes('sonnet'))
        )
      );

      console.log(`\nFound ${sonnetModels.length} Sonnet model(s):`);
      sonnetModels.forEach(m => {
        console.log(`  - ${m.id}${m.display_name ? ` (${m.display_name})` : ''} (created: ${m.created_at || 'unknown'})`);
      });

      if (sonnetModels.length === 0) {
        console.warn(`⚠ No Sonnet models found in API response`);
        console.log(`⚠ Using fallback model: ${this.fallbackModel}`);
        this.cachedModel = this.fallbackModel;
        this.cacheTimestamp = Date.now();
        return this.fallbackModel;
      }

      // Sort by created_at to get the latest, or by model ID (newer versions have higher numbers)
      const sortedModels = sonnetModels.sort((a, b) => {
        // Prefer sonnet-4-5 (4.5) over sonnet-4 over sonnet-3-5
        if (a.id.includes('sonnet-4-5') && !b.id.includes('sonnet-4-5')) return -1;
        if (!a.id.includes('sonnet-4-5') && b.id.includes('sonnet-4-5')) return 1;
        if (a.id.includes('sonnet-4') && !b.id.includes('sonnet-4')) return -1;
        if (!a.id.includes('sonnet-4') && b.id.includes('sonnet-4')) return 1;
        
        // If both are same series, sort by created_at or ID
        if (a.created_at && b.created_at) {
          return new Date(b.created_at) - new Date(a.created_at);
        }
        // Fallback: sort by ID (newer versions typically have later dates in ID)
        return b.id.localeCompare(a.id);
      });

      const latestModel = sortedModels[0];
      console.log(`\n✓ Selected latest Sonnet model: ${latestModel.id}`);
      console.log(`  → Created: ${latestModel.created_at || 'unknown'}`);
      console.log(`  → Display name: ${latestModel.display_name || 'N/A'}`);
      
      // Verify the model supports thinking by making a minimal test call
      console.log(`\n→ Verifying model supports thinking mode...`);
      try {
        const testResponse = await Promise.race([
          this.client.messages.create({
            model: latestModel.id,
            max_tokens: 2048,  // Must be greater than budget_tokens
            thinking: {
              type: 'enabled',
              budget_tokens: 1024
            },
            messages: [{
              role: 'user',
              content: 'Hi'
            }]
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 10000)
          )
        ]);
        console.log(`  ✓ Model ${latestModel.id} supports thinking mode`);
      } catch (testError) {
        console.warn(`  ⚠ Model ${latestModel.id} may not support thinking mode: ${testError.message}`);
        // Still use it, but log the warning
      }

      console.log('='.repeat(60));
      console.log(`✓ SELECTED MODEL: ${latestModel.id}`);
      console.log('='.repeat(60));
      
      this.cachedModel = latestModel.id;
      this.cacheTimestamp = Date.now();
      return latestModel.id;

    } catch (error) {
      console.error('Error determining latest model:', error.message);
      console.log(`Using fallback model: ${this.fallbackModel}`);
      this.cachedModel = this.fallbackModel;
      this.cacheTimestamp = Date.now();
      return this.fallbackModel;
    }
  }

  /**
   * Get model synchronously (uses cache or fallback)
   * Use this for initialization when async isn't available
   */
  getModelSync() {
    if (process.env.CLAUDE_MODEL) {
      return process.env.CLAUDE_MODEL;
    }
    return this.cachedModel || this.fallbackModel;
  }

  /**
   * Clear cache (force refresh on next call)
   */
  clearCache() {
    this.cachedModel = null;
    this.cacheTimestamp = null;
  }
}

// Export singleton instance
module.exports = new ModelResolver();

