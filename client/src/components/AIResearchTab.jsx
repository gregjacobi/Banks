import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  LinearProgress,
  Paper
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import ReportRenderer from './ReportRenderer';
import PodcastGenerator from './PodcastGenerator';

/**
 * AI Research Mode Tab
 * Generates comprehensive bank analysis using Claude API
 * Includes real-time status updates and report caching
 */
function AIResearchTab({ idrssd, bankName }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [hasExistingReport, setHasExistingReport] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [trendsData, setTrendsData] = useState(null);
  const [podcastModalOpen, setPodcastModalOpen] = useState(false);
  const [podcastUrl, setPodcastUrl] = useState(null);
  const [podcastDuration, setPodcastDuration] = useState(null);
  const [podcastJobStatus, setPodcastJobStatus] = useState(null);
  const [podcastProgress, setPodcastProgress] = useState(0);
  const [podcastMessage, setPodcastMessage] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [showThinking, setShowThinking] = useState(true);

  // Check for existing report, podcast, and active jobs on component mount
  useEffect(() => {
    fetchExistingReport();
    checkForPodcast();
    checkForActiveJobs();
  }, [idrssd]);

  // Poll for active report job
  useEffect(() => {
    let pollInterval;

    if (loading) {
      pollInterval = setInterval(() => {
        pollJobStatus('report');
      }, 2000); // Poll every 2 seconds
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [loading, idrssd]);

  // Poll for active podcast job
  useEffect(() => {
    let pollInterval;

    if (podcastJobStatus === 'running' || podcastJobStatus === 'pending') {
      pollInterval = setInterval(() => {
        pollJobStatus('podcast');
      }, 2000); // Poll every 2 seconds
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [podcastJobStatus, idrssd]);

  /**
   * Fetch existing report if available
   */
  const fetchExistingReport = async () => {
    try {
      const response = await axios.get(`/api/research/${idrssd}/latest`);
      if (response.data.hasReport) {
        setReport(response.data.report);
        setTrendsData(response.data.report.trendsData);
        setGeneratedAt(response.data.generatedAt);
        setHasExistingReport(true);
      }
    } catch (err) {
      // No existing report, that's fine
      setHasExistingReport(false);
    }
  };

  /**
   * Check for existing podcast
   */
  const checkForPodcast = async () => {
    try {
      const response = await axios.get(`/api/research/${idrssd}/podcast/latest`);
      if (response.data.podcast) {
        setPodcastUrl(response.data.podcast.url);
        setPodcastDuration(response.data.podcast.duration);
      }
    } catch (err) {
      // No podcast yet, that's fine
      setPodcastUrl(null);
    }
  };

  /**
   * Check for active jobs on mount
   */
  const checkForActiveJobs = async () => {
    try {
      // Check for active report job
      const reportResponse = await axios.get(`/api/research/${idrssd}/job-status?type=report`);
      if (reportResponse.data.hasJob) {
        const job = reportResponse.data.job;
        if (job.status === 'running' || job.status === 'pending') {
          setLoading(true);
          setStatusMessage(job.message);
          setProgress(job.progress);
        }
      }

      // Check for active podcast job
      const podcastResponse = await axios.get(`/api/research/${idrssd}/job-status?type=podcast`);
      if (podcastResponse.data.hasJob) {
        const job = podcastResponse.data.job;
        if (job.status === 'running' || job.status === 'pending') {
          setPodcastJobStatus(job.status);
          setPodcastMessage(job.message);
          setPodcastProgress(job.progress);
        }
      }
    } catch (err) {
      console.error('Error checking for active jobs:', err);
    }
  };

  /**
   * Poll job status from server
   */
  const pollJobStatus = async (jobType) => {
    try {
      const response = await axios.get(`/api/research/${idrssd}/job-status?type=${jobType}`);

      if (!response.data.hasJob) {
        return;
      }

      const job = response.data.job;

      if (jobType === 'report') {
        setStatusMessage(job.message);
        setProgress(job.progress);

        if (job.status === 'completed') {
          setLoading(false);
          await fetchExistingReport();
        } else if (job.status === 'failed') {
          setLoading(false);
          setError(job.error || 'Report generation failed');
        }
      } else if (jobType === 'podcast') {
        setPodcastMessage(job.message);
        setPodcastProgress(job.progress);
        setPodcastJobStatus(job.status);

        if (job.status === 'completed') {
          await checkForPodcast();
          setPodcastJobStatus('completed');
        } else if (job.status === 'failed') {
          setPodcastJobStatus('failed');
          setError(job.error || 'Podcast generation failed');
        }
      }
    } catch (err) {
      console.error(`Error polling ${jobType} job status:`, err);
    }
  };

  /**
   * Handle podcast generation complete
   */
  const handlePodcastGenerated = (url, duration) => {
    setPodcastUrl(url);
    setPodcastDuration(duration);
  };

  /**
   * Generate new research report
   * Uses background job system with polling
   */
  const generateReport = async () => {
    try {
      setLoading(true);
      setError(null);
      setReport(null);
      setProgress(0);
      setStatusMessage('Starting report generation...');

      // Start the background job
      await axios.post(`/api/research/${idrssd}/generate-background`);
      // Polling will handle the rest via useEffect
    } catch (err) {
      console.error('Error starting report generation:', err);
      setError('Failed to start report generation');
      setLoading(false);
    }
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Box>
      {/* Header Card */}
      <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <AutoAwesomeIcon />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              AI-Powered Bank Research
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            Claude analyzes {bankName}'s financial trends, searches for news and investor materials,
            and generates comprehensive insights about performance, strategy, and positioning.
          </Typography>
        </CardContent>
      </Card>

      {/* Podcast Player */}
      {podcastUrl && (
        <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <PodcastsIcon sx={{ color: 'white' }} />
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'white' }}>
                The Bankskie Show
              </Typography>
            </Box>
            <Box sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 2,
              p: 2,
              backdropFilter: 'blur(10px)'
            }}>
              <Typography variant="body2" sx={{ color: 'white', mb: 1.5, opacity: 0.9 }}>
                AI-generated podcast discussing {bankName}'s analysis
                {podcastDuration && ` • ~${podcastDuration} minutes`}
              </Typography>
              <audio
                controls
                style={{
                  width: '100%',
                  height: '40px',
                  borderRadius: '8px'
                }}
                preload="metadata"
              >
                <source src={podcastUrl} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              {hasExistingReport && generatedAt && (
                <Typography variant="body2" color="text.secondary">
                  Report generated: {formatTimestamp(generatedAt)}
                </Typography>
              )}
              {!hasExistingReport && !loading && (
                <Typography variant="body2" color="text.secondary">
                  No research report available. Generate one to get started.
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {hasExistingReport && !loading && (
                <Button
                  variant="outlined"
                  startIcon={<PodcastsIcon />}
                  onClick={() => setPodcastModalOpen(true)}
                  disabled={podcastJobStatus === 'running' || podcastJobStatus === 'pending'}
                  sx={{
                    borderColor: '#667eea',
                    color: '#667eea',
                    '&:hover': {
                      borderColor: '#5568d3',
                      backgroundColor: 'rgba(102, 126, 234, 0.04)'
                    }
                  }}
                >
                  {podcastJobStatus === 'running' || podcastJobStatus === 'pending' ? 'Generating...' : 'Generate Podcast'}
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                onClick={generateReport}
                disabled={loading}
                sx={{ minWidth: 180 }}
              >
                {loading ? 'Analyzing...' : hasExistingReport ? 'Refresh Analysis' : 'Generate Report'}
              </Button>
            </Box>
          </Box>

          {/* Status Message and Progress */}
          {loading && (
            <Box sx={{ mt: 3 }}>
              <LinearProgress variant="determinate" value={progress} />
              <Typography variant="body2" sx={{ mt: 1.5, color: 'text.secondary', textAlign: 'center' }}>
                {statusMessage} ({progress}%)
              </Typography>

              {/* Streaming Thinking */}
              {streamingThinking && showThinking && (
                <Paper sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', maxHeight: 200, overflow: 'auto' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#666' }}>
                      Claude's Thinking Process
                    </Typography>
                    <Button size="small" onClick={() => setShowThinking(false)}>Hide</Button>
                  </Box>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#555', whiteSpace: 'pre-wrap' }}>
                    {streamingThinking}
                  </Typography>
                </Paper>
              )}

              {/* Streaming Report Text */}
              {streamingText && (
                <Paper sx={{ mt: 2, p: 2, bgcolor: 'white', maxHeight: 400, overflow: 'auto' }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#666', display: 'block', mb: 1 }}>
                    Report Preview (Streaming...)
                  </Typography>
                  <ReportRenderer markdown={streamingText} trendsData={trendsData} idrssd={idrssd} />
                </Paper>
              )}
            </Box>
          )}

          {/* Podcast Job Status */}
          {(podcastJobStatus === 'running' || podcastJobStatus === 'pending') && (
            <Box sx={{ mt: 3 }}>
              <LinearProgress variant="determinate" value={podcastProgress} />
              <Typography variant="body2" sx={{ mt: 1.5, color: 'text.secondary', textAlign: 'center' }}>
                {podcastMessage} ({podcastProgress}%)
              </Typography>
            </Box>
          )}

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Research Report */}
      {report && !loading && (
        <Card>
          <CardContent>
            {/* Report Header */}
            <Box sx={{ mb: 3, pb: 2, borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Research Report: {report.bankName}
              </Typography>
              <Box sx={{ display: 'flex', gap: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Generated: {formatTimestamp(report.generatedAt)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Model: {report.model || 'Claude Sonnet 4.5'}
                </Typography>
                {report.metadata?.inputTokens && (
                  <Typography variant="caption" color="text.secondary">
                    Tokens: {report.metadata.inputTokens + report.metadata.outputTokens}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Report Content with Embedded Charts */}
            <ReportRenderer
              markdown={report.analysis}
              trendsData={trendsData}
              idrssd={idrssd}
            />

            {/* Thinking Section (Collapsible) */}
            {report.thinking && (
              <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid #e0e0e0' }}>
                <details>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: '#666' }}>
                    View Claude's Extended Thinking
                  </summary>
                  <Paper sx={{ p: 2, mt: 2, bgcolor: '#fafafa', fontSize: '0.85rem', color: '#666' }}>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                      {report.thinking}
                    </Typography>
                  </Paper>
                </details>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!report && !loading && !error && (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <AutoAwesomeIcon sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Research Report Available
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Generate a comprehensive AI-powered analysis to get started
              </Typography>
              <Button
                variant="contained"
                startIcon={<AutoAwesomeIcon />}
                onClick={generateReport}
                size="large"
              >
                Generate AI Research Report
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Podcast Generator Modal */}
      <PodcastGenerator
        open={podcastModalOpen}
        onClose={() => setPodcastModalOpen(false)}
        onPodcastGenerated={handlePodcastGenerated}
        idrssd={idrssd}
        bankName={bankName}
      />
    </Box>
  );
}

export default AIResearchTab;
