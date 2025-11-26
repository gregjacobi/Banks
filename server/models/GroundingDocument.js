const mongoose = require('mongoose');

const groundingDocumentSchema = new mongoose.Schema({
  // Basic info
  filename: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Bank association (for bank-specific documents like uploaded PDFs)
  idrssd: {
    type: String,
    index: true,
    sparse: true  // Allow null for global documents
  },

  // File metadata
  fileSize: Number,  // bytes
  pageCount: Number,
  filePath: String,  // Path to PDF in filesystem

  // Metadata for filtering (user editable)
  topics: [{
    type: String,
    enum: [
      'liquidity',
      'capital',
      'asset_quality',
      'earnings',
      'risk_management',
      'efficiency',
      'growth',
      'technology',
      'strategy',
      'general'
    ]
  }],
  bankTypes: [{
    type: String,
    enum: ['community', 'regional', 'large', 'mega', 'all']
  }],
  assetSizeRange: {
    type: String,
    enum: ['<100M', '100M-1B', '1B-10B', '10B-50B', '>50B', 'all']
  },

  // Processing status
  processingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processingError: String,

  // Stats
  chunkCount: {
    type: Number,
    default: 0
  },
  timesRetrieved: {
    type: Number,
    default: 0
  },
  avgReportRating: Number,  // Average rating of reports that used this doc

  // Effectiveness tracking
  effectiveness: {
    type: Number,
    default: 0  // Calculated from feedback
  }
}, {
  timestamps: true
});

// Index for searching
groundingDocumentSchema.index({ title: 'text', filename: 'text' });
groundingDocumentSchema.index({ topics: 1 });
groundingDocumentSchema.index({ bankTypes: 1 });
groundingDocumentSchema.index({ processingStatus: 1 });

// Methods
groundingDocumentSchema.methods.incrementRetrievalCount = function() {
  this.timesRetrieved += 1;
  return this.save();
};

groundingDocumentSchema.statics.getByTopics = function(topics) {
  return this.find({
    topics: { $in: topics },
    processingStatus: 'completed'
  });
};

groundingDocumentSchema.statics.getByBankType = function(bankType) {
  return this.find({
    $or: [
      { bankTypes: bankType },
      { bankTypes: 'all' }
    ],
    processingStatus: 'completed'
  });
};

groundingDocumentSchema.statics.getByBank = function(idrssd) {
  return this.find({
    idrssd: idrssd,
    processingStatus: 'completed'
  });
};

module.exports = mongoose.model('GroundingDocument', groundingDocumentSchema);
