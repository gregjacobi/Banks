import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  CircularProgress,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  PersonAdd as PersonAddIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  AutoAwesome as AutoAwesomeIcon
} from '@mui/icons-material';

/**
 * TeamCapacityPlanningTab - Hiring plan and team generation
 *
 * Focus on planning the team:
 * - HIRING PLAN - Set hires by quarter/segment, generates placeholder team members
 * - Generate Team functionality to create placeholders from plan
 * - View team roster (hired vs placeholders)
 */

const TIERS = ['Mega', 'Strategic', 'Enterprise', 'Commercial', 'SmallBusiness'];
const TIER_LABELS = {
  Mega: 'Mega Banks',
  Strategic: 'Strategic',
  Enterprise: 'Enterprise',
  Commercial: 'Commercial',
  SmallBusiness: 'Small Business'
};
const TIER_COLORS = {
  Mega: '#1a237e',
  Strategic: '#D97757',
  Enterprise: '#2e7d32',
  Commercial: '#7b1fa2',
  SmallBusiness: '#757575'
};

const QUARTERS = [
  '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4',
  '2027-Q1', '2027-Q2', '2027-Q3', '2027-Q4',
  '2028-Q1', '2028-Q2', '2028-Q3', '2028-Q4'
];

const QUARTER_LABELS = [
  "Q1'26", "Q2'26", "Q3'26", "Q4'26",
  "Q1'27", "Q2'27", "Q3'27", "Q4'27",
  "Q1'28", "Q2'28", "Q3'28", "Q4'28"
];

// Format currency
const fmt = (v) => {
  if (v === null || v === undefined) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const fmtNum = (v) => v?.toLocaleString() || '0';

// Format date nicely
const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Bank logo with text fallback
const BankLogo = ({ idrssd, bankName }) => {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: '#333', minWidth: 100, maxWidth: 150 }} title={bankName}>
        {bankName?.length > 20 ? bankName.substring(0, 20) + '...' : bankName}
      </Typography>
    );
  }

  return (
    <img
      src={`/api/research/${idrssd}/logo`}
      alt={bankName}
      title={bankName}
      style={{ height: '20px', maxWidth: '60px', objectFit: 'contain' }}
      onError={() => setImgError(true)}
    />
  );
};

// Member Detail Modal
function MemberDetailModal({ open, member, onClose, onSave, onDelete }) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (member) {
      setName(member.name || '');
      setStartDate(member.startDate ? new Date(member.startDate).toISOString().split('T')[0] : '');
      setNotes(member.notes || '');
    }
  }, [member]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(member._id, { name, startDate, notes });
    setSaving(false);
    onClose();
  };

  const handleMarkHired = async () => {
    setSaving(true);
    await onSave(member._id, { name, startDate, notes, markAsHired: true });
    setSaving(false);
    onClose();
  };

  if (!member) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{
          width: 32, height: 32, borderRadius: '50%',
          bgcolor: member.role === 'AE' ? '#D97757' : '#1976d2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: '0.75rem'
        }}>
          {member.role}
        </Box>
        <Box sx={{ flex: 1 }}>
          {member.isPlaceholder && !member.isHired ? (
            <Chip label="Placeholder" size="small" sx={{ bgcolor: '#fff3e0', color: '#ff9800', ml: 1 }} />
          ) : (
            <Chip label="Hired" size="small" sx={{ bgcolor: '#e8f5e9', color: '#4caf50', ml: 1 }} />
          )}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            helperText={member.placeholderName ? `Original placeholder: ${member.placeholderName}` : null}
          />
          <TextField
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            helperText={member.plannedStartQuarter ? `Planned quarter: ${member.plannedStartQuarter}` : null}
          />
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
          <Box sx={{ display: 'flex', gap: 2, pt: 1 }}>
            <Box sx={{ p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1, flex: 1 }}>
              <Typography sx={{ fontSize: '0.65rem', color: '#999', textTransform: 'uppercase' }}>Segment</Typography>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 500, color: TIER_COLORS[member.assignedTier] || '#666' }}>
                {TIER_LABELS[member.assignedTier] || 'Unassigned'}
              </Typography>
            </Box>
            <Box sx={{ p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1, flex: 1 }}>
              <Typography sx={{ fontSize: '0.65rem', color: '#999', textTransform: 'uppercase' }}>Role</Typography>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 500 }}>{member.role}</Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Box>
          {member.isPlaceholder && !member.isHired && (
            <Button
              onClick={handleMarkHired}
              disabled={saving}
              variant="contained"
              sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' } }}
              startIcon={<CheckIcon />}
            >
              Mark as Hired
            </Button>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} variant="contained" sx={{ bgcolor: '#D97757' }}>
            Save Changes
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}

// Add Existing Team Member Modal
function AddMemberModal({ open, onClose, onAdd }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('AE');
  const [tier, setTier] = useState('Strategic');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onAdd({ name, role, assignedTier: tier, startDate, notes, isHired: true });
    setSaving(false);
    setName('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Existing Team Member</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#666', mb: 0.5 }}>Role</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {['AE', 'SE'].map(r => (
                  <Button
                    key={r}
                    variant={role === r ? 'contained' : 'outlined'}
                    onClick={() => setRole(r)}
                    sx={{ flex: 1, bgcolor: role === r ? (r === 'AE' ? '#D97757' : '#1976d2') : 'transparent' }}
                  >
                    {r}
                  </Button>
                ))}
              </Box>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#666', mb: 0.5 }}>Segment</Typography>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                {TIERS.map(t => (
                  <option key={t} value={t}>{TIER_LABELS[t]}</option>
                ))}
              </select>
            </Box>
          </Box>
          <TextField
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleAdd} disabled={saving || !name.trim()} variant="contained" sx={{ bgcolor: '#D97757' }}>
          Add Team Member
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TeamCapacityPlanningTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rosterData, setRosterData] = useState(null);
  const [teamSizingData, setTeamSizingData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedPlan, setEditedPlan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rosterRes, teamRes] = await Promise.all([
        axios.get('/api/tam/roster'),
        axios.get('/api/tam/team-sizing?targetBankCount=50')
      ]);
      setRosterData(rosterRes.data);
      setTeamSizingData(teamRes.data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Parse hiring plan into editable format
  useEffect(() => {
    if (rosterData && !editedPlan) {
      const plan = {};
      for (const tier of TIERS) {
        plan[tier] = {};
        for (const q of QUARTERS) {
          const qPlan = rosterData.segmentHiringPlan?.find(p => p.quarter === q);
          plan[tier][q] = {
            aes: qPlan?.bySegment?.[tier]?.aes || 0,
            ses: qPlan?.bySegment?.[tier]?.ses || 0
          };
        }
      }
      setEditedPlan(plan);
    }
  }, [rosterData, editedPlan]);

  const handlePlanChange = (tier, quarter, role, value) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setEditedPlan(prev => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        [quarter]: {
          ...prev[tier][quarter],
          [role]: numValue
        }
      }
    }));
  };

  const savePlan = async () => {
    setSaving(true);
    try {
      const segmentHiringPlan = QUARTERS.map(q => ({
        quarter: q,
        bySegment: TIERS.reduce((acc, tier) => ({
          ...acc,
          [tier]: {
            aes: editedPlan[tier]?.[q]?.aes || 0,
            ses: editedPlan[tier]?.[q]?.ses || 0
          }
        }), {})
      }));

      await axios.put('/api/tam/roster/hiring-plan', { segmentHiringPlan });
      await fetchData();
      setEditMode(false);
    } catch (err) {
      console.error('Failed to save plan:', err);
    }
    setSaving(false);
  };

  const generatePlaceholders = async () => {
    setGenerating(true);
    try {
      await axios.post('/api/tam/roster/generate-placeholders');
      await fetchData();
    } catch (err) {
      console.error('Failed to generate placeholders:', err);
    }
    setGenerating(false);
  };

  const handleSaveMember = async (memberId, updates) => {
    try {
      if (updates.markAsHired) {
        await axios.put(`/api/tam/roster/members/${memberId}/hire`, {
          name: updates.name,
          startDate: updates.startDate,
          notes: updates.notes
        });
      } else {
        await axios.put(`/api/tam/roster/members/${memberId}`, updates);
      }
      await fetchData();
    } catch (err) {
      console.error('Failed to save member:', err);
    }
  };

  const handleAddMember = async (memberData) => {
    try {
      await axios.post('/api/tam/roster/members', memberData);
      await fetchData();
    } catch (err) {
      console.error('Failed to add member:', err);
    }
  };

  // Calculate totals from hiring plan - must be before early returns (hooks rules)
  const planTotals = useMemo(() => {
    if (!editedPlan) return { byQuarter: {}, byTier: {}, total: { aes: 0, ses: 0 } };

    const byQuarter = {};
    const byTier = {};
    let totalAEs = 0, totalSEs = 0;

    for (const tier of TIERS) {
      byTier[tier] = { aes: 0, ses: 0 };
      for (const q of QUARTERS) {
        if (!byQuarter[q]) byQuarter[q] = { aes: 0, ses: 0 };
        const aes = editedPlan[tier]?.[q]?.aes || 0;
        const ses = editedPlan[tier]?.[q]?.ses || 0;
        byQuarter[q].aes += aes;
        byQuarter[q].ses += ses;
        byTier[tier].aes += aes;
        byTier[tier].ses += ses;
        totalAEs += aes;
        totalSEs += ses;
      }
    }

    return { byQuarter, byTier, total: { aes: totalAEs, ses: totalSEs } };
  }, [editedPlan]);

  // Calculate dynamic gaps based on edited plan (recalculates as user types)
  const gapAnalysis = useMemo(() => {
    if (!rosterData || !editedPlan) return null;

    const targetBySegment = rosterData.targetBySegment || {};
    const currentBySegment = rosterData.currentBySegment || {};

    const bySegment = {};
    let totalGapAEs = 0, totalGapSEs = 0;
    let totalTargetAEs = 0, totalTargetSEs = 0;
    let totalCurrentAEs = 0, totalCurrentSEs = 0;
    let totalPlannedAEs = 0, totalPlannedSEs = 0;

    for (const tier of TIERS) {
      const target = targetBySegment[tier] || { aesNeeded: 0, sesNeeded: 0 };
      const current = currentBySegment[tier] || { aes: 0, ses: 0 };
      const planned = planTotals.byTier[tier] || { aes: 0, ses: 0 };

      const aesGap = Math.max(0, target.aesNeeded - current.aes - planned.aes);
      const sesGap = Math.max(0, target.sesNeeded - current.ses - planned.ses);

      bySegment[tier] = {
        target: { aes: target.aesNeeded, ses: target.sesNeeded },
        current: { aes: current.aes, ses: current.ses },
        planned: { aes: planned.aes, ses: planned.ses },
        gap: { aes: aesGap, ses: sesGap },
        bankCount: target.bankCount || 0,
        tam: target.tam || 0
      };

      totalTargetAEs += target.aesNeeded;
      totalTargetSEs += target.sesNeeded;
      totalCurrentAEs += current.aes;
      totalCurrentSEs += current.ses;
      totalPlannedAEs += planned.aes;
      totalPlannedSEs += planned.ses;
      totalGapAEs += aesGap;
      totalGapSEs += sesGap;
    }

    return {
      bySegment,
      totals: {
        target: { aes: totalTargetAEs, ses: totalTargetSEs },
        current: { aes: totalCurrentAEs, ses: totalCurrentSEs },
        planned: { aes: totalPlannedAEs, ses: totalPlannedSEs },
        gap: { aes: totalGapAEs, ses: totalGapSEs }
      }
    };
  }, [rosterData, editedPlan, planTotals]);

  if (loading && !rosterData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress sx={{ color: '#D97757' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error">Error: {error}</Typography>
        <Button onClick={fetchData} startIcon={<RefreshIcon />} sx={{ mt: 2 }}>Retry</Button>
      </Box>
    );
  }

  const members = rosterData?.members || [];
  const hiredMembers = members.filter(m => m.isHired && m.isActive);
  const placeholderMembers = members.filter(m => m.isPlaceholder && !m.isHired && m.isActive);

  return (
    <Box sx={{ p: 2 }}>
      {/* ===================== SECTION 1: HIRING PLAN ===================== */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, pb: 1, borderBottom: '2px solid #D97757' }}>
          <Box>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#1a1a1a' }}>
              Hiring Plan
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: '#666' }}>
              Plan hires by segment and quarter · Generates placeholder team members for coverage planning
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {editMode ? (
              <>
                <Button onClick={() => { setEditMode(false); setEditedPlan(null); }} disabled={saving}>Cancel</Button>
                <Button onClick={savePlan} disabled={saving} variant="contained" sx={{ bgcolor: '#D97757' }}>
                  {saving ? 'Saving...' : 'Save Plan'}
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setEditMode(true)} startIcon={<EditIcon />} variant="outlined" size="small">
                  Edit Plan
                </Button>
                <Button
                  onClick={generatePlaceholders}
                  disabled={generating}
                  startIcon={<AutoAwesomeIcon />}
                  variant="contained"
                  size="small"
                  sx={{ bgcolor: '#D97757' }}
                >
                  {generating ? 'Generating...' : 'Generate Team'}
                </Button>
              </>
            )}
          </Box>
        </Box>

        {/* Hiring Plan Grid with Target/Current/Gap columns */}
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
            <thead>
              <tr>
                <th style={{ padding: '8px', textAlign: 'left', fontSize: '0.75rem', color: '#666', backgroundColor: '#f5f5f5', width: 120 }}>Segment</th>
                <th style={{ padding: '8px', textAlign: 'center', fontSize: '0.75rem', color: '#666', backgroundColor: '#f5f5f5', width: 40 }}>Role</th>
                <th style={{ padding: '8px', textAlign: 'center', fontSize: '0.7rem', color: '#666', backgroundColor: '#e8e8e8', width: 55 }}>Target</th>
                <th style={{ padding: '8px', textAlign: 'center', fontSize: '0.7rem', color: '#666', backgroundColor: '#e8e8e8', width: 55 }}>Current</th>
                {QUARTER_LABELS.map((label, i) => (
                  <th key={i} style={{
                    padding: '4px',
                    textAlign: 'center',
                    fontSize: '0.6rem',
                    color: '#666',
                    backgroundColor: i < 4 ? '#e8f5e9' : i < 8 ? '#e3f2fd' : '#fff3e0',
                    minWidth: 42
                  }}>
                    {label}
                  </th>
                ))}
                <th style={{ padding: '8px', textAlign: 'center', fontSize: '0.7rem', color: '#666', backgroundColor: '#fff8f0', width: 55 }}>Planned</th>
                <th style={{ padding: '8px', textAlign: 'center', fontSize: '0.7rem', color: '#666', backgroundColor: '#ffebee', width: 55 }}>Gap</th>
              </tr>
            </thead>
            <tbody>
              {TIERS.map(tier => {
                const tierGap = gapAnalysis?.bySegment?.[tier] || {};
                return (
                <React.Fragment key={tier}>
                  {/* AE Row */}
                  <tr>
                    <td rowSpan={2} style={{
                      padding: '8px',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      color: TIER_COLORS[tier],
                      backgroundColor: '#fafafa',
                      borderBottom: '1px solid #e0e0e0',
                      verticalAlign: 'middle'
                    }}>
                      {TIER_LABELS[tier]}
                    </td>
                    <td style={{ padding: '4px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, color: '#D97757', backgroundColor: '#fafafa' }}>AE</td>
                    {/* Target AEs */}
                    <td style={{ padding: '4px', textAlign: 'center', backgroundColor: '#e8e8e8', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600 }}>
                      {tierGap.target?.aes || 0}
                    </td>
                    {/* Current AEs */}
                    <td style={{ padding: '4px', textAlign: 'center', backgroundColor: '#e8e8e8', fontFamily: 'monospace', fontSize: '0.75rem', color: '#4caf50' }}>
                      {tierGap.current?.aes || 0}
                    </td>
                    {QUARTERS.map((q, i) => (
                      <td key={q} style={{
                        padding: '2px',
                        textAlign: 'center',
                        backgroundColor: i < 4 ? '#f0faf0' : i < 8 ? '#f0f7ff' : '#fff8f0'
                      }}>
                        {editMode ? (
                          <input
                            type="number"
                            min="0"
                            value={editedPlan?.[tier]?.[q]?.aes || 0}
                            onChange={(e) => handlePlanChange(tier, q, 'aes', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px',
                              fontSize: '0.7rem',
                              textAlign: 'center',
                              border: '1px solid #e0e0e0',
                              borderRadius: 2,
                              boxSizing: 'border-box'
                            }}
                          />
                        ) : (
                          <Typography sx={{
                            fontSize: '0.7rem',
                            fontFamily: 'monospace',
                            color: (editedPlan?.[tier]?.[q]?.aes || 0) > 0 ? '#D97757' : '#ccc'
                          }}>
                            {editedPlan?.[tier]?.[q]?.aes || '—'}
                          </Typography>
                        )}
                      </td>
                    ))}
                    {/* Planned Total */}
                    <td style={{ padding: '4px', textAlign: 'center', backgroundColor: '#fff8f0', fontWeight: 600, fontSize: '0.75rem', color: '#D97757' }}>
                      {planTotals.byTier[tier]?.aes || 0}
                    </td>
                    {/* Gap */}
                    <td style={{
                      padding: '4px',
                      textAlign: 'center',
                      backgroundColor: tierGap.gap?.aes > 0 ? '#ffebee' : '#e8f5e9',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      color: tierGap.gap?.aes > 0 ? '#f44336' : '#4caf50'
                    }}>
                      {tierGap.gap?.aes > 0 ? `-${tierGap.gap.aes}` : '✓'}
                    </td>
                  </tr>
                  {/* SE Row */}
                  <tr style={{ borderBottom: '1px solid #e0e0e0' }}>
                    <td style={{ padding: '4px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, color: '#1976d2', backgroundColor: '#fafafa' }}>SE</td>
                    {/* Target SEs */}
                    <td style={{ padding: '4px', textAlign: 'center', backgroundColor: '#e8e8e8', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600 }}>
                      {tierGap.target?.ses || 0}
                    </td>
                    {/* Current SEs */}
                    <td style={{ padding: '4px', textAlign: 'center', backgroundColor: '#e8e8e8', fontFamily: 'monospace', fontSize: '0.75rem', color: '#4caf50' }}>
                      {tierGap.current?.ses || 0}
                    </td>
                    {QUARTERS.map((q, i) => (
                      <td key={q} style={{
                        padding: '2px',
                        textAlign: 'center',
                        backgroundColor: i < 4 ? '#f0faf0' : i < 8 ? '#f0f7ff' : '#fff8f0'
                      }}>
                        {editMode ? (
                          <input
                            type="number"
                            min="0"
                            value={editedPlan?.[tier]?.[q]?.ses || 0}
                            onChange={(e) => handlePlanChange(tier, q, 'ses', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px',
                              fontSize: '0.7rem',
                              textAlign: 'center',
                              border: '1px solid #e0e0e0',
                              borderRadius: 2,
                              boxSizing: 'border-box'
                            }}
                          />
                        ) : (
                          <Typography sx={{
                            fontSize: '0.7rem',
                            fontFamily: 'monospace',
                            color: (editedPlan?.[tier]?.[q]?.ses || 0) > 0 ? '#1976d2' : '#ccc'
                          }}>
                            {editedPlan?.[tier]?.[q]?.ses || '—'}
                          </Typography>
                        )}
                      </td>
                    ))}
                    {/* Planned Total */}
                    <td style={{ padding: '4px', textAlign: 'center', backgroundColor: '#fff8f0', fontWeight: 600, fontSize: '0.75rem', color: '#1976d2' }}>
                      {planTotals.byTier[tier]?.ses || 0}
                    </td>
                    {/* Gap */}
                    <td style={{
                      padding: '4px',
                      textAlign: 'center',
                      backgroundColor: tierGap.gap?.ses > 0 ? '#ffebee' : '#e8f5e9',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      color: tierGap.gap?.ses > 0 ? '#f44336' : '#4caf50'
                    }}>
                      {tierGap.gap?.ses > 0 ? `-${tierGap.gap.ses}` : '✓'}
                    </td>
                  </tr>
                </React.Fragment>
              );
              })}
              {/* Totals Row */}
              <tr style={{ backgroundColor: '#fff8f0', borderTop: '2px solid #D97757' }}>
                <td style={{ padding: '8px', fontWeight: 700, fontSize: '0.85rem' }}>TOTAL</td>
                <td></td>
                {/* Total Target */}
                <td style={{ padding: '4px', textAlign: 'center', backgroundColor: '#e0e0e0', fontWeight: 700, fontSize: '0.8rem' }}>
                  {gapAnalysis?.totals?.target?.aes + gapAnalysis?.totals?.target?.ses || 0}
                </td>
                {/* Total Current */}
                <td style={{ padding: '4px', textAlign: 'center', backgroundColor: '#e0e0e0', fontWeight: 700, fontSize: '0.8rem', color: '#4caf50' }}>
                  {gapAnalysis?.totals?.current?.aes + gapAnalysis?.totals?.current?.ses || 0}
                </td>
                {QUARTERS.map((q, i) => (
                  <td key={q} style={{ padding: '4px', textAlign: 'center', backgroundColor: i < 4 ? '#c8e6c9' : i < 8 ? '#bbdefb' : '#ffe0b2' }}>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 600 }}>
                      {(planTotals.byQuarter[q]?.aes || 0) + (planTotals.byQuarter[q]?.ses || 0) || '—'}
                    </Typography>
                  </td>
                ))}
                {/* Total Planned */}
                <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, fontSize: '0.9rem', color: '#D97757' }}>
                  {planTotals.total.aes + planTotals.total.ses}
                </td>
                {/* Total Gap */}
                <td style={{
                  padding: '8px',
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  backgroundColor: (gapAnalysis?.totals?.gap?.aes + gapAnalysis?.totals?.gap?.ses) > 0 ? '#ffcdd2' : '#c8e6c9',
                  color: (gapAnalysis?.totals?.gap?.aes + gapAnalysis?.totals?.gap?.ses) > 0 ? '#c62828' : '#2e7d32'
                }}>
                  {(gapAnalysis?.totals?.gap?.aes + gapAnalysis?.totals?.gap?.ses) > 0
                    ? `-${gapAnalysis?.totals?.gap?.aes + gapAnalysis?.totals?.gap?.ses}`
                    : '✓'}
                </td>
              </tr>
            </tbody>
          </table>
        </Box>

        {/* Summary chips */}
        <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip
            label={`${planTotals.total.aes} AEs planned`}
            sx={{ bgcolor: '#fff8f0', color: '#D97757', fontWeight: 600 }}
          />
          <Chip
            label={`${planTotals.total.ses} SEs planned`}
            sx={{ bgcolor: '#e3f2fd', color: '#1976d2', fontWeight: 600 }}
          />
          <Chip
            label={`${hiredMembers.length} hired`}
            sx={{ bgcolor: '#e8f5e9', color: '#4caf50', fontWeight: 600 }}
          />
          <Chip
            label={`${placeholderMembers.length} placeholders`}
            sx={{ bgcolor: '#fff3e0', color: '#ff9800', fontWeight: 600 }}
          />
        </Box>
      </Box>

      {/* ===================== SECTION 2: TEAM ROSTER ===================== */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, pb: 1, borderBottom: '2px solid #1976d2' }}>
          <Box>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#1a1a1a' }}>
              Team Roster
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: '#666' }}>
              Current team members · Click to edit details or mark as hired
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={() => setShowAddMember(true)}
              startIcon={<PersonAddIcon />}
              variant="outlined"
              size="small"
            >
              Add Existing Member
            </Button>
          </Box>
        </Box>

        {/* Team Members - Hired and Placeholders */}
        <Box sx={{ mb: 3 }}>

          {/* Hired Members */}
          {hiredMembers.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#4caf50', fontWeight: 600, mb: 1 }}>
                HIRED ({hiredMembers.length})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {hiredMembers.map(member => (
                  <Box
                    key={member._id}
                    onClick={() => setSelectedMember(member)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 1,
                      border: '1px solid #e0e0e0',
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: '#f5f5f5', borderColor: '#D97757' },
                      minWidth: 180
                    }}
                  >
                    <Box sx={{
                      width: 28, height: 28, borderRadius: '50%',
                      bgcolor: member.role === 'AE' ? '#D97757' : '#1976d2',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 700, fontSize: '0.65rem'
                    }}>
                      {member.role}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {member.name}
                      </Typography>
                      <Typography sx={{ fontSize: '0.65rem', color: TIER_COLORS[member.assignedTier] || '#999' }}>
                        {TIER_LABELS[member.assignedTier] || 'Unassigned'}
                      </Typography>
                    </Box>
                    <CheckIcon sx={{ fontSize: 14, color: '#4caf50' }} />
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Placeholder Members */}
          {placeholderMembers.length > 0 && (
            <Box>
              <Typography sx={{ fontSize: '0.75rem', color: '#ff9800', fontWeight: 600, mb: 1 }}>
                PLACEHOLDERS ({placeholderMembers.length}) — click to rename and mark as hired
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {placeholderMembers.map(member => (
                  <Box
                    key={member._id}
                    onClick={() => setSelectedMember(member)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 1,
                      border: '1px dashed #ff9800',
                      borderRadius: 1,
                      cursor: 'pointer',
                      bgcolor: '#fffaf0',
                      '&:hover': { bgcolor: '#fff3e0', borderStyle: 'solid' },
                      minWidth: 180
                    }}
                  >
                    <Box sx={{
                      width: 28, height: 28, borderRadius: '50%',
                      bgcolor: 'transparent',
                      border: `2px dashed ${member.role === 'AE' ? '#D97757' : '#1976d2'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: member.role === 'AE' ? '#D97757' : '#1976d2',
                      fontWeight: 700, fontSize: '0.65rem'
                    }}>
                      {member.role}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, fontStyle: 'italic', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {member.name}
                      </Typography>
                      <Typography sx={{ fontSize: '0.65rem', color: '#999' }}>
                        {member.plannedStartQuarter} · {TIER_LABELS[member.assignedTier] || 'Unassigned'}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {hiredMembers.length === 0 && placeholderMembers.length === 0 && (
            <Typography sx={{ fontSize: '0.85rem', color: '#999', fontStyle: 'italic', p: 2, textAlign: 'center', bgcolor: '#f5f5f5', borderRadius: 1 }}>
              No team members yet. Create a hiring plan above and click "Generate Team" to create placeholders.
            </Typography>
          )}
        </Box>

      </Box>

      {/* Modals */}
      <MemberDetailModal
        open={!!selectedMember}
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
        onSave={handleSaveMember}
      />
      <AddMemberModal
        open={showAddMember}
        onClose={() => setShowAddMember(false)}
        onAdd={handleAddMember}
      />
    </Box>
  );
}

export default TeamCapacityPlanningTab;
