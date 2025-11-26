import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';

/**
 * Large Sparkline Component for Ratio Trends - Tufte-inspired
 */
const RatioSparkline = ({ data, periods = [], suffix = '%', decimals = 2 }) => {
  const [tooltip, setTooltip] = React.useState({ show: false, x: 0, y: 0, value: 0, period: '' });

  if (!data || data.length === 0) {
    return (
      <Box sx={{ width: 300, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" color="text.secondary">No data</Typography>
      </Box>
    );
  }

  const width = 300;
  const height = 60;

  const values = data.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (values.length === 0) {
    return (
      <Box sx={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" color="text.secondary">No data</Typography>
      </Box>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Create points for the line
  const points = values.map((value, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  // Last value point
  const lastValue = values[values.length - 1];
  const lastX = width;
  const lastY = height - ((lastValue - min) / range) * height;

  const formatValue = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '—';
    return `${num.toFixed(decimals)}${suffix}`;
  };

  const formatPeriod = (period) => {
    if (!period) return '';
    const date = new Date(period);
    const year = date.getFullYear();
    const quarter = Math.ceil((date.getMonth() + 1) / 3);
    return `${year} Q${quarter}`;
  };

  const handleMouseMove = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const dataIndex = Math.round((x / width) * (values.length - 1));

    if (dataIndex >= 0 && dataIndex < values.length) {
      const pointX = (dataIndex / Math.max(values.length - 1, 1)) * width;
      const pointY = height - ((values[dataIndex] - min) / range) * height;

      setTooltip({
        show: true,
        x: pointX,
        y: pointY,
        value: values[dataIndex],
        period: periods[dataIndex] ? formatPeriod(periods[dataIndex]) : `Period ${dataIndex + 1}`
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltip({ show: false, x: 0, y: 0, value: 0, period: '' });
  };

  return (
    <Box sx={{ position: 'relative', display: 'inline-block' }}>
      <svg
        width={width}
        height={height}
        style={{ cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Grid lines for reference - very subtle */}
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#e0e0e0" strokeWidth="0.5" strokeDasharray="2,2" />

        {/* Main trend line */}
        <polyline
          points={points}
          fill="none"
          stroke="#d97757"
          strokeWidth="2"
        />

        {/* Dot at last value */}
        <circle
          cx={lastX}
          cy={lastY}
          r="3.5"
          fill="#d97757"
        />

        {/* Hover indicator */}
        {tooltip.show && (
          <circle
            cx={tooltip.x}
            cy={tooltip.y}
            r="4"
            fill="#d97757"
            stroke="#fff"
            strokeWidth="2"
          />
        )}
      </svg>

      {/* Tooltip */}
      {tooltip.show && (
        <Box
          sx={{
            position: 'absolute',
            left: Math.min(tooltip.x + 10, width - 80),
            top: Math.max(tooltip.y - 35, 0),
            bgcolor: 'rgba(0,0,0,0.9)',
            color: 'white',
            px: 1.5,
            py: 0.75,
            borderRadius: '4px',
            fontSize: '0.75rem',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            pointerEvents: 'none'
          }}
        >
          <div style={{ fontWeight: 600 }}>{tooltip.period}</div>
          <div>{formatValue(tooltip.value)}</div>
        </Box>
      )}
    </Box>
  );
};

/**
 * Ratios Tab - Tufte-style table with sparklines
 * Following Tufte's principles: minimal design, maximum data density, clear information hierarchy
 */
function RatiosTab({ financialStatement, historicalData = [], metadata = null }) {
  if (!financialStatement?.ratios) {
    return <Typography>No ratio data available</Typography>;
  }

  const { ratios, balanceSheet, incomeStatement } = financialStatement;

  // Calculate additional ratios not in the ratios object
  const calculateLoanToDepositRatio = (bs) => {
    if (!bs?.assets?.earningAssets?.loansAndLeases?.net || !bs?.liabilities?.deposits?.total) return null;
    return (bs.assets.earningAssets.loansAndLeases.net / bs.liabilities.deposits.total) * 100;
  };

  const calculateNonInterestIncomeRatio = (is) => {
    if (!is?.noninterestIncome?.total || !is?.netInterestIncome) return null;
    const totalRevenue = is.netInterestIncome + is.noninterestIncome.total;
    if (totalRevenue === 0) return null;
    return (is.noninterestIncome.total / totalRevenue) * 100;
  };

  const calculatePreTaxPreProvisionROA = (is, bs) => {
    if (!is?.netIncome || !bs?.assets?.totalAssets) return null;
    const preTaxPreProvisionIncome = is.netIncome + (is.applicableTaxes || 0) + (is.provisionForCreditLosses || 0);
    return (preTaxPreProvisionIncome / bs.assets.totalAssets) * 100;
  };

  // Current period calculated ratios
  const loanToDepositRatio = calculateLoanToDepositRatio(balanceSheet);
  const nonInterestIncomeRatio = calculateNonInterestIncomeRatio(incomeStatement);
  const preTaxPreProvisionROA = calculatePreTaxPreProvisionROA(incomeStatement, balanceSheet);

  // Extract historical ratio data for sparklines
  const periods = historicalData.map(d => d.reportingPeriod);
  const operatingLeverageData = historicalData.map(d => d.ratios?.operatingLeverage);
  const roeData = historicalData.map(d => d.ratios?.roe);
  const roaData = historicalData.map(d => d.ratios?.roa);
  const nimData = historicalData.map(d => d.ratios?.netInterestMargin);
  const efficiencyData = historicalData.map(d => d.ratios?.efficiencyRatio);

  // Calculate historical data for new ratios
  const loanToDepositData = historicalData.map(d => calculateLoanToDepositRatio(d.balanceSheet));
  const nonInterestIncomeData = historicalData.map(d => calculateNonInterestIncomeRatio(d.incomeStatement));
  const preTaxPreProvisionROAData = historicalData.map(d => calculatePreTaxPreProvisionROA(d.incomeStatement, d.balanceSheet));

  const ratioDefinitions = [
    {
      name: 'Operating Leverage',
      equation: '(YoY % Change in PPNR) / (YoY % Change in Total Revenue)',
      value: ratios.operatingLeverage,
      historicalData: operatingLeverageData,
      suffix: 'x',
      decimals: 2
    },
    {
      name: 'Loan-to-Deposit Ratio',
      equation: 'Total Loans / Total Deposits',
      value: loanToDepositRatio,
      historicalData: loanToDepositData,
      suffix: '%',
      decimals: 1
    },
    {
      name: 'Non-Interest Income Ratio',
      equation: 'Non-Interest Income / Total Revenue',
      value: nonInterestIncomeRatio,
      historicalData: nonInterestIncomeData,
      suffix: '%',
      decimals: 1
    },
    {
      name: 'Pre-Tax Pre-Provision ROA',
      equation: '(Net Income + Taxes + Provisions) / Total Assets',
      value: preTaxPreProvisionROA,
      historicalData: preTaxPreProvisionROAData,
      suffix: '%',
      decimals: 2
    },
    {
      name: 'Return on Equity (ROE)',
      equation: 'Net Income / Average Total Equity',
      value: ratios.roe,
      historicalData: roeData,
      suffix: '%',
      decimals: 2
    },
    {
      name: 'Return on Assets (ROA)',
      equation: 'Net Income / Average Total Assets',
      value: ratios.roa,
      historicalData: roaData,
      suffix: '%',
      decimals: 2
    },
    {
      name: 'Net Interest Margin (NIM)',
      equation: 'Net Interest Income / Average Earning Assets',
      value: ratios.netInterestMargin,
      historicalData: nimData,
      suffix: '%',
      decimals: 2
    },
    {
      name: 'Efficiency Ratio',
      equation: 'Noninterest Expense / (Net Interest Income + Noninterest Income)',
      value: ratios.efficiencyRatio,
      historicalData: efficiencyData,
      suffix: '%',
      decimals: 2
    }
  ];

  const formatValue = (value, suffix = '%', decimals = 2) => {
    if (value === null || value === undefined || isNaN(value)) return '—';
    return `${value.toFixed(decimals)}${suffix}`;
  };

  return (
    <Box>
      {/* Title and description */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
          Financial Ratios
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Key performance metrics with historical trends
        </Typography>
      </Box>

      {/* Tufte-style table */}
      <Paper variant="outlined" sx={{ border: 'none' }}>
        <Table
          sx={{
            '& .MuiTableCell-root': {
              borderBottom: '1px solid #e0e0e0',
              py: 2
            },
            '& .MuiTableRow-root:last-child .MuiTableCell-root': {
              borderBottom: 'none'
            }
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem', width: '20%' }}>
                Ratio
              </TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem', width: '35%' }}>
                Formula
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.875rem', width: '10%' }}>
                Value
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.875rem', width: '35%' }}>
                Trend
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ratioDefinitions.map((ratio, index) => (
              <TableRow
                key={index}
                sx={{
                  '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.02)' }
                }}
              >
                <TableCell>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    {ratio.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      color: 'text.secondary'
                    }}
                  >
                    {ratio.equation}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontSize: '1.1rem',
                      color: 'primary.main'
                    }}
                  >
                    {formatValue(ratio.value, ratio.suffix, ratio.decimals)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <RatioSparkline
                    data={ratio.historicalData}
                    periods={periods}
                    suffix={ratio.suffix}
                    decimals={ratio.decimals}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* Explanatory footnotes - Tufte style */}
      <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid #e0e0e0' }}>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, lineHeight: 1.6 }}>
          <strong>Operating Leverage:</strong> Measures how changes in revenue amplify changes in operating income (operational scalability). Formula: (YoY % Change in PPNR) / (YoY % Change in Total Revenue), where PPNR = Pre-Provision Net Revenue (Total Revenue - Operating Expenses). Values &gt;1.0 indicate revenue changes have a magnified impact on operating income = EXCELLENT. Sustained operating leverage &gt;1.0 over multiple quarters indicates scalable, efficient operations.
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, lineHeight: 1.6 }}>
          <strong>Loan-to-Deposit Ratio:</strong> Critical liquidity metric showing funding dependency.
          Benchmark: 80-90% is healthy. Values &gt;100% may indicate liquidity stress and reliance on wholesale funding.
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, lineHeight: 1.6 }}>
          <strong>Non-Interest Income Ratio:</strong> Shows revenue diversification and fee income contribution.
          Higher ratios indicate less reliance on net interest margin and more diverse revenue streams.
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, lineHeight: 1.6 }}>
          <strong>Pre-Tax Pre-Provision ROA:</strong> Core earning power before credit costs and taxes.
          Better for comparing performance across credit cycles. Strong banks maintain &gt;1.5%.
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, lineHeight: 1.6 }}>
          <strong>ROE & ROA:</strong> Profitability metrics. ROA measures asset efficiency (benchmark: &gt;1.0%).
          ROE measures shareholder returns (benchmark: &gt;10%).
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, lineHeight: 1.6 }}>
          <strong>Net Interest Margin:</strong> Spread between interest income and interest expense as a percentage
          of earning assets. Higher is better (typical range: 3-4%).
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.6 }}>
          <strong>Efficiency Ratio:</strong> Operating costs as a percentage of revenue. Lower is better.
          Elite performers maintain ratios below 55%.
        </Typography>
      </Box>
    </Box>
  );
}

export default RatiosTab;
