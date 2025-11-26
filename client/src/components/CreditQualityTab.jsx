import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Chip
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';

/**
 * Credit Quality Tab - Detailed view of asset quality metrics
 * Shows past due, nonaccrual, and charge-off data by loan category
 */
function CreditQualityTab({ financialStatement, previousStatement }) {
  const creditQuality = financialStatement?.creditQuality;
  const chargeOffs = financialStatement?.chargeOffsAndRecoveries;
  const totalLoans = financialStatement?.balanceSheet?.assets?.earningAssets?.loansAndLeases?.net || 0;

  // Previous period data for comparison
  const prevCreditQuality = previousStatement?.creditQuality;
  const prevTotalLoans = previousStatement?.balanceSheet?.assets?.earningAssets?.loansAndLeases?.net || 0;

  // Format currency
  const formatCurrency = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: value >= 1000000000 ? 'compact' : 'standard'
    }).format(value / 1000); // Convert to thousands
  };

  // Format percentage
  const formatPercent = (value) => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    return `${value.toFixed(2)}%`;
  };

  // Calculate ratio
  const calcRatio = (numerator, denominator) => {
    if (!denominator || denominator === 0) return null;
    return (numerator / denominator) * 100;
  };

  // Get trend indicator
  const getTrend = (current, previous) => {
    if (current === null || previous === null || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    if (Math.abs(change) < 5) return { direction: 'flat', change };
    return { direction: change > 0 ? 'up' : 'down', change };
  };

  // Render trend icon (for credit quality, down is good)
  const renderTrend = (current, previous, invertColors = true) => {
    const trend = getTrend(current, previous);
    if (!trend) return null;

    const { direction, change } = trend;
    const absChange = Math.abs(change).toFixed(1);

    if (direction === 'flat') {
      return (
        <Tooltip title={`${change >= 0 ? '+' : ''}${change.toFixed(1)}% vs prior period`}>
          <TrendingFlatIcon sx={{ fontSize: 16, color: '#757575', ml: 0.5 }} />
        </Tooltip>
      );
    }

    // For credit quality metrics, decreasing is good (green), increasing is bad (red)
    const isGood = invertColors ? direction === 'down' : direction === 'up';

    return (
      <Tooltip title={`${change >= 0 ? '+' : ''}${change.toFixed(1)}% vs prior period`}>
        {direction === 'up' ? (
          <TrendingUpIcon sx={{ fontSize: 16, color: isGood ? '#388e3c' : '#d32f2f', ml: 0.5 }} />
        ) : (
          <TrendingDownIcon sx={{ fontSize: 16, color: isGood ? '#388e3c' : '#d32f2f', ml: 0.5 }} />
        )}
      </Tooltip>
    );
  };

  // Status chip based on NPL ratio
  const getStatusChip = (nplRatio) => {
    if (nplRatio === null) return null;
    if (nplRatio < 0.5) return <Chip label="Excellent" size="small" sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 600, fontSize: '0.7rem' }} />;
    if (nplRatio < 1) return <Chip label="Good" size="small" sx={{ bgcolor: '#e8f5e9', color: '#388e3c', fontWeight: 600, fontSize: '0.7rem' }} />;
    if (nplRatio < 2) return <Chip label="Moderate" size="small" sx={{ bgcolor: '#fff3e0', color: '#f57c00', fontWeight: 600, fontSize: '0.7rem' }} />;
    if (nplRatio < 3) return <Chip label="Elevated" size="small" sx={{ bgcolor: '#ffebee', color: '#d32f2f', fontWeight: 600, fontSize: '0.7rem' }} />;
    return <Chip label="High Risk" size="small" sx={{ bgcolor: '#ffcdd2', color: '#b71c1c', fontWeight: 600, fontSize: '0.7rem' }} />;
  };

  if (!creditQuality) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          Credit quality data not available for this period.
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          RC-N schedule data may not have been imported.
        </Typography>
      </Box>
    );
  }

  // Calculate summary metrics
  const summary = creditQuality.summary || {};
  const nplRatio = calcRatio(summary.totalNonperforming, totalLoans);
  const pastDueRatio = calcRatio(summary.totalPastDueAndNonaccrual, totalLoans);

  // Previous period metrics for comparison
  const prevSummary = prevCreditQuality?.summary || {};
  const prevNplRatio = calcRatio(prevSummary.totalNonperforming, prevTotalLoans);

  // Category breakdown data
  const categoryData = [
    {
      category: 'Real Estate',
      pastDue30to89: creditQuality.pastDue30to89?.realEstate?.total || 0,
      pastDue90Plus: creditQuality.pastDue90Plus?.realEstate?.total || 0,
      nonaccrual: creditQuality.nonaccrual?.realEstate?.total || 0,
      subcategories: [
        { name: 'Construction', pastDue30to89: creditQuality.pastDue30to89?.realEstate?.construction, pastDue90Plus: creditQuality.pastDue90Plus?.realEstate?.construction, nonaccrual: creditQuality.nonaccrual?.realEstate?.construction },
        { name: '1-4 Family Residential', pastDue30to89: creditQuality.pastDue30to89?.realEstate?.residential1to4Family, pastDue90Plus: creditQuality.pastDue90Plus?.realEstate?.residential1to4Family, nonaccrual: creditQuality.nonaccrual?.realEstate?.residential1to4Family },
        { name: 'Multifamily', pastDue30to89: creditQuality.pastDue30to89?.realEstate?.multifamily, pastDue90Plus: creditQuality.pastDue90Plus?.realEstate?.multifamily, nonaccrual: creditQuality.nonaccrual?.realEstate?.multifamily },
        { name: 'CRE', pastDue30to89: creditQuality.pastDue30to89?.realEstate?.cre, pastDue90Plus: creditQuality.pastDue90Plus?.realEstate?.cre, nonaccrual: creditQuality.nonaccrual?.realEstate?.cre },
        { name: 'Farmland', pastDue30to89: creditQuality.pastDue30to89?.realEstate?.farmland, pastDue90Plus: creditQuality.pastDue90Plus?.realEstate?.farmland, nonaccrual: creditQuality.nonaccrual?.realEstate?.farmland }
      ]
    },
    {
      category: 'Commercial & Industrial',
      pastDue30to89: creditQuality.pastDue30to89?.ci || 0,
      pastDue90Plus: creditQuality.pastDue90Plus?.ci || 0,
      nonaccrual: creditQuality.nonaccrual?.ci || 0
    },
    {
      category: 'Consumer',
      pastDue30to89: creditQuality.pastDue30to89?.consumer?.total || 0,
      pastDue90Plus: creditQuality.pastDue90Plus?.consumer?.total || 0,
      nonaccrual: creditQuality.nonaccrual?.consumer?.total || 0,
      subcategories: [
        { name: 'Credit Cards', pastDue30to89: creditQuality.pastDue30to89?.consumer?.creditCards, pastDue90Plus: creditQuality.pastDue90Plus?.consumer?.creditCards, nonaccrual: creditQuality.nonaccrual?.consumer?.creditCards },
        { name: 'Auto Loans', pastDue30to89: creditQuality.pastDue30to89?.consumer?.autoLoans, pastDue90Plus: creditQuality.pastDue90Plus?.consumer?.autoLoans, nonaccrual: creditQuality.nonaccrual?.consumer?.autoLoans },
        { name: 'Other Consumer', pastDue30to89: creditQuality.pastDue30to89?.consumer?.other, pastDue90Plus: creditQuality.pastDue90Plus?.consumer?.other, nonaccrual: creditQuality.nonaccrual?.consumer?.other }
      ]
    },
    {
      category: 'Agricultural',
      pastDue30to89: creditQuality.pastDue30to89?.agricultural || 0,
      pastDue90Plus: creditQuality.pastDue90Plus?.agricultural || 0,
      nonaccrual: creditQuality.nonaccrual?.agricultural || 0
    },
    {
      category: 'Leases',
      pastDue30to89: creditQuality.pastDue30to89?.leases || 0,
      pastDue90Plus: creditQuality.pastDue90Plus?.leases || 0,
      nonaccrual: creditQuality.nonaccrual?.leases || 0
    },
    {
      category: 'Other',
      pastDue30to89: creditQuality.pastDue30to89?.other || 0,
      pastDue90Plus: creditQuality.pastDue90Plus?.other || 0,
      nonaccrual: creditQuality.nonaccrual?.other || 0
    }
  ];

  return (
    <Box>
      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {/* NPL Ratio Card */}
        <Paper sx={{ p: 2, flex: '1 1 200px', minWidth: 180 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
              NPL Ratio
            </Typography>
            <Tooltip title="Nonperforming Loans (Nonaccrual + 90+ Days Past Due) / Total Loans">
              <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: nplRatio < 1 ? '#388e3c' : nplRatio < 2 ? '#ff9800' : '#d32f2f' }}>
              {formatPercent(nplRatio)}
            </Typography>
            {renderTrend(nplRatio, prevNplRatio, true)}
          </Box>
          <Box sx={{ mt: 1 }}>
            {getStatusChip(nplRatio)}
          </Box>
        </Paper>

        {/* Total Nonperforming */}
        <Paper sx={{ p: 2, flex: '1 1 200px', minWidth: 180 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
            Nonperforming Loans
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
            {formatCurrency(summary.totalNonperforming)}K
          </Typography>
          <Typography variant="caption" color="text.secondary">
            90+ Days + Nonaccrual
          </Typography>
        </Paper>

        {/* Past Due 30-89 */}
        <Paper sx={{ p: 2, flex: '1 1 200px', minWidth: 180 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
            Past Due 30-89 Days
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#ffc107' }}>
            {formatCurrency(summary.totalPastDue30to89)}K
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Early delinquency (still accruing)
          </Typography>
        </Paper>

        {/* Nonaccrual */}
        <Paper sx={{ p: 2, flex: '1 1 200px', minWidth: 180 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
            Nonaccrual Loans
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#d32f2f' }}>
            {formatCurrency(summary.totalNonaccrual)}K
          </Typography>
          <Typography variant="caption" color="text.secondary">
            No longer accruing interest
          </Typography>
        </Paper>
      </Box>

      {/* Detailed Breakdown Table */}
      <Paper sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ p: 2, pb: 1, fontWeight: 600 }}>
          Credit Quality by Loan Category
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Category</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#ffc107' }}>30-89 Days</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#ff9800' }}>90+ Days</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#d32f2f' }}>Nonaccrual</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Total NPL</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categoryData.map((row, index) => {
                const totalNPL = row.pastDue90Plus + row.nonaccrual;
                const hasSubcategories = row.subcategories && row.subcategories.length > 0;

                return (
                  <React.Fragment key={index}>
                    <TableRow sx={{ bgcolor: hasSubcategories ? '#fafafa' : 'inherit' }}>
                      <TableCell sx={{ fontWeight: hasSubcategories ? 600 : 400, fontSize: '0.8rem' }}>
                        {row.category}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {formatCurrency(row.pastDue30to89)}K
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {formatCurrency(row.pastDue90Plus)}K
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                        {formatCurrency(row.nonaccrual)}K
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                        {formatCurrency(totalNPL)}K
                      </TableCell>
                    </TableRow>
                    {hasSubcategories && row.subcategories.map((sub, subIndex) => (
                      <TableRow key={`${index}-${subIndex}`}>
                        <TableCell sx={{ pl: 4, fontSize: '0.75rem', color: 'text.secondary' }}>
                          {sub.name}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {formatCurrency(sub.pastDue30to89 || 0)}K
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {formatCurrency(sub.pastDue90Plus || 0)}K
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {formatCurrency(sub.nonaccrual || 0)}K
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {formatCurrency((sub.pastDue90Plus || 0) + (sub.nonaccrual || 0))}K
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                );
              })}
              {/* Total Row */}
              <TableRow sx={{ bgcolor: '#e8e8e8' }}>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.85rem' }}>TOTAL</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {formatCurrency(summary.totalPastDue30to89)}K
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {formatCurrency(summary.totalPastDue90Plus)}K
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {formatCurrency(summary.totalNonaccrual)}K
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {formatCurrency(summary.totalNonperforming)}K
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Charge-offs Section */}
      {chargeOffs && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
            Charge-offs & Recoveries (YTD)
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Gross Charge-offs</Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#d32f2f' }}>
                {formatCurrency(chargeOffs.chargeOffs?.total)}K
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Recoveries</Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#388e3c' }}>
                {formatCurrency(chargeOffs.recoveries?.total)}K
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Net Charge-offs</Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {formatCurrency(chargeOffs.netChargeOffs?.total)}K
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">NCO Ratio</Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {formatPercent(calcRatio(chargeOffs.netChargeOffs?.total, totalLoans))}
              </Typography>
            </Box>
          </Box>

          {/* Charge-off breakdown */}
          <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {chargeOffs.chargeOffs?.realEstate > 0 && (
              <Chip label={`RE: ${formatCurrency(chargeOffs.netChargeOffs?.realEstate)}K`} size="small" variant="outlined" />
            )}
            {chargeOffs.chargeOffs?.ci > 0 && (
              <Chip label={`C&I: ${formatCurrency(chargeOffs.netChargeOffs?.ci)}K`} size="small" variant="outlined" />
            )}
            {chargeOffs.chargeOffs?.consumer?.total > 0 && (
              <Chip label={`Consumer: ${formatCurrency(chargeOffs.netChargeOffs?.consumer)}K`} size="small" variant="outlined" />
            )}
          </Box>
        </Paper>
      )}

      {/* Footnote */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, fontStyle: 'italic' }}>
        Data from FFIEC Call Report Schedule RC-N (Past Due and Nonaccrual) and RI-B (Charge-offs).
        NPL = Nonperforming Loans (90+ days past due + nonaccrual). All values in thousands.
      </Typography>
    </Box>
  );
}

export default CreditQualityTab;
