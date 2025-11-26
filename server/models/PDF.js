const mongoose = require('mongoose');

/**
 * PDF Schema
 * Stores PDF documents attached to bank research
 */
const pdfSchema = new mongoose.Schema({
  // Unique identifier
  pdfId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Bank this PDF is for
  idrssd: {
    type: String,
    required: true,
    index: true
  },

  // Original filename
  originalFilename: {
    type: String,
    required: true
  },

  // Stored filename (with unique ID)
  storedFilename: {
    type: String,
    required: true
  },

  // File size in bytes
  fileSize: {
    type: Number,
    required: true
  },

  // Optional: Source this PDF was created from
  sourceId: {
    type: String,
    index: true
  },

  // Optional: URL this PDF was downloaded from
  sourceUrl: {
    type: String
  },

  // Upload type: 'manual' or 'from_source'
  uploadType: {
    type: String,
    enum: ['manual', 'from_source'],
    default: 'manual'
  },

  // Optional: Description or notes
  description: {
    type: String
  },

  // RAG Processing Status
  ragStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  ragProcessedAt: {
    type: Date
  },
  ragError: {
    type: String
  },
  ragChunkCount: {
    type: Number,
    default: 0
  },
  ragDocumentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroundingDocument'
  },

  // Metadata
  uploadedAt: {
    type: Date,
    default: Date.now
  }

}, {
  timestamps: true
});

// Compound indexes
pdfSchema.index({ idrssd: 1, uploadedAt: -1 });

// Instance methods

/**
 * Get file path for this PDF
 */
pdfSchema.methods.getFilePath = function() {
  const path = require('path');
  const PDFS_DIR = path.join(__dirname, '../data/research/pdfs');
  return path.join(PDFS_DIR, this.idrssd, this.storedFilename);
};

// Static methods

/**
 * Get all PDFs for a bank
 */
pdfSchema.statics.getByBank = function(idrssd) {
  return this.find({ idrssd }).sort({ uploadedAt: -1 });
};

/**
 * Get total size of PDFs for a bank
 */
pdfSchema.statics.getTotalSize = async function(idrssd) {
  const result = await this.aggregate([
    { $match: { idrssd } },
    { $group: { _id: null, totalSize: { $sum: '$fileSize' } } }
  ]);
  return result.length > 0 ? result[0].totalSize : 0;
};

/**
 * Get count of PDFs for a bank
 */
pdfSchema.statics.getCount = function(idrssd) {
  return this.countDocuments({ idrssd });
};

module.exports = mongoose.model('PDF', pdfSchema);
