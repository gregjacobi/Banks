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
      'managementInterview',
      'techAnnouncement',
      'strategyAnalysis',  // Legacy
      'analystReports'     // Legacy
    ],
    index: true
  },

  // Document type (user-categorized for RAG pipeline)
  documentType: {
    type: String,
    enum: [
      'investor_presentation',
      'management_interview',
      'earnings_transcript',
      'tech_announcement',
      'strategy_analysis',
      'analyst_report',
      'other'
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
  }],

  // Phase 1 auto-download tracking
  phase1AutoDownload: {
    type: Boolean,
    default: false // Whether auto-download was attempted in Phase 1
  },

  phase1AutoDownloadAt: {
    type: Date // When auto-download was attempted
  },

  phase1DownloadSuccess: {
    type: Boolean // Whether Phase 1 auto-download succeeded
  },

  // RAG pipeline integration
  uploadedToRAG: {
    type: Boolean,
    default: false
  },

  ragStatus: {
    type: String,
    enum: ['not_uploaded', 'uploading', 'completed', 'failed'],
    default: 'not_uploaded'
  },

  ragDocumentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroundingDocument'
  },

  ragUploadedAt: {
    type: Date
  },

  ragError: {
    type: String
  }

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

/**
 * Set document type (for RAG categorization)
 */
sourceSchema.methods.setDocumentType = async function(documentType) {
  this.documentType = documentType;
  return this.save();
};

/**
 * Mark as uploading to RAG
 */
sourceSchema.methods.startRAGUpload = async function() {
  this.ragStatus = 'uploading';
  return this.save();
};

/**
 * Mark RAG upload as completed
 */
sourceSchema.methods.completeRAGUpload = async function(ragDocumentId) {
  this.uploadedToRAG = true;
  this.ragStatus = 'completed';
  this.ragDocumentId = ragDocumentId;
  this.ragUploadedAt = new Date();
  this.ragError = null;
  return this.save();
};

/**
 * Mark RAG upload as failed
 */
sourceSchema.methods.failRAGUpload = async function(errorMessage) {
  this.ragStatus = 'failed';
  this.ragError = errorMessage;
  return this.save();
};

/**
 * Mark Phase 1 auto-download attempt
 */
sourceSchema.methods.markPhase1Download = async function(success) {
  this.phase1AutoDownload = true;
  this.phase1AutoDownloadAt = new Date();
  this.phase1DownloadSuccess = success;
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

/**
 * Get document checklist for a bank (grouped by document type)
 */
sourceSchema.statics.getDocumentChecklist = async function(idrssd) {
  const sources = await this.find({
    idrssd,
    documentType: { $exists: true, $ne: null }
  }).sort({ foundAt: -1 });

  // Group by document type
  const checklist = {
    investor_presentation: [],
    management_interview: [],
    earnings_transcript: [],
    tech_announcement: [],
    other: []
  };

  sources.forEach(source => {
    if (checklist[source.documentType]) {
      checklist[source.documentType].push(source);
    }
  });

  return checklist;
};

module.exports = mongoose.model('Source', sourceSchema);
