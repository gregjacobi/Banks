const { Readable } = require('stream');

/**
 * GridFS Helper Utilities
 * Provides simple functions for saving/loading JSON documents to/from GridFS
 */

/**
 * Save a JSON document to GridFS
 * @param {GridFSBucket} bucket - The GridFS bucket to save to
 * @param {string} filename - The filename (e.g., '817824_research_2025-12-08.json')
 * @param {Object} data - The JSON data to save
 * @param {Object} metadata - Optional metadata to attach
 * @returns {Promise<ObjectId>} The GridFS file ID
 */
async function saveJsonToGridFS(bucket, filename, data, metadata = {}) {
  return new Promise((resolve, reject) => {
    const jsonString = JSON.stringify(data, null, 2);
    const readableStream = Readable.from([jsonString]);

    const uploadStream = bucket.openUploadStream(filename, {
      contentType: 'application/json',
      metadata: {
        ...metadata,
        uploadedAt: new Date(),
        size: Buffer.byteLength(jsonString, 'utf8')
      }
    });

    uploadStream.on('error', reject);
    uploadStream.on('finish', () => {
      resolve(uploadStream.id);
    });

    readableStream.pipe(uploadStream);
  });
}

/**
 * Load a JSON document from GridFS by filename
 * @param {GridFSBucket} bucket - The GridFS bucket to load from
 * @param {string} filename - The filename to load
 * @returns {Promise<Object>} The parsed JSON data
 */
async function loadJsonFromGridFS(bucket, filename) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    const downloadStream = bucket.openDownloadStreamByName(filename);

    downloadStream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    downloadStream.on('error', reject);

    downloadStream.on('end', () => {
      try {
        const jsonString = Buffer.concat(chunks).toString('utf8');
        const data = JSON.parse(jsonString);
        resolve(data);
      } catch (error) {
        reject(new Error(`Failed to parse JSON: ${error.message}`));
      }
    });
  });
}

/**
 * Load a JSON document from GridFS by file ID
 * @param {GridFSBucket} bucket - The GridFS bucket to load from
 * @param {ObjectId} fileId - The GridFS file ID
 * @returns {Promise<Object>} The parsed JSON data
 */
async function loadJsonFromGridFSById(bucket, fileId) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    const downloadStream = bucket.openDownloadStream(fileId);

    downloadStream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    downloadStream.on('error', reject);

    downloadStream.on('end', () => {
      try {
        const jsonString = Buffer.concat(chunks).toString('utf8');
        const data = JSON.parse(jsonString);
        resolve(data);
      } catch (error) {
        reject(new Error(`Failed to parse JSON: ${error.message}`));
      }
    });
  });
}

/**
 * List files in a GridFS bucket matching a pattern
 * @param {GridFSBucket} bucket - The GridFS bucket to search
 * @param {Object} filter - MongoDB filter (e.g., { filename: { $regex: '^817824_' } })
 * @returns {Promise<Array>} Array of file metadata
 */
async function listFilesInGridFS(bucket, filter = {}) {
  return bucket.find(filter).toArray();
}

/**
 * Delete a file from GridFS by filename
 * @param {GridFSBucket} bucket - The GridFS bucket
 * @param {string} filename - The filename to delete
 * @returns {Promise<void>}
 */
async function deleteFileFromGridFS(bucket, filename) {
  const files = await bucket.find({ filename }).toArray();
  if (files.length === 0) {
    throw new Error(`File not found: ${filename}`);
  }

  // Delete all versions of this filename (GridFS can have multiple)
  for (const file of files) {
    await bucket.delete(file._id);
  }
}

/**
 * Delete a file from GridFS by file ID
 * @param {GridFSBucket} bucket - The GridFS bucket
 * @param {ObjectId} fileId - The file ID to delete
 * @returns {Promise<void>}
 */
async function deleteFileFromGridFSById(bucket, fileId) {
  await bucket.delete(fileId);
}

/**
 * Check if a file exists in GridFS
 * @param {GridFSBucket} bucket - The GridFS bucket
 * @param {string} filename - The filename to check
 * @returns {Promise<boolean>}
 */
async function fileExistsInGridFS(bucket, filename) {
  const files = await bucket.find({ filename }).limit(1).toArray();
  return files.length > 0;
}

module.exports = {
  saveJsonToGridFS,
  loadJsonFromGridFS,
  loadJsonFromGridFSById,
  listFilesInGridFS,
  deleteFileFromGridFS,
  deleteFileFromGridFSById,
  fileExistsInGridFS
};
