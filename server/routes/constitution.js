const express = require('express');
const router = express.Router();
const ConstitutionService = require('../services/constitutionService');

const constitutionService = new ConstitutionService();

/**
 * GET /api/constitution
 * Get the current research constitution
 */
router.get('/', async (req, res) => {
  try {
    const constitution = constitutionService.getCurrentConstitution();

    res.json({
      success: true,
      constitution,
      sections: constitutionService.getConstitutionSections()
    });
  } catch (error) {
    console.error('Error fetching constitution:', error);
    res.status(500).json({
      error: 'Failed to fetch constitution',
      details: error.message
    });
  }
});

/**
 * GET /api/constitution/sections
 * Get constitution sections for UI
 */
router.get('/sections', async (req, res) => {
  try {
    const sections = constitutionService.getConstitutionSections();

    res.json({
      success: true,
      sections
    });
  } catch (error) {
    console.error('Error fetching sections:', error);
    res.status(500).json({
      error: 'Failed to fetch sections',
      details: error.message
    });
  }
});

/**
 * POST /api/constitution/suggest
 * Get RAG-powered suggestions for improving the constitution
 *
 * Request body:
 * {
 *   focusArea: 'general' | 'metrics' | 'strategic_initiatives' | 'leadership' | 'technology',
 *   maxSuggestions: number (default: 5)
 * }
 */
router.post('/suggest', async (req, res) => {
  try {
    const { focusArea = 'general', maxSuggestions = 5 } = req.body;

    console.log(`[Constitution API] Generating suggestions for focus: ${focusArea}`);

    const result = await constitutionService.suggestImprovements({
      focusArea,
      maxSuggestions
    });

    res.json(result);
  } catch (error) {
    console.error('Error generating suggestions:', error);
    res.status(500).json({
      error: 'Failed to generate suggestions',
      details: error.message
    });
  }
});

/**
 * POST /api/constitution/apply
 * Apply a suggestion to the constitution (placeholder for future implementation)
 *
 * Request body:
 * {
 *   suggestion: { section, suggestedChange, ... }
 * }
 */
router.post('/apply', async (req, res) => {
  try {
    const { suggestion } = req.body;

    if (!suggestion || !suggestion.section) {
      return res.status(400).json({
        error: 'Invalid suggestion format'
      });
    }

    const result = await constitutionService.applySuggestion(suggestion);

    res.json(result);
  } catch (error) {
    console.error('Error applying suggestion:', error);
    res.status(500).json({
      error: 'Failed to apply suggestion',
      details: error.message
    });
  }
});

module.exports = router;
