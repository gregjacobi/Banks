const mongoose = require('mongoose');

/**
 * TAMAssumptions Schema
 *
 * Stores TAM (Total Addressable Market) assumptions at global and bank levels.
 * Supports three-tier override system: global → agent → human
 *
 * Revenue Sources:
 * 1. Claude Code: $150/month × developer FTE
 * 2. Claude Enterprise: $35/month × all employees
 * 3. Agents (Run Business): agents per employee × $1,000/month
 * 4. Agents (Grow Business): % of revenue × Anthropic share
 *
 * Per-Product Penetration:
 * Each product has its own penetration schedule over 12 quarters (Q1 2026 - Q4 2028)
 * - Claude Code: Strong from start
 * - Claude Enterprise: Healthy growth
 * - Agents Run Business: Starts 2027
 * - Agents Grow Business: Starts 2028
 */

const assumptionSourceSchema = new mongoose.Schema({
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  source: {
    type: String,
    enum: ['global', 'agent', 'human'],
    default: 'global'
  },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: String, default: 'system' },
  notes: { type: String }
}, { _id: false });

const penetrationQuarterSchema = new mongoose.Schema({
  target: { type: Number, default: 0 },      // Target penetration rate (0-1)
  actual: { type: Number, default: null },   // Actual penetration rate (null until realized)
  source: {
    type: String,
    enum: ['global', 'agent', 'human'],
    default: 'global'
  },
  updatedAt: { type: Date, default: Date.now },
  notes: { type: String }
}, { _id: false });

// Per-product penetration schema (12 quarters)
const productPenetrationSchema = new mongoose.Schema({
  '2026-Q1': penetrationQuarterSchema,
  '2026-Q2': penetrationQuarterSchema,
  '2026-Q3': penetrationQuarterSchema,
  '2026-Q4': penetrationQuarterSchema,
  '2027-Q1': penetrationQuarterSchema,
  '2027-Q2': penetrationQuarterSchema,
  '2027-Q3': penetrationQuarterSchema,
  '2027-Q4': penetrationQuarterSchema,
  '2028-Q1': penetrationQuarterSchema,
  '2028-Q2': penetrationQuarterSchema,
  '2028-Q3': penetrationQuarterSchema,
  '2028-Q4': penetrationQuarterSchema
}, { _id: false });

// Segment-level penetration schema (all 4 products)
const segmentPenetrationSchema = new mongoose.Schema({
  claudeCode: productPenetrationSchema,
  claudeEnterprise: productPenetrationSchema,
  agentsRunBusiness: productPenetrationSchema,
  agentsGrowBusiness: productPenetrationSchema
}, { _id: false });

const TAMAssumptionsSchema = new mongoose.Schema({
  // Bank identifier - null for global defaults
  idrssd: {
    type: String,
    default: null,
    index: true
  },

  // Revenue source assumptions
  assumptions: {
    // Claude Code: Developer seats
    claudeCode: {
      pricePerMonth: assumptionSourceSchema,      // Default: $150
      fteEligibilityRate: assumptionSourceSchema  // Default: 0.15 (15% are developers)
    },

    // Claude Enterprise: All employee seats
    claudeEnterprise: {
      pricePerMonth: assumptionSourceSchema,      // Default: $35
      adoptionRate: assumptionSourceSchema        // Default: 1.0 (100% of employees)
    },

    // Agents to run the business
    agentsRunBusiness: {
      agentsPerEmployee: assumptionSourceSchema,  // Default: 5
      pricePerAgentMonth: assumptionSourceSchema  // Default: $1,000
    },

    // Agents to grow the business
    agentsGrowBusiness: {
      revenueFromAgents: assumptionSourceSchema,  // Default: 0.30 (30%)
      anthropicShare: assumptionSourceSchema      // Default: 0.20 (20%)
    }
  },

  // Account coverage assumptions
  coverage: {
    accountsPerRep: assumptionSourceSchema,       // Default: 15 banks per rep
    dedicatedReps: assumptionSourceSchema,        // Default: 0 (calculated based on size)
    repThreshold: assumptionSourceSchema          // Default: TAM threshold for dedicated rep
  },

  // Team sizing assumptions
  teamSizing: {
    // Coverage model
    targetBankCount: assumptionSourceSchema,       // Top N banks to cover (default: 100)

    // Asset-based tier thresholds (in dollars) - determines which tier a bank belongs to
    // Mega Banks: >$1T assets, Strategic: >$100B, Enterprise: >$30B, Commercial: >$10B, SmallBusiness: <$10B
    megaTierThreshold: assumptionSourceSchema,            // $1T (1,000,000,000,000)
    strategicTierThreshold: assumptionSourceSchema,       // $100B (100,000,000,000)
    enterpriseTierThreshold: assumptionSourceSchema,      // $30B (30,000,000,000)
    commercialTierThreshold: assumptionSourceSchema,      // $10B (10,000,000,000)
    // Below commercial = Small Business

    // TAM per AE by tier (how much TAM each AE covers in millions) - used for team sizing
    tamPerAE_Mega: assumptionSourceSchema,                // $1B TAM per AE (1000M)
    tamPerAE_Strategic: assumptionSourceSchema,           // $500M TAM per AE
    tamPerAE_Enterprise: assumptionSourceSchema,          // $300M TAM per AE
    tamPerAE_Commercial: assumptionSourceSchema,          // $200M TAM per AE
    tamPerAE_SmallBusiness: assumptionSourceSchema,       // $200M TAM per AE

    // SE allocation by tier (SE per AE ratio)
    sePerAE_Mega: assumptionSourceSchema,                 // 1.0 (1:1) - most complex
    sePerAE_Strategic: assumptionSourceSchema,            // 1.0 (1:1)
    sePerAE_Enterprise: assumptionSourceSchema,           // 0.5 (1:2)
    sePerAE_Commercial: assumptionSourceSchema,           // 0.25 (1:4)
    sePerAE_SmallBusiness: assumptionSourceSchema,        // 0.25 (1:4)

    // Hiring ramp assumptions
    // New hires start mid-quarter and take time to become productive:
    // - Quarter 0 (hire quarter): 0% productive
    // - Quarter 1: 50% productive (ramping)
    // - Quarter 2+: 100% productive (fully ramped)
    aeRampQuarters: assumptionSourceSchema                // Default: 2 (full productivity after 2 quarters)
  },

  // Per-product penetration targets by quarter (Q1 2026 - Q4 2028)
  // DEPRECATED: Use penetrationBySegment instead for segment-specific rates
  penetrationByProduct: {
    claudeCode: productPenetrationSchema,
    claudeEnterprise: productPenetrationSchema,
    agentsRunBusiness: productPenetrationSchema,
    agentsGrowBusiness: productPenetrationSchema
  },

  // Segment-based penetration targets (Mega, Strategic, Enterprise, Commercial, SmallBusiness)
  // Each segment has its own penetration schedule by product
  penetrationBySegment: {
    Mega: segmentPenetrationSchema,
    Strategic: segmentPenetrationSchema,
    Enterprise: segmentPenetrationSchema,
    Commercial: segmentPenetrationSchema,
    SmallBusiness: segmentPenetrationSchema
  },

  // Legacy: Overall penetration (kept for backwards compatibility)
  penetration: {
    '2026-Q1': penetrationQuarterSchema,
    '2026-Q2': penetrationQuarterSchema,
    '2026-Q3': penetrationQuarterSchema,
    '2026-Q4': penetrationQuarterSchema,
    '2027-Q1': penetrationQuarterSchema,
    '2027-Q2': penetrationQuarterSchema,
    '2027-Q3': penetrationQuarterSchema,
    '2027-Q4': penetrationQuarterSchema,
    '2028-Q1': penetrationQuarterSchema,
    '2028-Q2': penetrationQuarterSchema,
    '2028-Q3': penetrationQuarterSchema,
    '2028-Q4': penetrationQuarterSchema
  },

  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for efficient lookups
TAMAssumptionsSchema.index({ idrssd: 1 }, { unique: true, sparse: true });

/**
 * Get global defaults
 */
TAMAssumptionsSchema.statics.getGlobalDefaults = async function() {
  let global = await this.findOne({ idrssd: null });

  if (!global) {
    // Create default global assumptions
    global = await this.create({
      idrssd: null,
      assumptions: {
        claudeCode: {
          pricePerMonth: { value: 150, source: 'global' },
          fteEligibilityRate: { value: 0.15, source: 'global' }
        },
        claudeEnterprise: {
          pricePerMonth: { value: 35, source: 'global' },
          adoptionRate: { value: 1.0, source: 'global' }
        },
        agentsRunBusiness: {
          agentsPerEmployee: { value: 5, source: 'global' },
          pricePerAgentMonth: { value: 1000, source: 'global' }
        },
        agentsGrowBusiness: {
          revenueFromAgents: { value: 0.30, source: 'global' },
          anthropicShare: { value: 0.20, source: 'global' }
        }
      },
      coverage: {
        accountsPerRep: { value: 15, source: 'global' },
        dedicatedReps: { value: 0, source: 'global' },
        repThreshold: { value: 100000000, source: 'global' } // $100M TAM threshold
      },
      teamSizing: {
        // Coverage model
        targetBankCount: { value: 100, source: 'global' },

        // Asset-based tier thresholds (in dollars) - for tier assignment
        megaTierThreshold: { value: 1000000000000, source: 'global' },      // $1T assets
        strategicTierThreshold: { value: 100000000000, source: 'global' },  // $100B assets
        enterpriseTierThreshold: { value: 30000000000, source: 'global' },  // $30B assets
        commercialTierThreshold: { value: 10000000000, source: 'global' },  // $10B assets

        // TAM per AE by tier (in millions) - for team sizing
        tamPerAE_Mega: { value: 1000, source: 'global' },            // $1B TAM per AE
        tamPerAE_Strategic: { value: 500, source: 'global' },        // $500M TAM per AE
        tamPerAE_Enterprise: { value: 300, source: 'global' },       // $300M TAM per AE
        tamPerAE_Commercial: { value: 200, source: 'global' },       // $200M TAM per AE
        tamPerAE_SmallBusiness: { value: 200, source: 'global' },    // $200M TAM per AE

        // SE per AE by tier
        sePerAE_Mega: { value: 1.0, source: 'global' },
        sePerAE_Strategic: { value: 1.0, source: 'global' },
        sePerAE_Enterprise: { value: 0.5, source: 'global' },
        sePerAE_Commercial: { value: 0.25, source: 'global' },
        sePerAE_SmallBusiness: { value: 0.25, source: 'global' },

        // Hiring ramp (quarters until fully productive)
        aeRampQuarters: { value: 2, source: 'global' }  // 0% Q0, 50% Q1, 100% Q2+
      },
      penetrationByProduct: generateDefaultProductPenetration(),
      penetrationBySegment: generateDefaultSegmentPenetration(),
      penetration: generateDefaultPenetration()
    });
  }

  // Ensure penetrationByProduct exists (migration for existing records)
  if (!global.penetrationByProduct || !global.penetrationByProduct.claudeCode) {
    global.penetrationByProduct = generateDefaultProductPenetration();
    await global.save();
  }

  // Ensure penetrationBySegment exists (migration for existing records)
  if (!global.penetrationBySegment || !global.penetrationBySegment.Mega) {
    global.penetrationBySegment = generateDefaultSegmentPenetration();
    await global.save();
  }

  return global;
};

/**
 * Get assumptions for a specific bank, merging with global defaults
 */
TAMAssumptionsSchema.statics.getForBank = async function(idrssd) {
  const global = await this.getGlobalDefaults();
  const bankSpecific = await this.findOne({ idrssd });

  if (!bankSpecific) {
    // Return global defaults with bank idrssd context
    return {
      idrssd,
      assumptions: global.assumptions,
      coverage: global.coverage,
      penetrationByProduct: global.penetrationByProduct,
      penetration: global.penetration,
      isGlobalOnly: true
    };
  }

  // Merge: bank-specific overrides take precedence
  return {
    idrssd,
    assumptions: mergeAssumptions(global.assumptions, bankSpecific.assumptions),
    coverage: mergeAssumptions(global.coverage, bankSpecific.coverage),
    penetrationByProduct: mergeProductPenetration(global.penetrationByProduct, bankSpecific.penetrationByProduct),
    penetration: mergePenetration(global.penetration, bankSpecific.penetration),
    isGlobalOnly: false
  };
};

/**
 * Update assumptions for a specific bank
 */
TAMAssumptionsSchema.statics.updateBankAssumptions = async function(idrssd, updates, source = 'human', updatedBy = 'user') {
  const now = new Date();

  // Transform updates to include source metadata
  const transformedUpdates = transformUpdates(updates, source, updatedBy, now);

  const result = await this.findOneAndUpdate(
    { idrssd },
    {
      $set: {
        ...transformedUpdates,
        updatedAt: now
      }
    },
    { upsert: true, new: true }
  );

  return result;
};

/**
 * Update global assumptions
 */
TAMAssumptionsSchema.statics.updateGlobalAssumptions = async function(updates, source = 'human', updatedBy = 'user') {
  const now = new Date();
  const transformedUpdates = transformUpdates(updates, source, updatedBy, now);

  const result = await this.findOneAndUpdate(
    { idrssd: null },
    {
      $set: {
        ...transformedUpdates,
        updatedAt: now
      }
    },
    { upsert: true, new: true }
  );

  return result;
};

/**
 * Helper: Generate default per-product penetration schedule
 *
 * Strategy:
 * - Claude Code: Strong from start (2% → 25% over 3 years)
 * - Claude Enterprise: Healthy growth (1% → 20% over 3 years)
 * - Agents Run Business: Starts in 2027 (0% → 10%)
 * - Agents Grow Business: Starts in 2028 (0% → 5%)
 */
function generateDefaultProductPenetration() {
  const quarters = [
    '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4',
    '2027-Q1', '2027-Q2', '2027-Q3', '2027-Q4',
    '2028-Q1', '2028-Q2', '2028-Q3', '2028-Q4'
  ];

  // Claude Code: Strong from start (2% → 25%)
  const claudeCodeRates = [0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.14, 0.16, 0.18, 0.20, 0.22, 0.25];

  // Claude Enterprise: Healthy growth (1% → 20%)
  const enterpriseRates = [0.01, 0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.14, 0.16, 0.17, 0.18, 0.20];

  // Agents Run Business: Starts 2027 (0% through 2026, then 1% → 10%)
  const runBusinessRates = [0, 0, 0, 0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.10];

  // Agents Grow Business: Starts 2028 (0% through 2027, then 0.5% → 5%)
  const growBusinessRates = [0, 0, 0, 0, 0, 0, 0, 0, 0.005, 0.01, 0.02, 0.05];

  const createProductPenetration = (rates) => {
    const penetration = {};
    quarters.forEach((q, idx) => {
      penetration[q] = {
        target: rates[idx],
        actual: null,
        source: 'global',
        updatedAt: new Date()
      };
    });
    return penetration;
  };

  return {
    claudeCode: createProductPenetration(claudeCodeRates),
    claudeEnterprise: createProductPenetration(enterpriseRates),
    agentsRunBusiness: createProductPenetration(runBusinessRates),
    agentsGrowBusiness: createProductPenetration(growBusinessRates)
  };
}

/**
 * Helper: Generate default segment-based penetration schedules
 *
 * Different segments have different penetration curves:
 * - Mega: Highest penetration (large, sophisticated, early adopters)
 * - Strategic: High penetration
 * - Enterprise: Medium penetration
 * - Commercial: Lower penetration
 * - SmallBusiness: Lowest penetration (longer sales cycles, less resources)
 *
 * Multipliers applied to base rates:
 * - Mega: 1.5x
 * - Strategic: 1.25x
 * - Enterprise: 1.0x (base)
 * - Commercial: 0.75x
 * - SmallBusiness: 0.5x
 */
function generateDefaultSegmentPenetration() {
  const quarters = [
    '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4',
    '2027-Q1', '2027-Q2', '2027-Q3', '2027-Q4',
    '2028-Q1', '2028-Q2', '2028-Q3', '2028-Q4'
  ];

  // Base rates (same as Enterprise tier)
  const baseRates = {
    claudeCode: [0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.14, 0.16, 0.18, 0.20, 0.22, 0.25],
    claudeEnterprise: [0.01, 0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.14, 0.16, 0.17, 0.18, 0.20],
    agentsRunBusiness: [0, 0, 0, 0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.10],
    agentsGrowBusiness: [0, 0, 0, 0, 0, 0, 0, 0, 0.005, 0.01, 0.02, 0.05]
  };

  // Segment multipliers
  const segmentMultipliers = {
    Mega: 1.5,
    Strategic: 1.25,
    Enterprise: 1.0,
    Commercial: 0.75,
    SmallBusiness: 0.5
  };

  const createProductPenetration = (rates) => {
    const penetration = {};
    quarters.forEach((q, idx) => {
      penetration[q] = {
        target: Math.min(rates[idx], 1), // Cap at 100%
        actual: null,
        source: 'global',
        updatedAt: new Date()
      };
    });
    return penetration;
  };

  const createSegmentPenetration = (multiplier) => ({
    claudeCode: createProductPenetration(baseRates.claudeCode.map(r => r * multiplier)),
    claudeEnterprise: createProductPenetration(baseRates.claudeEnterprise.map(r => r * multiplier)),
    agentsRunBusiness: createProductPenetration(baseRates.agentsRunBusiness.map(r => r * multiplier)),
    agentsGrowBusiness: createProductPenetration(baseRates.agentsGrowBusiness.map(r => r * multiplier))
  });

  return {
    Mega: createSegmentPenetration(segmentMultipliers.Mega),
    Strategic: createSegmentPenetration(segmentMultipliers.Strategic),
    Enterprise: createSegmentPenetration(segmentMultipliers.Enterprise),
    Commercial: createSegmentPenetration(segmentMultipliers.Commercial),
    SmallBusiness: createSegmentPenetration(segmentMultipliers.SmallBusiness)
  };
}

/**
 * Helper: Generate default overall penetration schedule (legacy)
 * Weighted average of product penetrations
 */
function generateDefaultPenetration() {
  const quarters = [
    '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4',
    '2027-Q1', '2027-Q2', '2027-Q3', '2027-Q4',
    '2028-Q1', '2028-Q2', '2028-Q3', '2028-Q4'
  ];

  // Blended rates (will be calculated dynamically, but provide reasonable defaults)
  const blendedRates = [0.02, 0.03, 0.05, 0.07, 0.08, 0.10, 0.12, 0.14, 0.15, 0.17, 0.19, 0.22];

  const penetration = {};
  quarters.forEach((q, idx) => {
    penetration[q] = {
      target: blendedRates[idx],
      actual: null,
      source: 'global',
      updatedAt: new Date()
    };
  });

  return penetration;
}

/**
 * Helper: Merge assumptions with override priority
 */
function mergeAssumptions(global, specific) {
  if (!specific) return global;

  const merged = JSON.parse(JSON.stringify(global));

  for (const key of Object.keys(specific.toObject ? specific.toObject() : specific)) {
    if (specific[key] && specific[key].value !== undefined) {
      merged[key] = specific[key];
    } else if (typeof specific[key] === 'object' && specific[key] !== null) {
      // Nested object
      for (const subKey of Object.keys(specific[key])) {
        if (specific[key][subKey] && specific[key][subKey].value !== undefined) {
          if (!merged[key]) merged[key] = {};
          merged[key][subKey] = specific[key][subKey];
        }
      }
    }
  }

  return merged;
}

/**
 * Helper: Merge penetration with override priority
 */
function mergePenetration(global, specific) {
  if (!specific) return global;

  const merged = JSON.parse(JSON.stringify(global));

  for (const quarter of Object.keys(specific.toObject ? specific.toObject() : specific)) {
    if (specific[quarter] && (specific[quarter].target !== undefined || specific[quarter].actual !== undefined)) {
      merged[quarter] = { ...merged[quarter], ...specific[quarter] };
    }
  }

  return merged;
}

/**
 * Helper: Merge per-product penetration with override priority
 */
function mergeProductPenetration(global, specific) {
  if (!specific) return global;

  const merged = JSON.parse(JSON.stringify(global));
  const products = ['claudeCode', 'claudeEnterprise', 'agentsRunBusiness', 'agentsGrowBusiness'];

  for (const product of products) {
    if (specific[product]) {
      merged[product] = mergePenetration(merged[product] || {}, specific[product]);
    }
  }

  return merged;
}

/**
 * Helper: Transform updates to include source metadata
 */
function transformUpdates(updates, source, updatedBy, now) {
  const transformed = {};

  for (const [key, value] of Object.entries(updates)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (value.value !== undefined) {
        // Already in source format
        transformed[key] = {
          ...value,
          source: value.source || source,
          updatedAt: now,
          updatedBy
        };
      } else {
        // Nested object
        transformed[key] = {};
        for (const [subKey, subValue] of Object.entries(value)) {
          if (typeof subValue === 'object' && subValue !== null && subValue.value !== undefined) {
            transformed[key][subKey] = {
              ...subValue,
              source: subValue.source || source,
              updatedAt: now,
              updatedBy
            };
          } else if (typeof subValue === 'object' && subValue !== null) {
            // Could be quarterly penetration data
            transformed[key][subKey] = {};
            for (const [qKey, qValue] of Object.entries(subValue)) {
              if (typeof qValue === 'object' && qValue !== null) {
                transformed[key][subKey][qKey] = {
                  ...qValue,
                  source: qValue.source || source,
                  updatedAt: now,
                  updatedBy
                };
              } else {
                transformed[key][subKey][qKey] = {
                  target: qValue,
                  source,
                  updatedAt: now,
                  updatedBy
                };
              }
            }
          } else {
            transformed[key][subKey] = {
              value: subValue,
              source,
              updatedAt: now,
              updatedBy
            };
          }
        }
      }
    } else {
      transformed[key] = {
        value,
        source,
        updatedAt: now,
        updatedBy
      };
    }
  }

  return transformed;
}

module.exports = mongoose.model('TAMAssumptions', TAMAssumptionsSchema);
