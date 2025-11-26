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
  Divider
} from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
);

/**
 * Inline Sparkline Component - Tufte-inspired word-sized graphic
 */
const Sparkline = ({ data, width = 80, height = 20, color = '#d97757', showDot = true }) => {
  if (!data || data.length === 0) return null;

  const values = data.filter(v => v !== null && v !== undefined);
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((value, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const lastValue = values[values.length - 1];
  const lastX = width;
  const lastY = height - ((lastValue - min) / range) * height;

  return (
    <svg width={width} height={height} style={{ verticalAlign: 'middle', display: 'inline-block' }}>
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
          r="2"
          fill={color}
        />
      )}
    </svg>
  );
};

/**
 * Trends Tab - Tufte-inspired time-series visualizations
 * Shows asset composition and income trends over time
 */
function TrendsTab({ idrssd, availablePeriods }) {
  const [loading, setLoading] = useState(true);
  const [trendsData, setTrendsData] = useState(null);

  // Format number with commas
  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  useEffect(() => {
    const fetchTrendsData = async () => {
      if (!availablePeriods || availablePeriods.length === 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Fetch financial statements for all periods
        const requests = availablePeriods.map(period =>
          axios.get(`/api/banks/${idrssd}?period=${period}`)
        );
        const responses = await Promise.all(requests);
        const statements = responses.map(r => r.data.financialStatement);

        // Sort by period (oldest first for trends)
        statements.sort((a, b) => new Date(a.reportingPeriod) - new Date(b.reportingPeriod));

        setTrendsData(statements);
      } catch (error) {
        console.error('Error fetching trends data:', error);
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

  // Prepare labels (quarters)
  const labels = trendsData.map(stmt => {
    const date = new Date(stmt.reportingPeriod);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const quarter = Math.ceil(month / 3);
    return `${year} Q${quarter}`;
  });

  // Prepare asset composition data (in millions for readability)
  // Break down loans into Consumer and Business subcategories for stacked area chart
  const assetBreakdownData = trendsData.map(stmt => {
    const portfolio = stmt.balanceSheet.assets.earningAssets.loansAndLeases.portfolio;

    return {
      // Consumer lending subcategories
      residential:
        (portfolio.realEstate.securedBy1To4Family.revolvingOpenEnd || 0) +
        (portfolio.realEstate.securedBy1To4Family.closedEndFirstLiens || 0) +
        (portfolio.realEstate.securedBy1To4Family.closedEndJuniorLiens || 0),
      creditCards: portfolio.consumer.creditCards || 0,
      auto: portfolio.consumer.automobileLoans || 0,
      otherConsumer:
        (portfolio.consumer.otherRevolvingCredit || 0) +
        (portfolio.consumer.otherConsumerLoans || 0) +
        (portfolio.leaseFinancingReceivables.consumerLeases || 0),

      // Business lending subcategories
      commercialRE:
        (portfolio.realEstate.constructionAndLandDevelopment.total || 0) +
        (portfolio.realEstate.multifamily || 0) +
        (portfolio.realEstate.nonfarmNonresidential.ownerOccupied || 0) +
        (portfolio.realEstate.nonfarmNonresidential.otherNonfarmNonresidential || 0) +
        (portfolio.realEstate.farmland || 0),
      cniUS: portfolio.commercialAndIndustrial.usAddressees || 0,
      cniNonUS: portfolio.commercialAndIndustrial.nonUsAddressees || 0,
      otherBusiness:
        (portfolio.other.agriculturalProduction || 0) +
        (portfolio.other.toDepositoryInstitutions || 0) +
        (portfolio.leaseFinancingReceivables.allOtherLeases || 0) +
        (portfolio.other.allOtherLoans || 0)
    };
  });

  // Prepare expense breakdown data (in millions)
  const expenseBreakdownData = trendsData.map(stmt => {
    const interestExpense = stmt.incomeStatement.interestExpense;
    const noninterestExpense = stmt.incomeStatement.noninterestExpense;

    return {
      // Interest-related expenses (subcategories)
      interestOnDeposits: interestExpense.deposits || 0,
      interestOnBorrowings: interestExpense.borrowings || 0,
      interestOnSubDebt: interestExpense.subordinatedDebt || 0,

      // Operating expenses (subcategories)
      salariesAndBenefits: noninterestExpense.salariesAndBenefits || 0,
      premisesExpense: noninterestExpense.premisesExpense || 0,
      otherNoninterestExpense: noninterestExpense.other || 0
    };
  });

  // Prepare income data by year and quarter for comparison
  const incomeByYear = {};
  trendsData.forEach(stmt => {
    const date = new Date(stmt.reportingPeriod);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const quarter = Math.ceil(month / 3);

    if (!incomeByYear[year]) {
      incomeByYear[year] = {};
    }

    incomeByYear[year][quarter] = {
      netIncome: (stmt.incomeStatement.netIncome / 1000).toFixed(2),
      netInterestIncome: (stmt.incomeStatement.netInterestIncome / 1000).toFixed(2)
    };
  });

  // Sort years descending (most recent first)
  const years = Object.keys(incomeByYear).sort((a, b) => b - a);

  // Blue shades - darker for recent years
  const blueShades = [
    '#0d47a1', // Darkest (most recent)
    '#d97757',
    '#42a5f5',
    '#90caf9',
    '#bbdefb',
    '#e3f2fd'  // Lightest (oldest)
  ];

  // Prepare FTE data
  const fteData = trendsData.map(stmt =>
    stmt.incomeStatement.fullTimeEquivalentEmployees || 0
  );

  // Prepare ratio data
  const efficiencyRatioData = trendsData.map(stmt =>
    stmt.ratios?.efficiencyRatio?.toFixed(2) || null
  );
  const roeData = trendsData.map(stmt =>
    stmt.ratios?.roe?.toFixed(2) || null
  );
  const nimData = trendsData.map(stmt =>
    stmt.ratios?.netInterestMargin?.toFixed(2) || null
  );

  // Prepare loan portfolio breakdown data with Consumer/Business classification
  const loanPortfolioData = trendsData.map((stmt, index) => {
    const portfolio = stmt.balanceSheet.assets.earningAssets.loansAndLeases.portfolio;
    const totalLoans = stmt.balanceSheet.assets.earningAssets.loansAndLeases.net;

    if (totalLoans === 0) return null;

    // CONSUMER LENDING
    const consumer = {
      // 1-4 Family Residential (Consumer mortgages)
      residential:
        (portfolio.realEstate.securedBy1To4Family.revolvingOpenEnd || 0) +
        (portfolio.realEstate.securedBy1To4Family.closedEndFirstLiens || 0) +
        (portfolio.realEstate.securedBy1To4Family.closedEndJuniorLiens || 0),
      // Consumer loans
      creditCards: portfolio.consumer.creditCards || 0,
      auto: portfolio.consumer.automobileLoans || 0,
      otherRevolving: portfolio.consumer.otherRevolvingCredit || 0,
      otherConsumer: portfolio.consumer.otherConsumerLoans || 0,
      consumerLeases: portfolio.leaseFinancingReceivables.consumerLeases || 0
    };

    const consumerTotal = Object.values(consumer).reduce((a, b) => a + b, 0);

    // BUSINESS LENDING
    const business = {
      // Commercial Real Estate
      construction: portfolio.realEstate.constructionAndLandDevelopment.total || 0,
      multifamily: portfolio.realEstate.multifamily || 0,
      commercialREOwnerOccupied: portfolio.realEstate.nonfarmNonresidential.ownerOccupied || 0,
      commercialREOther: portfolio.realEstate.nonfarmNonresidential.otherNonfarmNonresidential || 0,
      farmland: portfolio.realEstate.farmland || 0,
      // Commercial & Industrial
      commercialUS: portfolio.commercialAndIndustrial.usAddressees || 0,
      commercialNonUS: portfolio.commercialAndIndustrial.nonUsAddressees || 0,
      // Other business
      agricultural: portfolio.other.agriculturalProduction || 0,
      toDepositoryInst: portfolio.other.toDepositoryInstitutions || 0,
      businessLeases: portfolio.leaseFinancingReceivables.allOtherLeases || 0,
      otherLoans: portfolio.other.allOtherLoans || 0
    };

    const businessTotal = Object.values(business).reduce((a, b) => a + b, 0);

    return {
      consumer,
      business,
      consumerTotal,
      businessTotal,
      consumerPct: ((consumerTotal / totalLoans) * 100).toFixed(1),
      businessPct: ((businessTotal / totalLoans) * 100).toFixed(1),
      totalLoans
    };
  });

  // Calculate current composition and growth trends
  const latestLoans = loanPortfolioData[loanPortfolioData.length - 1];
  const oldestLoans = loanPortfolioData[0];

  const loanCategories = [
    {
      name: 'Consumer Lending',
      current: latestLoans?.consumerTotal || 0,
      percentage: latestLoans?.consumerPct || 0,
      growth: oldestLoans ? ((latestLoans.consumerTotal - oldestLoans.consumerTotal) / oldestLoans.consumerTotal * 100) : 0,
      color: '#d97757',
      subcategories: [
        { name: 'Residential Mortgages (1-4 Family)', value: latestLoans?.consumer.residential || 0 },
        { name: 'Credit Cards', value: latestLoans?.consumer.creditCards || 0 },
        { name: 'Auto Loans', value: latestLoans?.consumer.auto || 0 },
        { name: 'Other Consumer', value: (latestLoans?.consumer.otherRevolving || 0) + (latestLoans?.consumer.otherConsumer || 0) + (latestLoans?.consumer.consumerLeases || 0) }
      ]
    },
    {
      name: 'Business Lending',
      current: latestLoans?.businessTotal || 0,
      percentage: latestLoans?.businessPct || 0,
      growth: oldestLoans ? ((latestLoans.businessTotal - oldestLoans.businessTotal) / oldestLoans.businessTotal * 100) : 0,
      color: '#388e3c',
      subcategories: [
        { name: 'Commercial Real Estate', value:
          (latestLoans?.business.construction || 0) +
          (latestLoans?.business.multifamily || 0) +
          (latestLoans?.business.commercialREOwnerOccupied || 0) +
          (latestLoans?.business.commercialREOther || 0) +
          (latestLoans?.business.farmland || 0)
        },
        { name: 'C&I (US)', value: latestLoans?.business.commercialUS || 0 },
        { name: 'C&I (Non-US)', value: latestLoans?.business.commercialNonUS || 0 },
        { name: 'Other Business', value:
          (latestLoans?.business.agricultural || 0) +
          (latestLoans?.business.toDepositoryInst || 0) +
          (latestLoans?.business.businessLeases || 0) +
          (latestLoans?.business.otherLoans || 0)
        }
      ]
    }
  ];

  // Tufte-style chart configuration - minimal decoration
  const tufteOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          boxWidth: 10,
          padding: 12,
          font: { size: 10, family: 'system-ui, -apple-system, sans-serif' },
          usePointStyle: true,
          pointStyle: 'line'
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        padding: 8,
        titleFont: { size: 11 },
        bodyFont: { size: 10 },
        displayColors: false,
        borderColor: '#ccc',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 10 },
          maxRotation: 0
        },
        border: { display: false }
      },
      y: {
        grid: {
          color: '#e8e8e8',
          lineWidth: 0.5,
          drawBorder: false
        },
        ticks: {
          font: { size: 10 },
          padding: 8
        },
        border: { display: false }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  // Asset composition chart data - Tufte-inspired with grouped colors
  // Personal lending: shades of blue (darkest to lightest)
  // Commercial lending: shades of green (darkest to lightest)
  const assetCompositionData = {
    labels,
    datasets: [
      // Personal/Consumer lending (blues - darkest to lightest)
      {
        label: 'Personal: Residential Mortgages',
        data: assetBreakdownData.map(d => (d.residential / 1000).toFixed(0)),
        backgroundColor: 'rgba(13, 71, 161, 0.85)', // Darkest blue
        borderColor: 'rgba(13, 71, 161, 0.3)',
        borderWidth: 0,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 0
      },
      {
        label: 'Personal: Auto Loans',
        data: assetBreakdownData.map(d => (d.auto / 1000).toFixed(0)),
        backgroundColor: 'rgba(25, 118, 210, 0.85)',
        borderColor: 'rgba(25, 118, 210, 0.3)',
        borderWidth: 0,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 0
      },
      {
        label: 'Personal: Credit Cards',
        data: assetBreakdownData.map(d => (d.creditCards / 1000).toFixed(0)),
        backgroundColor: 'rgba(66, 165, 245, 0.85)',
        borderColor: 'rgba(66, 165, 245, 0.3)',
        borderWidth: 0,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 0
      },
      {
        label: 'Personal: Other Consumer',
        data: assetBreakdownData.map(d => (d.otherConsumer / 1000).toFixed(0)),
        backgroundColor: 'rgba(144, 202, 249, 0.85)', // Lightest blue
        borderColor: 'rgba(144, 202, 249, 0.3)',
        borderWidth: 0,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 0
      },
      // Commercial/Business lending (greens - darkest to lightest)
      {
        label: 'Commercial: Real Estate',
        data: assetBreakdownData.map(d => (d.commercialRE / 1000).toFixed(0)),
        backgroundColor: 'rgba(27, 94, 32, 0.85)', // Darkest green
        borderColor: 'rgba(27, 94, 32, 0.3)',
        borderWidth: 0,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 0
      },
      {
        label: 'Commercial: C&I (US)',
        data: assetBreakdownData.map(d => (d.cniUS / 1000).toFixed(0)),
        backgroundColor: 'rgba(56, 142, 60, 0.85)',
        borderColor: 'rgba(56, 142, 60, 0.3)',
        borderWidth: 0,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 0
      },
      {
        label: 'Commercial: C&I (Non-US)',
        data: assetBreakdownData.map(d => (d.cniNonUS / 1000).toFixed(0)),
        backgroundColor: 'rgba(102, 187, 106, 0.85)',
        borderColor: 'rgba(102, 187, 106, 0.3)',
        borderWidth: 0,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 0
      },
      {
        label: 'Commercial: Other Business',
        data: assetBreakdownData.map(d => (d.otherBusiness / 1000).toFixed(0)),
        backgroundColor: 'rgba(165, 214, 167, 0.85)', // Lightest green
        borderColor: 'rgba(165, 214, 167, 0.3)',
        borderWidth: 0,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 0
      }
    ]
  };

  // Net Income trends by year - quarters on x-axis
  const netIncomeTrendsData = {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: years.map((year, index) => ({
      label: year,
      data: [1, 2, 3, 4].map(q => incomeByYear[year]?.[q]?.netIncome || null),
      borderColor: blueShades[index] || blueShades[blueShades.length - 1],
      borderWidth: index === 0 ? 2 : 1.5,
      fill: false,
      tension: 0.2,
      pointRadius: index === 0 ? 3 : 0,
      pointHoverRadius: 4,
      spanGaps: true
    }))
  };

  // Net Interest Income trends by year - quarters on x-axis
  const netInterestIncomeTrendsData = {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: years.map((year, index) => ({
      label: year,
      data: [1, 2, 3, 4].map(q => incomeByYear[year]?.[q]?.netInterestIncome || null),
      borderColor: blueShades[index] || blueShades[blueShades.length - 1],
      borderWidth: index === 0 ? 2 : 1.5,
      fill: false,
      tension: 0.2,
      pointRadius: index === 0 ? 3 : 0,
      pointHoverRadius: 4,
      spanGaps: true
    }))
  };

  // Doughnut chart for current composition - with subcategories
  // Use EXACT same colors as the lending portfolio trends chart
  // Personal/Consumer: blues (darkest to lightest)
  // Commercial/Business: greens (darkest to lightest)
  const personalColors = [
    'rgba(13, 71, 161, 0.85)',   // Residential - darkest blue
    'rgba(25, 118, 210, 0.85)',  // Auto - dark blue
    'rgba(66, 165, 245, 0.85)',  // Credit Cards - medium blue
    'rgba(144, 202, 249, 0.85)'  // Other - lightest blue
  ];
  const commercialColors = [
    'rgba(27, 94, 32, 0.85)',    // CRE - darkest green
    'rgba(56, 142, 60, 0.85)',   // C&I US - dark green
    'rgba(102, 187, 106, 0.85)', // C&I Non-US - medium green
    'rgba(165, 214, 167, 0.85)'  // Other - lightest green
  ];

  const chartData = [];
  const chartLabels = [];
  const chartColors = [];

  loanCategories.forEach((category, catIndex) => {
    const colorPalette = category.name === 'Consumer Lending' ? personalColors : commercialColors;

    category.subcategories.forEach((sub, subIndex) => {
      const pct = (sub.value / latestLoans.totalLoans) * 100;
      if (pct > 0.1) { // Only show if > 0.1%
        chartData.push(pct.toFixed(1));
        chartLabels.push(sub.name);
        chartColors.push(colorPalette[subIndex % colorPalette.length]);
      }
    });
  });

  const loanCompositionChartData = {
    labels: chartLabels,
    datasets: [{
      data: chartData,
      backgroundColor: chartColors,
      borderWidth: 1,
      borderColor: '#fff'
    }]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        padding: 8,
        titleFont: { size: 11 },
        bodyFont: { size: 10 },
        callbacks: {
          label: (context) => {
            const value = parseFloat(context.parsed);
            return `${context.label}: ${value.toFixed(1)}%`;
          }
        }
      }
    },
    cutout: '65%'
  };

  // FTE chart data - Column chart
  const fteChartData = {
    labels,
    datasets: [
      {
        label: 'Full-Time Equivalent Employees',
        data: fteData,
        backgroundColor: 'rgba(2, 136, 209, 0.7)',
        borderColor: '#0288d1',
        borderWidth: 1
      }
    ]
  };

  // Operating Leverage: Use pre-calculated value from database (already calculated with correct quarterly conversion)
  // The database value is calculated in calculateDerivedMetrics.js using:
  // - Quarterly values (YTD converted to quarterly)
  // - PPNR-based formula: (YoY % Change in PPNR) / (YoY % Change in Total Revenue)
  const operatingLeverageRawData = trendsData.map((stmt, index) => {
    // Use the pre-calculated operating leverage from the database
    // This ensures consistency with the backend calculation which properly converts YTD to quarterly
    const value = stmt.ratios?.operatingLeverage;
    return {
      label: labels[index],
      value: value !== null && value !== undefined ? parseFloat(value.toFixed(2)) : null
    };
  });

  // Filter out null values and create separate arrays for labels and data
  const filteredOperatingLeverage = operatingLeverageRawData.filter(d => d.value !== null);
  const operatingLeverageLabels = filteredOperatingLeverage.map(d => d.label);
  const operatingLeverageData = filteredOperatingLeverage.map(d => d.value);

  // Individual ratio charts
  const efficiencyRatioChartData = {
    labels,
    datasets: [{
      label: 'Efficiency Ratio',
      data: efficiencyRatioData,
      borderColor: '#d32f2f',
      borderWidth: 1.5,
      fill: false,
      tension: 0.2,
      pointRadius: 0,
      pointHoverRadius: 4
    }]
  };

  const roeChartData = {
    labels,
    datasets: [{
      label: 'ROE',
      data: roeData,
      borderColor: '#388e3c',
      borderWidth: 1.5,
      fill: false,
      tension: 0.2,
      pointRadius: 0,
      pointHoverRadius: 4
    }]
  };

  const nimChartData = {
    labels,
    datasets: [{
      label: 'NIM',
      data: nimData,
      borderColor: '#d97757',
      borderWidth: 1.5,
      fill: false,
      tension: 0.2,
      pointRadius: 0,
      pointHoverRadius: 4
    }]
  };

  const operatingLeverageChartData = {
    labels: operatingLeverageLabels,  // Use filtered labels
    datasets: [{
      label: 'Operating Leverage',
      data: operatingLeverageData,  // Already filtered
      borderColor: '#f57c00',
      borderWidth: 1.5,
      fill: false,
      tension: 0.2,
      pointRadius: 0,
      pointHoverRadius: 4
    }]
  };

  // Expense breakdown stacked column chart
  // Interest expenses: red shades, Operating expenses: orange shades
  const expenseBreakdownChartData = {
    labels,
    datasets: [
      // Interest-related expenses (red shades)
      {
        label: 'Interest on Deposits',
        data: expenseBreakdownData.map(d => (d.interestOnDeposits / 1000).toFixed(0)),
        backgroundColor: 'rgba(198, 40, 40, 0.8)', // #c62828 - Dark red
        borderColor: '#c62828',
        borderWidth: 1
      },
      {
        label: 'Interest on Borrowings',
        data: expenseBreakdownData.map(d => (d.interestOnBorrowings / 1000).toFixed(0)),
        backgroundColor: 'rgba(211, 47, 47, 0.8)', // #d32f2f - Medium red
        borderColor: '#d32f2f',
        borderWidth: 1
      },
      {
        label: 'Interest on Subordinated Debt',
        data: expenseBreakdownData.map(d => (d.interestOnSubDebt / 1000).toFixed(0)),
        backgroundColor: 'rgba(229, 57, 53, 0.8)', // #e53935 - Light red
        borderColor: '#e53935',
        borderWidth: 1
      },
      // Operating expenses (orange shades)
      {
        label: 'Salaries & Benefits',
        data: expenseBreakdownData.map(d => (d.salariesAndBenefits / 1000).toFixed(0)),
        backgroundColor: 'rgba(230, 81, 0, 0.8)', // #e65100 - Dark orange
        borderColor: '#e65100',
        borderWidth: 1
      },
      {
        label: 'Premises Expense',
        data: expenseBreakdownData.map(d => (d.premisesExpense / 1000).toFixed(0)),
        backgroundColor: 'rgba(245, 124, 0, 0.8)', // #f57c00 - Medium orange
        borderColor: '#f57c00',
        borderWidth: 1
      },
      {
        label: 'Other Operating Expenses',
        data: expenseBreakdownData.map(d => (d.otherNoninterestExpense / 1000).toFixed(0)),
        backgroundColor: 'rgba(255, 152, 0, 0.8)', // #ff9800 - Light orange
        borderColor: '#ff9800',
        borderWidth: 1
      }
    ]
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Time-series analysis of key metrics across {trendsData.length} reporting periods
      </Typography>

      {/* Loan Portfolio Composition - Tufte-inspired */}
      <Paper sx={{ p: 2.5, mb: 2.5, bgcolor: '#fafafa' }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
          Loan Portfolio Composition & Trends
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2, fontSize: '0.75rem' }}>
          Current mix and growth since {labels[0]}
        </Typography>

        <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {/* Doughnut chart */}
          <Box sx={{ width: 180, height: 180, flexShrink: 0 }}>
            <Doughnut data={loanCompositionChartData} options={doughnutOptions} />
          </Box>

          {/* Category details with growth indicators */}
          <Box sx={{ flex: 1 }}>
            {loanCategories.map((category, index) => {
              const growthAbs = Math.abs(category.growth);
              const isGrowing = category.growth > 5;
              const isFlat = Math.abs(category.growth) <= 5;
              const isShrinking = category.growth < -5;

              return (
                <Box key={index} sx={{ mb: index < loanCategories.length - 1 ? 2 : 0 }}>
                  {/* Main category */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          bgcolor: category.color,
                          borderRadius: '2px'
                        }}
                      />
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {category.name}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        ${formatNumber(category.current / 1000)}M
                      </Typography>
                      <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, minWidth: 45, textAlign: 'right' }}>
                        {category.percentage}%
                      </Typography>
                      <Box sx={{ minWidth: 70, textAlign: 'right' }}>
                        {isGrowing && (
                          <Typography sx={{ fontSize: '0.75rem', color: '#2e7d32', fontWeight: 600 }}>
                            ↑ {formatNumber(growthAbs)}%
                          </Typography>
                        )}
                        {isFlat && (
                          <Typography sx={{ fontSize: '0.75rem', color: '#757575', fontWeight: 600 }}>
                            → {formatNumber(growthAbs)}%
                          </Typography>
                        )}
                        {isShrinking && (
                          <Typography sx={{ fontSize: '0.75rem', color: '#d32f2f', fontWeight: 600 }}>
                            ↓ {formatNumber(growthAbs)}%
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Box>
                  {/* Horizontal bar */}
                  <Box
                    sx={{
                      width: `${category.percentage}%`,
                      height: 5,
                      bgcolor: category.color,
                      opacity: 0.8,
                      borderRadius: '2px',
                      mb: 0.8
                    }}
                  />
                  {/* Subcategories */}
                  <Box sx={{ ml: 2.5, mt: 0.5 }}>
                    {category.subcategories.map((sub, subIndex) => (
                      <Box key={subIndex} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                          {sub.name}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                          ${formatNumber(sub.value / 1000)}M
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2, fontSize: '0.7rem', fontStyle: 'italic' }}>
          Growth arrows indicate change over entire period • ↑ Growing (&gt;5%) • → Flat (±5%) • ↓ Declining (&lt;-5%)
        </Typography>
      </Paper>

      {/* Asset Composition */}
      <Paper sx={{ p: 2.5, mb: 2.5, bgcolor: '#fafafa' }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
          Lending Portfolio Trends
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, fontSize: '0.75rem' }}>
          Personal (blue tones) vs Commercial (green tones) lending • Values in millions
        </Typography>
        <Box sx={{ height: 220 }}>
          <Line data={assetCompositionData} options={{
            ...tufteOptions,
            scales: {
              x: {
                ...tufteOptions.scales.x,
                stacked: true
              },
              y: {
                ...tufteOptions.scales.y,
                stacked: true,
                beginAtZero: true
              }
            },
            plugins: {
              ...tufteOptions.plugins,
              legend: {
                display: true,
                position: 'bottom',
                labels: {
                  boxWidth: 12,
                  padding: 8,
                  font: { size: 9 },
                  usePointStyle: true,
                  pointStyle: 'rect',
                  generateLabels: (chart) => {
                    const datasets = chart.data.datasets;
                    return datasets.map((dataset, i) => ({
                      text: dataset.label,
                      fillStyle: dataset.backgroundColor,
                      strokeStyle: dataset.borderColor,
                      lineWidth: 0,
                      hidden: !chart.isDatasetVisible(i),
                      index: i
                    }));
                  }
                }
              }
            }
          }} />
        </Box>
      </Paper>

      {/* Net Income Trends by Year */}
      <Paper sx={{ p: 2.5, mb: 2.5, bgcolor: '#fafafa' }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
          Net Income — Quarterly Comparison by Year
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, fontSize: '0.75rem' }}>
          Values in millions • Most recent year shown in bold
        </Typography>
        <Box sx={{ height: 200 }}>
          <Line data={netIncomeTrendsData} options={tufteOptions} />
        </Box>
      </Paper>

      {/* Net Interest Income Trends by Year */}
      <Paper sx={{ p: 2.5, mb: 2.5, bgcolor: '#fafafa' }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
          Net Interest Income — Quarterly Comparison by Year
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, fontSize: '0.75rem' }}>
          Values in millions • Most recent year shown in bold
        </Typography>
        <Box sx={{ height: 200 }}>
          <Line data={netInterestIncomeTrendsData} options={tufteOptions} />
        </Box>
      </Paper>

      {/* FTE Trend */}
      <Paper sx={{ p: 2.5, mb: 2.5, bgcolor: '#fafafa' }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
          Employee Headcount
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, fontSize: '0.75rem' }}>
          Full-time equivalent employees
        </Typography>
        <Box sx={{ height: 180 }}>
          <Bar data={fteChartData} options={tufteOptions} />
        </Box>
      </Paper>

      {/* Efficiency Ratio */}
      <Paper sx={{ p: 2.5, mb: 2.5, bgcolor: '#fafafa' }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
          Efficiency Ratio
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, fontSize: '0.75rem' }}>
          Noninterest Expense / Revenue • Lower is better • Benchmark: 55-65%
        </Typography>
        <Box sx={{ height: 180 }}>
          <Line data={efficiencyRatioChartData} options={tufteOptions} />
        </Box>
      </Paper>

      {/* ROE */}
      <Paper sx={{ p: 2.5, mb: 2.5, bgcolor: '#fafafa' }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
          Return on Equity (ROE)
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, fontSize: '0.75rem' }}>
          Net Income / Average Equity • Higher is better • Benchmark: &gt;10%
        </Typography>
        <Box sx={{ height: 180 }}>
          <Line data={roeChartData} options={tufteOptions} />
        </Box>
      </Paper>

      {/* NIM */}
      <Paper sx={{ p: 2.5, mb: 2.5, bgcolor: '#fafafa' }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
          Net Interest Margin (NIM)
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, fontSize: '0.75rem' }}>
          Net Interest Income / Earning Assets • Higher is better • Benchmark: 3-4%
        </Typography>
        <Box sx={{ height: 180 }}>
          <Line data={nimChartData} options={tufteOptions} />
        </Box>
      </Paper>

      {/* Operating Leverage */}
      <Paper sx={{ p: 2.5, mb: 2.5, bgcolor: '#fafafa' }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
          Operating Leverage (YoY)
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, fontSize: '0.75rem' }}>
          Operating Leverage = (YoY % Change in PPNR) / (YoY % Change in Total Revenue) • Values > 1 indicate revenue changes amplify operating income growth
        </Typography>
        <Box sx={{ height: 180 }}>
          <Line data={operatingLeverageChartData} options={{
            ...tufteOptions,
            plugins: {
              ...tufteOptions.plugins,
              annotation: {
                annotations: {
                  zeroLine: {
                    type: 'line',
                    yMin: 0,
                    yMax: 0,
                    borderColor: '#666',
                    borderWidth: 2,
                    borderDash: [5, 5]
                  }
                }
              }
            }
          }} />
        </Box>
      </Paper>

      {/* Expense Breakdown */}
      <Paper sx={{ p: 2.5, mb: 2.5, bgcolor: '#fafafa' }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
          Expense Breakdown Over Time
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, fontSize: '0.75rem' }}>
          Interest expenses (red shades) and Operating expenses (orange shades) • In millions
        </Typography>
        <Box sx={{ height: 250 }}>
          <Bar data={expenseBreakdownChartData} options={{
            ...tufteOptions,
            scales: {
              x: {
                ...tufteOptions.scales.x,
                stacked: true
              },
              y: {
                ...tufteOptions.scales.y,
                stacked: true
              }
            }
          }} />
        </Box>
      </Paper>

      {/* Credit Quality Section */}
      {(() => {
        // Check if credit quality data exists
        const hasCreditQuality = trendsData.some(stmt => stmt.creditQuality?.summary);
        if (!hasCreditQuality) return null;

        // Prepare credit quality data
        const creditQualityTrends = trendsData.map(stmt => {
          const cq = stmt.creditQuality;
          const totalLoans = stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.net || 1;

          if (!cq?.summary) return null;

          return {
            pastDue30to89: cq.summary.totalPastDue30to89 || 0,
            pastDue90Plus: cq.summary.totalPastDue90Plus || 0,
            nonaccrual: cq.summary.totalNonaccrual || 0,
            totalNonperforming: cq.summary.totalNonperforming || 0,
            // Calculate ratios
            nplRatio: ((cq.summary.totalNonperforming || 0) / totalLoans * 100),
            pastDueRatio: ((cq.summary.totalPastDueAndNonaccrual || 0) / totalLoans * 100)
          };
        });

        // NPL Ratio trend data
        const nplRatioData = creditQualityTrends.map(d => d?.nplRatio?.toFixed(2) || null);
        const pastDueRatioData = creditQualityTrends.map(d => d?.pastDueRatio?.toFixed(2) || null);

        // Credit quality stacked chart (in millions)
        const creditQualityStackedData = {
          labels,
          datasets: [
            {
              label: 'Past Due 30-89 Days',
              data: creditQualityTrends.map(d => d ? (d.pastDue30to89 / 1000).toFixed(0) : null),
              backgroundColor: 'rgba(255, 193, 7, 0.8)', // Amber
              borderColor: '#ffc107',
              borderWidth: 1
            },
            {
              label: 'Past Due 90+ Days',
              data: creditQualityTrends.map(d => d ? (d.pastDue90Plus / 1000).toFixed(0) : null),
              backgroundColor: 'rgba(255, 152, 0, 0.8)', // Orange
              borderColor: '#ff9800',
              borderWidth: 1
            },
            {
              label: 'Nonaccrual',
              data: creditQualityTrends.map(d => d ? (d.nonaccrual / 1000).toFixed(0) : null),
              backgroundColor: 'rgba(244, 67, 54, 0.8)', // Red
              borderColor: '#f44336',
              borderWidth: 1
            }
          ]
        };

        // NPL ratio line chart
        const nplRatioChartData = {
          labels,
          datasets: [
            {
              label: 'NPL Ratio',
              data: nplRatioData,
              borderColor: '#d32f2f',
              borderWidth: 1.5,
              fill: false,
              tension: 0.2,
              pointRadius: 0,
              pointHoverRadius: 4
            },
            {
              label: 'Total Past Due & Nonaccrual Ratio',
              data: pastDueRatioData,
              borderColor: '#ff9800',
              borderWidth: 1.5,
              fill: false,
              tension: 0.2,
              pointRadius: 0,
              pointHoverRadius: 4,
              borderDash: [5, 5]
            }
          ]
        };

        // Get latest values for summary
        const latestCQ = creditQualityTrends[creditQualityTrends.length - 1];
        const oldestCQ = creditQualityTrends.find(d => d !== null);

        return (
          <>
            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: '1rem' }}>
              Credit Quality Trends
            </Typography>

            {/* NPL Ratio Trend */}
            <Paper sx={{ p: 2.5, mb: 2.5, bgcolor: '#fafafa' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                Asset Quality Ratios
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, fontSize: '0.75rem' }}>
                NPL Ratio = (Nonaccrual + 90+ Days Past Due) / Total Loans • Lower is better • Benchmark: &lt;1%
              </Typography>

              {/* Current metrics summary */}
              {latestCQ && (
                <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
                  <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'white', borderRadius: 1, minWidth: 100 }}>
                    <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: latestCQ.nplRatio < 1 ? '#388e3c' : latestCQ.nplRatio < 2 ? '#ff9800' : '#d32f2f' }}>
                      {latestCQ.nplRatio.toFixed(2)}%
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>NPL Ratio</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'white', borderRadius: 1, minWidth: 100 }}>
                    <Typography sx={{ fontSize: '1.2rem', fontWeight: 700 }}>
                      ${formatNumber(latestCQ.totalNonperforming / 1000)}M
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Nonperforming Loans</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: 'white', borderRadius: 1, minWidth: 100 }}>
                    <Typography sx={{ fontSize: '1.2rem', fontWeight: 700 }}>
                      ${formatNumber(latestCQ.nonaccrual / 1000)}M
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Nonaccrual</Typography>
                  </Box>
                </Box>
              )}

              <Box sx={{ height: 180 }}>
                <Line data={nplRatioChartData} options={tufteOptions} />
              </Box>
            </Paper>

            {/* Past Due & Nonaccrual Breakdown */}
            <Paper sx={{ p: 2.5, bgcolor: '#fafafa' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                Past Due & Nonaccrual Loans
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, fontSize: '0.75rem' }}>
                Breakdown by delinquency status • Values in millions
              </Typography>
              <Box sx={{ height: 220 }}>
                <Bar data={creditQualityStackedData} options={{
                  ...tufteOptions,
                  scales: {
                    x: {
                      ...tufteOptions.scales.x,
                      stacked: true
                    },
                    y: {
                      ...tufteOptions.scales.y,
                      stacked: true
                    }
                  }
                }} />
              </Box>
            </Paper>
          </>
        );
      })()}
    </Box>
  );
}

export default TrendsTab;
