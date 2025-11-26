const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');

/**
 * POST /api/feedback
 * Submit new feedback for a report or podcast
 */
router.post('/', async (req, res) => {
  try {
    const {
      feedbackType,
      bankIdrssd,
      bankName,
      reportTimestamp,
      reportingPeriod,
      podcastExperts,
      rating,
      comment,
      tags,
      sectionFeedback,
      userId,
      userEmail
    } = req.body;

    // Validation
    if (!feedbackType || !bankIdrssd || !bankName || !reportTimestamp || !rating) {
      return res.status(400).json({
        error: 'Missing required fields: feedbackType, bankIdrssd, bankName, reportTimestamp, rating'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        error: 'Rating must be between 1 and 5'
      });
    }

    // Create feedback document
    const feedback = new Feedback({
      feedbackType,
      bankIdrssd,
      bankName,
      reportTimestamp,
      reportingPeriod,
      podcastExperts: feedbackType === 'podcast' ? podcastExperts : undefined,
      rating,
      comment,
      tags: tags || [],
      sectionFeedback: sectionFeedback || [],
      userId: userId || 'anonymous',
      userEmail
    });

    await feedback.save();

    res.status(201).json({
      success: true,
      feedbackId: feedback._id,
      message: 'Feedback submitted successfully'
    });

  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({
      error: 'Failed to submit feedback',
      details: error.message
    });
  }
});

/**
 * GET /api/feedback/bank/:idrssd
 * Get all feedback for a specific bank
 */
router.get('/bank/:idrssd', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { type } = req.query; // 'report' or 'podcast'

    const feedback = await Feedback.getForBank(idrssd, type || null);

    res.json({
      success: true,
      count: feedback.length,
      feedback
    });

  } catch (error) {
    console.error('Error fetching bank feedback:', error);
    res.status(500).json({
      error: 'Failed to fetch feedback',
      details: error.message
    });
  }
});

/**
 * GET /api/feedback/report/:idrssd/:timestamp
 * Get feedback for a specific report/podcast
 */
router.get('/report/:idrssd/:timestamp', async (req, res) => {
  try {
    const { idrssd, timestamp } = req.params;
    const { type } = req.query; // 'report' or 'podcast'

    const feedback = await Feedback.getForReport(idrssd, parseInt(timestamp), type || null);

    res.json({
      success: true,
      count: feedback.length,
      feedback
    });

  } catch (error) {
    console.error('Error fetching report feedback:', error);
    res.status(500).json({
      error: 'Failed to fetch feedback',
      details: error.message
    });
  }
});

/**
 * GET /api/feedback/stats/:idrssd
 * Get feedback statistics for a bank
 */
router.get('/stats/:idrssd', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { type } = req.query; // 'report' or 'podcast'

    const stats = await Feedback.getStatsForBank(idrssd, type || null);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    res.status(500).json({
      error: 'Failed to fetch feedback statistics',
      details: error.message
    });
  }
});

/**
 * GET /api/feedback/recent
 * Get recent feedback across all banks
 */
router.get('/recent', async (req, res) => {
  try {
    const { limit = 20, type } = req.query;

    const feedback = await Feedback.getRecent(parseInt(limit), type || null);

    res.json({
      success: true,
      count: feedback.length,
      feedback
    });

  } catch (error) {
    console.error('Error fetching recent feedback:', error);
    res.status(500).json({
      error: 'Failed to fetch recent feedback',
      details: error.message
    });
  }
});

/**
 * GET /api/feedback/flagged
 * Get all flagged feedback
 */
router.get('/flagged', async (req, res) => {
  try {
    const feedback = await Feedback.getFlagged();

    res.json({
      success: true,
      count: feedback.length,
      feedback
    });

  } catch (error) {
    console.error('Error fetching flagged feedback:', error);
    res.status(500).json({
      error: 'Failed to fetch flagged feedback',
      details: error.message
    });
  }
});

/**
 * GET /api/feedback/experts/ratings
 * Get average ratings by podcast expert
 */
router.get('/experts/ratings', async (req, res) => {
  try {
    const expertRatings = await Feedback.getExpertRatings();

    res.json({
      success: true,
      expertRatings
    });

  } catch (error) {
    console.error('Error fetching expert ratings:', error);
    res.status(500).json({
      error: 'Failed to fetch expert ratings',
      details: error.message
    });
  }
});

/**
 * PATCH /api/feedback/:id/flag
 * Toggle flag status on feedback
 */
router.patch('/:id/flag', async (req, res) => {
  try {
    const { id } = req.params;

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    await feedback.toggleFlag();

    res.json({
      success: true,
      flagged: feedback.flagged
    });

  } catch (error) {
    console.error('Error toggling feedback flag:', error);
    res.status(500).json({
      error: 'Failed to toggle flag',
      details: error.message
    });
  }
});

/**
 * PATCH /api/feedback/:id/status
 * Update feedback status
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'addressed', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    feedback.status = status;
    if (status === 'addressed') {
      await feedback.markAsAddressed();
    } else {
      await feedback.save();
    }

    res.json({
      success: true,
      status: feedback.status
    });

  } catch (error) {
    console.error('Error updating feedback status:', error);
    res.status(500).json({
      error: 'Failed to update status',
      details: error.message
    });
  }
});

/**
 * POST /api/feedback/:id/response
 * Add a response to feedback
 */
router.post('/:id/response', async (req, res) => {
  try {
    const { id } = req.params;
    const { responseText, respondedBy } = req.body;

    if (!responseText) {
      return res.status(400).json({ error: 'Response text is required' });
    }

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    await feedback.addResponse(responseText, respondedBy || 'Admin');

    res.json({
      success: true,
      response: feedback.response
    });

  } catch (error) {
    console.error('Error adding feedback response:', error);
    res.status(500).json({
      error: 'Failed to add response',
      details: error.message
    });
  }
});

/**
 * POST /api/feedback/:id/helpful
 * Mark feedback as helpful (upvote)
 */
router.post('/:id/helpful', async (req, res) => {
  try {
    const { id } = req.params;

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    await feedback.incrementHelpfulVotes();

    res.json({
      success: true,
      helpfulVotes: feedback.helpfulVotes
    });

  } catch (error) {
    console.error('Error incrementing helpful votes:', error);
    res.status(500).json({
      error: 'Failed to increment helpful votes',
      details: error.message
    });
  }
});

/**
 * DELETE /api/feedback/:id
 * Delete feedback (admin only)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const feedback = await Feedback.findByIdAndDelete(id);
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    res.json({
      success: true,
      message: 'Feedback deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({
      error: 'Failed to delete feedback',
      details: error.message
    });
  }
});

module.exports = router;
