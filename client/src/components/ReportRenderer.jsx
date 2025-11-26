import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Box, Typography, Paper, CircularProgress, Link, Chip } from '@mui/material';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import axios from 'axios';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
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
  ArcElement
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

/**
 * ReportRenderer
 * Renders markdown with embedded chart components
 * Replaces custom <chart:type /> tags with actual Chart.js visualizations
 */
function ReportRenderer({ markdown, trendsData, idrssd }) {
  /**
   * Convert plain URLs to markdown links
   * Matches patterns like: [1] Title - https://url.com
   */
  const convertUrlsToLinks = (text) => {
    // Match source citations with URLs
    const urlPattern = /(\[\d+\]\s+[^\n-]+ - )(https?:\/\/[^\s\n]+)/g;
    return text.replace(urlPattern, (match, prefix, url) => {
      return `${prefix}[${url}](${url})`;
    });
  };

  /**
   * Parse custom tags from markdown (charts, leader profiles, and research checklist)
   */
  const processMarkdownWithCharts = (text) => {
    // Convert escaped newlines to actual newlines (handles JSON-escaped content)
    if (typeof text === 'string') {
      text = text.replace(/\\n/g, '\n');
    }
    
    // First convert plain URLs to markdown links
    text = convertUrlsToLinks(text);

    // Convert {{CHART:type|metric|title}} format to <chart:metric /> format
    // This handles agent-generated reports that use the double-brace format
    text = text.replace(/\{\{CHART:(\w+)\|(\w+)\|([^}]+)\}\}/g, (match, type, metric, title) => {
      // Convert camelCase to kebab-case
      const kebabMetric = metric.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      return `<chart:${kebabMetric} />`;
    });

    const chartTagRegex = /<chart:([\w-]+)\s*\/>/g;
    // Support both single and double quotes, and handle self-closing tags
    // Updated regex to handle empty image attributes (image="") and multiline content
    // Using non-greedy match for bio content to handle multiple leader tags
    const leaderTagRegex = /<leader\s+name=["']([^"']+)["']\s+title=["']([^"']+)["'](?:\s+image=["']([^"']*)["'])?\s*>([\s\S]*?)<\/leader>/g;
    const checklistTagRegex = /<research-checklist>\s*(\{[\s\S]*?\})\s*<\/research-checklist>/;

    const parts = [];
    let lastIndex = 0;

    // Extract research checklist if present
    const checklistMatch = text.match(checklistTagRegex);
    let checklistData = null;
    if (checklistMatch) {
      try {
        // Parse the JSON inside the tag
        checklistData = JSON.parse(checklistMatch[1]);
        // Remove the checklist from the text so we can display it separately
        text = text.replace(checklistTagRegex, '');
      } catch (e) {
        console.error('Failed to parse research checklist JSON:', e);
      }
    }

    // Combine both regex patterns to find all custom tags in order
    const allMatches = [];

    let match;
    while ((match = chartTagRegex.exec(text)) !== null) {
      allMatches.push({
        index: match.index,
        length: match[0].length,
        type: 'chart',
        chartType: match[1]
      });
    }

    // Reset regex lastIndex to ensure we search from the beginning
    leaderTagRegex.lastIndex = 0;
    while ((match = leaderTagRegex.exec(text)) !== null) {
      // Handle empty image attribute - if image is empty string, set to null
      const imageValue = match[3];
      const finalImage = (imageValue === undefined || imageValue === '' || imageValue === null) ? null : imageValue;
      
      allMatches.push({
        index: match.index,
        length: match[0].length,
        type: 'leader',
        name: match[1],
        title: match[2],
        image: finalImage,
        bio: (match[4] || '').trim() // Bio is optional (for self-closing tags), trim whitespace
      });
    }

    // Sort by position in text
    allMatches.sort((a, b) => a.index - b.index);

    // Build parts array
    allMatches.forEach(match => {
      // Add text before this match
      if (match.index > lastIndex) {
        parts.push({
          type: 'markdown',
          content: text.substring(lastIndex, match.index)
        });
      }

      // Add the custom component
      if (match.type === 'chart') {
        parts.push({
          type: 'chart',
          chartType: match.chartType
        });
      } else if (match.type === 'leader') {
        parts.push({
          type: 'leader',
          name: match.name,
          title: match.title,
          image: match.image,
          bio: match.bio
        });
      }

      lastIndex = match.index + match.length;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        type: 'markdown',
        content: text.substring(lastIndex)
      });
    }

    return { parts, checklistData };
  };

  const { parts, checklistData } = processMarkdownWithCharts(markdown);

  return (
    <Box>
      {parts.map((part, index) => {
        if (part.type === 'markdown') {
          return <MarkdownSection key={index} content={part.content} />;
        } else if (part.type === 'chart') {
          return (
            <ChartEmbed
              key={index}
              chartType={part.chartType}
              trendsData={trendsData}
              idrssd={idrssd}
            />
          );
        } else if (part.type === 'leader') {
          return (
            <LeadershipProfile
              key={index}
              name={part.name}
              title={part.title}
              image={part.image}
              bio={part.bio}
            />
          );
        }
        return null;
      })}

      {/* Display research checklist if present */}
      {checklistData && <ResearchChecklist data={checklistData} />}
    </Box>
  );
}

/**
 * MarkdownSection - Renders markdown text with styling and citation support
 */
function MarkdownSection({ content }) {
  // Convert escaped newlines to actual newlines if content is a string
  // This handles JSON-escaped content like "\n\n" -> actual newlines
  if (typeof content === 'string') {
    content = content.replace(/\\n/g, '\n');
  }
  
  // Custom component to render citations as superscripts
  const CitationText = ({ children }) => {
    // If children is not a string or array, return as-is (handles React elements)
    if (typeof children !== 'string' && !Array.isArray(children)) {
      return children;
    }

    // Handle both string and array children
    let text = '';
    if (typeof children === 'string') {
      text = children;
    } else if (Array.isArray(children)) {
      // Extract text from array, but preserve React elements
      // First, check if there are any React elements (non-string, non-null, non-undefined)
      const hasReactElements = children.some(child => 
        child !== null && 
        child !== undefined && 
        typeof child !== 'string' && 
        typeof child !== 'number'
      );
      
      // If there are React elements, we need to process differently
      if (hasReactElements) {
        // Process each child, handling citations in strings but preserving React elements
        return (
          <>
            {children.map((child, idx) => {
              if (typeof child === 'string') {
                // Process citations in string children
                const parts = [];
                let lastIndex = 0;
                const citationRegex = /\[(Call Report: [^\]]+|Source \d+)\]/g;
                let match;

                while ((match = citationRegex.exec(child)) !== null) {
                  if (match.index > lastIndex) {
                    parts.push(child.substring(lastIndex, match.index));
                  }
                  const citation = match[1];
                  const isCallReport = citation.startsWith('Call Report');
                  parts.push(
                    <Box
                      key={`${idx}-${match.index}`}
                      component="sup"
                      sx={{
                        fontSize: '0.7rem',
                        padding: '2px 4px',
                        borderRadius: '3px',
                        backgroundColor: isCallReport ? 'rgba(25, 118, 210, 0.1)' : 'rgba(211, 47, 47, 0.1)',
                        color: isCallReport ? '#d97757' : '#d32f2f',
                        fontWeight: 600,
                        marginLeft: '2px',
                        cursor: 'help'
                      }}
                      title={citation}
                    >
                      [{citation}]
                    </Box>
                  );
                  lastIndex = match.index + match[0].length;
                }
                if (lastIndex < child.length) {
                  parts.push(child.substring(lastIndex));
                }
                return parts.length > 0 ? <React.Fragment key={idx}>{parts}</React.Fragment> : child;
              } else {
                // Preserve React elements as-is
                return <React.Fragment key={idx}>{child}</React.Fragment>;
              }
            })}
          </>
        );
      }
      
      // If no React elements, just extract strings
      text = children.filter(child => typeof child === 'string').join('');
    } else if (children) {
      text = String(children);
    }

    // If no text found or text is '[object Object]', return as-is
    if (!text || text === '[object Object]') {
      return children;
    }

    // Parse inline citations
    const parts = [];
    let lastIndex = 0;
    const citationRegex = /\[(Call Report: [^\]]+|Source \d+)\]/g;
    let match;

    while ((match = citationRegex.exec(text)) !== null) {
      // Add text before citation
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Add citation as superscript
      const citation = match[1];
      const isCallReport = citation.startsWith('Call Report');
      parts.push(
        <Box
          key={match.index}
          component="sup"
          sx={{
            fontSize: '0.7rem',
            padding: '2px 4px',
            borderRadius: '3px',
            backgroundColor: isCallReport ? 'rgba(25, 118, 210, 0.1)' : 'rgba(211, 47, 47, 0.1)',
            color: isCallReport ? '#d97757' : '#d32f2f',
            fontWeight: 600,
            marginLeft: '2px',
            cursor: 'help'
          }}
          title={citation}
        >
          [{citation}]
        </Box>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? <>{parts}</> : text;
  };

  return (
    <Box
      sx={{
        '& h1': { fontSize: '1.5rem', fontWeight: 600, mt: 3, mb: 2 },
        '& h2': { fontSize: '1.25rem', fontWeight: 600, mt: 3, mb: 1.5 },
        '& h3': { fontSize: '1.1rem', fontWeight: 600, mt: 2, mb: 1 },
        '& p': { fontSize: '0.95rem', lineHeight: 1.7, mb: 1.5 },
        '& ul, & ol': { ml: 2, mb: 2 },
        '& li': { fontSize: '0.95rem', lineHeight: 1.6, mb: 0.5 },
        '& code': {
          backgroundColor: '#f5f5f5',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '0.9rem'
        },
        '& pre': {
          backgroundColor: '#f5f5f5',
          padding: 2,
          borderRadius: 1,
          overflow: 'auto',
          mb: 2
        },
        '& blockquote': {
          borderLeft: '4px solid #667eea',
          pl: 2,
          ml: 0,
          fontStyle: 'italic',
          color: 'text.secondary'
        },
        '& table': {
          width: '100%',
          borderCollapse: 'collapse',
          mb: 2,
          fontSize: '0.85rem'
        },
        '& th, & td': {
          border: '1px solid #e0e0e0',
          padding: '8px 12px',
          textAlign: 'left'
        },
        '& th': {
          backgroundColor: '#f5f5f5',
          fontWeight: 600
        }
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => {
            // Handle empty paragraphs (just whitespace/newlines)
            const text = typeof children === 'string' ? children : 
                        Array.isArray(children) ? children.filter(c => typeof c === 'string').join('') : '';
            if (!text || text.trim() === '') return null;
            return <Typography component="p"><CitationText>{children}</CitationText></Typography>;
          },
          ol: ({ children }) => <ol>{children}</ol>,
          ul: ({ children }) => <ul>{children}</ul>,
          li: ({ children }) => <li><CitationText>{children}</CitationText></li>,
          td: ({ children }) => <td><CitationText>{children}</CitationText></td>,
          strong: ({ children }) => <strong>{children}</strong>,
          em: ({ children }) => <em>{children}</em>,
          a: ({ href, children }) => (
            <Link
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: '#667eea',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' }
              }}
            >
              {children}
            </Link>
          )
        }}
      >
        {content || ''}
      </ReactMarkdown>
    </Box>
  );
}

/**
 * ChartEmbed - Embeds actual Chart.js visualizations
 */
function ChartEmbed({ chartType, trendsData, idrssd }) {
  if (!trendsData) {
    return (
      <Paper sx={{ p: 2, my: 3, bgcolor: '#f5f5f5', textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Chart data not available
        </Typography>
      </Paper>
    );
  }

  // Chart component based on type
  const renderChart = () => {
    switch (chartType) {
      case 'asset-composition':
        return <AssetCompositionChart trendsData={trendsData} />;
      case 'loan-portfolio':
        return <LoanPortfolioChart trendsData={trendsData} />;
      case 'loan-mix':
        return <LoanMixChart trendsData={trendsData} />;
      case 'net-income':
        return <NetIncomeChart trendsData={trendsData} />;
      case 'net-income-yoy':
        return <NetIncomeYoYChart trendsData={trendsData} />;
      case 'income-breakdown':
        return <IncomeBreakdownChart trendsData={trendsData} />;
      case 'net-interest-income':
        return <NetInterestIncomeChart trendsData={trendsData} />;
      case 'expense-breakdown':
        return <ExpenseBreakdownChart trendsData={trendsData} />;
      case 'fte-trends':
        return <FTETrendsChart trendsData={trendsData} />;
      case 'efficiency-ratio':
        return <RatioChart trendsData={trendsData} ratioKey="efficiencyRatio" title="Efficiency Ratio (%)" />;
      case 'roe':
        return <RatioChart trendsData={trendsData} ratioKey="roe" title="Return on Equity (%)" />;
      case 'nim':
        return <RatioChart trendsData={trendsData} ratioKey="nim" title="Net Interest Margin (%)" />;
      case 'operating-leverage':
        return <RatioChart trendsData={trendsData} ratioKey="operatingLeverage" title="Operating Leverage (YoY)" />;
      case 'peer-efficiency':
        return <PeerComparisonChart idrssd={idrssd} trendsData={trendsData} metric="efficiencyRatio" title="Efficiency Ratio - Peer Comparison" lowerBetter={true} />;
      case 'peer-roe':
        return <PeerComparisonChart idrssd={idrssd} trendsData={trendsData} metric="roe" title="Return on Equity - Peer Comparison" />;
      case 'peer-nim':
        return <PeerComparisonChart idrssd={idrssd} trendsData={trendsData} metric="nim" title="Net Interest Margin - Peer Comparison" />;
      case 'peer-operating-leverage':
        return <PeerComparisonChart idrssd={idrssd} trendsData={trendsData} metric="operatingLeverage" title="Operating Leverage - Peer Comparison" />;
      default:
        return (
          <Typography variant="body2" color="error">
            Unknown chart type: {chartType}
          </Typography>
        );
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, my: 3, bgcolor: '#fafafa' }}>
      {renderChart()}
    </Paper>
  );
}

// Individual chart components
function AssetCompositionChart({ trendsData }) {
  if (!trendsData || !trendsData.periods || trendsData.periods.length === 0) {
    return <Typography>No asset data available</Typography>;
  }

  // Ensure periods are sorted by date (oldest first) for proper chronological chart ordering
  const sortedPeriods = [...trendsData.periods].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  // Check if assets is an object with breakdowns (not just a number)
  const hasAssetBreakdown = sortedPeriods.some(p =>
    p.assets && typeof p.assets === 'object' &&
    (p.assets.residentialMortgages || p.assets.securities || p.assets.cash)
  );

  if (!hasAssetBreakdown) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}>
        Detailed asset composition breakdown is not available. Please regenerate the report to include asset data.
      </Typography>
    );
  }

  const labels = sortedPeriods.map(p => p.period);

  // Stacked column chart data with major asset categories
  // Consumer loans (blue shades), Business loans (green shades), Non-loan assets
  const chartData = {
    labels,
    datasets: [
      // Consumer loans - blue shades
      {
        label: 'Residential Mortgages',
        data: sortedPeriods.map(p => ((p.assets?.residentialMortgages || 0) / 1000)),
        backgroundColor: 'rgba(25, 118, 210, 0.85)',
        borderColor: '#1976d2',
        borderWidth: 1,
        stack: 'assets'
      },
      {
        label: 'Credit Cards',
        data: sortedPeriods.map(p => ((p.assets?.creditCards || 0) / 1000)),
        backgroundColor: 'rgba(66, 165, 245, 0.85)',
        borderColor: '#42a5f5',
        borderWidth: 1,
        stack: 'assets'
      },
      {
        label: 'Auto Loans',
        data: sortedPeriods.map(p => ((p.assets?.autoLoans || 0) / 1000)),
        backgroundColor: 'rgba(144, 202, 249, 0.85)',
        borderColor: '#90caf9',
        borderWidth: 1,
        stack: 'assets'
      },
      {
        label: 'Other Consumer',
        data: sortedPeriods.map(p => ((p.assets?.otherConsumer || 0) / 1000)),
        backgroundColor: 'rgba(187, 222, 251, 0.85)',
        borderColor: '#bbdefb',
        borderWidth: 1,
        stack: 'assets'
      },
      // Business loans - green shades
      {
        label: 'Commercial Real Estate',
        data: sortedPeriods.map(p => ((p.assets?.commercialRealEstate || 0) / 1000)),
        backgroundColor: 'rgba(56, 142, 60, 0.85)',
        borderColor: '#388e3c',
        borderWidth: 1,
        stack: 'assets'
      },
      {
        label: 'C&I Loans',
        data: sortedPeriods.map(p => ((p.assets?.cAndI || 0) / 1000)),
        backgroundColor: 'rgba(76, 175, 80, 0.85)',
        borderColor: '#4caf50',
        borderWidth: 1,
        stack: 'assets'
      },
      {
        label: 'Other Business',
        data: sortedPeriods.map(p => ((p.assets?.otherBusiness || 0) / 1000)),
        backgroundColor: 'rgba(129, 199, 132, 0.85)',
        borderColor: '#81c784',
        borderWidth: 1,
        stack: 'assets'
      },
      // Non-loan assets
      {
        label: 'Securities',
        data: sortedPeriods.map(p => ((p.assets?.securities || 0) / 1000)),
        backgroundColor: 'rgba(245, 124, 0, 0.85)',
        borderColor: '#f57c00',
        borderWidth: 1,
        stack: 'assets'
      },
      {
        label: 'Cash',
        data: sortedPeriods.map(p => ((p.assets?.cash || 0) / 1000)),
        backgroundColor: 'rgba(123, 31, 162, 0.85)',
        borderColor: '#7b1fa2',
        borderWidth: 1,
        stack: 'assets'
      },
      {
        label: 'Other Assets',
        data: sortedPeriods.map(p => ((p.assets?.other || 0) / 1000)),
        backgroundColor: 'rgba(97, 97, 97, 0.85)',
        borderColor: '#616161',
        borderWidth: 1,
        stack: 'assets'
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          boxWidth: 12,
          padding: 8,
          font: { size: 9 },
          usePointStyle: true,
          pointStyle: 'rect'
        }
      },
      title: {
        display: true,
        text: 'Asset Composition Over Time ($M)',
        font: { size: 14, weight: 600 }
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: $${context.parsed.y.toFixed(0)}M`
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { font: { size: 10 }, maxRotation: 0 },
        border: { display: false }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: '#e8e8e8', lineWidth: 0.5, drawBorder: false },
        ticks: {
          font: { size: 10 },
          padding: 8,
          callback: (value) => `$${value}M`
        },
        border: { display: false }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  return (
    <Box sx={{ height: 300 }}>
      <Bar data={chartData} options={options} />
    </Box>
  );
}

function LoanPortfolioChart({ trendsData }) {
  if (!trendsData || !trendsData.lendingComposition || trendsData.lendingComposition.length === 0) {
    return <Typography>No loan portfolio data available</Typography>;
  }

  const latest = trendsData.lendingComposition[0];
  const loanCategories = latest.categories;

  const chartData = {
    labels: loanCategories.map(c => c.name),
    datasets: [{
      data: loanCategories.map(c => c.percentage),
      backgroundColor: ['#d97757', '#388e3c'],
      borderWidth: 0
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: { font: { size: 11 }, padding: 10 }
      },
      title: {
        display: true,
        text: 'Loan Portfolio Composition',
        font: { size: 14, weight: 600 }
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.parsed}%`
        }
      }
    },
    cutout: '65%'
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, height: 300 }}>
      <Box sx={{ width: 250, height: 250 }}>
        <Doughnut data={chartData} options={options} />
      </Box>
      <Box sx={{ flex: 1 }}>
        {loanCategories.map((category, index) => (
          <Box key={index} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                {category.name}
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                {category.percentage}%
              </Typography>
            </Box>
            {category.subcategories && category.subcategories.map((sub, subIndex) => (
              <Box key={subIndex} sx={{ display: 'flex', justifyContent: 'space-between', ml: 2, mb: 0.3 }}>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                  {sub.name}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                  ${(sub.value / 1000).toFixed(0)}M
                </Typography>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function LoanMixChart({ trendsData }) {
  if (!trendsData || !trendsData.periods || trendsData.periods.length === 0) {
    return <Typography>No loan data available</Typography>;
  }

  const sortedPeriods = [...trendsData.periods].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  // Check if we have detailed loan breakdown
  const hasDetailedBreakdown = sortedPeriods.some(p =>
    p.assets && typeof p.assets === 'object' &&
    (p.assets.residentialMortgages || p.assets.commercialRealEstate || p.assets.cAndI)
  );

  if (!hasDetailedBreakdown) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}>
        Detailed loan portfolio breakdown is not available. Please regenerate the report to include loan mix data.
      </Typography>
    );
  }

  // Build stacked column chart with detailed loan categories
  const chartData = {
    labels: sortedPeriods.map(p => p.period),
    datasets: [
      // Consumer loans - blue shades (darkest to lightest)
      {
        label: 'Residential Mortgages',
        data: sortedPeriods.map(p => ((p.assets?.residentialMortgages || 0) / 1000)),
        backgroundColor: 'rgba(13, 71, 161, 0.85)',
        borderColor: '#0d47a1',
        borderWidth: 1,
        stack: 'loans'
      },
      {
        label: 'Credit Cards',
        data: sortedPeriods.map(p => ((p.assets?.creditCards || 0) / 1000)),
        backgroundColor: 'rgba(25, 118, 210, 0.85)',
        borderColor: '#1976d2',
        borderWidth: 1,
        stack: 'loans'
      },
      {
        label: 'Auto Loans',
        data: sortedPeriods.map(p => ((p.assets?.autoLoans || 0) / 1000)),
        backgroundColor: 'rgba(66, 165, 245, 0.85)',
        borderColor: '#42a5f5',
        borderWidth: 1,
        stack: 'loans'
      },
      {
        label: 'Other Consumer',
        data: sortedPeriods.map(p => ((p.assets?.otherConsumer || 0) / 1000)),
        backgroundColor: 'rgba(144, 202, 249, 0.85)',
        borderColor: '#90caf9',
        borderWidth: 1,
        stack: 'loans'
      },
      // Business loans - green shades (darkest to lightest)
      {
        label: 'Commercial Real Estate',
        data: sortedPeriods.map(p => ((p.assets?.commercialRealEstate || 0) / 1000)),
        backgroundColor: 'rgba(27, 94, 32, 0.85)',
        borderColor: '#1b5e20',
        borderWidth: 1,
        stack: 'loans'
      },
      {
        label: 'C&I Loans',
        data: sortedPeriods.map(p => ((p.assets?.cAndI || 0) / 1000)),
        backgroundColor: 'rgba(56, 142, 60, 0.85)',
        borderColor: '#388e3c',
        borderWidth: 1,
        stack: 'loans'
      },
      {
        label: 'Other Business',
        data: sortedPeriods.map(p => ((p.assets?.otherBusiness || 0) / 1000)),
        backgroundColor: 'rgba(129, 199, 132, 0.85)',
        borderColor: '#81c784',
        borderWidth: 1,
        stack: 'loans'
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          font: { size: 9, weight: '600' },
          padding: 8,
          boxWidth: 12
        }
      },
      title: {
        display: true,
        text: 'Loan Portfolio Composition Over Time ($M)',
        font: { size: 14, weight: 600 }
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: $${context.parsed.y.toFixed(0)}M`,
          footer: (items) => {
            const total = items.reduce((sum, item) => sum + item.parsed.y, 0);
            return `Total Loans: $${total.toFixed(0)}M`;
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { font: { size: 10 } }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: '#e8e8e8', lineWidth: 0.5 },
        ticks: {
          font: { size: 10 },
          callback: (value) => `$${value}M`
        }
      }
    }
  };

  return (
    <Box sx={{ height: 300 }}>
      <Bar data={chartData} options={options} />
    </Box>
  );
}

function NetIncomeChart({ trendsData }) {
  if (!trendsData || !trendsData.periods || trendsData.periods.length === 0) {
    return <Typography>No income data available</Typography>;
  }

  // Ensure periods are sorted by date (oldest first) for proper chronological chart ordering
  const sortedPeriods = [...trendsData.periods].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  // Group by year - expect period format "YYYY Q#" (e.g., "2024 Q2")
  const incomeByYear = {};
  sortedPeriods.forEach(p => {
    if (!p.period || typeof p.period !== 'string') return;
    const parts = p.period.split(' ');
    if (parts.length < 2 || !parts[1]) return;
    const [year, quarter] = parts;
    const q = parseInt(quarter.replace('Q', ''));
    if (isNaN(q) || q < 1 || q > 4) return;
    if (!incomeByYear[year]) incomeByYear[year] = {};
    incomeByYear[year][q] = (p.income?.netIncome / 1000).toFixed(2);
  });

  const years = Object.keys(incomeByYear).sort((a, b) => b - a);

  // Check if we have valid data after parsing
  if (years.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}>
        Net income quarterly comparison data is not available. Please regenerate the report to include this chart.
      </Typography>
    );
  }

  const blueShades = ['#0d47a1', '#d97757', '#42a5f5', '#90caf9', '#bbdefb', '#e3f2fd'];

  const chartData = {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: years.map((year, index) => ({
      label: year,
      data: [1, 2, 3, 4].map(q => incomeByYear[year]?.[q] || null),
      borderColor: blueShades[index] || blueShades[blueShades.length - 1],
      borderWidth: index === 0 ? 2 : 1.5,
      fill: false,
      tension: 0.2,
      pointRadius: index === 0 ? 3 : 0,
      pointHoverRadius: 4,
      spanGaps: true
    }))
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom', labels: { font: { size: 10 }, padding: 10 } },
      title: {
        display: true,
        text: 'Net Income - Quarterly Comparison by Year (Millions $)',
        font: { size: 14, weight: 600 }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { grid: { color: '#e8e8e8', lineWidth: 0.5 }, ticks: { font: { size: 10 } } }
    }
  };

  return (
    <Box sx={{ height: 300 }}>
      <Line data={chartData} options={options} />
    </Box>
  );
}

function NetInterestIncomeChart({ trendsData }) {
  if (!trendsData || !trendsData.periods || trendsData.periods.length === 0) {
    return <Typography>No income data available</Typography>;
  }

  // Ensure periods are sorted by date (oldest first) for proper chronological chart ordering
  const sortedPeriods = [...trendsData.periods].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  // Group by year - expect period format "YYYY Q#" (e.g., "2024 Q2")
  const incomeByYear = {};
  sortedPeriods.forEach(p => {
    if (!p.period || typeof p.period !== 'string') return;
    const parts = p.period.split(' ');
    if (parts.length < 2 || !parts[1]) return;
    const [year, quarter] = parts;
    const q = parseInt(quarter.replace('Q', ''));
    if (isNaN(q) || q < 1 || q > 4) return;
    if (!incomeByYear[year]) incomeByYear[year] = {};
    incomeByYear[year][q] = ((p.income?.netInterestIncome || 0) / 1000).toFixed(2);
  });

  const years = Object.keys(incomeByYear).sort((a, b) => b - a);

  // Check if we have valid data after parsing
  if (years.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}>
        Net interest income quarterly comparison data is not available. Please regenerate the report to include this chart.
      </Typography>
    );
  }

  const blueShades = ['#0d47a1', '#d97757', '#42a5f5', '#90caf9', '#bbdefb', '#e3f2fd'];

  const chartData = {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: years.map((year, index) => ({
      label: year,
      data: [1, 2, 3, 4].map(q => incomeByYear[year]?.[q] || null),
      borderColor: blueShades[index] || blueShades[blueShades.length - 1],
      borderWidth: index === 0 ? 2 : 1.5,
      fill: false,
      tension: 0.2,
      pointRadius: index === 0 ? 3 : 0,
      pointHoverRadius: 4,
      spanGaps: true
    }))
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom', labels: { font: { size: 10 }, padding: 10 } },
      title: {
        display: true,
        text: 'Net Interest Income - Quarterly Comparison by Year (Millions $)',
        font: { size: 14, weight: 600 }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { grid: { color: '#e8e8e8', lineWidth: 0.5 }, ticks: { font: { size: 10 } } }
    }
  };

  return (
    <Box sx={{ height: 300 }}>
      <Line data={chartData} options={options} />
    </Box>
  );
}

function RatioChart({ trendsData, ratioKey, title }) {
  if (!trendsData.periods || trendsData.periods.length === 0) {
    return <Typography>No ratio data available</Typography>;
  }

  // Ensure periods are sorted by date (oldest first) for proper chronological chart ordering
  const sortedPeriods = [...trendsData.periods].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  // Filter out null values for operating leverage
  const filteredData = sortedPeriods
    .map((p, idx) => ({
      label: p.period,
      value: p.ratios?.[ratioKey] ?? null,
      peerAvg: p.peerAnalysis?.peerAverages?.[ratioKey] ?? null,
      originalIndex: idx
    }))
    .filter(d => d.value !== null);

  if (filteredData.length === 0) {
    return <Typography>No {title} data available</Typography>;
  }

  const labels = filteredData.map(d => d.label);
  const bankData = filteredData.map(d => d.value);
  const peerData = filteredData.map(d => d.peerAvg);
  const hasPeerData = peerData.some(v => v !== null);

  // Calculate min/max for better Y-axis scaling
  const allValues = [...bankData, ...peerData.filter(v => v !== null)];
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const range = maxValue - minValue;
  const padding = range * 0.15; // 15% padding above and below

  const datasets = [
    {
      label: 'This Bank',
      data: bankData,
      borderColor: '#d97757',
      backgroundColor: 'rgba(217, 119, 87, 0.1)',
      borderWidth: 3,
      fill: true,
      tension: 0.3,
      pointRadius: 4,
      pointBackgroundColor: '#d97757',
      pointBorderWidth: 2,
      pointHoverRadius: 6
    }
  ];

  // Add peer average line if data exists
  if (hasPeerData) {
    datasets.push({
      label: 'Peer Average',
      data: peerData,
      borderColor: '#666',
      backgroundColor: 'rgba(102, 102, 102, 0.05)',
      borderWidth: 2,
      borderDash: [5, 5],
      fill: false,
      tension: 0.3,
      pointRadius: 3,
      pointBackgroundColor: '#666'
    });
  }

  const chartData = {
    labels,
    datasets
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: hasPeerData,
        position: 'bottom',
        labels: { font: { size: 10, weight: '600' }, padding: 10 }
      },
      title: {
        display: true,
        text: title,
        font: { size: 14, weight: 600 }
      }
    },
    scales: {
      y: {
        // Don't force zero - scale to data range for better visualization
        min: ratioKey === 'operatingLeverage' ? undefined : Math.max(0, minValue - padding),
        max: maxValue + padding,
        grid: { color: '#e8e8e8', lineWidth: 0.5 },
        ticks: { font: { size: 10 } }
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 } }
      }
    }
  };

  return (
    <Box sx={{ height: 300 }}>
      <Line data={chartData} options={options} />
    </Box>
  );
}

/**
 * LeadershipProfile - Displays executive profile with optional headshot
 */
function LeadershipProfile({ name, title, image, bio }) {
  return (
    <Paper
      sx={{
        my: 2,
        p: 2.5,
        display: 'flex',
        gap: 2.5,
        backgroundColor: '#fafafa',
        border: '1px solid #e0e0e0',
        borderRadius: 2,
        '&:hover': {
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          transition: 'box-shadow 0.2s'
        }
      }}
    >
      {/* Headshot */}
      {image && image.trim() !== '' && (
        <Box
          sx={{
            flexShrink: 0,
            width: 100,
            height: 100,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '3px solid #667eea',
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.2)'
          }}
        >
          <img
            src={image}
            alt={`${name} headshot`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
            onError={(e) => {
              // Hide image if it fails to load
              e.target.style.display = 'none';
            }}
          />
        </Box>
      )}

      {/* Profile Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Name and Title */}
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            fontSize: '1.1rem',
            color: '#333',
            mb: 0.5
          }}
        >
          {name}
        </Typography>
        <Typography
          variant="subtitle2"
          sx={{
            color: '#667eea',
            fontWeight: 500,
            fontSize: '0.9rem',
            mb: 1.5
          }}
        >
          {title}
        </Typography>

        {/* Bio with citation support */}
        <Typography
          variant="body2"
          sx={{
            fontSize: '0.9rem',
            lineHeight: 1.6,
            color: '#555'
          }}
        >
          {/* Parse citations in bio text */}
          {bio.split(/(\[(?:Call Report: [^\]]+|Source \d+)\])/).map((part, i) => {
            const citationMatch = part.match(/\[(Call Report: [^\]]+|Source \d+)\]/);
            if (citationMatch) {
              const citation = citationMatch[1];
              const isCallReport = citation.startsWith('Call Report');
              return (
                <Box
                  key={i}
                  component="sup"
                  sx={{
                    fontSize: '0.7rem',
                    padding: '2px 4px',
                    borderRadius: '3px',
                    backgroundColor: isCallReport ? 'rgba(25, 118, 210, 0.1)' : 'rgba(211, 47, 47, 0.1)',
                    color: isCallReport ? '#d97757' : '#d32f2f',
                    fontWeight: 600,
                    marginLeft: '2px',
                    cursor: 'help'
                  }}
                  title={citation}
                >
                  [{citation}]
                </Box>
              );
            }
            return part;
          })}
        </Typography>
      </Box>
    </Paper>
  );
}

// New chart components for income/expense analysis
function NetIncomeYoYChart({ trendsData }) {
  if (!trendsData || !trendsData.periods || trendsData.periods.length === 0) {
    return <Typography>No income data available</Typography>;
  }

  // Ensure periods are sorted by date (oldest first) for proper chronological chart ordering
  const sortedPeriods = [...trendsData.periods].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  // Group by year - expect period format "YYYY Q#" (e.g., "2024 Q2")
  const incomeByYear = {};
  sortedPeriods.forEach(p => {
    if (!p.period || typeof p.period !== 'string') return;
    const parts = p.period.split(' ');
    if (parts.length < 2 || !parts[1]) return;
    const [year, quarter] = parts;
    const q = parseInt(quarter.replace('Q', ''));
    if (isNaN(q) || q < 1 || q > 4) return;
    if (!incomeByYear[year]) incomeByYear[year] = {};
    incomeByYear[year][q] = ((p.income?.netIncome || 0) / 1000).toFixed(2);
  });

  const years = Object.keys(incomeByYear).sort((a, b) => b - a);

  // Check if we have valid data after parsing
  if (years.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}>
        Net income year-over-year comparison data is not available. Please regenerate the report to include this chart.
      </Typography>
    );
  }

  const blueShades = ['#0d47a1', '#d97757', '#42a5f5', '#90caf9', '#bbdefb', '#e3f2fd'];

  const chartData = {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: years.map((year, index) => ({
      label: year,
      data: [1, 2, 3, 4].map(q => incomeByYear[year]?.[q] || null),
      borderColor: blueShades[index] || blueShades[blueShades.length - 1],
      borderWidth: index === 0 ? 2 : 1.5,
      fill: false,
      tension: 0.2,
      pointRadius: index === 0 ? 3 : 0,
      pointHoverRadius: 4,
      spanGaps: true
    }))
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom', labels: { font: { size: 10 }, padding: 10 } },
      title: {
        display: true,
        text: 'Net Income - Quarterly Comparison by Year (Millions $)',
        font: { size: 14, weight: 600 }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { grid: { color: '#e8e8e8', lineWidth: 0.5 }, ticks: { font: { size: 10 } } }
    }
  };

  return (
    <Box sx={{ height: 300 }}>
      <Line data={chartData} options={options} />
    </Box>
  );
}

function IncomeBreakdownChart({ trendsData }) {
  if (!trendsData || !trendsData.periods || trendsData.periods.length === 0) {
    return <Typography>No income data available</Typography>;
  }

  // Ensure periods are sorted by date (oldest first) for proper chronological chart ordering
  const sortedPeriods = [...trendsData.periods].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  const labels = sortedPeriods.map(p => p.period);

  // Check if we have actual income data
  const hasIncomeData = sortedPeriods.some(p =>
    (p.income?.interestIncome && p.income.interestIncome > 0) ||
    (p.income?.noninterestIncome && p.income.noninterestIncome > 0)
  );

  if (!hasIncomeData) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}>
        Revenue breakdown data is not available for this bank.
      </Typography>
    );
  }

  const data = {
    labels,
    datasets: [
      {
        label: 'Interest Income',
        data: sortedPeriods.map(p => ((p.income?.interestIncome || 0) / 1000)),
        backgroundColor: 'rgba(217, 119, 87, 0.85)',
        borderColor: '#d97757',
        borderWidth: 1,
        stack: 'revenue'
      },
      {
        label: 'Non-Interest Income',
        data: sortedPeriods.map(p => ((p.income?.noninterestIncome || 0) / 1000)),
        backgroundColor: 'rgba(56, 142, 60, 0.85)',
        borderColor: '#388e3c',
        borderWidth: 1,
        stack: 'revenue'
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: { display: true, text: 'Revenue Composition Over Time ($M)', font: { size: 14, weight: 600 } },
      legend: { position: 'bottom', labels: { font: { size: 10, weight: '600' }, padding: 10 } },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: $${context.parsed.y.toFixed(0)}M`,
          footer: (items) => {
            const total = items.reduce((sum, item) => sum + item.parsed.y, 0);
            return `Total Revenue: $${total.toFixed(0)}M`;
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { font: { size: 10 } }
      },
      y: {
        stacked: true,
        grid: { color: '#e8e8e8', lineWidth: 0.5 },
        ticks: {
          font: { size: 10 },
          callback: (value) => `$${value}M`
        }
      }
    }
  };

  return (
    <Box sx={{ height: 300 }}>
      <Bar data={data} options={options} />
    </Box>
  );
}

function ExpenseBreakdownChart({ trendsData }) {
  if (!trendsData || !trendsData.periods || trendsData.periods.length === 0) {
    return <Typography>No expense data available</Typography>;
  }

  // Ensure periods are sorted by date (oldest first) for proper chronological chart ordering
  const sortedPeriods = [...trendsData.periods].sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  );

  // Check if any period has expenses data with actual values
  const hasExpenses = sortedPeriods.some(p =>
    p.expenses && (
      (p.expenses.salariesAndBenefits && p.expenses.salariesAndBenefits > 0) ||
      (p.expenses.occupancy && p.expenses.occupancy > 0) ||
      (p.expenses.other && p.expenses.other > 0)
    )
  );

  if (!hasExpenses) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}>
        Detailed expense breakdown (salaries, occupancy) is not available in the Call Reports for this bank.
        Total noninterest expense data is available in other sections of the report.
      </Typography>
    );
  }

  const labels = sortedPeriods.map(p => p.period);

  const data = {
    labels,
    datasets: [
      {
        label: 'Salaries & Benefits',
        data: sortedPeriods.map(p => p.expenses?.salariesAndBenefits ? (p.expenses.salariesAndBenefits / 1000).toFixed(0) : 0),
        backgroundColor: 'rgba(2, 136, 209, 0.7)',
        borderColor: '#0288d1',
        borderWidth: 1
      },
      {
        label: 'Occupancy',
        data: sortedPeriods.map(p => p.expenses?.occupancy ? (p.expenses.occupancy / 1000).toFixed(0) : 0),
        backgroundColor: 'rgba(56, 142, 60, 0.7)',
        borderColor: '#388e3c',
        borderWidth: 1
      },
      {
        label: 'Other Expenses',
        data: sortedPeriods.map(p => p.expenses?.other ? (p.expenses.other / 1000).toFixed(0) : 0),
        backgroundColor: 'rgba(211, 47, 47, 0.7)',
        borderColor: '#d32f2f',
        borderWidth: 1
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Operating Expenses Breakdown ($M)',
        font: { size: 14, weight: 600 }
      },
      legend: {
        position: 'bottom',
        labels: { font: { size: 10 }, padding: 10 }
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { font: { size: 10 } }
      },
      y: {
        stacked: true,
        grid: { color: '#e8e8e8', lineWidth: 0.5 },
        ticks: { font: { size: 10 } }
      }
    }
  };

  return (
    <Box sx={{ height: 300 }}>
      <Bar data={data} options={options} />
    </Box>
  );
}

function FTETrendsChart({ trendsData }) {
  if (!trendsData || !trendsData.periods || trendsData.periods.length === 0) {
    return <Typography>No FTE data available</Typography>;
  }

  // Ensure periods are sorted by date (oldest first) for proper chronological chart ordering
  const sortedPeriods = [...trendsData.periods].sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  );
  
  const labels = sortedPeriods.map(p => p.period);
  const fteData = sortedPeriods.map(p => p.fte || 0);

  // Check if we have any actual FTE data
  const hasData = fteData.some(value => value > 0);
  if (!hasData) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}>
        FTE (Full-Time Equivalent) employee data is not available in the Call Reports for this bank.
      </Typography>
    );
  }

  const data = {
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

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Full-Time Equivalent Employees',
        font: { size: 14, weight: 600 }
      },
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 10 } }
      },
      y: {
        grid: { color: '#e8e8e8', lineWidth: 0.5 },
        ticks: { font: { size: 10 } }
      }
    }
  };

  return (
    <Box sx={{ height: 300 }}>
      <Bar data={data} options={options} />
    </Box>
  );
}

// Peer Comparison Chart Component
function PeerComparisonChart({ idrssd, trendsData, metric, title, lowerBetter = false }) {
  const [peerData, setPeerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPeerData = async () => {
      if (!trendsData || !trendsData.periods || trendsData.periods.length === 0) {
        setError('No trends data available');
        setLoading(false);
        return;
      }

      try {
        // Get the latest period from trends data
        const latestPeriod = trendsData.periods[trendsData.periods.length - 1].date;
        const response = await axios.get(`/api/banks/${idrssd}/peer-banks?period=${latestPeriod}`);
        setPeerData(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching peer data:', err);
        setError('Failed to load peer comparison data');
        setLoading(false);
      }
    };

    fetchPeerData();
  }, [idrssd, trendsData, metric]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !peerData || !peerData.banks || peerData.banks.length === 0) {
    return <Typography color="error">{error || 'No peer data available'}</Typography>;
  }

  // Prepare chart data
  // Sort: best performers on RIGHT, worst on LEFT
  // For lowerBetter metrics (efficiency ratio), lower is better (best on right)
  // For higherBetter metrics (ROE, NIM, etc), higher is better (best on right)
  const sortedBanks = [...peerData.banks]
    .filter(b => b[metric] !== null && b[metric] !== undefined && !isNaN(b[metric]))
    .sort((a, b) => lowerBetter ? b[metric] - a[metric] : a[metric] - b[metric]); // Reverse sort for best-on-right

  const labels = sortedBanks.map(b => {
    // Truncate long names
    const name = b.name.length > 20 ? b.name.substring(0, 20) + '...' : b.name;
    return b.idrssd === idrssd ? `★ ${name}` : name;
  });

  const data = {
    labels,
    datasets: [
      {
        label: title.split('-')[0].trim(),
        data: sortedBanks.map(b => b[metric]),
        backgroundColor: sortedBanks.map(b =>
          b.idrssd === idrssd ? '#d97757' : '#90caf9'
        ),
        borderColor: sortedBanks.map(b =>
          b.idrssd === idrssd ? '#1565c0' : '#64b5f6'
        ),
        borderWidth: 1
      }
    ]
  };

  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: title,
        font: { size: 14, weight: 600 }
      },
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const bank = sortedBanks[context.dataIndex];
            return `${bank.name}: ${bank[metric].toFixed(2)}%`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: true, color: '#e8e8e8' },
        ticks: { font: { size: 10 } }
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 9 } }
      }
    }
  };

  return (
    <Box sx={{ height: Math.max(400, sortedBanks.length * 20) }}>
      <Bar data={data} options={options} />
    </Box>
  );
}

/**
 * ResearchChecklist - Displays the research source checklist
 * Shows which priority sources were found during the research process
 */
function ResearchChecklist({ data }) {
  const checklistItems = [
    {
      key: 'investorPresentation',
      label: 'Recent Investor Presentation (Last 12 Months)',
      icon: '📊'
    },
    {
      key: 'earningsCallTranscript',
      label: 'Earnings Call Transcript',
      icon: '📞'
    },
    {
      key: 'executiveInterviews',
      label: 'Business Interviews with C-Suite Executives',
      icon: '💼'
    },
    {
      key: 'recentNews',
      label: 'Major News Stories (Last 3 Months)',
      icon: '📰'
    },
    {
      key: 'aiProjects',
      label: 'Evidence of AI Projects or Partnerships',
      icon: '🤖'
    }
  ];

  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        my: 4,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        borderRadius: 2
      }}
    >
      <Typography
        variant="h5"
        sx={{
          fontWeight: 600,
          mb: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        🔍 Research Source Checklist
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {checklistItems.map((item) => {
          const itemData = data[item.key];
          const found = itemData?.found || false;

          return (
            <Paper
              key={item.key}
              elevation={2}
              sx={{
                p: 2.5,
                backgroundColor: 'white',
                borderRadius: 2,
                border: found ? '2px solid #4caf50' : '2px solid #f44336'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                {/* Icon and status */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
                  <Box sx={{ fontSize: '2rem', mb: 0.5 }}>
                    {item.icon}
                  </Box>
                  {found ? (
                    <Chip
                      icon={<CheckCircleIcon />}
                      label="Found"
                      size="small"
                      sx={{
                        backgroundColor: '#4caf50',
                        color: 'white',
                        fontWeight: 600
                      }}
                    />
                  ) : (
                    <Chip
                      icon={<CancelIcon />}
                      label="Not Found"
                      size="small"
                      sx={{
                        backgroundColor: '#f44336',
                        color: 'white',
                        fontWeight: 600
                      }}
                    />
                  )}
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 600,
                      color: '#333',
                      mb: 1
                    }}
                  >
                    {item.label}
                  </Typography>

                  {/* Details based on item type */}
                  {found && (
                    <Box sx={{ mb: 1 }}>
                      {/* Investor Presentation */}
                      {item.key === 'investorPresentation' && itemData.date && (
                        <Typography variant="body2" sx={{ color: '#555', mb: 0.5 }}>
                          <strong>Date:</strong> {itemData.date}
                        </Typography>
                      )}

                      {/* Earnings Call */}
                      {item.key === 'earningsCallTranscript' && itemData.quarter && (
                        <Typography variant="body2" sx={{ color: '#555', mb: 0.5 }}>
                          <strong>Quarter:</strong> {itemData.quarter}
                        </Typography>
                      )}

                      {/* Executive Interviews */}
                      {item.key === 'executiveInterviews' && itemData.count > 0 && (
                        <>
                          <Typography variant="body2" sx={{ color: '#555', mb: 0.5 }}>
                            <strong>Found:</strong> {itemData.count} interview{itemData.count !== 1 ? 's' : ''}
                          </Typography>
                          {itemData.examples && itemData.examples.length > 0 && (
                            <Box sx={{ ml: 2, mt: 0.5 }}>
                              {itemData.examples.slice(0, 3).map((example, idx) => (
                                <Typography key={idx} variant="body2" sx={{ color: '#666', fontSize: '0.85rem' }}>
                                  • {example}
                                </Typography>
                              ))}
                            </Box>
                          )}
                        </>
                      )}

                      {/* Recent News */}
                      {item.key === 'recentNews' && itemData.count > 0 && (
                        <>
                          <Typography variant="body2" sx={{ color: '#555', mb: 0.5 }}>
                            <strong>Stories Found:</strong> {itemData.count}
                          </Typography>
                          {itemData.majorStories && itemData.majorStories.length > 0 && (
                            <Box sx={{ ml: 2, mt: 0.5 }}>
                              {itemData.majorStories.slice(0, 3).map((story, idx) => (
                                <Typography key={idx} variant="body2" sx={{ color: '#666', fontSize: '0.85rem' }}>
                                  • {story}
                                </Typography>
                              ))}
                            </Box>
                          )}
                        </>
                      )}

                      {/* AI Projects */}
                      {item.key === 'aiProjects' && itemData.initiatives && itemData.initiatives.length > 0 && (
                        <Box sx={{ ml: 2, mt: 0.5 }}>
                          {itemData.initiatives.slice(0, 3).map((initiative, idx) => (
                            <Typography key={idx} variant="body2" sx={{ color: '#666', fontSize: '0.85rem' }}>
                              • {initiative}
                            </Typography>
                          ))}
                        </Box>
                      )}

                      {/* Source URL/Description */}
                      {itemData.source && (
                        <Typography variant="body2" sx={{ color: '#555', fontSize: '0.85rem', mt: 0.5 }}>
                          <strong>Source:</strong> {itemData.source}
                        </Typography>
                      )}
                    </Box>
                  )}

                  {/* Notes */}
                  {itemData?.notes && (
                    <Typography
                      variant="body2"
                      sx={{
                        color: '#666',
                        fontStyle: 'italic',
                        fontSize: '0.9rem',
                        mt: 1,
                        p: 1.5,
                        backgroundColor: '#f5f5f5',
                        borderRadius: 1,
                        borderLeft: found ? '3px solid #4caf50' : '3px solid #f44336'
                      }}
                    >
                      {itemData.notes}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Paper>
          );
        })}
      </Box>

      <Box
        sx={{
          mt: 3,
          pt: 2,
          borderTop: '1px solid rgba(255, 255, 255, 0.3)'
        }}
      >
        <Typography variant="body2" sx={{ fontSize: '0.85rem', opacity: 0.9 }}>
          This checklist shows which priority research sources were successfully found during the AI-powered research process.
          These sources provide the deepest insights into the bank's strategy, performance, and future direction.
        </Typography>
      </Box>
    </Paper>
  );
}

export default ReportRenderer;
