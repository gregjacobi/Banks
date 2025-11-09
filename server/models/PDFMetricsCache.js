const mongoose = require('mongoose');

/**
 * PDFMetricsCache Model
 * Caches extracted financial metrics from PDF parsing to avoid re-parsing
 */
const pdfMetricsCacheSchema = new mongoose.Schema({
  idrssd: {
    type: String,
    required: true,
    index: true
  },
  reportingPeriod: {
    type: Date,
    required: true,
    index: true
  },
  // Hash of PDF file(s) used for extraction (to detect if PDF changed)
  pdfHash: {
    type: String,
    required: true
  },
  // PDF IDs that were analyzed
  pdfIds: [{
    type: String
  }],
  // Cached extraction results
  metrics: {
    roa: Number,
    roe: Number,
    nim: Number,
    efficiencyRatio: Number,
    tier1LeverageRatio: Number
  },
  balanceSheet: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  incomeStatement: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  sources: [String],
  confidence: String,
  note: String,
  warnings: [String],
  period: String,
  quarter: String,
  incomeStatementBasis: String,
  metricsBasis: String,
  // Metadata
  extractedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound index for efficient lookup
pdfMetricsCacheSchema.index({ idrssd: 1, reportingPeriod: 1, pdfHash: 1 }, { unique: true });

// TTL index: automatically delete cache entries older than 90 days
pdfMetricsCacheSchema.index({ extractedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Static methods
pdfMetricsCacheSchema.statics.findByBankAndPeriod = function(idrssd, reportingPeriod, pdfHash) {
  return this.findOne({
    idrssd,
    reportingPeriod: new Date(reportingPeriod),
    pdfHash
  }).lean();
};

pdfMetricsCacheSchema.statics.findByBankAndPeriodAnyHash = function(idrssd, reportingPeriod) {
  return this.findOne({
    idrssd,
    reportingPeriod: new Date(reportingPeriod)
  })
  .sort({ extractedAt: -1 })
  .lean();
};

module.exports = mongoose.model('PDFMetricsCache', pdfMetricsCacheSchema);

