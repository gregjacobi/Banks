const express = require('express');
const router = express.Router();
const Institution = require('../models/Institution');
const FinancialStatement = require('../models/FinancialStatement');

/**
 * GET /api/banks
 * Search and list banks with optional filtering and sorting
 */
router.get('/', async (req, res) => {
  try {
    const {
      search = '',
      sortBy = 'totalAssets',
      limit = 50,
      offset = 0
    } = req.query;

    // Build query
    let query = {};
    if (search) {
      query.$text = { $search: search };
    }

    // For totalAssets sorting, use optimized aggregation pipeline
    if (sortBy === 'totalAssets' && !search) {
      // Step 1: Find the most recent quarter across ALL banks
      const mostRecentPeriod = await FinancialStatement.findOne()
        .sort({ reportingPeriod: -1 })
        .select('reportingPeriod')
        .lean();

      if (!mostRecentPeriod || !mostRecentPeriod.reportingPeriod) {
        return res.json({
          banks: [],
          total: 0,
          limit: parseInt(limit),
          offset: parseInt(offset)
        });
      }

      const latestQuarter = mostRecentPeriod.reportingPeriod;

      // Step 2: Only include banks that have data for the most recent quarter
      // Then sort by assets and limit to top N
      const banksWithAssets = await FinancialStatement.aggregate([
        // Match only statements from the most recent quarter
        { $match: { reportingPeriod: latestQuarter } },
        // Sort by total assets descending
        { $sort: { 'balanceSheet.assets.totalAssets': -1 } },
        // Apply pagination at database level
        { $skip: parseInt(offset) },
        { $limit: parseInt(limit) },
        // Project only needed fields
        {
          $project: {
            idrssd: 1,
            totalAssets: '$balanceSheet.assets.totalAssets',
            reportingPeriod: '$reportingPeriod',
            netIncome: '$incomeStatement.netIncome',
            efficiencyRatio: '$ratios.efficiencyRatio',
            roa: '$ratios.roa',
            roe: '$ratios.roe',
            netInterestMargin: '$ratios.netInterestMargin',
            fullTimeEquivalentEmployees: '$incomeStatement.fullTimeEquivalentEmployees'
          }
        }
      ]);

      // Get institution details for the returned banks
      const idrssds = banksWithAssets.map(b => b.idrssd);
      const institutions = await Institution.find({
        idrssd: { $in: idrssds }
      }).lean();

      // Create institution map
      const instMap = new Map(institutions.map(i => [i.idrssd, i]));

      // Combine data
      const banks = banksWithAssets.map(b => {
        const inst = instMap.get(b.idrssd);
        return {
          idrssd: b.idrssd,
          name: inst?.name || 'Unknown',
          city: inst?.city || '',
          state: inst?.state || '',
          totalAssets: b.totalAssets || 0,
          reportingPeriod: b.reportingPeriod,
          netIncome: b.netIncome || 0,
          efficiencyRatio: b.efficiencyRatio,
          roa: b.roa,
          roe: b.roe,
          netInterestMargin: b.netInterestMargin,
          fullTimeEquivalentEmployees: b.fullTimeEquivalentEmployees || 0
        };
      });

      // Get total count of banks with data for the most recent quarter
      const totalCount = await FinancialStatement.distinct('idrssd', {
        reportingPeriod: latestQuarter
      });

      return res.json({
        banks,
        total: totalCount.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } else {
      // For search queries, use original approach
      const institutions = await Institution.find(query)
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .sort({ name: 1 });

      const idrssds = institutions.map(inst => inst.idrssd);
      const financialStatements = await FinancialStatement.find({
        idrssd: { $in: idrssds }
      })
        .sort({ reportingPeriod: -1 });

      const fsMap = new Map();
      financialStatements.forEach(fs => {
        if (!fsMap.has(fs.idrssd)) {
          fsMap.set(fs.idrssd, fs);
        }
      });

      const banks = institutions.map(inst => {
        const fs = fsMap.get(inst.idrssd);
        return {
          idrssd: inst.idrssd,
          name: inst.name,
          city: inst.city,
          state: inst.state,
          totalAssets: fs?.balanceSheet?.assets?.totalAssets || 0,
          reportingPeriod: fs?.reportingPeriod,
          netIncome: fs?.incomeStatement?.netIncome || 0,
          efficiencyRatio: fs?.ratios?.efficiencyRatio,
          roa: fs?.ratios?.roa,
          roe: fs?.ratios?.roe,
          netInterestMargin: fs?.ratios?.netInterestMargin,
          fullTimeEquivalentEmployees: fs?.incomeStatement?.fullTimeEquivalentEmployees || 0
        };
      });

      // Sort by total assets if requested
      if (sortBy === 'totalAssets') {
        banks.sort((a, b) => b.totalAssets - a.totalAssets);
      }

      const total = await Institution.countDocuments(query);

      return res.json({
        banks,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    }

  } catch (error) {
    console.error('Error fetching banks:', error);
    res.status(500).json({ error: 'Failed to fetch banks' });
  }
});

/**
 * GET /api/banks/:idrssd
 * Get detailed information for a specific bank
 */
router.get('/:idrssd', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { period } = req.query;

    const institution = await Institution.findOne({ idrssd });
    if (!institution) {
      return res.status(404).json({ error: 'Bank not found' });
    }

    // Get all available reporting periods for this bank
    const allPeriods = await FinancialStatement.find({ idrssd })
      .select('reportingPeriod')
      .sort({ reportingPeriod: -1 });

    const availablePeriods = allPeriods.map(fs => fs.reportingPeriod);

    // Get specific financial statement
    let financialStatement;
    if (period) {
      // Get specific period
      financialStatement = await FinancialStatement.findOne({
        idrssd,
        reportingPeriod: new Date(period)
      });
    } else {
      // Get latest
      financialStatement = await FinancialStatement.findOne({ idrssd })
        .sort({ reportingPeriod: -1 });
    }

    res.json({
      institution,
      financialStatement,
      availablePeriods
    });

  } catch (error) {
    console.error('Error fetching bank details:', error);
    res.status(500).json({ error: 'Failed to fetch bank details' });
  }
});

/**
 * GET /api/banks/:idrssd/balance-sheet
 * Get balance sheet for a specific bank and period
 */
router.get('/:idrssd/balance-sheet', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { period } = req.query;

    const query = { idrssd };
    if (period) {
      query.reportingPeriod = new Date(period);
    }

    const financialStatement = await FinancialStatement.findOne(query)
      .sort({ reportingPeriod: -1 });

    if (!financialStatement) {
      return res.status(404).json({ error: 'Balance sheet not found' });
    }

    res.json({
      idrssd,
      reportingPeriod: financialStatement.reportingPeriod,
      balanceSheet: financialStatement.balanceSheet,
      validation: financialStatement.validation
    });

  } catch (error) {
    console.error('Error fetching balance sheet:', error);
    res.status(500).json({ error: 'Failed to fetch balance sheet' });
  }
});

/**
 * GET /api/banks/:idrssd/income-statement
 * Get income statement for a specific bank and period
 */
router.get('/:idrssd/income-statement', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { period } = req.query;

    const query = { idrssd };
    if (period) {
      query.reportingPeriod = new Date(period);
    }

    const financialStatement = await FinancialStatement.findOne(query)
      .sort({ reportingPeriod: -1 });

    if (!financialStatement) {
      return res.status(404).json({ error: 'Income statement not found' });
    }

    res.json({
      idrssd,
      reportingPeriod: financialStatement.reportingPeriod,
      incomeStatement: financialStatement.incomeStatement,
      validation: financialStatement.validation
    });

  } catch (error) {
    console.error('Error fetching income statement:', error);
    res.status(500).json({ error: 'Failed to fetch income statement' });
  }
});

/**
 * GET /api/banks/:idrssd/time-series
 * Get time-series data for a specific bank
 */
router.get('/:idrssd/time-series', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { startDate, endDate } = req.query;

    const query = { idrssd };
    if (startDate || endDate) {
      query.reportingPeriod = {};
      if (startDate) query.reportingPeriod.$gte = new Date(startDate);
      if (endDate) query.reportingPeriod.$lte = new Date(endDate);
    }

    const financialStatements = await FinancialStatement.find(query)
      .sort({ reportingPeriod: 1 });

    res.json({
      idrssd,
      periods: financialStatements.map(fs => ({
        reportingPeriod: fs.reportingPeriod,
        totalAssets: fs.balanceSheet.assets.totalAssets,
        totalEquity: fs.balanceSheet.equity.totalEquity,
        netIncome: fs.incomeStatement.netIncome
      })),
      fullData: financialStatements
    });

  } catch (error) {
    console.error('Error fetching time-series data:', error);
    res.status(500).json({ error: 'Failed to fetch time-series data' });
  }
});

/**
 * GET /api/banks/:idrssd/peer-banks
 * Get peer banks data for comparison charts (only the 20 peers + target bank)
 */
router.get('/:idrssd/peer-banks', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { period } = req.query;

    if (!period) {
      return res.status(400).json({ error: 'Period parameter is required' });
    }

    // Get the target bank's peer analysis to find peer IDs
    const targetStatement = await FinancialStatement.findOne({
      idrssd,
      reportingPeriod: new Date(period)
    })
      .select('peerAnalysis balanceSheet.assets.totalAssets ratios')
      .lean();

    if (!targetStatement || !targetStatement.peerAnalysis) {
      return res.status(404).json({ error: 'Peer analysis not found for this bank/period' });
    }

    const peerIds = targetStatement.peerAnalysis.peers.peerIds || [];

    // Include target bank + peers
    const allIds = [idrssd, ...peerIds];

    // Get statements for target bank and peers only
    const statements = await FinancialStatement.find({
      idrssd: { $in: allIds },
      reportingPeriod: new Date(period)
    })
      .select('idrssd ratios balanceSheet.assets.totalAssets')
      .lean();

    // Get institution names
    const institutions = await Institution.find({
      idrssd: { $in: allIds }
    })
      .select('idrssd name')
      .lean();

    const institutionMap = new Map(institutions.map(i => [i.idrssd, i.name]));

    // Combine data
    const banksData = statements.map(stmt => ({
      idrssd: stmt.idrssd,
      name: institutionMap.get(stmt.idrssd) || `Bank ${stmt.idrssd}`,
      totalAssets: stmt.balanceSheet?.assets?.totalAssets || 0,
      efficiencyRatio: stmt.ratios?.efficiencyRatio || null,
      roe: stmt.ratios?.roe || null,
      roa: stmt.ratios?.roa || null,
      nim: stmt.ratios?.netInterestMargin || null,
      operatingLeverage: stmt.ratios?.operatingLeverage || null
    }));

    res.json({
      period,
      targetBankId: idrssd,
      banks: banksData
    });

  } catch (error) {
    console.error('Error fetching peer banks:', error);
    res.status(500).json({ error: 'Failed to fetch peer banks data' });
  }
});

module.exports = router;
