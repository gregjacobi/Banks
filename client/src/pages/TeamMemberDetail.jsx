import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Button,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Business as BusinessIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
} from '@mui/icons-material';

// eslint-disable-next-line no-unused-vars
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

// Format currency
const fmt = (v) => {
  if (v === null || v === undefined) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

function TeamMemberDetail() {
  const { memberId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [roster, setRoster] = useState(null);
  const [teamSizingData, setTeamSizingData] = useState(null);
  const [globalData, setGlobalData] = useState(null);
  const [showAddBank, setShowAddBank] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    fetchData();
  }, [memberId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rosterRes, teamSizingRes, globalRes] = await Promise.all([
        axios.get('/api/tam/roster'),
        axios.get('/api/tam/team-sizing'),
        axios.get('/api/tam/global')
      ]);

      setRoster(rosterRes.data);
      setTeamSizingData(teamSizingRes.data);
      setGlobalData(globalRes.data);

      // Find the member
      const foundMember = rosterRes.data.members?.find(m => m._id === memberId);
      setMember(foundMember);
      setNewName(foundMember?.name || '');

      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setLoading(false);
    }
  };

  const handleRemoveAssignment = async (idrssd) => {
    try {
      const newAssignments = member.accountAssignments.filter(a => a.idrssd !== idrssd);
      await axios.put(`/api/tam/roster/members/${memberId}/assignments`, { assignments: newAssignments });
      await fetchData();
    } catch (err) {
      console.error('Error removing assignment:', err);
    }
  };

  const handleAddAssignment = async (bank) => {
    try {
      // Ensure TAM is always stored as a number
      const tamValue = typeof bank.tam === 'object' ? (bank.tam?.total || 0) : (bank.tam || 0);
      const newAssignment = {
        idrssd: bank.idrssd,
        bankName: bank.bankName,
        tier: bank.tier,
        tam: tamValue
      };
      const assignments = [...(member.accountAssignments || []), newAssignment];
      await axios.put(`/api/tam/roster/members/${memberId}/assignments`, { assignments });
      setShowAddBank(false);
      await fetchData();
    } catch (err) {
      console.error('Error adding assignment:', err);
    }
  };

  const handleUpdateName = async () => {
    try {
      await axios.put(`/api/tam/roster/members/${memberId}`, { name: newName });
      setEditingName(false);
      await fetchData();
    } catch (err) {
      console.error('Error updating name:', err);
    }
  };

  const handleMarkAsHired = async () => {
    try {
      await axios.put(`/api/tam/roster/members/${memberId}/hire`, {
        name: member.name,
        startDate: new Date().toISOString()
      });
      await fetchData();
    } catch (err) {
      console.error('Error marking as hired:', err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress sx={{ color: '#D97757' }} />
      </Box>
    );
  }

  if (!member) {
    return (
      <Box sx={{ p: 4 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/tam?tab=2')}>
          Back to Team Coverage
        </Button>
        <Typography sx={{ mt: 2, color: '#666' }}>Team member not found.</Typography>
      </Box>
    );
  }

  // Build lookup map for covered banks (to get actual yearlyRevenue RRR values)
  const coveredBanksMap = {};
  (teamSizingData?.coveredBanks || []).forEach(bank => {
    coveredBanksMap[String(bank.idrssd)] = bank;
  });

  // Get segment assumptions for TAM allocation
  const segmentAssumptions = globalData?.segmentAssumptions?.[member.assignedTier] || {};
  const tamPerAE = segmentAssumptions.tamPerAE || 0;
  const tamPerSE = segmentAssumptions.tamPerSE || 0;
  const allocatedTAMPerPerson = member.role === 'AE' ? tamPerAE : tamPerSE;

  // Calculate account-level metrics
  const accountMetrics = (member.accountAssignments || []).map(account => {
    // Look up the bank's actual data from coveredBanks to get year-end RRR values
    const bankData = coveredBanksMap[String(account.idrssd)];

    // Handle both old data (tam as object) and new data (tam as number)
    const accountTAM = typeof account.tam === 'object' ? (account.tam?.total || 0) : (account.tam || 0);

    // Get bank-specific segment assumptions (use bank's tier, not member's tier)
    const bankTier = account.tier || bankData?.tier;
    const bankSegmentAssumptions = globalData?.segmentAssumptions?.[bankTier] || {};
    const bankTamPerAE = bankSegmentAssumptions.tamPerAE || 0;

    // Allocation: how much of this account's TAM is allocated to this person
    // Based on segment capacity assumption for that bank's tier
    const myTamCapacity = member.role === 'AE' ? bankTamPerAE : (bankSegmentAssumptions.tamPerSE || 0);
    const allocatedTAM = myTamCapacity > 0
      ? Math.min(accountTAM, myTamCapacity)
      : accountTAM;

    // Winnable = Account's actual year-end RRR from yearlyRevenue (already calculated with segment penetration rates)
    const winnableY1 = bankData?.yearlyRevenue?.y1 || 0;
    const winnableY2 = bankData?.yearlyRevenue?.y2 || 0;
    const winnableY3 = bankData?.yearlyRevenue?.y3 || 0;

    // Coverage ratio = (my TAM capacity) / (bank's total TAM)
    // This represents what fraction of the bank I can effectively cover
    const coverageRatio = myTamCapacity > 0 && accountTAM > 0
      ? Math.min(1, myTamCapacity / accountTAM)
      : 1;

    // "Your Cut" = coverage ratio applied to the account's winnable RRR
    // This is the portion of the bank's winnable RRR attributable to this AE/SE
    const yourCutY1 = winnableY1 * coverageRatio;
    const yourCutY2 = winnableY2 * coverageRatio;
    const yourCutY3 = winnableY3 * coverageRatio;

    return {
      ...account,
      accountTAM,
      allocatedTAM,
      coverageRatio,
      winnableY1,
      winnableY2,
      winnableY3,
      yourCutY1,
      yourCutY2,
      yourCutY3
    };
  });

  // Calculate totals
  const totals = accountMetrics.reduce((acc, m) => ({
    accountTAM: acc.accountTAM + m.accountTAM,
    allocatedTAM: acc.allocatedTAM + m.allocatedTAM,
    winnableY1: acc.winnableY1 + m.winnableY1,
    winnableY2: acc.winnableY2 + m.winnableY2,
    winnableY3: acc.winnableY3 + m.winnableY3,
    yourCutY1: acc.yourCutY1 + m.yourCutY1,
    yourCutY2: acc.yourCutY2 + m.yourCutY2,
    yourCutY3: acc.yourCutY3 + m.yourCutY3
  }), {
    accountTAM: 0, allocatedTAM: 0,
    winnableY1: 0, winnableY2: 0, winnableY3: 0,
    yourCutY1: 0, yourCutY2: 0, yourCutY3: 0
  });

  // Get available banks for assignment
  const assignedIds = new Set((member.accountAssignments || []).map(a => a.idrssd));
  const availableBanks = (teamSizingData?.coveredBanks || [])
    .filter(b => !assignedIds.has(b.idrssd))
    .filter(b => !member.assignedTier || b.tier === member.assignedTier)
    .sort((a, b) => (b.tam || 0) - (a.tam || 0));

  const tierColor = TIER_COLORS[member.assignedTier] || '#999';
  const isPlanned = member.isPlannedHire;

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/tam?tab=2')}
          sx={{ color: '#666' }}
        >
          Team Coverage
        </Button>
      </Box>

      {/* Member Info Card */}
      <Paper elevation={0} sx={{
        p: 3, mb: 3,
        border: isPlanned ? `2px dashed ${tierColor}` : `2px solid ${tierColor}`,
        borderRadius: 2,
        bgcolor: isPlanned ? '#fffdf5' : '#fff'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {/* Avatar */}
          <Box sx={{
            width: 64, height: 64, borderRadius: '50%',
            bgcolor: member.role === 'AE' ? '#D97757' : '#1976d2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: '1.5rem',
            opacity: isPlanned ? 0.7 : 1
          }}>
            {member.role}
          </Box>

          {/* Name and details */}
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {editingName ? (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField
                    size="small"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    sx={{ width: 200 }}
                  />
                  <Button size="small" onClick={handleUpdateName}>Save</Button>
                  <Button size="small" onClick={() => setEditingName(false)}>Cancel</Button>
                </Box>
              ) : (
                <>
                  <Typography sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{member.name}</Typography>
                  <IconButton size="small" onClick={() => setEditingName(true)}>
                    <EditIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </>
              )}
              {isPlanned && (
                <Chip label="Planned Hire" sx={{ bgcolor: '#fff3e0', color: '#ff9800', fontWeight: 600 }} />
              )}
              {!isPlanned && (
                <Chip label="Hired" sx={{ bgcolor: '#e8f5e9', color: '#4caf50', fontWeight: 600 }} />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 12, height: 12, bgcolor: tierColor, borderRadius: '2px' }} />
                <Typography sx={{ fontSize: '0.9rem', color: tierColor, fontWeight: 600 }}>
                  {TIER_LABELS[member.assignedTier] || 'Unassigned'}
                </Typography>
              </Box>
              {isPlanned && member.plannedStartQuarter && (
                <Typography sx={{ fontSize: '0.85rem', color: '#666' }}>
                  Starting {member.plannedStartQuarter}
                </Typography>
              )}
              {isPlanned && (
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleMarkAsHired}
                  sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#388e3c' }, ml: 2 }}
                >
                  Mark as Hired
                </Button>
              )}
            </Box>
          </Box>

          {/* Summary metrics */}
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase' }}>Accounts</Typography>
              <Typography sx={{ fontSize: '1.75rem', fontWeight: 700 }}>{accountMetrics.length}</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase' }}>Allocated TAM</Typography>
              <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: '#4caf50' }}>{fmt(totals.allocatedTAM)}</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase' }}>Your Cut 2028</Typography>
              <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: '#D97757' }}>{fmt(totals.yourCutY3)}</Typography>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Capacity Info */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #e0e0e0', borderRadius: 2 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, mb: 1 }}>Capacity Assumptions ({TIER_LABELS[member.assignedTier]})</Typography>
        <Box sx={{ display: 'flex', gap: 4 }}>
          <Typography sx={{ fontSize: '0.8rem', color: '#666' }}>
            TAM per {member.role}: <strong>{fmt(allocatedTAMPerPerson)}</strong>
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: '#666' }}>
            Coverage = min(1, TAM capacity / Account TAM) — "Your Cut" shows your portion of account's year-end RRR
          </Typography>
        </Box>
      </Paper>

      {/* Account Assignments Table */}
      <Paper elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: '1px solid #e0e0e0' }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 600 }}>Account Assignments</Typography>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowAddBank(true)}
            sx={{ bgcolor: '#D97757', '&:hover': { bgcolor: '#c86747' } }}
          >
            Add Account
          </Button>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#fafafa' }}>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Bank</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Account TAM</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Allocated TAM</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', bgcolor: '#f5fff5' }}>Winnable Y1</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', bgcolor: '#f5f5ff' }}>Winnable Y2</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', bgcolor: '#fff5f5' }}>Winnable Y3</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', bgcolor: '#fff8f0' }}>Your Cut Y1</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', bgcolor: '#fff8f0' }}>Your Cut Y2</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', bgcolor: '#fff8f0' }}>Your Cut Y3</TableCell>
                <TableCell sx={{ width: 50 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accountMetrics.map((account) => (
                <TableRow key={account.idrssd} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BusinessIcon sx={{ fontSize: 16, color: TIER_COLORS[account.tier] || '#999' }} />
                      <Box>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 500 }}>{account.bankName}</Typography>
                        <Typography sx={{ fontSize: '0.65rem', color: '#999' }}>{TIER_LABELS[account.tier]}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{fmt(account.accountTAM)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#4caf50', fontWeight: 600 }}>
                      {fmt(account.allocatedTAM)}
                    </Typography>
                    {account.coverageRatio < 1 && (
                      <Typography sx={{ fontSize: '0.6rem', color: '#999' }}>
                        ({(account.coverageRatio * 100).toFixed(0)}% coverage)
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#f5fff5' }}>
                    <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{fmt(account.winnableY1)}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#f5f5ff' }}>
                    <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{fmt(account.winnableY2)}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#fff5f5' }}>
                    <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{fmt(account.winnableY3)}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#fff8f0' }}>
                    <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#D97757', fontWeight: 600 }}>
                      {fmt(account.yourCutY1)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#fff8f0' }}>
                    <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#D97757', fontWeight: 600 }}>
                      {fmt(account.yourCutY2)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#fff8f0' }}>
                    <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#D97757', fontWeight: 600 }}>
                      {fmt(account.yourCutY3)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveAssignment(account.idrssd)}
                      sx={{ color: '#ccc', '&:hover': { color: '#f44336' } }}
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}

              {/* Totals Row */}
              {accountMetrics.length > 0 && (
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.8rem' }}>TOTAL</TableCell>
                  <TableCell align="right">
                    <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(totals.accountTAM)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700, color: '#4caf50' }}>{fmt(totals.allocatedTAM)}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#e8f5e9' }}>
                    <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(totals.winnableY1)}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#e8eaf6' }}>
                    <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(totals.winnableY2)}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#ffebee' }}>
                    <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(totals.winnableY3)}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#fff3e0' }}>
                    <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700, color: '#D97757' }}>{fmt(totals.yourCutY1)}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#fff3e0' }}>
                    <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700, color: '#D97757' }}>{fmt(totals.yourCutY2)}</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#fff3e0' }}>
                    <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 700, color: '#D97757' }}>{fmt(totals.yourCutY3)}</Typography>
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              )}

              {accountMetrics.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} sx={{ textAlign: 'center', py: 4, color: '#999' }}>
                    No accounts assigned. Click "Add Account" to assign banks to this team member.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add Bank Dialog */}
      <Dialog open={showAddBank} onClose={() => setShowAddBank(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Account Assignment</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: '#666', mb: 2 }}>
            Select a bank to assign to {member.name}. Showing banks in {TIER_LABELS[member.assignedTier] || 'all segments'} sorted by TAM.
          </Typography>
          <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
            {availableBanks.slice(0, 50).map(bank => (
              <Box
                key={bank.idrssd}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 2, py: 1.5, px: 2,
                  borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
                  '&:hover': { bgcolor: '#f5f5f5' }
                }}
                onClick={() => handleAddAssignment(bank)}
              >
                <AddIcon sx={{ fontSize: 18, color: '#4caf50' }} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.9rem', fontWeight: 500 }}>{bank.bankName}</Typography>
                </Box>
                <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#4caf50' }}>
                  TAM: {fmt(bank.tam)}
                </Typography>
                <Chip
                  label={TIER_LABELS[bank.tier]}
                  size="small"
                  sx={{ fontSize: '0.65rem', height: 20, bgcolor: TIER_COLORS[bank.tier], color: '#fff' }}
                />
              </Box>
            ))}
            {availableBanks.length === 0 && (
              <Typography sx={{ textAlign: 'center', py: 4, color: '#999' }}>
                No available banks to assign.
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddBank(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TeamMemberDetail;
