const express = require('express');
const router = express.Router();
const ubprService = require('../services/ubprService');
const FinancialStatement = require('../models/FinancialStatement');
const Institution = require('../models/Institution');
const CallReportParser = require('../utils/callReportParser');
const UBPRAnalysisAgent = require('../services/ubprAnalysisAgent');
const ubprAnalysisAgent = require('../services/ubprAnalysisAgent');
const pdfMetricsAgent = require('../services/pdfMetricsAgent');

/**
 * GET /api/ubpr/status
 * Check if UBPR service is configured and available
 */
router.get('/status', (req, res) => {
  res.json({
    configured: ubprService.isConfigured(),
    message: ubprService.isConfigured()
      ? 'UBPR service is configured and ready'
      : 'UBPR API credentials not configured. Using simulated data. See ubprService.js for setup instructions.',
    dataSource: ubprService.isConfigured() ? 'ffiec_api' : 'simulated'
  });
});

/**
 * GET /api/ubpr/:idrssd/compare
 * Compare our calculated metrics with UBPR for a single bank
 * Query params: period (YYYY-MM-DD)
 */
router.get('/:idrssd/compare', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { period } = req.query;

    if (!period) {
      return res.status(400).json({ error: 'Period parameter is required (YYYY-MM-DD)' });
    }

    console.log(`Comparing metrics for bank ${idrssd}, period ${period}`);

    // Fetch our calculated data
    const ourStatement = await FinancialStatement.findOne({
      idrssd,
      reportingPeriod: new Date(period)
    }).lean();

    if (!ourStatement) {
      return res.status(404).json({ error: 'Financial statement not found for this bank/period' });
    }

    // Fetch UBPR data
    const ubprData = await ubprService.fetchUBPRData(idrssd, period);

    // Get institution name
    const institution = await Institution.findOne({ idrssd }).select('name').lean();

    // Compare metrics
    const comparison = compareMetrics(ourStatement, ubprData);

    res.json({
      idrssd,
      bankName: institution?.name || 'Unknown',
      period,
      ourMetrics: comparison.our,
      ubprMetrics: comparison.ubpr,
      differences: comparison.differences,
      summary: comparison.summary,
      formulaBreakdown: comparison.formulaBreakdown,
      balanceSheetItems: comparison.balanceSheetItems,
      incomeStatementItems: comparison.incomeStatementItems,
      dataSource: ubprData.dataSource
    });

  } catch (error) {
    console.error('Error comparing UBPR data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ubpr/compare-batch
 * Compare metrics for multiple banks at the same period
 * Body: { idrssds: string[], period: string }
 */
router.post('/compare-batch', async (req, res) => {
  try {
    const { idrssds, period } = req.body;

    if (!idrssds || !Array.isArray(idrssds) || idrssds.length === 0) {
      return res.status(400).json({ error: 'idrssds array is required' });
    }

    if (!period) {
      return res.status(400).json({ error: 'period is required (YYYY-MM-DD)' });
    }

    if (idrssds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 banks per batch' });
    }

    console.log(`Batch comparing ${idrssds.length} banks for period ${period}`);

    // Fetch our statements
    const ourStatements = await FinancialStatement.find({
      idrssd: { $in: idrssds },
      reportingPeriod: new Date(period)
    }).lean();

    // Fetch UBPR data for all banks
    const ubprDataList = await ubprService.fetchBulkUBPRData(idrssds, period);

    // Fetch PDF metrics for all banks (in parallel)
    console.log(`Extracting PDF metrics for ${idrssds.length} banks...`);
    const pdfMetricsPromises = idrssds.map(idrssd =>
      pdfMetricsAgent.extractMetricsFromPDFs(idrssd, period)
        .catch(err => {
          console.error(`PDF extraction failed for ${idrssd}:`, err.message);
          return { hasData: false, metrics: null, note: 'Extraction failed' };
        })
    );
    const pdfMetricsList = await Promise.all(pdfMetricsPromises);

    // Get institution names
    const institutions = await Institution.find({
      idrssd: { $in: idrssds }
    }).select('idrssd name').lean();

    const instMap = new Map(institutions.map(i => [i.idrssd, i.name]));

    // Compare each bank
    const comparisons = idrssds.map((idrssd, index) => {
      const pdfMetrics = pdfMetricsList[index];
      const ourStmt = ourStatements.find(s => s.idrssd === idrssd);
      const ubprData = ubprDataList.find(u => u.idrssd === idrssd);

      if (!ourStmt || !ubprData) {
        return {
          idrssd,
          bankName: instMap.get(idrssd) || 'Unknown',
          error: !ourStmt ? 'No financial statement found' : 'No UBPR data found',
          status: 'missing_data'
        };
      }

      const comparison = compareMetrics(ourStmt, ubprData);

      return {
        idrssd,
        bankName: instMap.get(idrssd) || 'Unknown',
        ourMetrics: comparison.our,
        ubprMetrics: comparison.ubpr,
        pdfMetrics: pdfMetrics?.metrics || null,
        pdfBalanceSheet: pdfMetrics?.balanceSheet || null,
        pdfIncomeStatement: pdfMetrics?.incomeStatement || null,
        pdfSources: pdfMetrics?.sources || [],
        pdfConfidence: pdfMetrics?.confidence || null,
        pdfNote: pdfMetrics?.note || (pdfMetrics?.hasData ? null : 'No PDF data available'),
        pdfWarnings: pdfMetrics?.warnings || [],
        pdfPeriod: pdfMetrics?.period || null,
        pdfQuarter: pdfMetrics?.quarter || null,
        pdfIncomeStatementBasis: pdfMetrics?.incomeStatementBasis || null,
        pdfMetricsBasis: pdfMetrics?.metricsBasis || null,
        differences: comparison.differences,
        summary: comparison.summary,
        formulaBreakdown: comparison.formulaBreakdown,
        balanceSheetItems: comparison.balanceSheetItems,
        incomeStatementItems: comparison.incomeStatementItems,
        status: 'success'
      };
    });

    // Generate aggregate statistics
    const successful = comparisons.filter(c => c.status === 'success');
    const aggregateStats = calculateAggregateStats(successful);

    res.json({
      period,
      totalBanks: idrssds.length,
      successfulComparisons: successful.length,
      comparisons,
      aggregateStats
    });

  } catch (error) {
    console.error('Error in batch comparison:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ubpr/:idrssd/periods
 * Get available UBPR reporting periods for a bank
 */
router.get('/:idrssd/periods', async (req, res) => {
  try {
    const { idrssd } = req.params;

    const periods = await ubprService.getAvailablePeriods(idrssd);

    res.json({
      idrssd,
      periods: periods.map(p => p.toISOString().split('T')[0]),
      count: periods.length
    });

  } catch (error) {
    console.error('Error fetching UBPR periods:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper: Compare metrics between our calculations and UBPR
 */
function compareMetrics(ourStatement, ubprData) {
  const ourMetrics = {
    roa: ourStatement.ratios?.roa,
    roe: ourStatement.ratios?.roe,
    nim: ourStatement.ratios?.netInterestMargin,
    efficiencyRatio: ourStatement.ratios?.efficiencyRatio,
    tier1Leverage: ourStatement.ratios?.tier1LeverageRatio
  };

  const ubprMetrics = {
    roa: ubprData.metrics?.roa,
    roe: ubprData.metrics?.roe,
    nim: ubprData.metrics?.nim,
    efficiencyRatio: ubprData.metrics?.efficiencyRatio,
    tier1Leverage: ubprData.metrics?.tier1LeverageRatio
  };

  const differences = {};
  const metrics = ['roa', 'roe', 'nim', 'efficiencyRatio', 'tier1Leverage'];

  metrics.forEach(metric => {
    const ourValue = ourMetrics[metric];
    const ubprValue = ubprMetrics[metric];

    if (ourValue !== null && ourValue !== undefined &&
        ubprValue !== null && ubprValue !== undefined) {
      const diff = ourValue - ubprValue;
      const percentDiff = ubprValue !== 0 ? (diff / ubprValue) * 100 : 0;

      differences[metric] = {
        absolute: parseFloat(diff.toFixed(4)),
        percent: parseFloat(percentDiff.toFixed(2)),
        status: getVarianceStatus(Math.abs(percentDiff))
      };
    } else {
      differences[metric] = {
        absolute: null,
        percent: null,
        status: 'missing_data'
      };
    }
  });

  // Extract formula components for detailed comparison
  const formulaBreakdown = extractFormulaBreakdown(ourStatement, ubprData);

  // Extract balance sheet and income statement items for comparison
  const balanceSheetItems = extractBalanceSheetItems(ourStatement, ubprData);
  const incomeStatementItems = extractIncomeStatementItems(ourStatement, ubprData);

  // Generate summary
  const summary = generateComparisonSummary(differences);

  return {
    our: ourMetrics,
    ubpr: ubprMetrics,
    differences,
    summary,
    formulaBreakdown,
    balanceSheetItems,
    incomeStatementItems
  };
}

/**
 * Helper function to extract UBPR field value from XBRL data
 * @param {Object} xbrl - XBRL data object
 * @param {string} fieldCode - UBPR field code (without 'uc:' prefix)
 * @param {string} contextRef - Optional context reference to match (e.g., specific date)
 * @returns {number|null} Extracted value or null (converted to thousands to match Call Report scale)
 */
function getUBPRField(xbrl, fieldCode, contextRef = null) {
  if (!xbrl) return null;

  const key = `uc:${fieldCode}`;
  const element = xbrl[key];
  if (!element) return null;

  // Handle array (multiple contexts/periods)
  if (Array.isArray(element)) {
    // If contextRef specified, find matching context
    if (contextRef) {
      const matched = element.find(e => e.$?.contextRef === contextRef);
      if (matched) {
        const value = matched._ || matched;
        const numValue = value && !isNaN(parseFloat(value)) ? parseFloat(value) : null;
        // Convert from dollars to thousands to match Call Report scale
        return numValue !== null ? numValue / 1000 : null;
      }
    }
    // Otherwise return first element
    const first = element[0];
    const value = first._ || first;
    const numValue = value && !isNaN(parseFloat(value)) ? parseFloat(value) : null;
    // Convert from dollars to thousands to match Call Report scale
    return numValue !== null ? numValue / 1000 : null;
  }

  // Handle single element
  const value = element._ || element;
  const numValue = value && !isNaN(parseFloat(value)) ? parseFloat(value) : null;
  // Convert from dollars to thousands to match Call Report scale
  return numValue !== null ? numValue / 1000 : null;
}

/**
 * Extract formula components for each ratio
 */
function extractFormulaBreakdown(ourStatement, ubprData) {
  const bs = ourStatement.balanceSheet;
  const is = ourStatement.incomeStatement;
  const xbrl = ubprData.rawData;

  // Calculate earning assets (same logic as in calculateDerivedMetrics.js)
  const earningAssets =
    bs.assets.earningAssets.loansAndLeases.net +
    bs.assets.earningAssets.securities.availableForSale +
    bs.assets.earningAssets.securities.heldToMaturity +
    bs.assets.earningAssets.securities.equity +
    bs.assets.earningAssets.interestBearingBankBalances +
    bs.assets.earningAssets.fedFundsSoldAndRepos;

  // Extract UBPR component values from XBRL
  // Common UBPR field codes verified from actual XBRL data:
  // UBPR2170 - Total Assets
  // UBPR3210 - Total Equity
  // UBPR4340 - Net Income
  // UBPR3368 - Average Total Assets (for ROA denominator)
  // UBPRA223 - Average Total Equity (for ROE denominator)
  // UBPR4074 - Net Interest Income
  // UBPR4107 - Total Interest Income
  // UBPR4073 - Total Interest Expense
  // UBPRA534 - Average Earning Assets (may not exist in all periods)
  // UBPR4093 - Noninterest Expense
  // UBPR4079 - Noninterest Income
  // UBPRA224 - Alternative average field

  const ubprComponents = {
    totalAssets: getUBPRField(xbrl, 'UBPR2170'),
    avgTotalAssets: getUBPRField(xbrl, 'UBPR3368'),
    totalEquity: getUBPRField(xbrl, 'UBPR3210'),
    avgTotalEquity: getUBPRField(xbrl, 'UBPRA223'), // Updated based on XBRL analysis
    netIncome: getUBPRField(xbrl, 'UBPR4340'),
    netInterestIncome: getUBPRField(xbrl, 'UBPR4074'),
    interestIncome: getUBPRField(xbrl, 'UBPR4107'),
    interestExpense: getUBPRField(xbrl, 'UBPR4073'),
    avgEarningAssets: getUBPRField(xbrl, 'UBPRA534') || getUBPRField(xbrl, 'UBPRA535'), // Fallback to alternative field
    noninterestExpense: getUBPRField(xbrl, 'UBPR4093'),
    noninterestIncome: getUBPRField(xbrl, 'UBPR4079')
  };

  return {
    roa: {
      our: {
        numerator: is.netIncome,
        denominator: bs.assets.totalAssets,
        formula: 'Net Income / Average Total Assets × 100',
        result: ubprData.metrics?.roa ? `Calculated: ${ubprData.metrics.roa}%` : null
      },
      ubpr: {
        numerator: ubprComponents.netIncome,
        denominator: ubprComponents.avgTotalAssets,
        formula: 'Net Income / Average Total Assets × 100',
        result: ubprData.metrics?.roa,
        note: ubprComponents.avgTotalAssets ? null : 'Average Total Assets not available in UBPR data'
      }
    },
    roe: {
      our: {
        numerator: is.netIncome,
        denominator: bs.equity.totalEquity,
        formula: 'Net Income / Average Total Equity × 100',
        result: ubprData.metrics?.roe ? `Calculated: ${ubprData.metrics.roe}%` : null
      },
      ubpr: {
        numerator: ubprComponents.netIncome,
        denominator: ubprComponents.avgTotalEquity,
        formula: 'Net Income / Average Total Equity × 100',
        result: ubprData.metrics?.roe,
        note: ubprComponents.avgTotalEquity ? null : 'Average Total Equity not available in UBPR data'
      }
    },
    nim: {
      our: {
        numerator: is.netInterestIncome,
        denominator: earningAssets,
        formula: 'Net Interest Income / Average Earning Assets × 100',
        components: {
          interestIncome: is.interestIncome.total,
          interestExpense: is.interestExpense.total,
          netInterestIncome: is.netInterestIncome,
          earningAssets
        },
        result: ubprData.metrics?.nim ? `Calculated: ${ubprData.metrics.nim}%` : null
      },
      ubpr: {
        numerator: ubprComponents.netInterestIncome,
        denominator: ubprComponents.avgEarningAssets,
        formula: 'Net Interest Income / Average Earning Assets × 100',
        components: {
          interestIncome: ubprComponents.interestIncome,
          interestExpense: ubprComponents.interestExpense,
          netInterestIncome: ubprComponents.netInterestIncome,
          avgEarningAssets: ubprComponents.avgEarningAssets
        },
        result: ubprData.metrics?.nim,
        note: ubprComponents.avgEarningAssets ? null : 'Average Earning Assets not available in UBPR data'
      }
    },
    efficiencyRatio: {
      our: {
        numerator: is.noninterestExpense.total,
        denominator: is.netInterestIncome + is.noninterestIncome.total,
        formula: 'Noninterest Expense / (Net Interest Income + Noninterest Income) × 100',
        result: ubprData.metrics?.efficiencyRatio ? `Calculated: ${ubprData.metrics.efficiencyRatio}%` : null
      },
      ubpr: {
        numerator: ubprComponents.noninterestExpense,
        denominator: ubprComponents.netInterestIncome && ubprComponents.noninterestIncome
          ? (ubprComponents.netInterestIncome + ubprComponents.noninterestIncome)
          : null,
        formula: 'Noninterest Expense / (Net Interest Income + Noninterest Income) × 100',
        result: ubprData.metrics?.efficiencyRatio,
        note: ubprData.metrics?.efficiencyRatio ? null : 'Not available in UBPR data'
      }
    },
    tier1Leverage: {
      our: {
        numerator: bs.equity.totalEquity,
        denominator: bs.assets.totalAssets,
        formula: 'Total Equity / Total Assets × 100 (approximation)',
        result: ubprData.metrics?.tier1LeverageRatio ? `Calculated: ${ubprData.metrics.tier1LeverageRatio}%` : null
      },
      ubpr: {
        formula: 'Tier 1 Capital / Average Total Assets × 100',
        result: ubprData.metrics?.tier1LeverageRatio,
        note: 'UBPR uses regulatory Tier 1 capital, not total equity. Tier 1 Capital components not available in XBRL.'
      }
    }
  };
}

/**
 * Extract balance sheet items for comparison
 */
function extractBalanceSheetItems(ourStatement, ubprData) {
  const bs = ourStatement.balanceSheet;
  const xbrl = ubprData.rawData;

  // Calculate earning assets (same logic as in calculateDerivedMetrics.js)
  const earningAssets =
    bs.assets.earningAssets.loansAndLeases.net +
    bs.assets.earningAssets.securities.availableForSale +
    bs.assets.earningAssets.securities.heldToMaturity +
    bs.assets.earningAssets.securities.equity +
    bs.assets.earningAssets.interestBearingBankBalances +
    bs.assets.earningAssets.fedFundsSoldAndRepos;

  // UBPR field codes for balance sheet items:
  // UBPR2170 - Total Assets
  // UBPR2122 - Total Loans and Leases (net)
  // UBPRA220 - Total Securities
  // UBPR2200 - Total Deposits
  // UBPR3210 - Total Equity Capital
  // UBPR0081 - Cash and Due from Banks
  // UBPR3368 - Average Total Assets (for ratios)
  // UBPRA223 - Average Total Equity (for ratios)
  // UBPRA534 or UBPRA535 - Average Earning Assets (for ratios)

  return {
    our: {
      totalAssets: bs.assets.totalAssets,
      totalLoans: bs.assets.earningAssets.loansAndLeases.net,
      totalSecurities:
        bs.assets.earningAssets.securities.availableForSale +
        bs.assets.earningAssets.securities.heldToMaturity +
        bs.assets.earningAssets.securities.equity,
      totalDeposits: bs.liabilities.deposits.total,
      totalEquity: bs.equity.totalEquity,
      cashAndDue: bs.assets.nonearningAssets.cashAndDueFromBanks,
      // Add average values used in ratio calculations
      avgTotalAssets: bs.assets.totalAssets, // Our data is point-in-time, not averaged
      avgTotalEquity: bs.equity.totalEquity,  // Our data is point-in-time, not averaged
      avgEarningAssets: earningAssets         // Our data is point-in-time, not averaged
    },
    ubpr: {
      totalAssets: getUBPRField(xbrl, 'UBPR2170'),
      totalLoans: getUBPRField(xbrl, 'UBPR2122'),
      totalSecurities: getUBPRField(xbrl, 'UBPRA220'),
      totalDeposits: getUBPRField(xbrl, 'UBPR2200'),
      totalEquity: getUBPRField(xbrl, 'UBPR3210'),
      cashAndDue: getUBPRField(xbrl, 'UBPR0081'),
      // Add average values used in ratio calculations
      avgTotalAssets: getUBPRField(xbrl, 'UBPR3368'),
      avgTotalEquity: getUBPRField(xbrl, 'UBPRA223'),
      avgEarningAssets: getUBPRField(xbrl, 'UBPRA534') || getUBPRField(xbrl, 'UBPRA535')
    }
  };
}

/**
 * Extract income statement items for comparison
 */
function extractIncomeStatementItems(ourStatement, ubprData) {
  const is = ourStatement.incomeStatement;
  const xbrl = ubprData.rawData;

  // UBPR field codes for income statement items:
  // UBPR4107 - Total Interest Income
  // UBPR4073 - Total Interest Expense
  // UBPR4074 - Net Interest Income
  // UBPRJJ33 - Provision for Loan Losses
  // UBPR4079 - Total Noninterest Income
  // UBPR4093 - Total Noninterest Expense
  // UBPR4340 - Net Income

  return {
    our: {
      interestIncome: is.interestIncome.total,
      interestExpense: is.interestExpense.total,
      netInterestIncome: is.netInterestIncome,
      provisionForLosses: is.provisionForCreditLosses,
      noninterestIncome: is.noninterestIncome.total,
      noninterestExpense: is.noninterestExpense.total,
      netIncome: is.netIncome
    },
    ubpr: {
      interestIncome: getUBPRField(xbrl, 'UBPR4107'),
      interestExpense: getUBPRField(xbrl, 'UBPR4073'),
      netInterestIncome: getUBPRField(xbrl, 'UBPR4074'),
      provisionForLosses: getUBPRField(xbrl, 'UBPRJJ33'),
      noninterestIncome: getUBPRField(xbrl, 'UBPR4079'),
      noninterestExpense: getUBPRField(xbrl, 'UBPR4093'),
      netIncome: getUBPRField(xbrl, 'UBPR4340')
    }
  };
}

/**
 * Determine variance status based on percentage difference
 */
function getVarianceStatus(percentDiff) {
  if (percentDiff < 0.5) return 'match';           // Green: < 0.5%
  if (percentDiff < 2.0) return 'acceptable';      // Yellow: 0.5-2%
  if (percentDiff < 5.0) return 'warning';         // Orange: 2-5%
  return 'significant';                            // Red: > 5%
}

/**
 * Generate comparison summary
 */
function generateComparisonSummary(differences) {
  const metrics = Object.keys(differences);
  const validDiffs = metrics.filter(m =>
    differences[m].status !== 'missing_data'
  );

  if (validDiffs.length === 0) {
    return {
      overallStatus: 'insufficient_data',
      matchCount: 0,
      warningCount: 0,
      significantCount: 0,
      message: 'Insufficient data for comparison'
    };
  }

  const matchCount = validDiffs.filter(m =>
    differences[m].status === 'match'
  ).length;

  const warningCount = validDiffs.filter(m =>
    differences[m].status === 'warning' || differences[m].status === 'acceptable'
  ).length;

  const significantCount = validDiffs.filter(m =>
    differences[m].status === 'significant'
  ).length;

  let overallStatus = 'excellent';
  let message = 'All metrics match UBPR closely';

  if (significantCount > 0) {
    overallStatus = 'needs_review';
    message = `${significantCount} metric(s) show significant variance from UBPR`;
  } else if (warningCount > validDiffs.length * 0.5) {
    overallStatus = 'fair';
    message = `${warningCount} metric(s) show acceptable variance from UBPR`;
  } else if (matchCount === validDiffs.length) {
    overallStatus = 'excellent';
    message = 'All metrics match UBPR closely';
  } else {
    overallStatus = 'good';
    message = `${matchCount} of ${validDiffs.length} metrics match UBPR closely`;
  }

  return {
    overallStatus,
    matchCount,
    warningCount,
    significantCount,
    totalMetrics: validDiffs.length,
    message
  };
}

/**
 * Calculate aggregate statistics across multiple bank comparisons
 */
function calculateAggregateStats(comparisons) {
  const metrics = ['roa', 'roe', 'nim', 'efficiencyRatio', 'tier1Leverage'];
  const stats = {};

  metrics.forEach(metric => {
    const diffs = comparisons
      .map(c => c.differences?.[metric]?.absolute)
      .filter(d => d !== null && d !== undefined && !isNaN(d));

    if (diffs.length === 0) {
      stats[metric] = { avgDiff: null, maxDiff: null, minDiff: null };
      return;
    }

    const avgDiff = diffs.reduce((sum, d) => sum + Math.abs(d), 0) / diffs.length;
    const maxDiff = Math.max(...diffs.map(Math.abs));
    const minDiff = Math.min(...diffs.map(Math.abs));

    stats[metric] = {
      avgDiff: parseFloat(avgDiff.toFixed(4)),
      maxDiff: parseFloat(maxDiff.toFixed(4)),
      minDiff: parseFloat(minDiff.toFixed(4)),
      count: diffs.length
    };
  });

  return stats;
}

/**
 * POST /api/ubpr/analyze
 * Run UBPR analysis agent to investigate variances
 * Body: { idrssds: string[], period?: string, analysisGoal?: string }
 */
router.post('/analyze', async (req, res) => {
  try {
    const { idrssds, period, analysisGoal } = req.body;

    if (!idrssds || !Array.isArray(idrssds) || idrssds.length === 0) {
      return res.status(400).json({ error: 'idrssds array is required' });
    }

    if (idrssds.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 banks per analysis' });
    }

    // Get institution names for better prompting
    const institutions = await Institution.find({
      idrssd: { $in: idrssds }
    }).select('idrssd name').lean();

    const bankNames = institutions.map(i => `${i.name} (${i.idrssd})`).join(', ');

    // Create the analysis agent
    const agent = new UBPRAnalysisAgent({
      maxIterations: 15,
      maxTimeout: 300000, // 5 minutes
      onProgress: (event) => {
        console.log(`[UBPR Agent] ${event.type}:`, event.milestone || event);
      }
    });

    // Build initial prompt
    const defaultGoal = `Analyze UBPR comparison data for the following banks: ${bankNames}.

Your goals:
1. Fetch UBPR comparison data for each bank
2. Identify patterns in the variances (are we consistently over/under-estimating?)
3. Investigate the most significant variances
4. Inspect calculation formulas to understand what might be causing differences
5. Suggest specific improvements to our calculation formulas

${period ? `Focus on reporting period: ${period}` : 'Use the latest available period'}

Be thorough but efficient. Prioritize metrics with significant variances (>5%).`;

    const prompt = analysisGoal || defaultGoal;

    // Run the agent
    console.log('\n=== Starting UBPR Analysis Agent ===');
    console.log(`Banks: ${idrssds.length}`);
    console.log(`Period: ${period || 'latest'}`);

    const results = await agent.run(prompt, {
      baseUrl: `http://localhost:${process.env.PORT || 5001}`
    });

    console.log('=== UBPR Analysis Complete ===');
    console.log(`Iterations: ${results.stats.iterations}`);
    console.log(`Patterns found: ${results.variancePatterns.length}`);
    console.log(`Recommendations: ${results.recommendations.length}`);
    console.log('===========================\n');

    res.json({
      success: true,
      analysis: {
        variancePatterns: results.variancePatterns,
        recommendations: results.recommendations,
        banksAnalyzed: results.banksAnalyzed,
        stats: results.stats
      },
      rawData: results.comparisonData
    });

  } catch (error) {
    console.error('Error in UBPR analysis:', error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/ubpr/analyze-issues
 * Analyze UBPR validation results to detect systematic calculation issues
 * Body: { results: Array, period: string }
 */
router.post('/analyze-issues', async (req, res) => {
  try {
    const { results, period } = req.body;

    if (!results || !Array.isArray(results)) {
      return res.status(400).json({ error: 'results array is required' });
    }

    if (!period) {
      return res.status(400).json({ error: 'period is required' });
    }

    console.log(`Analyzing systematic issues for ${results.length} banks, period ${period}`);

    const analysis = await ubprAnalysisAgent.analyzeSystematicIssues(results, period);

    res.json(analysis);

  } catch (error) {
    console.error('Error analyzing issues:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
