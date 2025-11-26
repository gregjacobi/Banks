const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const GroundingDocument = require('../models/GroundingDocument');
const GroundingChunk = require('../models/GroundingChunk');
const groundingService = require('../services/groundingService');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../data/grounding_pdfs');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp_originalname
    const uniqueName = `${Date.now()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024  // 50MB max
  }
});

/**
 * POST /api/grounding/upload
 * Upload a PDF document for grounding
 */
router.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { title, topics, bankTypes, assetSizeRange } = req.body;

    console.log(`[API] Uploading document: ${req.file.originalname}`);

    // Auto-suggest tags if not provided
    let suggestedTags = {};
    if (!topics || !bankTypes) {
      console.log('[API] Auto-suggesting tags...');
      suggestedTags = await groundingService.autoSuggestTags(req.file.path);
    }

    // Create document record
    const document = await GroundingDocument.create({
      filename: req.file.originalname,
      title: title || req.file.originalname.replace('.pdf', ''),
      fileSize: req.file.size,
      filePath: req.file.path,
      topics: topics ? JSON.parse(topics) : suggestedTags.topics,
      bankTypes: bankTypes ? JSON.parse(bankTypes) : suggestedTags.bankTypes,
      assetSizeRange: assetSizeRange || suggestedTags.assetSizeRange || 'all',
      processingStatus: 'pending'
    });

    console.log(`[API] Document created: ${document._id}`);

    // Start processing in background
    groundingService.processDocument(document._id.toString())
      .then(() => {
        console.log(`[API] Background processing completed for ${document._id}`);
      })
      .catch(error => {
        console.error(`[API] Background processing failed for ${document._id}:`, error);
      });

    res.json({
      success: true,
      document: {
        id: document._id,
        filename: document.filename,
        title: document.title,
        topics: document.topics,
        bankTypes: document.bankTypes,
        assetSizeRange: document.assetSizeRange,
        status: document.processingStatus
      },
      suggestedTags: suggestedTags
    });

  } catch (error) {
    console.error('[API] Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/grounding/documents
 * List all grounding documents
 */
router.get('/documents', async (req, res) => {
  try {
    const { status, topic, bankType, idrssd } = req.query;

    const filter = {};
    if (status) filter.processingStatus = status;
    if (topic) filter.topics = topic;
    if (bankType) filter.bankTypes = bankType;
    if (idrssd) filter.idrssd = idrssd;

    const documents = await GroundingDocument.find(filter)
      .sort({ uploadedAt: -1 })
      .select('-filePath');  // Don't expose filesystem paths

    res.json({ documents });

  } catch (error) {
    console.error('[API] List documents error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/grounding/documents/:id
 * Get a specific document
 */
router.get('/documents/:id', async (req, res) => {
  try {
    const document = await GroundingDocument.findById(req.params.id)
      .select('-filePath');

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Get chunk stats
    const chunkStats = await GroundingChunk.aggregate([
      { $match: { documentId: document._id } },
      { $group: {
        _id: null,
        totalRetrievals: { $sum: '$retrievalCount' },
        avgRating: { $avg: '$avgRating' }
      }}
    ]);

    res.json({
      document,
      stats: chunkStats[0] || { totalRetrievals: 0, avgRating: null }
    });

  } catch (error) {
    console.error('[API] Get document error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/grounding/documents/:id
 * Update document metadata
 */
router.put('/documents/:id', async (req, res) => {
  try {
    const { title, topics, bankTypes, assetSizeRange } = req.body;

    const updates = {};
    if (title) updates.title = title;
    if (topics) updates.topics = topics;
    if (bankTypes) updates.bankTypes = bankTypes;
    if (assetSizeRange) updates.assetSizeRange = assetSizeRange;

    const document = await groundingService.updateMetadata(
      req.params.id,
      updates
    );

    res.json({ document });

  } catch (error) {
    console.error('[API] Update document error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/grounding/documents/:id
 * Delete a document and its chunks
 */
router.delete('/documents/:id', async (req, res) => {
  try {
    await groundingService.deleteDocument(req.params.id);
    res.json({ success: true });

  } catch (error) {
    console.error('[API] Delete document error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/grounding/search
 * Test vector search (for debugging)
 */
router.post('/search', async (req, res) => {
  try {
    const { query, bankType, idrssd, topics, limit } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const filters = {};
    if (bankType) filters.bankTypes = [bankType];
    if (idrssd) filters.idrssd = idrssd;
    if (topics) filters.topics = topics;

    const results = await groundingService.retrieveChunks(
      query,
      filters,
      limit || 5
    );

    res.json({
      query,
      filters,
      results: results.map(r => ({
        content: r.content,
        score: r.score,
        documentTitle: r.documentTitle,
        pageNumber: r.pageNumber,
        chunkIndex: r.chunkIndex
      }))
    });

  } catch (error) {
    console.error('[API] Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/grounding/documents/:id/reprocess
 * Reprocess a document (re-chunk and re-embed)
 */
router.post('/documents/:id/reprocess', async (req, res) => {
  try {
    // Delete existing chunks
    await GroundingChunk.deleteMany({ documentId: req.params.id });

    // Reset document status
    await GroundingDocument.findByIdAndUpdate(req.params.id, {
      processingStatus: 'pending',
      chunkCount: 0
    });

    // Reprocess
    const result = await groundingService.processDocument(req.params.id);

    res.json(result);

  } catch (error) {
    console.error('[API] Reprocess error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/grounding/stats
 * Get overall RAG infrastructure statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const { idrssd } = req.query;

    // Build filter for bank-specific queries
    const filter = idrssd ? { idrssd } : {};

    const totalDocuments = await GroundingDocument.countDocuments(filter);
    const totalChunks = await GroundingChunk.countDocuments(idrssd ? { idrssd } : {});

    // Get document status breakdown
    const statusBreakdown = await GroundingDocument.aggregate([
      ...(idrssd ? [{ $match: { idrssd } }] : []),
      {
        $group: {
          _id: '$processingStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get total file size
    const sizeStats = await GroundingDocument.aggregate([
      ...(idrssd ? [{ $match: { idrssd } }] : []),
      {
        $group: {
          _id: null,
          totalSize: { $sum: '$fileSize' },
          avgSize: { $avg: '$fileSize' }
        }
      }
    ]);

    // Get documents by idrssd (only if not filtering by bank)
    const byBank = idrssd ? [] : await GroundingDocument.aggregate([
      {
        $match: { idrssd: { $exists: true, $ne: null } }
      },
      {
        $group: {
          _id: '$idrssd',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // Get chunk usage stats
    const chunkStats = await GroundingChunk.aggregate([
      ...(idrssd ? [{ $match: { idrssd } }] : []),
      {
        $group: {
          _id: null,
          totalRetrievals: { $sum: '$retrievalCount' },
          avgRating: { $avg: '$avgRating' }
        }
      }
    ]);

    res.json({
      documents: {
        total: totalDocuments,
        byStatus: statusBreakdown.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
        totalSize: sizeStats[0]?.totalSize || 0,
        avgSize: sizeStats[0]?.avgSize || 0
      },
      chunks: {
        total: totalChunks,
        totalRetrievals: chunkStats[0]?.totalRetrievals || 0,
        avgRating: chunkStats[0]?.avgRating || null
      },
      byBank: byBank
    });

  } catch (error) {
    console.error('[API] Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/grounding/wipe
 * Completely wipe all RAG data (documents and chunks)
 */
router.delete('/wipe', async (req, res) => {
  try {
    console.log('[API] Wiping entire RAG database...');

    // Delete all chunks
    const chunksResult = await GroundingChunk.deleteMany({});
    console.log(`[API] Deleted ${chunksResult.deletedCount} chunks`);

    // Delete all documents
    const docsResult = await GroundingDocument.deleteMany({});
    console.log(`[API] Deleted ${docsResult.deletedCount} documents`);

    // Optionally delete physical files (be careful!)
    // const groundingPdfsDir = path.join(__dirname, '../data/grounding_pdfs');
    // await fs.rm(groundingPdfsDir, { recursive: true, force: true });
    // await fs.mkdir(groundingPdfsDir, { recursive: true });

    res.json({
      success: true,
      deleted: {
        documents: docsResult.deletedCount,
        chunks: chunksResult.deletedCount
      }
    });

  } catch (error) {
    console.error('[API] Wipe error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/grounding/documents/:id/view
 * View a document PDF
 */
router.get('/documents/:id/view', async (req, res) => {
  try {
    const document = await GroundingDocument.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!document.filePath) {
      return res.status(404).json({ error: 'Document file not found' });
    }

    const fs = require('fs');
    const path = require('path');

    // Resolve the file path
    const fullPath = path.resolve(document.filePath);

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Document file not found on disk' });
    }

    // Determine content type based on file extension or stored content type
    let contentType = document.contentType || 'application/pdf';

    // Map file extensions to content types if not explicitly stored
    const ext = path.extname(document.filename).toLowerCase();
    if (!document.contentType) {
      const contentTypeMap = {
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
        '.html': 'text/html',
        '.json': 'application/json',
        '.md': 'text/markdown'
      };
      contentType = contentTypeMap[ext] || 'application/octet-stream';
    }

    // Set headers for document viewing
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${document.filename}"`);

    // Stream the file
    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('[API] View document error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
