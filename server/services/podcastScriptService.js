const Anthropic = require('@anthropic-ai/sdk');
const prompts = require('../prompts/podcastGeneration');

/**
 * Service for generating podcast scripts using Claude
 */
class PodcastScriptService {
  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.error('ERROR: ANTHROPIC_API_KEY is not set in environment variables');
    }

    this.client = new Anthropic({
      apiKey: apiKey
    });
    this.model = 'claude-sonnet-4-20250514';
  }

  /**
   * Generate podcast script from bank analysis report
   * @param {string} bankName - Name of the bank
   * @param {string} reportAnalysis - Full analysis text from Claude
   * @param {Array<string>} selectedExperts - Array of expert IDs to include
   * @param {Object} trendsData - Financial trends data
   * @param {Function} streamCallback - Optional callback for streaming
   * @returns {Promise<Object>} Script with segments array
   */
  async generateScript(bankName, reportAnalysis, selectedExperts, trendsData, streamCallback = null) {
    try {
      console.log(`Generating podcast script for ${bankName} with experts:`, selectedExperts);

      // Build the prompt
      const prompt = selectedExperts.length > 0
        ? prompts.generatePodcastScript(bankName, reportAnalysis, selectedExperts, trendsData)
        : prompts.generateSoloScript(bankName, reportAnalysis);

      if (streamCallback) {
        streamCallback({
          stage: 'generating_script',
          message: 'Bankskie is preparing the show...'
        });
      }

      // Call Claude API
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 16000,
        messages: [{
          role: 'user',
          content: prompt
        }],
        system: prompts.systemPrompt
      });

      // Extract text from response
      const scriptText = response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      console.log('Script generated, length:', scriptText.length);

      // Parse script into segments
      const segments = this._parseScript(scriptText);

      console.log(`Parsed ${segments.length} segments from script`);

      return {
        success: true,
        script: {
          fullText: scriptText,
          segments,
          bankName,
          experts: selectedExperts,
          metadata: {
            model: this.model,
            generatedAt: new Date().toISOString(),
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens
          }
        }
      };

    } catch (error) {
      console.error('Error generating podcast script:', error);
      throw new Error(`Script generation error: ${error.message}`);
    }
  }

  /**
   * Parse script text into segments for TTS
   * Format: [SPEAKER_ID]: Dialog text
   * @param {string} scriptText - Full script text
   * @returns {Array} Array of {speaker, text} objects
   */
  _parseScript(scriptText) {
    const segments = [];
    const lines = scriptText.split('\n');

    // Regex to match [SPEAKER_ID]: text
    const speakerPattern = /^\[([A-Z_]+)\]:\s*(.+)$/;

    for (const line of lines) {
      const match = line.match(speakerPattern);
      if (match) {
        const speaker = match[1];
        const text = match[2].trim();

        // Only add if text is not empty
        if (text.length > 0) {
          segments.push({
            speaker,
            text
          });
        }
      }
    }

    return segments;
  }

  /**
   * Estimate podcast duration based on word count
   * Average speaking rate: ~150 words per minute
   * @param {string} scriptText - Full script text
   * @returns {number} Estimated duration in minutes
   */
  estimateDuration(scriptText) {
    const wordCount = scriptText.split(/\s+/).length;
    const durationMinutes = wordCount / 150;
    return Math.round(durationMinutes * 10) / 10; // Round to 1 decimal
  }

  /**
   * Get statistics about the script
   * @param {Array} segments - Parsed script segments
   * @returns {Object} Statistics
   */
  getScriptStats(segments) {
    const stats = {
      totalSegments: segments.length,
      speakerCounts: {},
      averageSegmentLength: 0
    };

    let totalLength = 0;

    for (const segment of segments) {
      // Count by speaker
      if (!stats.speakerCounts[segment.speaker]) {
        stats.speakerCounts[segment.speaker] = 0;
      }
      stats.speakerCounts[segment.speaker]++;

      // Track length
      totalLength += segment.text.length;
    }

    stats.averageSegmentLength = Math.round(totalLength / segments.length);

    return stats;
  }
}

module.exports = PodcastScriptService;
