import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Grid,
  Tooltip as MuiTooltip
} from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';

/**
 * Peer Comparison Tab - Tufte-optimized design
 * Shows bank performance vs peer average with stack rankings
 * Maximizes data-ink ratio following Edward Tufte's principles
 */
function PeerComparisonTab({ idrssd, availablePeriods }) {
  const [loading, setLoading] = useState(true);
  const [peerData, setPeerData] = useState(null);
  const [peerBanksData, setPeerBanksData] = useState(null);

  useEffect(() => {
    const fetchPeerData = async () => {
      if (!availablePeriods || availablePeriods.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const promises = availablePeriods.map(period =>
          axios.get(`/api/banks/${idrssd}?period=${period}`)
        );
        const responses = await Promise.all(promises);
        const statements = responses.map(r => r.data.financialStatement);

        // Filter statements that have peer analysis
        const statementsWithPeers = statements.filter(s => s.peerAnalysis);

        if (statementsWithPeers.length === 0) {
          setPeerData(null);
          setLoading(false);
          return;
        }

        // Sort by period (oldest first for proper time-based chart ordering)
        statementsWithPeers.sort((a, b) => new Date(a.reportingPeriod) - new Date(b.reportingPeriod));
        setPeerData(statementsWithPeers);

        // Fetch all banks for the latest period to build comparison charts
        const latestPeriod = availablePeriods[0];
        const allBanksResponse = await axios.get(`/api/banks/${idrssd}/peer-banks?period=${latestPeriod}`);
        setPeerBanksData(allBanksResponse.data);
      } catch (error) {
        console.error('Error fetching peer data:', error);
        // If peer banks endpoint fails, just use the data we have
        setPeerData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPeerData();
  }, [idrssd, availablePeriods]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!peerData || peerData.length === 0) {
    return (
      <Box sx={{ py: 4 }}>
        <Typography color="text.secondary" align="center">
          Peer analysis not available. Run the peer analysis script to generate this data.
        </Typography>
        <Typography variant="caption" color="text.secondary" align="center" sx={{ display: 'block', mt: 1 }}>
          Command: <code>node server/scripts/calculatePeerAnalysis.js</code>
        </Typography>
      </Box>
    );
  }

  // Latest period for current rankings
  const latest = peerData[peerData.length - 1];
  const peerCount = latest.peerAnalysis.peers.count;

  // Metrics to display
  const metrics = [
    { key: 'efficiencyRatio', label: 'Efficiency Ratio', unit: '%', lowerBetter: true, decimals: 1 },
    { key: 'roe', label: 'Return on Equity', unit: '%', lowerBetter: false, decimals: 1 },
    { key: 'roa', label: 'Return on Assets', unit: '%', lowerBetter: false, decimals: 2 },
    { key: 'nim', label: 'Net Interest Margin', unit: '%', lowerBetter: false, decimals: 2 },
    { key: 'operatingLeverage', label: 'Operating Leverage', unit: 'x', lowerBetter: false, decimals: 2 }
  ];

  // Prepare time series data for charts
  const chartData = peerData.map(stmt => {
    const date = new Date(stmt.reportingPeriod);
    const year = date.getFullYear();
    const quarter = Math.ceil((date.getMonth() + 1) / 3);

    const data = {
      period: `${year} Q${quarter}`,
      fullDate: stmt.reportingPeriod
    };

    metrics.forEach(metric => {
      // Map netInterestMargin field to nim for consistency with peer-banks API
      const bankField = metric.key === 'nim' ? 'netInterestMargin' : metric.key;
      // Peer averages use 'nim' as the key (not 'netInterestMargin')
      const peerField = metric.key;

      data[`${metric.key}_bank`] = stmt.ratios?.[bankField] || null;
      data[`${metric.key}_peer`] = stmt.peerAnalysis?.peerAverages?.[peerField] || null;
    });

    return data;
  });

  // Helper to format numbers
  const formatNumber = (value, decimals = 1) => {
    if (value === null || value === undefined || isNaN(value)) return '—';
    return value.toFixed(decimals);
  };

  // Helper to get percentile color
  const getPercentileColor = (percentile, lowerBetter = false) => {
    if (!percentile) return '#666';
    const adjusted = lowerBetter ? 100 - percentile : percentile;
    if (adjusted >= 75) return '#2e7d32'; // Top quartile - green
    if (adjusted >= 50) return '#ed6c02'; // Above median - orange
    return '#d32f2f'; // Below median - red
  };

  // Helper to get ranking badge style
  const getRankingStyle = (ranking, lowerBetter = false) => {
    if (!ranking || !ranking.percentile) return {};
    const color = getPercentileColor(ranking.percentile, lowerBetter);
    return {
      color: '#fff',
      bgcolor: color,
      fontWeight: 700,
      fontSize: '0.7rem',
      px: 1,
      py: 0.3,
      borderRadius: '4px',
      display: 'inline-block'
    };
  };

  return (
    <Box>
      {/* Header - Peer Group Info */}
      <Paper sx={{ mb: 2, p: 1.5, bgcolor: '#fafafa', border: '1px solid #e0e0e0' }}>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
          <strong>Peer Group:</strong> {peerCount} banks ({latest.peerAnalysis.peers.largerCount} larger, {latest.peerAnalysis.peers.smallerCount} smaller by total assets)
        </Typography>
      </Paper>

      {/* Peer Banks Table */}
      {peerBanksData && peerBanksData.banks && (
        <Paper sx={{ mb: 2, p: 2, bgcolor: '#fafafa' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, fontSize: '0.95rem', borderBottom: '2px solid #333', pb: 0.5 }}>
            PEER BANKS
          </Typography>

          <Box sx={{ overflowX: 'auto' }}>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <Box component="thead">
                <Box component="tr" sx={{ borderBottom: '1px solid #ddd' }}>
                  <Box component="th" sx={{ textAlign: 'left', p: 1, fontWeight: 600, color: 'text.secondary' }}>Bank</Box>
                  <Box component="th" sx={{ textAlign: 'right', p: 1, fontWeight: 600, color: 'text.secondary' }}>Total Assets</Box>
                  <Box component="th" sx={{ textAlign: 'right', p: 1, fontWeight: 600, color: 'text.secondary' }}>ROE</Box>
                  <Box component="th" sx={{ textAlign: 'right', p: 1, fontWeight: 600, color: 'text.secondary' }}>ROA</Box>
                  <Box component="th" sx={{ textAlign: 'right', p: 1, fontWeight: 600, color: 'text.secondary' }}>NIM</Box>
                  <Box component="th" sx={{ textAlign: 'right', p: 1, fontWeight: 600, color: 'text.secondary' }}>Efficiency</Box>
                </Box>
              </Box>
              <Box component="tbody">
                {[...peerBanksData.banks]
                  .sort((a, b) => b.totalAssets - a.totalAssets)
                  .map((bank) => (
                    <Box
                      key={bank.idrssd}
                      component="tr"
                      sx={{
                        borderBottom: '1px solid #f0f0f0',
                        bgcolor: bank.idrssd === idrssd ? '#e3f2fd' : 'transparent',
                        '&:hover': { bgcolor: bank.idrssd === idrssd ? '#e3f2fd' : '#f9f9f9' }
                      }}
                    >
                      <Box component="td" sx={{ p: 1, fontWeight: bank.idrssd === idrssd ? 700 : 400 }}>
                        {bank.name}
                        {bank.idrssd === idrssd && ' (This Bank)'}
                      </Box>
                      <Box component="td" sx={{ textAlign: 'right', p: 1, fontFamily: 'monospace' }}>
                        ${(bank.totalAssets / 1000).toFixed(1)}M
                      </Box>
                      <Box component="td" sx={{ textAlign: 'right', p: 1, fontFamily: 'monospace' }}>
                        {bank.roe !== null ? `${bank.roe.toFixed(2)}%` : '—'}
                      </Box>
                      <Box component="td" sx={{ textAlign: 'right', p: 1, fontFamily: 'monospace' }}>
                        {bank.roa !== null ? `${bank.roa.toFixed(2)}%` : '—'}
                      </Box>
                      <Box component="td" sx={{ textAlign: 'right', p: 1, fontFamily: 'monospace' }}>
                        {bank.nim !== null ? `${bank.nim.toFixed(2)}%` : '—'}
                      </Box>
                      <Box component="td" sx={{ textAlign: 'right', p: 1, fontFamily: 'monospace' }}>
                        {bank.efficiencyRatio !== null ? `${bank.efficiencyRatio.toFixed(1)}%` : '—'}
                      </Box>
                    </Box>
                  ))}
              </Box>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Performance vs Peers - Column Charts */}
      <Paper sx={{ mb: 2, p: 2, bgcolor: '#fafafa' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, fontSize: '0.95rem', borderBottom: '2px solid #333', pb: 0.5 }}>
          PERFORMANCE VS PEERS
        </Typography>

        {/* Column charts for each metric */}
        {metrics.map((metric) => {
          const bankValue = latest.ratios?.[metric.key];
          const peerAvg = latest.peerAnalysis?.peerAverages?.[metric.key];
          const ranking = latest.peerAnalysis?.rankings?.[metric.key];

          // Prepare chart data - sorted by metric value
          // Best performers on RIGHT, worst on LEFT
          // For lowerBetter metrics (efficiency ratio), lower is better (best on right)
          // For higherBetter metrics (ROE, NIM, etc), higher is better (best on right)
          let chartData = [];
          if (peerBanksData && peerBanksData.banks) {
            chartData = peerBanksData.banks
              .filter(b => b[metric.key] !== null && b[metric.key] !== undefined && !isNaN(b[metric.key]))
              .map(b => ({
                idrssd: b.idrssd,
                name: b.name,
                value: b[metric.key],
                isTarget: b.idrssd === idrssd
              }))
              .sort((a, b) => metric.lowerBetter ? b.value - a.value : a.value - b.value); // Reverse sort for best-on-right
          }

          return (
            <Box key={metric.key} sx={{ mb: 3 }}>
              {/* Header with ranking */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#333' }}>
                  {metric.label}
                </Typography>
                {ranking && (
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      This Bank: <strong style={{ color: '#d97757' }}>{formatNumber(bankValue, metric.decimals)}{metric.unit}</strong>
                      {' | '}
                      Peer Avg: <strong>{formatNumber(peerAvg, metric.decimals)}{metric.unit}</strong>
                    </Typography>
                    <Box sx={getRankingStyle(ranking, metric.lowerBetter)}>
                      #{ranking.rank} / {ranking.total} (P{ranking.percentile})
                    </Box>
                  </Box>
                )}
              </Box>

              {/* Column Chart */}
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 0 }}
                    axisLine={{ stroke: '#ddd' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: '#666' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value) => `${formatNumber(value, metric.decimals)}${metric.unit}`}
                    contentStyle={{ fontSize: '0.7rem', border: '1px solid #ddd', borderRadius: 4 }}
                    labelFormatter={(label) => `${label}`}
                  />
                  <ReferenceLine
                    y={peerAvg}
                    stroke="#666"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    label={{
                      value: `Peer Avg: ${formatNumber(peerAvg, metric.decimals)}${metric.unit}`,
                      position: 'right',
                      fontSize: 9,
                      fill: '#666'
                    }}
                  />
                  <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isTarget ? '#d97757' : '#bdbdbd'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          );
        })}
      </Paper>

      {/* Trend Charts - Bank vs Peer Average */}
      <Paper sx={{ mb: 2, p: 2, bgcolor: '#fafafa' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, fontSize: '0.95rem', borderBottom: '2px solid #333', pb: 0.5 }}>
          TRENDS VS PEER AVERAGE
        </Typography>

        {metrics.map((metric) => (
          <Box key={metric.key} sx={{ bgcolor: '#fff', border: '1px solid #e0e0e0', borderRadius: 1, p: 2, mb: 2 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.5, color: '#333' }}>
              {metric.label}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontSize: '0.65rem' }}>
              Bank vs peer average ({metric.unit})
            </Typography>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 9, fill: '#666' }}
                  axisLine={{ stroke: '#ddd' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#666' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => value !== null ? `${formatNumber(value, metric.decimals)}${metric.unit}` : 'N/A'}
                  contentStyle={{ fontSize: '0.7rem', border: '1px solid #ddd', borderRadius: 4 }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '0.65rem', paddingTop: 8 }}
                  iconType="line"
                  iconSize={10}
                />
                <Line
                  type="monotone"
                  dataKey={`${metric.key}_bank`}
                  stroke="#d97757"
                  strokeWidth={2.5}
                  name="This Bank"
                  dot={{ r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey={`${metric.key}_peer`}
                  stroke="#999"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Peer Avg"
                  dot={{ r: 2, strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        ))}
      </Paper>

      {/* Stack Rankings Table - Dense, Tufte-style */}
      <Paper sx={{ p: 2, bgcolor: '#fafafa' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, fontSize: '0.95rem', borderBottom: '2px solid #333', pb: 0.5 }}>
          CURRENT RANKINGS
        </Typography>

        <Box sx={{ overflowX: 'auto' }}>
          <Box sx={{ minWidth: 600 }}>
            {/* Header */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
              gap: 1,
              mb: 1,
              pb: 0.5,
              borderBottom: '1px solid #ddd'
            }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }}>
                Metric
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary', textAlign: 'right' }}>
                Value
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary', textAlign: 'right' }}>
                Rank
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary', textAlign: 'right' }}>
                Percentile
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary', textAlign: 'center' }}>
                Position
              </Typography>
            </Box>

            {/* Data rows */}
            {metrics.map((metric) => {
              const ranking = latest.peerAnalysis?.rankings?.[metric.key];
              const value = latest.ratios?.[metric.key];

              return (
                <Box
                  key={metric.key}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                    gap: 1,
                    py: 0.75,
                    borderBottom: '1px solid #f0f0f0',
                    '&:hover': { bgcolor: '#f9f9f9' }
                  }}
                >
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                    {metric.label}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>
                    {formatNumber(value, metric.decimals)}{metric.unit}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', textAlign: 'right', fontWeight: 600 }}>
                    #{ranking?.rank || '—'} / {ranking?.total || '—'}
                  </Typography>
                  <Typography sx={{
                    fontSize: '0.75rem',
                    textAlign: 'right',
                    fontWeight: 600,
                    color: ranking ? getPercentileColor(ranking.percentile, metric.lowerBetter) : '#666'
                  }}>
                    {ranking?.percentile ? `${ranking.percentile}th` : '—'}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    {ranking && ranking.percentile && (
                      <Box sx={{
                        width: 80,
                        height: 6,
                        bgcolor: '#e0e0e0',
                        borderRadius: 0.5,
                        position: 'relative'
                      }}>
                        <Box sx={{
                          width: `${ranking.percentile}%`,
                          height: '100%',
                          bgcolor: getPercentileColor(ranking.percentile, metric.lowerBetter),
                          borderRadius: 0.5
                        }} />
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Paper>

      {/* Loan Portfolio Mix - Tufte-style Dot Plot */}
      {peerBanksData && peerBanksData.banks && peerBanksData.banks.filter(b => b.loanMix).length > 0 && (
        <Paper sx={{ mb: 2, p: 2, bgcolor: '#fafafa' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, fontSize: '0.95rem', borderBottom: '2px solid #333', pb: 0.5 }}>
            LOAN PORTFOLIO MIX VS PEERS
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', mb: 2, color: 'text.secondary' }}>
            Each line represents 0-100% scale. Dots indicate: Min (peer minimum) • This Bank (colored) • Average (gray) • Max (peer maximum)
          </Typography>

          <LoanMixDotPlot
            banks={peerBanksData.banks}
            targetBankId={idrssd}
          />
        </Paper>
      )}
    </Box>
  );
}

/**
 * LoanMixDotPlot - Tufte-style information-dense visualization
 * Shows min/bank/average/max for each loan category across peers
 */
function LoanMixDotPlot({ banks, targetBankId }) {
  // Filter banks with loan mix data
  const banksWithData = banks.filter(b => b.loanMix);

  if (banksWithData.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 2 }}>
        Loan portfolio composition data not available for peer banks.
      </Typography>
    );
  }

  const targetBank = banksWithData.find(b => b.idrssd === targetBankId);

  // Define loan categories to display
  const categories = [
    { key: 'consumerPct', label: 'Consumer Lending', color: '#d97757' },
    { key: 'residentialPct', label: '  Residential Mortgages', color: '#42a5f5', indent: true },
    { key: 'creditCardsPct', label: '  Credit Cards', color: '#64b5f6', indent: true },
    { key: 'autoPct', label: '  Auto Loans', color: '#90caf9', indent: true },
    { key: 'businessPct', label: 'Business Lending', color: '#388e3c' },
    { key: 'commercialREPct', label: '  Commercial Real Estate', color: '#66bb6a', indent: true },
    { key: 'cniPct', label: '  C&I Loans', color: '#81c784', indent: true }
  ];

  return (
    <Box sx={{ mt: 2 }}>
      {categories.map((category) => {
        // Calculate statistics
        const values = banksWithData
          .map(b => b.loanMix[category.key])
          .filter(v => v !== null && v !== undefined && !isNaN(v));

        if (values.length === 0) return null;

        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        const bankValue = targetBank?.loanMix?.[category.key];

        // Check if bank value and average are too close (within 3%)
        const isTooClose = bankValue !== null && bankValue !== undefined && Math.abs(bankValue - avg) < 3;

        // Find banks with min and max values
        const minBank = banksWithData.find(b => b.loanMix[category.key] === min);
        const maxBank = banksWithData.find(b => b.loanMix[category.key] === max);

        return (
          <Box key={category.key} sx={{ mb: 2 }}>
            {/* Category label and value */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 2 }}>
              <Typography sx={{
                fontSize: category.indent ? '0.75rem' : '0.85rem',
                fontWeight: category.indent ? 400 : 600,
                color: category.indent ? 'text.secondary' : 'text.primary',
                fontFamily: 'monospace'
              }}>
                {category.label}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 600 }}>
                {bankValue !== null && bankValue !== undefined ? `${bankValue.toFixed(1)}%` : '—'}
              </Typography>
            </Box>

            {/* Dot plot line - fixed scale 0-100% */}
            <Box sx={{ position: 'relative', height: 40, display: 'flex', alignItems: 'center' }}>
              {/* Baseline - thin line spanning from min to max */}
              <Box sx={{
                position: 'absolute',
                left: `${min}%`,
                width: `${max - min}%`,
                top: '50%',
                height: 3,
                bgcolor: '#e0e0e0',
                borderRadius: '1.5px',
                transform: 'translateY(-50%)'
              }} />

              {/* Min dot */}
              <MuiTooltip
                title={`Min: ${minBank?.name || 'Unknown'}`}
                placement="top"
                arrow
              >
                <Box sx={{
                  position: 'absolute',
                  left: `${min}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  cursor: 'pointer'
                }}>
                  <Box sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: '#bdbdbd',
                    border: '2px solid #fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                  <Typography sx={{
                    position: 'absolute',
                    top: 22,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '0.65rem',
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                    fontFamily: 'monospace'
                  }}>
                    {min.toFixed(1)}%
                  </Typography>
                </Box>
              </MuiTooltip>

              {/* This Bank dot */}
              {bankValue !== null && bankValue !== undefined && (
                <Box sx={{
                  position: 'absolute',
                  left: `${bankValue}%`,
                  top: isTooClose ? '35%' : '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 3
                }}>
                  <Box sx={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    bgcolor: category.color,
                    border: '3px solid #fff',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }} />
                  <Typography sx={{
                    position: 'absolute',
                    top: -22,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: category.color,
                    whiteSpace: 'nowrap',
                    fontFamily: 'monospace'
                  }}>
                    {bankValue.toFixed(1)}%
                  </Typography>
                </Box>
              )}

              {/* Average dot */}
              <Box sx={{
                position: 'absolute',
                left: `${avg}%`,
                top: isTooClose ? '65%' : '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 2
              }}>
                <Box sx={{
                  width: 11,
                  height: 11,
                  borderRadius: '50%',
                  bgcolor: '#757575',
                  border: '2px solid #fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
                <Typography sx={{
                  position: 'absolute',
                  bottom: 20,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '0.65rem',
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                  fontStyle: 'italic',
                  fontFamily: 'monospace'
                }}>
                  Avg {avg.toFixed(1)}%
                </Typography>
              </Box>

              {/* Max dot */}
              <MuiTooltip
                title={`Max: ${maxBank?.name || 'Unknown'}`}
                placement="top"
                arrow
              >
                <Box sx={{
                  position: 'absolute',
                  left: `${max}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  cursor: 'pointer'
                }}>
                  <Box sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: '#bdbdbd',
                    border: '2px solid #fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                  <Typography sx={{
                    position: 'absolute',
                    top: 22,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '0.65rem',
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                    fontFamily: 'monospace'
                  }}>
                    {max.toFixed(1)}%
                  </Typography>
                </Box>
              </MuiTooltip>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export default PeerComparisonTab;
