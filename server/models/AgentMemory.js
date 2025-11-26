const mongoose = require('mongoose');

/**
 * AgentMemory Schema
 * Stores learned patterns, successful queries, and strategies from agent research
 * to enable cross-bank learning and avoid repetitive work
 */
const agentMemorySchema = new mongoose.Schema({
  // Memory type/category
  memoryType: {
    type: String,
    required: true,
    enum: [
      'search_query_pattern',     // Successful web search query patterns
      'document_query_pattern',    // Effective document query patterns
      'analysis_strategy',         // Successful analysis approaches
      'search_result_pattern',     // Patterns in successful search results
      'source_discovery_pattern',  // Patterns for finding sources
      'cross_bank_pattern'         // Patterns observed across multiple banks
    ],
    index: true
  },

  // Context tags for retrieval (bank size, type, region, etc.)
  contextTags: {
    assetSize: {
      type: String,
      enum: ['small', 'medium', 'large', 'mega'],
      index: true
    },
    region: {
      type: String,
      index: true
    },
    bankType: {
      type: String, // e.g., 'commercial', 'regional', 'community'
      index: true
    }
  },

  // The actual memory content
  pattern: {
    type: String,
    required: true,
    index: 'text' // Enable text search on patterns
  },

  // Example or template
  example: {
    type: String,
    required: false
  },

  // Success metrics
  successCount: {
    type: Number,
    default: 1
  },
  usageCount: {
    type: Number,
    default: 1
  },
  lastUsed: {
    type: Date,
    default: Date.now,
    index: true
  },
  firstSeen: {
    type: Date,
    default: Date.now
  },

  // What banks/contexts this worked for
  workedFor: [{
    idrssd: String,
    bankName: String,
    date: Date,
    result: {
      sourcesFound: Number,
      insightsGenerated: Number,
      relevanceScore: Number // 1-10 rating
    }
  }],

  // When this pattern should be used
  useCase: {
    type: String,
    required: false // e.g., 'finding_investor_presentations', 'leadership_research', 'strategic_initiatives'
  },

  // Related patterns (for pattern clustering)
  relatedPatterns: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgentMemory'
  }],

  // Notes/observations
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for efficient retrieval
agentMemorySchema.index({ memoryType: 1, lastUsed: -1 });
agentMemorySchema.index({ memoryType: 1, successCount: -1 });
agentMemorySchema.index({ 'contextTags.assetSize': 1, 'contextTags.region': 1 });
agentMemorySchema.index({ useCase: 1, successCount: -1 });

// Compound index for context-based retrieval
agentMemorySchema.index({ 
  memoryType: 1, 
  'contextTags.assetSize': 1, 
  'contextTags.region': 1,
  successCount: -1 
});

const AgentMemory = mongoose.model('AgentMemory', agentMemorySchema);

module.exports = AgentMemory;
