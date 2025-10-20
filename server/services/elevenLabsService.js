const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');
const fs = require('fs').promises;
const path = require('path');
const { Readable } = require('stream');

/**
 * Service for interacting with ElevenLabs API
 * Handles text-to-speech conversion for podcast generation
 */
class ElevenLabsService {
  constructor() {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      console.error('ERROR: ELEVENLABS_API_KEY is not set in environment variables');
    } else {
      console.log('ElevenLabs API Key loaded successfully');
    }

    this.client = new ElevenLabsClient({
      apiKey: apiKey
    });

    // Character voice mappings - optimized for natural, podcast-style conversations
    // Mix of male and female voices with conversational/narrative characteristics
    this.voices = {
      BANKSKIE: 'TxGEqnHWrfWFTfGW9XjX', // Josh (Male) - natural, conversational, All-In podcast style
      WARREN_VAULT: 'IKne3meq5aSn9XLyUdCD', // Charlie (Male) - energetic, confident, finance bro vibes
      DR_SOFIA_BANKS: '21m00Tcm4TlvDq8ikWAM', // Rachel (Female) - calm, clear, educational, upbeat
      AVA_AGENTIC: 'EXAVITQu4vr4xnSDxMaL', // Bella (Female) - modern, soft, young
      MAYA_CUSTOMER: 'ThT5KcBeYPX3keUQqHPh'  // Nicole (Female) - warm, expressive, conversational
    };

    // Note: text-to-dialogue API doesn't support per-speaker speed settings
    // Keeping this for potential future use with individual TTS calls
    this.speedSettings = {
      BANKSKIE: 1.2,              // Fast-paced, energetic host
      WARREN_VAULT: 1.15,         // Slightly faster, confident analyst
      DR_SOFIA_BANKS: 1.0,        // Normal speed, clear educator
      AVA_AGENTIC: 1.2,           // Fast, tech-savvy (max speed)
      MAYA_CUSTOMER: 1.1          // Slightly faster, friendly
    };

    // Model to use - using eleven_turbo_v2_5 for better speed and natural conversation
    this.model = 'eleven_turbo_v2_5';
  }

  /**
   * Get list of available voices from user's ElevenLabs account
   */
  async getAvailableVoices() {
    try {
      const voices = await this.client.voices.getAll();
      return voices.voices.map(voice => ({
        id: voice.voice_id,
        name: voice.name,
        category: voice.category,
        labels: voice.labels
      }));
    } catch (error) {
      console.error('Error fetching ElevenLabs voices:', error);
      throw new Error(`Failed to fetch voices: ${error.message}`);
    }
  }

  /**
   * Convert a single text segment to speech with retry logic
   * @param {string} text - Text to convert
   * @param {string} voiceId - Voice ID to use
   * @param {number} retries - Number of retries remaining
   * @returns {Promise<Buffer>} Audio buffer
   */
  async textToSpeech(text, voiceId, retries = 3) {
    try {
      console.log(`Generating speech for ${text.substring(0, 50)}... with voice ${voiceId}`);

      // Create timeout promise
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TTS request timeout (30s)')), 30000)
      );

      // Race between API call and timeout
      const audioStreamPromise = this.client.textToSpeech.convert(voiceId, {
        text,
        model_id: this.model,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true
        }
      });

      const audioStream = await Promise.race([audioStreamPromise, timeout]);

      // Convert stream to buffer
      const chunks = [];
      for await (const chunk of audioStream) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      console.error(`Error generating speech (${retries} retries left):`, error.message);

      if (retries > 0) {
        console.log(`Retrying after 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.textToSpeech(text, voiceId, retries - 1);
      }

      throw new Error(`Text-to-speech error after retries: ${error.message}`);
    }
  }

  /**
   * Generate podcast audio from script segments using text-to-dialogue
   * Text-to-dialogue creates more natural conversations with better flow
   * Note: text-to-dialogue doesn't support per-speaker voice_settings, but provides better conversational quality
   * @param {Array} segments - Array of {speaker, text} objects
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Buffer>} Combined audio buffer
   */
  async generatePodcastAudio(segments, progressCallback = null) {
    try {
      console.log(`Generating podcast with ${segments.length} segments using text-to-dialogue...`);

      // Update progress
      if (progressCallback) {
        progressCallback({
          stage: 'generating_audio',
          current: 0,
          total: segments.length,
          speaker: 'Initializing'
        });
      }

      // Convert segments to text-to-dialogue format
      // Note: text-to-dialogue only supports text and voiceId per input
      const dialogueInputs = segments.map((segment) => {
        // Handle legacy speaker ID migration (PROFESSOR_LEDGER -> DR_SOFIA_BANKS)
        const speakerId = segment.speaker === 'PROFESSOR_LEDGER' ? 'DR_SOFIA_BANKS' : segment.speaker;
        const voiceId = this.voices[speakerId] || this.voices.BANKSKIE;

        return {
          text: segment.text,
          voiceId: voiceId  // camelCase, not snake_case
        };
      });

      // Text-to-dialogue has a 3000 character limit, so we need to chunk
      const chunks = this._chunkDialogueInputs(dialogueInputs);
      console.log(`Split into ${chunks.length} chunks to fit API limits`);

      const audioBuffers = [];
      let processedSegments = 0;

      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Processing chunk ${i + 1}/${chunks.length} with ${chunk.length} segments...`);

        // Generate audio for this chunk using text-to-dialogue
        const audioStream = await this.client.textToDialogue.convert({
          model_id: 'eleven_turbo_v2_5',
          inputs: chunk
        });

        // Convert stream to buffer
        const chunkBuffer = [];
        for await (const audioPart of audioStream) {
          chunkBuffer.push(audioPart);
        }

        audioBuffers.push(Buffer.concat(chunkBuffer));

        // Update progress
        processedSegments += chunk.length;
        if (progressCallback) {
          progressCallback({
            stage: 'generating_audio',
            current: processedSegments,
            total: segments.length,
            speaker: `Chunk ${i + 1}/${chunks.length}`
          });
        }
      }

      console.log(`Generated ${chunks.length} audio chunks, concatenating...`);
      return Buffer.concat(audioBuffers);
    } catch (error) {
      console.error('Error generating podcast audio:', error);
      throw new Error(`Podcast generation error: ${error.message}`);
    }
  }

  /**
   * Chunk dialogue inputs to stay under the 3000 character API limit
   * Tries to keep conversations coherent by not breaking mid-exchange
   * @param {Array} inputs - Array of dialogue input objects
   * @returns {Array} Array of chunked input arrays
   */
  _chunkDialogueInputs(inputs) {
    const MAX_CHARS = 2500; // Safety margin below 3000 limit
    const chunks = [];
    let currentChunk = [];
    let currentCharCount = 0;

    for (const input of inputs) {
      const textLength = input.text.length;

      // If adding this would exceed limit, start new chunk
      if (currentCharCount + textLength > MAX_CHARS && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentCharCount = 0;
      }

      currentChunk.push(input);
      currentCharCount += textLength;
    }

    // Add final chunk if it has content
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Generate silence buffer (for pauses between speakers)
   * @param {number} durationMs - Duration in milliseconds
   * @returns {Promise<Buffer>} Silence buffer
   */
  async generateSilence(durationMs) {
    // Generate a simple silence buffer (MP3 format)
    // This is a minimal MP3 silence frame
    const sampleRate = 44100;
    const samplesNeeded = Math.floor((sampleRate * durationMs) / 1000);
    const silenceBuffer = Buffer.alloc(samplesNeeded * 2); // 16-bit audio
    return silenceBuffer;
  }

  /**
   * Save audio buffer to file
   * @param {Buffer} audioBuffer - Audio data
   * @param {string} filePath - Path to save file
   */
  async saveAudioFile(audioBuffer, filePath) {
    try {
      await fs.writeFile(filePath, audioBuffer);
      console.log(`Audio saved to ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('Error saving audio file:', error);
      throw new Error(`Failed to save audio: ${error.message}`);
    }
  }

  /**
   * Get character name for display
   */
  getCharacterName(speakerId) {
    const names = {
      BANKSKIE: 'Bankskie',
      WARREN_VAULT: 'Warren Vault',
      DR_SOFIA_BANKS: 'Dr. Sofia Banks',
      AVA_AGENTIC: 'Ava Agentic',
      MAYA_CUSTOMER: 'Maya Customer'
    };
    return names[speakerId] || 'Unknown';
  }

  /**
   * Get character description
   */
  getCharacterDescription(speakerId) {
    const descriptions = {
      BANKSKIE: 'Host - Energetic, street-smart guide to banking analysis',
      WARREN_VAULT: 'Investor Analyst - Investment health & shareholder metrics',
      DR_SOFIA_BANKS: 'Banking Professor - Explains concepts & regulatory context with upbeat clarity',
      AVA_AGENTIC: 'AI Banking Guru - AI opportunities & digital transformation',
      MAYA_CUSTOMER: 'CX Expert - Customer impact & experience implications'
    };
    return descriptions[speakerId] || '';
  }
}

module.exports = ElevenLabsService;
