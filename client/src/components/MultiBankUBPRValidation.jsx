import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  CircularProgress,
  Autocomplete,
  TextField,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  AlertTitle,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  IconButton,
  Collapse,
  Grid
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

/**
 * Expandable Row Component
 */
function BankComparisonRow({ comparison }) {
  const [open, setOpen] = useState(false);

  const getVarianceColor = (status) => {
    switch (status) {
      case 'match': return 'success.main';
      case 'acceptable': return 'warning.main';
      case 'warning': return 'warning.dark';
      case 'significant': return 'error.main';
      default: return 'text.secondary';
    }
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return typeof value === 'number' ? value.toFixed(2) : value;
  };

  const formatLargeNumber = (value) => {
    if (value === null || value === undefined) return 'N/A';
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatFieldLabel = (key) => {
    // Special cases for better readability
    const labelMap = {
      avgTotalAssets: 'Avg Total Assets',
      avgTotalEquity: 'Avg Total Equity',
      avgEarningAssets: 'Avg Earning Assets',
      totalAssets: 'Total Assets',
      totalLoans: 'Total Loans',
      totalSecurities: 'Total Securities',
      totalDeposits: 'Total Deposits',
      totalEquity: 'Total Equity',
      cashAndDue: 'Cash and Due from Banks',
      interestIncome: 'Interest Income',
      interestExpense: 'Interest Expense',
      netInterestIncome: 'Net Interest Income',
      provisionForLosses: 'Provision for Losses',
      noninterestIncome: 'Noninterest Income',
      noninterestExpense: 'Noninterest Expense',
      netIncome: 'Net Income'
    };

    return labelMap[key] || key.replace(/([A-Z])/g, ' $1').trim();
  };

  const worstStatus = ['significant', 'warning', 'acceptable', 'match'].find(status =>
    Object.values(comparison.differences || {}).some(d => d.status === status)
  ) || 'match';

  return (
    <>
      <TableRow sx={{ '&:hover': { bgcolor: '#e3f2fd' } }}>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ fontWeight: 500 }}>{comparison.bankName}</TableCell>
        <TableCell align="right">{formatValue(comparison.ourMetrics?.roa)}</TableCell>
        <TableCell align="right" sx={{ color: getVarianceColor(comparison.differences?.roa?.status) }}>
          {formatValue(comparison.differences?.roa?.percent)}%
        </TableCell>
        <TableCell align="right">{formatValue(comparison.ourMetrics?.roe)}</TableCell>
        <TableCell align="right" sx={{ color: getVarianceColor(comparison.differences?.roe?.status) }}>
          {formatValue(comparison.differences?.roe?.percent)}%
        </TableCell>
        <TableCell align="right">{formatValue(comparison.ourMetrics?.nim)}</TableCell>
        <TableCell align="right" sx={{ color: getVarianceColor(comparison.differences?.nim?.status) }}>
          {formatValue(comparison.differences?.nim?.percent)}%
        </TableCell>
        <TableCell align="right">{formatValue(comparison.ourMetrics?.efficiencyRatio)}</TableCell>
        <TableCell align="right" sx={{ color: getVarianceColor(comparison.differences?.efficiencyRatio?.status) }}>
          {formatValue(comparison.differences?.efficiencyRatio?.percent)}%
        </TableCell>
        <TableCell align="center">
          <Chip
            label={worstStatus}
            size="small"
            sx={{
              bgcolor: worstStatus === 'significant' ? 'error.light' :
                       worstStatus === 'warning' ? 'warning.light' :
                       worstStatus === 'acceptable' ? 'warning.lighter' :
                       'success.light'
            }}
          />
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={11}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2 }}>
              <Grid container spacing={2}>
                {/* Balance Sheet Items */}
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    Balance Sheet Items
                  </Typography>
                  <TableContainer component={Paper} sx={{ bgcolor: '#fafafa' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#f0f0f0' }}>
                          <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Item</TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Our Value</TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>UBPR Value</TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>PDF Value</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {comparison.balanceSheetItems && Object.entries(comparison.balanceSheetItems.our || {}).map(([key, ourValue]) => {
                          const ubprValue = comparison.balanceSheetItems.ubpr?.[key];
                          const pdfValue = comparison.pdfBalanceSheet?.[key];

                          return (
                            <TableRow key={key}>
                              <TableCell sx={{ fontSize: '0.75rem' }}>
                                {formatFieldLabel(key)}
                              </TableCell>
                              <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                                {formatLargeNumber(ourValue)}
                              </TableCell>
                              <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                                {formatLargeNumber(ubprValue)}
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{
                                  fontSize: '0.75rem',
                                  fontStyle: pdfValue ? 'normal' : 'italic',
                                  color: pdfValue ? 'text.primary' : 'text.disabled'
                                }}
                              >
                                {pdfValue ? formatLargeNumber(pdfValue) : 'N/A'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {comparison.pdfNote && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                        PDF: {comparison.pdfNote}
                        {comparison.pdfConfidence && ` (${comparison.pdfConfidence} confidence)`}
                      </Typography>
                      {comparison.pdfPeriod && (
                        <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                          PDF Period: {comparison.pdfPeriod} (Q{comparison.pdfQuarter})
                          {comparison.pdfIncomeStatementBasis && ` • Income basis: ${comparison.pdfIncomeStatementBasis}`}
                          {comparison.pdfMetricsBasis && ` • Metrics basis: ${comparison.pdfMetricsBasis}`}
                        </Typography>
                      )}
                      {comparison.pdfWarnings && comparison.pdfWarnings.length > 0 && (
                        <Typography variant="caption" display="block" sx={{ color: 'warning.main', fontStyle: 'italic', mt: 0.5 }}>
                          ⚠ {comparison.pdfWarnings.join(' • ')}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Grid>

                {/* Income Statement Items */}
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    Income Statement Items
                  </Typography>
                  <TableContainer component={Paper} sx={{ bgcolor: '#fafafa' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#f0f0f0' }}>
                          <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Item</TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Our Value</TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>UBPR Value</TableCell>
                          <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>PDF Value</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {comparison.incomeStatementItems && Object.entries(comparison.incomeStatementItems.our || {}).map(([key, ourValue]) => {
                          const ubprValue = comparison.incomeStatementItems.ubpr?.[key];
                          const pdfValue = comparison.pdfIncomeStatement?.[key];

                          return (
                            <TableRow key={key}>
                              <TableCell sx={{ fontSize: '0.75rem' }}>
                                {formatFieldLabel(key)}
                              </TableCell>
                              <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                                {formatLargeNumber(ourValue)}
                              </TableCell>
                              <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                                {formatLargeNumber(ubprValue)}
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{
                                  fontSize: '0.75rem',
                                  fontStyle: pdfValue ? 'normal' : 'italic',
                                  color: pdfValue ? 'text.primary' : 'text.disabled'
                                }}
                              >
                                {pdfValue ? formatLargeNumber(pdfValue) : 'N/A'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {comparison.pdfSources && comparison.pdfSources.length > 0 && (
                    <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary', fontStyle: 'italic' }}>
                      Sources: {comparison.pdfSources.join(', ')}
                    </Typography>
                  )}
                </Grid>

                {/* Formula Breakdown */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, fontSize: '0.9rem', mt: 2 }}>
                    Formula Breakdown
                  </Typography>
                  <Grid container spacing={2}>
                    {comparison.formulaBreakdown && Object.entries(comparison.formulaBreakdown).map(([metric, breakdown]) => (
                      <Grid item xs={12} sm={6} md={4} key={metric}>
                        <Paper sx={{ p: 2, bgcolor: '#fafafa' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            {metric.toUpperCase()}
                          </Typography>
                          <Typography variant="caption" display="block" sx={{ mb: 1, fontStyle: 'italic' }}>
                            {breakdown.our?.formula || breakdown.ubpr?.formula}
                          </Typography>
                          <Box sx={{ fontSize: '0.75rem' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <span><strong>Our:</strong> Numerator</span>
                              <span>{formatLargeNumber(breakdown.our?.numerator)}</span>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <span><strong>Our:</strong> Denominator</span>
                              <span>{formatLargeNumber(breakdown.our?.denominator)}</span>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <span><strong>UBPR:</strong> Numerator</span>
                              <span>{formatLargeNumber(breakdown.ubpr?.numerator)}</span>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span><strong>UBPR:</strong> Denominator</span>
                              <span>{formatLargeNumber(breakdown.ubpr?.denominator)}</span>
                            </Box>
                            {breakdown.ubpr?.note && (
                              <Typography variant="caption" display="block" sx={{ mt: 1, color: 'warning.main' }}>
                                Note: {breakdown.ubpr.note}
                              </Typography>
                            )}
                          </Box>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

/**
 * Multi-Bank UBPR Validation Component
 */
function MultiBankUBPRValidation({ banks }) {
  const [selectedBanks, setSelectedBanks] = useState([]);
  const [period, setPeriod] = useState('');
  const [periods, setPeriods] = useState([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  // Fetch available periods when banks are selected
  useEffect(() => {
    const fetchPeriods = async () => {
      if (selectedBanks.length === 0) {
        setPeriods([]);
        setPeriod('');
        return;
      }

      setLoadingPeriods(true);
      try {
        const idrssds = selectedBanks.map(b => b.idrssd).join(',');
        const response = await axios.get(`/api/banks/available-periods?idrssds=${idrssds}`);
        const fetchedPeriods = response.data.periods || [];
        setPeriods(fetchedPeriods);
        
        // Set period to most recent if available
        if (fetchedPeriods.length > 0) {
          setPeriod(prevPeriod => {
            // If current period is not in the list, set to most recent
            if (!fetchedPeriods.includes(prevPeriod)) {
              return fetchedPeriods[0];
            }
            return prevPeriod || fetchedPeriods[0];
          });
        } else {
          setPeriod('');
        }
      } catch (err) {
        console.error('Error fetching available periods:', err);
        setError('Failed to load available periods');
        setPeriods([]);
        setPeriod('');
      } finally {
        setLoadingPeriods(false);
      }
    };

    fetchPeriods();
  }, [selectedBanks]);

  const handleRunValidation = async () => {
    if (selectedBanks.length === 0) {
      setError('Please select at least one bank');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setAnalysis(null);

    try {
      const response = await axios.post('/api/ubpr/compare-batch', {
        idrssds: selectedBanks.map(b => b.idrssd),
        period
      });

      setResults(response.data);
    } catch (err) {
      console.error('Error running UBPR validation:', err);
      setError(err.response?.data?.error || 'Failed to run UBPR validation');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeIssues = async () => {
    if (!results) {
      setError('Please run validation first');
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const response = await axios.post('/api/ubpr/analyze-issues', {
        results: results.comparisons,
        period
      });

      setAnalysis(response.data);
    } catch (err) {
      console.error('Error analyzing issues:', err);
      setError(err.response?.data?.error || 'Failed to analyze issues');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Box>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
            Multi-Bank UBPR Validation
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Test and validate financial ratios across multiple banks to detect systematic calculation issues
          </Typography>

          {/* Bank Selection */}
          <Box sx={{ mb: 3 }}>
            <Autocomplete
              multiple
              options={banks}
              getOptionLabel={(option) => option.name}
              value={selectedBanks}
              onChange={(event, newValue) => setSelectedBanks(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Banks"
                  placeholder="Choose banks to validate"
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    label={option.name}
                    {...getTagProps({ index })}
                    size="small"
                  />
                ))
              }
            />
          </Box>

          {/* Period Selection */}
          <Box sx={{ mb: 3 }}>
            {loadingPeriods && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary">
                  Loading available periods...
                </Typography>
              </Box>
            )}
            <FormControl fullWidth disabled={loadingPeriods || periods.length === 0}>
              <InputLabel>Reporting Period</InputLabel>
              <Select
                value={period}
                label="Reporting Period"
                onChange={(e) => setPeriod(e.target.value)}
                renderValue={(value) => {
                  if (!value) return '';
                  // Parse date string (YYYY-MM-DD) as local date to avoid timezone issues
                  const [year, month, day] = value.split('-').map(Number);
                  const date = new Date(year, month - 1, day);
                  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                }}
              >
                {periods.length === 0 ? (
                  <MenuItem disabled>No periods available for selected banks</MenuItem>
                ) : (
                  periods.map((p) => {
                    // Parse date string (YYYY-MM-DD) as local date to avoid timezone issues
                    const [year, month, day] = p.split('-').map(Number);
                    const date = new Date(year, month - 1, day);
                    return (
                      <MenuItem key={p} value={p}>
                        {date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </MenuItem>
                    );
                  })
                )}
              </Select>
            </FormControl>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} /> : <PlayArrowIcon />}
              onClick={handleRunValidation}
              disabled={loading || selectedBanks.length === 0}
            >
              {loading ? 'Running...' : 'Run Validation'}
            </Button>

            {results && (
              <Button
                variant="outlined"
                startIcon={analyzing ? <CircularProgress size={20} /> : <AnalyticsIcon />}
                onClick={handleAnalyzeIssues}
                disabled={analyzing}
              >
                {analyzing ? 'Analyzing...' : 'Analyze Issues'}
              </Button>
            )}
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              AI Analysis: Systematic Issues
            </Typography>

            {analysis.issues && analysis.issues.length > 0 ? (
              <Box>
                {analysis.issues.map((issue, index) => (
                  <Alert key={index} severity={issue.severity || 'info'} sx={{ mb: 2 }}>
                    <AlertTitle>{issue.title}</AlertTitle>
                    {issue.description}
                    {issue.affectedBanks && issue.affectedBanks.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption">
                          Affected: {issue.affectedBanks.join(', ')}
                        </Typography>
                      </Box>
                    )}
                  </Alert>
                ))}
              </Box>
            ) : (
              <Alert severity="success">
                <AlertTitle>No Systematic Issues Detected</AlertTitle>
                {analysis.summary || 'All calculations appear to be consistent across selected banks.'}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Validation Results Table */}
      {results && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Validation Results
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
              Showing {results.comparisons?.length || 0} banks validated. Click row to expand details.
            </Typography>

            <TableContainer component={Paper} sx={{ bgcolor: '#fafafa' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell sx={{ width: 50 }} />
                    <TableCell sx={{ fontWeight: 600 }}>Bank</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>ROA</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Diff %</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>ROE</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Diff %</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>NIM</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Diff %</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Eff Ratio</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Diff %</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.comparisons && results.comparisons.map((comparison) => (
                    <BankComparisonRow key={comparison.idrssd} comparison={comparison} />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

export default MultiBankUBPRValidation;
