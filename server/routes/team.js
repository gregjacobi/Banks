/**
 * Team Roster API Routes
 *
 * Endpoints for managing the sales team roster and hiring plan
 */

const express = require('express');
const router = express.Router();
const TeamRoster = require('../models/TeamRoster');

/**
 * GET /api/team
 * Get the global team roster
 */
router.get('/', async (req, res) => {
  try {
    const roster = await TeamRoster.getGlobalRoster();

    // Calculate current headcount
    const currentAEs = roster.members.filter(m => m.role === 'AE' && m.isActive).length;
    const currentSEs = roster.members.filter(m => m.role === 'SE' && m.isActive).length;

    // Get headcount timeline
    const headcountTimeline = roster.getHeadcountTimeline();

    res.json({
      members: roster.members,
      hiringPlan: roster.hiringPlan,
      assumptions: roster.assumptions,
      currentHeadcount: {
        aes: currentAEs,
        ses: currentSEs,
        total: currentAEs + currentSEs
      },
      headcountTimeline,
      updatedAt: roster.updatedAt
    });
  } catch (error) {
    console.error('Error fetching team roster:', error);
    res.status(500).json({ error: 'Failed to fetch team roster' });
  }
});

/**
 * POST /api/team/members
 * Add a new team member
 */
router.post('/members', async (req, res) => {
  try {
    const { name, role, startDate, assignedTier, assignedBankIdrssd, notes } = req.body;

    if (!name || !role) {
      return res.status(400).json({ error: 'Name and role are required' });
    }

    if (!['AE', 'SE'].includes(role)) {
      return res.status(400).json({ error: 'Role must be AE or SE' });
    }

    const roster = await TeamRoster.getGlobalRoster();

    roster.members.push({
      name,
      role,
      startDate: startDate || new Date(),
      assignedTier: assignedTier || null,
      assignedBankIdrssd: assignedBankIdrssd || null,
      notes: notes || '',
      isActive: true
    });

    roster.updatedAt = new Date();
    await roster.save();

    res.json({
      message: 'Team member added',
      member: roster.members[roster.members.length - 1],
      currentHeadcount: {
        aes: roster.members.filter(m => m.role === 'AE' && m.isActive).length,
        ses: roster.members.filter(m => m.role === 'SE' && m.isActive).length
      }
    });
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

/**
 * PUT /api/team/members/:memberId
 * Update a team member
 */
router.put('/members/:memberId', async (req, res) => {
  try {
    const { memberId } = req.params;
    const updates = req.body;

    const roster = await TeamRoster.getGlobalRoster();
    const member = roster.members.id(memberId);

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Update allowed fields
    if (updates.name !== undefined) member.name = updates.name;
    if (updates.role !== undefined) member.role = updates.role;
    if (updates.startDate !== undefined) member.startDate = updates.startDate;
    if (updates.assignedTier !== undefined) member.assignedTier = updates.assignedTier;
    if (updates.assignedBankIdrssd !== undefined) member.assignedBankIdrssd = updates.assignedBankIdrssd;
    if (updates.notes !== undefined) member.notes = updates.notes;
    if (updates.isActive !== undefined) member.isActive = updates.isActive;

    roster.updatedAt = new Date();
    await roster.save();

    res.json({ message: 'Team member updated', member });
  } catch (error) {
    console.error('Error updating team member:', error);
    res.status(500).json({ error: 'Failed to update team member' });
  }
});

/**
 * DELETE /api/team/members/:memberId
 * Remove a team member (or deactivate)
 */
router.delete('/members/:memberId', async (req, res) => {
  try {
    const { memberId } = req.params;
    const { permanent } = req.query;

    const roster = await TeamRoster.getGlobalRoster();
    const member = roster.members.id(memberId);

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    if (permanent === 'true') {
      roster.members.pull(memberId);
    } else {
      // Soft delete - just deactivate
      member.isActive = false;
    }

    roster.updatedAt = new Date();
    await roster.save();

    res.json({ message: permanent === 'true' ? 'Team member removed' : 'Team member deactivated' });
  } catch (error) {
    console.error('Error removing team member:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

/**
 * PUT /api/team/hiring-plan
 * Update the quarterly hiring plan
 */
router.put('/hiring-plan', async (req, res) => {
  try {
    const { hiringPlan } = req.body;

    if (!Array.isArray(hiringPlan)) {
      return res.status(400).json({ error: 'hiringPlan must be an array' });
    }

    const roster = await TeamRoster.getGlobalRoster();

    // Update each quarter in the plan
    for (const update of hiringPlan) {
      const existing = roster.hiringPlan.find(p => p.quarter === update.quarter);
      if (existing) {
        if (update.aesToHire !== undefined) existing.aesToHire = update.aesToHire;
        if (update.sesToHire !== undefined) existing.sesToHire = update.sesToHire;
        if (update.notes !== undefined) existing.notes = update.notes;
      }
    }

    roster.updatedAt = new Date();
    await roster.save();

    // Return updated timeline
    const headcountTimeline = roster.getHeadcountTimeline();

    res.json({
      message: 'Hiring plan updated',
      hiringPlan: roster.hiringPlan,
      headcountTimeline
    });
  } catch (error) {
    console.error('Error updating hiring plan:', error);
    res.status(500).json({ error: 'Failed to update hiring plan' });
  }
});

/**
 * PUT /api/team/assumptions
 * Update capacity assumptions
 */
router.put('/assumptions', async (req, res) => {
  try {
    const { reactiveCaptureRate, reactiveAccountsPerAE, reactiveAccountsPerSE } = req.body;

    const roster = await TeamRoster.getGlobalRoster();

    if (reactiveCaptureRate !== undefined) {
      roster.assumptions.reactiveCaptureRate = reactiveCaptureRate;
    }
    if (reactiveAccountsPerAE !== undefined) {
      roster.assumptions.reactiveAccountsPerAE = reactiveAccountsPerAE;
    }
    if (reactiveAccountsPerSE !== undefined) {
      roster.assumptions.reactiveAccountsPerSE = reactiveAccountsPerSE;
    }

    roster.updatedAt = new Date();
    await roster.save();

    res.json({
      message: 'Assumptions updated',
      assumptions: roster.assumptions
    });
  } catch (error) {
    console.error('Error updating assumptions:', error);
    res.status(500).json({ error: 'Failed to update assumptions' });
  }
});

/**
 * GET /api/team/capacity/:quarter
 * Get capacity analysis for a specific quarter
 */
router.get('/capacity/:quarter', async (req, res) => {
  try {
    const { quarter } = req.params;

    const roster = await TeamRoster.getGlobalRoster();
    const headcount = roster.getHeadcountAsOfQuarter(quarter);

    res.json({
      quarter,
      headcount,
      assumptions: roster.assumptions
    });
  } catch (error) {
    console.error('Error fetching capacity:', error);
    res.status(500).json({ error: 'Failed to fetch capacity' });
  }
});

module.exports = router;
