import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  Button,
  Chip,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import {
  Settings as SettingsIcon,
  People as PeopleIcon,
  OpenInNew as OpenInNewIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Group as GroupIcon,
  Timeline as TimelineIcon,
  AutoAwesome as AutoAwesomeIcon
} from '@mui/icons-material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import TeamCapacityPlanningTab from '../components/TeamCapacityPlanningTab';

/**
 * TAM Dashboard - Main page for Total Addressable Market analysis
 * Tabs: Banks (portfolio), Team Sizing, Global Assumptions
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

// Format currency
const fmt = (v) => {
  if (v === null || v === undefined) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const fmtNum = (v) => v?.toLocaleString() || '0';
const fmtPct = (v) => v ? `${(v * 100).toFixed(0)}%` : '—';

// Tufte sparkline
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

// Tier color helper (TAM-based tiers)
function getTierColor(tier) {
  switch (tier) {
    case 'Mega': return { bg: '#1a237e', text: '#fff' };           // Dark blue - top tier
    case 'Strategic': return { bg: '#D97757', text: '#fff' };      // Anthropic coral
    case 'Enterprise': return { bg: '#2e7d32', text: '#fff' };     // Green
    case 'Commercial': return { bg: '#1976d2', text: '#fff' };     // Blue
    case 'SmallBusiness': return { bg: '#9e9e9e', text: '#fff' };  // Gray
    default: return { bg: '#e0e0e0', text: '#666' };
  }
}

// Coverage donut/ring chart
const CoverageRing = ({ covered, total, size = 120 }) => {
  const pct = total > 0 ? covered / total : 0;
  const strokeWidth = 12;
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
        <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#D97757', lineHeight: 1 }}>{fmtPct(pct)}</Typography>
        <Typography sx={{ fontSize: '0.65rem', color: '#666' }}>covered</Typography>
      </Box>
    </Box>
  );
};

// Bank logo with initials fallback
const BankLogoCell = ({ idrssd, bankName }) => {
  const [imgError, setImgError] = useState(false);
  const initials = bankName?.split(' ').slice(0, 2).map(w => w[0]).join('') || '?';

  if (imgError) {
    return (
      <Box sx={{ width: 28, height: 28, borderRadius: '4px', bgcolor: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 600, color: '#666' }} title={bankName}>
        {initials}
      </Box>
    );
  }

  return (
    <img
      src={`/api/research/${idrssd}/logo`}
      alt={bankName}
      title={bankName}
      style={{ height: '24px', maxWidth: '60px', objectFit: 'contain' }}
      onError={() => setImgError(true)}
    />
  );
};

// Tier grouping constants
const TIERS = ['Mega', 'Strategic', 'Enterprise', 'Commercial', 'SmallBusiness'];
const TIER_LABELS = { Mega: 'Mega Banks', Strategic: 'Strategic', Enterprise: 'Enterprise', Commercial: 'Commercial', SmallBusiness: 'Small Business' };
const TIER_COLORS = { Mega: '#1a237e', Strategic: '#D97757', Enterprise: '#2e7d32', Commercial: '#7b1fa2', SmallBusiness: '#757575' };

// Banks Tab with Tufte-style summary
function BanksTab({ banks, aggregate, period, globalData, teamSizingData, rosterData, navigate }) {
  const [expandedTiers, setExpandedTiers] = useState({ Mega: true, Strategic: true, Enterprise: false, Commercial: false, SmallBusiness: false });

  // Build map of actual bank assignments from roster
  const bankAssignments = useMemo(() => {
    const assignments = {};
    const members = rosterData?.members || [];
    for (const member of members) {
      if (!member.isActive) continue;
      for (const assignment of member.accountAssignments || []) {
        const idrssd = String(assignment.idrssd);
        if (!assignments[idrssd]) {
          assignments[idrssd] = { aes: [], ses: [], totalTAMCapacity: 0 };
        }
        if (member.role === 'AE') {
          assignments[idrssd].aes.push(member.name);
        } else {
          assignments[idrssd].ses.push(member.name);
        }
      }
    }
    return assignments;
  }, [rosterData]);

  // Use server-calculated quarterly revenue (uses segment-based penetration)
  const quarterlyRevenue = useMemo(() => {
    if (teamSizingData?.quarterlyRevenue) {
      return teamSizingData.quarterlyRevenue;
    }
    return {};
  }, [teamSizingData]);

  // Calculate quarterly totals and Year-end RRR (Q4 of each year, annualized)
  const quarterlyTotals = QUARTERS.map(q => quarterlyRevenue[q]?.total || 0);
  const rrr2026 = (quarterlyTotals[3] || 0) * 4;
  const rrr2027 = (quarterlyTotals[7] || 0) * 4;
  const rrr2028 = (quarterlyTotals[11] || 0) * 4;

  // Product RRR by year for Tufte display - Q4 annualized per product
  const productsByYear = useMemo(() => {
    return [
      { year: 'Y1', label: '2026', q4Quarter: '2026-Q4' },
      { year: 'Y2', label: '2027', q4Quarter: '2027-Q4' },
      { year: 'Y3', label: '2028', q4Quarter: '2028-Q4' }
    ].map(y => {
      const byProduct = {};
      PRODUCTS.forEach(p => {
        // Q4 RRR = Q4 quarterly revenue × 4 (annualized)
        byProduct[p.key] = (quarterlyRevenue[y.q4Quarter]?.[p.key] || 0) * 4;
      });
      byProduct.total = (quarterlyRevenue[y.q4Quarter]?.total || 0) * 4;
      return { ...y, ...byProduct };
    });
  }, [quarterlyRevenue]);

  // Coverage data from team sizing
  const coverage = teamSizingData?.coverage || {};
  const teamTotals = teamSizingData?.teamTotals || {};
  const coveredBanks = teamSizingData?.coveredBanks || [];

  // Group banks by tier
  const banksByTier = useMemo(() => {
    const grouped = {};
    TIERS.forEach(tier => { grouped[tier] = []; });
    coveredBanks.forEach(bank => {
      if (grouped[bank.tier]) {
        grouped[bank.tier].push(bank);
      }
    });
    return grouped;
  }, [coveredBanks]);

  const toggleTier = (tier) => {
    setExpandedTiers(prev => ({ ...prev, [tier]: !prev[tier] }));
  };

  const capacityAnalysis = teamSizingData?.capacityAnalysis;
  const adjustedRRR = capacityAnalysis?.summary?.adjustedRRR || {};
  const captureY1 = capacityAnalysis?.summary?.y1?.captureRate || 0;
  const captureY2 = capacityAnalysis?.summary?.y2?.captureRate || 0;
  const captureY3 = capacityAnalysis?.summary?.y3?.captureRate || 0;

  return (
    <Box>
      {/* Simplified Pipeline: TAM → Account Coverage → Winnable RRR → Resourced to Win RRR */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: '#fff' }}>
        {/* Pipeline Funnel Visual */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          {/* Total TAM */}
          <Box sx={{ textAlign: 'center', flex: 1 }}>
            <Typography sx={{ fontSize: '0.65rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Total TAM</Typography>
            <Typography sx={{ fontSize: '1.75rem', fontWeight: 300, color: '#666', lineHeight: 1 }}>{fmt(coverage.totalTAM)}</Typography>
            <Typography sx={{ fontSize: '0.6rem', color: '#999' }}>{coverage.totalBankCount?.toLocaleString()} banks</Typography>
          </Box>

          <Box sx={{ px: 1, color: '#ccc', fontSize: '1.5rem' }}>›</Box>

          {/* Account Coverage TAM */}
          <Box sx={{ textAlign: 'center', flex: 1, px: 2, py: 1.5, bgcolor: '#fff8f0', borderRadius: 1, border: '2px solid #D97757' }}>
            <Typography sx={{ fontSize: '0.65rem', color: '#D97757', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Account Coverage TAM</Typography>
            <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: '#D97757', lineHeight: 1 }}>{fmt(coverage.tamCovered)}</Typography>
            <Typography sx={{ fontSize: '0.6rem', color: '#666' }}>Top {coverage.coveredBankCount} banks</Typography>
          </Box>

          <Box sx={{ px: 1, color: '#D97757', fontSize: '1.5rem' }}>›</Box>

          {/* RRR Comparison by Year */}
          <Box sx={{ flex: 2.5, display: 'flex', gap: 1 }}>
            {[
              { year: '2026', winnable: rrr2026, resourced: adjustedRRR.rrr2026, capture: captureY1, color: '#4caf50', bgColor: '#e8f5e9' },
              { year: '2027', winnable: rrr2027, resourced: adjustedRRR.rrr2027, capture: captureY2, color: '#2196f3', bgColor: '#e3f2fd' },
              { year: '2028', winnable: rrr2028, resourced: adjustedRRR.rrr2028, capture: captureY3, color: '#D97757', bgColor: '#fff3e0', highlight: true }
            ].map(({ year, winnable, resourced, capture, color, bgColor, highlight }) => (
              <Box key={year} sx={{ flex: 1, p: 1.5, bgcolor: bgColor, borderRadius: 1, border: highlight ? `2px solid ${color}` : '1px solid #e0e0e0' }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color, textAlign: 'center', mb: 1 }}>{year}</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Box>
                    <Typography sx={{ fontSize: '0.55rem', color: '#999', textTransform: 'uppercase' }}>Winnable RRR</Typography>
                    <Typography sx={{ fontSize: '1rem', fontWeight: 500, color: '#666', lineHeight: 1.1 }}>{fmt(winnable)}</Typography>
                  </Box>
                  <Box sx={{ borderTop: '1px dashed #ccc', pt: 0.5 }}>
                    <Typography sx={{ fontSize: '0.55rem', color, textTransform: 'uppercase', fontWeight: 600 }}>Resourced to Win</Typography>
                    <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color, lineHeight: 1.1 }}>{fmt(resourced || winnable)}</Typography>
                    {capacityAnalysis && resourced && (
                      <Typography sx={{ fontSize: '0.55rem', color: '#666' }}>{(capture * 100).toFixed(0)}% of winnable</Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Simple Gap Indicator */}
        {capacityAnalysis && (
          <Box sx={{ pt: 2, borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: '0.7rem', color: '#666' }}>
              <strong>{capacityAnalysis?.roster?.currentTotal || 0}</strong> current headcount → <strong>{teamTotals?.total || 0}</strong> required for full coverage
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: '#f44336' }}>
              {fmt((capacityAnalysis.summary?.total?.potential || 0) - (capacityAnalysis.summary?.total?.captured || 0))} 3-year RRR gap
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Aggregate Operating Expense Sanity Check */}
      {teamSizingData?.operatingExpense && (
        <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#333' }}>Industry Operating Expense Sanity Check</Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#666' }}>
                What percentage of covered banks' total operating expenses would Anthropic represent?
              </Typography>
            </Box>
          </Box>

          {/* OpEx Breakdown Row */}
          {teamSizingData.operatingExpense.breakdown && (
            <Box sx={{ mb: 2, p: 2, bgcolor: '#fafafa', borderRadius: 1, border: '1px solid #e0e0e0' }}>
              <Typography sx={{ fontSize: '0.65rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.03em', mb: 1 }}>
                Operating Expense Breakdown ({coverage.coveredBankCount} banks)
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: '0.6rem', color: '#999' }}>Salaries & Benefits</Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: '#333' }}>
                    {fmt(teamSizingData.operatingExpense.breakdown.salariesAndBenefits)}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#2196f3' }}>
                    {teamSizingData.operatingExpense.totalCoveredOpEx > 0
                      ? `${((teamSizingData.operatingExpense.breakdown.salariesAndBenefits / teamSizingData.operatingExpense.totalCoveredOpEx) * 100).toFixed(1)}%`
                      : '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.6rem', color: '#999' }}>Premises & Equipment</Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: '#333' }}>
                    {fmt(teamSizingData.operatingExpense.breakdown.premisesExpense)}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#4caf50' }}>
                    {teamSizingData.operatingExpense.totalCoveredOpEx > 0
                      ? `${((teamSizingData.operatingExpense.breakdown.premisesExpense / teamSizingData.operatingExpense.totalCoveredOpEx) * 100).toFixed(1)}%`
                      : '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.6rem', color: '#999' }}>Other Expenses</Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: '#333' }}>
                    {fmt(teamSizingData.operatingExpense.breakdown.other)}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#ff9800' }}>
                    {teamSizingData.operatingExpense.totalCoveredOpEx > 0
                      ? `${((teamSizingData.operatingExpense.breakdown.other / teamSizingData.operatingExpense.totalCoveredOpEx) * 100).toFixed(1)}%`
                      : '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.6rem', color: '#999' }}>Total OpEx</Typography>
                  <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: '#333' }}>
                    {fmt(teamSizingData.operatingExpense.totalCoveredOpEx)}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#666' }}>100%</Typography>
                </Box>
              </Box>
            </Box>
          )}

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2, alignItems: 'end' }}>
            {/* Total TAM */}
            <Box sx={{ p: 2, bgcolor: '#fff8f0', borderRadius: 1, borderLeft: '3px solid #D97757' }}>
              <Typography sx={{ fontSize: '0.6rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Total TAM</Typography>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 600, color: '#D97757', lineHeight: 1.2 }}>{fmt(teamSizingData.operatingExpense.totalCoveredTAM)}</Typography>
              <Typography sx={{ fontSize: '0.6rem', color: '#999' }}>100% penetration</Typography>
            </Box>

            {/* TAM as % OpEx */}
            <Box sx={{ p: 2, bgcolor: teamSizingData.operatingExpense.tamAsOpExPct > 0.10 ? '#ffebee' : teamSizingData.operatingExpense.tamAsOpExPct > 0.05 ? '#fff8e1' : '#e8f5e9', borderRadius: 1 }}>
              <Typography sx={{ fontSize: '0.6rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.03em' }}>TAM % OpEx</Typography>
              <Typography sx={{
                fontSize: '1.25rem',
                fontWeight: 700,
                lineHeight: 1.2,
                color: teamSizingData.operatingExpense.tamAsOpExPct > 0.10 ? '#f44336' : teamSizingData.operatingExpense.tamAsOpExPct > 0.05 ? '#ff9800' : '#4caf50'
              }}>
                {teamSizingData.operatingExpense.tamAsOpExPct !== null ? `${(teamSizingData.operatingExpense.tamAsOpExPct * 100).toFixed(1)}%` : '—'}
              </Typography>
              <Typography sx={{ fontSize: '0.6rem', color: '#999' }}>Wall-to-wall</Typography>
            </Box>

            {/* 2026 RRR % OpEx */}
            <Box sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 1 }}>
              <Typography sx={{ fontSize: '0.6rem', color: '#4caf50', textTransform: 'uppercase', letterSpacing: '0.03em' }}>2026 % OpEx</Typography>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#4caf50', lineHeight: 1.2 }}>
                {teamSizingData.operatingExpense.rrr?.rrr2026AsOpExPct !== null ? `${(teamSizingData.operatingExpense.rrr.rrr2026AsOpExPct * 100).toFixed(2)}%` : '—'}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: '#666' }}>{fmt(teamSizingData.operatingExpense.rrr?.rrr2026)} RRR</Typography>
              <Typography sx={{ fontSize: '0.55rem', color: '#999' }}>
                {coverage.tamCovered > 0 ? `${((teamSizingData.operatingExpense.rrr?.rrr2026 / coverage.tamCovered) * 100).toFixed(1)}%` : '—'} of TAM
              </Typography>
            </Box>

            {/* 2027 RRR % OpEx */}
            <Box sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius: 1 }}>
              <Typography sx={{ fontSize: '0.6rem', color: '#2196f3', textTransform: 'uppercase', letterSpacing: '0.03em' }}>2027 % OpEx</Typography>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#2196f3', lineHeight: 1.2 }}>
                {teamSizingData.operatingExpense.rrr?.rrr2027AsOpExPct !== null ? `${(teamSizingData.operatingExpense.rrr.rrr2027AsOpExPct * 100).toFixed(2)}%` : '—'}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: '#666' }}>{fmt(teamSizingData.operatingExpense.rrr?.rrr2027)} RRR</Typography>
              <Typography sx={{ fontSize: '0.55rem', color: '#999' }}>
                {coverage.tamCovered > 0 ? `${((teamSizingData.operatingExpense.rrr?.rrr2027 / coverage.tamCovered) * 100).toFixed(1)}%` : '—'} of TAM
              </Typography>
            </Box>

            {/* 2028 RRR % OpEx */}
            <Box sx={{ p: 2, bgcolor: '#fff3e0', borderRadius: 1 }}>
              <Typography sx={{ fontSize: '0.6rem', color: '#D97757', textTransform: 'uppercase', letterSpacing: '0.03em' }}>2028 % OpEx</Typography>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#D97757', lineHeight: 1.2 }}>
                {teamSizingData.operatingExpense.rrr?.rrr2028AsOpExPct !== null ? `${(teamSizingData.operatingExpense.rrr.rrr2028AsOpExPct * 100).toFixed(2)}%` : '—'}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: '#666' }}>{fmt(teamSizingData.operatingExpense.rrr?.rrr2028)} RRR</Typography>
              <Typography sx={{ fontSize: '0.55rem', color: '#999' }}>
                {coverage.tamCovered > 0 ? `${((teamSizingData.operatingExpense.rrr?.rrr2028 / coverage.tamCovered) * 100).toFixed(1)}%` : '—'} of TAM
              </Typography>
            </Box>
          </Box>

          {/* Context note */}
          <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography sx={{ fontSize: '0.7rem', color: '#666' }}>
              Banks typically spend 5-12% of operating expenses on technology. TAM represents the theoretical maximum if all covered banks went wall-to-wall with Anthropic.
              The RRR columns show what we actually expect to achieve based on penetration assumptions.
            </Typography>
          </Box>
        </Paper>
      )}

      {/* TAM Calculation Worksheet */}
      {teamSizingData?.pricingAssumptions && teamSizingData?.aggregateInputs && (
        <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#333' }}>TAM Calculation Worksheet</Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#666' }}>
                How we calculate the Total Addressable Market for {coverage.coveredBankCount} covered banks
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
            {/* Claude Code */}
            <Box sx={{ p: 2, bgcolor: '#fff8f0', borderRadius: 1, borderLeft: '3px solid #D97757', display: 'flex', flexDirection: 'column' }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#D97757', mb: 1 }}>Claude Code</Typography>
              <Box sx={{ fontSize: '0.65rem', color: '#666', lineHeight: 1.8 }}>
                <Box>{fmtNum(teamSizingData.aggregateInputs.totalFTE)} FTE</Box>
                <Box>× {(teamSizingData.pricingAssumptions.claudeCode.fteEligibilityRate * 100).toFixed(0)}% dev rate</Box>
                <Box sx={{ borderTop: '1px solid #e0e0e0', pt: 0.5, mt: 0.5 }}>= {fmtNum(teamSizingData.aggregateInputs.developers)} developers</Box>
                <Box>× ${fmtNum(teamSizingData.pricingAssumptions.claudeCode.pricePerMonth)}/mo</Box>
                <Box>× 12 months</Box>
              </Box>
              <Box sx={{ mt: 'auto', pt: 1.5, borderTop: '2px solid #D97757' }}>
                <Typography sx={{ fontSize: '0.6rem', color: '#999', textTransform: 'uppercase' }}>Annual TAM</Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#D97757', fontFamily: 'monospace' }}>
                  {fmt(teamSizingData.coveredTAMByProduct?.claudeCode || 0)}
                </Typography>
              </Box>
            </Box>

            {/* Claude Enterprise */}
            <Box sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius: 1, borderLeft: '3px solid #2196f3', display: 'flex', flexDirection: 'column' }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#2196f3', mb: 1 }}>Claude Enterprise</Typography>
              <Box sx={{ fontSize: '0.65rem', color: '#666', lineHeight: 1.8 }}>
                <Box>{fmtNum(teamSizingData.aggregateInputs.totalFTE)} FTE</Box>
                <Box>× {(teamSizingData.pricingAssumptions.claudeEnterprise.adoptionRate * 100).toFixed(0)}% adoption</Box>
                <Box sx={{ borderTop: '1px solid #e0e0e0', pt: 0.5, mt: 0.5 }}>= {fmtNum(teamSizingData.aggregateInputs.enterpriseSeats)} seats</Box>
                <Box>× ${fmtNum(teamSizingData.pricingAssumptions.claudeEnterprise.pricePerMonth)}/mo</Box>
                <Box>× 12 months</Box>
              </Box>
              <Box sx={{ mt: 'auto', pt: 1.5, borderTop: '2px solid #2196f3' }}>
                <Typography sx={{ fontSize: '0.6rem', color: '#999', textTransform: 'uppercase' }}>Annual TAM</Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#2196f3', fontFamily: 'monospace' }}>
                  {fmt(teamSizingData.coveredTAMByProduct?.claudeEnterprise || 0)}
                </Typography>
              </Box>
            </Box>

            {/* Agents Run Business */}
            <Box sx={{ p: 2, bgcolor: '#e8f5e9', borderRadius: 1, borderLeft: '3px solid #4caf50', display: 'flex', flexDirection: 'column' }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#4caf50', mb: 1 }}>Agents: Run Business</Typography>
              <Box sx={{ fontSize: '0.65rem', color: '#666', lineHeight: 1.8 }}>
                <Box>{fmtNum(teamSizingData.aggregateInputs.totalFTE)} FTE</Box>
                <Box>× {teamSizingData.pricingAssumptions.agentsRunBusiness.agentsPerEmployee} agents/emp</Box>
                <Box sx={{ borderTop: '1px solid #e0e0e0', pt: 0.5, mt: 0.5 }}>= {fmtNum(teamSizingData.aggregateInputs.totalAgents)} agents</Box>
                <Box>× ${fmtNum(teamSizingData.pricingAssumptions.agentsRunBusiness.pricePerAgentMonth)}/agent/mo</Box>
                <Box>× 12 months</Box>
              </Box>
              <Box sx={{ mt: 'auto', pt: 1.5, borderTop: '2px solid #4caf50' }}>
                <Typography sx={{ fontSize: '0.6rem', color: '#999', textTransform: 'uppercase' }}>Annual TAM</Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#4caf50', fontFamily: 'monospace' }}>
                  {fmt(teamSizingData.coveredTAMByProduct?.agentsRunBusiness || 0)}
                </Typography>
              </Box>
            </Box>

            {/* Agents Grow Business */}
            <Box sx={{ p: 2, bgcolor: '#f3e5f5', borderRadius: 1, borderLeft: '3px solid #9c27b0', display: 'flex', flexDirection: 'column' }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#9c27b0', mb: 1 }}>Agents: Grow Business</Typography>
              <Box sx={{ fontSize: '0.65rem', color: '#666', lineHeight: 1.8 }}>
                <Box>{fmt(teamSizingData.aggregateInputs.totalNetIncome * 1000)} net income</Box>
                <Box>× {(teamSizingData.pricingAssumptions.agentsGrowBusiness.revenueFromAgents * 100).toFixed(0)}% revenue from agents</Box>
                <Box>× {(teamSizingData.pricingAssumptions.agentsGrowBusiness.anthropicShare * 100).toFixed(0)}% Anthropic share</Box>
              </Box>
              <Box sx={{ mt: 'auto', pt: 1.5, borderTop: '2px solid #9c27b0' }}>
                <Typography sx={{ fontSize: '0.6rem', color: '#999', textTransform: 'uppercase' }}>Annual TAM</Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#9c27b0', fontFamily: 'monospace' }}>
                  {fmt(teamSizingData.coveredTAMByProduct?.agentsGrowBusiness || 0)}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Total */}
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3 }}>
            <Typography sx={{ fontSize: '0.8rem', color: '#666' }}>
              Total Annual TAM (Covered Banks)
            </Typography>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#D97757', fontFamily: 'monospace' }}>
              {fmt(coverage.tamCovered)}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Stacked Area Charts */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mb: 4 }}>
        {/* TAM Coverage Chart */}
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e0e0e0' }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 2, color: '#333' }}>
            TAM Coverage Over Time (Annualized RRR)
          </Typography>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={QUARTERS.map((q, i) => {
                const forecastRRR = (quarterlyRevenue[q]?.total || 0) * 4;
                const coveredTAM = coverage.tamCovered || 0;
                const totalTAM = coverage.totalTAM || 0;
                return {
                  quarter: QUARTER_LABELS[i],
                  forecastRRR,
                  coveredGap: Math.max(0, coveredTAM - forecastRRR),
                  totalGap: Math.max(0, totalTAM - coveredTAM)
                };
              })}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <XAxis dataKey="quarter" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#e0e0e0' }} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(v)} width={55} />
              <Tooltip formatter={(value, name) => [fmt(value), name === 'forecastRRR' ? 'Forecast RRR' : name === 'coveredGap' ? 'Remaining Covered TAM' : 'Uncovered TAM']} contentStyle={{ fontSize: '0.75rem' }} />
              <Area type="monotone" dataKey="forecastRRR" stackId="1" stroke="#D97757" fill="#D97757" fillOpacity={1} />
              <Area type="monotone" dataKey="coveredGap" stackId="1" stroke="#E8A090" fill="#E8A090" fillOpacity={0.6} />
              <Area type="monotone" dataKey="totalGap" stackId="1" stroke="#f5e6e0" fill="#f5e6e0" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
          <Box sx={{ display: 'flex', gap: 2, mt: 1, justifyContent: 'center' }}>
            <Typography sx={{ fontSize: '0.6rem', color: '#666' }}><Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, bgcolor: '#D97757', mr: 0.5, verticalAlign: 'middle' }} />Forecast</Typography>
            <Typography sx={{ fontSize: '0.6rem', color: '#666' }}><Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, bgcolor: '#E8A090', opacity: 0.6, mr: 0.5, verticalAlign: 'middle' }} />Covered</Typography>
            <Typography sx={{ fontSize: '0.6rem', color: '#666' }}><Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, bgcolor: '#f5e6e0', mr: 0.5, verticalAlign: 'middle' }} />Uncovered</Typography>
          </Box>
        </Paper>

        {/* Revenue by Product Chart */}
        <Paper elevation={0} sx={{ p: 2, border: '1px solid #e0e0e0' }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 2, color: '#333' }}>
            Forecast RRR by Product (Annualized)
          </Typography>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={QUARTERS.map((q, i) => ({
                quarter: QUARTER_LABELS[i],
                claudeCode: (quarterlyRevenue[q]?.claudeCode || 0) * 4,
                claudeEnterprise: (quarterlyRevenue[q]?.claudeEnterprise || 0) * 4,
                agentsRunBusiness: (quarterlyRevenue[q]?.agentsRunBusiness || 0) * 4,
                agentsGrowBusiness: (quarterlyRevenue[q]?.agentsGrowBusiness || 0) * 4
              }))}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <XAxis dataKey="quarter" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#e0e0e0' }} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(v)} width={55} />
              <Tooltip formatter={(value, name) => { const labels = { claudeCode: 'Claude Code', claudeEnterprise: 'Enterprise', agentsRunBusiness: 'Run', agentsGrowBusiness: 'Grow' }; return [fmt(value), labels[name] || name]; }} contentStyle={{ fontSize: '0.75rem' }} />
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
        </Paper>
      </Box>

      {/* Product Breakdown - Tufte Style Y1/Y2/Y3 RRR */}
      <Paper elevation={0} sx={{ p: 2, mb: 4, border: '1px solid #e0e0e0' }}>
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
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', color: '#666' }}>{fmt(aggregate?.bySource?.[p.key])}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', color: '#4caf50' }}>{fmt(productsByYear[0]?.[p.key])}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', color: '#2196f3' }}>{fmt(productsByYear[1]?.[p.key])}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.85rem', color: '#D97757' }}>{fmt(productsByYear[2]?.[p.key])}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #333', bgcolor: '#fafafa' }}>
                <td style={{ padding: '10px 12px', fontWeight: 700 }}>TOTAL</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 700 }}>{fmt(aggregate?.totalTAM)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 700, color: '#4caf50' }}>{fmt(rrr2026)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 700, color: '#2196f3' }}>{fmt(rrr2027)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 700, color: '#D97757' }}>{fmt(rrr2028)}</td>
              </tr>
            </tbody>
          </table>
        </Box>
      </Paper>

      {/* Bank Details by Tier - Grouped Tables */}
      <Typography sx={{ fontSize: '1rem', fontWeight: 600, mb: 2, color: '#333' }}>Bank Details by Tier</Typography>

      {TIERS.map(tier => {
        const tierBanks = banksByTier[tier] || [];
        if (tierBanks.length === 0) return null;

        const isExpanded = expandedTiers[tier];
        const tierColor = TIER_COLORS[tier];
        const reactiveCaptureRate = teamSizingData?.capacityAnalysis?.assumptions?.reactiveCaptureRate || 0.10;

        // Tier totals
        const tierTAM = tierBanks.reduce((s, b) => s + (b.tam || 0), 0);
        const tierAEs = tierBanks.reduce((s, b) => s + (b.aeShare || 0), 0);
        const tierSEs = tierBanks.reduce((s, b) => s + (b.seShare || 0), 0);

        // Calculate tier winnable totals
        const tierWinnable = {
          y1: tierBanks.reduce((s, b) => s + (b.yearlyRevenue?.y1 || 0), 0),
          y2: tierBanks.reduce((s, b) => s + (b.yearlyRevenue?.y2 || 0), 0),
          y3: tierBanks.reduce((s, b) => s + (b.yearlyRevenue?.y3 || 0), 0)
        };

        // Calculate resourced to win based on ACTUAL assignments
        const segmentAssumptions = globalData?.segmentAssumptions?.[tier] || {};
        const tamPerAE = segmentAssumptions.tamPerAE || 0;
        let tierTeamCapacity = 0;
        const tierResourced = tierBanks.reduce((acc, bank) => {
          const actualAssignment = bankAssignments[String(bank.idrssd)];
          const hasActualAssignment = actualAssignment && (actualAssignment.aes.length > 0 || actualAssignment.ses.length > 0);
          const numAssignedAEs = actualAssignment?.aes?.length || 0;
          const teamCapacity = numAssignedAEs * tamPerAE;
          if (hasActualAssignment) {
            tierTeamCapacity += teamCapacity;
          }
          const bankTam = bank.tam || 0;
          const coverageRatio = hasActualAssignment && bankTam > 0
            ? Math.min(1, teamCapacity / bankTam)
            : reactiveCaptureRate;
          return {
            y1: acc.y1 + (bank.yearlyRevenue?.y1 || 0) * coverageRatio,
            y2: acc.y2 + (bank.yearlyRevenue?.y2 || 0) * coverageRatio,
            y3: acc.y3 + (bank.yearlyRevenue?.y3 || 0) * coverageRatio
          };
        }, { y1: 0, y2: 0, y3: 0 });

        return (
          <Box key={tier} sx={{ mb: 2, border: '1px solid #e0e0e0', borderRadius: 1, overflow: 'hidden' }}>
            {/* Tier Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1.5,
                bgcolor: tierColor + '10',
                cursor: 'pointer',
                '&:hover': { bgcolor: tierColor + '18' }
              }}
              onClick={() => toggleTier(tier)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ width: 14, height: 14, bgcolor: tierColor, borderRadius: '2px' }} />
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: tierColor }}>{TIER_LABELS[tier]}</Typography>
                <Chip label={tierBanks.length} size="small" sx={{ height: 20, fontSize: '0.7rem', bgcolor: tierColor, color: '#fff' }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Typography sx={{ fontSize: '0.75rem', color: '#666' }}>TAM: <strong>{fmt(tierTAM)}</strong></Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#666' }}>Team: <strong style={{ color: '#D97757' }}>{Math.ceil(tierAEs)}</strong> AE / <strong style={{ color: '#1976d2' }}>{Math.ceil(tierSEs)}</strong> SE</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#D97757' }}>RRR: <strong>{fmt(tierResourced.y3)}</strong></Typography>
                {isExpanded ? <ExpandLessIcon sx={{ color: '#666' }} /> : <ExpandMoreIcon sx={{ color: '#666' }} />}
              </Box>
            </Box>

            {/* Bank Table */}
            {isExpanded && (
              <Box sx={{ maxHeight: 500, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fafafa', position: 'sticky', top: 0, zIndex: 1 }}>
                      <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: '0.65rem', color: '#999', fontWeight: 500 }}>Bank</th>
                      <th style={{ padding: '6px', textAlign: 'right', fontSize: '0.65rem', color: '#999', fontWeight: 500 }}>Assets</th>
                      <th style={{ padding: '6px', textAlign: 'right', fontSize: '0.65rem', color: '#D97757', fontWeight: 600 }}>Bank TAM</th>
                      <th style={{ padding: '6px', textAlign: 'right', fontSize: '0.65rem', color: '#4caf50', fontWeight: 600 }}>Team Capacity</th>
                      <th style={{ padding: '6px', textAlign: 'right', fontSize: '0.65rem', color: '#9c27b0', fontWeight: 500 }}>% OpEx</th>
                      <th colSpan={3} style={{ padding: '6px', textAlign: 'center', fontSize: '0.65rem', color: '#666', fontWeight: 600, backgroundColor: '#f5f5f5', borderLeft: '1px solid #e0e0e0' }}>Winnable RRR</th>
                      <th colSpan={3} style={{ padding: '6px', textAlign: 'center', fontSize: '0.65rem', color: '#333', fontWeight: 600, backgroundColor: '#fff8f0', borderLeft: '1px solid #e0e0e0' }}>Resourced to Win</th>
                      <th style={{ padding: '6px', width: 30 }}></th>
                    </tr>
                    <tr style={{ backgroundColor: '#fafafa', position: 'sticky', top: 24, zIndex: 1 }}>
                      <th colSpan={5}></th>
                      <th style={{ padding: '4px', textAlign: 'right', fontSize: '0.6rem', color: '#4caf50', fontWeight: 500, backgroundColor: '#f5f5f5', borderLeft: '1px solid #e0e0e0' }}>2026</th>
                      <th style={{ padding: '4px', textAlign: 'right', fontSize: '0.6rem', color: '#2196f3', fontWeight: 500, backgroundColor: '#f5f5f5' }}>2027</th>
                      <th style={{ padding: '4px', textAlign: 'right', fontSize: '0.6rem', color: '#D97757', fontWeight: 500, backgroundColor: '#f5f5f5' }}>2028</th>
                      <th style={{ padding: '4px', textAlign: 'right', fontSize: '0.6rem', color: '#4caf50', fontWeight: 500, backgroundColor: '#fff8f0', borderLeft: '1px solid #e0e0e0' }}>2026</th>
                      <th style={{ padding: '4px', textAlign: 'right', fontSize: '0.6rem', color: '#2196f3', fontWeight: 500, backgroundColor: '#fff8f0' }}>2027</th>
                      <th style={{ padding: '4px', textAlign: 'right', fontSize: '0.6rem', color: '#D97757', fontWeight: 500, backgroundColor: '#fff8f0' }}>2028</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tierBanks.map((bank, idx) => {
                      // Use ACTUAL assignments from roster, not theoretical capacity
                      const actualAssignment = bankAssignments[String(bank.idrssd)];
                      const hasActualAssignment = actualAssignment && (actualAssignment.aes.length > 0 || actualAssignment.ses.length > 0);

                      // Get segment capacity assumptions
                      const segmentAssumptions = globalData?.segmentAssumptions?.[bank.tier] || {};
                      const tamPerAE = segmentAssumptions.tamPerAE || 0;

                      // Calculate coverage ratio based on actual assignments
                      // Coverage = (# assigned AEs × TAM capacity per AE) / Bank TAM
                      const numAssignedAEs = actualAssignment?.aes?.length || 0;
                      const teamCapacity = numAssignedAEs * tamPerAE;
                      const bankTam = bank.tam || 0;
                      const coverageRatio = hasActualAssignment && bankTam > 0
                        ? Math.min(1, teamCapacity / bankTam)
                        : reactiveCaptureRate; // Use reactive rate for unassigned banks

                      // Calculate resourced to win for this bank based on actual coverage
                      const resourcedY1 = (bank.yearlyRevenue?.y1 || 0) * coverageRatio;
                      const resourcedY2 = (bank.yearlyRevenue?.y2 || 0) * coverageRatio;
                      const resourcedY3 = (bank.yearlyRevenue?.y3 || 0) * coverageRatio;

                      return (
                        <tr
                          key={bank.idrssd}
                          style={{
                            borderBottom: '1px solid #f5f5f5',
                            backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa',
                            cursor: 'pointer'
                          }}
                          onClick={() => navigate(`/bank/${bank.idrssd}?tab=tam`)}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fff8f0'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#fff' : '#fafafa'}
                        >
                          <td style={{ padding: '6px 12px' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <BankLogoCell idrssd={bank.idrssd} bankName={bank.bankName} />
                              <Chip
                                label={hasActualAssignment ? `${numAssignedAEs} AE` : 'Unassigned'}
                                size="small"
                                sx={{
                                  height: 16,
                                  fontSize: '0.5rem',
                                  fontWeight: 600,
                                  bgcolor: hasActualAssignment ? '#e3f2fd' : '#fff3e0',
                                  color: hasActualAssignment ? '#1976d2' : '#ff9800'
                                }}
                              />
                              {hasActualAssignment && coverageRatio < 1 && (
                                <Chip
                                  label={`${Math.round(coverageRatio * 100)}%`}
                                  size="small"
                                  sx={{ height: 16, fontSize: '0.5rem', fontWeight: 600, bgcolor: '#fff3e0', color: '#ff9800' }}
                                />
                              )}
                            </Box>
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.7rem', color: '#666' }}>
                            {fmt((bank.totalAssets || 0) * 1000)}
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600, color: '#D97757' }}>
                            {fmt(bank.tam)}
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <Typography sx={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 600, color: '#4caf50' }}>
                                {hasActualAssignment ? fmt(teamCapacity) : '—'}
                              </Typography>
                              {hasActualAssignment && coverageRatio < 1 && (
                                <Typography sx={{ fontSize: '0.55rem', color: '#ff9800' }}>
                                  {Math.round(coverageRatio * 100)}% coverage
                                </Typography>
                              )}
                              {hasActualAssignment && coverageRatio >= 1 && (
                                <Typography sx={{ fontSize: '0.55rem', color: '#4caf50' }}>
                                  100% coverage
                                </Typography>
                              )}
                            </Box>
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: bank.tamAsOpExPct > 0.10 ? '#f44336' : bank.tamAsOpExPct > 0.05 ? '#ff9800' : '#4caf50' }}>
                              {bank.tamAsOpExPct !== null ? `${(bank.tamAsOpExPct * 100).toFixed(1)}%` : '—'}
                            </Typography>
                          </td>
                          {/* Winnable RRR columns */}
                          <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.65rem', color: '#4caf50', backgroundColor: idx % 2 === 0 ? '#f8fcf8' : '#f0f7f0', borderLeft: '1px solid #e0e0e0' }}>
                            {fmt(bank.yearlyRevenue?.y1)}
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.65rem', color: '#2196f3', backgroundColor: idx % 2 === 0 ? '#f8fcfc' : '#f0f5fa' }}>
                            {fmt(bank.yearlyRevenue?.y2)}
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.65rem', color: '#D97757', backgroundColor: idx % 2 === 0 ? '#fcf8f8' : '#faf0f0' }}>
                            {fmt(bank.yearlyRevenue?.y3)}
                          </td>
                          {/* Resourced to Win columns */}
                          <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.65rem', fontWeight: 600, color: '#4caf50', backgroundColor: idx % 2 === 0 ? '#fff8f0' : '#fff3e8', borderLeft: '1px solid #e0e0e0' }}>
                            {fmt(resourcedY1)}
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.65rem', fontWeight: 600, color: '#2196f3', backgroundColor: idx % 2 === 0 ? '#fff8f0' : '#fff3e8' }}>
                            {fmt(resourcedY2)}
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 700, color: '#D97757', backgroundColor: idx % 2 === 0 ? '#fff8f0' : '#fff3e8' }}>
                            {fmt(resourcedY3)}
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); navigate(`/bank/${bank.idrssd}?tab=tam`); }}
                              sx={{ '&:hover': { color: '#D97757' }, p: 0.5 }}
                            >
                              <OpenInNewIcon sx={{ fontSize: 12 }} />
                            </IconButton>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Tier Totals Row */}
                    <tr style={{ backgroundColor: tierColor + '10', borderTop: '2px solid ' + tierColor }}>
                      <td colSpan={2} style={{ padding: '8px 12px', fontWeight: 700, fontSize: '0.8rem', color: tierColor }}>
                        {TIER_LABELS[tier]} Total
                      </td>
                      <td style={{ padding: '6px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700, color: '#D97757' }}>
                        {fmt(tierTAM)}
                      </td>
                      <td style={{ padding: '6px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700, color: '#4caf50' }}>
                        {fmt(tierTeamCapacity)}
                      </td>
                      <td></td>
                      <td style={{ padding: '6px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 600, color: '#4caf50', backgroundColor: '#f0f7f0', borderLeft: '1px solid #e0e0e0' }}>
                        {fmt(tierWinnable.y1)}
                      </td>
                      <td style={{ padding: '6px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 600, color: '#2196f3', backgroundColor: '#f0f5fa' }}>
                        {fmt(tierWinnable.y2)}
                      </td>
                      <td style={{ padding: '6px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 600, color: '#D97757', backgroundColor: '#faf0f0' }}>
                        {fmt(tierWinnable.y3)}
                      </td>
                      <td style={{ padding: '6px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 700, color: '#4caf50', backgroundColor: '#fff3e8', borderLeft: '1px solid #e0e0e0' }}>
                        {fmt(tierResourced.y1)}
                      </td>
                      <td style={{ padding: '6px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.7rem', fontWeight: 700, color: '#2196f3', backgroundColor: '#fff3e8' }}>
                        {fmt(tierResourced.y2)}
                      </td>
                      <td style={{ padding: '6px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700, color: '#D97757', backgroundColor: '#fff3e8' }}>
                        {fmt(tierResourced.y3)}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </Box>
            )}
          </Box>
        );
      })}

      {/* Grand Total */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, bgcolor: '#fff8f0', border: '2px solid #D97757', borderRadius: 1, mt: 2 }}>
        <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>TOTAL ({coverage.coveredBankCount} banks)</Typography>
        <Box sx={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.85rem', color: '#666' }}>TAM: <strong style={{ fontFamily: 'monospace' }}>{fmt(coverage.tamCovered)}</strong></Typography>
          <Typography sx={{ fontSize: '0.85rem', color: '#666' }}>Team: <strong style={{ color: '#D97757' }}>{teamTotals.aes}</strong> AE + <strong style={{ color: '#1976d2' }}>{teamTotals.ses}</strong> SE</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: '#D97757' }}>2028 RRR: <strong style={{ fontFamily: 'monospace' }}>{fmt(adjustedRRR.rrr2028 || rrr2028)}</strong></Typography>
        </Box>
      </Box>
    </Box>
  );
}

// Team Coverage Tab - Assign team members to accounts
function TeamCoverageTab({ teamSizingData, onRefresh, coveredBanks = [], navigate }) {
  const [roster, setRoster] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', role: 'AE', assignedTier: '' });

  // Local state for hiring plan display (read-only, from roster)
  const [hiringPlanData, setHiringPlanData] = useState({});

  // Fetch roster data from new API
  const fetchRoster = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/tam/roster');
      setRoster(res.data);
      // Load hiring plan data for headcount timeline display
      const planData = {};
      for (const plan of res.data.segmentHiringPlan || []) {
        planData[plan.quarter] = plan.bySegment;
      }
      setHiringPlanData(planData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching roster:', err);
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoster(); }, []);

  // Add new team member
  const handleAddMember = async () => {
    if (!newMember.name.trim()) return;
    try {
      setSaving(true);
      await axios.post('/api/tam/roster/members', {
        name: newMember.name,
        role: newMember.role,
        assignedTier: newMember.assignedTier || null
      });
      setNewMember({ name: '', role: 'AE', assignedTier: '' });
      await fetchRoster();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error adding member:', err);
    }
    setSaving(false);
  };

  // Update team member
  const handleUpdateMember = async (memberId, updates) => {
    try {
      await axios.put(`/api/tam/roster/members/${memberId}`, updates);
      await fetchRoster();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error updating member:', err);
    }
  };

  // Remove team member
  const handleRemoveMember = async (memberId) => {
    try {
      await axios.delete(`/api/tam/roster/members/${memberId}`);
      await fetchRoster();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error removing member:', err);
    }
  };

  // Update roster assumptions (like reactive capture rate)
  const handleAssumptionChange = async (field, value) => {
    try {
      await axios.put('/api/tam/roster/assumptions', { [field]: value });
      await fetchRoster();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error updating assumption:', err);
    }
  };

  // Auto-assign team members to accounts with highest TAM in their segment
  const autoAssignToAccounts = async () => {
    setAutoAssigning(true);
    try {
      const members = roster?.members || [];

      // Get all active members (both hired and planned) who have a segment
      const assignableMembers = members.filter(m => m.isActive && m.assignedTier);

      // Group banks by tier and sort by TAM (highest first)
      const banksByTier = {};
      for (const tier of TIERS) {
        banksByTier[tier] = coveredBanks
          .filter(b => b.tier === tier)
          .sort((a, b) => (b.tam || 0) - (a.tam || 0));
      }

      // Track all assigned bank IDs across all members
      const allAssignedBankIds = new Set();
      for (const m of assignableMembers) {
        for (const a of m.accountAssignments || []) {
          allAssignedBankIds.add(a.idrssd);
        }
      }

      // For each member, assign to unassigned banks in their segment
      for (const member of assignableMembers) {
        const tier = member.assignedTier;
        const tierBanks = banksByTier[tier] || [];

        // Find unassigned banks for this tier
        const unassignedBanks = tierBanks.filter(b => !allAssignedBankIds.has(b.idrssd));

        // Get current assignments for this member
        const currentAssignments = member.accountAssignments || [];

        // Add next highest TAM unassigned bank if member has capacity
        const maxAccounts = member.role === 'AE' ? 5 : 3;
        if (currentAssignments.length < maxAccounts && unassignedBanks.length > 0) {
          const bankToAssign = unassignedBanks[0];
          // Ensure TAM is always stored as a number
          const tamValue = typeof bankToAssign.tam === 'object' ? (bankToAssign.tam?.total || 0) : (bankToAssign.tam || 0);
          const newAssignments = [
            ...currentAssignments,
            { idrssd: bankToAssign.idrssd, bankName: bankToAssign.bankName, tier: bankToAssign.tier, tam: tamValue }
          ];

          await axios.put(`/api/tam/roster/members/${member._id}/assignments`, { assignments: newAssignments });

          // Update local tracking
          allAssignedBankIds.add(bankToAssign.idrssd);
        }
      }

      await fetchRoster();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to auto-assign:', err);
    }
    setAutoAssigning(false);
  };

  const capacityAnalysis = teamSizingData?.capacityAnalysis;

  if (loading || !roster) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress sx={{ color: '#D97757' }} /></Box>;
  }

  // Include both hired members and planned hires (from generate team)
  const activeMembers = roster.members?.filter(m => m.isActive) || [];
  const hiredMembers = activeMembers.filter(m => !m.isPlannedHire);
  const plannedMembers = activeMembers.filter(m => m.isPlannedHire);
  const activeAEs = activeMembers.filter(m => m.role === 'AE');
  const activeSEs = activeMembers.filter(m => m.role === 'SE');
  const { targetBySegment, gapBySegment, currentBySegment } = roster;

  // Calculate total planned hires
  const getTotalPlannedHires = () => {
    let totalAEs = 0, totalSEs = 0;
    for (const q of QUARTERS) {
      for (const tier of TIERS) {
        totalAEs += hiringPlanData[q]?.[tier]?.aes || 0;
        totalSEs += hiringPlanData[q]?.[tier]?.ses || 0;
      }
    }
    return { aes: totalAEs, ses: totalSEs, total: totalAEs + totalSEs };
  };
  const totalPlanned = getTotalPlannedHires();

  // Calculate TAM and RRR for each team member based on their assigned accounts
  const getMemberMetrics = (member) => {
    const assignments = member.accountAssignments || [];
    // Handle both old data (tam as object) and new data (tam as number)
    const totalTAM = assignments.reduce((sum, a) => {
      const tamValue = typeof a.tam === 'object' ? (a.tam?.total || 0) : (a.tam || 0);
      return sum + tamValue;
    }, 0);

    // Get penetration rates from global assumptions (default to standard rates)
    const penetration2028 = 0.15; // 15% penetration for 2028

    // Calculate winnable RRR (TAM * penetration rate)
    const winnableRRR = totalTAM * penetration2028;

    // Resourced to Win is based on capacity - simplified as the winnable amount they can actually handle
    // For now, assume 1 AE can handle full winnable of their assigned accounts
    const resourcedToWin = winnableRRR;

    return { totalTAM, winnableRRR, resourcedToWin, accountCount: assignments.length };
  };

  // Calculate team totals
  const teamTotals = activeMembers.reduce((totals, member) => {
    const metrics = getMemberMetrics(member);
    return {
      totalTAM: totals.totalTAM + metrics.totalTAM,
      winnableRRR: totals.winnableRRR + metrics.winnableRRR,
      resourcedToWin: totals.resourcedToWin + metrics.resourcedToWin,
      accountCount: totals.accountCount + metrics.accountCount
    };
  }, { totalTAM: 0, winnableRRR: 0, resourcedToWin: 0, accountCount: 0 });

  return (
    <Box>
      {/* Team Summary Header */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, border: '2px solid #D97757', borderRadius: 2, bgcolor: '#fff8f0' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#333' }}>Team Coverage Summary</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Chip label={`${hiredMembers.length} Hired`} sx={{ bgcolor: '#4caf50', color: '#fff', fontWeight: 600 }} />
            {plannedMembers.length > 0 && (
              <Chip label={`${plannedMembers.length} Planned`} sx={{ bgcolor: '#ff9800', color: '#fff', fontWeight: 600 }} />
            )}
            <Chip label={`${activeAEs.length} AE`} sx={{ bgcolor: '#D97757', color: '#fff', fontWeight: 600 }} />
            <Chip label={`${activeSEs.length} SE`} sx={{ bgcolor: '#1976d2', color: '#fff', fontWeight: 600 }} />
            <Button
              variant="contained"
              size="small"
              startIcon={autoAssigning ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon />}
              onClick={autoAssignToAccounts}
              disabled={autoAssigning || activeMembers.length === 0}
              sx={{ bgcolor: '#D97757', '&:hover': { bgcolor: '#c86747' }, ml: 1 }}
            >
              {autoAssigning ? 'Assigning...' : 'Auto-Assign'}
            </Button>
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
          <Box>
            <Typography sx={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase' }}>Team Members</Typography>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a' }}>{activeMembers.length}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase' }}>Accounts Covered</Typography>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a' }}>{teamTotals.accountCount}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase' }}>Total TAM Covered</Typography>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#4caf50' }}>{fmt(teamTotals.totalTAM)}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase' }}>Resourced to Win (2028)</Typography>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#D97757' }}>{fmt(teamTotals.resourcedToWin)}</Typography>
          </Box>
        </Box>
      </Paper>

      {/* Add New Member */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, mr: 2 }}>Add Team Member:</Typography>
          <TextField
            size="small"
            placeholder="Name"
            value={newMember.name}
            onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
            sx={{ width: 150 }}
          />
          <TextField
            select
            size="small"
            value={newMember.role}
            onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
            SelectProps={{ native: true }}
            sx={{ width: 70 }}
          >
            <option value="AE">AE</option>
            <option value="SE">SE</option>
          </TextField>
          <TextField
            select
            size="small"
            value={newMember.assignedTier}
            onChange={(e) => setNewMember({ ...newMember, assignedTier: e.target.value })}
            SelectProps={{ native: true }}
            sx={{ width: 120 }}
          >
            <option value="">Segment</option>
            {TIERS.map(tier => (
              <option key={tier} value={tier}>{TIER_LABELS[tier]}</option>
            ))}
          </TextField>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddMember}
            disabled={saving || !newMember.name.trim()}
            sx={{ bgcolor: '#D97757', '&:hover': { bgcolor: '#c86747' } }}
          >
            Add
          </Button>
        </Box>
      </Paper>

      {/* Team Members Table */}
      <Paper elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#fafafa' }}>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', width: 60 }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Segment</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', width: 80 }}>Status</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.75rem', width: 80 }}>Accounts</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', bgcolor: '#f0fff0' }}>TAM</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', bgcolor: '#fff8f0' }}>R2W RRR</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Assigned Accounts</TableCell>
                <TableCell sx={{ width: 50 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {activeMembers.map(member => {
                const metrics = getMemberMetrics(member);
                const tierColor = TIER_COLORS[member.assignedTier] || '#999';
                const isPlanned = member.isPlannedHire;

                return (
                  <TableRow
                    key={member._id}
                    hover
                    sx={{
                      cursor: 'pointer',
                      bgcolor: isPlanned ? '#fffdf5' : 'inherit',
                      '&:hover': { bgcolor: isPlanned ? '#fff8e8' : '#f5f5f5' }
                    }}
                    onClick={() => navigate(`/tam/member/${member._id}`)}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{
                          width: 32, height: 32, borderRadius: '50%',
                          bgcolor: member.role === 'AE' ? '#D97757' : '#1976d2',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontWeight: 700, fontSize: '0.7rem',
                          opacity: isPlanned ? 0.7 : 1
                        }}>
                          {member.role}
                        </Box>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{member.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={member.role}
                        size="small"
                        sx={{
                          height: 20, fontSize: '0.65rem',
                          bgcolor: member.role === 'AE' ? '#D97757' : '#1976d2',
                          color: '#fff', fontWeight: 600
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 10, height: 10, bgcolor: tierColor, borderRadius: '2px' }} />
                        <Typography sx={{ fontSize: '0.8rem', color: tierColor, fontWeight: 500 }}>
                          {TIER_LABELS[member.assignedTier] || 'Unassigned'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {isPlanned ? (
                        <Chip
                          label={member.plannedStartQuarter || 'Planned'}
                          size="small"
                          sx={{ height: 20, fontSize: '0.6rem', bgcolor: '#fff3e0', color: '#ff9800', fontWeight: 600 }}
                        />
                      ) : (
                        <Chip
                          label="Hired"
                          size="small"
                          sx={{ height: 20, fontSize: '0.6rem', bgcolor: '#e8f5e9', color: '#4caf50', fontWeight: 600 }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{metrics.accountCount}</Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ bgcolor: '#f0fff0' }}>
                      <Typography sx={{ fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 600, color: '#4caf50' }}>
                        {fmt(metrics.totalTAM)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ bgcolor: '#fff8f0' }}>
                      <Typography sx={{ fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 600, color: '#D97757' }}>
                        {fmt(metrics.resourcedToWin)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {metrics.accountCount > 0 ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {member.accountAssignments.slice(0, 3).map((a, i) => (
                            <Chip
                              key={i}
                              label={a.bankName}
                              size="small"
                              sx={{ fontSize: '0.6rem', height: 18, bgcolor: '#f5f5f5' }}
                            />
                          ))}
                          {member.accountAssignments.length > 3 && (
                            <Chip
                              label={`+${member.accountAssignments.length - 3}`}
                              size="small"
                              sx={{ fontSize: '0.6rem', height: 18, bgcolor: '#e0e0e0' }}
                            />
                          )}
                        </Box>
                      ) : (
                        <Typography sx={{ fontSize: '0.75rem', color: '#999', fontStyle: 'italic' }}>
                          Click to assign
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); handleRemoveMember(member._id); }}
                        sx={{ color: '#ccc', '&:hover': { color: '#f44336' } }}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Totals Row */}
              {activeMembers.length > 0 && (
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell colSpan={4} sx={{ fontWeight: 700, fontSize: '0.8rem' }}>
                    TOTAL ({activeMembers.length} members)
                  </TableCell>
                  <TableCell align="center">
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 700 }}>{teamTotals.accountCount}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#e8f5e9' }}>
                    <Typography sx={{ fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 700, color: '#4caf50' }}>
                      {fmt(teamTotals.totalTAM)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#fff3e0' }}>
                    <Typography sx={{ fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 700, color: '#D97757' }}>
                      {fmt(teamTotals.resourcedToWin)}
                    </Typography>
                  </TableCell>
                  <TableCell colSpan={2}></TableCell>
                </TableRow>
              )}

              {activeMembers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} sx={{ textAlign: 'center', py: 4, color: '#999' }}>
                    No team members yet. Add team members above to start assigning accounts.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

// Pipeline Tab - Revenue forecast vs capacity-based capture
function PipelineTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pipelineData, setPipelineData] = useState(null);

  useEffect(() => {
    fetchPipeline();
  }, []);

  const fetchPipeline = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/tam/pipeline');
      setPipelineData(response.data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
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
        <Button onClick={fetchPipeline} startIcon={<RefreshIcon />} sx={{ mt: 2 }}>Retry</Button>
      </Box>
    );
  }

  const coverage = pipelineData?.coverage || {};
  const yearlyData = pipelineData?.yearlyData || {};

  // Build chart data for ALL quarters
  const allQuarters = [
    '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4',
    '2027-Q1', '2027-Q2', '2027-Q3', '2027-Q4',
    '2028-Q1', '2028-Q2', '2028-Q3', '2028-Q4'
  ];

  const allChartData = allQuarters.map(q => {
    const qData = pipelineData?.quarterlyData?.[q] || {};
    const year = q.slice(0, 4);
    const qtr = q.slice(-2);
    return {
      quarter: q,
      quarterLabel: `${qtr}'${year.slice(2)}`,
      year,
      fullCoverage: qData.fullCoverageRevenue || 0,
      capacityBased: qData.capacityBasedRevenue || 0,
      gap: qData.gap || 0,
      headcount: qData.headcount || 0,
      effectiveHeadcount: qData.effectiveHeadcount || 0,
      newHires: qData.newHires || 0
    };
  });

  // Group by year for the table
  const dataByYear = {
    '2026': allChartData.filter(d => d.year === '2026'),
    '2027': allChartData.filter(d => d.year === '2027'),
    '2028': allChartData.filter(d => d.year === '2028')
  };

  const yearColors = {
    '2026': { color: '#4caf50', bgColor: '#e8f5e9' },
    '2027': { color: '#2196f3', bgColor: '#e3f2fd' },
    '2028': { color: '#D97757', bgColor: '#fff3e0' }
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '1.25rem', fontWeight: 600, color: '#1a1a1a' }}>
          Revenue Pipeline
        </Typography>
      </Box>

      {/* Pipeline Summary - All Years at Once (like BanksTab) */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: '#fff' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          {/* Account Coverage TAM */}
          <Box sx={{ textAlign: 'center', flex: 1, px: 2, py: 1.5, bgcolor: '#fff8f0', borderRadius: 1, border: '2px solid #D97757' }}>
            <Typography sx={{ fontSize: '0.65rem', color: '#D97757', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>Account Coverage TAM</Typography>
            <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: '#D97757', lineHeight: 1 }}>{fmt(coverage.tamCovered)}</Typography>
            <Typography sx={{ fontSize: '0.6rem', color: '#666' }}>Top {coverage.coveredBankCount} banks</Typography>
          </Box>

          <Box sx={{ px: 1, color: '#D97757', fontSize: '1.5rem' }}>›</Box>

          {/* RRR by Year - All 3 Years Visible */}
          <Box sx={{ flex: 2.5, display: 'flex', gap: 1 }}>
            {[
              { year: '2026', color: '#4caf50', bgColor: '#e8f5e9' },
              { year: '2027', color: '#2196f3', bgColor: '#e3f2fd' },
              { year: '2028', color: '#D97757', bgColor: '#fff3e0', highlight: true }
            ].map(({ year, color, bgColor, highlight }) => {
              const yd = yearlyData[year] || {};
              const winnable = yd.fullCoverageRevenue || 0;
              const resourced = yd.capacityBasedRevenue || 0;
              const capture = winnable > 0 ? resourced / winnable : 0;
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
                    </Box>
                    <Box sx={{ borderTop: '1px dashed #ccc', pt: 0.5 }}>
                      <Typography sx={{ fontSize: '0.55rem', color, textTransform: 'uppercase', fontWeight: 600 }}>Resourced to Win</Typography>
                      <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color, lineHeight: 1.1 }}>{fmt(resourced)}</Typography>
                      <Typography sx={{ fontSize: '0.55rem', color: '#666' }}>{fmtPct(capture)} of winnable</Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* 3-Year Gap Summary */}
        <Box sx={{ pt: 2, borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.7rem', color: '#666' }}>
            <strong>{pipelineData?.roster?.currentMembers || 0}</strong> current headcount
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: '#f44336' }}>
            {fmt((yearlyData['2026']?.fullCoverageRevenue || 0) + (yearlyData['2027']?.fullCoverageRevenue || 0) + (yearlyData['2028']?.fullCoverageRevenue || 0) -
                 (yearlyData['2026']?.capacityBasedRevenue || 0) - (yearlyData['2027']?.capacityBasedRevenue || 0) - (yearlyData['2028']?.capacityBasedRevenue || 0))} 3-year RRR gap
          </Typography>
        </Box>
      </Paper>

      {/* Charts - All 12 Quarters */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mb: 4 }}>
        {/* Revenue Comparison Chart */}
        <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 2, color: '#333' }}>
            Winnable RRR vs Resourced to Win (All Quarters)
          </Typography>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={allChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="quarterLabel" tick={{ fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#e0e0e0' }} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(v)} width={55} />
              <Tooltip formatter={(value) => fmt(value)} contentStyle={{ fontSize: '0.75rem' }} />
              <Area type="monotone" dataKey="fullCoverage" name="Winnable RRR" stroke="#ccc" fill="#f5f5f5" fillOpacity={1} />
              <Area type="monotone" dataKey="capacityBased" name="Resourced to Win" stroke="#D97757" fill="#D97757" fillOpacity={0.7} />
            </AreaChart>
          </ResponsiveContainer>
          <Box sx={{ display: 'flex', gap: 2, mt: 1, justifyContent: 'center' }}>
            <Typography sx={{ fontSize: '0.6rem', color: '#666' }}><Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, bgcolor: '#f5f5f5', border: '1px solid #ccc', mr: 0.5, verticalAlign: 'middle' }} />Winnable RRR</Typography>
            <Typography sx={{ fontSize: '0.6rem', color: '#666' }}><Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, bgcolor: '#D97757', mr: 0.5, verticalAlign: 'middle' }} />Resourced to Win</Typography>
          </Box>
        </Box>

        {/* Headcount Chart */}
        <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 2, color: '#333' }}>
            Headcount vs Effective Capacity (All Quarters)
          </Typography>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={allChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="quarterLabel" tick={{ fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#e0e0e0' }} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip formatter={(value, name) => [typeof value === 'number' ? value.toFixed(1) : value, name]} contentStyle={{ fontSize: '0.75rem' }} />
              <Area type="monotone" dataKey="headcount" name="Total Headcount" stroke="#1976d2" fill="#e3f2fd" fillOpacity={1} />
              <Area type="monotone" dataKey="effectiveHeadcount" name="Effective (Ramped)" stroke="#4caf50" fill="#4caf50" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
          <Box sx={{ display: 'flex', gap: 2, mt: 1, justifyContent: 'center' }}>
            <Typography sx={{ fontSize: '0.6rem', color: '#666' }}><Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, bgcolor: '#e3f2fd', border: '1px solid #1976d2', mr: 0.5, verticalAlign: 'middle' }} />Total Headcount</Typography>
            <Typography sx={{ fontSize: '0.6rem', color: '#666' }}><Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, bgcolor: '#4caf50', mr: 0.5, verticalAlign: 'middle' }} />Effective (Ramped)</Typography>
          </Box>
        </Box>
      </Box>

      {/* Quarterly Breakdown Table - All Years Grouped */}
      <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, overflow: 'hidden' }}>
        <Box sx={{ p: 2, bgcolor: '#fafafa', borderBottom: '1px solid #e0e0e0' }}>
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#333' }}>Quarterly Breakdown</Typography>
          <Typography sx={{ fontSize: '0.7rem', color: '#666', mt: 0.5 }}>
            New hires take {(pipelineData?.roster?.assumptions?.rampQuarters || 2) * 3} months to ramp (mid-quarter start → 0% that quarter → {(pipelineData?.roster?.assumptions?.rampQuarters || 2) >= 2 ? `${Math.round(100/(pipelineData?.roster?.assumptions?.rampQuarters || 2))}% next quarter → ` : ''}100% after {pipelineData?.roster?.assumptions?.rampQuarters || 2} quarters)
          </Typography>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#666' }}>Quarter</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#999' }}>Winnable RRR</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#D97757' }}>Resourced to Win</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#f44336' }}>Gap</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#4caf50' }}>Capture %</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#1976d2' }}>Headcount</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#4caf50' }}>Effective</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#ff9800' }}>New Hires</th>
              </tr>
            </thead>
            <tbody>
              {['2026', '2027', '2028'].map(year => {
                const yearRows = dataByYear[year];
                const { color, bgColor } = yearColors[year];
                const yearTotals = yearlyData[year] || {};
                const yearCapture = yearTotals.fullCoverageRevenue > 0
                  ? yearTotals.capacityBasedRevenue / yearTotals.fullCoverageRevenue
                  : 0;

                return (
                  <React.Fragment key={year}>
                    {yearRows.map((row, idx) => {
                      const rowCapture = row.fullCoverage > 0 ? row.capacityBased / row.fullCoverage : 0;
                      return (
                        <tr key={row.quarter} style={{ borderBottom: '1px solid #f0f0f0', backgroundColor: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 500, fontSize: '0.85rem' }}>{row.quarterLabel}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#999', fontSize: '0.85rem' }}>{fmt(row.fullCoverage)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#D97757', fontSize: '0.85rem' }}>{fmt(row.capacityBased)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#f44336', fontSize: '0.85rem' }}>{fmt(row.gap)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <Box
                              sx={{
                                display: 'inline-block',
                                px: 0.75,
                                py: 0.25,
                                borderRadius: 1,
                                bgcolor: rowCapture >= 0.8 ? '#e8f5e9' : rowCapture >= 0.5 ? '#fff3e0' : '#ffebee',
                                color: rowCapture >= 0.8 ? '#4caf50' : rowCapture >= 0.5 ? '#ff9800' : '#f44336',
                                fontWeight: 600,
                                fontSize: '0.7rem'
                              }}
                            >
                              {fmtPct(rowCapture)}
                            </Box>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'monospace', color: '#1976d2', fontSize: '0.85rem' }}>{row.headcount}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'monospace', color: '#4caf50', fontSize: '0.85rem' }}>{row.effectiveHeadcount?.toFixed(1)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {row.newHires > 0 && (
                              <Chip label={`+${row.newHires}`} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#fff3e0', color: '#ff9800' }} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Year Total Row */}
                    <tr style={{ borderTop: `2px solid ${color}`, borderBottom: '2px solid #e0e0e0', backgroundColor: bgColor }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color }}>{year} Total</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#666' }}>{fmt(yearTotals.fullCoverageRevenue)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color, fontSize: '1rem' }}>{fmt(yearTotals.capacityBasedRevenue)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#f44336' }}>{fmt(yearTotals.gap)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <Box sx={{ display: 'inline-block', px: 1, py: 0.25, borderRadius: 1, bgcolor: color, color: '#fff', fontWeight: 700, fontSize: '0.75rem' }}>
                          {fmtPct(yearCapture)}
                        </Box>
                      </td>
                      <td colSpan={3} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '0.75rem', color: '#666' }}>
                        Exit: {yearTotals.exitHeadcount} HC / {yearTotals.exitEffectiveHeadcount?.toFixed(1)} effective
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </Box>
      </Box>

      {/* Hiring Impact Note */}
      <Box sx={{ mt: 3, p: 2, bgcolor: '#fff8e1', borderRadius: 1, border: '1px solid #ffe082' }}>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#f57c00', mb: 0.5 }}>Hiring Ramp Impact</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: '#666' }}>
          New hires start <strong>mid-quarter</strong> and take <strong>{(pipelineData?.roster?.assumptions?.rampQuarters || 2) * 3} months</strong> ({pipelineData?.roster?.assumptions?.rampQuarters || 2} quarters) to become fully productive.
          In their hire quarter: 0% productive.{(pipelineData?.roster?.assumptions?.rampQuarters || 2) >= 2 ? ` First full quarter after: ${Math.round(100/(pipelineData?.roster?.assumptions?.rampQuarters || 2))}% productive.` : ''} From Q+{pipelineData?.roster?.assumptions?.rampQuarters || 2} onward: 100% productive.
          "Effective Headcount" reflects this ramp, showing actual selling capacity.
        </Typography>
      </Box>
    </Box>
  );
}

// Global Assumptions Tab
const SEGMENTS = ['Mega', 'Strategic', 'Enterprise', 'Commercial', 'SmallBusiness'];

function GlobalAssumptionsTab({ globalData, onSave }) {
  const [assumptions, setAssumptions] = useState(null);
  const [penetrationBySegment, setPenetrationBySegment] = useState(null);
  const [teamSizing, setTeamSizing] = useState(null);
  const [rosterAssumptions, setRosterAssumptions] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState('Mega');

  useEffect(() => {
    if (globalData) {
      setAssumptions(globalData.assumptions);
      setPenetrationBySegment(globalData.penetrationBySegment);
      setTeamSizing(globalData.teamSizing);
    }
  }, [globalData]);

  // Fetch roster assumptions separately (for reactiveCaptureRate)
  useEffect(() => {
    const fetchRosterAssumptions = async () => {
      try {
        const res = await axios.get('/api/tam/roster');
        setRosterAssumptions(res.data?.assumptions || { reactiveCaptureRate: 0.10 });
      } catch (err) {
        console.error('Error fetching roster assumptions:', err);
        setRosterAssumptions({ reactiveCaptureRate: 0.10 });
      }
    };
    fetchRosterAssumptions();
  }, []);

  const handleAssumptionChange = (category, field, value) => {
    setAssumptions(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: { ...prev[category]?.[field], value: parseFloat(value) || 0 }
      }
    }));
  };

  const handleSegmentPenetrationChange = (segment, product, quarter, value) => {
    setPenetrationBySegment(prev => ({
      ...prev,
      [segment]: {
        ...prev?.[segment],
        [product]: {
          ...prev?.[segment]?.[product],
          [quarter]: { ...prev?.[segment]?.[product]?.[quarter], target: parseFloat(value) / 100 || 0 }
        }
      }
    }));
  };

  const handleTeamSizingChange = (field, value) => {
    setTeamSizing(prev => ({
      ...prev,
      [field]: { ...prev?.[field], value: parseFloat(value) || 0 }
    }));
  };

  const handleRosterAssumptionChange = (field, value) => {
    setRosterAssumptions(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    // Save TAM assumptions
    await onSave({ assumptions, penetrationBySegment, teamSizing });
    // Save roster assumptions (reactiveCaptureRate)
    if (rosterAssumptions) {
      try {
        await axios.put('/api/tam/roster/assumptions', {
          reactiveCaptureRate: rosterAssumptions.reactiveCaptureRate
        });
      } catch (err) {
        console.error('Error saving roster assumptions:', err);
      }
    }
    setSaving(false);
  };

  const getValue = (category, field) => assumptions?.[category]?.[field]?.value || 0;
  const getSegmentPen = (segment, product, quarter) => (penetrationBySegment?.[segment]?.[product]?.[quarter]?.target || 0) * 100;
  const getTeamVal = (field) => teamSizing?.[field]?.value || 0;

  if (!assumptions || !penetrationBySegment) {
    return <CircularProgress sx={{ color: '#D97757' }} />;
  }

  return (
    <Box>
      <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #e0e0e0' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 600 }}>TAM Calculation Parameters</Typography>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            sx={{ bgcolor: '#D97757', '&:hover': { bgcolor: '#c86747' } }}
          >
            {saving ? 'Saving...' : 'Save All Changes'}
          </Button>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3 }}>
          {PRODUCTS.map(product => (
            <Box key={product.key}>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: product.color, mb: 1 }}>{product.fullLabel}</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {product.key === 'claudeCode' && (
                  <>
                    <TextField label="Price/Month ($)" type="number" size="small" value={getValue('claudeCode', 'pricePerMonth')} onChange={(e) => handleAssumptionChange('claudeCode', 'pricePerMonth', e.target.value)} sx={{ flex: 1 }} />
                    <TextField label="% Developers" type="number" size="small" value={(getValue('claudeCode', 'fteEligibilityRate') * 100).toFixed(0)} onChange={(e) => handleAssumptionChange('claudeCode', 'fteEligibilityRate', parseFloat(e.target.value) / 100)} sx={{ flex: 1 }} InputProps={{ endAdornment: '%' }} />
                  </>
                )}
                {product.key === 'claudeEnterprise' && (
                  <>
                    <TextField label="Price/Month ($)" type="number" size="small" value={getValue('claudeEnterprise', 'pricePerMonth')} onChange={(e) => handleAssumptionChange('claudeEnterprise', 'pricePerMonth', e.target.value)} sx={{ flex: 1 }} />
                    <TextField label="Adoption Rate" type="number" size="small" value={(getValue('claudeEnterprise', 'adoptionRate') * 100).toFixed(0)} onChange={(e) => handleAssumptionChange('claudeEnterprise', 'adoptionRate', parseFloat(e.target.value) / 100)} sx={{ flex: 1 }} InputProps={{ endAdornment: '%' }} />
                  </>
                )}
                {product.key === 'agentsRunBusiness' && (
                  <>
                    <TextField label="Agents/Employee" type="number" size="small" value={getValue('agentsRunBusiness', 'agentsPerEmployee')} onChange={(e) => handleAssumptionChange('agentsRunBusiness', 'agentsPerEmployee', e.target.value)} sx={{ flex: 1 }} />
                    <TextField label="Price/Agent/Month ($)" type="number" size="small" value={getValue('agentsRunBusiness', 'pricePerAgentMonth')} onChange={(e) => handleAssumptionChange('agentsRunBusiness', 'pricePerAgentMonth', e.target.value)} sx={{ flex: 1 }} />
                  </>
                )}
                {product.key === 'agentsGrowBusiness' && (
                  <>
                    <TextField label="% Net Income" type="number" size="small" value={(getValue('agentsGrowBusiness', 'revenueFromAgents') * 100).toFixed(0)} onChange={(e) => handleAssumptionChange('agentsGrowBusiness', 'revenueFromAgents', parseFloat(e.target.value) / 100)} sx={{ flex: 1 }} InputProps={{ endAdornment: '%' }} />
                    <TextField label="Anthropic Share" type="number" size="small" value={(getValue('agentsGrowBusiness', 'anthropicShare') * 100).toFixed(0)} onChange={(e) => handleAssumptionChange('agentsGrowBusiness', 'anthropicShare', parseFloat(e.target.value) / 100)} sx={{ flex: 1 }} InputProps={{ endAdornment: '%' }} />
                  </>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ border: '1px solid #e0e0e0', overflow: 'auto', mb: 3 }}>
        <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', bgcolor: '#fafafa' }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 600, mb: 1 }}>Penetration Schedule by Segment (%)</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#666' }}>
            Different customer segments have different penetration curves. Larger banks (Mega, Strategic) typically adopt faster.
          </Typography>
        </Box>
        {/* Segment Tabs */}
        <Box sx={{ display: 'flex', borderBottom: '1px solid #e0e0e0' }}>
          {SEGMENTS.map(segment => {
            const tierColor = getTierColor(segment);
            const isActive = selectedSegment === segment;
            return (
              <Box
                key={segment}
                onClick={() => setSelectedSegment(segment)}
                sx={{
                  px: 2,
                  py: 1,
                  cursor: 'pointer',
                  borderBottom: isActive ? `3px solid ${tierColor.bg}` : '3px solid transparent',
                  backgroundColor: isActive ? tierColor.bg + '10' : 'transparent',
                  '&:hover': { backgroundColor: tierColor.bg + '10' }
                }}
              >
                <Typography sx={{ fontSize: '0.8rem', fontWeight: isActive ? 600 : 400, color: isActive ? tierColor.bg : '#666' }}>
                  {segment}
                </Typography>
              </Box>
            );
          })}
        </Box>
        {/* Penetration Table for Selected Segment */}
        <Box sx={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', color: '#666', backgroundColor: '#f5f5f5' }}>Product</th>
                {QUARTER_LABELS.map((label, i) => (
                  <th key={i} style={{ padding: '4px', textAlign: 'center', fontWeight: 600, fontSize: '0.7rem', color: '#666', backgroundColor: i < 4 ? '#e8f5e9' : i < 8 ? '#e3f2fd' : '#fff3e0', minWidth: 55 }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PRODUCTS.map(product => (
                <tr key={product.key}>
                  <td style={{ padding: '8px 12px', fontWeight: 600, fontSize: '0.8rem', color: product.color, backgroundColor: '#fafafa' }}>{product.fullLabel}</td>
                  {QUARTERS.map((q) => (
                    <td key={q} style={{ padding: '2px' }}>
                      <input
                        type="number"
                        step="0.1"
                        value={getSegmentPen(selectedSegment, product.key, q).toFixed(1)}
                        onChange={(e) => handleSegmentPenetrationChange(selectedSegment, product.key, q, e.target.value)}
                        style={{ width: '100%', padding: '4px', fontSize: '0.75rem', fontFamily: 'monospace', textAlign: 'center', border: '1px solid #e0e0e0', borderRadius: 2, boxSizing: 'border-box' }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
        {/* Segment Comparison Summary */}
        <Box sx={{ p: 2, bgcolor: '#fafafa', borderTop: '1px solid #e0e0e0' }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, mb: 1, color: '#666' }}>Q4 2028 Penetration Comparison</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {SEGMENTS.map(segment => {
              const tierColor = getTierColor(segment);
              // Average penetration across products for Q4 2028
              const avgPen = PRODUCTS.reduce((sum, p) => sum + getSegmentPen(segment, p.key, '2028-Q4'), 0) / 4;
              return (
                <Box key={segment} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: tierColor.bg }} />
                  <Typography sx={{ fontSize: '0.7rem', color: '#666' }}>
                    {segment}: <strong>{avgPen.toFixed(1)}%</strong>
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Paper>

      {/* Team Sizing Assumptions - Asset-Based Tiers */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid #e0e0e0' }}>
        <Typography sx={{ fontSize: '1rem', fontWeight: 600, mb: 2 }}>Team Sizing Assumptions (Asset-Based Tiers)</Typography>

        {/* Coverage Model */}
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#D97757', mb: 1 }}>Coverage Model</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, maxWidth: 600 }}>
            <TextField
              label="Target Bank Count"
              type="number"
              size="small"
              value={getTeamVal('targetBankCount') || 50}
              onChange={(e) => handleTeamSizingChange('targetBankCount', e.target.value)}
            />
            <TextField
              label="Reactive Capture Rate"
              type="number"
              size="small"
              value={((rosterAssumptions?.reactiveCaptureRate || 0.10) * 100).toFixed(0)}
              onChange={(e) => handleRosterAssumptionChange('reactiveCaptureRate', parseFloat(e.target.value) / 100)}
              inputProps={{ min: 0, max: 100, step: 1 }}
              InputProps={{ endAdornment: '%' }}
              helperText="Win rate for reactive accounts"
            />
          </Box>
          <Typography sx={{ fontSize: '0.7rem', color: '#666', mt: 1 }}>
            Reactive Capture Rate: The percentage of potential revenue captured from accounts without dedicated coverage.
            Banks with assigned AEs/SEs capture 100% of winnable revenue.
          </Typography>
        </Box>

        {/* Asset Tier Thresholds */}
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#1976d2', mb: 1 }}>Asset Tier Thresholds (Total Assets)</Typography>
          <Typography sx={{ fontSize: '0.7rem', color: '#666', mb: 1.5 }}>Banks above each threshold fall into that tier. SmallBusiness = anything below Commercial threshold.</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
            <TextField
              label="Mega ($B)"
              type="number"
              size="small"
              value={(getTeamVal('megaTierThreshold') || 1000000000000) / 1e9}
              onChange={(e) => handleTeamSizingChange('megaTierThreshold', parseFloat(e.target.value) * 1e9)}
              helperText=">$1T"
            />
            <TextField
              label="Strategic ($B)"
              type="number"
              size="small"
              value={(getTeamVal('strategicTierThreshold') || 100000000000) / 1e9}
              onChange={(e) => handleTeamSizingChange('strategicTierThreshold', parseFloat(e.target.value) * 1e9)}
              helperText=">$100B"
            />
            <TextField
              label="Enterprise ($B)"
              type="number"
              size="small"
              value={(getTeamVal('enterpriseTierThreshold') || 30000000000) / 1e9}
              onChange={(e) => handleTeamSizingChange('enterpriseTierThreshold', parseFloat(e.target.value) * 1e9)}
              helperText=">$30B"
            />
            <TextField
              label="Commercial ($B)"
              type="number"
              size="small"
              value={(getTeamVal('commercialTierThreshold') || 10000000000) / 1e9}
              onChange={(e) => handleTeamSizingChange('commercialTierThreshold', parseFloat(e.target.value) * 1e9)}
              helperText=">$10B"
            />
          </Box>
        </Box>

        {/* $ Billion per AE by Tier */}
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#2e7d32', mb: 1 }}>$ Billion in Assets per AE (by Tier)</Typography>
          <Typography sx={{ fontSize: '0.7rem', color: '#666', mb: 1.5 }}>AEs are calculated as: (Tier's Total Assets) / (Billion per AE). Higher values = fewer AEs per asset volume.</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2 }}>
            <TextField
              label="Mega"
              type="number"
              size="small"
              value={getTeamVal('billionPerAE_Mega') || 500}
              onChange={(e) => handleTeamSizingChange('billionPerAE_Mega', e.target.value)}
              helperText="$500B/AE"
              InputProps={{ endAdornment: 'B' }}
            />
            <TextField
              label="Strategic"
              type="number"
              size="small"
              value={getTeamVal('billionPerAE_Strategic') || 250}
              onChange={(e) => handleTeamSizingChange('billionPerAE_Strategic', e.target.value)}
              helperText="$250B/AE"
              InputProps={{ endAdornment: 'B' }}
            />
            <TextField
              label="Enterprise"
              type="number"
              size="small"
              value={getTeamVal('billionPerAE_Enterprise') || 100}
              onChange={(e) => handleTeamSizingChange('billionPerAE_Enterprise', e.target.value)}
              helperText="$100B/AE"
              InputProps={{ endAdornment: 'B' }}
            />
            <TextField
              label="Commercial"
              type="number"
              size="small"
              value={getTeamVal('billionPerAE_Commercial') || 75}
              onChange={(e) => handleTeamSizingChange('billionPerAE_Commercial', e.target.value)}
              helperText="$75B/AE"
              InputProps={{ endAdornment: 'B' }}
            />
            <TextField
              label="SmallBusiness"
              type="number"
              size="small"
              value={getTeamVal('billionPerAE_SmallBusiness') || 50}
              onChange={(e) => handleTeamSizingChange('billionPerAE_SmallBusiness', e.target.value)}
              helperText="$50B/AE"
              InputProps={{ endAdornment: 'B' }}
            />
          </Box>
        </Box>

        {/* SE per AE by Tier */}
        <Box>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#9c27b0', mb: 1 }}>SE per AE Ratio (by Tier)</Typography>
          <Typography sx={{ fontSize: '0.7rem', color: '#666', mb: 1.5 }}>Number of Solution Engineers supporting each Account Executive. Higher-touch tiers need more SE support.</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2 }}>
            <TextField
              label="Mega"
              type="number"
              size="small"
              value={getTeamVal('sePerAE_Mega') || 2.0}
              onChange={(e) => handleTeamSizingChange('sePerAE_Mega', e.target.value)}
              inputProps={{ step: 0.1 }}
              helperText="2.0 SE/AE"
            />
            <TextField
              label="Strategic"
              type="number"
              size="small"
              value={getTeamVal('sePerAE_Strategic') || 1.0}
              onChange={(e) => handleTeamSizingChange('sePerAE_Strategic', e.target.value)}
              inputProps={{ step: 0.1 }}
              helperText="1.0 SE/AE"
            />
            <TextField
              label="Enterprise"
              type="number"
              size="small"
              value={getTeamVal('sePerAE_Enterprise') || 0.5}
              onChange={(e) => handleTeamSizingChange('sePerAE_Enterprise', e.target.value)}
              inputProps={{ step: 0.1 }}
              helperText="0.5 SE/AE"
            />
            <TextField
              label="Commercial"
              type="number"
              size="small"
              value={getTeamVal('sePerAE_Commercial') || 0.25}
              onChange={(e) => handleTeamSizingChange('sePerAE_Commercial', e.target.value)}
              inputProps={{ step: 0.05 }}
              helperText="0.25 SE/AE"
            />
            <TextField
              label="SmallBusiness"
              type="number"
              size="small"
              value={getTeamVal('sePerAE_SmallBusiness') || 0.1}
              onChange={(e) => handleTeamSizingChange('sePerAE_SmallBusiness', e.target.value)}
              inputProps={{ step: 0.05 }}
              helperText="0.1 SE/AE"
            />
          </Box>
        </Box>

        {/* Hiring Ramp */}
        <Box sx={{ mt: 3 }}>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#f57c00', mb: 1 }}>Hiring Ramp</Typography>
          <Typography sx={{ fontSize: '0.7rem', color: '#666', mb: 1.5 }}>
            New hires start mid-quarter and take time to become fully productive.
            Quarter 0 = 0% productive, then linear ramp until fully productive.
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, maxWidth: 400 }}>
            <TextField
              label="Quarters to Full Productivity"
              type="number"
              size="small"
              value={getTeamVal('aeRampQuarters') || 2}
              onChange={(e) => handleTeamSizingChange('aeRampQuarters', e.target.value)}
              inputProps={{ min: 1, max: 4, step: 1 }}
              helperText={`Ramp: Q0=0%${getTeamVal('aeRampQuarters') >= 2 ? `, Q1=${Math.round(100/getTeamVal('aeRampQuarters'))}%` : ''}${getTeamVal('aeRampQuarters') >= 3 ? `, Q2=${Math.round(200/getTeamVal('aeRampQuarters'))}%` : ''}, Q${getTeamVal('aeRampQuarters') || 2}+=100%`}
            />
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

// Main Dashboard
function TAMDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tamData, setTamData] = useState(null);
  const [globalData, setGlobalData] = useState(null);
  const [teamSizingData, setTeamSizingData] = useState(null);
  const [rosterData, setRosterData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  const fetchData = async () => {
    try {
      setLoading(true);
      // First fetch global assumptions to get targetBankCount
      const globalRes = await axios.get('/api/tam/global');
      const targetBankCount = globalRes.data?.teamSizing?.targetBankCount?.value || 50;

      // Then fetch banks, team sizing, and roster
      const [banksRes, teamRes, rosterRes] = await Promise.all([
        axios.get('/api/tam/banks?limit=100&sortBy=tam&sortOrder=desc'),
        axios.get(`/api/tam/team-sizing?targetBankCount=${targetBankCount}`),
        axios.get('/api/tam/roster')
      ]);
      setTamData(banksRes.data);
      setGlobalData(globalRes.data);
      setTeamSizingData(teamRes.data);
      setRosterData(rosterRes.data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveGlobal = async (updates) => {
    try {
      await axios.put('/api/tam/global', updates);
      await fetchData();
    } catch (err) {
      console.error('Error saving global assumptions:', err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: '#D97757' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="error">Error: {error}</Typography>
        <Button onClick={fetchData} startIcon={<RefreshIcon />} sx={{ mt: 2 }}>Retry</Button>
      </Box>
    );
  }

  const { banks, aggregate, period } = tamData || {};

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#1A1A1A' }}>TAM Analysis</Typography>
        <Typography variant="body2" sx={{ color: '#666', mt: 0.5 }}>
          Total Addressable Market • Data as of {period ? new Date(period).toLocaleDateString() : 'N/A'}
        </Typography>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          sx={{
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 500 },
            '& .Mui-selected': { color: '#D97757' },
            '& .MuiTabs-indicator': { backgroundColor: '#D97757' }
          }}
        >
          <Tab label="Banks" />
          <Tab label="Pipeline" icon={<TimelineIcon sx={{ fontSize: 18, ml: 1 }} />} iconPosition="end" />
          <Tab label="Team Coverage" icon={<GroupIcon sx={{ fontSize: 18, ml: 1 }} />} iconPosition="end" />
          <Tab label="Team Capacity Planning" icon={<PeopleIcon sx={{ fontSize: 18, ml: 1 }} />} iconPosition="end" />
          <Tab label="Global Assumptions" icon={<SettingsIcon sx={{ fontSize: 18, ml: 1 }} />} iconPosition="end" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {activeTab === 0 && <BanksTab banks={banks} aggregate={aggregate} period={period} globalData={globalData} teamSizingData={teamSizingData} rosterData={rosterData} navigate={navigate} />}
      {activeTab === 1 && <PipelineTab />}
      {activeTab === 2 && <TeamCoverageTab teamSizingData={teamSizingData} onRefresh={fetchData} coveredBanks={teamSizingData?.coveredBanks || []} navigate={navigate} />}
      {activeTab === 3 && <TeamCapacityPlanningTab />}
      {activeTab === 4 && <GlobalAssumptionsTab globalData={globalData} onSave={handleSaveGlobal} />}
    </Box>
  );
}

export default TAMDashboard;
