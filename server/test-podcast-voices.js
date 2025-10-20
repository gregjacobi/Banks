/**
 * Quick script to test all podcast voices
 * Generates a short conversation with all 5 characters
 */

require('dotenv').config();
const ElevenLabsService = require('./services/elevenLabsService');
const path = require('path');

const testScript = [
  {
    speaker: 'BANKSKIE',
    text: 'Welcome to The Bankskie Show! I\'m your host Bankskie, and today we\'re testing out our podcast voices.'
  },
  {
    speaker: 'WARREN_VAULT',
    text: 'Warren Vault here. As an investor analyst, I focus on the numbers that matter to shareholders.'
  },
  {
    speaker: 'DR_SOFIA_BANKS',
    text: 'Hi everyone! I\'m Dr. Sofia Banks, and I\'m excited to help explain complex banking concepts in a clear and upbeat way.'
  },
  {
    speaker: 'AVA_AGENTIC',
    text: 'Ava Agentic speaking. I\'m all about AI and digital transformation in banking. The future is here!'
  },
  {
    speaker: 'MAYA_CUSTOMER',
    text: 'And I\'m Maya Customer. I always keep the customer experience at the heart of everything we discuss.'
  },
  {
    speaker: 'BANKSKIE',
    text: 'Great! Now you\'ve heard all five voices. Thanks for listening to this quick test episode!'
  }
];

(async () => {
  try {
    console.log('🎙️  Generating test podcast with all 5 voices...\n');

    const elevenLabsService = new ElevenLabsService();

    // Show voice mappings
    console.log('Voice Configuration:');
    console.log('===================');
    testScript.forEach(segment => {
      const voiceId = elevenLabsService.voices[segment.speaker];
      const name = elevenLabsService.getCharacterName(segment.speaker);
      const desc = elevenLabsService.getCharacterDescription(segment.speaker);
      console.log(`${name}: ${voiceId}`);
      console.log(`  ${desc}`);
    });
    console.log('');

    // Generate audio
    const audioBuffer = await elevenLabsService.generatePodcastAudio(testScript, (progress) => {
      if (progress.stage === 'generating_audio') {
        console.log(`Progress: ${progress.current}/${progress.total} - ${progress.speaker}`);
      }
    });

    // Save to file
    const outputPath = path.join(__dirname, 'data', 'podcasts', 'test-voices.mp3');
    await elevenLabsService.saveAudioFile(audioBuffer, outputPath);

    console.log('\n✅ Test podcast generated successfully!');
    console.log(`📁 Saved to: ${outputPath}`);
    console.log('\nYou can play it with: open ' + outputPath);

  } catch (error) {
    console.error('❌ Error generating test podcast:', error.message);
    console.error(error);
    process.exit(1);
  }
})();
