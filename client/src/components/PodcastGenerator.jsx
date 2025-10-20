import React, { useState } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Typography,
  Box,
  LinearProgress,
  Alert,
  Chip
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import DownloadIcon from '@mui/icons-material/Download';

/**
 * PodcastGenerator - Modal for generating "The Bankskie Show" podcasts
 * Allows user to select expert guests and generates audio podcast
 */
function PodcastGenerator({ open, onClose, onPodcastGenerated, idrssd, bankName }) {
  const [selectedExperts, setSelectedExperts] = useState({
    WARREN_VAULT: true,
    DR_SOFIA_BANKS: false,
    AVA_AGENTIC: false,
    MAYA_CUSTOMER: false
  });

  const [generating, setGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [podcastUrl, setPodcastUrl] = useState(null);
  const [podcastDuration, setPodcastDuration] = useState(null);

  const experts = [
    {
      id: 'WARREN_VAULT',
      name: 'Warren Vault',
      role: 'Investor Analyst',
      description: 'Investment health, key metrics, shareholder value'
    },
    {
      id: 'DR_SOFIA_BANKS',
      name: 'Dr. Sofia Banks',
      role: 'Banking Professor',
      description: 'Banking concepts, regulatory context, fundamentals'
    },
    {
      id: 'AVA_AGENTIC',
      name: 'Ava Agentic',
      role: 'AI Banking Guru',
      description: 'AI opportunities, digital transformation, innovation'
    },
    {
      id: 'MAYA_CUSTOMER',
      name: 'Maya Customer',
      role: 'CX Expert',
      description: 'Customer impact, service quality, user experience'
    }
  ];

  const handleExpertToggle = (expertId) => {
    setSelectedExperts(prev => ({
      ...prev,
      [expertId]: !prev[expertId]
    }));
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);

      // Get selected expert IDs
      const expertsToInclude = Object.keys(selectedExperts)
        .filter(key => selectedExperts[key]);

      // Start background job
      await axios.post(`/api/research/${idrssd}/podcast/generate-background`, {
        experts: expertsToInclude
      });

      // Close dialog immediately - parent will poll for status
      onClose();

      // Reset state
      setTimeout(() => {
        setGenerating(false);
        setError(null);
        setPodcastUrl(null);
        setProgress(0);
        setStatusMessage('');
      }, 300);
    } catch (err) {
      console.error('Error starting podcast generation:', err);
      setError('Failed to start podcast generation');
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (podcastUrl) {
      window.open(podcastUrl, '_blank');
    }
  };

  const handleClose = () => {
    if (!generating) {
      onClose();
      // Reset state
      setTimeout(() => {
        setError(null);
        setPodcastUrl(null);
        setProgress(0);
        setStatusMessage('');
      }, 300);
    }
  };

  const selectedCount = Object.values(selectedExperts).filter(Boolean).length;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PodcastsIcon sx={{ color: '#667eea' }} />
          <span>Generate "The Bankskie Show" Podcast</span>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Create an AI-generated podcast where Bankskie interviews banking experts about {bankName}.
          Select which experts you'd like on the show:
        </Typography>

        {/* Expert Selection */}
        <FormGroup>
          {experts.map((expert) => (
            <Box
              key={expert.id}
              sx={{
                mb: 1,
                p: 1.5,
                border: '1px solid #e0e0e0',
                borderRadius: 1,
                backgroundColor: selectedExperts[expert.id] ? '#f3f4ff' : 'transparent',
                transition: 'all 0.2s'
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectedExperts[expert.id]}
                    onChange={() => handleExpertToggle(expert.id)}
                    disabled={generating}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {expert.name}
                      <Chip
                        label={expert.role}
                        size="small"
                        sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                      />
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {expert.description}
                    </Typography>
                  </Box>
                }
              />
            </Box>
          ))}
        </FormGroup>

        {/* Status / Progress */}
        {generating && (
          <Box sx={{ mt: 3 }}>
            <LinearProgress variant="determinate" value={progress} sx={{ mb: 1 }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
              {statusMessage}
            </Typography>
          </Box>
        )}

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {/* Success / Download */}
        {podcastUrl && !generating && (
          <Alert severity="success" sx={{ mt: 2 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Podcast Ready!
              </Typography>
              <Typography variant="caption">
                Duration: ~{podcastDuration} minutes
              </Typography>
            </Box>
          </Alert>
        )}

        {!generating && !podcastUrl && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, fontStyle: 'italic' }}>
            💡 Tip: Including more experts creates a richer conversation but takes longer to generate.
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={generating}>
          {podcastUrl ? 'Close' : 'Cancel'}
        </Button>

        {podcastUrl ? (
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
            color="success"
          >
            Download Podcast
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={<MicIcon />}
            onClick={handleGenerate}
            disabled={generating || selectedCount === 0}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)'
              }
            }}
          >
            {generating ? 'Generating...' : `Generate Podcast (${selectedCount} ${selectedCount === 1 ? 'Expert' : 'Experts'})`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default PodcastGenerator;
