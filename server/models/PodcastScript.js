const mongoose = require('mongoose');

/**
 * Podcast Script Model
 * Stores podcast scripts before TTS generation
 * Previously stored as JSON files in /server/data/podcasts/scripts/
 */
const podcastScriptSchema = new mongoose.Schema({
  // Bank identifier
  idrssd: {
    type: String,
    required: true,
    index: true
  },

  // Reporting period for this podcast
  reportingPeriod: {
    type: Date,
    required: true
  },

  // Full script data (dialogue segments, metadata)
  scriptData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // Reference to generated audio file (if generated)
  audioFileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PodcastAudio'
  },

  // Estimated duration in seconds
  duration: {
    type: Number
  },

  // When the script was generated
  generatedAt: {
    type: Date,
    default: Date.now
  }

}, {
  timestamps: true
});

// Compound indexes
podcastScriptSchema.index({ idrssd: 1, reportingPeriod: -1 });
podcastScriptSchema.index({ idrssd: 1, createdAt: -1 });

// Static methods

/**
 * Get latest script for a bank
 */
podcastScriptSchema.statics.getLatestForBank = function(idrssd) {
  return this.findOne({ idrssd }).sort({ createdAt: -1 });
};

/**
 * Get script for specific bank and period
 */
podcastScriptSchema.statics.getForBankAndPeriod = function(idrssd, reportingPeriod) {
  return this.findOne({ idrssd, reportingPeriod }).sort({ createdAt: -1 });
};

/**
 * Get all scripts for a bank
 */
podcastScriptSchema.statics.getAllForBank = function(idrssd) {
  return this.find({ idrssd }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('PodcastScript', podcastScriptSchema);
