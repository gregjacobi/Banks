const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');
require('dotenv').config();

/**
 * List all available voices from ElevenLabs account
 * Filter for natural and podcast-suitable voices
 */
async function listVoices() {
  const client = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY
  });

  try {
    console.log('Fetching available voices from ElevenLabs...\n');

    const response = await client.voices.getAll();
    const voices = response.voices;

    console.log(`Found ${voices.length} total voices\n`);
    console.log('='.repeat(80));

    // Group voices by category
    const voicesByCategory = {};

    voices.forEach(voice => {
      const category = voice.category || 'uncategorized';
      if (!voicesByCategory[category]) {
        voicesByCategory[category] = [];
      }
      voicesByCategory[category].push(voice);
    });

    // Display voices
    Object.keys(voicesByCategory).sort().forEach(category => {
      console.log(`\n${category.toUpperCase()}`);
      console.log('-'.repeat(80));

      voicesByCategory[category].forEach(voice => {
        const labels = voice.labels ? Object.entries(voice.labels)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ') : '';

        console.log(`\nName: ${voice.name}`);
        console.log(`ID: ${voice.voice_id}`);
        console.log(`Category: ${voice.category}`);
        if (labels) {
          console.log(`Labels: ${labels}`);
        }
        if (voice.description) {
          console.log(`Description: ${voice.description}`);
        }
      });
    });

    console.log('\n' + '='.repeat(80));

    // Filter for natural/podcast voices
    console.log('\n\nRECOMMENDED VOICES FOR PODCAST:');
    console.log('='.repeat(80));

    const podcastVoices = voices.filter(voice => {
      const labels = voice.labels || {};
      const name = (voice.name || '').toLowerCase();
      const description = (voice.description || '').toLowerCase();

      // Look for natural, conversational, podcast-friendly characteristics
      const isNatural = labels.use_case?.toLowerCase().includes('conversational') ||
                       labels.use_case?.toLowerCase().includes('narrative') ||
                       labels.descriptive?.toLowerCase().includes('natural') ||
                       description.includes('conversational') ||
                       description.includes('podcast');

      return isNatural;
    });

    podcastVoices.forEach(voice => {
      const labels = voice.labels || {};
      console.log(`\n${voice.name} (${labels.gender || 'unknown gender'})`);
      console.log(`  ID: ${voice.voice_id}`);
      console.log(`  Age: ${labels.age || 'unknown'}`);
      console.log(`  Accent: ${labels.accent || 'unknown'}`);
      console.log(`  Use case: ${labels.use_case || 'unknown'}`);
      console.log(`  Descriptive: ${labels.descriptive || 'N/A'}`);
    });

  } catch (error) {
    console.error('Error fetching voices:', error);
  }
}

listVoices();
