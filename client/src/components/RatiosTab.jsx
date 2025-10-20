import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Divider
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';

/**
 * Ratios Tab - Display key financial ratios with benchmarks
 * Following Tufte's principles: clear typography, minimal decoration
 */
function RatiosTab({ financialStatement, previousPeriodStatement }) {
  if (!financialStatement?.ratios) {
    return <Typography>No ratio data available</Typography>;
  }

  const { ratios } = financialStatement;

  // Calculate trends if previous period available
  const getTrend = (current, previous) => {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / Math.abs(previous)) * 100;
    if (Math.abs(change) < 1) return { direction: 'flat', change: 0 };
    return { direction: change > 0 ? 'up' : 'down', change };
  };

  const previousRatios = previousPeriodStatement?.ratios || {};

  const ratioData = [
    {
      name: 'Efficiency Ratio',
      value: ratios.efficiencyRatio,
      format: (v) => `${v?.toFixed(2)}%`,
      description: 'Noninterest Expense / (Net Interest Income + Noninterest Income)',
      benchmark: '55-65%',
      betterDirection: 'lower',
      trend: getTrend(ratios.efficiencyRatio, previousRatios.efficiencyRatio)
    },
    {
      name: 'Return on Assets (ROA)',
      value: ratios.roa,
      format: (v) => `${v?.toFixed(2)}%`,
      description: 'Net Income / Average Total Assets',
      benchmark: '>1.0%',
      betterDirection: 'higher',
      trend: getTrend(ratios.roa, previousRatios.roa)
    },
    {
      name: 'Return on Equity (ROE)',
      value: ratios.roe,
      format: (v) => `${v?.toFixed(2)}%`,
      description: 'Net Income / Average Total Equity',
      benchmark: '>10%',
      betterDirection: 'higher',
      trend: getTrend(ratios.roe, previousRatios.roe)
    },
    {
      name: 'Net Interest Margin (NIM)',
      value: ratios.netInterestMargin,
      format: (v) => `${v?.toFixed(2)}%`,
      description: 'Net Interest Income / Average Earning Assets',
      benchmark: '3.0-4.0%',
      betterDirection: 'higher',
      trend: getTrend(ratios.netInterestMargin, previousRatios.netInterestMargin)
    },
    {
      name: 'Tier 1 Leverage Ratio',
      value: ratios.tier1LeverageRatio,
      format: (v) => `${v?.toFixed(2)}%`,
      description: 'Tier 1 Capital / Average Total Assets',
      benchmark: '>5%',
      betterDirection: 'higher',
      trend: getTrend(ratios.tier1LeverageRatio, previousRatios.tier1LeverageRatio)
    }
  ];

  const TrendIcon = ({ trend, betterDirection }) => {
    if (!trend || trend.direction === 'flat') {
      return <TrendingFlatIcon sx={{ color: 'text.secondary', fontSize: 20 }} />;
    }

    const isPositive =
      (trend.direction === 'up' && betterDirection === 'higher') ||
      (trend.direction === 'down' && betterDirection === 'lower');

    if (trend.direction === 'up') {
      return <TrendingUpIcon sx={{ color: isPositive ? 'success.main' : 'error.main', fontSize: 20 }} />;
    }
    return <TrendingDownIcon sx={{ color: isPositive ? 'success.main' : 'error.main', fontSize: 20 }} />;
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Key performance metrics with industry benchmarks
      </Typography>

      <Grid container spacing={3}>
        {ratioData.map((ratio, index) => (
          <Grid item xs={12} md={6} key={index}>
            <Paper sx={{ p: 3, height: '100%' }}>
              {/* Ratio Name and Trend */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                  {ratio.name}
                </Typography>
                {ratio.trend && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TrendIcon trend={ratio.trend} betterDirection={ratio.betterDirection} />
                    {ratio.trend.change !== 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {Math.abs(ratio.trend.change).toFixed(1)}%
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>

              {/* Value */}
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  color: 'primary.main',
                  mb: 2
                }}
              >
                {ratio.value != null ? ratio.format(ratio.value) : 'N/A'}
              </Typography>

              <Divider sx={{ mb: 2 }} />

              {/* Description */}
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                {ratio.description}
              </Typography>

              {/* Benchmark */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Industry Benchmark:
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {ratio.benchmark}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Explanatory Note */}
      <Paper sx={{ p: 3, mt: 3, bgcolor: 'grey.50' }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
          About These Ratios
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          <strong>Efficiency Ratio:</strong> Measures operational efficiency. Lower is better.
          Banks with ratios below 55% are considered highly efficient.
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          <strong>ROA & ROE:</strong> Profitability metrics. ROA measures how efficiently assets generate profit.
          ROE measures returns to shareholders.
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          <strong>Net Interest Margin:</strong> Measures lending profitability. Higher margins indicate
          better returns on interest-earning assets relative to interest costs.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Tier 1 Leverage Ratio:</strong> Capital adequacy metric. Regulatory minimum is 4%.
          Well-capitalized banks maintain ratios above 5%.
        </Typography>
      </Paper>
    </Box>
  );
}

export default RatiosTab;
