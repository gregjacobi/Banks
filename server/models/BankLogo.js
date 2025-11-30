const mongoose = require('mongoose');

/**
 * Bank Logo Model
 * Stores metadata for bank logo images in GridFS
 * Logo files themselves are stored in 'images' GridFS bucket
 * Previously stored as image files in /server/data/logos/
 */
const bankLogoSchema = new mongoose.Schema({
  // Bank identifier (unique - one logo per bank)
  idrssd: {
    type: String,
    required: true,
    unique: true,
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

  // Content type (image/png, image/jpeg, image/svg+xml)
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
 * Get logo for a bank
 */
bankLogoSchema.statics.getForBank = function(idrssd) {
  return this.findOne({ idrssd });
};

/**
 * Check if logo exists for a bank
 */
bankLogoSchema.statics.existsForBank = async function(idrssd) {
  const count = await this.countDocuments({ idrssd });
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
