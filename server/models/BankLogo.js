const mongoose = require('mongoose');

/**
 * Bank Logo Model
 * Stores metadata for bank logo images in GridFS
 * Logo files themselves are stored in 'images' GridFS bucket
 *
 * Supports three Brandfetch logo variants per bank:
 * - 'logo': Full brand logo (horizontal/wide format)
 * - 'symbol': Standalone mark/emblem without text
 * - 'icon': Compact symbol-like representation
 */
const bankLogoSchema = new mongoose.Schema({
  // Bank identifier
  idrssd: {
    type: String,
    required: true,
    index: true
  },

  // Logo variant type (logo, symbol, icon)
  variant: {
    type: String,
    required: true,
    enum: ['logo', 'symbol', 'icon'],
    index: true
  },

  // GridFS file ID (reference to image file in 'images' bucket)
  gridfsFileId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  // Original filename
  filename: {
    type: String,
    required: true
  },

  // Content type (image/png, image/jpeg, image/svg+xml, image/webp)
  contentType: {
    type: String,
    required: true
  },

  // File size in bytes
  fileSize: {
    type: Number,
    required: true
  },

  // Source of the logo
  source: {
    type: String,
    default: 'brandfetch'
  },

  // When the logo was fetched
  fetchedAt: {
    type: Date,
    default: Date.now
  }

}, {
  timestamps: true
});

// Compound unique index: one of each variant per bank
bankLogoSchema.index({ idrssd: 1, variant: 1 }, { unique: true });

// Instance methods

/**
 * Get read stream for this logo
 */
bankLogoSchema.methods.getReadStream = function() {
  const { imageBucket } = require('../config/gridfs');
  return imageBucket.openDownloadStream(this.gridfsFileId);
};

/**
 * Get logo buffer
 */
bankLogoSchema.methods.getBuffer = async function() {
  const stream = this.getReadStream();
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

/**
 * Delete logo file from GridFS
 */
bankLogoSchema.methods.deleteFile = async function() {
  const { imageBucket } = require('../config/gridfs');
  await imageBucket.delete(this.gridfsFileId);
  return this.deleteOne();
};

// Static methods

/**
 * Get logo for a bank by variant
 * @param {string} idrssd - Bank ID
 * @param {string} variant - Logo variant ('logo', 'symbol', 'icon')
 */
bankLogoSchema.statics.getForBank = function(idrssd, variant = 'logo') {
  return this.findOne({ idrssd, variant });
};

/**
 * Get all logo variants for a bank
 * @param {string} idrssd - Bank ID
 */
bankLogoSchema.statics.getAllVariantsForBank = function(idrssd) {
  return this.find({ idrssd });
};

/**
 * Check if logo exists for a bank (any variant)
 */
bankLogoSchema.statics.existsForBank = async function(idrssd, variant = null) {
  const query = variant ? { idrssd, variant } : { idrssd };
  const count = await this.countDocuments(query);
  return count > 0;
};

/**
 * Get total logo storage size
 */
bankLogoSchema.statics.getTotalSize = async function() {
  const result = await this.aggregate([
    { $group: { _id: null, totalSize: { $sum: '$fileSize' } } }
  ]);
  return result.length > 0 ? result[0].totalSize : 0;
};

/**
 * Get logo count
 */
bankLogoSchema.statics.getCount = function() {
  return this.countDocuments();
};

module.exports = mongoose.model('BankLogo', bankLogoSchema);
