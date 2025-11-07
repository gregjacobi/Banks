import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableHead,
  Divider,
  Grid,
  Collapse,
  IconButton
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

/**
 * Inline Sparkline Component with Tooltip - Tufte-inspired word-sized graphic
 */
const Sparkline = ({ data, width = 100, height = 24, color = '#1976d2', showDot = true, periods = [] }) => {
  const [tooltip, setTooltip] = React.useState({ show: false, x: 0, y: 0, value: 0, period: '' });
  const containerRef = React.useRef(null);
  const [dimensions, setDimensions] = React.useState({ width: typeof width === 'number' ? width : 100, height: typeof height === 'number' ? height : 24 });

  React.useEffect(() => {
    if (width === '100%' || height === '100%') {
      const updateDimensions = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setDimensions({
            width: Math.max(rect.width || 100, 100),
            height: Math.max(rect.height || 24, 24)
          });
        }
      };
      
      // Initial update after render
      const timeoutId = setTimeout(updateDimensions, 0);
      
      // Use ResizeObserver for better performance
      let resizeObserver = null;
      let usingWindowResize = false;
      
      const setupObserver = () => {
        if (containerRef.current && window.ResizeObserver) {
          resizeObserver = new ResizeObserver(updateDimensions);
          resizeObserver.observe(containerRef.current);
        } else {
          // Fallback to window resize
          usingWindowResize = true;
          window.addEventListener('resize', updateDimensions);
        }
      };
      
      // Setup observer after a brief delay to ensure ref is attached
      const observerTimeoutId = setTimeout(setupObserver, 10);
      
      return () => {
        clearTimeout(timeoutId);
        clearTimeout(observerTimeoutId);
        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        if (usingWindowResize) {
          window.removeEventListener('resize', updateDimensions);
        }
      };
    }
  }, [width, height]);

  if (!data || data.length === 0) return null;

  // Filter out null values and create mapping from filtered index to original index
  const filteredIndices = [];
  const values = [];
  data.forEach((v, originalIndex) => {
    if (v !== null && v !== undefined && !isNaN(v)) {
      filteredIndices.push(originalIndex);
      values.push(v);
    }
  });

  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const actualWidth = dimensions.width;
  const actualHeight = dimensions.height;

  const points = values.map((value, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * actualWidth;
    const y = actualHeight - ((value - min) / range) * actualHeight;
    return `${x},${y}`;
  }).join(' ');

  const lastValue = values[values.length - 1];
  const lastX = actualWidth;
  const lastY = actualHeight - ((lastValue - min) / range) * actualHeight;

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
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
    const filteredIndex = Math.round((x / actualWidth) * (values.length - 1));

    if (filteredIndex >= 0 && filteredIndex < values.length) {
      const originalIndex = filteredIndices[filteredIndex];
      const pointX = (filteredIndex / Math.max(values.length - 1, 1)) * actualWidth;
      const pointY = actualHeight - ((values[filteredIndex] - min) / range) * actualHeight;

      setTooltip({
        show: true,
        x: pointX,
        y: pointY,
        value: values[filteredIndex],
        period: periods[originalIndex] ? formatPeriod(periods[originalIndex]) : `Period ${originalIndex + 1}`
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltip({ show: false, x: 0, y: 0, value: 0, period: '' });
  };

  return (
    <Box 
      ref={containerRef}
      sx={{ 
        position: 'relative', 
        display: 'block',
        width: width === '100%' ? '100%' : width,
        height: height === '100%' ? '100%' : height,
        minHeight: typeof height === 'number' ? height : 60
      }}
    >
      <svg
        width={actualWidth}
        height={actualHeight}
        style={{ verticalAlign: 'middle', display: 'block', cursor: 'crosshair', width: '100%', height: '100%' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        viewBox={`0 0 ${actualWidth} ${actualHeight}`}
        preserveAspectRatio="none"
      >
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
        />
        {showDot && (
          <circle
            cx={lastX}
            cy={lastY}
            r="2.5"
            fill={color}
          />
        )}
        {tooltip.show && (
          <circle
            cx={tooltip.x}
            cy={tooltip.y}
            r="3"
            fill={color}
            stroke="#fff"
            strokeWidth="1"
          />
        )}
      </svg>
      {tooltip.show && (
        <Box
          sx={{
            position: 'absolute',
            left: tooltip.x + 10,
            top: tooltip.y - 30,
            bgcolor: 'rgba(0,0,0,0.85)',
            color: 'white',
            px: 1,
            py: 0.5,
            borderRadius: '4px',
            fontSize: '0.7rem',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            pointerEvents: 'none'
          }}
        >
          <div>{tooltip.period}</div>
          <div>${formatNumber(tooltip.value / 1000)}M</div>
        </Box>
      )}
    </Box>
  );
};

/**
 * Compact Trends Tab - Maximum data density following Tufte principles
 */
function TrendsTabCompact({ idrssd, availablePeriods }) {
  const [loading, setLoading] = useState(true);
  const [trendsData, setTrendsData] = useState(null);
  const [loanPortfolioExpanded, setLoanPortfolioExpanded] = useState(false);

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '—';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  const formatCurrency = (num, decimals = 0) => {
    if (num === null || num === undefined) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num);
  };

  const formatPercent = (num, decimals = 1) => {
    if (num === null || num === undefined || isNaN(num)) return '—';
    return `${num.toFixed(decimals)}%`;
  };

  useEffect(() => {
    const fetchTrendsData = async () => {
      if (!availablePeriods || availablePeriods.length === 0) {
        setLoading(false);
        return;
      }

      try {
        // Sort periods chronologically (oldest first) for proper chart ordering
        const sortedPeriods = [...availablePeriods].sort((a, b) =>
          new Date(a) - new Date(b)
        );

        const promises = sortedPeriods.map(period =>
          axios.get(`/api/banks/${idrssd}?period=${period}`)
        );
        const responses = await Promise.all(promises);
        const data = responses.map(response => response.data.financialStatement);
        // Data is now already in chronological order (oldest to newest)
        setTrendsData(data);
      } catch (error) {
        console.error('Error fetching trends:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrendsData();
  }, [idrssd, availablePeriods]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!trendsData || trendsData.length === 0) {
    return <Typography>No trend data available</Typography>;
  }

  // Extract time series data (data is now oldest to newest)
  const periods = trendsData.length;
  const latest = trendsData[trendsData.length - 1];  // Most recent is at the end
  const oldest = trendsData[0];  // Oldest is at the beginning

  // Create chronologically sorted periods array for Sparklines
  const sortedPeriods = trendsData.map(d => d.reportingPeriod);

  // Balance Sheet Metrics
  const totalAssetsData = trendsData.map(d => d.balanceSheet.assets.totalAssets / 1000);
  const loansData = trendsData.map(d => d.balanceSheet.assets.earningAssets.loansAndLeases.net / 1000);
  const depositsData = trendsData.map(d => d.balanceSheet.liabilities.deposits.total / 1000);
  const equityData = trendsData.map(d => d.balanceSheet.equity.totalEquity / 1000);

  // Income Metrics
  const netIncomeData = trendsData.map(d => d.incomeStatement.netIncome / 1000);
  const niiData = trendsData.map(d => d.incomeStatement.netInterestIncome / 1000);
  const nonIntIncomeData = trendsData.map(d => d.incomeStatement.noninterestIncome.total / 1000);
  const nonIntExpenseData = trendsData.map(d => d.incomeStatement.noninterestExpense.total / 1000);

  // Ratio Metrics
  const roeData = trendsData.map(d => d.ratios?.roe);
  const roaData = trendsData.map(d => d.ratios?.roa);
  const nimData = trendsData.map(d => d.ratios?.netInterestMargin);
  const efficiencyData = trendsData.map(d => d.ratios?.efficiencyRatio);
  const operatingLeverageData = trendsData.map(d => d.ratios?.operatingLeverage);

  // Chart data for income/expense visualizations
  const incomeExpenseChartData = trendsData.map((d, idx) => {
    const date = new Date(d.reportingPeriod);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const quarter = Math.ceil(month / 3);

    return {
      period: `${year} Q${quarter}`,
      year,
      quarter,
      netInterestIncome: (d.incomeStatement.netInterestIncome / 1000).toFixed(1),
      noninterestIncome: (d.incomeStatement.noninterestIncome.total / 1000).toFixed(1),
      salariesAndBenefits: (d.incomeStatement.noninterestExpense.salariesAndBenefits / 1000).toFixed(1),
      premisesExpense: (d.incomeStatement.noninterestExpense.premisesExpense / 1000).toFixed(1),
      otherExpenses: (d.incomeStatement.noninterestExpense.other / 1000).toFixed(1),
      fte: d.incomeStatement.fullTimeEquivalentEmployees || 0,
      netIncome: (d.incomeStatement.netIncome / 1000).toFixed(1)
    };
  });

  // Transform data for year-over-year net income chart
  const netIncomeByYearData = [];
  const yearGroups = {};

  incomeExpenseChartData.forEach(d => {
    if (!yearGroups[d.year]) {
      yearGroups[d.year] = {};
    }
    yearGroups[d.year][`Q${d.quarter}`] = parseFloat(d.netIncome);
  });

  // Create data points for each quarter
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  quarters.forEach(q => {
    const dataPoint = { quarter: q };
    Object.keys(yearGroups).sort().forEach(year => {
      dataPoint[year] = yearGroups[year][q] || null;
    });
    netIncomeByYearData.push(dataPoint);
  });

  // Generate colors - darkest blue for most recent year, lighter for older years
  const years = Object.keys(yearGroups).sort().reverse();
  const blueShades = [
    '#0d47a1', // Dark blue
    '#1976d2', // Medium blue
    '#42a5f5', // Light blue
    '#90caf9', // Lighter blue
    '#bbdefb'  // Lightest blue
  ];

  // Calculate changes (from oldest to newest)
  const calculateChange = (oldValue, newValue) => {
    if (!oldValue || oldValue === 0) return null;
    return ((newValue - oldValue) / oldValue) * 100;
  };

  // Calculate CAGR (Compound Annual Growth Rate)
  const calculateCAGR = (beginValue, endValue, years) => {
    if (!beginValue || beginValue === 0 || years === 0) return null;
    return (Math.pow(endValue / beginValue, 1 / years) - 1) * 100;
  };

  const assetChange = calculateChange(totalAssetsData[0], totalAssetsData[totalAssetsData.length - 1]);
  const loanChange = calculateChange(loansData[0], loansData[loansData.length - 1]);
  const depositChange = calculateChange(depositsData[0], depositsData[depositsData.length - 1]);
  const equityChange = calculateChange(equityData[0], equityData[equityData.length - 1]);

  // Calculate CAGRs (assuming quarterly data, 4 periods = 1 year)
  const yearsTotal = periods / 4;
  const oneYearAgo = Math.max(0, periods - 4);
  const threeYearsAgo = Math.max(0, periods - 12);

  const asset1YCAGR = oneYearAgo < periods ? calculateCAGR(totalAssetsData[oneYearAgo], totalAssetsData[periods - 1], 1) : null;
  const asset3YCAGR = threeYearsAgo < periods ? calculateCAGR(totalAssetsData[threeYearsAgo], totalAssetsData[periods - 1], 3) : null;
  const loan1YCAGR = oneYearAgo < periods ? calculateCAGR(loansData[oneYearAgo], loansData[periods - 1], 1) : null;
  const loan3YCAGR = threeYearsAgo < periods ? calculateCAGR(loansData[threeYearsAgo], loansData[periods - 1], 3) : null;
  const deposit1YCAGR = oneYearAgo < periods ? calculateCAGR(depositsData[oneYearAgo], depositsData[periods - 1], 1) : null;
  const deposit3YCAGR = threeYearsAgo < periods ? calculateCAGR(depositsData[threeYearsAgo], depositsData[periods - 1], 3) : null;
  const equity1YCAGR = oneYearAgo < periods ? calculateCAGR(equityData[oneYearAgo], equityData[periods - 1], 1) : null;
  const equity3YCAGR = threeYearsAgo < periods ? calculateCAGR(equityData[threeYearsAgo], equityData[periods - 1], 3) : null;

  // Loan portfolio breakdown with CAGR
  const portfolio = latest.balanceSheet.assets.earningAssets.loansAndLeases.portfolio;
  const totalLoans = latest.balanceSheet.assets.earningAssets.loansAndLeases.net;

  // Consumer lending
  const residential = (portfolio.realEstate.securedBy1To4Family.revolvingOpenEnd || 0) +
    (portfolio.realEstate.securedBy1To4Family.closedEndFirstLiens || 0) +
    (portfolio.realEstate.securedBy1To4Family.closedEndJuniorLiens || 0);
  const creditCards = portfolio.consumer.creditCards || 0;
  const auto = portfolio.consumer.automobileLoans || 0;
  const otherConsumer = (portfolio.consumer.otherRevolvingCredit || 0) + (portfolio.consumer.otherConsumerLoans || 0);
  const consumerTotal = residential + creditCards + auto + otherConsumer;

  // Business lending
  const commercialRE = (portfolio.realEstate.constructionAndLandDevelopment.total || 0) +
    (portfolio.realEstate.multifamily || 0) +
    (portfolio.realEstate.nonfarmNonresidential.ownerOccupied || 0) +
    (portfolio.realEstate.nonfarmNonresidential.otherNonfarmNonresidential || 0);
  const cniUS = portfolio.commercialAndIndustrial.usAddressees || 0;
  const cniNonUS = portfolio.commercialAndIndustrial.nonUsAddressees || 0;
  const agricultural = portfolio.other.agriculturalProduction || 0;
  const toDepository = portfolio.other.toDepositoryInstitutions || 0;

  // Other Specialized Loans - now part of Business Lending
  const foreignGovernments = portfolio.other.loansToForeignGovernments || 0;
  const municipalLoans = portfolio.other.municipalLoans || 0;
  const otherDepositoryUS = portfolio.other.loansToOtherDepositoryUS || 0;
  const banksForeign = portfolio.other.loansToBanksForeign || 0;
  const allOtherLoansRemainder = portfolio.other.allOtherLoans || 0;
  const otherSpecializedLoans = foreignGovernments + municipalLoans + otherDepositoryUS + banksForeign + allOtherLoansRemainder;

  const businessTotal = commercialRE + cniUS + cniNonUS + agricultural + toDepository + otherSpecializedLoans;

  // Lease financing
  const consumerLeases = portfolio.leaseFinancingReceivables?.consumerLeases || 0;
  const otherLeases = portfolio.leaseFinancingReceivables?.allOtherLeases || 0;
  const leasesTotal = consumerLeases + otherLeases;

  // Calculate "Unearned Income & Adjustments" as the balancing item
  // Portfolio reports GROSS loans, but net loans includes adjustments
  const categorizedTotal = consumerTotal + businessTotal + leasesTotal;
  const unearnedIncomeAdjustment = totalLoans - categorizedTotal;

  // Break down the unearned income adjustment
  const netOfAllowance = latest.balanceSheet.assets.earningAssets.loansAndLeases.netOfAllowance || totalLoans;
  const heldForSale = latest.balanceSheet.assets.earningAssets.loansAndLeases.heldForSale || 0;

  // The adjustment includes the gross-to-net conversion
  // We can separately identify the allowance for credit losses
  const allowanceForCreditLosses = -(totalLoans - netOfAllowance); // Negative because it's a contra-asset
  const remainingAdjustment = unearnedIncomeAdjustment - allowanceForCreditLosses; // Unearned income/deferred fees

  // Calculate CAGR for loan categories
  const extractLoanCategory = (statements, extractor) => statements.map(s => extractor(s.balanceSheet.assets.earningAssets.loansAndLeases.portfolio));

  const residentialData = extractLoanCategory(trendsData, p =>
    (p.realEstate.securedBy1To4Family.revolvingOpenEnd || 0) +
    (p.realEstate.securedBy1To4Family.closedEndFirstLiens || 0) +
    (p.realEstate.securedBy1To4Family.closedEndJuniorLiens || 0)
  );
  const creditCardsData = extractLoanCategory(trendsData, p => p.consumer.creditCards || 0);
  const autoData = extractLoanCategory(trendsData, p => p.consumer.automobileLoans || 0);
  const otherConsumerData = extractLoanCategory(trendsData, p =>
    (p.consumer.otherRevolvingCredit || 0) + (p.consumer.otherConsumerLoans || 0)
  );
  const commercialREData = extractLoanCategory(trendsData, p =>
    (p.realEstate.constructionAndLandDevelopment.total || 0) +
    (p.realEstate.multifamily || 0) +
    (p.realEstate.nonfarmNonresidential.ownerOccupied || 0) +
    (p.realEstate.nonfarmNonresidential.otherNonfarmNonresidential || 0)
  );
  const cniUSData = extractLoanCategory(trendsData, p => p.commercialAndIndustrial.usAddressees || 0);
  const cniNonUSData = extractLoanCategory(trendsData, p => p.commercialAndIndustrial.nonUsAddressees || 0);
  const agriculturalData = extractLoanCategory(trendsData, p => p.other.agriculturalProduction || 0);
  const toDepositoryData = extractLoanCategory(trendsData, p => p.other.toDepositoryInstitutions || 0);

  // Other Specialized Loans subcategories - now part of Business Lending
  const foreignGovernmentsData = extractLoanCategory(trendsData, p => p.other.loansToForeignGovernments || 0);
  const municipalLoansData = extractLoanCategory(trendsData, p => p.other.municipalLoans || 0);
  const otherDepositoryUSData = extractLoanCategory(trendsData, p => p.other.loansToOtherDepositoryUS || 0);
  const banksForeignData = extractLoanCategory(trendsData, p => p.other.loansToBanksForeign || 0);
  const allOtherLoansRemainderData = extractLoanCategory(trendsData, p => p.other.allOtherLoans || 0);
  const otherSpecializedLoansData = foreignGovernmentsData.map((val, i) =>
    val + municipalLoansData[i] + otherDepositoryUSData[i] + banksForeignData[i] + allOtherLoansRemainderData[i]
  );

  const leasesData = extractLoanCategory(trendsData, p =>
    (p.leaseFinancingReceivables?.consumerLeases || 0) + (p.leaseFinancingReceivables?.allOtherLeases || 0)
  );
  const consumerLeasesData = extractLoanCategory(trendsData, p => p.leaseFinancingReceivables?.consumerLeases || 0);
  const otherLeasesData = extractLoanCategory(trendsData, p => p.leaseFinancingReceivables?.allOtherLeases || 0);

  // Calculate time-series for parent categories
  const consumerTotalData = residentialData.map((val, i) => val + creditCardsData[i] + autoData[i] + otherConsumerData[i]);
  const businessTotalData = commercialREData.map((val, i) =>
    val + cniUSData[i] + cniNonUSData[i] + agriculturalData[i] + toDepositoryData[i] + otherSpecializedLoansData[i]
  );

  // Calculate "Unearned Income & Adjustments" time series (balancing item)
  const unearnedIncomeData = loansData.map((netLoans, i) =>
    netLoans - (consumerTotalData[i] + businessTotalData[i] + leasesData[i])
  );

  // Extract allowance for credit losses time series
  const allowanceData = trendsData.map(s => {
    const net = s.balanceSheet.assets.earningAssets.loansAndLeases.net;
    const netOfAllowance = s.balanceSheet.assets.earningAssets.loansAndLeases.netOfAllowance || net;
    return -(net - netOfAllowance); // Negative because it's a reduction
  });

  // Remaining adjustment is unearned income/deferred fees
  const remainingAdjustmentData = unearnedIncomeData.map((adj, i) => adj - allowanceData[i]);

  const loanCategories = [
    {
      name: 'Consumer Lending',
      value: consumerTotal,
      color: '#1976d2',
      data: consumerTotalData,
      cagr1y: oneYearAgo < periods ? calculateCAGR(consumerTotalData[oneYearAgo], consumerTotal, 1) : null,
      cagr3y: threeYearsAgo < periods ? calculateCAGR(consumerTotalData[threeYearsAgo], consumerTotal, 3) : null,
      children: [
        { name: 'Residential Mortgages', value: residential, data: residentialData },
        { name: 'Credit Cards', value: creditCards, data: creditCardsData },
        { name: 'Auto Loans', value: auto, data: autoData },
        { name: 'Other Consumer', value: otherConsumer, data: otherConsumerData }
      ].filter(c => c.value > 0)
    },
    {
      name: 'Business Lending',
      value: businessTotal,
      color: '#43a047',
      data: businessTotalData,
      cagr1y: oneYearAgo < periods ? calculateCAGR(businessTotalData[oneYearAgo], businessTotal, 1) : null,
      cagr3y: threeYearsAgo < periods ? calculateCAGR(businessTotalData[threeYearsAgo], businessTotal, 3) : null,
      children: [
        { name: 'Commercial Real Estate', value: commercialRE, data: commercialREData },
        { name: 'C&I (US)', value: cniUS, data: cniUSData },
        { name: 'C&I (Non-US)', value: cniNonUS, data: cniNonUSData },
        { name: 'Agricultural', value: agricultural, data: agriculturalData },
        { name: 'To Depository Institutions', value: toDepository, data: toDepositoryData },
        // Other Specialized Loans - Securities-based lending and institutional loans
        ...(otherSpecializedLoans > 1000 ? [{
          name: 'Other Specialized Loans',
          value: otherSpecializedLoans,
          data: otherSpecializedLoansData,
          note: 'Securities-based lending, margin loans, and specialized institutional lending',
          children: [
            { name: 'Loans to Foreign Governments', value: foreignGovernments, data: foreignGovernmentsData },
            { name: 'Municipal/State Obligations', value: municipalLoans, data: municipalLoansData },
            { name: 'Loans to Other Depository Inst (US)', value: otherDepositoryUS, data: otherDepositoryUSData },
            { name: 'Loans to Foreign Banks', value: banksForeign, data: banksForeignData },
            {
              name: 'Other Specialized Loans (Unspecified)',
              value: allOtherLoansRemainder,
              data: allOtherLoansRemainderData,
              note: 'Securities-based lending, acceptances, and other specialized financing'
            }
          ].filter(c => c.value > 1000) // Only show if > $1M
        }] : [])
      ].filter(c => c.value > 0)
    },
    {
      name: 'Lease Financing',
      value: leasesTotal,
      color: '#f57c00',
      data: leasesData,
      cagr1y: oneYearAgo < periods ? calculateCAGR(leasesData[oneYearAgo], leasesTotal, 1) : null,
      cagr3y: threeYearsAgo < periods ? calculateCAGR(leasesData[threeYearsAgo], leasesTotal, 3) : null,
      children: [
        { name: 'Consumer Leases', value: consumerLeases, data: consumerLeasesData },
        { name: 'Other Leases', value: otherLeases, data: otherLeasesData }
      ].filter(c => c.value > 0)
    },
    {
      name: 'Unearned Income & Adjustments',
      value: unearnedIncomeAdjustment,
      color: '#9e9e9e',
      data: unearnedIncomeData,
      cagr1y: oneYearAgo < periods ? calculateCAGR(unearnedIncomeData[oneYearAgo], unearnedIncomeAdjustment, 1) : null,
      cagr3y: threeYearsAgo < periods ? calculateCAGR(unearnedIncomeData[threeYearsAgo], unearnedIncomeAdjustment, 3) : null,
      children: [
        {
          name: 'Allowance for Credit Losses',
          value: allowanceForCreditLosses,
          data: allowanceData,
          note: 'Loan loss reserve (contra-asset)'
        },
        {
          name: 'Unearned Income & Deferred Fees',
          value: remainingAdjustment,
          data: remainingAdjustmentData,
          note: 'Gross to net adjustment'
        }
      ].filter(c => Math.abs(c.value) > 1000), // Only show if material (>1M)
      note: 'Adjustments from gross portfolio to net loans'
    }
  ].filter(cat => cat.value !== 0 && !isNaN(cat.value));

  return (
    <Box>
      {/* ASSET MIX - Loan Portfolio Composition */}
      <Paper sx={{ mb: 2, p: 2, bgcolor: '#fafafa' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, borderBottom: '2px solid #333', pb: 0.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
            ASSET MIX - LOAN PORTFOLIO
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
              ${formatNumber(totalLoans / 1000000)}B
            </Typography>
            <Sparkline data={loansData} color="#1976d2" width={100} height={24} periods={sortedPeriods} />
          </Box>
        </Box>

        {/* Stacked Bar Chart - Visual Overview */}
        <Box sx={{ mb: 3, mt: 2 }}>
          <Box sx={{ display: 'flex', height: 40, borderRadius: 1, overflow: 'hidden', border: '1px solid #ddd' }}>
            {loanCategories.map((category, idx) => {
              const percentage = (category.value / totalLoans) * 100;
              if (percentage < 0.1) return null; // Hide very small segments
              return (
                <Box
                  key={idx}
                  sx={{
                    width: `${percentage}%`,
                    backgroundColor: category.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    '&:hover': {
                      opacity: 0.8,
                      cursor: 'pointer'
                    }
                  }}
                  title={`${category.name}: ${formatCurrency(category.value)} (${percentage.toFixed(1)}%)`}
                >
                  {percentage > 8 && (
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                      {percentage.toFixed(0)}%
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
          {/* Legend */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1.5, justifyContent: 'center' }}>
            {loanCategories.map((category, idx) => (
              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, backgroundColor: category.color, borderRadius: 0.5 }} />
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                  {category.name}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Expand/Collapse Control */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
            mt: 1,
            cursor: 'pointer',
            '&:hover': { backgroundColor: '#f5f5f5' },
            borderRadius: 1,
            py: 0.5,
            border: '1px solid #e0e0e0'
          }}
          onClick={() => setLoanPortfolioExpanded(!loanPortfolioExpanded)}
        >
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'primary.main', mr: 0.5 }}>
            {loanPortfolioExpanded ? 'Hide' : 'Show'} Detailed Breakdown
          </Typography>
          <IconButton size="small" sx={{ p: 0 }}>
            {loanPortfolioExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Box>

        <Collapse in={loanPortfolioExpanded}>
          {/* Column Headers */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, pb: 0.5, borderBottom: '1px solid #ddd' }}>
            <Typography sx={{ width: 200, fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }}>Category</Typography>
            <Typography sx={{ width: 90, fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary', textAlign: 'right', mr: 1 }}>Amount</Typography>
            <Typography sx={{ width: 55, fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary', textAlign: 'right', mr: 1 }}>% Total</Typography>
            <Typography sx={{ width: 80, fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary', textAlign: 'center', mr: 1 }}>Trend</Typography>
            <Typography sx={{ width: 70, fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary', textAlign: 'right', mr: 1 }}>1Y CAGR</Typography>
            <Typography sx={{ width: 70, fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary', textAlign: 'right' }}>3Y CAGR</Typography>
          </Box>

          {loanCategories.map((category, idx) => (
            <Box key={idx} sx={{ mb: 2.5 }}>
              {/* Parent category */}
              <Box sx={{ mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.3 }}>
                  <Box sx={{ width: 200 }}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {category.name}
                    </Typography>
                    {category.note && (
                      <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', fontStyle: 'italic', lineHeight: 1.2 }}>
                        {category.note}
                      </Typography>
                    )}
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', width: 90, textAlign: 'right', mr: 1 }}>
                    ${formatNumber(category.value / 1000)}M
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', width: 55, textAlign: 'right', color: 'text.secondary', mr: 1 }}>
                    {((category.value / totalLoans) * 100).toFixed(1)}%
                  </Typography>
                  <Box sx={{ width: 80, mr: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkline data={category.data} color={category.color} width={70} height={18} periods={sortedPeriods} />
                  </Box>
                  <Typography sx={{ fontSize: '0.7rem', width: 70, color: category.cagr1y > 0 ? '#2e7d32' : category.cagr1y < 0 ? '#d32f2f' : 'text.secondary', textAlign: 'right', mr: 1 }}>
                    {category.cagr1y !== null ? formatPercent(category.cagr1y) : '—'}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', width: 70, color: category.cagr3y > 0 ? '#2e7d32' : category.cagr3y < 0 ? '#d32f2f' : 'text.secondary', textAlign: 'right' }}>
                    {category.cagr3y !== null ? formatPercent(category.cagr3y) : '—'}
                  </Typography>
                </Box>
                <Box sx={{ width: '100%', bgcolor: '#f0f0f0', height: 20, borderRadius: '2px', position: 'relative' }}>
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      height: '100%',
                      width: `${(category.value / totalLoans) * 100}%`,
                      bgcolor: category.color,
                      borderRadius: '2px'
                    }}
                  />
                </Box>
              </Box>

              {/* Child categories */}
              {category.children.filter(c => c.value > 0).map((child, childIdx) => {
                const child1YCAGR = child.data.length > 0 && oneYearAgo < periods ? calculateCAGR(child.data[oneYearAgo], child.value, 1) : null;
                const child3YCAGR = child.data.length > 0 && threeYearsAgo < periods ? calculateCAGR(child.data[threeYearsAgo], child.value, 3) : null;

                return (
                  <Box key={childIdx} sx={{ ml: 2, mb: 0.3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.2 }}>
                      <Typography sx={{ fontSize: '0.7rem', width: 198, color: 'text.secondary' }}>
                        {child.name}
                      </Typography>
                      <Typography sx={{ fontSize: '0.7rem', width: 90, textAlign: 'right', color: 'text.secondary', mr: 1 }}>
                        ${formatNumber(child.value / 1000)}M
                      </Typography>
                      <Box sx={{ width: 55, textAlign: 'right', mr: 1 }}>
                        <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', lineHeight: 1.2 }}>
                          {((child.value / totalLoans) * 100).toFixed(1)}%
                        </Typography>
                        <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', opacity: 0.7 }}>
                          ({((child.value / category.value) * 100).toFixed(0)}% of {category.name.split(' ')[0]})
                        </Typography>
                      </Box>
                      <Box sx={{ width: 80, mr: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {child.data.length > 0 && (
                          <Sparkline data={child.data} color={category.color} width={70} height={14} periods={sortedPeriods} />
                        )}
                      </Box>
                      <Typography sx={{ fontSize: '0.65rem', width: 70, color: child1YCAGR > 0 ? '#2e7d32' : child1YCAGR < 0 ? '#d32f2f' : 'text.secondary', textAlign: 'right', mr: 1 }}>
                        {child1YCAGR !== null ? formatPercent(child1YCAGR) : '—'}
                      </Typography>
                      <Typography sx={{ fontSize: '0.65rem', width: 70, color: child3YCAGR > 0 ? '#2e7d32' : child3YCAGR < 0 ? '#d32f2f' : 'text.secondary', textAlign: 'right' }}>
                        {child3YCAGR !== null ? formatPercent(child3YCAGR) : '—'}
                      </Typography>
                    </Box>
                    <Box sx={{ width: '100%', bgcolor: '#f5f5f5', height: 14, borderRadius: '1px', position: 'relative' }}>
                      <Box
                        sx={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          height: '100%',
                          width: `${(child.value / totalLoans) * 100}%`,
                          bgcolor: category.color,
                          opacity: 0.6,
                          borderRadius: '1px'
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ))}
        </Collapse>
      </Paper>

      {/* KEY RATIOS - Four Box Grid */}
      <Paper sx={{ mb: 2, p: 2, bgcolor: '#fafafa' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, fontSize: '0.95rem', borderBottom: '2px solid #333', pb: 0.5 }}>
          KEY PERFORMANCE RATIOS
        </Typography>

        <Grid container spacing={2}>
          {/* Efficiency Ratio */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, bgcolor: '#fff', border: '1px solid #e0e0e0', aspectRatio: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>
                Efficiency Ratio
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: efficiencyData[efficiencyData.length - 1] < 60 ? '#2e7d32' : efficiencyData[efficiencyData.length - 1] < 70 ? '#ed6c02' : '#d32f2f' }}>
                  {efficiencyData[efficiencyData.length - 1]?.toFixed(1) || '—'}%
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                  {efficiencyData[efficiencyData.length - 1] < 60 ? '(Excellent)' : efficiencyData[efficiencyData.length - 1] < 70 ? '(Good)' : '(Needs Improvement)'}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
                <Box sx={{ width: '100%', maxWidth: '100%' }}>
                  <Sparkline data={efficiencyData} color={efficiencyData[efficiencyData.length - 1] < 60 ? '#2e7d32' : '#ed6c02'} width="100%" height="100%" periods={sortedPeriods} />
                </Box>
              </Box>
              <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mt: 1 }}>
                Lower is better • Industry avg: 50-60%
              </Typography>
            </Paper>
          </Grid>

          {/* Return on Equity (ROE) */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, bgcolor: '#fff', border: '1px solid #e0e0e0', aspectRatio: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>
                Return on Equity (ROE)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: roeData[roeData.length - 1] > 12 ? '#2e7d32' : roeData[roeData.length - 1] > 8 ? '#ed6c02' : '#d32f2f' }}>
                  {roeData[roeData.length - 1]?.toFixed(1) || '—'}%
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                  {roeData[roeData.length - 1] > 12 ? '(Strong)' : roeData[roeData.length - 1] > 8 ? '(Fair)' : '(Weak)'}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
                <Box sx={{ width: '100%', maxWidth: '100%' }}>
                  <Sparkline data={roeData} color={roeData[roeData.length - 1] > 12 ? '#2e7d32' : '#ed6c02'} width="100%" height="100%" periods={sortedPeriods} />
                </Box>
              </Box>
              <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mt: 1 }}>
                Higher is better • Industry avg: 8-12%
              </Typography>
            </Paper>
          </Grid>

          {/* Net Interest Margin (NIM) */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, bgcolor: '#fff', border: '1px solid #e0e0e0', aspectRatio: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>
                Net Interest Margin (NIM)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: nimData[nimData.length - 1] > 3.5 ? '#2e7d32' : nimData[nimData.length - 1] > 2.5 ? '#ed6c02' : '#d32f2f' }}>
                  {nimData[nimData.length - 1]?.toFixed(2) || '—'}%
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                  {nimData[nimData.length - 1] > 3.5 ? '(Healthy)' : nimData[nimData.length - 1] > 2.5 ? '(Fair)' : '(Compressed)'}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
                <Box sx={{ width: '100%', maxWidth: '100%' }}>
                  <Sparkline data={nimData} color={nimData[nimData.length - 1] > 3.5 ? '#2e7d32' : '#ed6c02'} width="100%" height="100%" periods={sortedPeriods} />
                </Box>
              </Box>
              <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mt: 1 }}>
                Higher is better • Industry avg: 3-4%
              </Typography>
            </Paper>
          </Grid>

          {/* Operating Leverage */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, bgcolor: '#fff', border: '1px solid #e0e0e0', aspectRatio: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>
                Operating Leverage (YoY)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: operatingLeverageData[operatingLeverageData.length - 1] > 1 ? '#2e7d32' : operatingLeverageData[operatingLeverageData.length - 1] > 0 ? '#ed6c02' : '#d32f2f' }}>
                  {operatingLeverageData[operatingLeverageData.length - 1]?.toFixed(2) || '—'}x
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                  {operatingLeverageData[operatingLeverageData.length - 1] > 1 ? '(Positive)' : operatingLeverageData[operatingLeverageData.length - 1] > 0 ? '(Neutral)' : '(Negative)'}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
                <Box sx={{ width: '100%', maxWidth: '100%' }}>
                  <Sparkline data={operatingLeverageData} color={operatingLeverageData[operatingLeverageData.length - 1] > 1 ? '#2e7d32' : '#ed6c02'} width="100%" height="100%" periods={sortedPeriods} />
                </Box>
              </Box>
              <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mt: 1 }}>
                Higher is better
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Paper>

      {/* INCOME & EXPENSE SECTION - Tufte-optimized */}
      <Paper sx={{ mb: 2, p: 2, bgcolor: '#fafafa' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, fontSize: '0.95rem', borderBottom: '2px solid #333', pb: 0.5 }}>
          INCOME & EXPENSE
        </Typography>

        {/* Full Width Charts - No Grid */}
        <Box sx={{ bgcolor: '#fff', borderRadius: 1, border: '1px solid #e0e0e0', p: 2, mb: 2 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.5, color: '#333' }}>
            Interest vs. Non-Interest Income
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontSize: '0.65rem' }}>
            YTD cumulative ($M)
          </Typography>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={incomeExpenseChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip
                formatter={(value) => `$${value}M`}
                contentStyle={{ fontSize: '0.7rem', border: '1px solid #ddd', borderRadius: 4 }}
              />
              <Legend
                wrapperStyle={{ fontSize: '0.65rem', paddingTop: 8 }}
                iconType="square"
                iconSize={10}
              />
              <Bar dataKey="netInterestIncome" stackId="income" fill="#1976d2" name="Net Interest" />
              <Bar dataKey="noninterestIncome" stackId="income" fill="#82ca9d" name="Non-Interest" />
            </BarChart>
          </ResponsiveContainer>
        </Box>

        <Box sx={{ bgcolor: '#fff', borderRadius: 1, border: '1px solid #e0e0e0', p: 2, mb: 2 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.5, color: '#333' }}>
            Operating Expenses Breakdown
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontSize: '0.65rem' }}>
            YTD cumulative ($M)
          </Typography>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={incomeExpenseChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip
                formatter={(value) => `$${value}M`}
                contentStyle={{ fontSize: '0.7rem', border: '1px solid #ddd', borderRadius: 4 }}
              />
              <Legend
                wrapperStyle={{ fontSize: '0.65rem', paddingTop: 8 }}
                iconType="square"
                iconSize={10}
              />
              <Bar dataKey="salariesAndBenefits" stackId="expenses" fill="#ff8042" name="Salaries" />
              <Bar dataKey="premisesExpense" stackId="expenses" fill="#ffbb28" name="Premises" />
              <Bar dataKey="otherExpenses" stackId="expenses" fill="#8884d8" name="Other" />
            </BarChart>
          </ResponsiveContainer>
        </Box>

        <Box sx={{ bgcolor: '#fff', borderRadius: 1, border: '1px solid #e0e0e0', p: 2, mb: 2 }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.5, color: '#333' }}>
            Full-Time Employees
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontSize: '0.65rem' }}>
            Total FTE count
          </Typography>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={incomeExpenseChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
                formatter={(value) => `${value} FTE`}
                contentStyle={{ fontSize: '0.7rem', border: '1px solid #ddd', borderRadius: 4 }}
              />
              <Legend
                wrapperStyle={{ fontSize: '0.65rem', paddingTop: 8 }}
                iconType="square"
                iconSize={10}
              />
              <Bar
                dataKey="fte"
                fill="#8884d8"
                name="FTE"
              />
            </BarChart>
          </ResponsiveContainer>
        </Box>

        <Box sx={{ bgcolor: '#fff', borderRadius: 1, border: '1px solid #e0e0e0', p: 2 }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.5, color: '#333' }}>
                Net Income (Year-over-Year)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontSize: '0.65rem' }}>
                YTD cumulative by quarter ($M)
              </Typography>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={netIncomeByYearData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" vertical={false} />
                  <XAxis
                    dataKey="quarter"
                    tick={{ fontSize: 9, fill: '#666' }}
                    axisLine={{ stroke: '#ddd' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: '#666' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    formatter={(value) => value ? `$${value}M` : 'N/A'}
                    contentStyle={{ fontSize: '0.7rem', border: '1px solid #ddd', borderRadius: 4 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '0.65rem', paddingTop: 8 }}
                    iconType="line"
                    iconSize={10}
                  />
                  {years.map((year, idx) => (
                    <Line
                      key={year}
                      type="monotone"
                      dataKey={year}
                      stroke={blueShades[idx % blueShades.length]}
                      strokeWidth={2.5}
                      name={year}
                      dot={{ r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Box>
      </Paper>
    </Box>
  );
}

export default TrendsTabCompact;
