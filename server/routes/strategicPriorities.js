const express = require('express');
const router = express.Router();
const StrategicPrioritiesAnalysis = require('../models/StrategicPrioritiesAnalysis');
const BankMetadata = require('../models/BankMetadata');
const strategicPrioritiesAgent = require('../services/strategicPrioritiesAgent');

/**
 * GET /api/strategic-priorities/latest
 * Get the latest strategic priorities analysis
 */
router.get('/latest', async (req, res) => {
  try {
    const analysis = await StrategicPrioritiesAnalysis.getLatest();

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'No strategic priorities analysis found. Run the analysis first.'
      });
    }

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('Error fetching latest analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/strategic-priorities/summary
 * Get a summary view of the latest analysis (lighter payload)
 */
router.get('/summary', async (req, res) => {
  try {
    const analysis = await StrategicPrioritiesAnalysis.getLatest();

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'No strategic priorities analysis found'
      });
    }

    // Return lighter summary
    const summary = {
      analysisDate: analysis.analysisDate,
      coverage: analysis.coverage,
      topCategories: analysis.categories?.slice(0, 6).map(c => ({
        name: c.name,
        description: c.description,
        bankCount: c.bankCount,
        prevalence: c.prevalence,
        priorityCount: c.priorities?.length || 0
      })),
      topThemes: analysis.industrySummary?.topThemes?.slice(0, 5),
      keyObservations: analysis.industrySummary?.keyObservations,
      differentiatingCount: analysis.differentiatingStrategies?.length || 0,
      analysisMetadata: analysis.analysisMetadata
    };

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/strategic-priorities/categories
 * Get all categories with their priorities
 */
router.get('/categories', async (req, res) => {
  try {
    const analysis = await StrategicPrioritiesAnalysis.getLatest();

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'No analysis found'
      });
    }

    res.json({
      success: true,
      categories: analysis.categories,
      analysisDate: analysis.analysisDate
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/strategic-priorities/category/:name
 * Get detailed view of a specific category
 */
router.get('/category/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const analysis = await StrategicPrioritiesAnalysis.getLatest();

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'No analysis found'
      });
    }

    const category = analysis.categories?.find(
      c => c.name.toLowerCase() === name.toLowerCase()
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        error: `Category "${name}" not found`
      });
    }

    res.json({
      success: true,
      category,
      analysisDate: analysis.analysisDate
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/strategic-priorities/differentiating
 * Get all differentiating strategies
 */
router.get('/differentiating', async (req, res) => {
  try {
    const analysis = await StrategicPrioritiesAnalysis.getLatest();

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'No analysis found'
      });
    }

    res.json({
      success: true,
      differentiatingStrategies: analysis.differentiatingStrategies,
      analysisDate: analysis.analysisDate
    });
  } catch (error) {
    console.error('Error fetching differentiating strategies:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/strategic-priorities/bank/:idrssd
 * Get strategic priorities for a specific bank with industry context
 */
router.get('/bank/:idrssd', async (req, res) => {
  try {
    const { idrssd } = req.params;

    // Get bank's strategic priorities
    const bankMetadata = await BankMetadata.findOne({ idrssd }).lean();

    if (!bankMetadata) {
      return res.status(404).json({
        success: false,
        error: 'Bank not found'
      });
    }

    // Get latest industry analysis
    const analysis = await StrategicPrioritiesAnalysis.getLatest();

    // Find where this bank's priorities fit in the industry context
    let industryContext = null;
    if (analysis) {
      industryContext = {
        analysisDate: analysis.analysisDate,
        categoriesWithBank: [],
        differentiatingStrategiesFromBank: []
      };

      // Find categories containing this bank
      analysis.categories?.forEach(cat => {
        const banksInCategory = [];
        cat.priorities?.forEach(priority => {
          const bankInPriority = priority.banks?.find(b => b.idrssd === idrssd);
          if (bankInPriority) {
            banksInCategory.push({
              priorityTitle: priority.title,
              bankCount: priority.bankCount,
              originalTitle: bankInPriority.originalTitle
            });
          }
        });

        if (banksInCategory.length > 0) {
          industryContext.categoriesWithBank.push({
            categoryName: cat.name,
            categoryPrevalence: cat.prevalence,
            bankPriorities: banksInCategory
          });
        }
      });

      // Find differentiating strategies from this bank
      analysis.differentiatingStrategies?.forEach(ds => {
        if (ds.banks?.some(b => b.idrssd === idrssd)) {
          industryContext.differentiatingStrategiesFromBank.push({
            title: ds.title,
            uniquenessReason: ds.uniquenessReason,
            category: ds.category
          });
        }
      });
    }

    res.json({
      success: true,
      bank: {
        idrssd: bankMetadata.idrssd,
        bankName: bankMetadata.bankName,
        strategicInsights: bankMetadata.strategicInsights
      },
      industryContext
    });
  } catch (error) {
    console.error('Error fetching bank priorities:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/strategic-priorities/history
 * Get analysis history
 */
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = await StrategicPrioritiesAnalysis.getHistory(limit);

    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/strategic-priorities/coverage
 * Get coverage statistics - how many banks have priorities extracted
 */
router.get('/coverage', async (req, res) => {
  try {
    const totalBanks = await BankMetadata.countDocuments();
    const banksWithPriorities = await BankMetadata.countDocuments({
      'strategicInsights.status': 'completed',
      'strategicInsights.priorities.0': { $exists: true }
    });
    const banksExtracting = await BankMetadata.countDocuments({
      'strategicInsights.status': 'extracting'
    });
    const banksFailed = await BankMetadata.countDocuments({
      'strategicInsights.status': 'failed'
    });

    // Get list of banks with priorities
    const banksWithPrioritiesList = await BankMetadata.find(
      { 'strategicInsights.status': 'completed', 'strategicInsights.priorities.0': { $exists: true } },
      { idrssd: 1, bankName: 1, 'strategicInsights.priorities': 1, 'strategicInsights.lastExtracted': 1 }
    ).lean();

    res.json({
      success: true,
      coverage: {
        totalBanks,
        banksWithPriorities,
        banksExtracting,
        banksFailed,
        coveragePercent: totalBanks > 0 ? (banksWithPriorities / totalBanks) * 100 : 0
      },
      banks: banksWithPrioritiesList.map(b => ({
        idrssd: b.idrssd,
        bankName: b.bankName,
        priorityCount: b.strategicInsights?.priorities?.length || 0,
        lastExtracted: b.strategicInsights?.lastExtracted
      }))
    });
  } catch (error) {
    console.error('Error fetching coverage:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/strategic-priorities/analyze
 * Trigger a new strategic priorities analysis
 */
router.post('/analyze', async (req, res) => {
  try {
    const { force = false } = req.body;

    // Check if recent analysis exists
    if (!force) {
      const latest = await StrategicPrioritiesAnalysis.getLatest();
      if (latest) {
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (latest.analysisDate > hourAgo) {
          return res.status(409).json({
            success: false,
            error: 'Recent analysis exists. Use force=true to run anyway.',
            existingAnalysis: {
              analysisDate: latest.analysisDate,
              banksAnalyzed: latest.coverage?.banksWithPriorities
            }
          });
        }
      }
    }

    // Start analysis (this will take a while)
    res.json({
      success: true,
      message: 'Analysis started. This may take 2-5 minutes.',
      status: 'in_progress'
    });

    // Run analysis in background
    strategicPrioritiesAgent.runAnalysis()
      .then(analysis => {
        console.log(`Strategic priorities analysis completed: ${analysis._id}`);
      })
      .catch(error => {
        console.error('Strategic priorities analysis failed:', error);
      });

  } catch (error) {
    console.error('Error starting analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/strategic-priorities/analyze-sync
 * Trigger a new analysis and wait for completion (for CLI/testing)
 */
router.post('/analyze-sync', async (req, res) => {
  try {
    const { force = false } = req.body;

    // Check if recent analysis exists
    if (!force) {
      const latest = await StrategicPrioritiesAnalysis.getLatest();
      if (latest) {
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (latest.analysisDate > hourAgo) {
          return res.status(409).json({
            success: false,
            error: 'Recent analysis exists. Use force=true to run anyway.'
          });
        }
      }
    }

    // Run analysis synchronously
    const analysis = await strategicPrioritiesAgent.runAnalysis();

    res.json({
      success: true,
      analysis: {
        _id: analysis._id,
        analysisDate: analysis.analysisDate,
        coverage: analysis.coverage,
        categoryCount: analysis.categories?.length || 0,
        differentiatingCount: analysis.differentiatingStrategies?.length || 0,
        processingTime: analysis.analysisMetadata?.processingTime
      }
    });

  } catch (error) {
    console.error('Error running analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/strategic-priorities/search
 * Search for priorities by keyword
 */
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    const analysis = await StrategicPrioritiesAnalysis.getLatest();

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'No analysis found'
      });
    }

    const searchLower = q.toLowerCase();
    const results = [];

    // Search in categories and priorities
    analysis.categories?.forEach(cat => {
      cat.priorities?.forEach(priority => {
        if (priority.title?.toLowerCase().includes(searchLower) ||
            priority.description?.toLowerCase().includes(searchLower)) {
          results.push({
            type: 'priority',
            category: cat.name,
            title: priority.title,
            description: priority.description,
            bankCount: priority.bankCount,
            banks: priority.banks?.map(b => ({ idrssd: b.idrssd, bankName: b.bankName }))
          });
        }
      });
    });

    // Search in differentiating strategies
    analysis.differentiatingStrategies?.forEach(ds => {
      if (ds.title?.toLowerCase().includes(searchLower) ||
          ds.description?.toLowerCase().includes(searchLower) ||
          ds.uniquenessReason?.toLowerCase().includes(searchLower)) {
        results.push({
          type: 'differentiating',
          title: ds.title,
          description: ds.description,
          uniquenessReason: ds.uniquenessReason,
          category: ds.category,
          banks: ds.banks?.map(b => ({ idrssd: b.idrssd, bankName: b.bankName }))
        });
      }
    });

    res.json({
      success: true,
      query: q,
      resultCount: results.length,
      results
    });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
