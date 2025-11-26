import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, IconButton, LinearProgress } from '@mui/material';
import { ChevronLeft, ChevronRight, Download, Fullscreen, Minimize2 } from 'lucide-react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import axios from 'axios';
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
 * PresentationRenderer
 *
 * Renders McKinsey-style presentations with embedded React Chart.js visualizations.
 * Uses the same chart components as ReportRenderer for consistency.
 */
function PresentationRenderer({ presentationData, bankName, bankLogo, bankLogoSymbol }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { title, subtitle, slides, trendsData, idrssd } = presentationData;
  const totalSlides = slides.length;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentSlide, isFullscreen]);

  const nextSlide = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleDownloadPDF = () => {
    // TODO: Implement PDF export
    alert('PDF export coming soon');
  };

  const slide = slides[currentSlide];

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: '#f5f5f5',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: isFullscreen ? 9999 : 'auto'
      }}
    >
      {/* Header - Hidden in fullscreen */}
      {!isFullscreen && (
        <Box
          sx={{
            bgcolor: 'white',
            borderBottom: '1px solid #e0e0e0',
            px: 3,
            py: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {bankLogo && (
              <img src={bankLogo} alt={bankName} style={{ height: 32, objectFit: 'contain' }} />
            )}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={handleDownloadPDF} size="small" title="Download PDF">
              <Download size={20} />
            </IconButton>
            <IconButton onClick={toggleFullscreen} size="small" title="Fullscreen">
              <Fullscreen size={20} />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* Slide Content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: isFullscreen ? 2 : 2,
          position: 'relative'
        }}
      >
        <SlideContent
          slide={slide}
          trendsData={trendsData}
          isFullscreen={isFullscreen}
          bankLogo={bankLogo}
          bankLogoSymbol={bankLogoSymbol}
          slideIndex={currentSlide}
          idrssd={idrssd}
        />

        {/* Navigation Arrows */}
        <IconButton
          onClick={prevSlide}
          disabled={currentSlide === 0}
          sx={{
            position: 'absolute',
            left: 20,
            top: '50%',
            transform: 'translateY(-50%)',
            bgcolor: 'white',
            boxShadow: 2,
            '&:hover': { bgcolor: 'white' },
            '&:disabled': { opacity: 0.3 }
          }}
        >
          <ChevronLeft size={24} />
        </IconButton>

        <IconButton
          onClick={nextSlide}
          disabled={currentSlide === totalSlides - 1}
          sx={{
            position: 'absolute',
            right: 20,
            top: '50%',
            transform: 'translateY(-50%)',
            bgcolor: 'white',
            boxShadow: 2,
            '&:hover': { bgcolor: 'white' },
            '&:disabled': { opacity: 0.3 }
          }}
        >
          <ChevronRight size={24} />
        </IconButton>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          bgcolor: 'white',
          borderTop: '1px solid #e0e0e0',
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ flex: 1 }}>
          <LinearProgress
            variant="determinate"
            value={(currentSlide / (totalSlides - 1)) * 100}
            sx={{
              height: 4,
              borderRadius: 2,
              bgcolor: '#e0e0e0',
              '& .MuiLinearProgress-bar': { bgcolor: '#D97757' }
            }}
          />
        </Box>

        <Box sx={{ ml: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80, textAlign: 'right' }}>
            Slide {currentSlide + 1} of {totalSlides}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={prevSlide}
              disabled={currentSlide === 0}
              size="small"
              startIcon={<ChevronLeft size={16} />}
            >
              Previous
            </Button>
            <Button
              onClick={nextSlide}
              disabled={currentSlide === totalSlides - 1}
              size="small"
              endIcon={<ChevronRight size={16} />}
              variant="contained"
              sx={{ bgcolor: '#D97757', '&:hover': { bgcolor: '#c26648' } }}
            >
              Next
            </Button>
          </Box>

          {isFullscreen && (
            <IconButton onClick={() => setIsFullscreen(false)} size="small" title="Exit Fullscreen">
              <Minimize2 size={20} />
            </IconButton>
          )}
        </Box>
      </Box>
    </Box>
  );
}

/**
 * SlideContent - Renders individual slide with title, bullets, and chart
 */
function SlideContent({ slide, trendsData, isFullscreen, bankLogo, bankLogoSymbol, slideIndex, idrssd }) {
  const { type, title, subtitle, bullets, keyMetric, chartType } = slide;

  // Bigger dimensions for more screen real estate
  const slideWidth = isFullscreen ? '98vw' : '96vw';
  const slideHeight = isFullscreen ? '92vh' : '88vh';

  // Title slide
  if (type === 'title') {
    return (
      <Box
        sx={{
          width: slideWidth,
          height: slideHeight,
          bgcolor: 'white',
          borderRadius: 2,
          boxShadow: 4,
          p: 6,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative'
        }}
      >
        {/* Bank logo centered */}
        {bankLogo && (
          <Box sx={{ mb: 4 }}>
            <img
              src={bankLogo}
              alt="Bank Logo"
              style={{ height: 80, maxWidth: 300, objectFit: 'contain' }}
            />
          </Box>
        )}

        <Typography
          variant="h2"
          sx={{
            fontWeight: 700,
            fontSize: '3.5rem',
            mb: 3,
            color: '#1A1A1A',
            lineHeight: 1.2
          }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="h5" sx={{ color: '#666', fontWeight: 400, fontSize: '1.5rem' }}>
            {subtitle}
          </Typography>
        )}
        <Box
          sx={{
            width: 80,
            height: 5,
            bgcolor: '#D97757',
            mt: 4,
            borderRadius: 2
          }}
        />
      </Box>
    );
  }

  // Summary slide
  if (type === 'summary') {
    return (
      <Box
        sx={{
          width: slideWidth,
          height: slideHeight,
          bgcolor: 'white',
          borderRadius: 2,
          boxShadow: 4,
          p: 5,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        {/* Logo symbol in upper right */}
        {bankLogoSymbol && (
          <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
            <img
              src={bankLogoSymbol}
              alt="Bank Logo"
              style={{ height: 32, maxWidth: 120, objectFit: 'contain' }}
            />
          </Box>
        )}

        <Typography
          variant="h3"
          sx={{
            fontWeight: 700,
            mb: 2,
            color: '#1A1A1A',
            pb: 2,
            borderBottom: '4px solid #D97757',
            fontSize: '2.5rem'
          }}
        >
          {title}
        </Typography>

        <Box sx={{ mt: 4, flex: 1, display: 'flex', flexDirection: 'column', gap: 3.5 }}>
          {bullets.map((bullet, idx) => (
            <Box key={idx} sx={{ display: 'flex', gap: 2.5 }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  bgcolor: '#D97757',
                  borderRadius: '50%',
                  mt: 1,
                  flexShrink: 0
                }}
              />
              <Typography variant="h6" sx={{ fontSize: '1.3rem', lineHeight: 1.6, color: '#333' }}>
                {bullet}
              </Typography>
            </Box>
          ))}
        </Box>

        <Typography
          variant="caption"
          sx={{
            textAlign: 'right',
            color: '#999',
            mt: 4,
            fontSize: '0.85rem'
          }}
        >
          Powered by Claude
        </Typography>
      </Box>
    );
  }

  // Executive summary slide - clean 3-section layout
  if (type === 'executive-summary') {
    const { headline, about, keyInsights, whyMeet, chartType } = slide;

    return (
      <Box
        sx={{
          width: slideWidth,
          height: slideHeight,
          bgcolor: 'white',
          borderRadius: 2,
          boxShadow: 4,
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Logo symbol in upper right */}
        {bankLogoSymbol && (
          <Box sx={{ position: 'absolute', top: 20, right: 20, zIndex: 10 }}>
            <img
              src={bankLogoSymbol}
              alt="Bank Logo"
              style={{ height: 40, maxWidth: 120, objectFit: 'contain' }}
            />
          </Box>
        )}

        {/* Punchy headline - THE bottom line */}
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 700,
              color: '#1A1A1A',
              fontSize: '2.2rem',
              lineHeight: 1.2,
              maxWidth: '80%'
            }}
          >
            {headline || 'Executive Summary'}
          </Typography>
          <Box sx={{ width: 60, height: 4, bgcolor: '#D97757', mt: 2, borderRadius: 2 }} />
        </Box>

        {/* Main content: 2-column layout (left: info, right: chart) */}
        <Box sx={{ display: 'flex', gap: 4, flex: 1, minHeight: 0 }}>
          {/* Left column: About, Key Insights, Why Meet */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* About section */}
            {about && (
              <Box>
                <Typography
                  sx={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#D97757',
                    mb: 1,
                    textTransform: 'uppercase',
                    letterSpacing: 1
                  }}
                >
                  About
                </Typography>
                <Typography
                  sx={{
                    fontSize: '1.1rem',
                    color: '#333',
                    lineHeight: 1.5,
                    fontWeight: 500
                  }}
                >
                  {typeof about === 'string' ? about : (about.size || '')}
                </Typography>
              </Box>
            )}

            {/* Key Insights section */}
            {keyInsights && keyInsights.length > 0 && (
              <Box>
                <Typography
                  sx={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#D97757',
                    mb: 1.5,
                    textTransform: 'uppercase',
                    letterSpacing: 1
                  }}
                >
                  Key Insights
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {keyInsights.slice(0, 3).map((insight, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          bgcolor: '#D97757',
                          borderRadius: '50%',
                          mt: 0.8,
                          flexShrink: 0
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: '1.05rem',
                          color: '#333',
                          lineHeight: 1.4,
                          fontWeight: 400
                        }}
                      >
                        {insight}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Why Meet section */}
            {whyMeet && (
              <Box
                sx={{
                  bgcolor: '#f0f7ff',
                  borderRadius: 2,
                  p: 2,
                  border: '2px solid #bbdefb'
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#1976d2',
                    mb: 1,
                    textTransform: 'uppercase',
                    letterSpacing: 1
                  }}
                >
                  Why Meet
                </Typography>
                <Typography
                  sx={{
                    fontSize: '1rem',
                    color: '#333',
                    lineHeight: 1.5,
                    fontWeight: 500
                  }}
                >
                  {whyMeet}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Right column: Chart */}
          {chartType && trendsData && (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                minWidth: 0
              }}
            >
              <Box sx={{ height: '100%', maxHeight: 400 }}>
                <ChartEmbed chartType={chartType} trendsData={trendsData} idrssd={idrssd} />
              </Box>
            </Box>
          )}
        </Box>

        <Typography
          variant="caption"
          sx={{
            textAlign: 'right',
            color: '#999',
            mt: 2,
            fontSize: '0.75rem'
          }}
        >
          Powered by Claude
        </Typography>
      </Box>
    );
  }

  // Alternate layout: even slides = chart left, odd slides = chart right
  const chartOnLeft = slideIndex % 2 === 0;

  // Content slide with chart - TWO-COLUMN LAYOUT: Alternating chart/bullets with divider
  return (
    <Box
      sx={{
        width: slideWidth,
        height: slideHeight,
        bgcolor: 'white',
        borderRadius: 2,
        boxShadow: 4,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Logo symbol in upper right */}
      {bankLogoSymbol && (
        <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
          <img
            src={bankLogoSymbol}
            alt="Bank Logo"
            style={{ height: 32, maxWidth: 120, objectFit: 'contain' }}
          />
        </Box>
      )}

      {/* Title */}
      <Box sx={{ p: 4, pb: 3, pr: bankLogoSymbol ? 20 : 4, borderBottom: '4px solid #D97757' }}>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 700,
            color: '#1A1A1A',
            fontSize: '2.2rem'
          }}
        >
          {title}
        </Typography>
      </Box>

      {/* Two-column layout: Alternating Chart (2/3) + Bullets (1/3) */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {chartOnLeft ? (
          <>
            {/* Chart Section - 2/3 width (LEFT) */}
            {chartType && trendsData && (
              <Box
                sx={{
                  flex: '0 0 66%',
                  p: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center'
                }}
              >
                <Box sx={{ width: '100%', height: '100%', minHeight: 0 }}>
                  <ChartEmbed chartType={chartType} trendsData={trendsData} />
                </Box>
              </Box>
            )}

            {/* Vertical Divider */}
            <Box sx={{ width: 3, bgcolor: '#e0e0e0', mx: 2 }} />

            {/* Bullets Section - 1/3 width (RIGHT) */}
            <Box
              sx={{
                flex: '0 0 calc(34% - 3px - 32px)',
                p: 4,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              {renderBulletContent()}
            </Box>
          </>
        ) : (
          <>
            {/* Bullets Section - 1/3 width (LEFT) */}
            <Box
              sx={{
                flex: '0 0 calc(34% - 3px - 32px)',
                p: 4,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              {renderBulletContent()}
            </Box>

            {/* Vertical Divider */}
            <Box sx={{ width: 3, bgcolor: '#e0e0e0', mx: 2 }} />

            {/* Chart Section - 2/3 width (RIGHT) */}
            {chartType && trendsData && (
              <Box
                sx={{
                  flex: '0 0 66%',
                  p: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center'
                }}
              >
                <Box sx={{ width: '100%', height: '100%', minHeight: 0 }}>
                  <ChartEmbed chartType={chartType} trendsData={trendsData} />
                </Box>
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );

  // Helper function to render bullet content (DRY - used in both layouts)
  function renderBulletContent() {
    return (
      <>
        {/* Key Metric */}
        {keyMetric && (
          <Box
            sx={{
              p: 2.5,
              bgcolor: 'rgba(217, 119, 87, 0.08)',
              border: '3px solid #D97757',
              borderRadius: 2,
              mb: 3
            }}
          >
            <Typography
              sx={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: '#D97757',
                lineHeight: 1.4
              }}
            >
              {keyMetric}
            </Typography>
          </Box>
        )}

        {/* Bullets with opportunity/concern styling (3-5 bullets optimal) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {bullets.slice(0, 5).map((bullet, idx) => {
            // Detect opportunity/concern keywords for visual styling
            const bulletLower = bullet.toLowerCase();
            const isOpportunity =
              bulletLower.includes('opportunit') ||
              bulletLower.includes('potential') ||
              bulletLower.includes('could improve') ||
              bulletLower.includes('could increase') ||
              bulletLower.includes('room for') ||
              bulletLower.includes('below peer');

            const isConcern =
              bulletLower.includes('concern') ||
              bulletLower.includes('risk') ||
              bulletLower.includes('declining') ||
              bulletLower.includes('decreased') ||
              bulletLower.includes('underperform') ||
              bulletLower.includes('weakness');

            const isStrength =
              bulletLower.includes('strength') ||
              bulletLower.includes('outperform') ||
              bulletLower.includes('strong') ||
              bulletLower.includes('exceed') ||
              bulletLower.includes('leading') ||
              bulletLower.includes('above peer');

            // Determine styling based on content
            let bulletColor = '#D97757'; // Default
            let bulletIcon = '•';
            let textColor = '#333';
            let bgColor = 'transparent';

            if (isOpportunity) {
              bulletColor = '#2196f3'; // Blue for opportunities
              bulletIcon = '💡';
              bgColor = 'rgba(33, 150, 243, 0.05)';
            } else if (isConcern) {
              bulletColor = '#f57c00'; // Orange for concerns
              bulletIcon = '⚠️';
              bgColor = 'rgba(245, 124, 0, 0.05)';
            } else if (isStrength) {
              bulletColor = '#2e7d32'; // Green for strengths
              bulletIcon = '✓';
              bgColor = 'rgba(46, 125, 50, 0.05)';
            }

            return (
              <Box
                key={idx}
                sx={{
                  display: 'flex',
                  gap: 1.2,
                  p: 1.2,
                  borderRadius: 1,
                  bgcolor: bgColor,
                  borderLeft: `3px solid ${bulletColor}`,
                  transition: 'all 0.2s'
                }}
              >
                <Typography
                  sx={{
                    fontSize: '1.1rem',
                    lineHeight: 1,
                    mt: 0.2,
                    flexShrink: 0
                  }}
                >
                  {bulletIcon}
                </Typography>
                <Typography variant="body1" sx={{ fontSize: '0.85rem', lineHeight: 1.4, color: textColor }}>
                  {bullet}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </>
    );
  }
}

/**
 * ChartEmbed - Embeds Chart.js visualizations (reuses chart logic from ReportRenderer)
 */
function ChartEmbed({ chartType, trendsData, idrssd }) {
  if (!trendsData || !trendsData.periods || trendsData.periods.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" align="center">
        No data available for chart
      </Typography>
    );
  }

  // Render chart based on type
  switch (chartType) {
    case 'net-income':
      return <NetIncomeChart trendsData={trendsData} />;
    case 'efficiency-ratio':
      return <RatioChart trendsData={trendsData} ratioKey="efficiencyRatio" title="Efficiency Ratio (%)" lowerBetter={true} />;
    case 'efficiency-ratio-peer':
      return <PeerComparisonChart trendsData={trendsData} idrssd={idrssd} ratioKey="efficiencyRatio" title="Efficiency Ratio vs Peers (%)" lowerBetter={true} />;
    case 'operating-leverage':
      return <RatioChart trendsData={trendsData} ratioKey="operatingLeverage" title="Operating Leverage (YoY)" />;
    case 'operating-leverage-peer':
      return <PeerComparisonChart trendsData={trendsData} idrssd={idrssd} ratioKey="operatingLeverage" title="Operating Leverage vs Peers" />;
    case 'roe':
      return <RatioChart trendsData={trendsData} ratioKey="roe" title="Return on Equity (%)" />;
    case 'roe-peer':
      return <PeerComparisonChart trendsData={trendsData} idrssd={idrssd} ratioKey="roe" title="ROE vs Peers (%)" />;
    case 'nim':
      return <RatioChart trendsData={trendsData} ratioKey="nim" title="Net Interest Margin (%)" />;
    case 'nim-peer':
      return <PeerComparisonChart trendsData={trendsData} idrssd={idrssd} ratioKey="nim" title="NIM vs Peers (%)" />;
    case 'roa-peer':
      return <PeerComparisonChart trendsData={trendsData} idrssd={idrssd} ratioKey="roa" title="ROA vs Peers (%)" />;
    case 'roe-roa':
      return <ROEROAChart trendsData={trendsData} />;
    case 'asset-growth':
      return <AssetGrowthChart trendsData={trendsData} />;
    case 'loan-growth':
      return <LoanGrowthChart trendsData={trendsData} />;
    case 'loan-mix':
      return <LoanMixChart trendsData={trendsData} />;
    case 'revenue-composition':
      return <RevenueCompositionChart trendsData={trendsData} />;
    case 'fte-trends':
      return <FTETrendsChart trendsData={trendsData} />;
    case 'efficiency-ratio-ranking':
      return <StackRankingChart trendsData={trendsData} idrssd={idrssd} ratioKey="efficiencyRatio" title="Efficiency Ratio Stack Ranking" lowerBetter={true} />;
    case 'roe-ranking':
      return <StackRankingChart trendsData={trendsData} idrssd={idrssd} ratioKey="roe" title="ROE Stack Ranking" />;
    case 'roa-ranking':
      return <StackRankingChart trendsData={trendsData} idrssd={idrssd} ratioKey="roa" title="ROA Stack Ranking" />;
    case 'nim-ranking':
      return <StackRankingChart trendsData={trendsData} idrssd={idrssd} ratioKey="nim" title="NIM Stack Ranking" />;
    default:
      return (
        <Typography variant="body2" color="error" align="center">
          Unknown chart type: {chartType}
        </Typography>
      );
  }
}

// ============================================================================
// CHART COMPONENTS (Reused from ReportRenderer for consistency)
// ============================================================================

function NetIncomeChart({ trendsData }) {
  if (!trendsData || !trendsData.periods || trendsData.periods.length === 0) {
    return <Typography>No income data available</Typography>;
  }

  const sortedPeriods = [...trendsData.periods].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  // Group by year for YoY comparison
  const incomeByYear = {};
  sortedPeriods.forEach(p => {
    if (!p.period || typeof p.period !== 'string') return;
    const parts = p.period.split(' ');
    if (parts.length < 2 || !parts[1]) return;
    const [year, quarter] = parts;
    const q = parseInt(quarter.replace('Q', ''));
    if (!incomeByYear[year]) incomeByYear[year] = {};
    incomeByYear[year][q] = (p.income?.netIncome / 1000).toFixed(2);
  });

  const years = Object.keys(incomeByYear).sort((a, b) => b - a);
  const colors = ['#0d47a1', '#D97757', '#42a5f5', '#90caf9', '#bbdefb', '#e3f2fd'];

  const chartData = {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: years.map((year, index) => ({
      label: year,
      data: [1, 2, 3, 4].map(q => incomeByYear[year]?.[q] || null),
      borderColor: colors[index] || colors[colors.length - 1],
      borderWidth: index === 0 ? 3 : 2,
      fill: false,
      tension: 0.3,
      pointRadius: index === 0 ? 4 : 2,
      pointHoverRadius: 6,
      spanGaps: true
    }))
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, padding: 8 } },
      title: { display: true, text: 'Net Income - Quarterly by Year ($M)', font: { size: 14, weight: '600' } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { grid: { color: '#e8e8e8' }, ticks: { font: { size: 11 } } }
    }
  };

  return <Line data={chartData} options={options} />;
}

function RatioChart({ trendsData, ratioKey, title }) {
  const sortedPeriods = [...trendsData.periods].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  const filteredData = sortedPeriods
    .map(p => ({
      label: p.period,
      value: p.ratios?.[ratioKey] ?? null
    }))
    .filter(d => d.value !== null);

  if (filteredData.length === 0) {
    return <Typography>No {title} data available</Typography>;
  }

  const chartData = {
    labels: filteredData.map(d => d.label),
    datasets: [{
      label: title,
      data: filteredData.map(d => d.value),
      borderColor: '#D97757',
      backgroundColor: 'rgba(217, 119, 87, 0.1)',
      borderWidth: 3,
      fill: true,
      tension: 0.3,
      pointRadius: 4,
      pointBackgroundColor: '#D97757'
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: title, font: { size: 14, weight: '600' } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { grid: { color: '#e8e8e8' }, ticks: { font: { size: 11 } } }
    }
  };

  return <Line data={chartData} options={options} />;
}

function ROEROAChart({ trendsData }) {
  const sortedPeriods = [...trendsData.periods].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  const chartData = {
    labels: sortedPeriods.map(p => p.period),
    datasets: [
      {
        label: 'ROE (%)',
        data: sortedPeriods.map(p => p.ratios?.roe || null),
        borderColor: '#D97757',
        backgroundColor: 'rgba(217, 119, 87, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.3,
        pointRadius: 4
      },
      {
        label: 'ROA (%)',
        data: sortedPeriods.map(p => p.ratios?.roa || null),
        borderColor: '#388e3c',
        backgroundColor: 'rgba(56, 142, 60, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.3,
        pointRadius: 4
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, padding: 8 } },
      title: { display: true, text: 'Profitability: ROE vs ROA', font: { size: 14, weight: '600' } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { grid: { color: '#e8e8e8' }, ticks: { font: { size: 11 } } }
    }
  };

  return <Line data={chartData} options={options} />;
}

function AssetGrowthChart({ trendsData }) {
  const sortedPeriods = [...trendsData.periods].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  // Check if we have detailed asset breakdown
  const hasAssetBreakdown = sortedPeriods.some(p =>
    p.assets && typeof p.assets === 'object' &&
    (p.assets.consumerLending || p.assets.businessLending || p.assets.securities)
  );

  // If we have breakdown, show stacked column with major categories
  if (hasAssetBreakdown) {
    const chartData = {
      labels: sortedPeriods.map(p => p.period),
      datasets: [
        {
          label: 'Consumer Lending',
          data: sortedPeriods.map(p => ((p.assets?.consumerLending || 0) / 1000)),
          backgroundColor: 'rgba(25, 118, 210, 0.85)',
          borderColor: '#1976d2',
          borderWidth: 1,
          stack: 'assets'
        },
        {
          label: 'Business Lending',
          data: sortedPeriods.map(p => ((p.assets?.businessLending || 0) / 1000)),
          backgroundColor: 'rgba(56, 142, 60, 0.85)',
          borderColor: '#388e3c',
          borderWidth: 1,
          stack: 'assets'
        },
        {
          label: 'Securities',
          data: sortedPeriods.map(p => ((p.assets?.securities || 0) / 1000)),
          backgroundColor: 'rgba(245, 124, 0, 0.85)',
          borderColor: '#f57c00',
          borderWidth: 1,
          stack: 'assets'
        },
        {
          label: 'Cash & Other',
          data: sortedPeriods.map(p => (((p.assets?.cash || 0) + (p.assets?.other || 0)) / 1000)),
          backgroundColor: 'rgba(123, 31, 162, 0.85)',
          borderColor: '#7b1fa2',
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
          labels: { font: { size: 10, weight: '600' }, padding: 10 }
        },
        title: { display: true, text: 'Asset Composition Over Time ($M)', font: { size: 14, weight: '600' } },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: $${context.parsed.y.toFixed(0)}M`
          }
        }
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
        y: {
          stacked: true,
          grid: { color: '#e8e8e8' },
          ticks: { font: { size: 11 }, callback: (value) => `$${value}M` }
        }
      }
    };

    return <Bar data={chartData} options={options} />;
  }

  // Fallback to simple total assets bar chart
  const chartData = {
    labels: sortedPeriods.map(p => p.period),
    datasets: [{
      label: 'Total Assets ($M)',
      data: sortedPeriods.map(p => p.assets?.total ? p.assets.total / 1000 : null),
      backgroundColor: 'rgba(217, 119, 87, 0.6)',
      borderColor: '#D97757',
      borderWidth: 2
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Asset Growth Over Time ($M)', font: { size: 14, weight: '600' } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { grid: { color: '#e8e8e8' }, ticks: { font: { size: 11 } } }
    }
  };

  return <Bar data={chartData} options={options} />;
}

function LoanGrowthChart({ trendsData }) {
  const sortedPeriods = [...trendsData.periods].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  const chartData = {
    labels: sortedPeriods.map(p => p.period),
    datasets: [{
      label: 'Total Loans ($M)',
      data: sortedPeriods.map(p => {
        const consumer = p.assets?.consumerLending || 0;
        const business = p.assets?.businessLending || 0;
        return (consumer + business) / 1000;
      }),
      backgroundColor: 'rgba(56, 142, 60, 0.6)',
      borderColor: '#388e3c',
      borderWidth: 2
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Loan Portfolio Growth ($M)', font: { size: 14, weight: '600' } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { grid: { color: '#e8e8e8' }, ticks: { font: { size: 11 } } }
    }
  };

  return <Bar data={chartData} options={options} />;
}

function RevenueCompositionChart({ trendsData }) {
  const sortedPeriods = [...trendsData.periods].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  // Stacked column chart for revenue composition
  const chartData = {
    labels: sortedPeriods.map(p => p.period),
    datasets: [
      {
        label: 'Net Interest Income',
        data: sortedPeriods.map(p => (p.income?.netInterestIncome || 0) / 1000),
        backgroundColor: 'rgba(217, 119, 87, 0.85)',
        borderColor: '#D97757',
        borderWidth: 1,
        stack: 'revenue'
      },
      {
        label: 'Non-Interest Income',
        data: sortedPeriods.map(p => (p.income?.totalNoninterestIncome || 0) / 1000),
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
      legend: { display: true, position: 'bottom', labels: { font: { size: 11, weight: '600' }, padding: 10 } },
      title: { display: true, text: 'Revenue Composition Over Time ($M)', font: { size: 14, weight: '600' } },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: $${context.parsed.y.toFixed(1)}M`,
          footer: (items) => {
            const total = items.reduce((sum, item) => sum + item.parsed.y, 0);
            return `Total Revenue: $${total.toFixed(1)}M`;
          }
        }
      }
    },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: '#e8e8e8' },
        ticks: {
          font: { size: 11 },
          callback: (value) => `$${value}M`
        }
      }
    }
  };

  return <Bar data={chartData} options={options} />;
}

function FTETrendsChart({ trendsData }) {
  const sortedPeriods = [...trendsData.periods].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  const chartData = {
    labels: sortedPeriods.map(p => p.period),
    datasets: [{
      label: 'Full-Time Employees',
      data: sortedPeriods.map(p => p.fte || null),
      borderColor: '#D97757',
      backgroundColor: 'rgba(217, 119, 87, 0.1)',
      borderWidth: 3,
      fill: true,
      tension: 0.3,
      pointRadius: 4,
      pointBackgroundColor: '#D97757'
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Employee Count Trends', font: { size: 14, weight: '600' } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { grid: { color: '#e8e8e8' }, ticks: { font: { size: 11 } } }
    }
  };

  return <Line data={chartData} options={options} />;
}

function PeerComparisonChart({ trendsData, idrssd, ratioKey, title, lowerBetter = false }) {
  if (!trendsData || !trendsData.periods || trendsData.periods.length === 0) {
    return <Typography>No peer comparison data available</Typography>;
  }

  const sortedPeriods = [...trendsData.periods].sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  );

  // Filter periods that have peer data
  const periodsWithPeers = sortedPeriods.filter(p =>
    p.peerAnalysis?.peerAverages?.[ratioKey] !== undefined &&
    p.peerAnalysis?.peerAverages?.[ratioKey] !== null
  );

  if (periodsWithPeers.length === 0) {
    return <Typography>No peer comparison data available for {title}</Typography>;
  }

  // Extract bank values and peer averages
  const bankData = periodsWithPeers
    .map(p => ({
      label: p.period,
      value: p.ratios?.[ratioKey] ?? null
    }))
    .filter(d => d.value !== null);

  const peerData = periodsWithPeers
    .map(p => ({
      label: p.period,
      value: p.peerAnalysis?.peerAverages?.[ratioKey] ?? null
    }))
    .filter(d => d.value !== null);

  if (bankData.length === 0 || peerData.length === 0) {
    return <Typography>Insufficient data for peer comparison</Typography>;
  }

  // Calculate performance indicator for latest period
  const latestBank = bankData[bankData.length - 1].value;
  const latestPeer = peerData[peerData.length - 1].value;
  const latestPeriod = periodsWithPeers[periodsWithPeers.length - 1];
  const ranking = latestPeriod.peerAnalysis?.rankings?.[ratioKey];

  // Determine if bank is outperforming (considering lowerBetter flag)
  const isOutperforming = lowerBetter
    ? latestBank < latestPeer
    : latestBank > latestPeer;

  const performanceColor = isOutperforming ? '#2e7d32' : '#ed6c02';
  const performanceText = isOutperforming ? 'Outperforming' : 'Underperforming';

  const chartData = {
    labels: bankData.map(d => d.label),
    datasets: [
      {
        label: 'This Bank',
        data: bankData.map(d => d.value),
        borderColor: '#D97757',
        backgroundColor: 'rgba(217, 119, 87, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointBackgroundColor: '#D97757',
        pointBorderWidth: 2
      },
      {
        label: 'Peer Average',
        data: peerData.map(d => d.value),
        borderColor: '#666',
        backgroundColor: 'rgba(102, 102, 102, 0.05)',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: '#666'
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
        labels: { font: { size: 11, weight: '600' }, padding: 10 }
      },
      title: {
        display: true,
        text: title,
        font: { size: 14, weight: '600' }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: { grid: { color: '#e8e8e8' }, ticks: { font: { size: 11 } } }
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <Line data={chartData} options={options} />
      </Box>

      {/* Performance indicator */}
      <Box sx={{
        mt: 2,
        display: 'flex',
        gap: 3,
        justifyContent: 'center',
        alignItems: 'center',
        pt: 2,
        borderTop: '1px solid #e0e0e0'
      }}>
        <Box sx={{
          px: 3,
          py: 1,
          bgcolor: `${performanceColor}15`,
          border: `2px solid ${performanceColor}`,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Box sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: performanceColor
          }} />
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: performanceColor }}>
            {performanceText}
          </Typography>
        </Box>
        {ranking && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.3 }}>
              Ranking
            </Typography>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>
              #{ranking.rank} of {ranking.total}
              <Typography component="span" sx={{ fontSize: '0.8rem', color: 'text.secondary', ml: 0.5 }}>
                (P{ranking.percentile})
              </Typography>
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/**
 * StackRankingChart - Shows bank's position among all peers with stack ranking bar chart
 * Fetches peer banks data dynamically and displays sorted bar chart
 */
function StackRankingChart({ trendsData, idrssd, ratioKey, title, lowerBetter = false }) {
  const [peerBanksData, setPeerBanksData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get latest period from trendsData (idrssd is passed as prop)
  const latestPeriod = trendsData.periods && trendsData.periods.length > 0
    ? trendsData.periods[trendsData.periods.length - 1]
    : null;

  useEffect(() => {
    const fetchPeerBanks = async () => {
      if (!idrssd || !latestPeriod) {
        setError('Missing bank ID or period data');
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`/api/banks/${idrssd}/peer-banks?period=${latestPeriod.date}`);
        setPeerBanksData(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching peer banks:', err);
        setError('Failed to load peer comparison data');
        setLoading(false);
      }
    };

    fetchPeerBanks();
  }, [idrssd, latestPeriod?.date, ratioKey]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography variant="body2" color="text.secondary">Loading peer comparison...</Typography>
      </Box>
    );
  }

  if (error || !peerBanksData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography variant="body2" color="error">{error || 'No peer data available'}</Typography>
      </Box>
    );
  }

  // Prepare chart data - sorted by metric value
  // Best performers on RIGHT, worst on LEFT
  const chartData = peerBanksData.banks
    .filter(b => b[ratioKey] !== null && b[ratioKey] !== undefined && !isNaN(b[ratioKey]))
    .map(b => ({
      idrssd: b.idrssd,
      name: b.name.length > 20 ? b.name.substring(0, 18) + '...' : b.name,
      value: b[ratioKey],
      isTarget: b.idrssd === idrssd
    }))
    .sort((a, b) => lowerBetter ? b.value - a.value : a.value - b.value); // Best on right

  const targetBank = chartData.find(b => b.isTarget);
  const peerAvg = chartData.reduce((sum, b) => sum + b.value, 0) / chartData.length;

  const data = {
    labels: chartData.map(d => d.name),
    datasets: [{
      data: chartData.map(d => d.value),
      backgroundColor: chartData.map(d => d.isTarget ? '#D97757' : '#BDBDBD'),
      borderColor: chartData.map(d => d.isTarget ? '#D97757' : '#BDBDBD'),
      borderWidth: 1
    }]
  };

  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: title,
        font: { size: 14, weight: '700' },
        padding: { bottom: 12 }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.x;
            return `${value.toFixed(2)}${ratioKey.includes('Ratio') || ratioKey === 'roe' || ratioKey === 'roa' || ratioKey === 'nim' ? '%' : 'x'}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: '#e8e8e8' },
        ticks: { font: { size: 10 } }
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 9 } }
      }
    }
  };

  // Calculate ranking info
  const ranking = latestPeriod?.peerAnalysis?.rankings?.[ratioKey];
  const isOutperforming = lowerBetter ? targetBank.value < peerAvg : targetBank.value > peerAvg;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <Bar data={data} options={options} />
      </Box>

      {/* Performance badge with ranking */}
      <Box sx={{
        display: 'flex',
        gap: 3,
        justifyContent: 'center',
        alignItems: 'center',
        pt: 2,
        borderTop: '1px solid #e0e0e0'
      }}>
        <Box sx={{
          px: 3,
          py: 1,
          bgcolor: isOutperforming ? '#e8f5e9' : '#fff3e0',
          border: `2px solid ${isOutperforming ? '#2e7d32' : '#ed6c02'}`,
          borderRadius: 2
        }}>
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: isOutperforming ? '#2e7d32' : '#ed6c02' }}>
            {isOutperforming ? 'Outperforming Peers' : 'Underperforming Peers'}
          </Typography>
        </Box>
        {ranking && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.3 }}>
              Ranking
            </Typography>
            <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>
              #{ranking.rank} of {ranking.total}
              <Typography component="span" sx={{ fontSize: '0.8rem', color: 'text.secondary', ml: 0.5 }}>
                (P{ranking.percentile})
              </Typography>
            </Typography>
          </Box>
        )}
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

  // Calculate total loans for latest period for percentages
  const latestPeriod = sortedPeriods[sortedPeriods.length - 1];
  const totalLoans = (latestPeriod.assets?.consumerLending || 0) + (latestPeriod.assets?.businessLending || 0);

  // Build stacked column chart with detailed loan categories
  const chartData = {
    labels: sortedPeriods.map(p => p.period),
    datasets: hasDetailedBreakdown ? [
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
    ] : [
      // Fallback to simple consumer/business if no detailed breakdown
      {
        label: 'Consumer Lending',
        data: sortedPeriods.map(p => ((p.assets?.consumerLending || 0) / 1000)),
        backgroundColor: 'rgba(25, 118, 210, 0.85)',
        borderColor: '#1976d2',
        borderWidth: 1,
        stack: 'loans'
      },
      {
        label: 'Business Lending',
        data: sortedPeriods.map(p => ((p.assets?.businessLending || 0) / 1000)),
        backgroundColor: 'rgba(56, 142, 60, 0.85)',
        borderColor: '#388e3c',
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
          font: { size: 10, weight: '600' },
          padding: 8,
          boxWidth: 12
        }
      },
      title: {
        display: true,
        text: 'Loan Portfolio Composition Over Time ($M)',
        font: { size: 14, weight: '600' }
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
        ticks: { font: { size: 11 } }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: '#e8e8e8' },
        ticks: {
          font: { size: 11 },
          callback: (value) => `$${value}M`
        }
      }
    }
  };

  // Calculate growth for consumer and business lending
  const oldestPeriod = sortedPeriods[0];
  const consumerLatest = (latestPeriod.assets?.consumerLending || 0) / 1000;
  const consumerOldest = (oldestPeriod.assets?.consumerLending || 0) / 1000;
  const businessLatest = (latestPeriod.assets?.businessLending || 0) / 1000;
  const businessOldest = (oldestPeriod.assets?.businessLending || 0) / 1000;

  const consumerGrowth = consumerOldest > 0 ? ((consumerLatest - consumerOldest) / consumerOldest * 100).toFixed(1) : 0;
  const businessGrowth = businessOldest > 0 ? ((businessLatest - businessOldest) / businessOldest * 100).toFixed(1) : 0;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <Bar data={chartData} options={options} />
      </Box>

      {/* Growth indicators */}
      <Box sx={{
        mt: 2,
        display: 'flex',
        gap: 3,
        justifyContent: 'center',
        pt: 2,
        borderTop: '1px solid #e0e0e0'
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>
            Consumer Growth
          </Typography>
          <Typography sx={{
            fontSize: '1.1rem',
            fontWeight: 700,
            color: parseFloat(consumerGrowth) > 0 ? '#2e7d32' : parseFloat(consumerGrowth) < 0 ? '#d32f2f' : '#757575'
          }}>
            {parseFloat(consumerGrowth) > 0 ? '↑' : parseFloat(consumerGrowth) < 0 ? '↓' : '→'} {Math.abs(consumerGrowth)}%
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>
            Business Growth
          </Typography>
          <Typography sx={{
            fontSize: '1.1rem',
            fontWeight: 700,
            color: parseFloat(businessGrowth) > 0 ? '#2e7d32' : parseFloat(businessGrowth) < 0 ? '#d32f2f' : '#757575'
          }}>
            {parseFloat(businessGrowth) > 0 ? '↑' : parseFloat(businessGrowth) < 0 ? '↓' : '→'} {Math.abs(businessGrowth)}%
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default PresentationRenderer;
