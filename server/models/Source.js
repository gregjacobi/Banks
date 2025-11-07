const mongoose = require('mongoose');

/**
 * Source Schema
 * Stores external data sources discovered during research
 */
const sourceSchema = new mongoose.Schema({
  // Unique identifier
  sourceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Bank this source is for
  idrssd: {
    type: String,
    required: true,
    index: true
  },

  // Session this source belongs to
  sessionId: {
    type: String,
    required: true,
    index: true
  },

  // Category of source
  category: {
    type: String,
    required: true,
    enum: [
      'investorPresentation',
      'earningsTranscript',
      'strategyAnalysis',
      'analystReports'
    ],
    index: true
  },

  // Source details
  url: {
    type: String,
    required: true
  },

  title: {
    type: String,
    required: true
  },

  preview: {
    type: String
  },

  date: {
    type: String // e.g., "Q2 2025", "Oct 2025"
  },

  // Fetched content
  content: {
    type: String // Full text content of the source
  },

  contentLength: {
    type: Number // Length of fetched content in characters
  },

  contentType: {
    type: String // Type of content: 'article', 'html', 'pdf', 'text', 'error'
  },

  fetchable: {
    type: Boolean, // Whether content was successfully fetched
    default: false
  },

  // Content quality indicators
  isProbablyPaywalled: {
    type: Boolean,
    default: false
  },

  isProbablyTruncated: {
    type: Boolean,
    default: false
  },

  requiresWebSearch: {
    type: Boolean,
    default: false
  },

  // Fetch status (separate from approval status)
  fetchStatus: {
    type: String,
    enum: ['not_fetched', 'fetching', 'fetched', 'fetch_failed'],
    default: 'not_fetched',
    index: true
  },

  fetchError: {
    type: String // Error message if fetch failed
  },

  fetchedAt: {
    type: Date // When content was fetched
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'ignored'],
    default: 'pending',
    index: true
  },

  // Metadata
  confidence: {
    type: Number,
    min: 0,
    max: 1
  },

  score: {
    type: Number // Calculated score based on quality, recency, domain reputation
  },

  recommended: {
    type: Boolean,
    default: false // AI-recommended source based on quality criteria
  },

  foundAt: {
    type: Date,
    default: Date.now
  },

  approvedAt: {
    type: Date
  },

  // Usage tracking
  referencedCount: {
    type: Number,
    default: 0
  },

  usedInReports: [{
    type: String // Array of report IDs that used this source
  }]

}, {
  timestamps: true
});

// Compound indexes
sourceSchema.index({ idrssd: 1, sessionId: 1 });
sourceSchema.index({ idrssd: 1, status: 1 });
sourceSchema.index({ sessionId: 1, category: 1 });

// Instance methods

/**
 * Approve this source
 */
sourceSchema.methods.approve = async function() {
  this.status = 'approved';
  this.approvedAt = new Date();
  return this.save();
};

/**
 * Ignore this source
 */
sourceSchema.methods.ignore = async function() {
  this.status = 'ignored';
  return this.save();
};

/**
 * Mark as pending again
 */
sourceSchema.methods.resetToPending = async function() {
  this.status = 'pending';
  this.approvedAt = null;
  return this.save();
};

/**
 * Mark fetch as in progress
 */
sourceSchema.methods.startFetch = async function() {
  this.fetchStatus = 'fetching';
  return this.save();
};

/**
 * Store fetched content
 */
sourceSchema.methods.storeFetchedContent = async function(fetchResult) {
  this.content = fetchResult.content;
  this.contentLength = fetchResult.contentLength || 0;
  this.contentType = fetchResult.contentType || 'unknown';
  this.fetchable = fetchResult.fetchable || false;
  this.fetchStatus = fetchResult.fetchable ? 'fetched' : 'fetch_failed';
  this.fetchedAt = new Date();

  // Store content quality indicators
  this.isProbablyPaywalled = fetchResult.isProbablyPaywalled || false;
  this.isProbablyTruncated = fetchResult.isProbablyTruncated || false;
  this.requiresWebSearch = fetchResult.requiresWebSearch || false;

  if (!fetchResult.fetchable && fetchResult.error) {
    this.fetchError = fetchResult.error;
  }

  return this.save();
};

/**
 * Mark fetch as failed
 */
sourceSchema.methods.markFetchFailed = async function(errorMessage) {
  this.fetchStatus = 'fetch_failed';
  this.fetchError = errorMessage;
  return this.save();
};

// Static methods

/**
 * Get all sources for a session
 */
sourceSchema.statics.getBySession = function(sessionId) {
  return this.find({ sessionId }).sort({ foundAt: 1 });
};

/**
 * Get approved sources for a session
 */
sourceSchema.statics.getApprovedBySession = function(sessionId) {
  return this.find({ sessionId, status: 'approved' }).sort({ category: 1, foundAt: 1 });
};

/**
 * Get sources by IDs
 */
sourceSchema.statics.getByIds = function(sourceIds) {
  return this.find({ sourceId: { $in: sourceIds } });
};

/**
 * Get all sources for a bank
 */
sourceSchema.statics.getByBank = function(idrssd) {
  return this.find({ idrssd }).sort({ foundAt: -1 });
};

module.exports = mongoose.model('Source', sourceSchema);
