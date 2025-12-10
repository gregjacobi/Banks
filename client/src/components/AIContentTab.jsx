import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAI } from '../contexts/AIContext';
import { usePodcastPlayer } from '../contexts/PodcastPlayerContext';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Paper,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  Link,
  Menu,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PsychologyIcon from '@mui/icons-material/Psychology';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ArticleIcon from '@mui/icons-material/Article';
import ShareIcon from '@mui/icons-material/Share';
import LinkIcon from '@mui/icons-material/Link';
import SettingsIcon from '@mui/icons-material/Settings';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DescriptionIcon from '@mui/icons-material/Description';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ReportRenderer from './ReportRenderer';
import FeedbackWidget from './FeedbackWidget';


/**
 * Sources Used Display Component
 */
function SourcesUsedDisplay({ report }) {
  if (!report || !report.sourcesUsed || report.sourcesUsed.length === 0) {
    return null;
  }

  // Group sources by category
  const sourcesByCategory = report.sourcesUsed.reduce((acc, source) => {
    if (!acc[source.category]) {
      acc[source.category] = [];
    }
    acc[source.category].push(source);
    return acc;
  }, {});

  const categoryLabels = {
    investorPresentation: 'Investor Presentations',
    earningsTranscript: 'Earnings Call Transcripts',
    executiveInterviews: 'Executive Interviews',
    recentNews: 'Recent News',
    aiProjects: 'AI/Technology Projects'
  };

  return (
    <Paper sx={{ p: 3, mb: 3, bgcolor: '#f9f9f9' }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Data Sources Used in This Report
      </Typography>

      {/* Call Report Data */}
      <Box
        sx={{
          mb: 3,
          p: 2,
          bgcolor: 'white',
          borderRadius: 1,
          border: '1px solid #e0e0e0'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#4caf50' }}>
            📊 FDIC Call Reports (Regulatory Filings)
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Quarterly financial statements filed with banking regulators
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Coverage: Q4 2022 - Q2 2025 (11 quarters)
        </Typography>
        <Link
          href="https://cdr.ffiec.gov/public/"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: '#d97757',
            textDecoration: 'none',
            fontSize: '0.8rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            mt: 0.5,
            '&:hover': {
              textDecoration: 'underline'
            }
          }}
        >
          View FDIC Central Data Repository
          <OpenInNewIcon sx={{ fontSize: 12 }} />
        </Link>
      </Box>

      {/* External Sources by Category */}
      {Object.entries(sourcesByCategory).map(([category, sources]) => (
        <Box key={category} sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            {categoryLabels[category] || category}
          </Typography>
          <List dense>
            {sources.map((source, index) => (
              <ListItem
                key={index}
                sx={{
                  bgcolor: 'white',
                  mb: 1.5,
                  borderRadius: 1,
                  border: '1px solid #e0e0e0',
                  '&:hover': {
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    borderColor: '#d97757'
                  },
                  transition: 'all 0.2s'
                }}
              >
                <ListItemText
                  primary={
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 600,
                        mb: 0.5,
                        color: '#333'
                      }}
                    >
                      {source.title}
                    </Typography>
                  }
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      <Link
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          color: '#d97757',
                          textDecoration: 'none',
                          fontSize: '0.8rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          '&:hover': {
                            textDecoration: 'underline'
                          }
                        }}
                      >
                        {source.url.length > 60 ? source.url.substring(0, 60) + '...' : source.url}
                        <OpenInNewIcon sx={{ fontSize: 12 }} />
                      </Link>
                      {source.referencedCount && (
                        <Chip
                          label={`Referenced ${source.referencedCount}x in report`}
                          size="small"
                          sx={{
                            mt: 0.75,
                            ml: 0,
                            height: 20,
                            fontSize: '0.7rem',
                            bgcolor: '#e8eaf6',
                            color: '#3f51b5',
                            fontWeight: 600
                          }}
                        />
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      ))}

      {/* Agent Research Stats (if agent-based report) */}
      {report.method === 'agent-based' && report.agentStats && (
        <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <img
              src="/claude-icon.svg"
              alt="Claude AI"
              style={{ width: 20, height: 20 }}
            />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              AI Agent Research Statistics
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Iterations
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {report.agentStats.iterations}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Duration
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {Math.round(report.agentStats.duration / 1000)}s
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Insights Generated
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {report.agentInsights?.length || 0}
              </Typography>
            </Box>
            {report.agentStats.documentsQueried?.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Documents Queried
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {report.agentStats.documentsQueried.length}
                </Typography>
              </Box>
            )}
            {report.agentStats.webSearches?.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Web Searches
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {report.agentStats.webSearches.length}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Paper>
  );
}

/**
 * Agent Insights Display Component
 * Shows insights discovered by the agent during research
 */
function AgentInsightsDisplay({ report }) {
  if (!report || !report.agentInsights || report.method !== 'agent-based') {
    return null;
  }

  const { agentInsights } = report;

  // Color coding for importance
  const importanceColors = {
    critical: '#d32f2f',
    high: '#f57c00',
    medium: '#d97757',
    low: '#616161'
  };

  const importanceLabels = {
    critical: 'CRITICAL',
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW'
  };

  return (
    <Paper sx={{ p: 3, mb: 3, bgcolor: '#f9f9f9' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <img
          src="/claude-icon.svg"
          alt="Claude AI"
          style={{ width: 20, height: 20 }}
        />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Key Insights Discovered by AI Agent
        </Typography>
      </Box>

        {agentInsights.map((insight, idx) => (
          <Paper
            key={idx}
            sx={{
              p: 2,
              mb: 2,
              borderLeft: `4px solid ${importanceColors[insight.importance]}`,
              bgcolor: 'white'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
                {insight.title}
              </Typography>
              <Chip
                label={importanceLabels[insight.importance]}
                size="small"
                sx={{
                  bgcolor: importanceColors[insight.importance],
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.7rem'
                }}
              />
            </Box>

            <Chip
              label={insight.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              size="small"
              variant="outlined"
              sx={{ mb: 1, fontSize: '0.7rem' }}
            />

            <Typography variant="body2" sx={{ mb: 1.5, color: 'text.primary' }}>
              {insight.content}
            </Typography>

            {insight.evidence && insight.evidence.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  Evidence:
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {insight.evidence.map((evidence, eidx) => (
                    <Chip
                      key={eidx}
                      label={evidence}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.65rem', height: 20 }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              Discovered: {new Date(insight.timestamp).toLocaleTimeString()}
            </Typography>
          </Paper>
        ))}
    </Paper>
  );
}

/**
 * AI Content Tab - View Generated Reports and Podcasts
 */
function AIContentTab({ idrssd, bankName }) {
  const {
    currentReport,
    currentPodcast,
    currentPresentation,
    loadReports,
    loadPodcasts,
    loadPresentations,
    reportVersions,
    selectedReportTimestamp,
    selectReportVersion,
    metadataStatus
  } = useAI();
  const { playPodcast } = usePodcastPlayer();
  const navigate = useNavigate();

  const [shareMenuAnchor, setShareMenuAnchor] = useState(null);
  const shareMenuOpen = Boolean(shareMenuAnchor);

  // Podcast controls
  const [podcastMenuAnchor, setPodcastMenuAnchor] = useState(null);
  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState(null);


  // Load reports, podcasts, and presentations on mount
  useEffect(() => {
    loadReports();
    loadPodcasts();
    loadPresentations();
  }, [idrssd]); // Reload when bank changes

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

  const handleShareClick = (event) => {
    setShareMenuAnchor(event.currentTarget);
  };

  const handleShareClose = () => {
    setShareMenuAnchor(null);
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    handleShareClose();
    // Could add a snackbar notification here
  };

  const handleDownloadPDF = async () => {
    try {
      handleShareClose();

      // Trigger PDF download
      const downloadUrl = `/api/research/${idrssd}/export-pdf`;

      // Create a temporary link and click it to trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Report_${bankName.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  const handleDownloadMP3 = async () => {
    if (!currentPodcast?.url) return;

    try {
      // Create a proper download link
      const link = document.createElement('a');
      link.href = currentPodcast.url;
      link.download = `${bankName.replace(/[^a-z0-9]/gi, '_')}_Podcast.mp3`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('MP3 download error:', error);
    }
    handleShareClose();
  };

  const handleOpenPersistentPlayer = () => {
    if (currentPodcast) {
      playPodcast({
        url: currentPodcast.url,
        bankName: bankName,
        transcript: currentPodcast.transcript,
        duration: currentPodcast.duration
      });
    }
  };

  const handleOpenBuilder = () => {
    window.open(`/research/${idrssd}`, '_blank', 'width=1400,height=900');
  };


  // Build the stream URL for opening in media player
  const getStreamUrl = () => {
    if (!currentPodcast?.url) return null;
    // Convert download URL to stream URL
    return currentPodcast.url.replace('/download/', '/stream/');
  };

  const handlePlayInMediaPlayer = () => {
    const streamUrl = getStreamUrl();
    if (streamUrl) {
      // Open in new tab - browser will use device's media player
      window.open(streamUrl, '_blank');
    }
  };

  return (
    <Box>
      {/* Podcast Section - Simple header with Play button and options menu */}
      {currentPodcast && (
        <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #d97757 0%, #c25a39 100%)' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* Play Button */}
              <Button
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={handlePlayInMediaPlayer}
                sx={{
                  bgcolor: 'white',
                  color: '#d97757',
                  fontWeight: 600,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' }
                }}
              >
                Listen
              </Button>

              {/* Podcast Info */}
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PodcastsIcon sx={{ fontSize: 20, color: 'white' }} />
                  <Typography variant="body1" sx={{ color: 'white', fontWeight: 600 }}>
                    The Bankskie Show
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'white', opacity: 0.8 }}>
                  {currentPodcast.duration ? `~${currentPodcast.duration} min` : 'Ready to play'}
                </Typography>
              </Box>

              {/* Options Menu */}
              <IconButton
                onClick={(e) => setPodcastMenuAnchor(e.currentTarget)}
                sx={{ color: 'white' }}
              >
                <MoreVertIcon />
              </IconButton>
              <Menu
                anchorEl={podcastMenuAnchor}
                open={Boolean(podcastMenuAnchor)}
                onClose={() => setPodcastMenuAnchor(null)}
              >
                <MenuItem onClick={() => {
                  setPodcastMenuAnchor(null);
                  setTranscriptDialogOpen(true);
                }}>
                  <DescriptionIcon sx={{ mr: 1, fontSize: 20 }} />
                  View Transcript
                </MenuItem>
                <MenuItem onClick={() => {
                  setPodcastMenuAnchor(null);
                  handleDownloadMP3();
                }}>
                  <DownloadIcon sx={{ mr: 1, fontSize: 20 }} />
                  Download MP3
                </MenuItem>
              </Menu>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Transcript Dialog */}
      <Dialog
        open={transcriptDialogOpen}
        onClose={() => setTranscriptDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PodcastsIcon sx={{ color: '#d97757' }} />
          Podcast Transcript - {bankName}
        </DialogTitle>
        <DialogContent dividers>
          {currentPodcast?.transcript ? (
            <Box sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.6 }}>
              {currentPodcast.transcript.split('\n').map((line, idx) => {
                // Style speaker labels differently
                const speakerMatch = line.match(/^\[([^\]]+)\]:/);
                if (speakerMatch) {
                  const speaker = speakerMatch[1];
                  const text = line.substring(line.indexOf(':') + 1).trim();
                  return (
                    <Box key={idx} sx={{ mb: 2 }}>
                      <Chip
                        label={speaker}
                        size="small"
                        sx={{
                          bgcolor: speaker === 'BANKSKIE' ? '#d97757' : '#666',
                          color: 'white',
                          fontWeight: 600,
                          mb: 0.5
                        }}
                      />
                      <Typography variant="body2" sx={{ pl: 1 }}>
                        {text}
                      </Typography>
                    </Box>
                  );
                }
                return line ? <Typography key={idx} variant="body2" sx={{ mb: 1 }}>{line}</Typography> : null;
              })}
            </Box>
          ) : (
            <Typography color="text.secondary">No transcript available</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTranscriptDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Report Section */}
      {currentReport ? (
        <>
          {/* Report Controls */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  {/* Version Selector - only show if multiple versions exist */}
                  {reportVersions && reportVersions.length > 1 && (
                    <FormControl size="small" sx={{ minWidth: 280, mb: 2 }}>
                      <InputLabel>Report Version</InputLabel>
                      <Select
                        value={selectedReportTimestamp || ''}
                        label="Report Version"
                        onChange={(e) => selectReportVersion(e.target.value)}
                      >
                        {reportVersions.map((version, idx) => (
                          <MenuItem key={version.timestamp} value={version.timestamp}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                              <Typography variant="body2">
                                {formatTimestamp(version.generatedAt)}
                              </Typography>
                              {idx === 0 && (
                                <Chip
                                  label="Latest"
                                  size="small"
                                  sx={{
                                    bgcolor: '#d97757',
                                    color: 'white',
                                    height: 20,
                                    fontSize: '0.7rem',
                                    fontWeight: 600
                                  }}
                                />
                              )}
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}

                  <Typography variant="caption" color="text.secondary" display="block">
                    Generated: {formatTimestamp(currentReport.generatedAt)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Model: {currentReport.model || 'Claude Sonnet 4.5'}
                  </Typography>
                  {currentReport.metadata?.inputTokens && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Tokens: {currentReport.metadata.inputTokens + currentReport.metadata.outputTokens}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {currentPresentation && (
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<SlideshowIcon />}
                      onClick={() => window.open(currentPresentation.url, '_blank')}
                    >
                      View Presentation
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<ShareIcon />}
                    onClick={handleShareClick}
                  >
                    Share
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<SettingsIcon />}
                    endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                    onClick={handleOpenBuilder}
                  >
                    Builder
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Sources Used */}
          <SourcesUsedDisplay report={currentReport} />

          {/* Report Content */}
          <Card>
            <CardContent>
              <Box sx={{ mb: 3, pb: 2, borderBottom: '1px solid #e0e0e0' }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  Research Report: {bankName}
                </Typography>
              </Box>

              {/* Render Report */}
              <ReportRenderer
                markdown={
                  typeof currentReport.analysis === 'string'
                    ? currentReport.analysis
                    : currentReport.analysis?.report || currentReport.analysis
                }
                trendsData={currentReport.trendsData}
                idrssd={idrssd}
              />

              {/* Thinking Section (Collapsible) */}
              {currentReport.thinking && (
                <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid #e0e0e0' }}>
                  <details>
                    <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: '#666' }}>
                      View Claude's Extended Thinking
                    </summary>
                    <Paper sx={{ p: 2, mt: 2, bgcolor: '#fafafa', fontSize: '0.85rem', color: '#666' }}>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                        {currentReport.thinking}
                      </Typography>
                    </Paper>
                  </details>
                </Box>
              )}

              {/* Feedback Widget */}
              <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid #e0e0e0' }}>
                <FeedbackWidget
                  feedbackType="report"
                  bankIdrssd={idrssd}
                  bankName={bankName}
                  reportTimestamp={currentReport.fileName ? parseInt(currentReport.fileName.split('_')[1]?.replace('.json', '')) : Date.now()}
                  reportingPeriod={currentReport.reportingPeriod}
                />
              </Box>
            </CardContent>
          </Card>
        </>
      ) : (
        /* Empty State - No Report */
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
                startIcon={<SettingsIcon />}
                endIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
                onClick={handleOpenBuilder}
                size="large"
              >
                Open Builder
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Empty State - No Podcast (if report exists but no podcast) */}
      {currentReport && !currentPodcast && (
        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2">
            No podcast generated yet. Open the <strong>Builder</strong> to create a podcast from this report.
          </Typography>
        </Alert>
      )}

      {/* Empty State - No Presentation (if report exists but no presentation) */}
      {currentReport && !currentPresentation && (
        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2">
            No presentation generated yet. Open the <strong>Builder</strong> to create a presentation from this report.
          </Typography>
        </Alert>
      )}

      {/* Share Menu */}
      <Menu
        anchorEl={shareMenuAnchor}
        open={shareMenuOpen}
        onClose={handleShareClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleCopyLink}>
          <LinkIcon sx={{ mr: 1, fontSize: 20 }} />
          Copy Link to Report
        </MenuItem>
        {currentPodcast && (
          <MenuItem onClick={handleDownloadMP3}>
            <PodcastsIcon sx={{ mr: 1, fontSize: 20 }} />
            Download Podcast (MP3)
          </MenuItem>
        )}
        <MenuItem onClick={handleDownloadPDF}>
          <DownloadIcon sx={{ mr: 1, fontSize: 20 }} />
          Download Report (PDF)
        </MenuItem>
      </Menu>

      {/* Builder Drawer - Now managed by BuilderManagerContext */}
    </Box>
  );
}

export default AIContentTab;
