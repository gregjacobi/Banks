const mongoose = require('mongoose');

const groundingChunkSchema = new mongoose.Schema({
  // Reference to parent document
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroundingDocument',
    required: true,
    index: true
  },

  // Content
  content: {
    type: String,
    required: true
  },
  chunkIndex: {
    type: Number,
    required: true
  },
  pageNumber: Number,  // Which page in the PDF

  // Embedding (1024 dimensions for Voyage AI voyage-3)
  embedding: {
    type: [Number],
    required: true
  },

  // Metadata (copied from parent for efficient filtering)
  documentTitle: String,
  topics: [String],
  bankTypes: [String],
  assetSizeRange: String,
  idrssd: String,  // Bank association (copied from parent)

  // Stats
  retrievalCount: {
    type: Number,
    default: 0
  },
  lastRetrievedAt: Date,

  // Effectiveness (based on feedback when this chunk was used)
  avgRating: Number,
  positiveCount: {
    type: Number,
    default: 0
  },
  negativeCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
groundingChunkSchema.index({ documentId: 1, chunkIndex: 1 });
groundingChunkSchema.index({ topics: 1 });
groundingChunkSchema.index({ bankTypes: 1 });
groundingChunkSchema.index({ retrievalCount: -1 });
groundingChunkSchema.index({ idrssd: 1 });

// Methods
groundingChunkSchema.methods.recordRetrieval = function() {
  this.retrievalCount += 1;
  this.lastRetrievedAt = new Date();
  return this.save();
};

groundingChunkSchema.methods.recordFeedback = function(rating) {
  if (rating >= 4) {
    this.positiveCount += 1;
  } else if (rating <= 2) {
    this.negativeCount += 1;
  }

  // Recalculate average
  if (!this.avgRating) {
    this.avgRating = rating;
  } else {
    this.avgRating = (this.avgRating + rating) / 2;
  }

  return this.save();
};

// Helper: Calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

// In-memory vector search (for local MongoDB without Atlas Search)
groundingChunkSchema.statics.vectorSearch = async function(embedding, filters = {}, limit = 5) {
  // Build query filters
  const query = {};

  // Handle idrssd filtering:
  // - If idrssd is null, filter to global documents (no bank ID)
  // - If idrssd is a string, filter to that specific bank
  // - If idrssd is undefined, don't filter by bank (all documents)
  if (filters.hasOwnProperty('idrssd')) {
    if (filters.idrssd === null) {
      query.idrssd = { $in: [null, undefined] };
    } else {
      query.idrssd = filters.idrssd;
    }
  }

  if (filters.bankTypes && filters.bankTypes.length > 0) {
    query.$or = [
      { bankTypes: { $in: filters.bankTypes } },
      { bankTypes: 'all' }
    ];
  }

  if (filters.topics && filters.topics.length > 0) {
    query.topics = { $in: filters.topics };
  }

  // Fetch all matching chunks with their embeddings
  const chunks = await this.find(query)
    .populate('documentId')
    .lean();

  if (chunks.length === 0) {
    return [];
  }

  // Calculate similarity scores for each chunk
  const chunksWithScores = chunks.map(chunk => {
    const score = cosineSimilarity(embedding, chunk.embedding);
    return {
      ...chunk,
      score,
      document: chunk.documentId
    };
  });

  // Sort by score (highest first) and take top N
  chunksWithScores.sort((a, b) => b.score - a.score);

  return chunksWithScores.slice(0, limit);
};

module.exports = mongoose.model('GroundingChunk', groundingChunkSchema);
