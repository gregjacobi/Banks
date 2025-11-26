/**
 * TAM (Total Addressable Market) API Routes
 *
 * Endpoints for calculating and managing TAM assumptions and projections
 */

const express = require('express');
const router = express.Router();
const TAMAssumptions = require('../models/TAMAssumptions');
const TeamRoster = require('../models/TeamRoster');
const tamCalculationService = require('../services/tamCalculationService');

const TIERS = ['Mega', 'Strategic', 'Enterprise', 'Commercial', 'SmallBusiness'];
const QUARTERS = [
  '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4',
  '2027-Q1', '2027-Q2', '2027-Q3', '2027-Q4',
  '2028-Q1', '2028-Q2', '2028-Q3', '2028-Q4'
];

/**
 * GET /api/tam/global
 * Get global default assumptions
 */
router.get('/global', async (req, res) => {
  try {
    const global = await TAMAssumptions.getGlobalDefaults();
    res.json(global);
  } catch (error) {
    console.error('Error fetching global TAM assumptions:', error);
    res.status(500).json({ error: 'Failed to fetch global assumptions' });
  }
});

/**
 * PUT /api/tam/global
 * Update global default assumptions
 */
router.put('/global', async (req, res) => {
  try {
    const { assumptions, coverage, penetration, penetrationByProduct, penetrationBySegment, teamSizing } = req.body;

    console.log('Updating global assumptions:', {
      hasAssumptions: !!assumptions,
      hasCoverage: !!coverage,
      hasPenetration: !!penetration,
      hasPenetrationByProduct: !!penetrationByProduct,
      hasPenetrationBySegment: !!penetrationBySegment,
      hasTeamSizing: !!teamSizing
    });

    let global = await TAMAssumptions.findOne({ idrssd: null });

    if (!global) {
      // Create new global using getGlobalDefaults (which creates defaults)
      global = await TAMAssumptions.getGlobalDefaults();
    }

    // Update existing global
    if (assumptions) {
      global.assumptions = transformAssumptions(assumptions, 'global');
    }
    if (coverage) {
      global.coverage = transformAssumptions(coverage, 'global');
    }
    if (penetration) {
      global.penetration = transformPenetration(penetration, 'global');
    }
    if (penetrationByProduct) {
      global.penetrationByProduct = transformPenetrationByProduct(penetrationByProduct, 'global');
    }
    if (penetrationBySegment) {
      global.penetrationBySegment = transformPenetrationBySegment(penetrationBySegment, 'global');
    }
    if (teamSizing) {
      global.teamSizing = transformTeamSizing(teamSizing, 'global');
    }
    global.updatedAt = new Date();

    await global.save();

    console.log('Global assumptions saved successfully');
    res.json(global);
  } catch (error) {
    console.error('Error updating global TAM assumptions:', error);
    res.status(500).json({ error: 'Failed to update global assumptions', details: error.message });
  }
});

/**
 * GET /api/tam/banks
 * Get TAM summary for all banks (dashboard view)
 */
router.get('/banks', async (req, res) => {
  try {
    const {
      limit = 100,
      minAssets = 0,
      sortBy = 'tam',
      sortOrder = 'desc'
    } = req.query;

    const result = await tamCalculationService.calculateAllBanksTAM({
      limit: parseInt(limit),
      minAssets: parseInt(minAssets),
      sortBy,
      sortOrder
    });

    res.json(result);
  } catch (error) {
    console.error('Error calculating TAM for all banks:', error);
    res.status(500).json({ error: 'Failed to calculate TAM' });
  }
});

/**
 * GET /api/tam/banks/:idrssd
 * Get detailed TAM for a specific bank
 */
router.get('/banks/:idrssd', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { period } = req.query;

    const result = await tamCalculationService.calculateBankTAM(idrssd, { period });
    res.json(result);
  } catch (error) {
    console.error(`Error calculating TAM for bank ${req.params.idrssd}:`, error);
    res.status(500).json({ error: 'Failed to calculate TAM', details: error.message });
  }
});

/**
 * GET /api/tam/banks/:idrssd/assumptions
 * Get assumptions for a specific bank (merged with global)
 */
router.get('/banks/:idrssd/assumptions', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const assumptions = await TAMAssumptions.getForBank(idrssd);
    res.json(assumptions);
  } catch (error) {
    console.error(`Error fetching assumptions for bank ${req.params.idrssd}:`, error);
    res.status(500).json({ error: 'Failed to fetch assumptions' });
  }
});

/**
 * PUT /api/tam/banks/:idrssd/assumptions
 * Update assumptions for a specific bank
 * Also accepts penetrationByProduct for bank-specific penetration overrides
 */
router.put('/banks/:idrssd/assumptions', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { assumptions, coverage, penetrationByProduct, source = 'human', updatedBy = 'user' } = req.body;

    const updates = {};

    if (assumptions) {
      // Transform to source-wrapped format
      for (const [category, fields] of Object.entries(assumptions)) {
        updates[`assumptions.${category}`] = {};
        for (const [field, value] of Object.entries(fields)) {
          updates[`assumptions.${category}.${field}`] = {
            value: typeof value === 'object' ? value.value : value,
            source,
            updatedAt: new Date(),
            updatedBy
          };
        }
      }
    }

    if (coverage) {
      for (const [field, value] of Object.entries(coverage)) {
        updates[`coverage.${field}`] = {
          value: typeof value === 'object' ? value.value : value,
          source,
          updatedAt: new Date(),
          updatedBy
        };
      }
    }

    // Handle penetrationByProduct for bank-specific overrides
    if (penetrationByProduct) {
      const products = ['claudeCode', 'claudeEnterprise', 'agentsRunBusiness', 'agentsGrowBusiness'];
      const quarters = [
        '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4',
        '2027-Q1', '2027-Q2', '2027-Q3', '2027-Q4',
        '2028-Q1', '2028-Q2', '2028-Q3', '2028-Q4'
      ];

      for (const product of products) {
        if (penetrationByProduct[product]) {
          for (const quarter of quarters) {
            if (penetrationByProduct[product][quarter] !== undefined) {
              const data = penetrationByProduct[product][quarter];
              updates[`penetrationByProduct.${product}.${quarter}`] = {
                target: data.target !== undefined ? data.target : 0,
                actual: data.actual !== undefined ? data.actual : null,
                source,
                updatedAt: new Date(),
                notes: data.notes || ''
              };
            }
          }
        }
      }
    }

    updates.updatedAt = new Date();

    const result = await TAMAssumptions.findOneAndUpdate(
      { idrssd },
      { $set: updates },
      { upsert: true, new: true }
    );

    // Return merged assumptions
    const merged = await TAMAssumptions.getForBank(idrssd);
    res.json(merged);
  } catch (error) {
    console.error(`Error updating assumptions for bank ${req.params.idrssd}:`, error);
    res.status(500).json({ error: 'Failed to update assumptions' });
  }
});

/**
 * PUT /api/tam/banks/:idrssd/penetration
 * Update penetration targets/actuals for a specific bank
 */
router.put('/banks/:idrssd/penetration', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { penetration, source = 'human', updatedBy = 'user' } = req.body;

    const updates = { updatedAt: new Date() };

    for (const [quarter, data] of Object.entries(penetration)) {
      if (data.target !== undefined) {
        updates[`penetration.${quarter}.target`] = data.target;
        updates[`penetration.${quarter}.source`] = source;
        updates[`penetration.${quarter}.updatedAt`] = new Date();
      }
      if (data.actual !== undefined) {
        updates[`penetration.${quarter}.actual`] = data.actual;
      }
      if (data.notes !== undefined) {
        updates[`penetration.${quarter}.notes`] = data.notes;
      }
    }

    const result = await TAMAssumptions.findOneAndUpdate(
      { idrssd },
      { $set: updates },
      { upsert: true, new: true }
    );

    // Return merged assumptions
    const merged = await TAMAssumptions.getForBank(idrssd);
    res.json(merged);
  } catch (error) {
    console.error(`Error updating penetration for bank ${req.params.idrssd}:`, error);
    res.status(500).json({ error: 'Failed to update penetration' });
  }
});

/**
 * GET /api/tam/team-sizing
 * Get team sizing analysis for portfolio coverage
 */
router.get('/team-sizing', async (req, res) => {
  try {
    const { targetBankCount } = req.query;

    const result = await tamCalculationService.calculateTeamSizing({
      targetBankCount: targetBankCount ? parseInt(targetBankCount) : undefined
    });

    // Calculate capacity-based revenue capture
    const capacityData = await tamCalculationService.calculateCapacityBasedRevenue(
      result.coveredBanks,
      result.teamByTier,
      result.penetrationBySegment
    );

    // Merge capacity data into result
    res.json({
      ...result,
      capacityAnalysis: capacityData
    });
  } catch (error) {
    console.error('Error calculating team sizing:', error);
    res.status(500).json({ error: 'Failed to calculate team sizing', details: error.message });
  }
});

/**
 * GET /api/tam/pipeline
 * Get revenue pipeline with forecast vs capacity-based capture
 * Accounts for hiring ramp (3-month ramp for new hires, mid-quarter start)
 */
router.get('/pipeline', async (req, res) => {
  try {
    const { targetBankCount } = req.query;

    // Get team sizing data with capacity analysis
    const teamSizingResult = await tamCalculationService.calculateTeamSizing({
      targetBankCount: targetBankCount ? parseInt(targetBankCount) : undefined
    });

    // Get capacity-based revenue
    const capacityData = await tamCalculationService.calculateCapacityBasedRevenue(
      teamSizingResult.coveredBanks,
      teamSizingResult.teamByTier,
      teamSizingResult.penetrationBySegment
    );

    // Build pipeline response with yearly breakdown
    const pipeline = {
      years: ['2026', '2027', '2028'],
      quarterlyData: {},
      yearlyData: {},
      effectiveCapacity: capacityData.effectiveCapacityTimeline || {},
      hiringPlan: capacityData.roster?.hiringPlan || []
    };

    // Quarterly breakdown
    for (const quarter of [
      '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4',
      '2027-Q1', '2027-Q2', '2027-Q3', '2027-Q4',
      '2028-Q1', '2028-Q2', '2028-Q3', '2028-Q4'
    ]) {
      const fullCoverage = teamSizingResult.quarterlyRevenue[quarter]?.total || 0;
      const capacityBased = capacityData.adjustedQuarterlyRevenue?.[quarter]?.capturedRevenue || 0;
      const headcount = capacityData.headcountTimeline?.[quarter] || { aes: 0, ses: 0, total: 0 };
      const effective = capacityData.effectiveCapacityTimeline?.[quarter] || headcount;

      pipeline.quarterlyData[quarter] = {
        fullCoverageRevenue: fullCoverage,
        capacityBasedRevenue: capacityBased,
        captureRate: fullCoverage > 0 ? capacityBased / fullCoverage : 0,
        gap: fullCoverage - capacityBased,
        headcount: headcount.total,
        effectiveHeadcount: effective.effectiveHeadcount || headcount.total,
        newHires: (effective.newHiresAE || 0) + (effective.newHiresSE || 0),
        dedicatedBanks: capacityData.quarterlyCapacity?.[quarter]?.dedicatedCount || 0,
        reactiveBanks: capacityData.quarterlyCapacity?.[quarter]?.reactiveCount || 0
      };
    }

    // Yearly aggregations
    for (const year of ['2026', '2027', '2028']) {
      const quarters = [`${year}-Q1`, `${year}-Q2`, `${year}-Q3`, `${year}-Q4`];

      const yearData = quarters.reduce((acc, q) => {
        const qData = pipeline.quarterlyData[q];
        return {
          fullCoverageRevenue: acc.fullCoverageRevenue + qData.fullCoverageRevenue,
          capacityBasedRevenue: acc.capacityBasedRevenue + qData.capacityBasedRevenue,
          gap: acc.gap + qData.gap
        };
      }, { fullCoverageRevenue: 0, capacityBasedRevenue: 0, gap: 0 });

      const q4Data = pipeline.quarterlyData[`${year}-Q4`];
      yearData.exitRRR_fullCoverage = (teamSizingResult.quarterlyRevenue[`${year}-Q4`]?.total || 0) * 4;
      yearData.exitRRR_capacityBased = (capacityData.adjustedQuarterlyRevenue?.[`${year}-Q4`]?.capturedRevenue || 0) * 4;
      yearData.exitHeadcount = q4Data.headcount;
      yearData.exitEffectiveHeadcount = q4Data.effectiveHeadcount;
      yearData.captureRate = yearData.fullCoverageRevenue > 0
        ? yearData.capacityBasedRevenue / yearData.fullCoverageRevenue
        : 0;

      pipeline.yearlyData[year] = yearData;
    }

    // Summary metrics
    pipeline.summary = {
      totalFullCoverage: capacityData.summary?.total?.potential || 0,
      totalCapacityBased: capacityData.summary?.total?.captured || 0,
      totalGap: (capacityData.summary?.total?.potential || 0) - (capacityData.summary?.total?.captured || 0),
      averageCaptureRate: capacityData.summary?.total?.captureRate || 0,
      finalHeadcount: capacityData.headcountTimeline?.['2028-Q4']?.total || 0,
      requiredHeadcount: teamSizingResult.teamTotals?.total || 0,
      headcountGap: (teamSizingResult.teamTotals?.total || 0) - (capacityData.headcountTimeline?.['2028-Q4']?.total || 0),
      reactiveCaptureRate: capacityData.assumptions?.reactiveCaptureRate || 0.10
    };

    // Include roster info for hiring plan editing
    pipeline.roster = {
      currentMembers: capacityData.roster?.memberCount || 0,
      hiringPlan: capacityData.roster?.hiringPlan || [],
      assumptions: capacityData.assumptions || {}
    };

    // Include coverage data for pipeline visual
    pipeline.coverage = {
      tamCovered: teamSizingResult.coverage?.tamCovered || 0,
      coveredBankCount: teamSizingResult.coverage?.coveredBankCount || 0,
      totalTAM: teamSizingResult.coverage?.totalTAM || 0,
      totalBankCount: teamSizingResult.coverage?.totalBankCount || 0
    };

    res.json(pipeline);
  } catch (error) {
    console.error('Error calculating pipeline:', error);
    res.status(500).json({ error: 'Failed to calculate pipeline', details: error.message });
  }
});

/**
 * GET /api/tam/aggregate
 * Get portfolio-level TAM totals and breakdowns
 */
router.get('/aggregate', async (req, res) => {
  try {
    const { minAssets = 0 } = req.query;

    const result = await tamCalculationService.calculateAllBanksTAM({
      limit: 10000, // Get all banks for aggregate
      minAssets: parseInt(minAssets)
    });

    res.json({
      aggregate: result.aggregate,
      period: result.period,
      totalBanks: result.totalBanks
    });
  } catch (error) {
    console.error('Error calculating aggregate TAM:', error);
    res.status(500).json({ error: 'Failed to calculate aggregate TAM' });
  }
});

/**
 * DELETE /api/tam/banks/:idrssd/assumptions
 * Reset bank assumptions to global defaults
 */
router.delete('/banks/:idrssd/assumptions', async (req, res) => {
  try {
    const { idrssd } = req.params;

    await TAMAssumptions.deleteOne({ idrssd });

    // Return global defaults
    const merged = await TAMAssumptions.getForBank(idrssd);
    res.json({ message: 'Reset to global defaults', assumptions: merged });
  } catch (error) {
    console.error(`Error resetting assumptions for bank ${req.params.idrssd}:`, error);
    res.status(500).json({ error: 'Failed to reset assumptions' });
  }
});

/**
 * Helper: Transform assumptions to source-wrapped format
 */
function transformAssumptions(obj, source) {
  if (!obj) return undefined;

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !value.value) {
      // Nested object
      result[key] = {};
      for (const [subKey, subValue] of Object.entries(value)) {
        result[key][subKey] = {
          value: typeof subValue === 'object' && subValue.value !== undefined ? subValue.value : subValue,
          source,
          updatedAt: new Date()
        };
      }
    } else if (typeof value === 'object' && value !== null && value.value !== undefined) {
      // Already wrapped
      result[key] = { ...value, source, updatedAt: new Date() };
    } else {
      // Simple value
      result[key] = { value, source, updatedAt: new Date() };
    }
  }
  return result;
}

/**
 * Helper: Transform penetration to proper format
 */
function transformPenetration(obj, source) {
  if (!obj) return undefined;

  const result = {};
  for (const [quarter, data] of Object.entries(obj)) {
    result[quarter] = {
      target: data.target !== undefined ? data.target : 0,
      actual: data.actual !== undefined ? data.actual : null,
      source,
      updatedAt: new Date(),
      notes: data.notes || ''
    };
  }
  return result;
}

/**
 * Helper: Transform penetrationByProduct to proper format
 */
function transformPenetrationByProduct(obj, source) {
  if (!obj) return undefined;

  const result = {};
  const products = ['claudeCode', 'claudeEnterprise', 'agentsRunBusiness', 'agentsGrowBusiness'];

  for (const product of products) {
    if (obj[product]) {
      result[product] = {};
      for (const [quarter, data] of Object.entries(obj[product])) {
        result[product][quarter] = {
          target: data.target !== undefined ? data.target : 0,
          actual: data.actual !== undefined ? data.actual : null,
          source,
          updatedAt: new Date(),
          notes: data.notes || ''
        };
      }
    }
  }
  return result;
}

/**
 * Helper: Transform penetrationBySegment to proper format
 * Structure: { Mega: { claudeCode: { '2026-Q1': { target, ... }, ... }, ... }, ... }
 */
function transformPenetrationBySegment(obj, source) {
  if (!obj) return undefined;

  const result = {};
  const segments = ['Mega', 'Strategic', 'Enterprise', 'Commercial', 'SmallBusiness'];
  const products = ['claudeCode', 'claudeEnterprise', 'agentsRunBusiness', 'agentsGrowBusiness'];

  for (const segment of segments) {
    if (obj[segment]) {
      result[segment] = {};
      for (const product of products) {
        if (obj[segment][product]) {
          result[segment][product] = {};
          for (const [quarter, data] of Object.entries(obj[segment][product])) {
            result[segment][product][quarter] = {
              target: data.target !== undefined ? data.target : 0,
              actual: data.actual !== undefined ? data.actual : null,
              source,
              updatedAt: new Date(),
              notes: data.notes || ''
            };
          }
        }
      }
    }
  }
  return result;
}

/**
 * Helper: Transform teamSizing to proper format (asset-based tiers)
 */
function transformTeamSizing(obj, source) {
  if (!obj) return undefined;

  const result = {};
  const fields = [
    'targetBankCount',
    // Asset-based tier thresholds
    'megaTierThreshold', 'strategicTierThreshold', 'enterpriseTierThreshold', 'commercialTierThreshold',
    // $ Billion per AE by tier
    'billionPerAE_Mega', 'billionPerAE_Strategic', 'billionPerAE_Enterprise', 'billionPerAE_Commercial', 'billionPerAE_SmallBusiness',
    // SE per AE by tier
    'sePerAE_Mega', 'sePerAE_Strategic', 'sePerAE_Enterprise', 'sePerAE_Commercial', 'sePerAE_SmallBusiness',
    // Hiring ramp
    'aeRampQuarters'
  ];

  for (const field of fields) {
    if (obj[field] !== undefined) {
      const value = typeof obj[field] === 'object' && obj[field].value !== undefined
        ? obj[field].value
        : obj[field];
      result[field] = {
        value,
        source,
        updatedAt: new Date()
      };
    }
  }
  return result;
}

// ============================================================================
// TEAM ROSTER & HIRING PLAN ROUTES
// ============================================================================

/**
 * GET /api/tam/roster
 * Get team roster with segment-based hiring plan and member details
 */
router.get('/roster', async (req, res) => {
  try {
    const roster = await TeamRoster.getGlobalRoster();

    // Get team sizing for target calculations
    const teamSizing = await tamCalculationService.calculateTeamSizing({});

    // Calculate target hires by segment (what's needed for full coverage)
    const targetBySegment = {};
    for (const tier of TIERS) {
      const tierData = teamSizing.teamByTier?.[tier] || {};
      targetBySegment[tier] = {
        aesNeeded: tierData.aesNeeded || 0,
        sesNeeded: tierData.sesNeeded || 0,
        bankCount: tierData.bankCount || 0,
        tam: tierData.tam || 0
      };
    }

    // Get current headcount by segment from existing members
    const activeMembers = roster.members.filter(m => m.isActive && !m.isPlannedHire);
    const currentBySegment = {};
    for (const tier of TIERS) {
      currentBySegment[tier] = {
        aes: activeMembers.filter(m => m.role === 'AE' && m.assignedTier === tier).length,
        ses: activeMembers.filter(m => m.role === 'SE' && m.assignedTier === tier).length
      };
    }

    // Calculate hiring gap by segment
    const gapBySegment = {};
    for (const tier of TIERS) {
      // Sum planned hires across all quarters for this segment
      let plannedAEs = 0, plannedSEs = 0;
      for (const plan of roster.segmentHiringPlan || []) {
        plannedAEs += plan.bySegment?.[tier]?.aes || 0;
        plannedSEs += plan.bySegment?.[tier]?.ses || 0;
      }

      gapBySegment[tier] = {
        aesNeeded: targetBySegment[tier].aesNeeded,
        sesNeeded: targetBySegment[tier].sesNeeded,
        currentAEs: currentBySegment[tier].aes,
        currentSEs: currentBySegment[tier].ses,
        plannedAEs,
        plannedSEs,
        aesGap: Math.max(0, targetBySegment[tier].aesNeeded - currentBySegment[tier].aes - plannedAEs),
        sesGap: Math.max(0, targetBySegment[tier].sesNeeded - currentBySegment[tier].ses - plannedSEs)
      };
    }

    res.json({
      members: roster.members,
      segmentHiringPlan: roster.segmentHiringPlan,
      assumptions: roster.assumptions,
      targetBySegment,
      currentBySegment,
      gapBySegment,
      summary: {
        totalMembers: activeMembers.length,
        totalAEs: activeMembers.filter(m => m.role === 'AE').length,
        totalSEs: activeMembers.filter(m => m.role === 'SE').length,
        targetTotalAEs: Object.values(targetBySegment).reduce((sum, t) => sum + t.aesNeeded, 0),
        targetTotalSEs: Object.values(targetBySegment).reduce((sum, t) => sum + t.sesNeeded, 0)
      },
      updatedAt: roster.updatedAt
    });
  } catch (error) {
    console.error('Error fetching roster:', error);
    res.status(500).json({ error: 'Failed to fetch roster', details: error.message });
  }
});

/**
 * PUT /api/tam/roster/hiring-plan
 * Update segment-based hiring plan
 */
router.put('/roster/hiring-plan', async (req, res) => {
  try {
    const { segmentHiringPlan } = req.body;

    if (!segmentHiringPlan) {
      return res.status(400).json({ error: 'segmentHiringPlan is required' });
    }

    const roster = await TeamRoster.getGlobalRoster();

    // Update segment hiring plan
    roster.segmentHiringPlan = QUARTERS.map(q => {
      const incoming = segmentHiringPlan.find(p => p.quarter === q);
      return {
        quarter: q,
        bySegment: {
          Mega: { aes: incoming?.bySegment?.Mega?.aes || 0, ses: incoming?.bySegment?.Mega?.ses || 0 },
          Strategic: { aes: incoming?.bySegment?.Strategic?.aes || 0, ses: incoming?.bySegment?.Strategic?.ses || 0 },
          Enterprise: { aes: incoming?.bySegment?.Enterprise?.aes || 0, ses: incoming?.bySegment?.Enterprise?.ses || 0 },
          Commercial: { aes: incoming?.bySegment?.Commercial?.aes || 0, ses: incoming?.bySegment?.Commercial?.ses || 0 },
          SmallBusiness: { aes: incoming?.bySegment?.SmallBusiness?.aes || 0, ses: incoming?.bySegment?.SmallBusiness?.ses || 0 }
        },
        notes: incoming?.notes || ''
      };
    });

    // Also update legacy hiringPlan for backwards compatibility
    roster.hiringPlan = QUARTERS.map(q => {
      const plan = roster.segmentHiringPlan.find(p => p.quarter === q);
      let aes = 0, ses = 0;
      for (const tier of TIERS) {
        aes += plan?.bySegment?.[tier]?.aes || 0;
        ses += plan?.bySegment?.[tier]?.ses || 0;
      }
      return { quarter: q, aesToHire: aes, sesToHire: ses };
    });

    roster.updatedAt = new Date();
    await roster.save();

    res.json({ success: true, segmentHiringPlan: roster.segmentHiringPlan });
  } catch (error) {
    console.error('Error updating hiring plan:', error);
    res.status(500).json({ error: 'Failed to update hiring plan', details: error.message });
  }
});

/**
 * POST /api/tam/roster/members
 * Add a new team member
 */
router.post('/roster/members', async (req, res) => {
  try {
    const { name, role, assignedTier, startDate, notes } = req.body;

    if (!name || !role) {
      return res.status(400).json({ error: 'name and role are required' });
    }

    const roster = await TeamRoster.getGlobalRoster();

    roster.members.push({
      name,
      role,
      assignedTier: assignedTier || null,
      startDate: startDate ? new Date(startDate) : new Date(),
      notes: notes || '',
      isActive: true,
      isPlannedHire: false,
      accountAssignments: []
    });

    roster.updatedAt = new Date();
    await roster.save();

    res.json({ success: true, member: roster.members[roster.members.length - 1] });
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ error: 'Failed to add member', details: error.message });
  }
});

/**
 * PUT /api/tam/roster/members/:memberId
 * Update a team member
 */
router.put('/roster/members/:memberId', async (req, res) => {
  try {
    const { memberId } = req.params;
    const { name, role, assignedTier, startDate, notes, isActive } = req.body;

    const roster = await TeamRoster.getGlobalRoster();
    const member = roster.members.id(memberId);

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (name !== undefined) member.name = name;
    if (role !== undefined) member.role = role;
    if (assignedTier !== undefined) member.assignedTier = assignedTier;
    if (startDate !== undefined) member.startDate = new Date(startDate);
    if (notes !== undefined) member.notes = notes;
    if (isActive !== undefined) member.isActive = isActive;

    roster.updatedAt = new Date();
    await roster.save();

    res.json({ success: true, member });
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({ error: 'Failed to update member', details: error.message });
  }
});

/**
 * DELETE /api/tam/roster/members/:memberId
 * Remove a team member
 */
router.delete('/roster/members/:memberId', async (req, res) => {
  try {
    const { memberId } = req.params;

    const roster = await TeamRoster.getGlobalRoster();
    const member = roster.members.id(memberId);

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    member.deleteOne();
    roster.updatedAt = new Date();
    await roster.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting member:', error);
    res.status(500).json({ error: 'Failed to delete member', details: error.message });
  }
});

/**
 * GET /api/tam/roster/members/:memberId/assignments
 * Get account assignments for a team member
 */
router.get('/roster/members/:memberId/assignments', async (req, res) => {
  try {
    const { memberId } = req.params;

    const roster = await TeamRoster.getGlobalRoster();
    const result = roster.getMemberAssignments(memberId);

    if (!result) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Get available banks for assignment (from team sizing)
    const teamSizing = await tamCalculationService.calculateTeamSizing({});
    const availableBanks = teamSizing.coveredBanks?.map(b => ({
      idrssd: b.idrssd,
      bankName: b.bankName,
      tier: b.tier,
      tam: b.tam,
      totalAssets: b.totalAssets
    })) || [];

    res.json({
      ...result,
      availableBanks
    });
  } catch (error) {
    console.error('Error fetching member assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments', details: error.message });
  }
});

/**
 * PUT /api/tam/roster/members/:memberId/assignments
 * Update account assignments for a team member
 */
router.put('/roster/members/:memberId/assignments', async (req, res) => {
  try {
    const { memberId } = req.params;
    const { assignments } = req.body;

    if (!assignments) {
      return res.status(400).json({ error: 'assignments array is required' });
    }

    const roster = await TeamRoster.getGlobalRoster();
    const member = await roster.assignMemberToAccounts(memberId, assignments);

    res.json({ success: true, member });
  } catch (error) {
    console.error('Error updating member assignments:', error);
    res.status(500).json({ error: 'Failed to update assignments', details: error.message });
  }
});

/**
 * GET /api/tam/roster/auto-assignments
 * Calculate auto-assignment of team capacity to accounts
 * This shows which accounts each person (or planned hire) would cover
 */
router.get('/roster/auto-assignments', async (req, res) => {
  try {
    const { quarter = '2028-Q4' } = req.query;

    const roster = await TeamRoster.getGlobalRoster();
    const teamSizing = await tamCalculationService.calculateTeamSizing({});

    // Get banks sorted by TAM within each segment
    const banksBySegment = {};
    for (const tier of TIERS) {
      banksBySegment[tier] = (teamSizing.coveredBanks || [])
        .filter(b => b.tier === tier)
        .sort((a, b) => b.tam - a.tam);
    }

    // Get headcount as of the target quarter
    const headcount = roster.getHeadcountAsOfQuarter(quarter);
    const accountsPerAE = roster.assumptions.accountsPerAE || {
      Mega: 1, Strategic: 2, Enterprise: 5, Commercial: 10, SmallBusiness: 25
    };

    // Build assignment plan
    const assignmentPlan = {};
    for (const tier of TIERS) {
      const tierBanks = banksBySegment[tier];
      const tierAEs = headcount.bySegment[tier]?.aes || 0;
      const accountCapacity = accountsPerAE[tier] || 5;

      // Calculate how many accounts each AE can cover
      const totalCoverable = tierAEs * accountCapacity;
      const coveredBanks = tierBanks.slice(0, totalCoverable);
      const uncoveredBanks = tierBanks.slice(totalCoverable);

      // Distribute banks among AEs
      const aeAssignments = [];
      let bankIdx = 0;
      for (let aeNum = 0; aeNum < tierAEs; aeNum++) {
        const assignedBanks = [];
        for (let i = 0; i < accountCapacity && bankIdx < tierBanks.length; i++) {
          assignedBanks.push({
            idrssd: tierBanks[bankIdx].idrssd,
            bankName: tierBanks[bankIdx].bankName,
            tam: tierBanks[bankIdx].tam
          });
          bankIdx++;
        }
        aeAssignments.push({
          aeNumber: aeNum + 1,
          isExistingMember: aeNum < (headcount.bySegment[tier]?.aes || 0) - (roster.getHiresBySegmentForQuarter(quarter)[tier]?.aes || 0),
          assignedBanks,
          totalTAM: assignedBanks.reduce((sum, b) => sum + b.tam, 0)
        });
      }

      assignmentPlan[tier] = {
        totalAEs: tierAEs,
        accountsPerAE: accountCapacity,
        totalBanks: tierBanks.length,
        coveredBankCount: coveredBanks.length,
        uncoveredBankCount: uncoveredBanks.length,
        coveredTAM: coveredBanks.reduce((sum, b) => sum + b.tam, 0),
        uncoveredTAM: uncoveredBanks.reduce((sum, b) => sum + b.tam, 0),
        aeAssignments,
        uncoveredBanks: uncoveredBanks.map(b => ({
          idrssd: b.idrssd,
          bankName: b.bankName,
          tam: b.tam
        }))
      };
    }

    res.json({
      quarter,
      headcount,
      accountsPerAE,
      assignmentPlan
    });
  } catch (error) {
    console.error('Error calculating auto-assignments:', error);
    res.status(500).json({ error: 'Failed to calculate auto-assignments', details: error.message });
  }
});

/**
 * PUT /api/tam/roster/assumptions
 * Update roster assumptions (accounts per AE, reactive capture rate, etc.)
 */
router.put('/roster/assumptions', async (req, res) => {
  try {
    const { accountsPerAE, reactiveCaptureRate } = req.body;

    const roster = await TeamRoster.getGlobalRoster();

    if (accountsPerAE) {
      for (const tier of TIERS) {
        if (accountsPerAE[tier] !== undefined) {
          roster.assumptions.accountsPerAE[tier] = accountsPerAE[tier];
        }
      }
    }

    if (reactiveCaptureRate !== undefined) {
      roster.assumptions.reactiveCaptureRate = reactiveCaptureRate;
    }

    roster.updatedAt = new Date();
    await roster.save();

    res.json({ success: true, assumptions: roster.assumptions });
  } catch (error) {
    console.error('Error updating roster assumptions:', error);
    res.status(500).json({ error: 'Failed to update assumptions', details: error.message });
  }
});

// Fun placeholder names for new hires - plays on words about being new/fresh/green
const PLACEHOLDER_NAMES_AE = [
  // "New" themed
  'New Nick', 'Newbie Nate', 'Fresh Fred', 'Rookie Ricky', 'Greenhorn Gary',
  'Novice Nancy', 'Trainee Tracy', 'Junior Jenny', 'Starter Steve', 'Learner Larry',
  // "Green" themed
  'Green Greg', 'Verdant Vince', 'Sprout Sam', 'Seedling Sarah', 'Bud Bobby',
  // Onboarding themed
  'Onboard Oscar', 'Ramping Rachel', 'Bootcamp Ben', 'Shadowing Shelly', 'Observing Ollie',
  // Growth themed
  'Budding Brad', 'Blooming Blake', 'Emerging Emma', 'Rising Ronda', 'Ascending Alex',
  // Time themed
  'Day One Dana', 'Week One Wes', 'Month One Mike', 'Quarter One Quinn', 'First Fiona'
];

const PLACEHOLDER_NAMES_SE = [
  // "New" themed
  'New Neil', 'Newbie Norm', 'Fresh Frankie', 'Rookie Rena', 'Greenhorn Gina',
  'Novice Ned', 'Trainee Tina', 'Junior Jack', 'Starter Sally', 'Learner Liz',
  // "Green" themed
  'Green Gloria', 'Verdant Val', 'Sprout Spencer', 'Seedling Sophia', 'Bud Bella',
  // Onboarding themed
  'Onboard Olivia', 'Ramping Ryan', 'Bootcamp Brooke', 'Shadowing Shane', 'Observing Owen',
  // Growth themed
  'Budding Brianna', 'Blooming Boris', 'Emerging Ethan', 'Rising Rosa', 'Ascending Aaron',
  // Time themed
  'Day One Derek', 'Week One Wendy', 'Month One Maya', 'Quarter One Quincy', 'First Felix'
];

/**
 * POST /api/tam/roster/generate-placeholders
 * Generate placeholder team members from the hiring plan
 * Creates fun placeholder names that can be renamed when actual hires are made
 */
router.post('/roster/generate-placeholders', async (req, res) => {
  try {
    const roster = await TeamRoster.getGlobalRoster();

    // Track used names to avoid duplicates
    const usedNames = new Set(roster.members.map(m => m.name));

    // Get available placeholder names
    const getNextPlaceholderName = (role) => {
      const names = role === 'AE' ? PLACEHOLDER_NAMES_AE : PLACEHOLDER_NAMES_SE;
      for (const name of names) {
        if (!usedNames.has(name)) {
          usedNames.add(name);
          return name;
        }
      }
      // If all names used, generate a numbered one
      let i = 1;
      while (usedNames.has(`${role} Hire #${i}`)) i++;
      const name = `${role} Hire #${i}`;
      usedNames.add(name);
      return name;
    };

    // Remove existing placeholder members that haven't been hired
    roster.members = roster.members.filter(m => !m.isPlaceholder || m.isHired);

    // Generate members from hiring plan
    const newMembers = [];
    for (const plan of roster.segmentHiringPlan || []) {
      const quarter = plan.quarter;
      // Parse quarter to get start date (first day of quarter)
      const [year, q] = quarter.split('-');
      const quarterMonth = (parseInt(q.replace('Q', '')) - 1) * 3; // Q1=0, Q2=3, Q3=6, Q4=9
      const startDate = new Date(parseInt(year), quarterMonth, 1);

      for (const tier of TIERS) {
        const hires = plan.bySegment?.[tier] || { aes: 0, ses: 0 };

        // Create AE placeholders
        for (let i = 0; i < hires.aes; i++) {
          const name = getNextPlaceholderName('AE');
          newMembers.push({
            name,
            role: 'AE',
            assignedTier: tier,
            startDate,
            plannedStartQuarter: quarter,
            isActive: true,
            isPlannedHire: true,
            isHired: false,
            isPlaceholder: true,
            placeholderName: name,
            notes: `Planned ${tier} AE hire for ${quarter}`
          });
        }

        // Create SE placeholders
        for (let i = 0; i < hires.ses; i++) {
          const name = getNextPlaceholderName('SE');
          newMembers.push({
            name,
            role: 'SE',
            assignedTier: tier,
            startDate,
            plannedStartQuarter: quarter,
            isActive: true,
            isPlannedHire: true,
            isHired: false,
            isPlaceholder: true,
            placeholderName: name,
            notes: `Planned ${tier} SE hire for ${quarter}`
          });
        }
      }
    }

    // Add new placeholders to roster
    roster.members.push(...newMembers);
    roster.updatedAt = new Date();
    await roster.save();

    res.json({
      success: true,
      generated: newMembers.length,
      members: roster.members
    });
  } catch (error) {
    console.error('Error generating placeholders:', error);
    res.status(500).json({ error: 'Failed to generate placeholders', details: error.message });
  }
});

/**
 * PUT /api/tam/roster/members/:memberId/hire
 * Mark a placeholder member as hired and optionally update their details
 */
router.put('/roster/members/:memberId/hire', async (req, res) => {
  try {
    const { memberId } = req.params;
    const { name, startDate, notes } = req.body;

    const roster = await TeamRoster.getGlobalRoster();
    const member = roster.members.id(memberId);

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Mark as hired
    member.isHired = true;
    member.isPlannedHire = false;

    // Update details if provided
    if (name !== undefined) member.name = name;
    if (startDate !== undefined) member.startDate = new Date(startDate);
    if (notes !== undefined) member.notes = notes;

    roster.updatedAt = new Date();
    await roster.save();

    res.json({ success: true, member });
  } catch (error) {
    console.error('Error marking member as hired:', error);
    res.status(500).json({ error: 'Failed to update member', details: error.message });
  }
});

module.exports = router;
