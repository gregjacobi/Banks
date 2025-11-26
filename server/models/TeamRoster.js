/**
 * Team Roster Model
 *
 * Stores the actual sales team roster (AEs and SEs) and hiring plan by segment
 * Used to calculate "ability to capture" based on actual capacity
 */

const mongoose = require('mongoose');

const TIERS = ['Mega', 'Strategic', 'Enterprise', 'Commercial', 'SmallBusiness'];
const QUARTERS = [
  '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4',
  '2027-Q1', '2027-Q2', '2027-Q3', '2027-Q4',
  '2028-Q1', '2028-Q2', '2028-Q3', '2028-Q4'
];

// Account assignment for a team member
const AccountAssignmentSchema = new mongoose.Schema({
  idrssd: { type: String, required: true },
  bankName: { type: String },
  tier: { type: String, enum: TIERS },
  tam: { type: Number, default: 0 },
  assignedAt: { type: Date, default: Date.now },
  // Share of this person's time (for people covering multiple accounts)
  allocationPct: { type: Number, default: 100, min: 0, max: 100 }
}, { _id: false });

// Individual team member schema
const TeamMemberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, enum: ['AE', 'SE'], required: true },
  startDate: { type: Date, default: Date.now },
  // Assigned segment/tier
  assignedTier: { type: String, enum: [...TIERS, null], default: null },
  // Legacy: single bank assignment (deprecated, use accountAssignments)
  assignedBankIdrssd: { type: String, default: null },
  // New: multiple account assignments
  accountAssignments: [AccountAssignmentSchema],
  notes: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  // For planned hires (not yet onboarded)
  isPlannedHire: { type: Boolean, default: false },
  plannedStartQuarter: { type: String, default: null },
  // Hiring status - true means actual person hired, false means placeholder
  isHired: { type: Boolean, default: true },
  // Whether this was auto-generated from hiring plan
  isPlaceholder: { type: Boolean, default: false },
  // Original placeholder name (for reference when renamed)
  placeholderName: { type: String, default: null }
}, { _id: true });

// Segment-based quarterly hiring plan
const SegmentHiringPlanSchema = new mongoose.Schema({
  quarter: { type: String, required: true }, // e.g., '2026-Q1'
  // Hires by segment
  bySegment: {
    Mega: { aes: { type: Number, default: 0 }, ses: { type: Number, default: 0 } },
    Strategic: { aes: { type: Number, default: 0 }, ses: { type: Number, default: 0 } },
    Enterprise: { aes: { type: Number, default: 0 }, ses: { type: Number, default: 0 } },
    Commercial: { aes: { type: Number, default: 0 }, ses: { type: Number, default: 0 } },
    SmallBusiness: { aes: { type: Number, default: 0 }, ses: { type: Number, default: 0 } }
  },
  notes: { type: String, default: '' }
}, { _id: false });

// Main team roster schema
const TeamRosterSchema = new mongoose.Schema({
  // There should only be one team roster document (singleton pattern)
  _id: { type: String, default: 'global' },

  // Current team members
  members: [TeamMemberSchema],

  // Segment-based quarterly hiring plan (2026-Q1 through 2028-Q4)
  segmentHiringPlan: [SegmentHiringPlanSchema],

  // Legacy: flat hiring plan (deprecated, kept for migration)
  hiringPlan: [{
    quarter: { type: String, required: true },
    aesToHire: { type: Number, default: 0 },
    sesToHire: { type: Number, default: 0 },
    notes: { type: String, default: '' }
  }],

  // Capacity assumptions
  assumptions: {
    // What % of revenue can be captured for accounts without dedicated coverage
    reactiveCaptureRate: { type: Number, default: 0.10 }, // 10%

    // How many accounts can an AE/SE handle per segment
    accountsPerAE: {
      Mega: { type: Number, default: 1 },        // 1:1 coverage for mega
      Strategic: { type: Number, default: 2 },   // 1:2 for strategic
      Enterprise: { type: Number, default: 5 },  // 1:5 for enterprise
      Commercial: { type: Number, default: 10 }, // 1:10 for commercial
      SmallBusiness: { type: Number, default: 25 } // 1:25 for small business
    },

    // Legacy (deprecated)
    reactiveAccountsPerAE: { type: Number, default: 20 },
    reactiveAccountsPerSE: { type: Number, default: 30 }
  },

  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: String, default: 'system' }
});

// Static method to get or create the global roster
TeamRosterSchema.statics.getGlobalRoster = async function() {
  let roster = await this.findById('global');

  if (!roster) {
    // Initialize with segment-based hiring plan
    const segmentHiringPlan = QUARTERS.map(q => ({
      quarter: q,
      bySegment: {
        Mega: { aes: 0, ses: 0 },
        Strategic: { aes: 0, ses: 0 },
        Enterprise: { aes: 0, ses: 0 },
        Commercial: { aes: 0, ses: 0 },
        SmallBusiness: { aes: 0, ses: 0 }
      }
    }));

    // Also create legacy format for backwards compatibility
    const hiringPlan = QUARTERS.map(q => ({ quarter: q, aesToHire: 0, sesToHire: 0 }));

    roster = await this.create({
      _id: 'global',
      members: [],
      segmentHiringPlan,
      hiringPlan,
      assumptions: {
        reactiveCaptureRate: 0.10,
        accountsPerAE: {
          Mega: 1,
          Strategic: 2,
          Enterprise: 5,
          Commercial: 10,
          SmallBusiness: 25
        },
        reactiveAccountsPerAE: 20,
        reactiveAccountsPerSE: 30
      }
    });
  }

  // Migration: ensure segmentHiringPlan exists
  if (!roster.segmentHiringPlan || roster.segmentHiringPlan.length === 0) {
    roster.segmentHiringPlan = QUARTERS.map(q => ({
      quarter: q,
      bySegment: {
        Mega: { aes: 0, ses: 0 },
        Strategic: { aes: 0, ses: 0 },
        Enterprise: { aes: 0, ses: 0 },
        Commercial: { aes: 0, ses: 0 },
        SmallBusiness: { aes: 0, ses: 0 }
      }
    }));
    await roster.save();
  }

  // Migration: ensure accountsPerAE exists
  if (!roster.assumptions.accountsPerAE) {
    roster.assumptions.accountsPerAE = {
      Mega: 1,
      Strategic: 2,
      Enterprise: 5,
      Commercial: 10,
      SmallBusiness: 25
    };
    await roster.save();
  }

  return roster;
};

// Get total hires for a quarter (sum across all segments)
TeamRosterSchema.methods.getTotalHiresForQuarter = function(quarter) {
  const plan = this.segmentHiringPlan.find(p => p.quarter === quarter);
  if (!plan) return { aes: 0, ses: 0 };

  let totalAEs = 0, totalSEs = 0;
  for (const tier of TIERS) {
    totalAEs += plan.bySegment[tier]?.aes || 0;
    totalSEs += plan.bySegment[tier]?.ses || 0;
  }
  return { aes: totalAEs, ses: totalSEs };
};

// Get hires by segment for a quarter
TeamRosterSchema.methods.getHiresBySegmentForQuarter = function(quarter) {
  const plan = this.segmentHiringPlan.find(p => p.quarter === quarter);
  if (!plan) {
    return TIERS.reduce((acc, t) => ({ ...acc, [t]: { aes: 0, ses: 0 } }), {});
  }
  return plan.bySegment;
};

// Method to get headcount as of a specific quarter
TeamRosterSchema.methods.getHeadcountAsOfQuarter = function(targetQuarter) {
  const targetIndex = QUARTERS.indexOf(targetQuarter);
  if (targetIndex === -1) return { aes: 0, ses: 0, total: 0, bySegment: {} };

  // Start with current active members
  const activeMembers = this.members.filter(m => m.isActive && !m.isPlannedHire);
  let aes = activeMembers.filter(m => m.role === 'AE').length;
  let ses = activeMembers.filter(m => m.role === 'SE').length;

  // Track by segment
  const bySegment = {};
  for (const tier of TIERS) {
    bySegment[tier] = {
      aes: activeMembers.filter(m => m.role === 'AE' && m.assignedTier === tier).length,
      ses: activeMembers.filter(m => m.role === 'SE' && m.assignedTier === tier).length
    };
  }

  // Add hires up to and including target quarter
  for (let i = 0; i <= targetIndex; i++) {
    const q = QUARTERS[i];
    const hires = this.getTotalHiresForQuarter(q);
    aes += hires.aes;
    ses += hires.ses;

    // Add by segment
    const segmentHires = this.getHiresBySegmentForQuarter(q);
    for (const tier of TIERS) {
      bySegment[tier].aes += segmentHires[tier]?.aes || 0;
      bySegment[tier].ses += segmentHires[tier]?.ses || 0;
    }
  }

  return { aes, ses, total: aes + ses, bySegment };
};

// Method to get cumulative headcount by quarter for the entire horizon
TeamRosterSchema.methods.getHeadcountTimeline = function() {
  const timeline = {};

  // Start with current active members
  const activeMembers = this.members.filter(m => m.isActive && !m.isPlannedHire);
  let aes = activeMembers.filter(m => m.role === 'AE').length;
  let ses = activeMembers.filter(m => m.role === 'SE').length;

  for (const q of QUARTERS) {
    const hires = this.getTotalHiresForQuarter(q);
    aes += hires.aes;
    ses += hires.ses;
    timeline[q] = { aes, ses, total: aes + ses };
  }

  return timeline;
};

// Get headcount by segment timeline
TeamRosterSchema.methods.getHeadcountBySegmentTimeline = function() {
  const timeline = {};

  // Start with current active members by segment
  const activeMembers = this.members.filter(m => m.isActive && !m.isPlannedHire);
  const bySegment = {};
  for (const tier of TIERS) {
    bySegment[tier] = {
      aes: activeMembers.filter(m => m.role === 'AE' && m.assignedTier === tier).length,
      ses: activeMembers.filter(m => m.role === 'SE' && m.assignedTier === tier).length
    };
  }

  for (const q of QUARTERS) {
    const segmentHires = this.getHiresBySegmentForQuarter(q);
    for (const tier of TIERS) {
      bySegment[tier].aes += segmentHires[tier]?.aes || 0;
      bySegment[tier].ses += segmentHires[tier]?.ses || 0;
    }
    timeline[q] = JSON.parse(JSON.stringify(bySegment)); // Deep copy
  }

  return timeline;
};

/**
 * Get effective capacity by quarter accounting for hiring ramp
 *
 * New hires start mid-quarter and take time to become productive.
 * The ramp schedule is controlled by the rampQuarters parameter:
 * - Quarter 0 (hire quarter): 0% productive
 * - Quarter 1 to rampQuarters-1: Linear ramp (e.g., 50% at Q1 if rampQuarters=2)
 * - Quarter rampQuarters+: 100% productive
 *
 * Default rampQuarters=2: Q0=0%, Q1=50%, Q2+=100%
 *
 * @param {number} rampQuarters - Number of quarters until fully productive (default: 2)
 */
TeamRosterSchema.methods.getEffectiveCapacityTimeline = function(rampQuarters = 2) {
  // Track hires by quarter and segment
  const hiresByQuarter = {};
  for (const q of QUARTERS) {
    hiresByQuarter[q] = this.getHiresBySegmentForQuarter(q);
  }

  // Start with current active members (they're already productive)
  const activeMembers = this.members.filter(m => m.isActive && !m.isPlannedHire);
  const currentAEs = activeMembers.filter(m => m.role === 'AE').length;
  const currentSEs = activeMembers.filter(m => m.role === 'SE').length;

  const timeline = {};

  for (let i = 0; i < QUARTERS.length; i++) {
    const q = QUARTERS[i];

    // Start with current (already productive) team
    let effectiveAEs = currentAEs;
    let effectiveSEs = currentSEs;
    let totalAEs = currentAEs;
    let totalSEs = currentSEs;

    // Track by segment
    const bySegment = {};
    for (const tier of TIERS) {
      bySegment[tier] = {
        totalAEs: activeMembers.filter(m => m.role === 'AE' && m.assignedTier === tier).length,
        totalSEs: activeMembers.filter(m => m.role === 'SE' && m.assignedTier === tier).length,
        effectiveAEs: activeMembers.filter(m => m.role === 'AE' && m.assignedTier === tier).length,
        effectiveSEs: activeMembers.filter(m => m.role === 'SE' && m.assignedTier === tier).length
      };
    }

    // Add contribution from hires in previous quarters
    for (let j = 0; j <= i; j++) {
      const hireQuarter = QUARTERS[j];
      const hires = hiresByQuarter[hireQuarter];

      // Calculate quarters since hire
      const quartersSinceHire = i - j;

      // Productivity ramp
      let productivity = 0;
      if (quartersSinceHire === 0) {
        productivity = 0;
      } else if (quartersSinceHire >= rampQuarters) {
        productivity = 1.0;
      } else {
        productivity = quartersSinceHire / rampQuarters;
      }

      // Add by segment
      for (const tier of TIERS) {
        const segmentHires = hires[tier] || { aes: 0, ses: 0 };
        totalAEs += segmentHires.aes;
        totalSEs += segmentHires.ses;
        effectiveAEs += segmentHires.aes * productivity;
        effectiveSEs += segmentHires.ses * productivity;

        bySegment[tier].totalAEs += segmentHires.aes;
        bySegment[tier].totalSEs += segmentHires.ses;
        bySegment[tier].effectiveAEs += segmentHires.aes * productivity;
        bySegment[tier].effectiveSEs += segmentHires.ses * productivity;
      }
    }

    // Get new hires for this quarter
    const thisQuarterHires = hiresByQuarter[q];
    let newHiresAE = 0, newHiresSE = 0;
    for (const tier of TIERS) {
      newHiresAE += thisQuarterHires[tier]?.aes || 0;
      newHiresSE += thisQuarterHires[tier]?.ses || 0;
    }

    timeline[q] = {
      totalAEs: Math.round(totalAEs),
      totalSEs: Math.round(totalSEs),
      totalHeadcount: Math.round(totalAEs + totalSEs),
      effectiveAEs: Math.round(effectiveAEs * 100) / 100,
      effectiveSEs: Math.round(effectiveSEs * 100) / 100,
      effectiveHeadcount: Math.round((effectiveAEs + effectiveSEs) * 100) / 100,
      aeUtilization: totalAEs > 0 ? Math.round((effectiveAEs / totalAEs) * 100) / 100 : 1,
      seUtilization: totalSEs > 0 ? Math.round((effectiveSEs / totalSEs) * 100) / 100 : 1,
      newHiresAE,
      newHiresSE,
      bySegment
    };
  }

  return timeline;
};

/**
 * Get member's account assignments with bank details
 */
TeamRosterSchema.methods.getMemberAssignments = function(memberId) {
  const member = this.members.id(memberId);
  if (!member) return null;

  return {
    member: {
      id: member._id,
      name: member.name,
      role: member.role,
      assignedTier: member.assignedTier
    },
    assignments: member.accountAssignments || [],
    // Legacy single assignment
    legacyAssignment: member.assignedBankIdrssd
  };
};

/**
 * Assign a member to accounts
 */
TeamRosterSchema.methods.assignMemberToAccounts = async function(memberId, assignments) {
  const member = this.members.id(memberId);
  if (!member) throw new Error('Member not found');

  member.accountAssignments = assignments.map(a => ({
    idrssd: a.idrssd,
    bankName: a.bankName,
    tier: a.tier,
    tam: a.tam,
    allocationPct: a.allocationPct || 100
  }));

  this.updatedAt = new Date();
  await this.save();
  return member;
};

module.exports = mongoose.model('TeamRoster', TeamRosterSchema);
