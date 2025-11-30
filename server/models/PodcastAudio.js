const mongoose = require('mongoose');

/**
 * Podcast Audio Model
 * Stores metadata for podcast audio files in GridFS
 * Audio files themselves are stored in 'audio' GridFS bucket
 * Previously stored as MP3 files in /server/data/podcasts/
 */
const podcastAudioSchema = new mongoose.Schema({
  // Bank identifier
  idrssd: {
    type: String,
    required: true,
    index: true
  },

  // Reference to podcast script
  scriptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PodcastScript'
  },

  // GridFS file ID (reference to audio file in 'audio' bucket)
  gridfsFileId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  // Original filename
  filename: {
    type: String,
    required: true
  },

  // File size in bytes
  fileSize: {
    type: Number,
    required: true
  },

  // Duration in seconds (if known)
  duration: {
    type: Number
  },

  // When the audio was generated
  generatedAt: {
    type: Date,
    default: Date.now
  }

}, {
  timestamps: true
});

// Compound index
podcastAudioSchema.index({ idrssd: 1, createdAt: -1 });

// Instance methods

/**
 * Get read stream for this audio file
 */
podcastAudioSchema.methods.getReadStream = function() {
  const { audioBucket } = require('../config/gridfs');
  return audioBucket.openDownloadStream(this.gridfsFileId);
};

/**
 * Get audio buffer (use sparingly - prefer streaming)
 */
podcastAudioSchema.methods.getBuffer = async function() {
  const stream = this.getReadStream();
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

/**
 * Delete audio file from GridFS
 */
podcastAudioSchema.methods.deleteFile = async function() {
  const { audioBucket } = require('../config/gridfs');
  await audioBucket.delete(this.gridfsFileId);
  return this.deleteOne();
};

// Static methods

/**
 * Get latest audio for a bank
 */
podcastAudioSchema.statics.getLatestForBank = function(idrssd) {
  return this.findOne({ idrssd })
    .sort({ createdAt: -1 })
    .populate('scriptId');
};

/**
 * Get all audio files for a bank
 */
podcastAudioSchema.statics.getAllForBank = function(idrssd) {
  return this.find({ idrssd })
    .sort({ createdAt: -1 })
    .populate('scriptId');
};

/**
 * Get total audio size for a bank
 */
podcastAudioSchema.statics.getTotalSize = async function(idrssd) {
  const result = await this.aggregate([
    { $match: { idrssd } },
    { $group: { _id: null, totalSize: { $sum: '$fileSize' } } }
  ]);
  return result.length > 0 ? result[0].totalSize : 0;
};

module.exports = mongoose.model('PodcastAudio', podcastAudioSchema);
