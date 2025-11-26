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
  Chip,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Button,
  IconButton,
  Collapse,
  LinearProgress,
  Tooltip,
  Alert
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TrendingUp as TrendingUpIcon,
  Lightbulb as LightbulbIcon,
  Category as CategoryIcon,
  Star as StarIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
  AccountBalance as BankIcon
} from '@mui/icons-material';

/**
 * Strategic Priorities Dashboard
 * Industry-level view of strategic priorities across all banks
 */

// Format numbers
const fmtPct = (v) => v ? `${v.toFixed(1)}%` : '—';
const fmtAssets = (v) => {
  if (!v) return '—';
  const m = v / 1000; // Convert from thousands to millions
  if (m >= 1000) return `$${(m / 1000).toFixed(1)}B`;
  return `$${m.toFixed(0)}M`;
};

// Prevalence bar component
const PrevalenceBar = ({ value, max = 100, color = '#D97757' }) => {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ flexGrow: 1, height: 8, bgcolor: '#f0f0f0', borderRadius: 0.5, overflow: 'hidden' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: color }} />
      </Box>
      <Typography variant="body2" sx={{ minWidth: 45, textAlign: 'right' }}>
        {fmtPct(value)}
      </Typography>
    </Box>
  );
};

// Expandable category row
function CategoryRow({ category, onBankClick }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TableRow
        hover
        onClick={() => setExpanded(!expanded)}
        sx={{ cursor: 'pointer', '& td': { borderBottom: expanded ? 'none' : undefined } }}
      >
        <TableCell sx={{ width: 40 }}>
          <IconButton size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {category.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {category.description}
          </Typography>
        </TableCell>
        <TableCell align="center">
          <Chip
            label={category.bankCount}
            size="small"
            sx={{ bgcolor: '#D97757', color: 'white', fontWeight: 600 }}
          />
        </TableCell>
        <TableCell sx={{ width: 200 }}>
          <PrevalenceBar value={category.prevalence} />
        </TableCell>
        <TableCell align="center">
          {category.priorities?.length || 0}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={5} sx={{ py: 0, bgcolor: '#fafafa' }}>
          <Collapse in={expanded}>
            <Box sx={{ py: 2, px: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Priorities in this category:
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Priority</TableCell>
                    <TableCell align="center" sx={{ width: 80 }}>Banks</TableCell>
                    <TableCell>Banks with this priority</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {category.priorities?.map((priority, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {priority.title}
                        </Typography>
                        {priority.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            {priority.description.substring(0, 150)}...
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={priority.bankCount} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {priority.banks?.slice(0, 5).map((bank, j) => (
                            <Chip
                              key={j}
                              label={bank.bankName?.substring(0, 20) || bank.idrssd}
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                onBankClick(bank.idrssd);
                              }}
                              sx={{ cursor: 'pointer', fontSize: '0.7rem' }}
                            />
                          ))}
                          {priority.banks?.length > 5 && (
                            <Chip label={`+${priority.banks.length - 5} more`} size="small" variant="outlined" />
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {category.commonLanguage?.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Common language: {category.commonLanguage.join(', ')}
                  </Typography>
                </Box>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// Differentiating strategies section
function DifferentiatingStrategiesSection({ strategies, onBankClick }) {
  const [showAll, setShowAll] = useState(false);
  const displayStrategies = showAll ? strategies : strategies?.slice(0, 5);

  if (!strategies || strategies.length === 0) {
    return (
      <Alert severity="info">
        No differentiating strategies identified. Run analysis with more banks to find unique strategies.
      </Alert>
    );
  }

  return (
    <Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Strategy</TableCell>
              <TableCell sx={{ width: 120 }}>Category</TableCell>
              <TableCell sx={{ width: 200 }}>Why It's Unique</TableCell>
              <TableCell>Banks</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayStrategies?.map((strategy, i) => (
              <TableRow key={i} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {strategy.title}
                  </Typography>
                  {strategy.description && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {strategy.description.substring(0, 100)}...
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip label={strategy.category || 'Other'} size="small" variant="outlined" />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {strategy.uniquenessReason}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {strategy.banks?.map((bank, j) => (
                      <Chip
                        key={j}
                        label={bank.bankName?.substring(0, 15) || bank.idrssd}
                        size="small"
                        color="primary"
                        onClick={() => onBankClick(bank.idrssd)}
                        sx={{ cursor: 'pointer', fontSize: '0.7rem' }}
                      />
                    ))}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {strategies?.length > 5 && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button size="small" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Show Less' : `Show All ${strategies.length} Strategies`}
          </Button>
        </Box>
      )}
    </Box>
  );
}

// Key observations section
function KeyObservationsSection({ observations, emergingTrends }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LightbulbIcon sx={{ fontSize: 20, color: '#D97757' }} />
          Key Observations
        </Typography>
        {observations?.map((obs, i) => (
          <Box key={i} sx={{ mb: 2, pb: 2, borderBottom: i < observations.length - 1 ? '1px solid #eee' : 'none' }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {obs.observation}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Evidence: {obs.supportingEvidence}
            </Typography>
          </Box>
        ))}
        {(!observations || observations.length === 0) && (
          <Typography variant="body2" color="text.secondary">
            No key observations available
          </Typography>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUpIcon sx={{ fontSize: 20, color: '#1976d2' }} />
          Emerging Trends
        </Typography>
        {emergingTrends?.map((trend, i) => (
          <Box key={i} sx={{ mb: 2, pb: 2, borderBottom: i < emergingTrends.length - 1 ? '1px solid #eee' : 'none' }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {trend.trend}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {trend.description}
            </Typography>
            <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {trend.banks?.map((bank, j) => (
                <Chip key={j} label={bank} size="small" variant="outlined" sx={{ fontSize: '0.65rem' }} />
              ))}
            </Box>
          </Box>
        ))}
        {(!emergingTrends || emergingTrends.length === 0) && (
          <Typography variant="body2" color="text.secondary">
            No emerging trends identified
          </Typography>
        )}
      </Paper>
    </Box>
  );
}

// Coverage tab
function CoverageTab({ coverage, banks, onBankClick }) {
  const [sortBy, setSortBy] = useState('priorityCount');
  const [sortOrder, setSortOrder] = useState('desc');

  const sortedBanks = useMemo(() => {
    if (!banks) return [];
    return [...banks].sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [banks, sortBy, sortOrder]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <Box>
      {/* Coverage Summary */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#D97757' }}>
            {coverage?.banksWithPriorities || 0}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Banks with Priorities
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {coverage?.totalBanks || 0}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Total Banks
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#1976d2' }}>
            {fmtPct(coverage?.coveragePercent)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Coverage Rate
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#2e7d32' }}>
            {coverage?.banksExtracting || 0}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            In Progress
          </Typography>
        </Paper>
      </Box>

      {/* Coverage Progress */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2">Extraction Progress</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {coverage?.banksWithPriorities}/{coverage?.totalBanks} banks
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={coverage?.coveragePercent || 0}
          sx={{ height: 10, borderRadius: 1, bgcolor: '#f0f0f0', '& .MuiLinearProgress-bar': { bgcolor: '#D97757' } }}
        />
      </Paper>

      {/* Banks List */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell
                onClick={() => handleSort('bankName')}
                sx={{ cursor: 'pointer', fontWeight: 600 }}
              >
                Bank {sortBy === 'bankName' && (sortOrder === 'desc' ? '↓' : '↑')}
              </TableCell>
              <TableCell
                align="center"
                onClick={() => handleSort('priorityCount')}
                sx={{ cursor: 'pointer', fontWeight: 600 }}
              >
                Priorities {sortBy === 'priorityCount' && (sortOrder === 'desc' ? '↓' : '↑')}
              </TableCell>
              <TableCell>Last Extracted</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedBanks.map((bank, i) => (
              <TableRow key={i} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {bank.bankName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ID: {bank.idrssd}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={bank.priorityCount}
                    size="small"
                    color={bank.priorityCount > 5 ? 'primary' : 'default'}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {bank.lastExtracted ? new Date(bank.lastExtracted).toLocaleDateString() : '—'}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="View Bank Details">
                    <IconButton size="small" onClick={() => onBankClick(bank.idrssd)}>
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// Search results display
function SearchResults({ results, query, onBankClick }) {
  if (!results || results.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No results found for "{query}"
      </Alert>
    );
  }

  return (
    <Paper sx={{ mt: 2, p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 2 }}>
        {results.length} results for "{query}"
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Type</TableCell>
            <TableCell>Title</TableCell>
            <TableCell>Details</TableCell>
            <TableCell>Banks</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {results.map((result, i) => (
            <TableRow key={i} hover>
              <TableCell>
                <Chip
                  label={result.type === 'differentiating' ? 'Unique' : 'Priority'}
                  size="small"
                  color={result.type === 'differentiating' ? 'secondary' : 'default'}
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {result.title}
                </Typography>
              </TableCell>
              <TableCell>
                {result.category && <Chip label={result.category} size="small" variant="outlined" sx={{ mr: 1 }} />}
                <Typography variant="caption" color="text.secondary">
                  {result.description?.substring(0, 80)}...
                </Typography>
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {result.banks?.slice(0, 3).map((bank, j) => (
                    <Chip
                      key={j}
                      label={bank.bankName?.substring(0, 12)}
                      size="small"
                      onClick={() => onBankClick(bank.idrssd)}
                      sx={{ cursor: 'pointer', fontSize: '0.65rem' }}
                    />
                  ))}
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

// Main component
function StrategicPrioritiesDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [coverageBanks, setCoverageBanks] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Fetch analysis data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [analysisRes, coverageRes] = await Promise.all([
        axios.get('/api/strategic-priorities/latest').catch(() => ({ data: { success: false } })),
        axios.get('/api/strategic-priorities/coverage')
      ]);

      if (analysisRes.data.success) {
        setAnalysis(analysisRes.data.analysis);
      }
      if (coverageRes.data.success) {
        setCoverage(coverageRes.data.coverage);
        setCoverageBanks(coverageRes.data.banks || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load strategic priorities data');
    } finally {
      setLoading(false);
    }
  };

  // Search handler
  const handleSearch = async () => {
    if (!searchQuery || searchQuery.length < 2) return;
    try {
      const res = await axios.get(`/api/strategic-priorities/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.data.success) {
        setSearchResults(res.data.results);
      }
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  // Trigger new analysis
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await axios.post('/api/strategic-priorities/analyze', { force: true });
      // Wait a bit then refetch
      setTimeout(() => {
        fetchData();
        setRefreshing(false);
      }, 5000);
    } catch (err) {
      console.error('Error triggering analysis:', err);
      setRefreshing(false);
    }
  };

  const handleBankClick = (idrssd) => {
    navigate(`/bank/${idrssd}`);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 2 }}>
        <CircularProgress />
        <Typography>Loading strategic priorities analysis...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CategoryIcon sx={{ color: '#D97757' }} />
            Strategic Priorities Analysis
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Industry-level view of strategic priorities across {coverage?.banksWithPriorities || 0} banks
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Search */}
          <TextField
            size="small"
            placeholder="Search priorities..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!e.target.value) setSearchResults(null);
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
            sx={{ width: 250 }}
          />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Analyzing...' : 'Refresh Analysis'}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {/* Search Results */}
      {searchResults && (
        <SearchResults results={searchResults} query={searchQuery} onBankClick={handleBankClick} />
      )}

      {/* No Analysis State */}
      {!analysis && !searchResults && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            No Strategic Priorities Analysis Available
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Run the analysis to categorize strategic priorities across all banks.
          </Typography>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={refreshing}
            sx={{ bgcolor: '#D97757', '&:hover': { bgcolor: '#c66747' } }}
          >
            Run Analysis Now
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            This will analyze {coverage?.banksWithPriorities || 0} banks and may take 2-5 minutes.
          </Typography>
        </Paper>
      )}

      {/* Tabs */}
      {analysis && !searchResults && (
        <>
          <Paper sx={{ mb: 2 }}>
            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
              <Tab
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CategoryIcon fontSize="small" />
                    Categories ({analysis.categories?.length || 0})
                  </Box>
                }
              />
              <Tab
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUpIcon fontSize="small" />
                    Industry Themes
                  </Box>
                }
              />
              <Tab
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <StarIcon fontSize="small" />
                    Differentiating ({analysis.differentiatingStrategies?.length || 0})
                  </Box>
                }
              />
              <Tab
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BankIcon fontSize="small" />
                    Coverage
                  </Box>
                }
              />
            </Tabs>
          </Paper>

          {/* Analysis Metadata */}
          <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <Chip
              label={`Last updated: ${new Date(analysis.analysisDate).toLocaleString()}`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={`${analysis.coverage?.totalPrioritiesAnalyzed || 0} priorities analyzed`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={`Model: ${analysis.analysisMetadata?.model || 'Unknown'}`}
              size="small"
              variant="outlined"
            />
          </Box>

          {/* Tab Panels */}
          {activeTab === 0 && (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 40 }}></TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="center" sx={{ width: 100 }}>Banks</TableCell>
                    <TableCell sx={{ width: 200 }}>Prevalence</TableCell>
                    <TableCell align="center" sx={{ width: 100 }}>Priorities</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analysis.categories?.map((cat, i) => (
                    <CategoryRow key={i} category={cat} onBankClick={handleBankClick} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {activeTab === 1 && (
            <Box>
              {/* Top Themes */}
              <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                  Top Industry Themes
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Theme</TableCell>
                      <TableCell sx={{ width: 200 }}>Prevalence</TableCell>
                      <TableCell>Example Banks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analysis.industrySummary?.topThemes?.map((theme, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {theme.theme}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {theme.description}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <PrevalenceBar value={theme.prevalence} />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {theme.exampleBanks?.slice(0, 3).map((bank, j) => (
                              <Chip key={j} label={bank.substring(0, 15)} size="small" variant="outlined" />
                            ))}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>

              {/* Key Observations & Emerging Trends */}
              <KeyObservationsSection
                observations={analysis.industrySummary?.keyObservations}
                emergingTrends={analysis.industrySummary?.emergingTrends}
              />
            </Box>
          )}

          {activeTab === 2 && (
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Differentiating Strategies
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Strategic priorities that are unique to only 1-3 banks, potentially indicating competitive differentiation.
              </Typography>
              <DifferentiatingStrategiesSection
                strategies={analysis.differentiatingStrategies}
                onBankClick={handleBankClick}
              />
            </Paper>
          )}

          {activeTab === 3 && (
            <CoverageTab
              coverage={coverage}
              banks={coverageBanks}
              onBankClick={handleBankClick}
            />
          )}
        </>
      )}
    </Box>
  );
}

export default StrategicPrioritiesDashboard;
