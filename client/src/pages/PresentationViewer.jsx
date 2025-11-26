import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import PresentationRenderer from '../components/PresentationRenderer';

/**
 * PresentationViewer Page
 *
 * Full-screen presentation viewer that loads presentation JSON data
 * and renders it using the PresentationRenderer component.
 */
function PresentationViewer() {
  const { idrssd, filename } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [presentationData, setPresentationData] = useState(null);
  const [bankLogo, setBankLogo] = useState(null);
  const [bankLogoSymbol, setBankLogoSymbol] = useState(null);

  useEffect(() => {
    loadPresentation();
  }, [idrssd, filename]);

  const loadPresentation = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load presentation data
      const response = await axios.get(`/api/research/${idrssd}/presentation/${filename}`);
      const data = response.data;

      setPresentationData(data);

      // Try to load bank logo (full) if available for title slide
      // The logo endpoint returns the actual image file, so we use the URL directly
      try {
        const logoUrl = `/api/research/${idrssd}/logo`;
        // Test if logo exists by making a HEAD request
        const logoTest = await axios.head(logoUrl);
        if (logoTest.status === 200) {
          setBankLogo(logoUrl);
        }
      } catch (logoError) {
        // Logo is optional, don't fail if it's not available
        console.log('No full logo available');
      }

      // Try to load bank logo symbol for upper right corner
      try {
        const symbolUrl = `/api/research/${idrssd}/logo-symbol`;
        const symbolTest = await axios.head(symbolUrl);
        if (symbolTest.status === 200) {
          setBankLogoSymbol(symbolUrl);
        }
      } catch (symbolError) {
        // Symbol logo is optional, don't fail if it's not available
        console.log('No symbol logo available');
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading presentation:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load presentation');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#f5f5f5'
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={60} sx={{ color: '#D97757', mb: 3 }} />
          <Typography variant="h6" color="text.secondary">
            Loading presentation...
          </Typography>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#f5f5f5',
          p: 4
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 600 }}>
          <Typography variant="h6" gutterBottom>
            Error Loading Presentation
          </Typography>
          <Typography variant="body2">
            {error}
          </Typography>
        </Alert>
      </Box>
    );
  }

  if (!presentationData) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#f5f5f5'
        }}
      >
        <Typography variant="h6" color="text.secondary">
          No presentation data available
        </Typography>
      </Box>
    );
  }

  return (
    <PresentationRenderer
      presentationData={presentationData}
      bankName={presentationData.bankName}
      bankLogo={bankLogo}
      bankLogoSymbol={bankLogoSymbol}
    />
  );
}

export default PresentationViewer;
