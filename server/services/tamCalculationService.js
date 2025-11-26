/**
 * TAM Calculation Service
 *
 * Calculates Total Addressable Market for banks based on:
 * 1. Claude Code: Developer seats ($150/month × 15% of FTE)
 * 2. Claude Enterprise: All employee seats ($35/month × FTE)
 * 3. Agents Run Business: 5 agents per employee × $1,000/month
 * 4. Agents Grow Business: 30% of net income × 20% Anthropic share
 *
 * Per-Product Penetration:
 * Each product has its own penetration schedule over 12 quarters
 */

const FinancialStatement = require('../models/FinancialStatement');
const TAMAssumptions = require('../models/TAMAssumptions');
const Institution = require('../models/Institution');
const TeamRoster = require('../models/TeamRoster');

const QUARTERS = [
  '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4',
  '2027-Q1', '2027-Q2', '2027-Q3', '2027-Q4',
  '2028-Q1', '2028-Q2', '2028-Q3', '2028-Q4'
];

class TAMCalculationService {
  /**
   * Calculate TAM for a single bank
   */
  async calculateBankTAM(idrssd, options = {}) {
    const { period } = options;

    // Get latest financial statement
    const query = { idrssd };
    if (period) {
      query.reportingPeriod = new Date(period);
    }

    const statement = await FinancialStatement.findOne(query)
      .sort({ reportingPeriod: -1 })
      .lean();

    if (!statement) {
      throw new Error(`No financial statement found for bank ${idrssd}`);
    }

    // Get assumptions (merged global + bank-specific)
    const assumptions = await TAMAssumptions.getForBank(idrssd);

    // Get global assumptions for segment penetration rates
    const globalAssumptions = await TAMAssumptions.getGlobalDefaults();

    // Get bank info
    const institution = await Institution.findOne({ idrssd }).lean();

    // Extract values from assumptions
    const a = this.extractAssumptionValues(assumptions.assumptions);
    const c = this.extractCoverageValues(assumptions.coverage);

    // Get financial data
    const fte = statement.incomeStatement?.fullTimeEquivalentEmployees || 0;
    const interestIncome = statement.incomeStatement?.interestIncome?.total || 0;
    const noninterestIncome = statement.incomeStatement?.noninterestIncome?.total || 0;
    const totalRevenue = interestIncome + noninterestIncome;
    // Net income is stored in thousands in the data
    const netIncome = statement.incomeStatement?.netIncome || 0;
    const totalAssets = statement.balanceSheet?.assets?.totalAssets || 0;

    // Determine bank's tier based on assets
    const tier = this.getTier(totalAssets);

    // Get segment-specific penetration rates (or bank-specific override if exists)
    // Priority: bank-specific override > segment-based > legacy global
    const pp = assumptions.penetrationByProduct && !assumptions.isGlobalOnly
      ? this.extractProductPenetration(assumptions.penetrationByProduct)  // Bank-specific override
      : this.extractSegmentPenetration(globalAssumptions.penetrationBySegment, tier);  // Segment-based

    // Get most recent Q4 (December) for full-year income statement data
    const q4Statement = await FinancialStatement.findOne({
      idrssd,
      $expr: { $eq: [{ $month: '$reportingPeriod' }, 12] }  // December = month 12
    })
      .sort({ reportingPeriod: -1 })
      .select('reportingPeriod incomeStatement')
      .lean();

    // Calculate annual TAM by revenue source
    // Note: Financial data from DB is in thousands, multiply by 1000 for actual dollars
    const claudeCodeTAM = a.claudeCode.pricePerMonth * (fte * a.claudeCode.fteEligibilityRate) * 12;
    const enterpriseTAM = a.claudeEnterprise.pricePerMonth * (fte * a.claudeEnterprise.adoptionRate) * 12;
    const agentsRunTAM = a.agentsRunBusiness.agentsPerEmployee * fte * a.agentsRunBusiness.pricePerAgentMonth * 12;
    // Use full-year revenue from Q4 (cumulative) for Agents Grow Business
    // Q4 income statement data is already full-year (no need to annualize)
    const annualRevenue = this.getAnnualRevenue(q4Statement, totalRevenue);
    const agentsGrowTAM = annualRevenue * a.agentsGrowBusiness.revenueFromAgents * a.agentsGrowBusiness.anthropicShare;

    const totalTAM = claudeCodeTAM + enterpriseTAM + agentsRunTAM + agentsGrowTAM;

    // Calculate quarterly revenue by product using segment-specific penetration
    const quarterlyRevenue = this.calculateQuarterlyRevenue(
      { claudeCode: claudeCodeTAM, claudeEnterprise: enterpriseTAM, agentsRunBusiness: agentsRunTAM, agentsGrowBusiness: agentsGrowTAM },
      pp
    );

    // Calculate 3-year achievable based on segment-specific penetration
    const threeYearAchievable = this.calculateThreeYearAchievable(
      { claudeCode: claudeCodeTAM, claudeEnterprise: enterpriseTAM, agentsRunBusiness: agentsRunTAM, agentsGrowBusiness: agentsGrowTAM },
      pp
    );

    // Calculate account coverage (using asset-based tiers)
    const coverageAnalysis = this.calculateCoverage(totalTAM, totalAssets);

    // Operating expense is in thousands in the database
    const annualOpEx = q4Statement?.incomeStatement?.noninterestExpense?.total || 0;
    const annualOpExDollars = annualOpEx * 1000;  // Convert to actual dollars
    const salariesAndBenefits = (q4Statement?.incomeStatement?.noninterestExpense?.salariesAndBenefits || 0) * 1000;
    const premisesExpense = (q4Statement?.incomeStatement?.noninterestExpense?.premisesExpense || 0) * 1000;
    const otherExpense = (q4Statement?.incomeStatement?.noninterestExpense?.other || 0) * 1000;

    // Calculate TAM as % of annual operating expense
    // Use total TAM (100% penetration) vs annual OpEx to see if wall-to-wall is realistic
    const tamAsOpExPct = annualOpExDollars > 0 ? totalTAM / annualOpExDollars : null;

    return {
      idrssd,
      bankName: institution?.name || statement.bankName || 'Unknown',
      period: statement.reportingPeriod,
      totalAssets,
      tier,

      // Input data (values in thousands from source data, except annualRevenue which is in actual dollars)
      inputs: {
        fte,
        totalRevenue,  // Current quarter revenue (in thousands)
        interestIncome,
        noninterestIncome,
        netIncome,
        annualRevenue: annualRevenue,  // Full-year revenue from Q4 (actual dollars)
        annualRevenueSource: q4Statement ? 'Q4 ' + new Date(q4Statement.reportingPeriod).getFullYear() : 'Annualized'
      },

      // TAM by revenue source (annual)
      tam: {
        claudeCode: Math.round(claudeCodeTAM),
        claudeEnterprise: Math.round(enterpriseTAM),
        agentsRunBusiness: Math.round(agentsRunTAM),
        agentsGrowBusiness: Math.round(agentsGrowTAM),
        total: Math.round(totalTAM)
      },

      // TAM breakdown percentages
      tamBreakdown: {
        claudeCode: totalTAM > 0 ? claudeCodeTAM / totalTAM : 0,
        claudeEnterprise: totalTAM > 0 ? enterpriseTAM / totalTAM : 0,
        agentsRunBusiness: totalTAM > 0 ? agentsRunTAM / totalTAM : 0,
        agentsGrowBusiness: totalTAM > 0 ? agentsGrowTAM / totalTAM : 0
      },

      // Per-product penetration targets
      penetrationByProduct: pp,

      // Quarterly revenue by product
      quarterlyRevenue,

      // 3-year achievable
      threeYearAchievable: Math.round(threeYearAchievable),

      // Coverage analysis
      coverage: coverageAnalysis,

      // Operating expense sanity check
      operatingExpense: {
        q4Period: q4Statement?.reportingPeriod || null,
        annualTotal: annualOpExDollars,
        breakdown: {
          salariesAndBenefits,
          premisesExpense,
          other: otherExpense
        },
        totalTAM: Math.round(totalTAM),
        tamAsOpExPct,
        // Year-end RRR values (Q4 of each year, annualized) and as % of OpEx
        rrr: {
          rrr2026: (quarterlyRevenue['2026-Q4']?.claudeCode?.revenue || 0) * 4 +
                   (quarterlyRevenue['2026-Q4']?.claudeEnterprise?.revenue || 0) * 4 +
                   (quarterlyRevenue['2026-Q4']?.agentsRunBusiness?.revenue || 0) * 4 +
                   (quarterlyRevenue['2026-Q4']?.agentsGrowBusiness?.revenue || 0) * 4,
          rrr2027: (quarterlyRevenue['2027-Q4']?.claudeCode?.revenue || 0) * 4 +
                   (quarterlyRevenue['2027-Q4']?.claudeEnterprise?.revenue || 0) * 4 +
                   (quarterlyRevenue['2027-Q4']?.agentsRunBusiness?.revenue || 0) * 4 +
                   (quarterlyRevenue['2027-Q4']?.agentsGrowBusiness?.revenue || 0) * 4,
          rrr2028: (quarterlyRevenue['2028-Q4']?.claudeCode?.revenue || 0) * 4 +
                   (quarterlyRevenue['2028-Q4']?.claudeEnterprise?.revenue || 0) * 4 +
                   (quarterlyRevenue['2028-Q4']?.agentsRunBusiness?.revenue || 0) * 4 +
                   (quarterlyRevenue['2028-Q4']?.agentsGrowBusiness?.revenue || 0) * 4,
          rrr2026AsOpExPct: annualOpExDollars > 0 ? ((quarterlyRevenue['2026-Q4']?.claudeCode?.revenue || 0) * 4 +
                   (quarterlyRevenue['2026-Q4']?.claudeEnterprise?.revenue || 0) * 4 +
                   (quarterlyRevenue['2026-Q4']?.agentsRunBusiness?.revenue || 0) * 4 +
                   (quarterlyRevenue['2026-Q4']?.agentsGrowBusiness?.revenue || 0) * 4) / annualOpExDollars : null,
          rrr2027AsOpExPct: annualOpExDollars > 0 ? ((quarterlyRevenue['2027-Q4']?.claudeCode?.revenue || 0) * 4 +
                   (quarterlyRevenue['2027-Q4']?.claudeEnterprise?.revenue || 0) * 4 +
                   (quarterlyRevenue['2027-Q4']?.agentsRunBusiness?.revenue || 0) * 4 +
                   (quarterlyRevenue['2027-Q4']?.agentsGrowBusiness?.revenue || 0) * 4) / annualOpExDollars : null,
          rrr2028AsOpExPct: annualOpExDollars > 0 ? ((quarterlyRevenue['2028-Q4']?.claudeCode?.revenue || 0) * 4 +
                   (quarterlyRevenue['2028-Q4']?.claudeEnterprise?.revenue || 0) * 4 +
                   (quarterlyRevenue['2028-Q4']?.agentsRunBusiness?.revenue || 0) * 4 +
                   (quarterlyRevenue['2028-Q4']?.agentsGrowBusiness?.revenue || 0) * 4) / annualOpExDollars : null
        }
      },

      // Assumptions used (with sources)
      assumptions: assumptions.assumptions,
      isGlobalOnly: assumptions.isGlobalOnly
    };
  }

  /**
   * Calculate TAM for all banks (dashboard summary)
   */
  async calculateAllBanksTAM(options = {}) {
    const { limit = 100, minAssets = 0, sortBy = 'tam', sortOrder = 'desc' } = options;

    // Get latest period
    const latestPeriod = await FinancialStatement.findOne()
      .sort({ reportingPeriod: -1 })
      .select('reportingPeriod')
      .lean();

    if (!latestPeriod) {
      return { banks: [], aggregate: {}, period: null };
    }

    // Find the most recent Q4 period (December) for annual operating expense
    const q4Period = await FinancialStatement.findOne({
      reportingPeriod: {
        $gte: new Date('2020-01-01'),  // Reasonable start date
        $lte: new Date()
      }
    })
      .sort({ reportingPeriod: -1 })
      .select('reportingPeriod')
      .lean()
      .then(async (latest) => {
        // Find the most recent December period
        const decPeriod = await FinancialStatement.findOne({
          $expr: { $eq: [{ $month: '$reportingPeriod' }, 12] }  // December = month 12
        })
          .sort({ reportingPeriod: -1 })
          .select('reportingPeriod')
          .lean();
        return decPeriod?.reportingPeriod || null;
      });

    // Build maps of Q4 data (operating expenses with breakdown and revenue) by idrssd
    let q4OpExMap = new Map();
    let q4RevenueMap = new Map();
    if (q4Period) {
      const q4Statements = await FinancialStatement.find({
        reportingPeriod: q4Period
      })
        .select('idrssd incomeStatement.noninterestExpense incomeStatement.interestIncome.total incomeStatement.noninterestIncome.total')
        .lean();

      for (const stmt of q4Statements) {
        const opExData = stmt.incomeStatement?.noninterestExpense || {};
        q4OpExMap.set(stmt.idrssd, {
          total: opExData.total || 0,
          salariesAndBenefits: opExData.salariesAndBenefits || 0,
          premisesExpense: opExData.premisesExpense || 0,
          other: opExData.other || 0
        });

        // Q4 revenue is full-year (cumulative)
        const q4Revenue = (stmt.incomeStatement?.interestIncome?.total || 0) +
                         (stmt.incomeStatement?.noninterestIncome?.total || 0);
        q4RevenueMap.set(stmt.idrssd, q4Revenue);
      }
    }

    // Get all banks for latest period with minimum assets
    const statements = await FinancialStatement.find({
      reportingPeriod: latestPeriod.reportingPeriod,
      'balanceSheet.assets.totalAssets': { $gte: minAssets }
    })
      .select('idrssd balanceSheet.assets.totalAssets incomeStatement.fullTimeEquivalentEmployees incomeStatement.interestIncome.total incomeStatement.noninterestIncome.total incomeStatement.netIncome incomeStatement.noninterestExpense.total')
      .lean();

    // Build a map of bank names from Institution collection
    const allIdrssds = statements.map(s => s.idrssd);
    const institutions = await Institution.find({ idrssd: { $in: allIdrssds } })
      .select('idrssd name')
      .lean();
    const bankNameMap = new Map(institutions.map(i => [i.idrssd, i.name]));

    // Get global assumptions
    const globalAssumptions = await TAMAssumptions.getGlobalDefaults();
    const a = this.extractAssumptionValues(globalAssumptions.assumptions);
    const c = this.extractCoverageValues(globalAssumptions.coverage);
    // Extract all segment penetration data for efficient lookup
    const segmentPenetration = this.extractAllSegmentPenetration(globalAssumptions.penetrationBySegment);

    // Calculate TAM for each bank
    const banks = await Promise.all(statements.map(async (stmt) => {
      // Check for bank-specific overrides
      const bankAssumptions = await TAMAssumptions.findOne({ idrssd: stmt.idrssd }).lean();
      const effectiveA = bankAssumptions
        ? this.extractAssumptionValues(this.mergeWithGlobal(globalAssumptions.assumptions, bankAssumptions.assumptions))
        : a;

      const fte = stmt.incomeStatement?.fullTimeEquivalentEmployees || 0;
      const totalRevenue = (stmt.incomeStatement?.interestIncome?.total || 0) +
                          (stmt.incomeStatement?.noninterestIncome?.total || 0);
      // Net income is in thousands from source data
      const netIncome = stmt.incomeStatement?.netIncome || 0;
      const totalAssets = stmt.balanceSheet?.assets?.totalAssets || 0;

      // Determine bank's tier for segment-specific penetration
      const tier = this.getTier(totalAssets);

      // Get penetration: bank-specific override > segment-based
      const pp = bankAssumptions?.penetrationByProduct
        ? this.extractProductPenetration(bankAssumptions.penetrationByProduct)
        : segmentPenetration[tier];

      // Calculate TAM components
      const claudeCodeTAM = effectiveA.claudeCode.pricePerMonth * (fte * effectiveA.claudeCode.fteEligibilityRate) * 12;
      const enterpriseTAM = effectiveA.claudeEnterprise.pricePerMonth * (fte * effectiveA.claudeEnterprise.adoptionRate) * 12;
      const agentsRunTAM = effectiveA.agentsRunBusiness.agentsPerEmployee * fte * effectiveA.agentsRunBusiness.pricePerAgentMonth * 12;
      // Use full-year revenue from Q4 (cumulative) for Agents Grow Business
      // Q4 income statement data is already full-year (no need to annualize)
      const q4Revenue = q4RevenueMap.get(stmt.idrssd);
      const annualRevenue = q4Revenue ? (q4Revenue * 1000) : (totalRevenue * 1000 * 4);  // Fallback to annualized if no Q4
      const agentsGrowTAM = annualRevenue * effectiveA.agentsGrowBusiness.revenueFromAgents * effectiveA.agentsGrowBusiness.anthropicShare;
      const totalTAM = claudeCodeTAM + enterpriseTAM + agentsRunTAM + agentsGrowTAM;

      const threeYearAchievable = this.calculateThreeYearAchievable(
        { claudeCode: claudeCodeTAM, claudeEnterprise: enterpriseTAM, agentsRunBusiness: agentsRunTAM, agentsGrowBusiness: agentsGrowTAM },
        pp
      );
      const coverageAnalysis = this.calculateCoverage(totalTAM, totalAssets);

      // Get annual operating expense from Q4 data (YTD = full year for Q4)
      // Operating expense is in thousands in the database
      const opExData = q4OpExMap.get(stmt.idrssd) || { total: 0, salariesAndBenefits: 0, premisesExpense: 0, other: 0 };
      const annualOpExDollars = opExData.total * 1000;  // Convert to actual dollars
      const opExBreakdown = {
        salariesAndBenefits: opExData.salariesAndBenefits * 1000,
        premisesExpense: opExData.premisesExpense * 1000,
        other: opExData.other * 1000
      };

      // Calculate TAM as % of annual operating expense
      // Use total TAM (100% penetration) vs annual OpEx to see if wall-to-wall is realistic
      const tamAsOpExPct = annualOpExDollars > 0
        ? totalTAM / annualOpExDollars
        : null;

      return {
        idrssd: stmt.idrssd,
        bankName: bankNameMap.get(stmt.idrssd) || `Bank ${stmt.idrssd}`,
        totalAssets,
        fte,
        totalRevenue,
        netIncome,
        tier,
        tam: {
          claudeCode: Math.round(claudeCodeTAM),
          claudeEnterprise: Math.round(enterpriseTAM),
          agentsRunBusiness: Math.round(agentsRunTAM),
          agentsGrowBusiness: Math.round(agentsGrowTAM),
          total: Math.round(totalTAM)
        },
        threeYearAchievable: Math.round(threeYearAchievable),
        coverage: coverageAnalysis,
        hasOverrides: !!bankAssumptions,
        // Operating expense sanity check with breakdown
        annualOpEx: annualOpExDollars,
        opExBreakdown,
        tamAsOpExPct
      };
    }));

    // Sort banks
    const sortMultiplier = sortOrder === 'desc' ? -1 : 1;
    banks.sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case 'tam':
          valA = a.tam.total;
          valB = b.tam.total;
          break;
        case 'assets':
          valA = a.totalAssets;
          valB = b.totalAssets;
          break;
        case 'fte':
          valA = a.fte;
          valB = b.fte;
          break;
        case 'threeYear':
          valA = a.threeYearAchievable;
          valB = b.threeYearAchievable;
          break;
        default:
          valA = a.tam.total;
          valB = b.tam.total;
      }
      return (valA - valB) * sortMultiplier;
    });

    // Calculate aggregate totals
    const aggregate = {
      totalTAM: banks.reduce((sum, b) => sum + b.tam.total, 0),
      totalThreeYearAchievable: banks.reduce((sum, b) => sum + b.threeYearAchievable, 0),
      totalFTE: banks.reduce((sum, b) => sum + b.fte, 0),
      totalNetIncome: banks.reduce((sum, b) => sum + (b.netIncome || 0), 0),
      bankCount: banks.length,
      bySource: {
        claudeCode: banks.reduce((sum, b) => sum + b.tam.claudeCode, 0),
        claudeEnterprise: banks.reduce((sum, b) => sum + b.tam.claudeEnterprise, 0),
        agentsRunBusiness: banks.reduce((sum, b) => sum + b.tam.agentsRunBusiness, 0),
        agentsGrowBusiness: banks.reduce((sum, b) => sum + b.tam.agentsGrowBusiness, 0)
      },
      coverage: {
        totalRepsNeeded: banks.reduce((sum, b) => sum + b.coverage.repsNeeded, 0),
        dedicatedAccounts: banks.filter(b => b.coverage.needsDedicatedRep).length,
        pooledAccounts: banks.filter(b => !b.coverage.needsDedicatedRep).length
      }
    };

    return {
      banks: banks.slice(0, limit),
      aggregate,
      period: latestPeriod.reportingPeriod,
      q4Period: q4Period,  // Q4 period used for operating expense
      totalBanks: banks.length
    };
  }

  /**
   * Calculate quarterly revenue by product based on penetration rates
   */
  calculateQuarterlyRevenue(annualTAM, penetrationByProduct) {
    const result = {};

    for (const quarter of QUARTERS) {
      const ccPen = penetrationByProduct.claudeCode?.[quarter]?.target || 0;
      const cePen = penetrationByProduct.claudeEnterprise?.[quarter]?.target || 0;
      const arPen = penetrationByProduct.agentsRunBusiness?.[quarter]?.target || 0;
      const agPen = penetrationByProduct.agentsGrowBusiness?.[quarter]?.target || 0;

      // Quarterly revenue = Annual TAM / 4 * penetration rate
      const ccRev = (annualTAM.claudeCode / 4) * ccPen;
      const ceRev = (annualTAM.claudeEnterprise / 4) * cePen;
      const arRev = (annualTAM.agentsRunBusiness / 4) * arPen;
      const agRev = (annualTAM.agentsGrowBusiness / 4) * agPen;

      result[quarter] = {
        claudeCode: { revenue: Math.round(ccRev), penetration: ccPen },
        claudeEnterprise: { revenue: Math.round(ceRev), penetration: cePen },
        agentsRunBusiness: { revenue: Math.round(arRev), penetration: arPen },
        agentsGrowBusiness: { revenue: Math.round(agRev), penetration: agPen },
        total: Math.round(ccRev + ceRev + arRev + agRev),
        blendedPenetration: annualTAM.claudeCode + annualTAM.claudeEnterprise + annualTAM.agentsRunBusiness + annualTAM.agentsGrowBusiness > 0
          ? (ccRev + ceRev + arRev + agRev) / ((annualTAM.claudeCode + annualTAM.claudeEnterprise + annualTAM.agentsRunBusiness + annualTAM.agentsGrowBusiness) / 4)
          : 0
      };
    }

    return result;
  }

  /**
   * Calculate quarterly revenue aggregated across segments using segment-specific penetration
   */
  calculateSegmentAggregatedQuarterlyRevenue(banksByTier, segmentPenetration) {
    const result = {};
    const segments = ['Mega', 'Strategic', 'Enterprise', 'Commercial', 'SmallBusiness'];
    const products = ['claudeCode', 'claudeEnterprise', 'agentsRunBusiness', 'agentsGrowBusiness'];

    // Initialize result for each quarter
    for (const quarter of QUARTERS) {
      result[quarter] = {
        claudeCode: 0,
        claudeEnterprise: 0,
        agentsRunBusiness: 0,
        agentsGrowBusiness: 0,
        total: 0,
        bySegment: {}
      };
    }

    // For each segment, calculate its contribution to quarterly revenue
    for (const segment of segments) {
      const segmentBanks = banksByTier[segment] || [];
      if (segmentBanks.length === 0) continue;

      // Get segment's TAM by product
      const segmentTAM = {
        claudeCode: segmentBanks.reduce((sum, b) => sum + (b.tam?.claudeCode || 0), 0),
        claudeEnterprise: segmentBanks.reduce((sum, b) => sum + (b.tam?.claudeEnterprise || 0), 0),
        agentsRunBusiness: segmentBanks.reduce((sum, b) => sum + (b.tam?.agentsRunBusiness || 0), 0),
        agentsGrowBusiness: segmentBanks.reduce((sum, b) => sum + (b.tam?.agentsGrowBusiness || 0), 0)
      };

      // Get segment's penetration rates
      const pp = segmentPenetration[segment];

      // Calculate quarterly contribution for this segment
      for (const quarter of QUARTERS) {
        const ccPen = pp?.claudeCode?.[quarter]?.target || 0;
        const cePen = pp?.claudeEnterprise?.[quarter]?.target || 0;
        const arPen = pp?.agentsRunBusiness?.[quarter]?.target || 0;
        const agPen = pp?.agentsGrowBusiness?.[quarter]?.target || 0;

        // Quarterly revenue = Annual TAM / 4 * penetration rate
        const ccRev = (segmentTAM.claudeCode / 4) * ccPen;
        const ceRev = (segmentTAM.claudeEnterprise / 4) * cePen;
        const arRev = (segmentTAM.agentsRunBusiness / 4) * arPen;
        const agRev = (segmentTAM.agentsGrowBusiness / 4) * agPen;
        const segmentTotal = ccRev + ceRev + arRev + agRev;

        // Add to quarter totals
        result[quarter].claudeCode += ccRev;
        result[quarter].claudeEnterprise += ceRev;
        result[quarter].agentsRunBusiness += arRev;
        result[quarter].agentsGrowBusiness += agRev;
        result[quarter].total += segmentTotal;

        // Store segment-level breakdown
        result[quarter].bySegment[segment] = {
          claudeCode: Math.round(ccRev),
          claudeEnterprise: Math.round(ceRev),
          agentsRunBusiness: Math.round(arRev),
          agentsGrowBusiness: Math.round(agRev),
          total: Math.round(segmentTotal)
        };
      }
    }

    // Round final totals
    for (const quarter of QUARTERS) {
      result[quarter].claudeCode = Math.round(result[quarter].claudeCode);
      result[quarter].claudeEnterprise = Math.round(result[quarter].claudeEnterprise);
      result[quarter].agentsRunBusiness = Math.round(result[quarter].agentsRunBusiness);
      result[quarter].agentsGrowBusiness = Math.round(result[quarter].agentsGrowBusiness);
      result[quarter].total = Math.round(result[quarter].total);
    }

    return result;
  }

  /**
   * Calculate 3-year achievable revenue based on per-product penetration
   */
  calculateThreeYearAchievable(annualTAM, penetrationByProduct) {
    let total = 0;

    for (const quarter of QUARTERS) {
      const ccPen = penetrationByProduct.claudeCode?.[quarter]?.target || 0;
      const cePen = penetrationByProduct.claudeEnterprise?.[quarter]?.target || 0;
      const arPen = penetrationByProduct.agentsRunBusiness?.[quarter]?.target || 0;
      const agPen = penetrationByProduct.agentsGrowBusiness?.[quarter]?.target || 0;

      // Quarterly contribution = Annual TAM / 4 * penetration rate
      total += (annualTAM.claudeCode / 4) * ccPen;
      total += (annualTAM.claudeEnterprise / 4) * cePen;
      total += (annualTAM.agentsRunBusiness / 4) * arPen;
      total += (annualTAM.agentsGrowBusiness / 4) * agPen;
    }

    return total;
  }

  /**
   * Calculate account coverage requirements (using asset-based tiers)
   */
  calculateCoverage(totalTAM, totalAssets, teamSizingConfig = null) {
    const tier = this.getTier(totalAssets, teamSizingConfig);

    // Determine coverage based on asset tier
    const tierCoverage = {
      'Mega': { dedicated: true, minReps: 2 },
      'Strategic': { dedicated: true, minReps: 1 },
      'Enterprise': { dedicated: true, minReps: 1 },
      'Commercial': { dedicated: false, minReps: 0.5 },
      'SmallBusiness': { dedicated: false, minReps: 0.1 }
    };

    const coverage = tierCoverage[tier] || tierCoverage['SmallBusiness'];

    return {
      needsDedicatedRep: coverage.dedicated,
      repsNeeded: coverage.minReps,
      tier,
      totalAssets,
      recommendation: coverage.dedicated
        ? `Dedicated coverage (${tier})`
        : `Pooled coverage (${tier})`
    };
  }

  /**
   * Get account tier based on total assets (asset-based tiers)
   * Note: totalAssets from database is in thousands, so multiply by 1000 for comparison
   */
  getTier(totalAssets, teamSizingConfig = null) {
    // totalAssets from database is in thousands, convert to actual dollars
    const actualAssets = totalAssets * 1000;

    // Use provided config or defaults (thresholds in actual dollars)
    const megaThreshold = teamSizingConfig?.megaTierThreshold || 1000000000000;       // $1T
    const strategicThreshold = teamSizingConfig?.strategicTierThreshold || 100000000000;  // $100B
    const enterpriseThreshold = teamSizingConfig?.enterpriseTierThreshold || 30000000000;  // $30B
    const commercialThreshold = teamSizingConfig?.commercialTierThreshold || 10000000000;  // $10B

    if (actualAssets >= megaThreshold) return 'Mega';
    if (actualAssets >= strategicThreshold) return 'Strategic';
    if (actualAssets >= enterpriseThreshold) return 'Enterprise';
    if (actualAssets >= commercialThreshold) return 'Commercial';
    return 'SmallBusiness';
  }

  /**
   * Get annual revenue from Q4 statement (full-year cumulative) or fall back to current quarter × 4
   * Income statement data is cumulative through the year, so Q4 = full year
   * @param {Object} q4Statement - Q4 (December) financial statement
   * @param {number} currentQuarterRevenue - Revenue from the current quarter (in thousands)
   * @returns {number} Annual revenue in actual dollars
   */
  getAnnualRevenue(q4Statement, currentQuarterRevenue) {
    if (q4Statement) {
      const q4InterestIncome = q4Statement.incomeStatement?.interestIncome?.total || 0;
      const q4NoninterestIncome = q4Statement.incomeStatement?.noninterestIncome?.total || 0;
      const fullYearRevenue = q4InterestIncome + q4NoninterestIncome;
      if (fullYearRevenue > 0) {
        return fullYearRevenue * 1000;  // Convert from thousands to actual dollars
      }
    }
    // Fallback: annualize current quarter if no Q4 data available
    return (currentQuarterRevenue * 1000) * 4;
  }

  /**
   * Extract assumption values from source-wrapped format
   */
  extractAssumptionValues(assumptions) {
    const getValue = (obj) => {
      if (obj && obj.value !== undefined) return obj.value;
      return obj;
    };

    return {
      claudeCode: {
        pricePerMonth: getValue(assumptions?.claudeCode?.pricePerMonth) || 150,
        fteEligibilityRate: getValue(assumptions?.claudeCode?.fteEligibilityRate) || 0.15
      },
      claudeEnterprise: {
        pricePerMonth: getValue(assumptions?.claudeEnterprise?.pricePerMonth) || 35,
        adoptionRate: getValue(assumptions?.claudeEnterprise?.adoptionRate) || 1.0
      },
      agentsRunBusiness: {
        agentsPerEmployee: getValue(assumptions?.agentsRunBusiness?.agentsPerEmployee) || 5,
        pricePerAgentMonth: getValue(assumptions?.agentsRunBusiness?.pricePerAgentMonth) || 1000
      },
      agentsGrowBusiness: {
        revenueFromAgents: getValue(assumptions?.agentsGrowBusiness?.revenueFromAgents) || 0.30,
        anthropicShare: getValue(assumptions?.agentsGrowBusiness?.anthropicShare) || 0.20
      }
    };
  }

  /**
   * Extract per-product penetration values
   */
  extractProductPenetration(penetrationByProduct) {
    const result = {
      claudeCode: {},
      claudeEnterprise: {},
      agentsRunBusiness: {},
      agentsGrowBusiness: {}
    };

    const products = ['claudeCode', 'claudeEnterprise', 'agentsRunBusiness', 'agentsGrowBusiness'];

    for (const product of products) {
      for (const q of QUARTERS) {
        result[product][q] = {
          target: penetrationByProduct?.[product]?.[q]?.target || 0,
          actual: penetrationByProduct?.[product]?.[q]?.actual || null,
          source: penetrationByProduct?.[product]?.[q]?.source || 'global'
        };
      }
    }

    return result;
  }

  /**
   * Extract segment-specific penetration rates for a given tier
   */
  extractSegmentPenetration(penetrationBySegment, tier) {
    const result = {
      claudeCode: {},
      claudeEnterprise: {},
      agentsRunBusiness: {},
      agentsGrowBusiness: {}
    };

    const products = ['claudeCode', 'claudeEnterprise', 'agentsRunBusiness', 'agentsGrowBusiness'];
    const segmentData = penetrationBySegment?.[tier];

    for (const product of products) {
      for (const q of QUARTERS) {
        result[product][q] = {
          target: segmentData?.[product]?.[q]?.target || 0,
          actual: segmentData?.[product]?.[q]?.actual || null,
          source: segmentData?.[product]?.[q]?.source || 'global'
        };
      }
    }

    return result;
  }

  /**
   * Extract all segment penetration data (for team sizing calculations)
   */
  extractAllSegmentPenetration(penetrationBySegment) {
    const segments = ['Mega', 'Strategic', 'Enterprise', 'Commercial', 'SmallBusiness'];
    const result = {};

    for (const segment of segments) {
      result[segment] = this.extractSegmentPenetration(penetrationBySegment, segment);
    }

    return result;
  }

  /**
   * Extract coverage values
   */
  extractCoverageValues(coverage) {
    const getValue = (obj) => {
      if (obj && obj.value !== undefined) return obj.value;
      return obj;
    };

    return {
      accountsPerRep: getValue(coverage?.accountsPerRep) || 15,
      dedicatedReps: getValue(coverage?.dedicatedReps) || 0,
      repThreshold: getValue(coverage?.repThreshold) || 100000000
    };
  }

  /**
   * Merge bank-specific assumptions with global
   */
  mergeWithGlobal(global, specific) {
    if (!specific) return global;

    const merged = JSON.parse(JSON.stringify(global));

    for (const category of Object.keys(specific)) {
      if (specific[category]) {
        for (const field of Object.keys(specific[category])) {
          if (specific[category][field] && specific[category][field].value !== undefined) {
            if (!merged[category]) merged[category] = {};
            merged[category][field] = specific[category][field];
          }
        }
      }
    }

    return merged;
  }

  /**
   * Extract team sizing assumption values
   * - Asset-based tier thresholds: determine which tier a bank belongs to
   * - TAM per AE: used for sizing the team based on how much TAM each AE can cover
   */
  extractTeamSizingValues(teamSizing) {
    const getValue = (obj) => {
      if (obj && obj.value !== undefined) return obj.value;
      return obj;
    };

    return {
      targetBankCount: getValue(teamSizing?.targetBankCount) || 100,

      // Asset-based tier thresholds (in dollars) - for determining bank tier
      // Mega: >$1T assets, Strategic: >$100B, Enterprise: >$30B, Commercial: >$10B
      megaTierThreshold: getValue(teamSizing?.megaTierThreshold) || 1000000000000,      // $1T assets
      strategicTierThreshold: getValue(teamSizing?.strategicTierThreshold) || 100000000000,  // $100B assets
      enterpriseTierThreshold: getValue(teamSizing?.enterpriseTierThreshold) || 30000000000,  // $30B assets
      commercialTierThreshold: getValue(teamSizing?.commercialTierThreshold) || 10000000000,  // $10B assets

      // TAM per AE by tier (in millions of TAM) - for team sizing
      tamPerAE: {
        Mega: getValue(teamSizing?.tamPerAE_Mega) || 1000,        // $1B TAM per AE
        Strategic: getValue(teamSizing?.tamPerAE_Strategic) || 500,  // $500M TAM per AE
        Enterprise: getValue(teamSizing?.tamPerAE_Enterprise) || 300,  // $300M TAM per AE
        Commercial: getValue(teamSizing?.tamPerAE_Commercial) || 200,  // $200M TAM per AE
        SmallBusiness: getValue(teamSizing?.tamPerAE_SmallBusiness) || 200  // $200M TAM per AE
      },

      // SE per AE by tier
      sePerAE: {
        Mega: getValue(teamSizing?.sePerAE_Mega) || 1.0,
        Strategic: getValue(teamSizing?.sePerAE_Strategic) || 1.0,
        Enterprise: getValue(teamSizing?.sePerAE_Enterprise) || 0.5,
        Commercial: getValue(teamSizing?.sePerAE_Commercial) || 0.25,
        SmallBusiness: getValue(teamSizing?.sePerAE_SmallBusiness) || 0.25
      }
    };
  }

  /**
   * Calculate team sizing for the portfolio (TAM-based tiers)
   */
  async calculateTeamSizing(options = {}) {
    const { targetBankCount } = options;

    // Get global assumptions including team sizing
    const globalAssumptions = await TAMAssumptions.getGlobalDefaults();
    const ts = this.extractTeamSizingValues(globalAssumptions.teamSizing);
    // Use segment-based penetration rates
    const segmentPenetration = this.extractAllSegmentPenetration(globalAssumptions.penetrationBySegment);
    // Get pricing assumptions for TAM calculation worksheet
    const pricingAssumptions = this.extractAssumptionValues(globalAssumptions.assumptions);

    // Get all banks with TAM calculated (only includes banks with data from latest quarter)
    const allBanksResult = await this.calculateAllBanksTAM({ limit: 10000 });
    const allBanks = allBanksResult.banks;

    // Sort by total assets descending (largest banks first)
    // Note: totalAssets is in thousands in the database
    allBanks.sort((a, b) => (b.totalAssets || 0) - (a.totalAssets || 0));

    // Determine how many banks to cover
    const banksToCover = targetBankCount || ts.targetBankCount;

    // Split into covered and uncovered
    const coveredBanks = allBanks.slice(0, banksToCover);
    const uncoveredBanks = allBanks.slice(banksToCover);

    // Calculate TAM and assets covered vs uncovered
    const tamCovered = coveredBanks.reduce((sum, b) => sum + b.tam.total, 0);
    const tamUncovered = uncoveredBanks.reduce((sum, b) => sum + b.tam.total, 0);
    const totalTAM = tamCovered + tamUncovered;
    const coveragePct = totalTAM > 0 ? tamCovered / totalTAM : 0;

    const assetsCovered = coveredBanks.reduce((sum, b) => sum + (b.totalAssets || 0), 0);
    const assetsUncovered = uncoveredBanks.reduce((sum, b) => sum + (b.totalAssets || 0), 0);

    // Aggregate inputs for covered banks (for TAM calculation worksheet)
    const coveredFTE = coveredBanks.reduce((sum, b) => sum + (b.fte || 0), 0);
    const coveredNetIncome = coveredBanks.reduce((sum, b) => sum + (b.netIncome || 0), 0);

    // Categorize covered banks by tier (using asset-based thresholds)
    // Note: assets from DB are in thousands, so multiply by 1000 for comparison
    const getTierForTeamSizing = (bankAssets) => {
      const actualAssets = bankAssets * 1000;  // Convert from thousands to actual dollars
      if (actualAssets >= ts.megaTierThreshold) return 'Mega';
      if (actualAssets >= ts.strategicTierThreshold) return 'Strategic';
      if (actualAssets >= ts.enterpriseTierThreshold) return 'Enterprise';
      if (actualAssets >= ts.commercialTierThreshold) return 'Commercial';
      return 'SmallBusiness';
    };

    const TIERS = ['Mega', 'Strategic', 'Enterprise', 'Commercial', 'SmallBusiness'];
    const banksByTier = {};
    for (const tier of TIERS) {
      banksByTier[tier] = [];
    }

    for (const bank of coveredBanks) {
      const tier = getTierForTeamSizing(bank.totalAssets || 0);
      banksByTier[tier].push(bank);
    }

    // Calculate team requirements by tier (based on TAM per AE)
    const teamByTier = {};
    let totalAEs = 0;
    let totalSEs = 0;

    // Custom rounding for display:
    // - If >= 1: round down when decimal < 0.75, round up when decimal >= 0.75
    // - If < 1: keep fractional value (represents partial AE coverage)
    const aggressiveRound = (val) => {
      if (val < 1) {
        // Keep fractional values for partial coverage, round to 2 decimal places
        return Math.round(val * 100) / 100;
      }
      const decimal = val - Math.floor(val);
      return decimal >= 0.75 ? Math.ceil(val) : Math.floor(val);
    };

    // First pass: calculate raw AE/SE for each bank and store for tier summation
    const bankCalculations = {};
    for (const tier of TIERS) {
      const tierBanks = banksByTier[tier];
      const tamPerAE = ts.tamPerAE[tier];  // TAM in millions per AE
      const sePerAERatio = ts.sePerAE[tier];

      bankCalculations[tier] = tierBanks.map(b => {
        const bankTAMInMillions = (b.tam?.total || 0) / 1000000;  // Convert to millions
        const aeRaw = bankTAMInMillions / tamPerAE;
        const seRaw = aeRaw * sePerAERatio;
        // Apply rounding: whole numbers for >= 1, fractional for < 1
        const aeRounded = aggressiveRound(aeRaw);
        const seRounded = aggressiveRound(seRaw);
        return {
          bank: b,
          aeRaw,
          seRaw,
          aeRounded,
          seRounded
        };
      });
    }

    // Second pass: sum rounded values for tier totals
    for (const tier of TIERS) {
      const tierBanks = banksByTier[tier];
      const tierTAM = tierBanks.reduce((sum, b) => sum + b.tam.total, 0);
      const tier3yr = tierBanks.reduce((sum, b) => sum + b.threeYearAchievable, 0);
      const tierAssets = tierBanks.reduce((sum, b) => sum + (b.totalAssets || 0), 0);

      const tamPerAE = ts.tamPerAE[tier];  // TAM in millions per AE
      const sePerAERatio = ts.sePerAE[tier];

      // Sum rounded individual bank values for tier totals
      const calcs = bankCalculations[tier];
      const aesNeeded = calcs.reduce((sum, c) => sum + c.aeRounded, 0);
      const sesNeeded = calcs.reduce((sum, c) => sum + c.seRounded, 0);

      // Round tier totals to whole numbers
      const aesRounded = Math.round(aesNeeded);
      const sesRounded = Math.round(sesNeeded);

      teamByTier[tier] = {
        bankCount: tierBanks.length,
        tam: tierTAM,
        totalAssets: tierAssets,
        threeYearAchievable: tier3yr,
        tamPerAE: tamPerAE,  // Changed from billionPerAE
        sePerAE: sePerAERatio,
        aesNeeded: aesRounded,
        sesNeeded: sesRounded,
        totalHeadcount: aesRounded + sesRounded
      };

      totalAEs += aesRounded;
      totalSEs += sesRounded;
    }

    // Calculate 3-year revenue for covered banks (already uses segment penetration in calculateAllBanksTAM)
    const threeYearCovered = coveredBanks.reduce((sum, b) => sum + b.threeYearAchievable, 0);
    const threeYearUncovered = uncoveredBanks.reduce((sum, b) => sum + b.threeYearAchievable, 0);

    // TAM by product for covered banks (for display purposes)
    const coveredTAMByProduct = {
      claudeCode: coveredBanks.reduce((sum, b) => sum + b.tam.claudeCode, 0),
      claudeEnterprise: coveredBanks.reduce((sum, b) => sum + b.tam.claudeEnterprise, 0),
      agentsRunBusiness: coveredBanks.reduce((sum, b) => sum + b.tam.agentsRunBusiness, 0),
      agentsGrowBusiness: coveredBanks.reduce((sum, b) => sum + b.tam.agentsGrowBusiness, 0)
    };

    // Calculate quarterly revenue using segment-specific penetration
    // Sum up each segment's contribution based on their respective penetration rates
    const coveredQuarterlyRevenue = this.calculateSegmentAggregatedQuarterlyRevenue(
      banksByTier, segmentPenetration
    );

    // Aggregate operating expense calculations for covered banks
    const totalCoveredOpEx = coveredBanks.reduce((sum, b) => sum + (b.annualOpEx || 0), 0);
    const opExBreakdownAggregate = {
      salariesAndBenefits: coveredBanks.reduce((sum, b) => sum + (b.opExBreakdown?.salariesAndBenefits || 0), 0),
      premisesExpense: coveredBanks.reduce((sum, b) => sum + (b.opExBreakdown?.premisesExpense || 0), 0),
      other: coveredBanks.reduce((sum, b) => sum + (b.opExBreakdown?.other || 0), 0)
    };
    const tamAsOpExPctAggregate = totalCoveredOpEx > 0 ? tamCovered / totalCoveredOpEx : null;

    // Calculate year-end RRR values (Q4 of each year, annualized)
    const rrr2026 = (coveredQuarterlyRevenue['2026-Q4']?.total || 0) * 4;
    const rrr2027 = (coveredQuarterlyRevenue['2027-Q4']?.total || 0) * 4;
    const rrr2028 = (coveredQuarterlyRevenue['2028-Q4']?.total || 0) * 4;

    // RRR as % of total operating expense
    const rrr2026AsOpExPct = totalCoveredOpEx > 0 ? rrr2026 / totalCoveredOpEx : null;
    const rrr2027AsOpExPct = totalCoveredOpEx > 0 ? rrr2027 / totalCoveredOpEx : null;
    const rrr2028AsOpExPct = totalCoveredOpEx > 0 ? rrr2028 / totalCoveredOpEx : null;

    return {
      // Coverage summary
      coverage: {
        targetBankCount: banksToCover,
        coveredBankCount: coveredBanks.length,
        uncoveredBankCount: uncoveredBanks.length,
        totalBankCount: allBanks.length,
        tamCovered,
        tamUncovered,
        totalTAM,
        coveragePct,
        assetsCovered,
        assetsUncovered,
        threeYearCovered,
        threeYearUncovered
      },

      // Team requirements by tier
      teamByTier,

      // Team totals (sum of tier totals, which are already whole numbers)
      teamTotals: {
        aes: totalAEs,
        ses: totalSEs,
        total: totalAEs + totalSEs,
        seToAERatio: totalAEs > 0 ? Math.round((totalSEs / totalAEs) * 100) / 100 : 0
      },

      // Quarterly revenue (covered)
      quarterlyRevenue: coveredQuarterlyRevenue,

      // TAM by product (covered)
      coveredTAMByProduct,

      // Aggregate operating expense sanity check
      operatingExpense: {
        totalCoveredOpEx,
        breakdown: opExBreakdownAggregate,
        totalCoveredTAM: tamCovered,
        tamAsOpExPct: tamAsOpExPctAggregate,
        rrr: {
          rrr2026,
          rrr2027,
          rrr2028,
          rrr2026AsOpExPct,
          rrr2027AsOpExPct,
          rrr2028AsOpExPct
        }
      },

      // Assumptions used (team sizing)
      assumptions: ts,

      // Pricing assumptions for TAM calculation worksheet
      pricingAssumptions,

      // Aggregate inputs for TAM calculation worksheet
      aggregateInputs: {
        totalFTE: coveredFTE,
        totalNetIncome: coveredNetIncome,
        // Calculated intermediate values
        developers: Math.round(coveredFTE * pricingAssumptions.claudeCode.fteEligibilityRate),
        enterpriseSeats: Math.round(coveredFTE * pricingAssumptions.claudeEnterprise.adoptionRate),
        totalAgents: Math.round(coveredFTE * pricingAssumptions.agentsRunBusiness.agentsPerEmployee)
      },

      // Segment penetration rates (for display/editing)
      penetrationBySegment: segmentPenetration,

      // Tier order for display
      tierOrder: TIERS,

      // All covered banks with tier assignments and headcount allocation
      coveredBanks: coveredBanks.map(b => {
        const tier = getTierForTeamSizing(b.totalAssets || 0);
        const tierCalcs = bankCalculations[tier];
        const bankCalc = tierCalcs.find(c => c.bank.idrssd === b.idrssd);

        // Use pre-calculated rounded values - all whole numbers
        const aeShare = bankCalc ? bankCalc.aeRounded : 0;
        const seShare = bankCalc ? bankCalc.seRounded : 0;

        // Get segment penetration for this bank's tier
        const pp = segmentPenetration[tier];

        // Calculate yearly RRR (Run Rate Revenue) = Q4 quarterly revenue × 4 (annualized)
        // This represents the annualized run rate at the end of each year
        const bankTamByProduct = b.tam;

        // Helper to calculate Q4 quarterly revenue for a given year
        const getQ4QuarterlyRevenue = (q4Quarter) => {
          return (bankTamByProduct.claudeCode / 4) * (pp?.claudeCode?.[q4Quarter]?.target || 0) +
            (bankTamByProduct.claudeEnterprise / 4) * (pp?.claudeEnterprise?.[q4Quarter]?.target || 0) +
            (bankTamByProduct.agentsRunBusiness / 4) * (pp?.agentsRunBusiness?.[q4Quarter]?.target || 0) +
            (bankTamByProduct.agentsGrowBusiness / 4) * (pp?.agentsGrowBusiness?.[q4Quarter]?.target || 0);
        };

        // RRR = Q4 quarterly revenue × 4 (annualized run rate)
        const y1RRR = getQ4QuarterlyRevenue('2026-Q4') * 4;
        const y2RRR = getQ4QuarterlyRevenue('2027-Q4') * 4;
        const y3RRR = getQ4QuarterlyRevenue('2028-Q4') * 4;

        return {
          idrssd: b.idrssd,
          bankName: b.bankName,
          fte: b.fte,
          totalAssets: b.totalAssets,
          tam: b.tam.total,
          tamByProduct: b.tam,  // Renamed from tamBySource for consistency
          yearlyRevenue: {
            // RRR (Run Rate Revenue) = Q4 annualized for each year
            y1: Math.round(y1RRR),
            y2: Math.round(y2RRR),
            y3: Math.round(y3RRR)
          },
          threeYear: b.threeYearAchievable,
          tier,
          aeShare,
          seShare,
          totalShare: aeShare + seShare,
          // Operating expense sanity check (passed through from calculateAllBanksTAM)
          annualOpEx: b.annualOpEx || 0,
          opExBreakdown: b.opExBreakdown || { salariesAndBenefits: 0, premisesExpense: 0, other: 0 },
          tamAsOpExPct: b.tamAsOpExPct
        };
      }),

      // Banks by tier for easier grouping
      banksByTier: Object.fromEntries(
        Object.entries(banksByTier).map(([tier, banks]) => [
          tier,
          banks.map(b => ({
            idrssd: b.idrssd,
            bankName: b.bankName,
            fte: b.fte,
            tam: b.tam.total,
            threeYear: b.threeYearAchievable
          }))
        ])
      ),

      // Period
      period: allBanksResult.period
    };
  }

  /**
   * Calculate capacity-based revenue capture
   * Priority: 1) Banks with assigned AEs/SEs, 2) Unassigned banks by TAM (highest first)
   */
  async calculateCapacityBasedRevenue(coveredBanks, teamByTier, segmentPenetration) {
    const roster = await TeamRoster.getGlobalRoster();
    const globalAssumptions = await TAMAssumptions.getGlobalDefaults();

    // Get ramp quarters from global assumptions (default: 2)
    const rampQuarters = globalAssumptions.teamSizing?.aeRampQuarters?.value || 2;

    const headcountTimeline = roster.getHeadcountTimeline();
    const effectiveCapacityTimeline = roster.getEffectiveCapacityTimeline(rampQuarters);
    const reactiveCaptureRate = roster.assumptions.reactiveCaptureRate;

    // Current active members
    const activeMembers = roster.members.filter(m => m.isActive);
    const currentAEs = activeMembers.filter(m => m.role === 'AE').length;
    const currentSEs = activeMembers.filter(m => m.role === 'SE').length;

    // Build bank assignment map from roster
    // Check both legacy assignedBankIdrssd field AND new accountAssignments array
    const bankAssignments = {};
    for (const member of activeMembers) {
      // Helper to add member to bank assignment
      const addToBankAssignment = (bankIdrssd) => {
        const idrssdStr = String(bankIdrssd);
        if (!bankAssignments[idrssdStr]) {
          bankAssignments[idrssdStr] = { aes: [], ses: [] };
        }
        if (member.role === 'AE') {
          bankAssignments[idrssdStr].aes.push({
            id: member._id,
            name: member.name
          });
        } else {
          bankAssignments[idrssdStr].ses.push({
            id: member._id,
            name: member.name
          });
        }
      };

      // Check legacy field
      if (member.assignedBankIdrssd) {
        addToBankAssignment(member.assignedBankIdrssd);
      }

      // Check new accountAssignments array
      if (member.accountAssignments && member.accountAssignments.length > 0) {
        for (const assignment of member.accountAssignments) {
          if (assignment.idrssd) {
            addToBankAssignment(assignment.idrssd);
          }
        }
      }
    }

    // Separate banks into assigned and unassigned, sort unassigned by TAM
    const assignedBanks = coveredBanks.filter(b => bankAssignments[b.idrssd]);
    const unassignedBanks = coveredBanks
      .filter(b => !bankAssignments[b.idrssd])
      .sort((a, b) => b.tam - a.tam);

    // Calculate capacity assignment for each quarter
    const quarterlyCapacity = {};
    const bankCoverageStatus = {};

    // Helper to check if a member has any bank assignments
    const memberHasAssignments = (m) => {
      return m.assignedBankIdrssd || (m.accountAssignments && m.accountAssignments.length > 0);
    };

    for (const quarter of QUARTERS) {
      const hc = headcountTimeline[quarter];

      // Start with available capacity (future hires are unassigned)
      // Current members who are assigned consume capacity for their bank
      const assignedAEs = activeMembers.filter(m => m.role === 'AE' && memberHasAssignments(m)).length;
      const assignedSEs = activeMembers.filter(m => m.role === 'SE' && memberHasAssignments(m)).length;

      // Unassigned current members + future hires = available for unassigned banks
      let availableAEsForUnassigned = hc.aes - assignedAEs;
      let availableSEsForUnassigned = hc.ses - assignedSEs;

      const dedicatedBanks = [];
      const reactiveBanks = [];

      // Step 1: Banks with explicit assignments are always dedicated
      for (const bank of assignedBanks) {
        const assignment = bankAssignments[bank.idrssd];
        dedicatedBanks.push({
          ...bank,
          coverageType: 'assigned',
          assignedAEs: assignment.aes,
          assignedSEs: assignment.ses,
          aeAllocation: assignment.aes.length,
          seAllocation: assignment.ses.length
        });
      }

      // Step 2: Assign remaining capacity to unassigned banks by TAM
      for (const bank of unassignedBanks) {
        const tier = bank.tier;
        const tierData = teamByTier[tier];

        // Calculate this bank's required capacity
        const tierBankCount = tierData?.bankCount || 1;
        const tierAEsNeeded = tierData?.aesNeeded || 0;
        const tierSEsNeeded = tierData?.sesNeeded || 0;
        const bankAEShare = tierBankCount > 0 ? tierAEsNeeded / tierBankCount : 0;
        const bankSEShare = tierBankCount > 0 ? tierSEsNeeded / tierBankCount : 0;

        // Check if we have unassigned capacity for this bank
        if (availableAEsForUnassigned >= bankAEShare && availableSEsForUnassigned >= bankSEShare) {
          dedicatedBanks.push({
            ...bank,
            coverageType: 'dedicated',
            assignedAEs: [],
            assignedSEs: [],
            aeAllocation: bankAEShare,
            seAllocation: bankSEShare
          });
          availableAEsForUnassigned -= bankAEShare;
          availableSEsForUnassigned -= bankSEShare;
        } else {
          reactiveBanks.push({
            ...bank,
            coverageType: 'reactive',
            captureRate: reactiveCaptureRate
          });
        }
      }

      // Store coverage status for this quarter
      quarterlyCapacity[quarter] = {
        availableHeadcount: hc,
        assignedAEs,
        assignedSEs,
        unassignedAEsUsed: (hc.aes - assignedAEs) - availableAEsForUnassigned,
        unassignedSEsUsed: (hc.ses - assignedSEs) - availableSEsForUnassigned,
        remainingAEs: availableAEsForUnassigned,
        remainingSEs: availableSEsForUnassigned,
        dedicatedCount: dedicatedBanks.length,
        reactiveCount: reactiveBanks.length,
        assignedBankCount: assignedBanks.length,
        dedicatedBanks: dedicatedBanks.map(b => b.idrssd),
        reactiveBanks: reactiveBanks.map(b => b.idrssd)
      };

      // Store bank coverage status for this quarter
      for (const b of dedicatedBanks) {
        if (!bankCoverageStatus[b.idrssd]) bankCoverageStatus[b.idrssd] = {};
        bankCoverageStatus[b.idrssd][quarter] = b.coverageType === 'assigned' ? 'assigned' : 'dedicated';
      }
      for (const b of reactiveBanks) {
        if (!bankCoverageStatus[b.idrssd]) bankCoverageStatus[b.idrssd] = {};
        bankCoverageStatus[b.idrssd][quarter] = 'reactive';
      }
    }

    // Calculate adjusted quarterly revenue based on capacity
    // Resourced to Win = (Team Capacity / Account TAM) × Winnable
    // - For assigned banks: coverage ratio = (# AEs assigned × TAM per AE) / Account TAM
    // - For reactive banks: coverage ratio = reactive capture rate
    const adjustedQuarterlyRevenue = {};

    for (const quarter of QUARTERS) {
      let dedicatedRevenue = 0;
      let reactiveRevenue = 0;
      let fullPotentialRevenue = 0;

      for (const bank of coveredBanks) {
        const tier = bank.tier;
        const pp = segmentPenetration[tier];
        const tam = bank.tamByProduct || bank.tam;
        const accountTAM = bank.tam?.total || 0; // Total account TAM

        // Get TAM per AE for this tier (stored in millions, convert to dollars)
        const tamPerAEMillions = teamByTier[tier]?.tamPerAE || 1000; // Default 1000M = $1B
        const tamPerAE = tamPerAEMillions * 1000000; // Convert to dollars

        // Calculate this bank's potential quarterly revenue
        const ccPen = pp?.claudeCode?.[quarter]?.target || 0;
        const cePen = pp?.claudeEnterprise?.[quarter]?.target || 0;
        const arPen = pp?.agentsRunBusiness?.[quarter]?.target || 0;
        const agPen = pp?.agentsGrowBusiness?.[quarter]?.target || 0;

        const ccRev = ((tam.claudeCode || 0) / 4) * ccPen;
        const ceRev = ((tam.claudeEnterprise || 0) / 4) * cePen;
        const arRev = ((tam.agentsRunBusiness || 0) / 4) * arPen;
        const agRev = ((tam.agentsGrowBusiness || 0) / 4) * agPen;

        const bankQuarterlyRevenue = ccRev + ceRev + arRev + agRev;
        fullPotentialRevenue += bankQuarterlyRevenue;

        // Calculate coverage ratio based on coverage type
        const coverageType = bankCoverageStatus[bank.idrssd]?.[quarter] || 'reactive';
        const bankAssignment = bankAssignments[String(bank.idrssd)];

        if (coverageType === 'assigned' && bankAssignment) {
          // Assigned banks: coverage ratio = (# AEs × TAM per AE) / Account TAM
          const numAEs = bankAssignment.aes.length;
          const teamCapacity = numAEs * tamPerAE;
          const coverageRatio = accountTAM > 0 ? Math.min(1, teamCapacity / accountTAM) : 0;
          dedicatedRevenue += bankQuarterlyRevenue * coverageRatio;
        } else if (coverageType === 'dedicated') {
          // Dedicated (unassigned but has capacity allocation): 100% capture
          dedicatedRevenue += bankQuarterlyRevenue;
        } else {
          // Reactive: apply reactive capture rate
          reactiveRevenue += bankQuarterlyRevenue * reactiveCaptureRate;
        }
      }

      adjustedQuarterlyRevenue[quarter] = {
        fullPotential: Math.round(fullPotentialRevenue),
        dedicatedRevenue: Math.round(dedicatedRevenue),
        reactiveRevenue: Math.round(reactiveRevenue),
        capturedRevenue: Math.round(dedicatedRevenue + reactiveRevenue),
        captureRate: fullPotentialRevenue > 0
          ? (dedicatedRevenue + reactiveRevenue) / fullPotentialRevenue
          : 0
      };
    }

    // Calculate summary metrics
    const y1Potential = ['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4']
      .reduce((sum, q) => sum + adjustedQuarterlyRevenue[q].fullPotential, 0);
    const y1Captured = ['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4']
      .reduce((sum, q) => sum + adjustedQuarterlyRevenue[q].capturedRevenue, 0);

    const y2Potential = ['2027-Q1', '2027-Q2', '2027-Q3', '2027-Q4']
      .reduce((sum, q) => sum + adjustedQuarterlyRevenue[q].fullPotential, 0);
    const y2Captured = ['2027-Q1', '2027-Q2', '2027-Q3', '2027-Q4']
      .reduce((sum, q) => sum + adjustedQuarterlyRevenue[q].capturedRevenue, 0);

    const y3Potential = ['2028-Q1', '2028-Q2', '2028-Q3', '2028-Q4']
      .reduce((sum, q) => sum + adjustedQuarterlyRevenue[q].fullPotential, 0);
    const y3Captured = ['2028-Q1', '2028-Q2', '2028-Q3', '2028-Q4']
      .reduce((sum, q) => sum + adjustedQuarterlyRevenue[q].capturedRevenue, 0);

    // Calculate adjusted RRR (based on Q4 captured revenue × 4)
    const adjustedRRR2026 = adjustedQuarterlyRevenue['2026-Q4'].capturedRevenue * 4;
    const adjustedRRR2027 = adjustedQuarterlyRevenue['2027-Q4'].capturedRevenue * 4;
    const adjustedRRR2028 = adjustedQuarterlyRevenue['2028-Q4'].capturedRevenue * 4;

    return {
      // Roster info
      roster: {
        currentAEs,
        currentSEs,
        currentTotal: currentAEs + currentSEs,
        memberCount: roster.members.filter(m => m.isActive).length,
        members: activeMembers.map(m => ({
          id: m._id,
          name: m.name,
          role: m.role,
          assignedBankIdrssd: m.assignedBankIdrssd
        })),
        hiringPlan: roster.hiringPlan
      },

      // Headcount timeline (raw headcount)
      headcountTimeline,

      // Effective capacity timeline (accounting for hiring ramp)
      effectiveCapacityTimeline,

      // Assumptions (merged with global TAM assumptions)
      assumptions: {
        ...roster.assumptions,
        rampQuarters  // From global TAM assumptions
      },

      // Bank assignments (which team members are assigned to which banks)
      bankAssignments,

      // Quarterly capacity analysis
      quarterlyCapacity,

      // Adjusted revenue by quarter
      adjustedQuarterlyRevenue,

      // Bank coverage status by quarter
      bankCoverageStatus,

      // Summary
      summary: {
        y1: { potential: y1Potential, captured: y1Captured, captureRate: y1Potential > 0 ? y1Captured / y1Potential : 0 },
        y2: { potential: y2Potential, captured: y2Captured, captureRate: y2Potential > 0 ? y2Captured / y2Potential : 0 },
        y3: { potential: y3Potential, captured: y3Captured, captureRate: y3Potential > 0 ? y3Captured / y3Potential : 0 },
        total: {
          potential: y1Potential + y2Potential + y3Potential,
          captured: y1Captured + y2Captured + y3Captured,
          captureRate: (y1Potential + y2Potential + y3Potential) > 0
            ? (y1Captured + y2Captured + y3Captured) / (y1Potential + y2Potential + y3Potential)
            : 0
        },
        adjustedRRR: {
          rrr2026: adjustedRRR2026,
          rrr2027: adjustedRRR2027,
          rrr2028: adjustedRRR2028
        }
      }
    };
  }
}

module.exports = new TAMCalculationService();
