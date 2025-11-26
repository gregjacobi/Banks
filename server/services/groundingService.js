const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
const { PDFLoader } = require('@langchain/community/document_loaders/fs/pdf');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const voyageClient = require('./voyageClient');
const GroundingDocument = require('../models/GroundingDocument');
const GroundingChunk = require('../models/GroundingChunk');

class GroundingService {
  constructor() {
    this.pdfDirectory = path.join(__dirname, '../data/grounding_pdfs');
    this.chunkSize = 512;  // tokens
    this.chunkOverlap = 100;  // 20% overlap
  }

  /**
   * Process an uploaded PDF document
   * @param {string} documentId - MongoDB document ID
   * @returns {Promise<Object>} Processing result
   */
  async processDocument(documentId) {
    const document = await GroundingDocument.findById(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    try {
      // Update status
      document.processingStatus = 'processing';
      await document.save();

      console.log(`[GroundingService] Processing ${document.filename}...`);

      // 1. Load document (PDF or text)
      const fileExt = path.extname(document.filePath).toLowerCase();
      const isPDF = fileExt === '.pdf';

      let pages;
      if (isPDF) {
        console.log(`[GroundingService] Loading as PDF...`);
        const loader = new PDFLoader(document.filePath, {
          splitPages: true
        });
        pages = await loader.load();
      } else {
        console.log(`[GroundingService] Loading as text file...`);
        // Read text file directly
        const textContent = await fs.readFile(document.filePath, 'utf-8');
        // Create document structure matching langchain format
        pages = [{
          pageContent: textContent,
          metadata: { source: document.filePath }
        }];
      }

      console.log(`[GroundingService] Loaded ${pages.length} pages/sections`);

      // Update page count
      document.pageCount = pages.length;
      await document.save();

      // 2. Split into chunks
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: this.chunkSize,
        chunkOverlap: this.chunkOverlap,
        separators: ['\n\n', '\n', '. ', ' ', '']
      });

      const allChunks = [];
      for (const page of pages) {
        const pageChunks = await splitter.splitText(page.pageContent);
        for (const chunkContent of pageChunks) {
          allChunks.push({
            content: chunkContent,
            pageNumber: page.metadata.loc?.pageNumber || page.metadata.page || 0
          });
        }
      }

      console.log(`[GroundingService] Created ${allChunks.length} chunks`);

      // 3. Generate embeddings (batch for efficiency)
      console.log(`[GroundingService] Generating embeddings...`);
      const chunkTexts = allChunks.map(c => c.content);
      const embeddings = await voyageClient.embedBatch(chunkTexts);

      console.log(`[GroundingService] Generated ${embeddings.length} embeddings`);

      // 4. Store chunks in MongoDB
      const chunkDocuments = allChunks.map((chunk, index) => ({
        documentId: document._id,
        content: chunk.content,
        chunkIndex: index,
        pageNumber: chunk.pageNumber,
        embedding: embeddings[index],
        documentTitle: document.title,
        topics: document.topics,
        bankTypes: document.bankTypes,
        assetSizeRange: document.assetSizeRange,
        idrssd: document.idrssd  // Include bank association
      }));

      await GroundingChunk.insertMany(chunkDocuments);

      console.log(`[GroundingService] Stored ${chunkDocuments.length} chunks`);

      // 5. Update document status
      document.chunkCount = chunkDocuments.length;
      document.processingStatus = 'completed';
      await document.save();

      console.log(`[GroundingService] Processing completed for ${document.filename}`);

      return {
        success: true,
        documentId: document._id,
        filename: document.filename,
        pageCount: pages.length,
        chunkCount: chunkDocuments.length
      };

    } catch (error) {
      console.error(`[GroundingService] Error processing ${document.filename}:`, error);

      // Update document with error
      document.processingStatus = 'failed';
      document.processingError = error.message;
      await document.save();

      throw error;
    }
  }

  /**
   * Retrieve relevant chunks for a query
   * @param {string} query - Search query
   * @param {Object} filters - Optional filters (bankTypes, topics)
   * @param {number} limit - Number of chunks to retrieve
   * @returns {Promise<Array>} Retrieved chunks with scores
   */
  async retrieveChunks(query, filters = {}, limit = 5) {
    console.log(`[GroundingService] Retrieving chunks for query: "${query.substring(0, 50)}..."`);

    // Generate query embedding
    const queryEmbedding = await voyageClient.embedQuery(query);

    // Vector search
    const results = await GroundingChunk.vectorSearch(queryEmbedding, filters, limit);

    // Log retrieval
    for (const result of results) {
      await GroundingChunk.findByIdAndUpdate(result._id, {
        $inc: { retrievalCount: 1 },
        $set: { lastRetrievedAt: new Date() }
      });
    }

    // Update parent document retrieval count
    // Extract document IDs safely - documentId is populated as a full document object
    const documentIds = [];
    for (const result of results) {
      try {
        const docId = result.documentId;
        let idString;

        if (!docId) continue;

        // Case 1: Already a string
        if (typeof docId === 'string') {
          idString = docId;
        }
        // Case 2: Mongoose ObjectId
        else if (docId instanceof mongoose.Types.ObjectId) {
          idString = docId.toString();
        }
        // Case 3: Populated document with _id field
        else if (typeof docId === 'object' && docId._id) {
          if (docId._id instanceof mongoose.Types.ObjectId) {
            idString = docId._id.toString();
          } else {
            idString = String(docId._id);
          }
        }
        // Case 4: Try to convert whatever it is
        else {
          idString = String(docId);
        }

        // Only add valid ObjectId strings
        if (idString && idString !== '[object Object]' && mongoose.Types.ObjectId.isValid(idString)) {
          documentIds.push(idString);
        }
      } catch (err) {
        console.error('[GroundingService] Error extracting document ID:', err);
      }
    }

    // Remove duplicates and update
    const uniqueDocIds = [...new Set(documentIds)];
    if (uniqueDocIds.length > 0) {
      await GroundingDocument.updateMany(
        { _id: { $in: uniqueDocIds } },
        { $inc: { timesRetrieved: 1 } }
      );
    }

    console.log(`[GroundingService] Retrieved ${results.length} chunks (scores: ${results.map(r => r.score.toFixed(3)).join(', ')})`);

    return results;
  }

  /**
   * Auto-suggest tags for a PDF based on content analysis
   * @param {string} filePath - Path to PDF file
   * @returns {Promise<Object>} Suggested tags
   */
  async autoSuggestTags(filePath) {
    // Quick content analysis to suggest tags
    try {
      const loader = new PDFLoader(filePath, { splitPages: false });
      const docs = await loader.load();
      const content = docs.map(d => d.pageContent).join(' ').toLowerCase();

      const suggestions = {
        topics: [],
        bankTypes: [],
        assetSizeRange: 'all'
      };

      // Topic detection (simple keyword matching)
      const topicKeywords = {
        liquidity: ['liquidity', 'liquid assets', 'cash flow', 'funding'],
        capital: ['capital', 'equity', 'tier 1', 'leverage ratio'],
        asset_quality: ['asset quality', 'npl', 'non-performing', 'loan loss', 'credit quality'],
        earnings: ['earnings', 'profitability', 'income', 'roe', 'roa', 'nim'],
        risk_management: ['risk', 'var', 'stress test', 'compliance'],
        efficiency: ['efficiency', 'operating', 'cost', 'expense'],
        growth: ['growth', 'expansion', 'acquisition', 'market share'],
        technology: ['technology', 'digital', 'fintech', 'automation'],
        strategy: ['strategy', 'strategic', 'plan', 'initiative']
      };

      for (const [topic, keywords] of Object.entries(topicKeywords)) {
        if (keywords.some(kw => content.includes(kw))) {
          suggestions.topics.push(topic);
        }
      }

      // Default to general if no topics found
      if (suggestions.topics.length === 0) {
        suggestions.topics.push('general');
      }

      // Bank type detection
      if (content.includes('community bank')) {
        suggestions.bankTypes.push('community');
      }
      if (content.includes('regional bank')) {
        suggestions.bankTypes.push('regional');
      }
      if (!suggestions.bankTypes.length) {
        suggestions.bankTypes.push('all');
      }

      return suggestions;

    } catch (error) {
      console.error('[GroundingService] Auto-tag error:', error);
      return {
        topics: ['general'],
        bankTypes: ['all'],
        assetSizeRange: 'all'
      };
    }
  }

  /**
   * Delete a grounding document and all its chunks
   * @param {string} documentId - Document ID to delete
   */
  async deleteDocument(documentId) {
    const document = await GroundingDocument.findById(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Delete PDF file
    try {
      await fs.unlink(document.filePath);
    } catch (error) {
      console.error('[GroundingService] Error deleting file:', error);
    }

    // Delete all chunks
    await GroundingChunk.deleteMany({ documentId: document._id });

    // Delete document
    await document.deleteOne();

    console.log(`[GroundingService] Deleted document ${document.filename} and its chunks`);
  }

  /**
   * Update document metadata (user editable tags)
   * @param {string} documentId - Document ID
   * @param {Object} updates - Fields to update (topics, bankTypes, assetSizeRange)
   */
  async updateMetadata(documentId, updates) {
    const document = await GroundingDocument.findById(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Update document
    if (updates.topics) document.topics = updates.topics;
    if (updates.bankTypes) document.bankTypes = updates.bankTypes;
    if (updates.assetSizeRange) document.assetSizeRange = updates.assetSizeRange;
    if (updates.title) document.title = updates.title;

    await document.save();

    // Update all chunks with new metadata
    await GroundingChunk.updateMany(
      { documentId: document._id },
      {
        $set: {
          documentTitle: document.title,
          topics: document.topics,
          bankTypes: document.bankTypes,
          assetSizeRange: document.assetSizeRange,
          idrssd: document.idrssd
        }
      }
    );

    console.log(`[GroundingService] Updated metadata for ${document.filename}`);

    return document;
  }

  /**
   * Process a bank-specific PDF (from bank's uploaded PDFs)
   * @param {string} idrssd - Bank RSSD ID
   * @param {Object} pdfDoc - PDF document from PDF model
   * @returns {Promise<Object>} Processing result
   */
  async processBankPDF(idrssd, pdfDoc) {
    const PDF = require('../models/PDF');

    console.log(`[GroundingService] Processing bank-specific PDF for ${idrssd}: ${pdfDoc.originalFilename}`);

    try {
      // Update PDF status to processing
      await PDF.findByIdAndUpdate(pdfDoc._id, {
        ragStatus: 'processing'
      });

      // Create or find grounding document for this PDF
      let groundingDoc = await GroundingDocument.findOne({
        idrssd: idrssd,
        filename: pdfDoc.originalFilename
      });

      if (!groundingDoc) {
        groundingDoc = new GroundingDocument({
          filename: pdfDoc.originalFilename,
          title: pdfDoc.originalFilename.replace('.pdf', ''),
          filePath: pdfDoc.getFilePath(),
          fileSize: pdfDoc.fileSize,
          idrssd: idrssd,
          topics: ['strategy', 'general'],  // Default topics for bank PDFs
          bankTypes: ['all'],
          assetSizeRange: 'all',
          processingStatus: 'pending'
        });
        await groundingDoc.save();
      }

      // Process the document
      const result = await this.processDocument(groundingDoc._id);

      // Update PDF with success status
      await PDF.findByIdAndUpdate(pdfDoc._id, {
        ragStatus: 'completed',
        ragProcessedAt: new Date(),
        ragChunkCount: result.chunkCount,
        ragDocumentId: groundingDoc._id,
        ragError: null
      });

      return result;
    } catch (error) {
      console.error(`[GroundingService] Failed to process PDF ${pdfDoc.originalFilename}:`, error);

      // Update PDF with failed status
      await PDF.findByIdAndUpdate(pdfDoc._id, {
        ragStatus: 'failed',
        ragError: error.message
      });

      throw error;
    }
  }

  /**
   * Retrieve relevant chunks for a bank-specific query
   * @param {string} idrssd - Bank RSSD ID
   * @param {string} query - Search query
   * @param {number} limit - Number of chunks to retrieve
   * @returns {Promise<Array>} Retrieved chunks with scores
   */
  async retrieveBankChunks(idrssd, query, limit = 5) {
    console.log(`[GroundingService] Retrieving bank-specific chunks for ${idrssd}: "${query.substring(0, 50)}..."`);

    // Use the existing retrieveChunks with idrssd filter
    return await this.retrieveChunks(query, { idrssd }, limit);
  }

  /**
   * Get all documents for a specific bank
   * @param {string} idrssd - Bank RSSD ID
   * @returns {Promise<Array>} Bank's documents
   */
  async getBankDocuments(idrssd) {
    return await GroundingDocument.find({
      idrssd: idrssd,
      processingStatus: 'completed'
    }).sort({ uploadedAt: -1 });
  }

  /**
   * Check if a bank has any processed documents
   * @param {string} idrssd - Bank RSSD ID
   * @returns {Promise<boolean>} True if bank has documents
   */
  async hasBankDocuments(idrssd) {
    const count = await GroundingDocument.countDocuments({
      idrssd: idrssd,
      processingStatus: 'completed'
    });
    return count > 0;
  }

  /**
   * Get RAG statistics for a bank
   * @param {string} idrssd - Bank RSSD ID
   * @returns {Promise<Object>} RAG statistics
   */
  async getBankRAGStats(idrssd) {
    const GroundingChunk = require('../models/GroundingChunk');

    const documents = await GroundingDocument.find({ idrssd });
    const totalChunks = await GroundingChunk.countDocuments({ idrssd });

    const stats = {
      totalDocuments: documents.length,
      completedDocuments: documents.filter(d => d.processingStatus === 'completed').length,
      processingDocuments: documents.filter(d => d.processingStatus === 'processing').length,
      pendingDocuments: documents.filter(d => d.processingStatus === 'pending').length,
      failedDocuments: documents.filter(d => d.processingStatus === 'failed').length,
      totalChunks: totalChunks,
      totalSize: documents.reduce((sum, d) => sum + (d.fileSize || 0), 0),
      documents: documents.map(d => ({
        id: d._id,
        title: d.title,
        filename: d.filename,
        status: d.processingStatus,
        chunkCount: d.chunkCount,
        fileSize: d.fileSize,
        uploadedAt: d.uploadedAt,
        error: d.processingError
      }))
    };

    return stats;
  }

  /**
   * Delete bank-specific document and all its chunks
   * @param {string} idrssd - Bank RSSD ID
   * @param {string} filename - Original filename
   */
  async deleteBankDocument(idrssd, filename) {
    const GroundingChunk = require('../models/GroundingChunk');

    const document = await GroundingDocument.findOne({
      idrssd: idrssd,
      filename: filename
    });

    if (!document) {
      console.log(`[GroundingService] No grounding document found for ${idrssd}/${filename}`);
      return null;
    }

    // Delete all chunks
    const deleteResult = await GroundingChunk.deleteMany({ documentId: document._id });
    console.log(`[GroundingService] Deleted ${deleteResult.deletedCount} chunks for ${filename}`);

    // Delete document
    await document.deleteOne();
    console.log(`[GroundingService] Deleted grounding document ${filename}`);

    return {
      documentId: document._id,
      chunksDeleted: deleteResult.deletedCount
    };
  }
}

module.exports = new GroundingService();
module.exports.GroundingService = GroundingService;
