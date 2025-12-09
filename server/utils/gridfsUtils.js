/**
 * GridFS Utilities
 * Helper functions for uploading files to MongoDB GridFS
 */

/**
 * Upload file buffer to GridFS
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Filename for GridFS
 * @param {string} contentType - Content type (e.g., 'application/pdf')
 * @param {Object} metadata - Additional metadata to store
 * @returns {Promise<ObjectId>} GridFS file ID
 */
async function uploadToGridFS(buffer, filename, contentType, metadata = {}) {
  const { pdfBucket } = require('../config/gridfs');

  const uploadStream = pdfBucket.openUploadStream(filename, {
    contentType: contentType,
    metadata: {
      uploadType: 'from_source',
      uploadedAt: new Date(),
      ...metadata
    }
  });

  uploadStream.end(buffer);

  await new Promise((resolve, reject) => {
    uploadStream.on('finish', resolve);
    uploadStream.on('error', reject);
  });

  return uploadStream.id;
}

module.exports = {
  uploadToGridFS
};
