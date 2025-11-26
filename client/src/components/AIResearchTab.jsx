import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  Paper
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import DeleteIcon from '@mui/icons-material/Delete';
import ReportRenderer from './ReportRenderer';
import PodcastGenerator from './PodcastGenerator';

/**
 * AI Research Mode Tab
 * Generates comprehensive bank analysis using Claude API
 * Includes real-time status updates and report caching
 */
function AIResearchTab({ idrssd, bankName, onPodcastReady }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [podcastError, setPodcastError] = useState(null);  // Separate error state for podcasts
  const [statusMessage, setStatusMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [hasExistingReport, setHasExistingReport] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [trendsData, setTrendsData] = useState(null);
  const [podcastModalOpen, setPodcastModalOpen] = useState(false);
  const [podcastUrl, setPodcastUrl] = useState(null);
  const [podcastDuration, setPodcastDuration] = useState(null);
  const [podcastFilename, setPodcastFilename] = useState(null);
  const [podcastJobStatus, setPodcastJobStatus] = useState(null);
  const [podcastProgress, setPodcastProgress] = useState(0);
  const [podcastMessage, setPodcastMessage] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [showThinking, setShowThinking] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusLog, setStatusLog] = useState([]);  // Terminal-style log entries

  // Refs for auto-scrolling
  const thinkingRef = useRef(null);
  const streamingTextRef = useRef(null);
  const statusLogRef = useRef(null);

  // Check for existing report, podcast, and active jobs on component mount
  useEffect(() => {
    fetchExistingReport();
    checkForPodcast();
    checkForActiveJobs();
  }, [idrssd]);

  // Poll for active report job (only if not streaming)
  useEffect(() => {
    let pollInterval;

    if (loading && !isStreaming) {
      pollInterval = setInterval(() => {
        pollJobStatus('report');
      }, 2000); // Poll every 2 seconds
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [loading, isStreaming, idrssd]);

  // Update elapsed time every second when loading
  useEffect(() => {
    let timer;
    if (loading) {
      timer = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [loading]);

  // Auto-scroll thinking area when content updates
  useEffect(() => {
    if (streamingThinking && thinkingRef.current && showThinking) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
    }
  }, [streamingThinking, showThinking]);

  // Auto-scroll streaming text area when content updates
  useEffect(() => {
    if (streamingText && streamingTextRef.current) {
      streamingTextRef.current.scrollTop = streamingTextRef.current.scrollHeight;
    }
  }, [streamingText]);

  // Auto-scroll status log when new entries are added
  useEffect(() => {
    if (statusLogRef.current) {
      statusLogRef.current.scrollTop = statusLogRef.current.scrollHeight;
    }
  }, [statusLog]);

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
      console.log('Fetching existing report for', idrssd);
      const response = await axios.get(`/api/research/${idrssd}/latest`);
      console.log('Report response:', response.data);
      if (response.data.hasReport) {
        setReport(response.data.report);
        setTrendsData(response.data.report.trendsData);
        setGeneratedAt(response.data.generatedAt);
        setHasExistingReport(true);
        console.log('Report loaded successfully');
      } else {
        console.log('No report found');
      }
    } catch (err) {
      console.error('Error fetching report:', err);
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
        setPodcastFilename(response.data.podcast.filename);
        if (onPodcastReady) {
          onPodcastReady(response.data.podcast.url);
        }
      }
    } catch (err) {
      // No podcast yet, that's fine
      setPodcastUrl(null);
      setPodcastFilename(null);
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
          addLogEntry('Resuming active report generation...', 'info');
          if (job.message) {
            addLogEntry(job.message, 'info');
          }
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
          addLogEntry('[Podcast] Resuming active podcast generation...', 'info');
          if (job.message) {
            addLogEntry(`[Podcast] ${job.message}`, 'info');
          }
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
        if (job.message && job.message !== statusMessage) {
          setStatusMessage(job.message);
          addLogEntry(job.message, 'info');
        }
        setProgress(job.progress);
        if (job.elapsedSeconds) {
          setElapsedSeconds(job.elapsedSeconds);
        }

        if (job.status === 'completed') {
          addLogEntry('Report generation complete!', 'success');
          setLoading(false);
          setIsStreaming(false);
          await fetchExistingReport();
        } else if (job.status === 'failed') {
          addLogEntry(`Report generation failed: ${job.error || 'Unknown error'}`, 'error');
          setLoading(false);
          setIsStreaming(false);
          setError(job.error || 'Report generation failed');
        }
      } else if (jobType === 'podcast') {
        if (job.message && job.message !== podcastMessage) {
          setPodcastMessage(job.message);
          addLogEntry(`[Podcast] ${job.message}`, 'info');
        }
        setPodcastProgress(job.progress);
        setPodcastJobStatus(job.status);

        if (job.status === 'completed') {
          addLogEntry('[Podcast] Podcast generation complete!', 'success');
          await checkForPodcast();
          setPodcastJobStatus('completed');
          setPodcastError(null);  // Clear any previous podcast errors
        } else if (job.status === 'failed') {
          addLogEntry(`[Podcast] Generation failed: ${job.error || 'Unknown error'}`, 'error');
          setPodcastJobStatus('failed');
          setPodcastError(job.error || 'Podcast generation failed');  // Use separate podcast error state
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
    // Extract filename from URL if possible
    if (url && url.includes('/podcast/')) {
      const parts = url.split('/');
      const filename = parts[parts.length - 1];
      setPodcastFilename(filename);
    }
    if (onPodcastReady) {
      onPodcastReady(url);
    }
  };

  /**
   * Delete the current podcast
   */
  const handleDeletePodcast = async () => {
    if (!podcastFilename) return;

    if (!window.confirm('Are you sure you want to delete this podcast? You can regenerate it later.')) {
      return;
    }

    try {
      await axios.delete(`/api/research/${idrssd}/podcast/${podcastFilename}`);
      setPodcastUrl(null);
      setPodcastDuration(null);
      setPodcastFilename(null);
      if (onPodcastReady) {
        onPodcastReady(null);
      }
    } catch (err) {
      console.error('Error deleting podcast:', err);
      setError('Failed to delete podcast');
    }
  };

  /**
   * Cancel the current report generation job
   */
  const cancelGeneration = async () => {
    try {
      addLogEntry('Cancelling report generation...', 'warn');
      await axios.delete(`/api/research/${idrssd}/job?type=report`);
      setLoading(false);
      setIsStreaming(false);
      setStreamingThinking('');
      setStreamingText('');
      addLogEntry('Report generation cancelled by user', 'error');
      setError('Report generation cancelled');
    } catch (err) {
      console.error('Error cancelling job:', err);
      addLogEntry('Failed to cancel job', 'error');
      setError('Failed to cancel job');
    }
  };

  /**
   * Generate new research report
   * Tries streaming first, falls back to polling if stream fails
   */
  const generateReport = async () => {
    try {
      setLoading(true);
      setError(null);
      setReport(null);
      setProgress(0);
      setElapsedSeconds(0);
      setStreamingThinking('');
      setStreamingText('');
      setStatusMessage('Starting report generation...');
      setStatusLog([]);  // Clear previous log
      addLogEntry('Starting report generation...', 'info');

      // Try streaming endpoint with EventSource (GET request)
      try {
        setIsStreaming(true);

        const eventSource = new EventSource(`/api/research/${idrssd}/generate-stream`);

        eventSource.addEventListener('status', (e) => {
          const data = JSON.parse(e.data);
          console.log('Status event:', data);
          if (data.message) {
            setStatusMessage(data.message);
            addLogEntry(data.message, 'info');
          }
          if (data.progress !== undefined) setProgress(data.progress);
        });

        eventSource.addEventListener('thinking', (e) => {
          const data = JSON.parse(e.data);
          console.log('Thinking event:', data);
          if (data.text) {
            setStreamingThinking(prev => prev + data.text);
          }
        });

        eventSource.addEventListener('text', (e) => {
          const data = JSON.parse(e.data);
          console.log('Text event:', data);
          if (data.text) {
            setStreamingText(prev => prev + data.text);
          }
        });

        eventSource.addEventListener('complete', async () => {
          console.log('Stream complete, fetching final report...');
          addLogEntry('Report generation complete!', 'success');
          setLoading(false);
          setIsStreaming(false);
          setStreamingThinking('');
          setStreamingText('');
          await fetchExistingReport();
          eventSource.close();
        });

        eventSource.addEventListener('error', (e) => {
          console.error('SSE error:', e);
          addLogEntry('Connection error, switching to background mode...', 'warn');
          setIsStreaming(false);
          // Fall back to polling
          pollJobStatus('report');
          eventSource.close();
        });

        eventSource.onerror = () => {
          console.log('EventSource connection closed');
          eventSource.close();
        };

      } catch (streamError) {
        console.warn('Streaming failed, falling back to background job:', streamError);
        setIsStreaming(false);

        // Fall back to background job
        await axios.post(`/api/research/${idrssd}/generate-background`);
        // Polling will handle the rest via useEffect
      }
    } catch (err) {
      console.error('Error starting report generation:', err);
      setError('Failed to start report generation');
      setLoading(false);
      setIsStreaming(false);
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

  /**
   * Format elapsed seconds as MM:SS
   */
  const formatElapsedTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Add a log entry to the status log
   */
  const addLogEntry = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    setStatusLog(prev => [...prev, { timestamp, message, type }]);
  };

  return (
    <Box>
      {/* Header Card */}
      <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #d97757 0%, #c25a39 100%)', color: 'white' }}>
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
        <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #d97757 0%, #c25a39 100%)' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PodcastsIcon sx={{ color: 'white' }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'white' }}>
                  The Bankskie Show
                </Typography>
              </Box>
              <Button
                size="small"
                startIcon={<DeleteIcon />}
                onClick={handleDeletePodcast}
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                  '&:hover': {
                    borderColor: 'white',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)'
                  }
                }}
                variant="outlined"
              >
                Delete
              </Button>
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
                  onClick={() => {
                    setPodcastModalOpen(true);
                    setPodcastError(null);  // Clear any stale podcast errors
                  }}
                  disabled={podcastJobStatus === 'running' || podcastJobStatus === 'pending'}
                  sx={{
                    borderColor: '#d97757',
                    color: '#d97757',
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

          {/* Terminal-Style Status Log */}
          {(loading || podcastJobStatus === 'running' || podcastJobStatus === 'pending') && statusLog.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#333', fontFamily: 'monospace' }}>
                  AI Builder Status
                  {loading && ` • Elapsed: ${formatElapsedTime(elapsedSeconds)}`}
                </Typography>
                {loading && (
                  <Button
                    size="small"
                    color="error"
                    onClick={cancelGeneration}
                    sx={{ minWidth: 80 }}
                  >
                    Cancel
                  </Button>
                )}
              </Box>
              <Paper
                ref={statusLogRef}
                sx={{
                  bgcolor: '#1e1e1e',
                  color: '#d4d4d4',
                  p: 2,
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '0.85rem',
                  maxHeight: 300,
                  overflow: 'auto',
                  borderRadius: 1,
                  '& > div': {
                    display: 'flex',
                    gap: 1,
                    mb: 0.5,
                    lineHeight: 1.5
                  }
                }}
              >
                {statusLog.map((entry, index) => (
                  <div key={index}>
                    <span style={{ color: '#6a9955', opacity: 0.8 }}>[{entry.timestamp}]</span>
                    <span style={{
                      color: entry.type === 'error' ? '#f48771' :
                             entry.type === 'success' ? '#4ec9b0' :
                             entry.type === 'warn' ? '#dcdcaa' :
                             '#d4d4d4'
                    }}>
                      {entry.message}
                    </span>
                  </div>
                ))}
              </Paper>

              {/* Streaming Thinking */}
              {streamingThinking && showThinking && (
                <Paper 
                  ref={thinkingRef}
                  sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', maxHeight: 200, overflow: 'auto' }}
                >
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
                <Paper 
                  ref={streamingTextRef}
                  sx={{ mt: 2, p: 2, bgcolor: 'white', maxHeight: 400, overflow: 'auto' }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#666', display: 'block', mb: 1 }}>
                    Report Preview (Streaming...)
                  </Typography>
                  <Box sx={{
                    '& h1': { fontSize: '1.5rem', fontWeight: 600, mt: 3, mb: 2 },
                    '& h2': { fontSize: '1.25rem', fontWeight: 600, mt: 3, mb: 1.5 },
                    '& h3': { fontSize: '1.1rem', fontWeight: 600, mt: 2, mb: 1 },
                    '& p': { fontSize: '0.95rem', lineHeight: 1.7, mb: 1.5 },
                    '& ul, & ol': { ml: 2, mb: 2 },
                    '& li': { fontSize: '0.95rem', lineHeight: 1.6, mb: 0.5 },
                    '& strong': { fontWeight: 600 },
                    '& em': { fontStyle: 'italic' },
                    '& code': {
                      backgroundColor: '#f5f5f5',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      fontSize: '0.9rem'
                    }
                  }}>
                    <ReactMarkdown>{streamingText}</ReactMarkdown>
                  </Box>
                </Paper>
              )}
            </Box>
          )}

          {/* Report Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {/* Podcast Error Alert (separate from report errors) */}
          {podcastError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Podcast Generation Error: {podcastError}
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
              markdown={report.analysis?.report || report.analysis}
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
