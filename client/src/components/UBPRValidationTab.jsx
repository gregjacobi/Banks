import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Chip,
  Card,
  CardContent,
  Divider,
  Button,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Grid
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import BugReportIcon from '@mui/icons-material/BugReport';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import axios from 'axios';

/**
 * UBPR Validation Tab
 * Compares our calculated metrics with official FFIEC UBPR data
 */
const UBPRValidationTab = ({ idrssd, selectedPeriod }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [expandedMetric, setExpandedMetric] = useState(null);

  useEffect(() => {
    const fetchComparison = async () => {
      if (!idrssd || !selectedPeriod) {
        setError('Missing bank ID or reporting period');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await axios.get(`/api/ubpr/${idrssd}/compare?period=${selectedPeriod}`);
        setComparisonData(response.data);
      } catch (err) {
        console.error('Error fetching UBPR comparison:', err);
        setError(err.response?.data?.error || 'Failed to load UBPR comparison data');
      } finally {
        setLoading(false);
      }
    };

    fetchComparison();
  }, [idrssd, selectedPeriod]);

  const runAgentAnalysis = async () => {
    setAnalysisLoading(true);
    try {
      const response = await axios.post('/api/ubpr/analyze', {
        idrssds: [idrssd],
        period: selectedPeriod
      });
      setAnalysisResults(response.data.analysis);
      setShowAnalysis(true);
    } catch (err) {
      console.error('Error running UBPR analysis:', err);
      alert('Failed to run analysis. See console for details.');
    } finally {
      setAnalysisLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!comparisonData) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        No comparison data available
      </Alert>
    );
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'match':
        return <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />;
      case 'acceptable':
        return <InfoIcon sx={{ color: 'info.main', fontSize: 20 }} />;
      case 'warning':
        return <WarningIcon sx={{ color: 'warning.main', fontSize: 20 }} />;
      case 'significant':
        return <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />;
      case 'missing_data':
        return <InfoIcon sx={{ color: 'text.disabled', fontSize: 20 }} />;
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'match':
        return 'success';
      case 'acceptable':
        return 'info';
      case 'warning':
        return 'warning';
      case 'significant':
        return 'error';
      case 'missing_data':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'match':
        return 'Match';
      case 'acceptable':
        return 'Acceptable';
      case 'warning':
        return 'Warning';
      case 'significant':
        return 'Significant Variance';
      case 'missing_data':
        return 'Missing Data';
      default:
        return status;
    }
  };

  const formatValue = (value, suffix = '%') => {
    if (value === null || value === undefined) return '—';
    return `${value.toFixed(2)}${suffix}`;
  };

  const formatLargeValue = (value) => {
    if (value === null || value === undefined) return '—';
    // Values are in thousands, convert to millions/billions
    const millions = value / 1000;
    if (millions >= 1000) {
      return `$${(millions / 1000).toFixed(2)}B`;
    }
    return `$${millions.toFixed(2)}M`;
  };

  const formatDifference = (diff) => {
    if (!diff || diff.absolute === null) return '—';
    const sign = diff.absolute >= 0 ? '+' : '';
    return `${sign}${diff.absolute.toFixed(2)}% (${sign}${diff.percent.toFixed(1)}%)`;
  };

  const handleExpandClick = (metricKey) => {
    setExpandedMetric(expandedMetric === metricKey ? null : metricKey);
  };

  const metrics = [
    { key: 'roa', label: 'Return on Assets (ROA)' },
    { key: 'roe', label: 'Return on Equity (ROE)' },
    { key: 'nim', label: 'Net Interest Margin (NIM)' },
    { key: 'efficiencyRatio', label: 'Efficiency Ratio' },
    { key: 'tier1Leverage', label: 'Tier 1 Leverage Ratio' }
  ];

  const getSummaryColor = (status) => {
    switch (status) {
      case 'excellent':
        return 'success.light';
      case 'good':
        return 'info.light';
      case 'fair':
        return 'warning.light';
      case 'needs_review':
        return 'error.light';
      default:
        return 'grey.200';
    }
  };

  return (
    <Box>
      {/* Summary Card */}
      <Card sx={{ mb: 3, backgroundColor: getSummaryColor(comparisonData.summary?.overallStatus) }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            UBPR Validation Summary
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Comparing your calculated metrics against official FFIEC UBPR data
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Status
              </Typography>
              <Typography variant="h6">
                {comparisonData.summary?.message || 'Unknown'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Matches
              </Typography>
              <Typography variant="h6" color="success.main">
                {comparisonData.summary?.matchCount || 0}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Warnings
              </Typography>
              <Typography variant="h6" color="warning.main">
                {comparisonData.summary?.warningCount || 0}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Significant Variances
              </Typography>
              <Typography variant="h6" color="error.main">
                {comparisonData.summary?.significantCount || 0}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Data Source
              </Typography>
              <Chip
                label={comparisonData.dataSource === 'ffiec_api' ? 'Live FFIEC Data' : 'Simulated Data'}
                size="small"
                color={comparisonData.dataSource === 'ffiec_api' ? 'primary' : 'default'}
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Comparison Table */}
      <Paper sx={{ overflow: 'hidden' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, width: 50 }} />
              <TableCell sx={{ fontWeight: 700 }}>Metric</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Your Calculation</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>FFIEC UBPR</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Difference</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {metrics.map((metric) => {
              const ourValue = comparisonData.ourMetrics?.[metric.key];
              const ubprValue = comparisonData.ubprMetrics?.[metric.key];
              const difference = comparisonData.differences?.[metric.key];
              const status = difference?.status || 'missing_data';
              const isExpanded = expandedMetric === metric.key;
              const formula = comparisonData.formulaBreakdown?.[metric.key];

              return (
                <React.Fragment key={metric.key}>
                  <TableRow
                    sx={{
                      '&:hover': { backgroundColor: 'action.hover' },
                      backgroundColor: status === 'significant' ? 'error.50' : undefined
                    }}
                  >
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleExpandClick(metric.key)}
                      >
                        {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {metric.label}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {formatValue(ourValue)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatValue(ubprValue)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        color={
                          difference?.absolute > 0
                            ? 'success.main'
                            : difference?.absolute < 0
                            ? 'error.main'
                            : 'text.secondary'
                        }
                      >
                        {formatDifference(difference)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        {getStatusIcon(status)}
                        <Chip
                          label={getStatusLabel(status)}
                          size="small"
                          color={getStatusColor(status)}
                        />
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ margin: 2, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                            Formula Breakdown
                          </Typography>
                          <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                              <Card variant="outlined">
                                <CardContent>
                                  <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
                                    YOUR CALCULATION
                                  </Typography>
                                  <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                    {formula?.our?.formula}
                                  </Typography>
                                  {formula?.our?.numerator !== undefined && (
                                    <Box sx={{ mt: 2 }}>
                                      <Typography variant="caption" color="text.secondary">Numerator:</Typography>
                                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {formatLargeValue(formula.our.numerator)}
                                      </Typography>
                                    </Box>
                                  )}
                                  {formula?.our?.denominator !== undefined && (
                                    <Box sx={{ mt: 1 }}>
                                      <Typography variant="caption" color="text.secondary">Denominator:</Typography>
                                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {formatLargeValue(formula.our.denominator)}
                                      </Typography>
                                    </Box>
                                  )}
                                  {formula?.our?.components && (
                                    <Box sx={{ mt: 2 }}>
                                      <Typography variant="caption" color="text.secondary">Components:</Typography>
                                      {Object.entries(formula.our.components).map(([key, value]) => (
                                        <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                          <Typography variant="caption">{key}:</Typography>
                                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                            {formatLargeValue(value)}
                                          </Typography>
                                        </Box>
                                      ))}
                                    </Box>
                                  )}
                                </CardContent>
                              </Card>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <Card variant="outlined">
                                <CardContent>
                                  <Typography variant="caption" color="secondary" sx={{ fontWeight: 600 }}>
                                    FFIEC UBPR
                                  </Typography>
                                  <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                    {formula?.ubpr?.formula}
                                  </Typography>
                                  {formula?.ubpr?.result !== null && formula?.ubpr?.result !== undefined && (
                                    <Box sx={{ mt: 2 }}>
                                      <Typography variant="caption" color="text.secondary">UBPR Result:</Typography>
                                      <Typography variant="h6" color="secondary.main" sx={{ fontWeight: 600 }}>
                                        {formula.ubpr.result}%
                                      </Typography>
                                    </Box>
                                  )}
                                  {formula?.ubpr?.note && (
                                    <Alert severity="info" sx={{ mt: 2 }}>
                                      {formula.ubpr.note}
                                    </Alert>
                                  )}
                                </CardContent>
                              </Card>
                            </Grid>
                          </Grid>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </Paper>

      {/* Legend */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Status Legend
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon sx={{ color: 'success.main', fontSize: 18 }} />
              <Typography variant="caption">Match (&lt;0.5% variance)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoIcon sx={{ color: 'info.main', fontSize: 18 }} />
              <Typography variant="caption">Acceptable (0.5-2% variance)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningIcon sx={{ color: 'warning.main', fontSize: 18 }} />
              <Typography variant="caption">Warning (2-5% variance)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ErrorIcon sx={{ color: 'error.main', fontSize: 18 }} />
              <Typography variant="caption">Significant (&gt;5% variance)</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Balance Sheet Comparison */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Balance Sheet Comparison
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Your Data</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>UBPR (if available)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {comparisonData?.balanceSheetItems && (
                <>
                  <TableRow>
                    <TableCell>Total Assets</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.balanceSheetItems.our.totalAssets)}</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.balanceSheetItems.ubpr.totalAssets)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Total Loans</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.balanceSheetItems.our.totalLoans)}</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.balanceSheetItems.ubpr.totalLoans)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Total Securities</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.balanceSheetItems.our.totalSecurities)}</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.balanceSheetItems.ubpr.totalSecurities)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Total Deposits</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.balanceSheetItems.our.totalDeposits)}</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.balanceSheetItems.ubpr.totalDeposits)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Total Equity</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.balanceSheetItems.our.totalEquity)}</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.balanceSheetItems.ubpr.totalEquity)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Cash & Due from Banks</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.balanceSheetItems.our.cashAndDue)}</TableCell>
                    <TableCell align="right">—</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Income Statement Comparison */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Income Statement Comparison
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Your Data</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>UBPR (if available)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {comparisonData?.incomeStatementItems && (
                <>
                  <TableRow>
                    <TableCell>Interest Income</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.incomeStatementItems.our.interestIncome)}</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.incomeStatementItems.ubpr.interestIncome)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Interest Expense</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.incomeStatementItems.our.interestExpense)}</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.incomeStatementItems.ubpr.interestExpense)}</TableCell>
                  </TableRow>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Net Interest Income</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{formatLargeValue(comparisonData.incomeStatementItems.our.netInterestIncome)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{formatLargeValue(comparisonData.incomeStatementItems.ubpr.netInterestIncome)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Provision for Credit Losses</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.incomeStatementItems.our.provisionForLosses)}</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.incomeStatementItems.ubpr.provisionForLosses)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Noninterest Income</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.incomeStatementItems.our.noninterestIncome)}</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.incomeStatementItems.ubpr.noninterestIncome)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Noninterest Expense</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.incomeStatementItems.our.noninterestExpense)}</TableCell>
                    <TableCell align="right">{formatLargeValue(comparisonData.incomeStatementItems.ubpr.noninterestExpense)}</TableCell>
                  </TableRow>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Net Income</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{formatLargeValue(comparisonData.incomeStatementItems.our.netIncome)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{formatLargeValue(comparisonData.incomeStatementItems.ubpr.netIncome)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* AI Analysis Section */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AnalyticsIcon />
                AI Variance Analysis
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Let our AI agent investigate why the numbers differ and suggest improvements
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={analysisLoading ? <CircularProgress size={20} /> : <AnalyticsIcon />}
              onClick={runAgentAnalysis}
              disabled={analysisLoading}
            >
              {analysisLoading ? 'Analyzing...' : 'Run Analysis'}
            </Button>
          </Box>

          <Collapse in={showAnalysis && analysisResults}>
            {analysisResults && (
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ mb: 2 }} />

                {/* Variance Patterns */}
                {analysisResults.variancePatterns && analysisResults.variancePatterns.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <BugReportIcon color="warning" />
                      Discovered Patterns ({analysisResults.variancePatterns.length})
                    </Typography>
                    <List dense>
                      {analysisResults.variancePatterns.map((pattern, idx) => (
                        <ListItem
                          key={idx}
                          sx={{
                            backgroundColor: pattern.severity === 'critical' ? 'error.50' :
                                           pattern.severity === 'high' ? 'warning.50' : 'grey.50',
                            mb: 1,
                            borderRadius: 1
                          }}
                        >
                          <ListItemIcon>
                            <Chip
                              label={pattern.severity}
                              size="small"
                              color={
                                pattern.severity === 'critical' ? 'error' :
                                pattern.severity === 'high' ? 'warning' :
                                pattern.severity === 'medium' ? 'info' : 'default'
                              }
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={pattern.type.replace(/_/g, ' ').toUpperCase()}
                            secondary={
                              <>
                                <Typography component="span" variant="body2">
                                  Affects: {pattern.metrics.join(', ')}
                                </Typography>
                                <br />
                                <Typography component="span" variant="body2">
                                  {pattern.description}
                                </Typography>
                              </>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}

                {/* Recommendations */}
                {analysisResults.recommendations && analysisResults.recommendations.length > 0 && (
                  <Box>
                    <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <LightbulbIcon color="success" />
                      Recommendations ({analysisResults.recommendations.length})
                    </Typography>
                    <List dense>
                      {analysisResults.recommendations.map((rec, idx) => (
                        <ListItem
                          key={idx}
                          sx={{
                            backgroundColor: 'success.50',
                            mb: 1,
                            borderRadius: 1,
                            flexDirection: 'column',
                            alignItems: 'flex-start'
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 1 }}>
                            <Typography variant="subtitle2" sx={{ flex: 1 }}>
                              {rec.metric.toUpperCase()}
                            </Typography>
                            <Chip
                              label={`${rec.confidence} confidence`}
                              size="small"
                              color={rec.confidence === 'high' ? 'success' : rec.confidence === 'medium' ? 'info' : 'default'}
                            />
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            <strong>Issue:</strong> {rec.issue}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            <strong>Fix:</strong> {rec.fix}
                          </Typography>
                          {rec.impact && (
                            <Typography variant="body2" color="text.secondary">
                              <strong>Expected Impact:</strong> {rec.impact}
                            </Typography>
                          )}
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}

                {/* Stats */}
                {analysisResults.stats && (
                  <Box sx={{ mt: 2, p: 2, backgroundColor: 'grey.100', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Analysis completed in {(analysisResults.stats.duration / 1000).toFixed(1)}s
                      ({analysisResults.stats.iterations} iterations)
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Collapse>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UBPRValidationTab;
