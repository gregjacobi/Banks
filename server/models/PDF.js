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

  // GridFS file ID (reference to file in 'pdfs' GridFS bucket)
  gridfsFileId: {
    type: mongoose.Schema.Types.ObjectId
  },

  // Content type
  contentType: {
    type: String,
    default: 'application/pdf'
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
 * Get file path for this PDF (DEPRECATED - for backward compatibility only)
 * Use getReadStream() or getBuffer() for GridFS files
 */
pdfSchema.methods.getFilePath = function() {
  // For backward compatibility with old filesystem-based PDFs
  if (!this.gridfsFileId) {
    const path = require('path');
    const PDFS_DIR = path.join(__dirname, '../data/research/pdfs');
    return path.join(PDFS_DIR, this.idrssd, this.storedFilename);
  }
  throw new Error('PDF is stored in GridFS. Use getReadStream() or getBuffer() instead.');
};

/**
 * Get read stream for this PDF from GridFS
 */
pdfSchema.methods.getReadStream = function() {
  if (!this.gridfsFileId) {
    throw new Error('PDF does not have a GridFS file ID');
  }
  const { pdfBucket } = require('../config/gridfs');
  return pdfBucket.openDownloadStream(this.gridfsFileId);
};

/**
 * Get PDF buffer from GridFS (use sparingly - prefer streaming)
 */
pdfSchema.methods.getBuffer = async function() {
  if (!this.gridfsFileId) {
    throw new Error('PDF does not have a GridFS file ID');
  }
  const stream = this.getReadStream();
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

/**
 * Delete PDF file from GridFS
 */
pdfSchema.methods.deleteFile = async function() {
  if (!this.gridfsFileId) {
    throw new Error('PDF does not have a GridFS file ID');
  }
  const { pdfBucket } = require('../config/gridfs');
  await pdfBucket.delete(this.gridfsFileId);
  return this.deleteOne();
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
