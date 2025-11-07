const mongoose = require('mongoose');

/**
 * UBPRData Model
 * Stores fetched UBPR (Uniform Bank Performance Report) data from FFIEC
 * for comparison with our calculated metrics
 */
const ubprDataSchema = new mongoose.Schema({
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
  // Key performance metrics from UBPR
  metrics: {
    // Summary Ratios
    roa: Number,                      // Return on Assets (%)
    roe: Number,                      // Return on Equity (%)
    nim: Number,                      // Net Interest Margin (%)
    efficiencyRatio: Number,          // Efficiency Ratio (%)
    tier1LeverageRatio: Number,       // Tier 1 Leverage Ratio (%)
    tier1RiskBasedCapital: Number,    // Tier 1 Risk-Based Capital (%)
    totalRiskBasedCapital: Number,    // Total Risk-Based Capital (%)

    // Asset Quality
    nonperformingAssetsToAssets: Number,
    nonperformingLoansToLoans: Number,
    netChargeoffsToLoans: Number,
    loanLossReserveToLoans: Number,

    // Liquidity
    loansToDeposits: Number,
    coreDepositsToAssets: Number,

    // Additional metrics
    assetGrowth: Number,              // Year-over-year asset growth (%)
    loanGrowth: Number,               // Year-over-year loan growth (%)
    depositGrowth: Number             // Year-over-year deposit growth (%)
  },

  // Raw UBPR response data for reference
  rawData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Metadata
  fetchedAt: {
    type: Date,
    default: Date.now
    // Index defined below via schema.index() for TTL
  },
  dataSource: {
    type: String,
    enum: ['ffiec_api', 'bulk_download', 'manual'],
    default: 'ffiec_api'
  },
  ubprVersion: String,  // Version of UBPR report format

  // Quality indicators
  isComplete: {
    type: Boolean,
    default: false
  },
  missingMetrics: [String]  // List of metrics that couldn't be retrieved
}, {
  timestamps: true
});

// Compound index for efficient querying
ubprDataSchema.index({ idrssd: 1, reportingPeriod: -1 });

// TTL index: automatically delete documents older than 180 days
ubprDataSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

// Static methods

/**
 * Find UBPR data for a specific bank and period
 */
ubprDataSchema.statics.findByBankAndPeriod = function(idrssd, reportingPeriod) {
  return this.findOne({
    idrssd,
    reportingPeriod: new Date(reportingPeriod)
  }).lean();
};

/**
 * Find UBPR data for multiple banks at the same period
 */
ubprDataSchema.statics.findByBanksAndPeriod = function(idrssds, reportingPeriod) {
  return this.find({
    idrssd: { $in: idrssds },
    reportingPeriod: new Date(reportingPeriod)
  }).lean();
};

/**
 * Find latest UBPR data for a bank
 */
ubprDataSchema.statics.findLatestByBank = function(idrssd) {
  return this.findOne({ idrssd })
    .sort({ reportingPeriod: -1 })
    .lean();
};

/**
 * Check if UBPR data exists and is recent (< 7 days old)
 */
ubprDataSchema.statics.isDataFresh = async function(idrssd, reportingPeriod) {
  const data = await this.findOne({
    idrssd,
    reportingPeriod: new Date(reportingPeriod)
  });

  if (!data) return false;

  const daysSinceFetch = (Date.now() - data.fetchedAt) / (1000 * 60 * 60 * 24);
  return daysSinceFetch < 7;
};

module.exports = mongoose.model('UBPRData', ubprDataSchema);
