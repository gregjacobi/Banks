const mongoose = require('mongoose');

/**
 * Presentation Data Model
 * Stores presentation slide data
 * Previously stored as JSON files in /server/data/presentations/
 */
const presentationDataSchema = new mongoose.Schema({
  // Bank identifier
  idrssd: {
    type: String,
    required: true,
    index: true
  },

  // Reporting period for this presentation
  reportingPeriod: {
    type: Date,
    required: true
  },

  // Full presentation data (slides, metadata)
  presentationData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // When the presentation was generated
  generatedAt: {
    type: Date,
    default: Date.now
  }

}, {
  timestamps: true
});

// Compound indexes
presentationDataSchema.index({ idrssd: 1, reportingPeriod: -1 });
presentationDataSchema.index({ idrssd: 1, createdAt: -1 });

// Static methods

/**
 * Get latest presentation for a bank
 */
presentationDataSchema.statics.getLatestForBank = function(idrssd) {
  return this.findOne({ idrssd }).sort({ createdAt: -1 });
};

/**
 * Get presentation for specific bank and period
 */
presentationDataSchema.statics.getForBankAndPeriod = function(idrssd, reportingPeriod) {
  return this.findOne({ idrssd, reportingPeriod }).sort({ createdAt: -1 });
};

/**
 * Get all presentations for a bank
 */
presentationDataSchema.statics.getAllForBank = function(idrssd) {
  return this.find({ idrssd }).sort({ createdAt: -1 });
};

/**
 * Delete old presentations for a bank (keep most recent N)
 */
presentationDataSchema.statics.deleteOldPresentations = async function(idrssd, keepCount = 3) {
  const presentations = await this.find({ idrssd })
    .sort({ createdAt: -1 })
    .skip(keepCount);

  const idsToDelete = presentations.map(p => p._id);
  return this.deleteMany({ _id: { $in: idsToDelete } });
};

module.exports = mongoose.model('PresentationData', presentationDataSchema);
