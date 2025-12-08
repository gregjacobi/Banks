const mongoose = require('mongoose');

/**
 * GridFS Configuration for Bank Explorer
 *
 * Four separate buckets for different file types:
 * - pdfs: PDF documents (bank reports, grounding docs, exports, ZIPs)
 * - audio: MP3 podcast audio files
 * - images: Bank logos (PNG, JPG, SVG)
 * - documents: JSON documents (research reports, podcast scripts, presentations)
 *
 * Usage:
 *   const { pdfBucket, audioBucket, imageBucket, documentBucket } = require('./config/gridfs');
 */

let pdfBucket = null;
let audioBucket = null;
let imageBucket = null;
let documentBucket = null;

/**
 * Initialize GridFS buckets
 * Call this after MongoDB connection is established
 */
function initializeGridFS() {
  if (!mongoose.connection.db) {
    throw new Error('MongoDB connection not established. Call initializeGridFS() after connecting to MongoDB.');
  }

  // PDF Bucket: 255KB chunks (default, optimal for PDFs and ZIPs)
  pdfBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'pdfs',
    chunkSizeBytes: 255 * 1024  // 255KB
  });

  // Audio Bucket: 512KB chunks (larger for streaming audio)
  audioBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'audio',
    chunkSizeBytes: 512 * 1024  // 512KB
  });

  // Image Bucket: 128KB chunks (smaller for images)
  imageBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'images',
    chunkSizeBytes: 128 * 1024  // 128KB
  });

  // Document Bucket: 255KB chunks (for JSON documents - research reports, scripts, presentations)
  documentBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'documents',
    chunkSizeBytes: 255 * 1024  // 255KB
  });

  console.log('✓ GridFS buckets initialized (pdfs, audio, images, documents)');
}

/**
 * Get PDF bucket
 */
function getPdfBucket() {
  if (!pdfBucket) {
    throw new Error('GridFS not initialized. Call initializeGridFS() first.');
  }
  return pdfBucket;
}

/**
 * Get audio bucket
 */
function getAudioBucket() {
  if (!audioBucket) {
    throw new Error('GridFS not initialized. Call initializeGridFS() first.');
  }
  return audioBucket;
}

/**
 * Get image bucket
 */
function getImageBucket() {
  if (!imageBucket) {
    throw new Error('GridFS not initialized. Call initializeGridFS() first.');
  }
  return imageBucket;
}

/**
 * Get document bucket
 */
function getDocumentBucket() {
  if (!documentBucket) {
    throw new Error('GridFS not initialized. Call initializeGridFS() first.');
  }
  return documentBucket;
}

module.exports = {
  initializeGridFS,
  get pdfBucket() {
    return getPdfBucket();
  },
  get audioBucket() {
    return getAudioBucket();
  },
  get imageBucket() {
    return getImageBucket();
  },
  get documentBucket() {
    return getDocumentBucket();
  }
};
