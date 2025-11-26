import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  CircularProgress,
  Button,
  TextField,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Restore as RestoreIcon
} from '@mui/icons-material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts';

/**
 * TAMDetailTab - Bank-specific TAM analysis
 * Design: Match global TAM dashboard with edit capabilities
 */

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

const PRODUCTS = [
  { key: 'claudeCode', label: 'Code', fullLabel: 'Claude Code', color: '#D97757' },
  { key: 'claudeEnterprise', label: 'Enterprise', fullLabel: 'Claude Enterprise', color: '#E8A090' },
  { key: 'agentsRunBusiness', label: 'Run', fullLabel: 'Agents Run Business', color: '#1976d2' },
  { key: 'agentsGrowBusiness', label: 'Grow', fullLabel: 'Agents Grow Business', color: '#64b5f6' }
];

// Format currency compactly
const fmt = (v) => {
  if (v === null || v === undefined) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const fmtNum = (v) => v?.toLocaleString('en-US', { maximumFractionDigits: 0 }) || '—';
const fmtPct = (v) => v ? `${(v * 100).toFixed(0)}%` : '—';
const getValue = (obj) => obj?.value !== undefined ? obj.value : obj;

// Tufte sparkline - word-sized graphic
const Sparkline = ({ data, width = 80, height = 20, color = '#D97757' }) => {
  if (!data || data.length === 0) return null;
  const vals = data.filter(d => d !== null && d !== undefined);
  if (vals.length === 0) return null;

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;

  const points = data
    .map((d, i) => {
      if (d === null || d === undefined) return null;
      const x = (i / (data.length - 1)) * width;
      const y = height - 2 - ((d - min) / range) * (height - 4);
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(' ');

  const lastVal = vals[vals.length - 1];
  const lastX = width;
  const lastY = height - 2 - ((lastVal - min) / range) * (height - 4);

  return (
    <svg width={width + 4} height={height} style={{ verticalAlign: 'middle' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
      <circle cx={lastX} cy={lastY} r="2" fill={color} />
    </svg>
  );
};

// Format assets - converts from thousands (as stored in DB) to actual dollars
const fmtAssets = (v) => fmt(v * 1000);

// Tier color helper (asset-based tiers)
const getTierColor = (tier) => {
  switch (tier) {
    case 'Mega': return { bg: '#1a237e', text: '#fff' };
    case 'Strategic': return { bg: '#D97757', text: '#fff' };
    case 'Enterprise': return { bg: '#2e7d32', text: '#fff' };
    case 'Commercial': return { bg: '#1976d2', text: '#fff' };
    case 'SmallBusiness': return { bg: '#9e9e9e', text: '#fff' };
    default: return { bg: '#e0e0e0', text: '#666' };
  }
};

// Tier descriptions for context
const getTierDescription = (tier) => {
  switch (tier) {
    case 'Mega': return '>$1T assets';
    case 'Strategic': return '>$100B assets';
    case 'Enterprise': return '>$30B assets';
    case 'Commercial': return '>$10B assets';
    case 'SmallBusiness': return '<$10B assets';
    default: return '';
  }
};

// Coverage donut/ring chart
const CoverageRing = ({ covered, total, size = 100 }) => {
  const pct = total > 0 ? covered / total : 0;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f0f0f0" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#D97757" strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
        <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#D97757', lineHeight: 1 }}>{fmtPct(pct)}</Typography>
        <Typography sx={{ fontSize: '0.55rem', color: '#666' }}>3-yr pen</Typography>
      </Box>
    </Box>
  );
};

// Horizontal stacked bar
const StackedBar = ({ data, height = 12 }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <Box sx={{ height, bgcolor: '#f0f0f0', borderRadius: 0.5 }} />;

  return (
    <Box sx={{ display: 'flex', height, borderRadius: 0.5, overflow: 'hidden' }}>
      {data.map((d, i) => {
        const pct = (d.value / total) * 100;
        return pct > 0 ? (
          <Box
            key={i}
            sx={{ width: `${pct}%`, bgcolor: d.color }}
            title={`${d.label}: ${fmt(d.value)} (${pct.toFixed(0)}%)`}
          />
        ) : null;
      })}
    </Box>
  );
};

function TAMDetailTab({ idrssd, bankName }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tamData, setTamData] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [globalAssumptions, setGlobalAssumptions] = useState(null);
  const [showWorksheet, setShowWorksheet] = useState(true);
  const [showPenetration, setShowPenetration] = useState(false);
  const [showResourced, setShowResourced] = useState(true);

  // Edit state
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedAssumptions, setEditedAssumptions] = useState(null);
  const [editedPenetration, setEditedPenetration] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tamRes, teamRes, globalRes] = await Promise.all([
        axios.get(`/api/tam/banks/${idrssd}`),
        axios.get('/api/team'),
        axios.get('/api/tam/global')
      ]);
      setTamData(tamRes.data);
      setTeamData(teamRes.data);
      setGlobalAssumptions(globalRes.data);
      setEditedAssumptions(null);
      setEditedPenetration(null);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Get team members assigned to this bank (check accountAssignments array)
  const assignedMembers = useMemo(() => {
    if (!teamData?.members) return { aes: [], ses: [] };
    // Check both legacy assignedBankIdrssd field AND new accountAssignments array
    const members = teamData.members.filter(m => {
      if (!m.isActive) return false;
      // Check legacy field
      if (m.assignedBankIdrssd === idrssd || m.assignedBankIdrssd === String(idrssd)) return true;
      // Check new accountAssignments array
      if (m.accountAssignments?.some(a => a.idrssd === idrssd || a.idrssd === String(idrssd))) return true;
      return false;
    });
    return {
      aes: members.filter(m => m.role === 'AE'),
      ses: members.filter(m => m.role === 'SE')
    };
  }, [teamData, idrssd]);

  // Calculate team capacity and "Resourced to Win" by quarter
  // Resourced to Win = (Team Capacity / Account TAM) × Winnable RRR
  // - Team Capacity = Number of AEs × TAM per AE for the tier
  // - If no AEs assigned, use reactive capture rate instead
  const capacityAnalysis = useMemo(() => {
    if (!tamData || !globalAssumptions || !teamData) return null;

    const tier = tamData.tier;
    const tam = tamData.tam;
    const accountTAM = tam.total || 0;
    const penetrationByProduct = tamData.penetrationByProduct || {};

    // Get TAM per AE for this tier (in millions)
    const teamSizing = globalAssumptions.teamSizing || {};
    const tamPerAEMillions = getValue(teamSizing[`tamPerAE_${tier}`]) ||
      (tier === 'Mega' ? 1000 : tier === 'Strategic' ? 500 : tier === 'Enterprise' ? 300 : 200);
    const tamPerAE = tamPerAEMillions * 1000000; // Convert to dollars

    // Reactive capture rate (for accounts with no coverage)
    const reactiveCaptureRate = teamData.assumptions?.reactiveCaptureRate || 0.10;

    // Number of AEs assigned
    const numAEs = assignedMembers.aes.length;

    // Total TAM capacity based on team (what TAM size the team can handle)
    const teamTAMCapacity = numAEs * tamPerAE;

    // Coverage ratio: what % of the account TAM can the team handle?
    // Capped at 100% - can't capture more than 100% of winnable
    const coverageRatio = accountTAM > 0 ? Math.min(1, teamTAMCapacity / accountTAM) : 0;

    // Calculate by quarter
    const quarterlyAnalysis = {};

    QUARTERS.forEach(q => {
      // Calculate winnable for this quarter (sum of all products)
      let winnableQuarterly = 0;
      const byProduct = {};

      PRODUCTS.forEach(p => {
        const annualTAM = tam[p.key] || 0;
        const pen = penetrationByProduct[p.key]?.[q]?.target || 0;
        const quarterlyWinnable = (annualTAM / 4) * pen;
        winnableQuarterly += quarterlyWinnable;
        byProduct[p.key] = {
          annualTAM,
          penetration: pen,
          winnable: quarterlyWinnable
        };
      });

      // Resourced to Win calculation:
      // - If AEs assigned: capture rate = coverage ratio (team capacity / account TAM)
      // - If no AEs: capture rate = reactive rate
      const captureRate = numAEs > 0 ? coverageRatio : reactiveCaptureRate;
      const resourcedToWin = winnableQuarterly * captureRate;

      // For display purposes, break down covered vs uncovered portions
      const coveredByTeam = numAEs > 0 ? winnableQuarterly * coverageRatio : 0;
      const uncoveredWinnable = numAEs > 0 ? winnableQuarterly * (1 - coverageRatio) : winnableQuarterly;
      const reactiveRevenue = numAEs > 0 ? 0 : winnableQuarterly * reactiveCaptureRate; // Only applies if no AEs

      // Coverage status
      const coverageStatus = numAEs === 0 ? 'reactive'
        : coverageRatio >= 1 ? 'fully-covered'
        : 'partially-covered';

      quarterlyAnalysis[q] = {
        winnable: winnableQuarterly,
        byProduct,
        teamCapacity: teamTAMCapacity / 4, // Quarterly capacity (for display)
        coveredByTeam,
        uncoveredWinnable,
        reactiveRevenue,
        resourcedToWin,
        coverageStatus,
        captureRate
      };
    });

    return {
      tier,
      tamPerAE,
      tamPerAEMillions,
      numAEs,
      teamTAMCapacity,
      accountTAM,
      coverageRatio,
      reactiveCaptureRate,
      quarterly: quarterlyAnalysis
    };
  }, [tamData, globalAssumptions, teamData, assignedMembers]);

  useEffect(() => {
    if (idrssd) fetchData();
  }, [idrssd]);

  // Initialize edit state when entering edit mode
  const handleEnterEditMode = () => {
    const a = tamData?.assumptions || {};
    setEditedAssumptions({
      claudeCode: {
        pricePerMonth: getValue(a?.claudeCode?.pricePerMonth) || 150,
        fteEligibilityRate: getValue(a?.claudeCode?.fteEligibilityRate) || 0.15
      },
      claudeEnterprise: {
        pricePerMonth: getValue(a?.claudeEnterprise?.pricePerMonth) || 35,
        adoptionRate: getValue(a?.claudeEnterprise?.adoptionRate) || 1.0
      },
      agentsRunBusiness: {
        agentsPerEmployee: getValue(a?.agentsRunBusiness?.agentsPerEmployee) || 5,
        pricePerAgentMonth: getValue(a?.agentsRunBusiness?.pricePerAgentMonth) || 1000
      },
      agentsGrowBusiness: {
        revenueFromAgents: getValue(a?.agentsGrowBusiness?.revenueFromAgents) || 0.30,
        anthropicShare: getValue(a?.agentsGrowBusiness?.anthropicShare) || 0.20
      }
    });

    // Initialize penetration from current data
    const pp = tamData?.penetrationByProduct || {};
    const initPen = {};
    PRODUCTS.forEach(p => {
      initPen[p.key] = {};
      QUARTERS.forEach(q => {
        initPen[p.key][q] = (pp[p.key]?.[q]?.target || 0) * 100;
      });
    });
    setEditedPenetration(initPen);
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditedAssumptions(null);
    setEditedPenetration(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Convert penetration back to decimal
      const penetrationByProduct = {};
      PRODUCTS.forEach(p => {
        penetrationByProduct[p.key] = {};
        QUARTERS.forEach(q => {
          penetrationByProduct[p.key][q] = {
            target: (editedPenetration?.[p.key]?.[q] || 0) / 100
          };
        });
      });

      // Save both assumptions and penetration in a single call
      await axios.put(`/api/tam/banks/${idrssd}/assumptions`, {
        assumptions: editedAssumptions,
        penetrationByProduct,
        source: 'human',
        updatedBy: 'user'
      });

      await fetchData();
      setEditMode(false);
      setSaving(false);
    } catch (err) {
      console.error('Error saving assumptions:', err);
      setSaving(false);
    }
  };

  const handleResetToGlobal = async () => {
    if (!window.confirm('Reset all bank-specific assumptions to global defaults?')) return;
    try {
      setSaving(true);
      await axios.delete(`/api/tam/banks/${idrssd}/assumptions`);
      await fetchData();
      setEditMode(false);
      setSaving(false);
    } catch (err) {
      console.error('Error resetting assumptions:', err);
      setSaving(false);
    }
  };

  const handleAssumptionChange = (category, field, value) => {
    setEditedAssumptions(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: parseFloat(value) || 0
      }
    }));
  };

  const handlePenetrationChange = (product, quarter, value) => {
    setEditedPenetration(prev => ({
      ...prev,
      [product]: {
        ...prev[product],
        [quarter]: parseFloat(value) || 0
      }
    }));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
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

  const fte = tamData?.inputs?.fte || 0;
  const netIncome = (tamData?.inputs?.netIncome || 0) * 1000;
  // Annual revenue from Q4 (full-year cumulative) - already in actual dollars from API
  const annualRevenue = tamData?.inputs?.annualRevenue || 0;
  const annualRevenueSource = tamData?.inputs?.annualRevenueSource || 'Unknown';
  const totalAssets = tamData?.totalAssets || 0;
  const tam = tamData?.tam || {};
  const quarterlyRevenue = tamData?.quarterlyRevenue || {};
  const penetrationByProduct = tamData?.penetrationByProduct || {};
  const assumptions = tamData?.assumptions || {};
  const tier = tamData?.coverage?.tier || 'SmallBusiness';
  const tierColors = getTierColor(tier);

  // Calculate by product and year
  const getQuarterTotal = (q) => {
    return (quarterlyRevenue[q]?.claudeCode?.revenue || 0) +
      (quarterlyRevenue[q]?.claudeEnterprise?.revenue || 0) +
      (quarterlyRevenue[q]?.agentsRunBusiness?.revenue || 0) +
      (quarterlyRevenue[q]?.agentsGrowBusiness?.revenue || 0);
  };

  const getProductYear = (product, yearStart, yearEnd) => {
    return QUARTERS.slice(yearStart, yearEnd).reduce((sum, q) =>
      sum + (quarterlyRevenue[q]?.[product]?.revenue || 0), 0);
  };

  // Quarterly totals
  const quarterlyTotals = QUARTERS.map(q => getQuarterTotal(q));

  // 3-Year cumulative winnable (sum of all 12 quarters - actual revenue over the period)
  const cum3 = quarterlyTotals.reduce((s, v) => s + v, 0);

  // Year-end RRR (Q4 annualized) - this is the primary metric we display
  const rrr2026 = (quarterlyTotals[3] || 0) * 4;
  const rrr2027 = (quarterlyTotals[7] || 0) * 4;
  const rrr2028 = (quarterlyTotals[11] || 0) * 4;

  // Products by year for Tufte table - shows Q4 RRR (annualized) per product
  const productsByYear = [
    { year: 'Y1', label: '2026', q4Quarter: '2026-Q4' },
    { year: 'Y2', label: '2027', q4Quarter: '2027-Q4' },
    { year: 'Y3', label: '2028', q4Quarter: '2028-Q4' }
  ].map(y => {
    const byProduct = {};
    PRODUCTS.forEach(p => {
      // Q4 RRR = Q4 quarterly revenue × 4 (annualized)
      byProduct[p.key] = (quarterlyRevenue[y.q4Quarter]?.[p.key]?.revenue || 0) * 4;
    });
    byProduct.total = getQuarterTotal(y.q4Quarter) * 4;
    return { ...y, ...byProduct };
  });

  // Assumption values for worksheet
  const ccPrice = editMode ? editedAssumptions?.claudeCode?.pricePerMonth : getValue(assumptions?.claudeCode?.pricePerMonth) || 150;
  const ccDevRate = editMode ? editedAssumptions?.claudeCode?.fteEligibilityRate : getValue(assumptions?.claudeCode?.fteEligibilityRate) || 0.15;
  const cePrice = editMode ? editedAssumptions?.claudeEnterprise?.pricePerMonth : getValue(assumptions?.claudeEnterprise?.pricePerMonth) || 35;
  const ceAdoptRate = editMode ? editedAssumptions?.claudeEnterprise?.adoptionRate : getValue(assumptions?.claudeEnterprise?.adoptionRate) || 1.0;
  const arAgentsPerEmp = editMode ? editedAssumptions?.agentsRunBusiness?.agentsPerEmployee : getValue(assumptions?.agentsRunBusiness?.agentsPerEmployee) || 5;
  const arPricePerAgent = editMode ? editedAssumptions?.agentsRunBusiness?.pricePerAgentMonth : getValue(assumptions?.agentsRunBusiness?.pricePerAgentMonth) || 1000;
  const agRevShare = editMode ? editedAssumptions?.agentsGrowBusiness?.revenueFromAgents : getValue(assumptions?.agentsGrowBusiness?.revenueFromAgents) || 0.30;
  const agAnthropicShare = editMode ? editedAssumptions?.agentsGrowBusiness?.anthropicShare : getValue(assumptions?.agentsGrowBusiness?.anthropicShare) || 0.20;

  const developerCount = Math.round(fte * ccDevRate);
  const enterpriseSeats = Math.round(fte * ceAdoptRate);
  const totalAgents = Math.round(fte * arAgentsPerEmp);

  // Calculate 3-year average penetration
  const avgPenetration = tam.total > 0 ? cum3 / (tam.total * 3) : 0;

  return (
    <Box sx={{ p: 2, maxWidth: 1400 }}>
      {/* Header with Edit Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, pb: 2, borderBottom: '1px solid #e0e0e0' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 600, color: '#1a1a1a' }}>
              {bankName}
            </Typography>
            <Box
              sx={{
                px: 1.5,
                py: 0.25,
                borderRadius: 1,
                bgcolor: tierColors.bg,
                color: tierColors.text,
                fontSize: '0.7rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.03em'
              }}
            >
              {tier}
            </Box>
            {!tamData?.isGlobalOnly && (
              <Box sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: '#4caf50', color: '#fff', fontSize: '0.65rem', fontWeight: 600 }}>
                CUSTOM
              </Box>
            )}
            {/* Assigned Team Members */}
            {(assignedMembers.aes.length > 0 || assignedMembers.ses.length > 0) && (
              <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                {assignedMembers.aes.map(m => (
                  <Tooltip key={m._id} title={`AE: ${m.name}`} arrow>
                    <Box sx={{
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      bgcolor: '#D97757',
                      color: '#fff',
                      fontSize: '0.6rem',
                      fontWeight: 600,
                      cursor: 'default'
                    }}>
                      {m.name.split(' ').map(n => n[0]).join('')}
                    </Box>
                  </Tooltip>
                ))}
                {assignedMembers.ses.map(m => (
                  <Tooltip key={m._id} title={`SE: ${m.name}`} arrow>
                    <Box sx={{
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      bgcolor: '#1976d2',
                      color: '#fff',
                      fontSize: '0.6rem',
                      fontWeight: 600,
                      cursor: 'default'
                    }}>
                      {m.name.split(' ').map(n => n[0]).join('')}
                    </Box>
                  </Tooltip>
                ))}
              </Box>
            )}
          </Box>
          <Typography sx={{ fontSize: '0.8rem', color: '#666' }}>
            {fmtAssets(totalAssets)} total assets · {fmtNum(fte)} employees · {fmt(annualRevenue)} annual revenue ({annualRevenueSource})
            {(assignedMembers.aes.length > 0 || assignedMembers.ses.length > 0) && (
              <span style={{ color: '#1976d2', marginLeft: 8 }}>
                · Assigned: {assignedMembers.aes.map(m => m.name).concat(assignedMembers.ses.map(m => m.name)).join(', ')}
              </span>
            )}
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: '#999', mt: 0.5 }}>
            {getTierDescription(tier)} · {tamData?.coverage?.recommendation || ''}
          </Typography>
        </Box>

        {/* Edit Controls */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {editMode ? (
            <>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CloseIcon />}
                onClick={handleCancelEdit}
                disabled={saving}
                sx={{ borderColor: '#999', color: '#666' }}
              >
                Cancel
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RestoreIcon />}
                onClick={handleResetToGlobal}
                disabled={saving}
                sx={{ borderColor: '#ff9800', color: '#ff9800' }}
              >
                Reset to Global
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={saving}
                sx={{ bgcolor: '#D97757', '&:hover': { bgcolor: '#c86747' } }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditIcon />}
              onClick={handleEnterEditMode}
              sx={{ borderColor: '#D97757', color: '#D97757' }}
            >
              Edit Assumptions
            </Button>
          )}
        </Box>
      </Box>

      {/* Hero Summary - All Years at Once (like Global TAM Pipeline) */}
      <Box sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: '#fff' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          {/* Annual TAM */}
          <Box sx={{ textAlign: 'center', flex: 1, px: 2, py: 1.5, bgcolor: '#fff8f0', borderRadius: 1, border: '2px solid #D97757' }}>
            <Typography sx={{ fontSize: '0.65rem', color: '#D97757', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Annual TAM</Typography>
            <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: '#D97757', lineHeight: 1 }}>{fmt(tam.total)}</Typography>
            <Typography sx={{ fontSize: '0.6rem', color: '#666' }}>100% penetration</Typography>
          </Box>

          <Box sx={{ px: 1, color: '#D97757', fontSize: '1.5rem' }}>›</Box>

          {/* Winnable RRR by Year - All 3 Years Visible */}
          {/* Note: Winnable RRR = Q4 quarterly winnable × 4 (annualized run rate at year end) */}
          <Box sx={{ flex: 2.5, display: 'flex', gap: 1 }}>
            {[
              { year: '2026', q4Quarter: '2026-Q4', winnable: rrr2026, color: '#4caf50', bgColor: '#e8f5e9' },
              { year: '2027', q4Quarter: '2027-Q4', winnable: rrr2027, color: '#2196f3', bgColor: '#e3f2fd' },
              { year: '2028', q4Quarter: '2028-Q4', winnable: rrr2028, color: '#D97757', bgColor: '#fff3e0', highlight: true }
            ].map(({ year, q4Quarter, winnable, color, bgColor, highlight }) => {
              // Winnable RRR penetration (Q4 penetration, since winnable is Q4 × 4)
              const pen = tam.total > 0 ? winnable / tam.total : 0;

              // Calculate Resourced to Win (capacity-adjusted)
              // Use Q4 quarterly analysis and annualize
              const q4Analysis = capacityAnalysis?.quarterly?.[q4Quarter];
              const resourcedToWin = q4Analysis ? q4Analysis.resourcedToWin * 4 : winnable;
              const captureRate = winnable > 0 ? resourcedToWin / winnable : 1;

              return (
                <Box
                  key={year}
                  sx={{
                    flex: 1,
                    p: 1.5,
                    bgcolor: bgColor,
                    borderRadius: 1,
                    border: highlight ? `2px solid ${color}` : '1px solid #e0e0e0'
                  }}
                >
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color, textAlign: 'center', mb: 1 }}>{year}</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.55rem', color: '#999', textTransform: 'uppercase' }}>Winnable RRR</Typography>
                      <Typography sx={{ fontSize: '1rem', fontWeight: 500, color: '#666', lineHeight: 1.1 }}>{fmt(winnable)}</Typography>
                      <Typography sx={{ fontSize: '0.55rem', color: '#999' }}>{fmtPct(pen)} of TAM</Typography>
                    </Box>
                    <Box sx={{ borderTop: '1px dashed #ccc', pt: 0.5 }}>
                      <Typography sx={{ fontSize: '0.55rem', color, textTransform: 'uppercase', fontWeight: 600 }}>Resourced to Win</Typography>
                      <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color, lineHeight: 1.1 }}>{fmt(resourcedToWin)}</Typography>
                      {capacityAnalysis && captureRate < 1 && (
                        <Typography sx={{ fontSize: '0.5rem', color: '#999' }}>{(captureRate * 100).toFixed(0)}% capture</Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* 3-Year Total Summary */}
        <Box sx={{ pt: 2, borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Typography sx={{ fontSize: '0.7rem', color: '#666' }}>
              <strong>3-Year Winnable:</strong> {fmt(cum3)}
            </Typography>
            {capacityAnalysis && (
              <Typography sx={{ fontSize: '0.7rem', color: '#D97757' }}>
                <strong>3-Year Resourced:</strong> {fmt(
                  QUARTERS.reduce((sum, q) => sum + (capacityAnalysis.quarterly[q]?.resourcedToWin || 0), 0)
                )}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {(assignedMembers.aes.length > 0 || assignedMembers.ses.length > 0) ? (
              <Typography sx={{ fontSize: '0.7rem', color: '#4caf50' }}>
                Covered: {assignedMembers.aes.length} AE, {assignedMembers.ses.length} SE
              </Typography>
            ) : (
              <Typography sx={{ fontSize: '0.7rem', color: '#f44336' }}>
                No coverage assigned
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      {/* Stacked Area Charts */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mb: 4 }}>
        {/* Quarterly Revenue by Product Chart */}
        <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 2, color: '#333' }}>
            Quarterly Revenue by Product
          </Typography>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart
              data={QUARTERS.map((q, i) => ({
                quarter: QUARTER_LABELS[i],
                claudeCode: quarterlyRevenue[q]?.claudeCode?.revenue || 0,
                claudeEnterprise: quarterlyRevenue[q]?.claudeEnterprise?.revenue || 0,
                agentsRunBusiness: quarterlyRevenue[q]?.agentsRunBusiness?.revenue || 0,
                agentsGrowBusiness: quarterlyRevenue[q]?.agentsGrowBusiness?.revenue || 0
              }))}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <XAxis dataKey="quarter" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#e0e0e0' }} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(v)} width={50} />
              <RechartsTooltip formatter={(value, name) => { const labels = { claudeCode: 'Claude Code', claudeEnterprise: 'Enterprise', agentsRunBusiness: 'Run', agentsGrowBusiness: 'Grow' }; return [fmt(value), labels[name] || name]; }} contentStyle={{ fontSize: '0.75rem' }} />
              <Area type="monotone" dataKey="claudeCode" stackId="1" stroke="#D97757" fill="#D97757" fillOpacity={1} />
              <Area type="monotone" dataKey="claudeEnterprise" stackId="1" stroke="#E8A090" fill="#E8A090" fillOpacity={1} />
              <Area type="monotone" dataKey="agentsRunBusiness" stackId="1" stroke="#1976d2" fill="#1976d2" fillOpacity={1} />
              <Area type="monotone" dataKey="agentsGrowBusiness" stackId="1" stroke="#64b5f6" fill="#64b5f6" fillOpacity={1} />
            </AreaChart>
          </ResponsiveContainer>
          <Box sx={{ display: 'flex', gap: 2, mt: 1, justifyContent: 'center' }}>
            {PRODUCTS.map(p => (
              <Typography key={p.key} sx={{ fontSize: '0.6rem', color: '#666' }}>
                <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, bgcolor: p.color, mr: 0.5, verticalAlign: 'middle' }} />{p.label}
              </Typography>
            ))}
          </Box>
        </Box>

        {/* RRR Chart */}
        <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 2, color: '#333' }}>
            Run Rate Revenue (Annualized)
          </Typography>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart
              data={QUARTERS.map((q, i) => ({
                quarter: QUARTER_LABELS[i],
                rrr: getQuarterTotal(q) * 4,
                tam: tam.total
              }))}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <XAxis dataKey="quarter" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#e0e0e0' }} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(v)} width={50} />
              <RechartsTooltip formatter={(value, name) => [fmt(value), name === 'rrr' ? 'RRR' : 'TAM']} contentStyle={{ fontSize: '0.75rem' }} />
              <Area type="monotone" dataKey="tam" stroke="#f0f0f0" fill="#f0f0f0" fillOpacity={0.5} />
              <Area type="monotone" dataKey="rrr" stroke="#D97757" fill="#D97757" fillOpacity={0.8} />
            </AreaChart>
          </ResponsiveContainer>
          <Box sx={{ display: 'flex', gap: 2, mt: 1, justifyContent: 'center' }}>
            <Typography sx={{ fontSize: '0.6rem', color: '#666' }}><Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, bgcolor: '#D97757', mr: 0.5, verticalAlign: 'middle' }} />RRR</Typography>
            <Typography sx={{ fontSize: '0.6rem', color: '#666' }}><Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, bgcolor: '#f0f0f0', mr: 0.5, verticalAlign: 'middle' }} />TAM</Typography>
          </Box>
        </Box>
      </Box>

      {/* Product Breakdown - Tufte Style Y1/Y2/Y3 RRR */}
      <Box sx={{ p: 2, mb: 4, border: '1px solid #e0e0e0', borderRadius: 1 }}>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.5, color: '#333' }}>Winnable RRR by Product</Typography>
        <Typography sx={{ fontSize: '0.65rem', color: '#666', mb: 2 }}>Year-end run rate revenue (Q4 annualized) by product line</Typography>
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#666' }}>Product</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#666', width: 100 }}>TAM</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#4caf50', width: 100 }}>2026 RRR</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#2196f3', width: 100 }}>2027 RRR</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#D97757', width: 100 }}>2028 RRR</th>
              </tr>
            </thead>
            <tbody>
              {PRODUCTS.map(p => (
                <tr key={p.key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, bgcolor: p.color, borderRadius: '2px' }} />
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 500 }}>{p.fullLabel}</Typography>
                    </Box>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', color: '#666' }}>{fmt(tam[p.key])}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', color: '#4caf50' }}>{fmt(productsByYear[0]?.[p.key])}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', color: '#2196f3' }}>{fmt(productsByYear[1]?.[p.key])}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', color: '#D97757' }}>{fmt(productsByYear[2]?.[p.key])}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #333', bgcolor: '#fafafa' }}>
                <td style={{ padding: '10px 12px', fontWeight: 700 }}>TOTAL</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 700 }}>{fmt(tam.total)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 700, color: '#4caf50' }}>{fmt(rrr2026)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 700, color: '#2196f3' }}>{fmt(rrr2027)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 700, color: '#D97757' }}>{fmt(rrr2028)}</td>
              </tr>
            </tbody>
          </table>
        </Box>
      </Box>

      {/* TAM Calculation Worksheet */}
      <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, mb: 3 }}>
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, cursor: 'pointer', bgcolor: '#fafafa', borderBottom: showWorksheet ? '1px solid #e0e0e0' : 'none' }}
          onClick={() => setShowWorksheet(!showWorksheet)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {showWorksheet ? <ExpandLessIcon sx={{ fontSize: 18, color: '#666', mr: 1 }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: '#666', mr: 1 }} />}
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#333' }}>TAM Calculation Worksheet</Typography>
          </Box>
          {editMode && <Typography sx={{ fontSize: '0.7rem', color: '#D97757' }}>Editing enabled</Typography>}
        </Box>

        {showWorksheet && (
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 3 }}>
              {/* Claude Code */}
              <Box sx={{ p: 2, bgcolor: PRODUCTS[0].color + '08', borderLeft: `3px solid ${PRODUCTS[0].color}` }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: PRODUCTS[0].color, mb: 1 }}>Claude Code</Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
                  {editMode ? (
                    <>
                      <TextField
                        label="$/Month"
                        type="number"
                        size="small"
                        value={editedAssumptions?.claudeCode?.pricePerMonth || 150}
                        onChange={(e) => handleAssumptionChange('claudeCode', 'pricePerMonth', e.target.value)}
                        sx={{ width: 100 }}
                        InputProps={{ startAdornment: '$' }}
                      />
                      <TextField
                        label="% Developers"
                        type="number"
                        size="small"
                        value={((editedAssumptions?.claudeCode?.fteEligibilityRate || 0.15) * 100).toFixed(0)}
                        onChange={(e) => handleAssumptionChange('claudeCode', 'fteEligibilityRate', parseFloat(e.target.value) / 100)}
                        sx={{ width: 100 }}
                        InputProps={{ endAdornment: '%' }}
                      />
                    </>
                  ) : (
                    <Typography sx={{ fontSize: '0.8rem', color: '#666' }}>
                      {fmtNum(fte)} FTE × {(ccDevRate*100).toFixed(0)}% dev = <strong>{fmtNum(developerCount)}</strong> × ${ccPrice}/mo × 12
                    </Typography>
                  )}
                </Box>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: PRODUCTS[0].color }}>= {fmt(tam.claudeCode)}/yr</Typography>
              </Box>

              {/* Claude Enterprise */}
              <Box sx={{ p: 2, bgcolor: PRODUCTS[1].color + '08', borderLeft: `3px solid ${PRODUCTS[1].color}` }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#c77a6a', mb: 1 }}>Claude Enterprise</Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
                  {editMode ? (
                    <>
                      <TextField
                        label="$/Month"
                        type="number"
                        size="small"
                        value={editedAssumptions?.claudeEnterprise?.pricePerMonth || 35}
                        onChange={(e) => handleAssumptionChange('claudeEnterprise', 'pricePerMonth', e.target.value)}
                        sx={{ width: 100 }}
                        InputProps={{ startAdornment: '$' }}
                      />
                      <TextField
                        label="Adoption %"
                        type="number"
                        size="small"
                        value={((editedAssumptions?.claudeEnterprise?.adoptionRate || 1.0) * 100).toFixed(0)}
                        onChange={(e) => handleAssumptionChange('claudeEnterprise', 'adoptionRate', parseFloat(e.target.value) / 100)}
                        sx={{ width: 100 }}
                        InputProps={{ endAdornment: '%' }}
                      />
                    </>
                  ) : (
                    <Typography sx={{ fontSize: '0.8rem', color: '#666' }}>
                      {fmtNum(fte)} FTE × {(ceAdoptRate*100).toFixed(0)}% = <strong>{fmtNum(enterpriseSeats)}</strong> × ${cePrice}/mo × 12
                    </Typography>
                  )}
                </Box>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#c77a6a' }}>= {fmt(tam.claudeEnterprise)}/yr</Typography>
              </Box>

              {/* Agents Run Business */}
              <Box sx={{ p: 2, bgcolor: PRODUCTS[2].color + '08', borderLeft: `3px solid ${PRODUCTS[2].color}` }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: PRODUCTS[2].color, mb: 1 }}>Agents Run Business</Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
                  {editMode ? (
                    <>
                      <TextField
                        label="Agents/Emp"
                        type="number"
                        size="small"
                        value={editedAssumptions?.agentsRunBusiness?.agentsPerEmployee || 5}
                        onChange={(e) => handleAssumptionChange('agentsRunBusiness', 'agentsPerEmployee', e.target.value)}
                        sx={{ width: 100 }}
                      />
                      <TextField
                        label="$/Agent/Mo"
                        type="number"
                        size="small"
                        value={editedAssumptions?.agentsRunBusiness?.pricePerAgentMonth || 1000}
                        onChange={(e) => handleAssumptionChange('agentsRunBusiness', 'pricePerAgentMonth', e.target.value)}
                        sx={{ width: 100 }}
                        InputProps={{ startAdornment: '$' }}
                      />
                    </>
                  ) : (
                    <Typography sx={{ fontSize: '0.8rem', color: '#666' }}>
                      {fmtNum(fte)} FTE × {arAgentsPerEmp} agents = <strong>{fmtNum(totalAgents)}</strong> × ${fmtNum(arPricePerAgent)}/mo × 12
                    </Typography>
                  )}
                </Box>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: PRODUCTS[2].color }}>= {fmt(tam.agentsRunBusiness)}/yr</Typography>
              </Box>

              {/* Agents Grow Business */}
              <Box sx={{ p: 2, bgcolor: PRODUCTS[3].color + '08', borderLeft: `3px solid ${PRODUCTS[3].color}` }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#3b8bc9', mb: 1 }}>Agents Grow Business</Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
                  {editMode ? (
                    <>
                      <TextField
                        label="% Revenue"
                        type="number"
                        size="small"
                        value={((editedAssumptions?.agentsGrowBusiness?.revenueFromAgents || 0.30) * 100).toFixed(0)}
                        onChange={(e) => handleAssumptionChange('agentsGrowBusiness', 'revenueFromAgents', parseFloat(e.target.value) / 100)}
                        sx={{ width: 100 }}
                        InputProps={{ endAdornment: '%' }}
                      />
                      <TextField
                        label="Anthropic Share"
                        type="number"
                        size="small"
                        value={((editedAssumptions?.agentsGrowBusiness?.anthropicShare || 0.20) * 100).toFixed(0)}
                        onChange={(e) => handleAssumptionChange('agentsGrowBusiness', 'anthropicShare', parseFloat(e.target.value) / 100)}
                        sx={{ width: 100 }}
                        InputProps={{ endAdornment: '%' }}
                      />
                    </>
                  ) : (
                    <Typography sx={{ fontSize: '0.8rem', color: '#666' }}>
                      {fmt(annualRevenue)} Rev × {(agRevShare*100).toFixed(0)}% agents × {(agAnthropicShare*100).toFixed(0)}% share
                    </Typography>
                  )}
                </Box>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#3b8bc9' }}>= {fmt(tam.agentsGrowBusiness)}/yr</Typography>
              </Box>
            </Box>

            {/* Total TAM */}
            <Box sx={{ mt: 2, p: 2, bgcolor: '#fff8f0', borderTop: '2px solid #D97757', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>TOTAL ANNUAL TAM</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '1.5rem', color: '#D97757' }}>{fmt(tam.total)}</Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Penetration Schedule & Winnable Calculation */}
      <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, mb: 3 }}>
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, cursor: 'pointer', bgcolor: '#fafafa', borderBottom: showPenetration ? '1px solid #e0e0e0' : 'none' }}
          onClick={() => setShowPenetration(!showPenetration)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {showPenetration ? <ExpandLessIcon sx={{ fontSize: 18, color: '#666', mr: 1 }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: '#666', mr: 1 }} />}
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#333' }}>Winnable RRR Calculation by Product</Typography>
          </Box>
          <Typography sx={{ fontSize: '0.7rem', color: '#666' }}>
            {tamData?.isGlobalOnly ? `Using ${tier} segment defaults` : 'Bank-specific overrides'}
          </Typography>
        </Box>

        {showPenetration && (
          <Box sx={{ overflowX: 'auto', p: 2 }}>
            {/* Formula explanation */}
            <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography sx={{ fontSize: '0.7rem', color: '#666' }}>
                <strong>Winnable RRR</strong> = Annual TAM × Penetration % (annualized run rate at each quarter's penetration level)
              </Typography>
            </Box>

            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', color: '#666', backgroundColor: '#f5f5f5', width: 140 }}>Product</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: '0.75rem', color: '#666', backgroundColor: '#f5f5f5', width: 80 }}>Annual TAM</th>
                  {QUARTER_LABELS.map((label, i) => (
                    <th key={i} style={{ padding: '4px', textAlign: 'center', fontWeight: 600, fontSize: '0.65rem', color: '#666', backgroundColor: i < 4 ? '#e8f5e9' : i < 8 ? '#e3f2fd' : '#fff3e0', minWidth: 60 }}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PRODUCTS.map(product => {
                  const annualTAM = tam[product.key] || 0;
                  return (
                    <React.Fragment key={product.key}>
                      {/* Penetration % Row */}
                      <tr>
                        <td rowSpan={2} style={{ padding: '8px 12px', fontWeight: 600, fontSize: '0.8rem', color: product.color, backgroundColor: '#fafafa', borderBottom: '1px solid #e0e0e0', verticalAlign: 'middle' }}>
                          {product.fullLabel}
                        </td>
                        <td rowSpan={2} style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#333', backgroundColor: '#fafafa', borderBottom: '1px solid #e0e0e0', textAlign: 'right', verticalAlign: 'middle' }}>
                          {fmt(annualTAM)}
                        </td>
                        {QUARTERS.map((q, i) => {
                          const pen = penetrationByProduct[product.key]?.[q]?.target || 0;
                          return (
                            <td key={`${q}-pen`} style={{ padding: '2px', textAlign: 'center', backgroundColor: i < 4 ? '#f0faf0' : i < 8 ? '#f0f7ff' : '#fff8f0', borderBottom: 'none' }}>
                              {editMode ? (
                                <input
                                  type="number"
                                  step="0.1"
                                  value={(editedPenetration?.[product.key]?.[q] || 0).toFixed(1)}
                                  onChange={(e) => handlePenetrationChange(product.key, q, e.target.value)}
                                  style={{ width: '100%', padding: '2px', fontSize: '0.65rem', fontFamily: 'monospace', textAlign: 'center', border: '1px solid #e0e0e0', borderRadius: 2, boxSizing: 'border-box' }}
                                />
                              ) : (
                                <Typography sx={{ fontSize: '0.6rem', color: '#999' }}>
                                  {(pen * 100).toFixed(0)}%
                                </Typography>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      {/* Winnable RRR Row (annualized) */}
                      <tr>
                        {QUARTERS.map((q, i) => {
                          const pen = penetrationByProduct[product.key]?.[q]?.target || 0;
                          const winnableRRR = (annualTAM / 4) * pen * 4; // Annualized RRR
                          return (
                            <td key={`${q}-win`} style={{ padding: '2px', textAlign: 'center', backgroundColor: i < 4 ? '#e8f5e9' : i < 8 ? '#e3f2fd' : '#fff3e0', borderBottom: '1px solid #e0e0e0' }}>
                              <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: product.color, fontWeight: 500 }}>
                                {winnableRRR > 0 ? fmt(winnableRRR) : '—'}
                              </Typography>
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                })}
                {/* Total Row */}
                <tr style={{ backgroundColor: '#fff8f0' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, fontSize: '0.8rem', color: '#D97757' }}>Total Winnable RRR</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#D97757', textAlign: 'right', fontWeight: 600 }}>
                    {fmt(tam.total)}
                  </td>
                  {QUARTERS.map((q, i) => {
                    const totalWinnableRRR = PRODUCTS.reduce((sum, p) => {
                      const pen = penetrationByProduct[p.key]?.[q]?.target || 0;
                      return sum + ((tam[p.key] || 0) / 4) * pen * 4; // Annualized RRR
                    }, 0);
                    return (
                      <td key={q} style={{ padding: '4px', textAlign: 'center', backgroundColor: i < 4 ? '#c8e6c9' : i < 8 ? '#bbdefb' : '#ffe0b2' }}>
                        <Typography sx={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#D97757', fontWeight: 700 }}>
                          {totalWinnableRRR > 0 ? fmt(totalWinnableRRR) : '—'}
                        </Typography>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </Box>
        )}
      </Box>

      {/* Resourced to Win Calculation */}
      {capacityAnalysis && (
        <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, mb: 3 }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, cursor: 'pointer', bgcolor: '#fafafa', borderBottom: showResourced ? '1px solid #e0e0e0' : 'none' }}
            onClick={() => setShowResourced(!showResourced)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {showResourced ? <ExpandLessIcon sx={{ fontSize: 18, color: '#666', mr: 1 }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: '#666', mr: 1 }} />}
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#333' }}>Resourced to Win Calculation</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {capacityAnalysis.numAEs > 0 ? (
                <Typography sx={{ fontSize: '0.7rem', color: '#4caf50' }}>
                  {capacityAnalysis.numAEs} AE{capacityAnalysis.numAEs > 1 ? 's' : ''} assigned
                </Typography>
              ) : (
                <Typography sx={{ fontSize: '0.7rem', color: '#f44336' }}>
                  No coverage (reactive only)
                </Typography>
              )}
            </Box>
          </Box>

          {showResourced && (
            <Box sx={{ p: 2 }}>
              {/* Team Capacity Summary */}
              <Box sx={{ mb: 3, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2 }}>
                {/* Tier & TAM per AE */}
                <Box sx={{ p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography sx={{ fontSize: '0.6rem', color: '#666', textTransform: 'uppercase' }}>Segment</Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: '#333' }}>{capacityAnalysis.tier}</Typography>
                  <Typography sx={{ fontSize: '0.6rem', color: '#999' }}>
                    ${capacityAnalysis.tamPerAEMillions}M TAM/AE
                  </Typography>
                </Box>

                {/* Team Assigned */}
                <Box sx={{ p: 1.5, bgcolor: capacityAnalysis.numAEs > 0 ? '#e8f5e9' : '#ffebee', borderRadius: 1 }}>
                  <Typography sx={{ fontSize: '0.6rem', color: '#666', textTransform: 'uppercase' }}>Team Assigned</Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: capacityAnalysis.numAEs > 0 ? '#4caf50' : '#f44336' }}>
                    {capacityAnalysis.numAEs} AE{capacityAnalysis.numAEs !== 1 ? 's' : ''}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6rem', color: '#999' }}>
                    {assignedMembers.aes.map(m => m.name).join(', ') || 'None'}
                  </Typography>
                </Box>

                {/* Team TAM Capacity */}
                <Box sx={{ p: 1.5, bgcolor: '#e3f2fd', borderRadius: 1 }}>
                  <Typography sx={{ fontSize: '0.6rem', color: '#666', textTransform: 'uppercase' }}>Team TAM Capacity</Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: '#2196f3' }}>
                    {fmt(capacityAnalysis.teamTAMCapacity)}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6rem', color: '#999' }}>
                    {capacityAnalysis.numAEs} × ${capacityAnalysis.tamPerAEMillions}M
                  </Typography>
                </Box>

                {/* Bank Total TAM */}
                <Box sx={{ p: 1.5, bgcolor: '#fff8f0', borderRadius: 1 }}>
                  <Typography sx={{ fontSize: '0.6rem', color: '#666', textTransform: 'uppercase' }}>Account TAM</Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: '#D97757' }}>
                    {fmt(capacityAnalysis.accountTAM)}
                  </Typography>
                </Box>

                {/* Coverage Ratio / Capture Rate */}
                <Box sx={{ p: 1.5, bgcolor: capacityAnalysis.numAEs > 0 ? '#e8f5e9' : '#fff3e0', borderRadius: 1, borderLeft: `3px solid ${capacityAnalysis.numAEs > 0 ? '#4caf50' : '#ff9800'}` }}>
                  <Typography sx={{ fontSize: '0.6rem', color: '#666', textTransform: 'uppercase' }}>
                    {capacityAnalysis.numAEs > 0 ? 'Coverage Ratio' : 'Reactive Rate'}
                  </Typography>
                  <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: capacityAnalysis.numAEs > 0 ? '#4caf50' : '#ff9800' }}>
                    {capacityAnalysis.numAEs > 0
                      ? `${(capacityAnalysis.coverageRatio * 100).toFixed(1)}%`
                      : `${(capacityAnalysis.reactiveCaptureRate * 100).toFixed(0)}%`}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6rem', color: '#999' }}>
                    {capacityAnalysis.numAEs > 0
                      ? `${fmt(capacityAnalysis.teamTAMCapacity)} / ${fmt(capacityAnalysis.accountTAM)}`
                      : 'No AE assigned'}
                  </Typography>
                </Box>
              </Box>

              {/* Formula explanation */}
              <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography sx={{ fontSize: '0.7rem', color: '#666' }}>
                  <strong>Resourced to Win</strong> = Winnable RRR × Coverage Ratio
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: '#999', mt: 0.5 }}>
                  {capacityAnalysis.numAEs > 0
                    ? `Coverage Ratio = Team TAM Capacity / Account TAM = ${fmt(capacityAnalysis.teamTAMCapacity)} / ${fmt(capacityAnalysis.accountTAM)} = ${(capacityAnalysis.coverageRatio * 100).toFixed(1)}%`
                    : `With no AE assigned, capture rate defaults to reactive rate (${(capacityAnalysis.reactiveCaptureRate * 100).toFixed(0)}%)`}
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: '#999', mt: 0.5 }}>
                  Team can only capture up to their capacity. Any winnable TAM beyond team capacity is captured at the reactive rate.
                </Typography>
              </Box>

              {/* Quarterly Breakdown Table */}
              <Box sx={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.7rem', color: '#666', backgroundColor: '#f5f5f5', width: 180 }}>Metric</th>
                      {QUARTER_LABELS.map((label, i) => (
                        <th key={i} style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 600, fontSize: '0.65rem', color: '#666', backgroundColor: i < 4 ? '#e8f5e9' : i < 8 ? '#e3f2fd' : '#fff3e0', minWidth: 65 }}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Winnable RRR Row (annualized) */}
                    <tr>
                      <td style={{ padding: '6px 12px', fontSize: '0.75rem', color: '#666', backgroundColor: '#fafafa' }}>Winnable RRR</td>
                      {QUARTERS.map((q, i) => (
                        <td key={q} style={{ padding: '4px', textAlign: 'center', backgroundColor: i < 4 ? '#f0faf0' : i < 8 ? '#f0f7ff' : '#fff8f0' }}>
                          <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#666' }}>
                            {fmt((capacityAnalysis.quarterly[q]?.winnable || 0) * 4)}
                          </Typography>
                        </td>
                      ))}
                    </tr>

                    {/* Team Capacity RRR Row (annualized) */}
                    <tr>
                      <td style={{ padding: '6px 12px', fontSize: '0.75rem', color: '#2196f3', backgroundColor: '#fafafa' }}>
                        Team Capacity ({capacityAnalysis.numAEs} AE)
                      </td>
                      {QUARTERS.map((q, i) => (
                        <td key={q} style={{ padding: '4px', textAlign: 'center', backgroundColor: i < 4 ? '#f0faf0' : i < 8 ? '#f0f7ff' : '#fff8f0' }}>
                          <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#2196f3' }}>
                            {fmt((capacityAnalysis.quarterly[q]?.teamCapacity || 0) * 4)}
                          </Typography>
                        </td>
                      ))}
                    </tr>

                    {/* Covered by Team RRR Row (annualized) */}
                    <tr>
                      <td style={{ padding: '6px 12px', fontSize: '0.75rem', color: '#4caf50', backgroundColor: '#fafafa' }}>
                        → Covered by Team
                      </td>
                      {QUARTERS.map((q, i) => {
                        const qa = capacityAnalysis.quarterly[q];
                        return (
                          <td key={q} style={{ padding: '4px', textAlign: 'center', backgroundColor: i < 4 ? '#f0faf0' : i < 8 ? '#f0f7ff' : '#fff8f0' }}>
                            <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#4caf50' }}>
                              {fmt((qa?.coveredByTeam || 0) * 4)}
                            </Typography>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Uncovered Winnable RRR Row (annualized) */}
                    <tr>
                      <td style={{ padding: '6px 12px', fontSize: '0.75rem', color: '#ff9800', backgroundColor: '#fafafa' }}>
                        → Uncovered Winnable
                      </td>
                      {QUARTERS.map((q, i) => {
                        const qa = capacityAnalysis.quarterly[q];
                        const uncoveredRRR = (qa?.uncoveredWinnable || 0) * 4;
                        return (
                          <td key={q} style={{ padding: '4px', textAlign: 'center', backgroundColor: i < 4 ? '#f0faf0' : i < 8 ? '#f0f7ff' : '#fff8f0' }}>
                            <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: uncoveredRRR > 0 ? '#ff9800' : '#999' }}>
                              {uncoveredRRR > 0 ? fmt(uncoveredRRR) : '—'}
                            </Typography>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Reactive Revenue RRR Row (annualized) */}
                    <tr>
                      <td style={{ padding: '6px 12px', fontSize: '0.75rem', color: '#ff9800', backgroundColor: '#fafafa' }}>
                        → Reactive ({(capacityAnalysis.reactiveCaptureRate * 100).toFixed(0)}%)
                      </td>
                      {QUARTERS.map((q, i) => {
                        const qa = capacityAnalysis.quarterly[q];
                        const reactiveRRR = (qa?.reactiveRevenue || 0) * 4;
                        return (
                          <td key={q} style={{ padding: '4px', textAlign: 'center', backgroundColor: i < 4 ? '#f0faf0' : i < 8 ? '#f0f7ff' : '#fff8f0' }}>
                            <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: reactiveRRR > 0 ? '#ff9800' : '#999' }}>
                              {reactiveRRR > 0 ? fmt(reactiveRRR) : '—'}
                            </Typography>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Resourced to Win RRR Row (annualized) */}
                    <tr style={{ backgroundColor: '#fff8f0', borderTop: '2px solid #D97757' }}>
                      <td style={{ padding: '8px 12px', fontSize: '0.8rem', fontWeight: 700, color: '#D97757' }}>
                        Resourced to Win
                      </td>
                      {QUARTERS.map((q, i) => {
                        const qa = capacityAnalysis.quarterly[q];
                        return (
                          <td key={q} style={{ padding: '4px', textAlign: 'center', backgroundColor: i < 4 ? '#c8e6c9' : i < 8 ? '#bbdefb' : '#ffe0b2' }}>
                            <Typography sx={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#D97757', fontWeight: 700 }}>
                              {fmt((qa?.resourcedToWin || 0) * 4)}
                            </Typography>
                            <Typography sx={{ fontSize: '0.55rem', color: '#999' }}>
                              {qa?.winnable > 0 ? `${(qa.captureRate * 100).toFixed(0)}%` : '—'}
                            </Typography>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </Box>

              {/* Coverage Gap Warning */}
              {capacityAnalysis.teamTAMCapacity < tam.total && (
                <Box sx={{ mt: 2, p: 1.5, bgcolor: '#fff3e0', borderRadius: 1, border: '1px solid #ff9800' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#e65100', fontWeight: 600 }}>
                    Coverage Gap: Team capacity ({fmt(capacityAnalysis.teamTAMCapacity)}) is less than bank TAM ({fmt(tam.total)})
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: '#666', mt: 0.5 }}>
                    {capacityAnalysis.numAEs === 0
                      ? `Adding 1 AE would increase coverage from ${(capacityAnalysis.reactiveCaptureRate * 100).toFixed(0)}% reactive to ${Math.min(100, (capacityAnalysis.tamPerAE / tam.total * 100)).toFixed(0)}% of TAM.`
                      : `Adding 1 more AE would increase team capacity to ${fmt(capacityAnalysis.teamTAMCapacity + capacityAnalysis.tamPerAE)}.`
                    }
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Operating Expense Sanity Check */}
      {tamData?.operatingExpense && (
        <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, mb: 3, overflow: 'hidden' }}>
          <Box sx={{ p: 2, bgcolor: '#fafafa', borderBottom: '1px solid #e0e0e0' }}>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#333' }}>TAM vs Operating Expense Sanity Check</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: '#666', mt: 0.5 }}>
              What percentage of operating expenses would Anthropic represent if the bank went wall-to-wall?
            </Typography>
          </Box>

          <Box sx={{ p: 3 }}>
            {/* Summary Row */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 2, mb: 3 }}>
              <Box sx={{ p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography sx={{ fontSize: '0.6rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Annual OpEx</Typography>
                <Typography sx={{ fontSize: '1.2rem', fontWeight: 600, color: '#333', lineHeight: 1.2 }}>{fmt(tamData.operatingExpense.annualTotal)}</Typography>
                <Typography sx={{ fontSize: '0.6rem', color: '#999' }}>
                  Q4 {tamData.operatingExpense.q4Period ? new Date(tamData.operatingExpense.q4Period).getFullYear() : 'N/A'}
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, bgcolor: '#fff8f0', borderRadius: 1, borderLeft: '3px solid #D97757' }}>
                <Typography sx={{ fontSize: '0.6rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Total TAM</Typography>
                <Typography sx={{ fontSize: '1.2rem', fontWeight: 600, color: '#D97757', lineHeight: 1.2 }}>{fmt(tamData.operatingExpense.totalTAM)}</Typography>
                <Typography sx={{ fontSize: '0.6rem', color: '#999' }}>100% pen</Typography>
              </Box>
              <Box sx={{ p: 1.5, bgcolor: tamData.operatingExpense.tamAsOpExPct > 0.10 ? '#ffebee' : tamData.operatingExpense.tamAsOpExPct > 0.05 ? '#fff8e1' : '#e8f5e9', borderRadius: 1 }}>
                <Typography sx={{ fontSize: '0.6rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.03em' }}>TAM % OpEx</Typography>
                <Typography sx={{
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  color: tamData.operatingExpense.tamAsOpExPct > 0.10 ? '#f44336' :
                         tamData.operatingExpense.tamAsOpExPct > 0.05 ? '#ff9800' : '#4caf50'
                }}>
                  {tamData.operatingExpense.tamAsOpExPct !== null ? `${(tamData.operatingExpense.tamAsOpExPct * 100).toFixed(1)}%` : '—'}
                </Typography>
                <Typography sx={{ fontSize: '0.6rem', color: '#999' }}>
                  {tamData.operatingExpense.tamAsOpExPct > 0.10 ? 'High' :
                   tamData.operatingExpense.tamAsOpExPct > 0.05 ? 'Moderate' : 'Reasonable'}
                </Typography>
              </Box>
              {/* 2026 RRR % OpEx */}
              <Box sx={{ p: 1.5, bgcolor: '#e8f5e9', borderRadius: 1 }}>
                <Typography sx={{ fontSize: '0.6rem', color: '#4caf50', textTransform: 'uppercase', letterSpacing: '0.03em' }}>2026 % OpEx</Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#4caf50', lineHeight: 1.2 }}>
                  {tamData.operatingExpense.rrr?.rrr2026AsOpExPct !== null ? `${(tamData.operatingExpense.rrr.rrr2026AsOpExPct * 100).toFixed(2)}%` : '—'}
                </Typography>
                <Typography sx={{ fontSize: '0.6rem', color: '#666' }}>{fmt(tamData.operatingExpense.rrr?.rrr2026)} RRR</Typography>
                <Typography sx={{ fontSize: '0.5rem', color: '#999' }}>
                  {tam.total > 0 ? `${((tamData.operatingExpense.rrr?.rrr2026 / tam.total) * 100).toFixed(1)}%` : '—'} of TAM
                </Typography>
              </Box>
              {/* 2027 RRR % OpEx */}
              <Box sx={{ p: 1.5, bgcolor: '#e3f2fd', borderRadius: 1 }}>
                <Typography sx={{ fontSize: '0.6rem', color: '#2196f3', textTransform: 'uppercase', letterSpacing: '0.03em' }}>2027 % OpEx</Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#2196f3', lineHeight: 1.2 }}>
                  {tamData.operatingExpense.rrr?.rrr2027AsOpExPct !== null ? `${(tamData.operatingExpense.rrr.rrr2027AsOpExPct * 100).toFixed(2)}%` : '—'}
                </Typography>
                <Typography sx={{ fontSize: '0.6rem', color: '#666' }}>{fmt(tamData.operatingExpense.rrr?.rrr2027)} RRR</Typography>
                <Typography sx={{ fontSize: '0.5rem', color: '#999' }}>
                  {tam.total > 0 ? `${((tamData.operatingExpense.rrr?.rrr2027 / tam.total) * 100).toFixed(1)}%` : '—'} of TAM
                </Typography>
              </Box>
              {/* 2028 RRR % OpEx */}
              <Box sx={{ p: 1.5, bgcolor: '#fff3e0', borderRadius: 1 }}>
                <Typography sx={{ fontSize: '0.6rem', color: '#D97757', textTransform: 'uppercase', letterSpacing: '0.03em' }}>2028 % OpEx</Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#D97757', lineHeight: 1.2 }}>
                  {tamData.operatingExpense.rrr?.rrr2028AsOpExPct !== null ? `${(tamData.operatingExpense.rrr.rrr2028AsOpExPct * 100).toFixed(2)}%` : '—'}
                </Typography>
                <Typography sx={{ fontSize: '0.6rem', color: '#666' }}>{fmt(tamData.operatingExpense.rrr?.rrr2028)} RRR</Typography>
                <Typography sx={{ fontSize: '0.5rem', color: '#999' }}>
                  {tam.total > 0 ? `${((tamData.operatingExpense.rrr?.rrr2028 / tam.total) * 100).toFixed(1)}%` : '—'} of TAM
                </Typography>
              </Box>
            </Box>

            {/* Operating Expense Breakdown */}
            <Box sx={{ borderTop: '1px solid #e0e0e0', pt: 2 }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#666', mb: 1.5 }}>Operating Expense Breakdown</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography sx={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase' }}>Salaries & Benefits</Typography>
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'monospace' }}>{fmt(tamData.operatingExpense.breakdown?.salariesAndBenefits)}</Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: '#999' }}>
                    {tamData.operatingExpense.annualTotal > 0 ? `${((tamData.operatingExpense.breakdown?.salariesAndBenefits / tamData.operatingExpense.annualTotal) * 100).toFixed(0)}% of total` : ''}
                  </Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography sx={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase' }}>Premises & Occupancy</Typography>
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'monospace' }}>{fmt(tamData.operatingExpense.breakdown?.premisesExpense)}</Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: '#999' }}>
                    {tamData.operatingExpense.annualTotal > 0 ? `${((tamData.operatingExpense.breakdown?.premisesExpense / tamData.operatingExpense.annualTotal) * 100).toFixed(0)}% of total` : ''}
                  </Typography>
                </Box>
                <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography sx={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase' }}>Other (incl. IT)</Typography>
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'monospace' }}>{fmt(tamData.operatingExpense.breakdown?.other)}</Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: '#999' }}>
                    {tamData.operatingExpense.annualTotal > 0 ? `${((tamData.operatingExpense.breakdown?.other / tamData.operatingExpense.annualTotal) * 100).toFixed(0)}% of total` : ''}
                  </Typography>
                </Box>
              </Box>

              {/* Context Note */}
              <Box sx={{ mt: 2, p: 1.5, bgcolor: '#fff8e1', borderRadius: 1, border: '1px solid #ffe082' }}>
                <Typography sx={{ fontSize: '0.7rem', color: '#f57c00' }}>
                  <strong>Note:</strong> Banks typically spend 5-12% of operating expenses on technology. IT spend is bundled in "Other" expenses,
                  with some IT staff costs in "Salaries". If wall-to-wall TAM exceeds ~10% of OpEx, the pricing assumptions may be too aggressive.
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* Footer context */}
      <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #f0f0f0', color: '#999', fontSize: '0.7rem' }}>
        {tier} tier ({getTierDescription(tier)}) · {tamData?.isGlobalOnly ? 'Global assumptions' : 'Custom assumptions'} · Last updated: {tamData?.period ? new Date(tamData.period).toLocaleDateString() : 'N/A'}
      </Box>
    </Box>
  );
}

export default TAMDetailTab;
