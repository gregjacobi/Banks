import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAI } from '../contexts/AIContext';
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
  Link
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PsychologyIcon from '@mui/icons-material/Psychology';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ArticleIcon from '@mui/icons-material/Article';
import ReportRenderer from './ReportRenderer';

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
            color: '#667eea',
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
                    borderColor: '#667eea'
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
                          color: '#667eea',
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

  const { agentInsights, agentStats } = report;

  // Color coding for importance
  const importanceColors = {
    critical: '#d32f2f',
    high: '#f57c00',
    medium: '#1976d2',
    low: '#616161'
  };

  const importanceLabels = {
    critical: 'CRITICAL',
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW'
  };

  return (
    <Card sx={{ mb: 3, bgcolor: '#f8f9ff', border: '2px solid #7c4dff' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <PsychologyIcon sx={{ mr: 1, color: '#7c4dff', fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#7c4dff' }}>
            Agent Research Mode
          </Typography>
          <Chip
            label="Experimental"
            size="small"
            sx={{ ml: 2, bgcolor: '#7c4dff', color: 'white' }}
          />
        </Box>

        {/* Stats */}
        <Box sx={{ mb: 3, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              Iterations
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {agentStats.iterations}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              Duration
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {Math.round(agentStats.duration / 1000)}s
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              Insights Generated
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {agentInsights.length}
            </Typography>
          </Box>
          {agentStats.documentsQueried?.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Documents Queried
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {agentStats.documentsQueried.length}
              </Typography>
            </Box>
          )}
          {agentStats.webSearches?.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Web Searches
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {agentStats.webSearches.length}
              </Typography>
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Insights */}
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center' }}>
          <TipsAndUpdatesIcon sx={{ mr: 0.5, fontSize: 20 }} />
          Key Insights Discovered by Agent
        </Typography>

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
      </CardContent>
    </Card>
  );
}

/**
 * AI Content Tab - View Generated Reports and Podcasts
 */
function AIContentTab({ idrssd, bankName, onNavigateToBuilder }) {
  const {
    currentReport,
    currentPodcast,
    loadReports,
    loadPodcasts
  } = useAI();

  const [exportFormat, setExportFormat] = useState('pdf');

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

  const handleExport = (format) => {
    // TODO: Implement export functionality
    console.log('Exporting as:', format);
  };

  const handleRegenerateReport = () => {
    // Navigate to Builder tab
    if (onNavigateToBuilder) {
      onNavigateToBuilder();
    }
  };

  return (
    <Box>
      {/* Header Card */}
      <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <ArticleIcon />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              AI-Generated Content
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            View and export completed research reports and podcasts
          </Typography>
        </CardContent>
      </Card>

      {/* Podcast Section */}
      {currentPodcast && (
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
                {currentPodcast.duration && ` • ~${currentPodcast.duration} minutes`}
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
                <source src={currentPodcast.url} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<DownloadIcon />}
                  href={currentPodcast.url}
                  download
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
                >
                  Download MP3
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={handleRegenerateReport}
                  sx={{ borderColor: 'white', color: 'white', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
                >
                  Regenerate
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Report Section */}
      {currentReport ? (
        <>
          {/* Report Controls */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
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
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleExport('pdf')}
                  >
                    Export PDF
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleExport('markdown')}
                  >
                    Export Markdown
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={handleRegenerateReport}
                  >
                    Regenerate with Different Sources
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Sources Used */}
          <SourcesUsedDisplay report={currentReport} />

          {/* Agent Insights (if agent-based report) */}
          <AgentInsightsDisplay report={currentReport} />

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
                markdown={currentReport.analysis?.report || currentReport.analysis}
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
                startIcon={<AutoAwesomeIcon />}
                onClick={handleRegenerateReport}
                size="large"
              >
                Go to AI Builder
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Empty State - No Podcast (if report exists but no podcast) */}
      {currentReport && !currentPodcast && (
        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2">
            No podcast generated yet. Go to the <strong>AI Builder</strong> tab to create a podcast from this report.
          </Typography>
        </Alert>
      )}
    </Box>
  );
}

export default AIContentTab;
