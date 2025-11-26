import React, { useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

/**
 * StockWidget Component
 * Displays stock ticker information and TradingView chart for publicly traded banks
 */
function StockWidget({ metadata }) {
  const widgetContainerRef = useRef(null);

  useEffect(() => {
    if (!metadata?.ticker?.isPubliclyTraded || !metadata?.ticker?.symbol || !widgetContainerRef.current) {
      return;
    }

    // Clear existing widget
    widgetContainerRef.current.innerHTML = '';

    // Create TradingView widget script
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: `${metadata.ticker.exchange || 'NYSE'}:${metadata.ticker.symbol}`,
      width: '100%',
      height: '220',
      locale: 'en',
      dateRange: '12M',
      colorTheme: 'light',
      trendLineColor: 'rgba(217, 119, 87, 1)',
      underLineColor: 'rgba(217, 119, 87, 0.3)',
      underLineBottomColor: 'rgba(217, 119, 87, 0)',
      isTransparent: false,
      autosize: true,
      largeChartUrl: ''
    });

    widgetContainerRef.current.appendChild(script);

    return () => {
      if (widgetContainerRef.current) {
        widgetContainerRef.current.innerHTML = '';
      }
    };
  }, [metadata?.ticker?.symbol, metadata?.ticker?.exchange, metadata?.ticker?.isPubliclyTraded]);

  // Don't render if not publicly traded or no ticker symbol
  if (!metadata?.ticker?.isPubliclyTraded || !metadata?.ticker?.symbol) {
    return null;
  }

  const { ticker } = metadata;

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUpIcon sx={{ color: '#d97757', fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Stock Performance
          </Typography>
        </Box>
        <Chip
          label={`${ticker.exchange || 'NYSE'}: ${ticker.symbol}`}
          sx={{
            backgroundColor: '#d97757',
            color: 'white',
            fontWeight: 600,
            fontSize: '0.9rem'
          }}
        />
      </Box>

      {/* TradingView Widget */}
      <Box
        ref={widgetContainerRef}
        sx={{
          width: '100%',
          height: 220,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 1,
          border: '1px solid #e0e0e0'
        }}
      />

      {/* Metadata Footer */}
      {(ticker.source || ticker.lastUpdated) && (
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0', display: 'flex', gap: 3 }}>
          {ticker.source && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              <strong>Source:</strong> {ticker.source}
            </Typography>
          )}
          {ticker.lastUpdated && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              <strong>Last Updated:</strong> {new Date(ticker.lastUpdated).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Typography>
          )}
        </Box>
      )}

      {/* Attribution */}
      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
          Chart powered by TradingView
        </Typography>
      </Box>
    </Paper>
  );
}

export default StockWidget;
