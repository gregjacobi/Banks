const mongoose = require('mongoose');

/**
 * Research Report Model
 * Stores AI-generated bank analysis reports
 * Previously stored as JSON files in /server/data/research/
 */
const researchReportSchema = new mongoose.Schema({
  // Bank identifier
  idrssd: {
    type: String,
    required: true,
    index: true
  },

  // Report title
  title: {
    type: String,
    required: true
  },

  // Full report data (previously stored as JSON file)
  reportData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // Agent version that generated this report
  agentVersion: {
    type: String,
    default: 'v2.0'
  },

  // When the report was generated
  generatedAt: {
    type: Date,
    default: Date.now
  }

}, {
  timestamps: true  // Adds createdAt and updatedAt
});

// Compound index for efficient queries
researchReportSchema.index({ idrssd: 1, createdAt: -1 });

// Static methods

/**
 * Get latest report for a bank
 */
researchReportSchema.statics.getLatestForBank = function(idrssd) {
  return this.findOne({ idrssd }).sort({ createdAt: -1 });
};

/**
 * Get all reports for a bank
 */
researchReportSchema.statics.getAllForBank = function(idrssd) {
  return this.find({ idrssd }).sort({ createdAt: -1 });
};

/**
 * Delete old reports for a bank (keep most recent N)
 */
researchReportSchema.statics.deleteOldReports = async function(idrssd, keepCount = 5) {
  const reports = await this.find({ idrssd })
    .sort({ createdAt: -1 })
    .skip(keepCount);

  const idsToDelete = reports.map(r => r._id);
  return this.deleteMany({ _id: { $in: idsToDelete } });
};

module.exports = mongoose.model('ResearchReport', researchReportSchema);
