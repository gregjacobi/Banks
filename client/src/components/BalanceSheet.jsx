import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
  Box,
  Collapse,
  IconButton
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

/**
 * Enhanced Sparkline Component - Tufte-inspired inline trend graphic
 */
const Sparkline = ({ data, width = 60, height = 24, color = '#666' }) => {
  if (!data || data.length < 2) return <Box sx={{ width, height, display: 'inline-block' }} />;

  const values = data.filter(v => v != null && !isNaN(v));
  if (values.length < 2) return <Box sx={{ width, height, display: 'inline-block' }} />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const lastValue = values[values.length - 1];
  const lastX = width;
  const lastY = height - ((lastValue - min) / range) * height;

  return (
    <svg width={width} height={height} style={{ marginLeft: 12, verticalAlign: 'middle' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
      <circle
        cx={lastX}
        cy={lastY}
        r="2"
        fill={color}
      />
    </svg>
  );
};

/**
 * Balance Sheet Display Component
 * Tufte-inspired: minimal decoration, maximum data density, clear hierarchy
 */
function BalanceSheet({ balanceSheet, historicalData = [] }) {
  const [loansExpanded, setLoansExpanded] = useState(false);

  if (!balanceSheet) {
    return <Typography>No balance sheet data available</Typography>;
  }

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value * 1000);
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '—';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const { assets, liabilities, equity } = balanceSheet;
  const portfolio = assets?.earningAssets?.loansAndLeases?.portfolio;

  // Extract historical trends for sparklines (last 8 quarters)
  const getHistoricalTrend = (extractFn) => {
    if (!historicalData || historicalData.length === 0) return [];
    const data = historicalData.slice(-8).map(extractFn);
    return data;
  };

  // Calculate YoY change
  const getYoYChange = (extractFn) => {
    if (!historicalData || historicalData.length < 5) return null;
    const current = extractFn(historicalData[historicalData.length - 1]);
    const yearAgo = extractFn(historicalData[historicalData.length - 5]);
    if (!current || !yearAgo || yearAgo === 0) return null;
    return ((current - yearAgo) / Math.abs(yearAgo)) * 100;
  };

  // ==================== ASSETS HISTORICAL DATA ====================
  const totalAssetsHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.assets?.totalAssets);
  const totalAssetsYoY = getYoYChange(stmt => stmt.balanceSheet?.assets?.totalAssets);

  const totalLoansGrossHistory = getHistoricalTrend(stmt =>
    stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.net +
    (stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.netOfAllowance || 0)
  );
  const totalLoansGrossYoY = getYoYChange(stmt =>
    stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.net +
    (stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.netOfAllowance || 0)
  );

  const allowanceHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.netOfAllowance);
  const allowanceYoY = getYoYChange(stmt => stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.netOfAllowance);

  const totalLoansHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.net);
  const totalLoansYoY = getYoYChange(stmt => stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.net);

  const securitiesAFSHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.assets?.earningAssets?.securities?.availableForSale);
  const securitiesAFSYoY = getYoYChange(stmt => stmt.balanceSheet?.assets?.earningAssets?.securities?.availableForSale);

  const securitiesHTMHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.assets?.earningAssets?.securities?.heldToMaturity);
  const securitiesHTMYoY = getYoYChange(stmt => stmt.balanceSheet?.assets?.earningAssets?.securities?.heldToMaturity);

  const interestBearingBalancesHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.assets?.earningAssets?.interestBearingBankBalances);
  const interestBearingBalancesYoY = getYoYChange(stmt => stmt.balanceSheet?.assets?.earningAssets?.interestBearingBankBalances);

  const cashHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.assets?.nonearningAssets?.cashAndDueFromBanks);
  const cashYoY = getYoYChange(stmt => stmt.balanceSheet?.assets?.nonearningAssets?.cashAndDueFromBanks);

  const premisesHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.assets?.nonearningAssets?.premisesAndFixedAssets);
  const premisesYoY = getYoYChange(stmt => stmt.balanceSheet?.assets?.nonearningAssets?.premisesAndFixedAssets);

  const intangiblesHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.assets?.nonearningAssets?.intangibleAssets);
  const intangiblesYoY = getYoYChange(stmt => stmt.balanceSheet?.assets?.nonearningAssets?.intangibleAssets);

  const otherAssetsHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.assets?.nonearningAssets?.otherAssets);
  const otherAssetsYoY = getYoYChange(stmt => stmt.balanceSheet?.assets?.nonearningAssets?.otherAssets);

  // ==================== LIABILITIES HISTORICAL DATA ====================
  const totalDepositsHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.liabilities?.deposits?.total);
  const totalDepositsYoY = getYoYChange(stmt => stmt.balanceSheet?.liabilities?.deposits?.total);

  const nonInterestBearingDepositsHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.liabilities?.deposits?.nonInterestBearing);
  const nonInterestBearingDepositsYoY = getYoYChange(stmt => stmt.balanceSheet?.liabilities?.deposits?.nonInterestBearing);

  const interestBearingDepositsHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.liabilities?.deposits?.interestBearing);
  const interestBearingDepositsYoY = getYoYChange(stmt => stmt.balanceSheet?.liabilities?.deposits?.interestBearing);

  const otherBorrowedMoneyHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.liabilities?.borrowings?.otherBorrowedMoney);
  const otherBorrowedMoneyYoY = getYoYChange(stmt => stmt.balanceSheet?.liabilities?.borrowings?.otherBorrowedMoney);

  const subordinatedDebtHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.liabilities?.borrowings?.subordinatedDebt);
  const subordinatedDebtYoY = getYoYChange(stmt => stmt.balanceSheet?.liabilities?.borrowings?.subordinatedDebt);

  const otherLiabilitiesHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.liabilities?.otherLiabilities);
  const otherLiabilitiesYoY = getYoYChange(stmt => stmt.balanceSheet?.liabilities?.otherLiabilities);

  const totalLiabilitiesHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.liabilities?.totalLiabilities);
  const totalLiabilitiesYoY = getYoYChange(stmt => stmt.balanceSheet?.liabilities?.totalLiabilities);

  // ==================== EQUITY HISTORICAL DATA ====================
  const commonStockHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.equity?.commonStock);
  const commonStockYoY = getYoYChange(stmt => stmt.balanceSheet?.equity?.commonStock);

  const surplusHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.equity?.surplus);
  const surplusYoY = getYoYChange(stmt => stmt.balanceSheet?.equity?.surplus);

  const retainedEarningsHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.equity?.retainedEarnings);
  const retainedEarningsYoY = getYoYChange(stmt => stmt.balanceSheet?.equity?.retainedEarnings);

  const accumulatedOCIHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.equity?.accumulatedOCI);
  const accumulatedOCIYoY = getYoYChange(stmt => stmt.balanceSheet?.equity?.accumulatedOCI);

  const totalEquityHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.equity?.totalEquity);
  const totalEquityYoY = getYoYChange(stmt => stmt.balanceSheet?.equity?.totalEquity);

  const totalLiabilitiesEquityHistory = getHistoricalTrend(stmt =>
    stmt.balanceSheet?.liabilities?.totalLiabilities + stmt.balanceSheet?.equity?.totalEquity
  );
  const totalLiabilitiesEquityYoY = getYoYChange(stmt =>
    stmt.balanceSheet?.liabilities?.totalLiabilities + stmt.balanceSheet?.equity?.totalEquity
  );

  // Calculate loan categories
  const calculateLoanCategories = () => {
    if (!portfolio) return null;

    const residential = (portfolio.realEstate.securedBy1To4Family.revolvingOpenEnd || 0) +
      (portfolio.realEstate.securedBy1To4Family.closedEndFirstLiens || 0) +
      (portfolio.realEstate.securedBy1To4Family.closedEndJuniorLiens || 0);
    const creditCards = portfolio.consumer.creditCards || 0;
    const auto = portfolio.consumer.automobileLoans || 0;
    const otherConsumer = (portfolio.consumer.otherRevolvingCredit || 0) + (portfolio.consumer.otherConsumerLoans || 0);
    const consumerTotal = residential + creditCards + auto + otherConsumer;

    const commercialRE = (portfolio.realEstate.constructionAndLandDevelopment.total || 0) +
      (portfolio.realEstate.multifamily || 0) +
      (portfolio.realEstate.nonfarmNonresidential.ownerOccupied || 0) +
      (portfolio.realEstate.nonfarmNonresidential.otherNonfarmNonresidential || 0);
    const cniUS = portfolio.commercialAndIndustrial.usAddressees || 0;
    const cniNonUS = portfolio.commercialAndIndustrial.nonUsAddressees || 0;
    const agricultural = portfolio.other.agriculturalProduction || 0;
    const toDepository = portfolio.other.toDepositoryInstitutions || 0;

    const foreignGovernments = portfolio.other.loansToForeignGovernments || 0;
    const municipalLoans = portfolio.other.municipalLoans || 0;
    const otherDepositoryUS = portfolio.other.loansToOtherDepositoryUS || 0;
    const banksForeign = portfolio.other.loansToBanksForeign || 0;
    const allOtherLoansRemainder = portfolio.other.allOtherLoans || 0;
    const otherSpecializedLoans = foreignGovernments + municipalLoans + otherDepositoryUS + banksForeign + allOtherLoansRemainder;

    const businessTotal = commercialRE + cniUS + cniNonUS + agricultural + toDepository + otherSpecializedLoans;

    const consumerLeases = portfolio.leaseFinancingReceivables?.consumerLeases || 0;
    const otherLeases = portfolio.leaseFinancingReceivables?.allOtherLeases || 0;
    const leasesTotal = consumerLeases + otherLeases;

    return {
      consumerTotal, residential, creditCards, auto, otherConsumer,
      businessTotal, commercialRE, cniUS, cniNonUS, agricultural, toDepository,
      otherSpecializedLoans, foreignGovernments, municipalLoans, otherDepositoryUS,
      banksForeign, allOtherLoansRemainder, leasesTotal, consumerLeases, otherLeases,
      grossTotal: consumerTotal + businessTotal + leasesTotal
    };
  };

  // Historical data for loan subcategories
  const residentialHistory = getHistoricalTrend(stmt => {
    const p = stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio;
    if (!p) return null;
    return (p.realEstate.securedBy1To4Family.revolvingOpenEnd || 0) +
           (p.realEstate.securedBy1To4Family.closedEndFirstLiens || 0) +
           (p.realEstate.securedBy1To4Family.closedEndJuniorLiens || 0);
  });
  const residentialYoY = getYoYChange(stmt => {
    const p = stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio;
    if (!p) return null;
    return (p.realEstate.securedBy1To4Family.revolvingOpenEnd || 0) +
           (p.realEstate.securedBy1To4Family.closedEndFirstLiens || 0) +
           (p.realEstate.securedBy1To4Family.closedEndJuniorLiens || 0);
  });

  const creditCardsHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio?.consumer?.creditCards);
  const creditCardsYoY = getYoYChange(stmt => stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio?.consumer?.creditCards);

  const autoHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio?.consumer?.automobileLoans);
  const autoYoY = getYoYChange(stmt => stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio?.consumer?.automobileLoans);

  const otherConsumerHistory = getHistoricalTrend(stmt => {
    const p = stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio;
    if (!p) return null;
    return (p.consumer.otherRevolvingCredit || 0) + (p.consumer.otherConsumerLoans || 0);
  });
  const otherConsumerYoY = getYoYChange(stmt => {
    const p = stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio;
    if (!p) return null;
    return (p.consumer.otherRevolvingCredit || 0) + (p.consumer.otherConsumerLoans || 0);
  });

  const consumerTotalHistory = getHistoricalTrend(stmt => {
    const p = stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio;
    if (!p) return null;
    const residential = (p.realEstate.securedBy1To4Family.revolvingOpenEnd || 0) +
      (p.realEstate.securedBy1To4Family.closedEndFirstLiens || 0) +
      (p.realEstate.securedBy1To4Family.closedEndJuniorLiens || 0);
    const creditCards = p.consumer.creditCards || 0;
    const auto = p.consumer.automobileLoans || 0;
    const otherConsumer = (p.consumer.otherRevolvingCredit || 0) + (p.consumer.otherConsumerLoans || 0);
    return residential + creditCards + auto + otherConsumer;
  });
  const consumerTotalYoY = getYoYChange(stmt => {
    const p = stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio;
    if (!p) return null;
    const residential = (p.realEstate.securedBy1To4Family.revolvingOpenEnd || 0) +
      (p.realEstate.securedBy1To4Family.closedEndFirstLiens || 0) +
      (p.realEstate.securedBy1To4Family.closedEndJuniorLiens || 0);
    const creditCards = p.consumer.creditCards || 0;
    const auto = p.consumer.automobileLoans || 0;
    const otherConsumer = (p.consumer.otherRevolvingCredit || 0) + (p.consumer.otherConsumerLoans || 0);
    return residential + creditCards + auto + otherConsumer;
  });

  const commercialREHistory = getHistoricalTrend(stmt => {
    const p = stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio;
    if (!p) return null;
    return (p.realEstate.constructionAndLandDevelopment.total || 0) +
           (p.realEstate.multifamily || 0) +
           (p.realEstate.nonfarmNonresidential.ownerOccupied || 0) +
           (p.realEstate.nonfarmNonresidential.otherNonfarmNonresidential || 0);
  });
  const commercialREYoY = getYoYChange(stmt => {
    const p = stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio;
    if (!p) return null;
    return (p.realEstate.constructionAndLandDevelopment.total || 0) +
           (p.realEstate.multifamily || 0) +
           (p.realEstate.nonfarmNonresidential.ownerOccupied || 0) +
           (p.realEstate.nonfarmNonresidential.otherNonfarmNonresidential || 0);
  });

  const cniUSHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio?.commercialAndIndustrial?.usAddressees);
  const cniUSYoY = getYoYChange(stmt => stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio?.commercialAndIndustrial?.usAddressees);

  const cniNonUSHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio?.commercialAndIndustrial?.nonUsAddressees);
  const cniNonUSYoY = getYoYChange(stmt => stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio?.commercialAndIndustrial?.nonUsAddressees);

  const agriculturalHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio?.other?.agriculturalProduction);
  const agriculturalYoY = getYoYChange(stmt => stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio?.other?.agriculturalProduction);

  const toDepositoryHistory = getHistoricalTrend(stmt => stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio?.other?.toDepositoryInstitutions);
  const toDepositoryYoY = getYoYChange(stmt => stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio?.other?.toDepositoryInstitutions);

  const otherSpecializedHistory = getHistoricalTrend(stmt => {
    const p = stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio;
    if (!p) return null;
    return (p.other.loansToForeignGovernments || 0) + (p.other.municipalLoans || 0) +
           (p.other.loansToOtherDepositoryUS || 0) + (p.other.loansToBanksForeign || 0) +
           (p.other.allOtherLoans || 0);
  });
  const otherSpecializedYoY = getYoYChange(stmt => {
    const p = stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio;
    if (!p) return null;
    return (p.other.loansToForeignGovernments || 0) + (p.other.municipalLoans || 0) +
           (p.other.loansToOtherDepositoryUS || 0) + (p.other.loansToBanksForeign || 0) +
           (p.other.allOtherLoans || 0);
  });

  const businessTotalHistory = getHistoricalTrend(stmt => {
    const p = stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio;
    if (!p) return null;
    const commercialRE = (p.realEstate.constructionAndLandDevelopment.total || 0) +
      (p.realEstate.multifamily || 0) +
      (p.realEstate.nonfarmNonresidential.ownerOccupied || 0) +
      (p.realEstate.nonfarmNonresidential.otherNonfarmNonresidential || 0);
    const cniUS = p.commercialAndIndustrial.usAddressees || 0;
    const cniNonUS = p.commercialAndIndustrial.nonUsAddressees || 0;
    const agricultural = p.other.agriculturalProduction || 0;
    const toDepository = p.other.toDepositoryInstitutions || 0;
    const otherSpecialized = (p.other.loansToForeignGovernments || 0) + (p.other.municipalLoans || 0) +
                            (p.other.loansToOtherDepositoryUS || 0) + (p.other.loansToBanksForeign || 0) +
                            (p.other.allOtherLoans || 0);
    return commercialRE + cniUS + cniNonUS + agricultural + toDepository + otherSpecialized;
  });
  const businessTotalYoY = getYoYChange(stmt => {
    const p = stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio;
    if (!p) return null;
    const commercialRE = (p.realEstate.constructionAndLandDevelopment.total || 0) +
      (p.realEstate.multifamily || 0) +
      (p.realEstate.nonfarmNonresidential.ownerOccupied || 0) +
      (p.realEstate.nonfarmNonresidential.otherNonfarmNonresidential || 0);
    const cniUS = p.commercialAndIndustrial.usAddressees || 0;
    const cniNonUS = p.commercialAndIndustrial.nonUsAddressees || 0;
    const agricultural = p.other.agriculturalProduction || 0;
    const toDepository = p.other.toDepositoryInstitutions || 0;
    const otherSpecialized = (p.other.loansToForeignGovernments || 0) + (p.other.municipalLoans || 0) +
                            (p.other.loansToOtherDepositoryUS || 0) + (p.other.loansToBanksForeign || 0) +
                            (p.other.allOtherLoans || 0);
    return commercialRE + cniUS + cniNonUS + agricultural + toDepository + otherSpecialized;
  });

  const leasesTotalHistory = getHistoricalTrend(stmt => {
    const p = stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio;
    if (!p) return null;
    return (p.leaseFinancingReceivables?.consumerLeases || 0) + (p.leaseFinancingReceivables?.allOtherLeases || 0);
  });
  const leasesTotalYoY = getYoYChange(stmt => {
    const p = stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio;
    if (!p) return null;
    return (p.leaseFinancingReceivables?.consumerLeases || 0) + (p.leaseFinancingReceivables?.allOtherLeases || 0);
  });

  const loanCategories = calculateLoanCategories();

  // Tufte-style cell configurations
  const headerStyle = {
    fontWeight: 700,
    fontSize: '0.95rem',
    borderBottom: '2px solid #000',
    pt: 3,
    pb: 1
  };

  const subheaderStyle = {
    fontWeight: 600,
    fontSize: '0.85rem',
    backgroundColor: '#fafafa',
    pt: 1.5,
    pb: 0.75
  };

  const normalCellStyle = {
    borderBottom: '1px solid #e0e0e0',
    py: 0.75,
    fontSize: '0.9rem'
  };

  const indentedCellStyle = {
    ...normalCellStyle,
    pl: 3
  };

  const subItemStyle = {
    ...normalCellStyle,
    pl: 5,
    fontSize: '0.8rem',
    color: 'text.secondary'
  };

  const totalStyle = {
    fontWeight: 600,
    borderTop: '1px solid #000',
    pt: 1,
    pb: 1,
    fontSize: '0.95rem'
  };

  const grandTotalStyle = {
    fontWeight: 700,
    fontSize: '1rem',
    borderTop: '2px solid #000',
    borderBottom: '2px solid #000',
    pt: 1.5,
    pb: 1.5
  };

  // YoY cell style with color
  const getYoYStyle = (value) => {
    if (value === null || value === undefined || isNaN(value)) return { color: 'text.secondary' };
    if (value > 0) return { color: '#2e7d32', fontWeight: 600 };
    if (value < 0) return { color: '#d32f2f', fontWeight: 600 };
    return { color: 'text.secondary' };
  };

  return (
    <Box sx={{ maxWidth: 1200 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
        Balance Sheet
      </Typography>

      <TableContainer>
        <Table size="small" sx={{
          '& .MuiTableCell-root': {
            border: 'none'
          }
        }}>
          <TableBody>
            {/* ==================== ASSETS ==================== */}
            <TableRow>
              <TableCell sx={headerStyle}>ASSETS</TableCell>
              <TableCell align="right" sx={headerStyle}>Amount</TableCell>
              <TableCell align="right" sx={headerStyle}>YoY%</TableCell>
              <TableCell align="center" sx={headerStyle}>Trend</TableCell>
            </TableRow>

            {/* Earning Assets */}
            <TableRow>
              <TableCell sx={subheaderStyle}>Earning Assets</TableCell>
              <TableCell sx={subheaderStyle}></TableCell>
              <TableCell sx={subheaderStyle}></TableCell>
              <TableCell sx={subheaderStyle}></TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={indentedCellStyle}>Loans & Leases (Gross)</TableCell>
              <TableCell align="right" sx={indentedCellStyle}>
                {formatCurrency(
                  assets.earningAssets.loansAndLeases.net +
                  (assets.earningAssets.loansAndLeases.netOfAllowance || 0)
                )}
              </TableCell>
              <TableCell align="right" sx={{ ...indentedCellStyle, ...getYoYStyle(totalLoansGrossYoY) }}>
                {formatPercent(totalLoansGrossYoY)}
              </TableCell>
              <TableCell align="center" sx={indentedCellStyle}>
                <Sparkline data={totalLoansGrossHistory} />
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={{ ...subItemStyle, fontStyle: 'italic' }}>
                Less: Allowance for Loan Losses
              </TableCell>
              <TableCell align="right" sx={{ ...subItemStyle, fontStyle: 'italic' }}>
                ({formatCurrency(assets.earningAssets.loansAndLeases.netOfAllowance || 0)})
              </TableCell>
              <TableCell align="right" sx={{ ...subItemStyle, fontStyle: 'italic', ...getYoYStyle(allowanceYoY) }}>
                {formatPercent(allowanceYoY)}
              </TableCell>
              <TableCell align="center" sx={{ ...subItemStyle, fontStyle: 'italic' }}>
                <Sparkline data={allowanceHistory} color="#999" />
              </TableCell>
            </TableRow>

            <TableRow
              sx={{
                cursor: portfolio ? 'pointer' : 'default',
                '&:hover': portfolio ? { backgroundColor: '#fafafa' } : {}
              }}
              onClick={() => portfolio && setLoansExpanded(!loansExpanded)}
            >
              <TableCell sx={{ ...indentedCellStyle, display: 'flex', alignItems: 'center' }}>
                {portfolio && (
                  <IconButton size="small" sx={{ mr: 0.5, p: 0 }}>
                    {loansExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                  </IconButton>
                )}
                <span>Loans & Leases (Net)</span>
              </TableCell>
              <TableCell align="right" sx={indentedCellStyle}>
                {formatCurrency(assets.earningAssets.loansAndLeases.net)}
              </TableCell>
              <TableCell align="right" sx={{ ...indentedCellStyle, ...getYoYStyle(totalLoansYoY) }}>
                {formatPercent(totalLoansYoY)}
              </TableCell>
              <TableCell align="center" sx={indentedCellStyle}>
                <Sparkline data={totalLoansHistory} />
              </TableCell>
            </TableRow>

            {/* Expandable Loan Portfolio Detail */}
            {portfolio && (
              <TableRow>
                <TableCell colSpan={4} sx={{ p: 0, border: 'none' }}>
                  <Collapse in={loansExpanded} timeout="auto" unmountOnExit>
                    <Box sx={{ pl: 6, pr: 2, py: 2, backgroundColor: '#fafafa' }}>
                      <Table size="small" sx={{ '& .MuiTableCell-root': { border: 'none' } }}>
                        <TableBody>
                          {/* Consumer Lending */}
                          {loanCategories.consumerTotal > 0 && (
                            <>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem', pb: 0.5 }}>
                                  Consumer Lending
                                </TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                              {loanCategories.residential > 0 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 2, fontSize: '0.8rem', py: 0.5 }}>
                                    Residential Mortgages (1-4 Family)
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                    {formatCurrency(loanCategories.residential)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.8rem', py: 0.5, ...getYoYStyle(residentialYoY) }}>
                                    {formatPercent(residentialYoY)}
                                  </TableCell>
                                  <TableCell align="center" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                    <Sparkline data={residentialHistory} width={50} height={20} />
                                  </TableCell>
                                </TableRow>
                              )}
                              {loanCategories.creditCards > 0 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 2, fontSize: '0.8rem', py: 0.5 }}>Credit Cards</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                    {formatCurrency(loanCategories.creditCards)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.8rem', py: 0.5, ...getYoYStyle(creditCardsYoY) }}>
                                    {formatPercent(creditCardsYoY)}
                                  </TableCell>
                                  <TableCell align="center" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                    <Sparkline data={creditCardsHistory} width={50} height={20} />
                                  </TableCell>
                                </TableRow>
                              )}
                              {loanCategories.auto > 0 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 2, fontSize: '0.8rem', py: 0.5 }}>Auto Loans</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                    {formatCurrency(loanCategories.auto)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.8rem', py: 0.5, ...getYoYStyle(autoYoY) }}>
                                    {formatPercent(autoYoY)}
                                  </TableCell>
                                  <TableCell align="center" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                    <Sparkline data={autoHistory} width={50} height={20} />
                                  </TableCell>
                                </TableRow>
                              )}
                              {loanCategories.otherConsumer > 0 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 2, fontSize: '0.8rem', py: 0.5 }}>Other Consumer</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                    {formatCurrency(loanCategories.otherConsumer)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.8rem', py: 0.5, ...getYoYStyle(otherConsumerYoY) }}>
                                    {formatPercent(otherConsumerYoY)}
                                  </TableCell>
                                  <TableCell align="center" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                    <Sparkline data={otherConsumerHistory} width={50} height={20} />
                                  </TableCell>
                                </TableRow>
                              )}
                              <TableRow>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem', pt: 0.5, pb: 1 }}>
                                  Total Consumer
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.85rem', pt: 0.5, pb: 1 }}>
                                  {formatCurrency(loanCategories.consumerTotal)}
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.85rem', pt: 0.5, pb: 1, ...getYoYStyle(consumerTotalYoY) }}>
                                  {formatPercent(consumerTotalYoY)}
                                </TableCell>
                                <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.85rem', pt: 0.5, pb: 1 }}>
                                  <Sparkline data={consumerTotalHistory} width={50} height={20} />
                                </TableCell>
                              </TableRow>
                            </>
                          )}

                          {/* Business Lending */}
                          {loanCategories.businessTotal > 0 && (
                            <>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem', pb: 0.5, pt: 1 }}>
                                  Business Lending
                                </TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                              {loanCategories.commercialRE > 0 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 2, fontSize: '0.8rem', py: 0.5 }}>
                                    Commercial Real Estate
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                    {formatCurrency(loanCategories.commercialRE)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.8rem', py: 0.5, ...getYoYStyle(commercialREYoY) }}>
                                    {formatPercent(commercialREYoY)}
                                  </TableCell>
                                  <TableCell align="center" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                    <Sparkline data={commercialREHistory} width={50} height={20} />
                                  </TableCell>
                                </TableRow>
                              )}
                              {loanCategories.cniUS > 0 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 2, fontSize: '0.8rem', py: 0.5 }}>C&I (US)</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                    {formatCurrency(loanCategories.cniUS)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.8rem', py: 0.5, ...getYoYStyle(cniUSYoY) }}>
                                    {formatPercent(cniUSYoY)}
                                  </TableCell>
                                  <TableCell align="center" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                    <Sparkline data={cniUSHistory} width={50} height={20} />
                                  </TableCell>
                                </TableRow>
                              )}
                              {loanCategories.cniNonUS > 0 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 2, fontSize: '0.8rem', py: 0.5 }}>C&I (Non-US)</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                    {formatCurrency(loanCategories.cniNonUS)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.8rem', py: 0.5, ...getYoYStyle(cniNonUSYoY) }}>
                                    {formatPercent(cniNonUSYoY)}
                                  </TableCell>
                                  <TableCell align="center" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                    <Sparkline data={cniNonUSHistory} width={50} height={20} />
                                  </TableCell>
                                </TableRow>
                              )}
                              {loanCategories.agricultural > 0 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 2, fontSize: '0.8rem', py: 0.5 }}>Agricultural</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                    {formatCurrency(loanCategories.agricultural)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.8rem', py: 0.5, ...getYoYStyle(agriculturalYoY) }}>
                                    {formatPercent(agriculturalYoY)}
                                  </TableCell>
                                  <TableCell align="center" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                    <Sparkline data={agriculturalHistory} width={50} height={20} />
                                  </TableCell>
                                </TableRow>
                              )}
                              {loanCategories.toDepository > 0 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 2, fontSize: '0.8rem', py: 0.5 }}>
                                    To Depository Institutions
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                    {formatCurrency(loanCategories.toDepository)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.8rem', py: 0.5, ...getYoYStyle(toDepositoryYoY) }}>
                                    {formatPercent(toDepositoryYoY)}
                                  </TableCell>
                                  <TableCell align="center" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                    <Sparkline data={toDepositoryHistory} width={50} height={20} />
                                  </TableCell>
                                </TableRow>
                              )}
                              {loanCategories.otherSpecializedLoans > 1000 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 2, fontSize: '0.8rem', py: 0.5, fontStyle: 'italic' }}>
                                    Other Specialized
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                    {formatCurrency(loanCategories.otherSpecializedLoans)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.8rem', py: 0.5, ...getYoYStyle(otherSpecializedYoY) }}>
                                    {formatPercent(otherSpecializedYoY)}
                                  </TableCell>
                                  <TableCell align="center" sx={{ fontSize: '0.8rem', py: 0.5 }}>
                                    <Sparkline data={otherSpecializedHistory} width={50} height={20} />
                                  </TableCell>
                                </TableRow>
                              )}
                              <TableRow>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem', pt: 0.5, pb: 1 }}>
                                  Total Business
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.85rem', pt: 0.5, pb: 1 }}>
                                  {formatCurrency(loanCategories.businessTotal)}
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.85rem', pt: 0.5, pb: 1, ...getYoYStyle(businessTotalYoY) }}>
                                  {formatPercent(businessTotalYoY)}
                                </TableCell>
                                <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.85rem', pt: 0.5, pb: 1 }}>
                                  <Sparkline data={businessTotalHistory} width={50} height={20} />
                                </TableCell>
                              </TableRow>
                            </>
                          )}

                          {/* Lease Financing */}
                          {loanCategories.leasesTotal > 0 && (
                            <>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem', pb: 0.5, pt: 1 }}>
                                  Lease Financing
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.85rem', pb: 0.5, pt: 1 }}>
                                  {formatCurrency(loanCategories.leasesTotal)}
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.85rem', pb: 0.5, pt: 1, ...getYoYStyle(leasesTotalYoY) }}>
                                  {formatPercent(leasesTotalYoY)}
                                </TableCell>
                                <TableCell align="center" sx={{ fontWeight: 600, fontSize: '0.85rem', pb: 0.5, pt: 1 }}>
                                  <Sparkline data={leasesTotalHistory} width={50} height={20} />
                                </TableCell>
                              </TableRow>
                            </>
                          )}
                        </TableBody>
                      </Table>
                    </Box>
                  </Collapse>
                </TableCell>
              </TableRow>
            )}

            <TableRow>
              <TableCell sx={indentedCellStyle}>Securities (Available for Sale)</TableCell>
              <TableCell align="right" sx={indentedCellStyle}>
                {formatCurrency(assets.earningAssets.securities.availableForSale)}
              </TableCell>
              <TableCell align="right" sx={{ ...indentedCellStyle, ...getYoYStyle(securitiesAFSYoY) }}>
                {formatPercent(securitiesAFSYoY)}
              </TableCell>
              <TableCell align="center" sx={indentedCellStyle}>
                <Sparkline data={securitiesAFSHistory} />
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={indentedCellStyle}>Securities (Held to Maturity)</TableCell>
              <TableCell align="right" sx={indentedCellStyle}>
                {formatCurrency(assets.earningAssets.securities.heldToMaturity)}
              </TableCell>
              <TableCell align="right" sx={{ ...indentedCellStyle, ...getYoYStyle(securitiesHTMYoY) }}>
                {formatPercent(securitiesHTMYoY)}
              </TableCell>
              <TableCell align="center" sx={indentedCellStyle}>
                <Sparkline data={securitiesHTMHistory} />
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={indentedCellStyle}>Interest-Bearing Bank Balances</TableCell>
              <TableCell align="right" sx={indentedCellStyle}>
                {formatCurrency(assets.earningAssets.interestBearingBankBalances)}
              </TableCell>
              <TableCell align="right" sx={{ ...indentedCellStyle, ...getYoYStyle(interestBearingBalancesYoY) }}>
                {formatPercent(interestBearingBalancesYoY)}
              </TableCell>
              <TableCell align="center" sx={indentedCellStyle}>
                <Sparkline data={interestBearingBalancesHistory} />
              </TableCell>
            </TableRow>

            {/* Nonearning Assets */}
            <TableRow>
              <TableCell sx={subheaderStyle}>Nonearning Assets</TableCell>
              <TableCell sx={subheaderStyle}></TableCell>
              <TableCell sx={subheaderStyle}></TableCell>
              <TableCell sx={subheaderStyle}></TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={indentedCellStyle}>Cash & Due from Banks</TableCell>
              <TableCell align="right" sx={indentedCellStyle}>
                {formatCurrency(assets.nonearningAssets.cashAndDueFromBanks)}
              </TableCell>
              <TableCell align="right" sx={{ ...indentedCellStyle, ...getYoYStyle(cashYoY) }}>
                {formatPercent(cashYoY)}
              </TableCell>
              <TableCell align="center" sx={indentedCellStyle}>
                <Sparkline data={cashHistory} />
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={indentedCellStyle}>Premises & Fixed Assets</TableCell>
              <TableCell align="right" sx={indentedCellStyle}>
                {formatCurrency(assets.nonearningAssets.premisesAndFixedAssets)}
              </TableCell>
              <TableCell align="right" sx={{ ...indentedCellStyle, ...getYoYStyle(premisesYoY) }}>
                {formatPercent(premisesYoY)}
              </TableCell>
              <TableCell align="center" sx={indentedCellStyle}>
                <Sparkline data={premisesHistory} />
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={indentedCellStyle}>Intangible Assets</TableCell>
              <TableCell align="right" sx={indentedCellStyle}>
                {formatCurrency(assets.nonearningAssets.intangibleAssets)}
              </TableCell>
              <TableCell align="right" sx={{ ...indentedCellStyle, ...getYoYStyle(intangiblesYoY) }}>
                {formatPercent(intangiblesYoY)}
              </TableCell>
              <TableCell align="center" sx={indentedCellStyle}>
                <Sparkline data={intangiblesHistory} />
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={indentedCellStyle}>Other Assets</TableCell>
              <TableCell align="right" sx={indentedCellStyle}>
                {formatCurrency(assets.nonearningAssets.otherAssets)}
              </TableCell>
              <TableCell align="right" sx={{ ...indentedCellStyle, ...getYoYStyle(otherAssetsYoY) }}>
                {formatPercent(otherAssetsYoY)}
              </TableCell>
              <TableCell align="center" sx={indentedCellStyle}>
                <Sparkline data={otherAssetsHistory} />
              </TableCell>
            </TableRow>

            {/* Total Assets */}
            <TableRow>
              <TableCell sx={grandTotalStyle}>Total Assets</TableCell>
              <TableCell align="right" sx={grandTotalStyle}>
                {formatCurrency(assets.totalAssets)}
              </TableCell>
              <TableCell align="right" sx={{ ...grandTotalStyle, ...getYoYStyle(totalAssetsYoY) }}>
                {formatPercent(totalAssetsYoY)}
              </TableCell>
              <TableCell align="center" sx={grandTotalStyle}>
                <Sparkline data={totalAssetsHistory} />
              </TableCell>
            </TableRow>

            {/* Spacer */}
            <TableRow>
              <TableCell colSpan={4} sx={{ py: 2 }}></TableCell>
            </TableRow>

            {/* ==================== LIABILITIES & EQUITY ==================== */}
            <TableRow>
              <TableCell sx={headerStyle}>LIABILITIES & EQUITY</TableCell>
              <TableCell align="right" sx={headerStyle}>Amount</TableCell>
              <TableCell align="right" sx={headerStyle}>YoY%</TableCell>
              <TableCell align="center" sx={headerStyle}>Trend</TableCell>
            </TableRow>

            {/* Liabilities */}
            <TableRow>
              <TableCell sx={subheaderStyle}>Liabilities</TableCell>
              <TableCell sx={subheaderStyle}></TableCell>
              <TableCell sx={subheaderStyle}></TableCell>
              <TableCell sx={subheaderStyle}></TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={indentedCellStyle}>Total Deposits</TableCell>
              <TableCell align="right" sx={indentedCellStyle}>
                {formatCurrency(liabilities.deposits.total)}
              </TableCell>
              <TableCell align="right" sx={{ ...indentedCellStyle, ...getYoYStyle(totalDepositsYoY) }}>
                {formatPercent(totalDepositsYoY)}
              </TableCell>
              <TableCell align="center" sx={indentedCellStyle}>
                <Sparkline data={totalDepositsHistory} />
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={subItemStyle}>Non-Interest Bearing</TableCell>
              <TableCell align="right" sx={subItemStyle}>
                {formatCurrency(liabilities.deposits.nonInterestBearing)}
              </TableCell>
              <TableCell align="right" sx={{ ...subItemStyle, ...getYoYStyle(nonInterestBearingDepositsYoY) }}>
                {formatPercent(nonInterestBearingDepositsYoY)}
              </TableCell>
              <TableCell align="center" sx={subItemStyle}>
                <Sparkline data={nonInterestBearingDepositsHistory} width={50} height={20} color="#999" />
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={subItemStyle}>Interest Bearing</TableCell>
              <TableCell align="right" sx={subItemStyle}>
                {formatCurrency(liabilities.deposits.interestBearing)}
              </TableCell>
              <TableCell align="right" sx={{ ...subItemStyle, ...getYoYStyle(interestBearingDepositsYoY) }}>
                {formatPercent(interestBearingDepositsYoY)}
              </TableCell>
              <TableCell align="center" sx={subItemStyle}>
                <Sparkline data={interestBearingDepositsHistory} width={50} height={20} color="#999" />
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={indentedCellStyle}>Other Borrowed Money</TableCell>
              <TableCell align="right" sx={indentedCellStyle}>
                {formatCurrency(liabilities.borrowings.otherBorrowedMoney)}
              </TableCell>
              <TableCell align="right" sx={{ ...indentedCellStyle, ...getYoYStyle(otherBorrowedMoneyYoY) }}>
                {formatPercent(otherBorrowedMoneyYoY)}
              </TableCell>
              <TableCell align="center" sx={indentedCellStyle}>
                <Sparkline data={otherBorrowedMoneyHistory} />
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={indentedCellStyle}>Subordinated Debt</TableCell>
              <TableCell align="right" sx={indentedCellStyle}>
                {formatCurrency(liabilities.borrowings.subordinatedDebt)}
              </TableCell>
              <TableCell align="right" sx={{ ...indentedCellStyle, ...getYoYStyle(subordinatedDebtYoY) }}>
                {formatPercent(subordinatedDebtYoY)}
              </TableCell>
              <TableCell align="center" sx={indentedCellStyle}>
                <Sparkline data={subordinatedDebtHistory} />
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={indentedCellStyle}>Other Liabilities</TableCell>
              <TableCell align="right" sx={indentedCellStyle}>
                {formatCurrency(liabilities.otherLiabilities)}
              </TableCell>
              <TableCell align="right" sx={{ ...indentedCellStyle, ...getYoYStyle(otherLiabilitiesYoY) }}>
                {formatPercent(otherLiabilitiesYoY)}
              </TableCell>
              <TableCell align="center" sx={indentedCellStyle}>
                <Sparkline data={otherLiabilitiesHistory} />
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={totalStyle}>Total Liabilities</TableCell>
              <TableCell align="right" sx={totalStyle}>
                {formatCurrency(liabilities.totalLiabilities)}
              </TableCell>
              <TableCell align="right" sx={{ ...totalStyle, ...getYoYStyle(totalLiabilitiesYoY) }}>
                {formatPercent(totalLiabilitiesYoY)}
              </TableCell>
              <TableCell align="center" sx={totalStyle}>
                <Sparkline data={totalLiabilitiesHistory} />
              </TableCell>
            </TableRow>

            {/* Equity */}
            <TableRow>
              <TableCell sx={{ ...subheaderStyle, pt: 2 }}>Equity</TableCell>
              <TableCell sx={{ ...subheaderStyle, pt: 2 }}></TableCell>
              <TableCell sx={{ ...subheaderStyle, pt: 2 }}></TableCell>
              <TableCell sx={{ ...subheaderStyle, pt: 2 }}></TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={indentedCellStyle}>Common Stock</TableCell>
              <TableCell align="right" sx={indentedCellStyle}>
                {formatCurrency(equity.commonStock)}
              </TableCell>
              <TableCell align="right" sx={{ ...indentedCellStyle, ...getYoYStyle(commonStockYoY) }}>
                {formatPercent(commonStockYoY)}
              </TableCell>
              <TableCell align="center" sx={indentedCellStyle}>
                <Sparkline data={commonStockHistory} />
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={indentedCellStyle}>Surplus</TableCell>
              <TableCell align="right" sx={indentedCellStyle}>
                {formatCurrency(equity.surplus)}
              </TableCell>
              <TableCell align="right" sx={{ ...indentedCellStyle, ...getYoYStyle(surplusYoY) }}>
                {formatPercent(surplusYoY)}
              </TableCell>
              <TableCell align="center" sx={indentedCellStyle}>
                <Sparkline data={surplusHistory} />
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={indentedCellStyle}>Retained Earnings</TableCell>
              <TableCell align="right" sx={indentedCellStyle}>
                {formatCurrency(equity.retainedEarnings)}
              </TableCell>
              <TableCell align="right" sx={{ ...indentedCellStyle, ...getYoYStyle(retainedEarningsYoY) }}>
                {formatPercent(retainedEarningsYoY)}
              </TableCell>
              <TableCell align="center" sx={indentedCellStyle}>
                <Sparkline data={retainedEarningsHistory} />
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={indentedCellStyle}>Accumulated Other Comprehensive Income</TableCell>
              <TableCell align="right" sx={indentedCellStyle}>
                {formatCurrency(equity.accumulatedOCI)}
              </TableCell>
              <TableCell align="right" sx={{ ...indentedCellStyle, ...getYoYStyle(accumulatedOCIYoY) }}>
                {formatPercent(accumulatedOCIYoY)}
              </TableCell>
              <TableCell align="center" sx={indentedCellStyle}>
                <Sparkline data={accumulatedOCIHistory} />
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={totalStyle}>Total Equity</TableCell>
              <TableCell align="right" sx={totalStyle}>
                {formatCurrency(equity.totalEquity)}
              </TableCell>
              <TableCell align="right" sx={{ ...totalStyle, ...getYoYStyle(totalEquityYoY) }}>
                {formatPercent(totalEquityYoY)}
              </TableCell>
              <TableCell align="center" sx={totalStyle}>
                <Sparkline data={totalEquityHistory} />
              </TableCell>
            </TableRow>

            {/* Total Liabilities & Equity */}
            <TableRow>
              <TableCell sx={grandTotalStyle}>Total Liabilities & Equity</TableCell>
              <TableCell align="right" sx={grandTotalStyle}>
                {formatCurrency(liabilities.totalLiabilities + equity.totalEquity)}
              </TableCell>
              <TableCell align="right" sx={{ ...grandTotalStyle, ...getYoYStyle(totalLiabilitiesEquityYoY) }}>
                {formatPercent(totalLiabilitiesEquityYoY)}
              </TableCell>
              <TableCell align="center" sx={grandTotalStyle}>
                <Sparkline data={totalLiabilitiesEquityHistory} />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default BalanceSheet;
