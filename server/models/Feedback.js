const mongoose = require('mongoose');

/**
 * Feedback Schema
 * Stores user feedback on reports and podcasts for continuous improvement
 */
const feedbackSchema = new mongoose.Schema({
  // What is being reviewed
  feedbackType: {
    type: String,
    required: true,
    enum: ['report', 'podcast'],
    index: true
  },

  // Bank this feedback is for
  bankIdrssd: {
    type: String,
    required: true,
    index: true
  },

  bankName: {
    type: String,
    required: true
  },

  // Report/Podcast identification
  reportTimestamp: {
    type: Number,
    required: true, // Timestamp from report filename (e.g., 761806_1763037113001.json)
    index: true
  },

  reportingPeriod: {
    type: String // e.g., "2025-06-30" - the financial data period being analyzed
  },

  // Podcast-specific fields
  podcastExperts: [{
    type: String // e.g., ['WARREN_VAULT', 'DR_SOFIA_BANKS']
  }],

  // User feedback
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    index: true
  },

  comment: {
    type: String,
    maxLength: 2000 // Limit comment length
  },

  // Specific aspects (multi-select tags)
  tags: [{
    type: String,
    enum: [
      // Positive tags
      'accurate',
      'insightful',
      'actionable',
      'well_structured',
      'helpful_discovery_questions',
      'good_business_context',

      // Negative tags
      'inaccurate',
      'missing_context',
      'too_technical',
      'too_basic',
      'confusing',
      'wrong_interpretation',

      // Podcast-specific
      'natural_conversation',
      'good_pacing',
      'too_long',
      'too_short',
      'helpful_for_ae_prep',

      // Other
      'other'
    ]
  }],

  // Specific feedback on sections (optional, structured)
  sectionFeedback: [{
    section: String, // e.g., 'elevator_pitch', 'discovery_questions', 'financial_analysis'
    rating: Number, // 1-5
    comment: String
  }],

  // Helpfulness votes (for feedback on feedback)
  helpfulVotes: {
    type: Number,
    default: 0
  },

  // User information (optional - for future multi-user support)
  userId: {
    type: String,
    default: 'anonymous'
  },

  userEmail: {
    type: String // Optional
  },

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Response from team (optional)
  response: {
    text: String,
    respondedAt: Date,
    respondedBy: String
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'addressed', 'archived'],
    default: 'active',
    index: true
  },

  // Flag for urgent/important feedback
  flagged: {
    type: Boolean,
    default: false,
    index: true
  }

}, {
  timestamps: true
});

// Compound indexes for efficient querying
feedbackSchema.index({ bankIdrssd: 1, feedbackType: 1 });
feedbackSchema.index({ feedbackType: 1, rating: 1 });
feedbackSchema.index({ bankIdrssd: 1, reportTimestamp: 1 });
feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ flagged: 1, status: 1 });

// Instance methods

/**
 * Mark feedback as addressed
 */
feedbackSchema.methods.markAsAddressed = async function() {
  this.status = 'addressed';
  return this.save();
};

/**
 * Add a response from the team
 */
feedbackSchema.methods.addResponse = async function(responseText, respondedBy) {
  this.response = {
    text: responseText,
    respondedAt: new Date(),
    respondedBy
  };
  return this.save();
};

/**
 * Toggle flag status
 */
feedbackSchema.methods.toggleFlag = async function() {
  this.flagged = !this.flagged;
  return this.save();
};

/**
 * Increment helpful votes
 */
feedbackSchema.methods.incrementHelpfulVotes = async function() {
  this.helpfulVotes += 1;
  return this.save();
};

// Static methods

/**
 * Get all feedback for a specific report/podcast
 */
feedbackSchema.statics.getForReport = function(bankIdrssd, reportTimestamp, feedbackType = null) {
  const query = { bankIdrssd, reportTimestamp };
  if (feedbackType) {
    query.feedbackType = feedbackType;
  }
  return this.find(query).sort({ createdAt: -1 });
};

/**
 * Get all feedback for a bank
 */
feedbackSchema.statics.getForBank = function(bankIdrssd, feedbackType = null) {
  const query = { bankIdrssd };
  if (feedbackType) {
    query.feedbackType = feedbackType;
  }
  return this.find(query).sort({ createdAt: -1 });
};

/**
 * Get feedback statistics for a bank
 */
feedbackSchema.statics.getStatsForBank = async function(bankIdrssd, feedbackType = null) {
  const match = { bankIdrssd };
  if (feedbackType) {
    match.feedbackType = feedbackType;
  }

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$feedbackType',
        count: { $sum: 1 },
        avgRating: { $avg: '$rating' },
        ratings: { $push: '$rating' }
      }
    }
  ]);

  // Count by rating
  const ratingCounts = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: { type: '$feedbackType', rating: '$rating' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Tag frequency
  const tagFrequency = await this.aggregate([
    { $match: match },
    { $unwind: '$tags' },
    {
      $group: {
        _id: '$tags',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  return {
    overall: stats,
    ratingDistribution: ratingCounts,
    commonTags: tagFrequency
  };
};

/**
 * Get recent feedback across all banks
 */
feedbackSchema.statics.getRecent = function(limit = 20, feedbackType = null) {
  const query = feedbackType ? { feedbackType } : {};
  return this.find(query).sort({ createdAt: -1 }).limit(limit);
};

/**
 * Get flagged feedback
 */
feedbackSchema.statics.getFlagged = function() {
  return this.find({ flagged: true, status: 'active' }).sort({ createdAt: -1 });
};

/**
 * Get average rating for specific experts (podcast only)
 */
feedbackSchema.statics.getExpertRatings = async function() {
  return this.aggregate([
    { $match: { feedbackType: 'podcast' } },
    { $unwind: '$podcastExperts' },
    {
      $group: {
        _id: '$podcastExperts',
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 }
      }
    },
    { $sort: { avgRating: -1 } }
  ]);
};

module.exports = mongoose.model('Feedback', feedbackSchema);
