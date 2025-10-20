import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Grid
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

        // Reverse to get chronological order
        setPeerData(statementsWithPeers.reverse());

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
      data[`${metric.key}_bank`] = stmt.ratios?.[metric.key] || null;
      data[`${metric.key}_peer`] = stmt.peerAnalysis?.peerAverages?.[metric.key] || null;
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

          // Prepare chart data - sorted by metric value (all 21 banks: target + 20 peers)
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
              .sort((a, b) => metric.lowerBetter ? a.value - b.value : b.value - a.value);
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
                      This Bank: <strong style={{ color: '#1976d2' }}>{formatNumber(bankValue, metric.decimals)}{metric.unit}</strong>
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
                        fill={entry.isTarget ? '#1976d2' : '#bdbdbd'}
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
                  stroke="#1976d2"
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
    </Box>
  );
}

export default PeerComparisonTab;
