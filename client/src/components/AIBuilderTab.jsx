import React, { useState, useEffect, useRef } from 'react';
import { useAI } from '../contexts/AIContext';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  LinearProgress,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Divider,
  Stack
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PsychologyIcon from '@mui/icons-material/Psychology';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ReactMarkdown from 'react-markdown';

const CATEGORY_LABELS = {
  investorPresentation: 'Investor Presentations (PDFs)',
  earningsTranscript: 'Earnings Call Transcripts',
  strategyAnalysis: 'Strategy & Analysis Documents',
  analystReports: 'Analyst Reports (Forrester, Gartner, etc.)'
};

/**
 * Source Card Component - Compact Version
 */
function SourceCard({ source, onDownload, downloading }) {
  const isPdf = source.url.toLowerCase().endsWith('.pdf') || source.contentType === 'pdf';

  return (
    <Paper
      sx={{
        p: 1,
        mb: 0.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        '&:hover': { bgcolor: '#f5f5f5' }
      }}
    >
      {isPdf && (
        <PictureAsPdfIcon sx={{ color: '#d32f2f', fontSize: 20 }} />
      )}

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {source.title}
        </Typography>
        {source.date && (
          <Typography variant="caption" sx={{ color: '#666' }}>
            {source.date}
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
        <IconButton
          size="small"
          component="a"
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in browser"
          sx={{ border: '1px solid #e0e0e0' }}
        >
          <OpenInNewIcon fontSize="small" />
        </IconButton>

        {isPdf && (
          <IconButton
            size="small"
            onClick={() => onDownload(source.id)}
            disabled={downloading}
            title="Download PDF"
            sx={{ border: '1px solid #e0e0e0' }}
          >
            {downloading ? (
              <CircularProgress size={16} />
            ) : (
              <DownloadIcon fontSize="small" />
            )}
          </IconButton>
        )}
      </Box>
    </Paper>
  );
}

/**
 * Format timestamp as relative time (e.g., "2 minutes ago")
 */
function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

/**
 * AI Builder Tab - Three-Phase Workflow
 */
function AIBuilderTab({ idrssd, bankName }) {
  const {
    gatheringInProgress,
    gatheringProgress,
    discoveredSources,
    reportInProgress,
    reportProgress,
    currentPhase,
    agentMilestones,
    agentInsights,
    streamingText,
    streamingThinking,
    currentReport,
    currentPodcast,
    userConfig,
    setUserConfig,
    error,
    pdfs,
    pdfUploading,
    podcastInProgress,
    podcastProgress,
    podcastStatus,
    startDataGathering,
    generateAgentReport,
    generatePodcast,
    cancelJob,
    clearAllSources,
    uploadPDF,
    deletePDF,
    downloadSourceAsPDF,
    deleteReport,
    deletePodcast,
    getApprovedSourcesCount,
    getPendingSourcesCount
  } = useAI();

  const [showThinking, setShowThinking] = useState(true);
  const [showStreamingPreview, setShowStreamingPreview] = useState(true);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [downloadingSourceId, setDownloadingSourceId] = useState(null);
  const [selectedPodcastExperts, setSelectedPodcastExperts] = useState([
    'WARREN_VAULT',
    'DR_SOFIA_BANKS',
    'AVA_AGENTIC'
  ]);
  const [expandedPhase, setExpandedPhase] = useState({
    phase1: true,
    phase2: true,
    phase3: true
  });

  // Refs for auto-scrolling
  const milestonesRef = useRef(null);
  const insightsRef = useRef(null);
  const thinkingRef = useRef(null);
  const streamingTextRef = useRef(null);

  // Auto-scroll agent milestones when updates come in
  useEffect(() => {
    if (agentMilestones.length > 0 && milestonesRef.current) {
      milestonesRef.current.scrollTop = milestonesRef.current.scrollHeight;
    }
  }, [agentMilestones]);

  // Auto-scroll agent insights when updates come in
  useEffect(() => {
    if (agentInsights.length > 0 && insightsRef.current) {
      insightsRef.current.scrollTop = insightsRef.current.scrollHeight;
    }
  }, [agentInsights]);

  // Auto-scroll thinking area when content updates
  useEffect(() => {
    if (streamingThinking && thinkingRef.current && showThinking) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
    }
  }, [streamingThinking, showThinking]);

  // Auto-scroll streaming text area when content updates
  useEffect(() => {
    if (streamingText && streamingTextRef.current && showStreamingPreview) {
      streamingTextRef.current.scrollTop = streamingTextRef.current.scrollHeight;
    }
  }, [streamingText, showStreamingPreview]);

  const approvedCount = getApprovedSourcesCount();
  const pendingCount = getPendingSourcesCount();
  const totalFound = Object.values(discoveredSources).flat().length;

  const handleStartGathering = () => {
    startDataGathering(userConfig);
  };

  const handleClearAll = async () => {
    await clearAllSources();
    setClearConfirmOpen(false);
  };

  const handleDownloadSource = async (sourceId) => {
    setDownloadingSourceId(sourceId);
    try {
      await downloadSourceAsPDF(sourceId);
    } catch (err) {
      console.error('Error downloading source:', err);
    } finally {
      setDownloadingSourceId(null);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Only PDF files are allowed');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('File size must be less than 50MB');
      return;
    }

    try {
      await uploadPDF(file);
      event.target.value = '';
    } catch (err) {
      console.error('Error uploading PDF:', err);
    }
  };

  const handleDeletePDF = async (pdfId) => {
    if (window.confirm('Are you sure you want to delete this PDF?')) {
      try {
        await deletePDF(pdfId);
      } catch (err) {
        console.error('Error deleting PDF:', err);
      }
    }
  };

  const handleDeleteReport = async () => {
    if (!window.confirm('Are you sure you want to delete this report? You can regenerate it later.')) {
      return;
    }

    try {
      await deleteReport();
    } catch (err) {
      console.error('Error deleting report:', err);
      alert('Failed to delete report: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeletePodcast = async () => {
    if (!window.confirm('Are you sure you want to delete this podcast? You can regenerate it later.')) {
      return;
    }

    try {
      await deletePodcast();
    } catch (err) {
      console.error('Error deleting podcast:', err);
      alert('Failed to delete podcast: ' + (err.response?.data?.error || err.message));
    }
  };

  const getTotalPDFSize = () => {
    return pdfs.reduce((sum, pdf) => sum + (pdf.size || 0), 0);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Phase status helpers
  const phase1Status = gatheringInProgress ? 'in_progress' : totalFound > 0 ? 'completed' : 'pending';
  const phase2Status = reportInProgress ? 'in_progress' : currentReport ? 'completed' : totalFound > 0 || pdfs.length > 0 ? 'ready' : 'pending';
  const phase3Status = podcastInProgress ? 'in_progress' : currentPodcast ? 'completed' : currentReport ? 'ready' : 'pending';

  const togglePhase = (phase) => {
    setExpandedPhase(prev => ({ ...prev, [phase]: !prev[phase] }));
  };

  return (
    <Box>
      {/* Header */}
      <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #d97757 0%, #c25a39 100%)', color: 'white' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <img
                  src="/claude-icon.svg"
                  alt="Claude AI"
                  style={{ width: 24, height: 24 }}
                />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  AI Research Builder
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Three-phase workflow: Gather → Analyze → Podcast
              </Typography>
            </Box>
            {totalFound > 0 && !gatheringInProgress && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<DeleteSweepIcon />}
                onClick={() => setClearConfirmOpen(true)}
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.5)',
                  '&:hover': {
                    borderColor: 'white',
                    backgroundColor: 'rgba(255,255,255,0.1)'
                  }
                }}
              >
                Clear All
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => {}}>
          {error}
        </Alert>
      )}

      {/* Phase 1: Data Gathering */}
      <Card sx={{ mb: 2, border: phase1Status === 'completed' ? '2px solid #4caf50' : '1px solid #e0e0e0' }}>
        <CardContent sx={{ p: 0 }}>
          <Accordion 
            expanded={expandedPhase.phase1} 
            onChange={() => togglePhase('phase1')}
            sx={{ boxShadow: 'none' }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: phase1Status === 'completed' ? '#f1f8f4' : phase1Status === 'in_progress' ? '#fff3e0' : '#fafafa',
                borderBottom: '1px solid #e0e0e0',
                px: 3,
                py: 2
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {phase1Status === 'completed' ? (
                    <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 28 }} />
                  ) : phase1Status === 'in_progress' ? (
                    <CircularProgress size={24} />
                  ) : (
                    <RadioButtonUncheckedIcon sx={{ color: '#ccc', fontSize: 28 }} />
                  )}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Phase 1: Data Gathering
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {phase1Status === 'completed' 
                      ? `${totalFound} sources discovered • ${approvedCount} approved`
                      : phase1Status === 'in_progress'
                      ? `Searching for sources... (${gatheringProgress}%)`
                      : 'Search the web for investor materials, transcripts, and analyst reports'}
                  </Typography>
                </Box>
                {phase1Status === 'completed' && (
                  <Chip label="Complete" color="success" size="small" />
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 3, py: 3 }}>
              {phase1Status === 'pending' && !gatheringInProgress && (
                <>
                  <Alert severity="info" sx={{ mb: 3 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                      The following sources will be searched (recent & non-paywalled):
                    </Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2 }}>
                      <li><Typography variant="body2">Investor Presentations (PDFs from official IR sites)</Typography></li>
                      <li><Typography variant="body2">Earnings Call Transcripts (full transcripts, not summaries)</Typography></li>
                      <li><Typography variant="body2">Strategy & Analysis Documents (consulting firm reports, strategy docs)</Typography></li>
                      <li><Typography variant="body2">Analyst Reports (Forrester, Gartner, IDC, JD Power)</Typography></li>
                    </Box>
                  </Alert>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<SearchIcon />}
                    onClick={handleStartGathering}
                    disabled={gatheringInProgress}
                    fullWidth
                  >
                    Start Data Gathering
                  </Button>
                </>
              )}

              {gatheringInProgress && (
                <>
                  <LinearProgress variant="determinate" value={gatheringProgress} sx={{ mb: 2 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 2 }}>
                    Searching for sources... ({gatheringProgress}%)
                  </Typography>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => cancelJob('gather-sources')}
                    fullWidth
                  >
                    Cancel
                  </Button>
                </>
              )}

              {phase1Status === 'completed' && (
                <>
                  {/* Call Report Data Card */}
                  <Card sx={{ mb: 3, border: '2px solid #4caf50', bgcolor: '#f1f8f4' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <CheckCircleIcon sx={{ color: '#4caf50' }} />
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          Financial Statement Data (Call Reports)
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Always included in analysis
                      </Typography>
                    </CardContent>
                  </Card>

                  {/* Discovered Sources */}
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Discovered Sources
                      </Typography>
                      <Chip label={`${totalFound} sources`} color="primary" />
                    </Box>

                    {Object.entries(discoveredSources).map(([category, sources]) => (
                      sources.length > 0 && (
                        <Accordion key={category} defaultExpanded sx={{ mb: 1 }}>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography sx={{ fontWeight: 600 }}>
                              {CATEGORY_LABELS[category]} ({sources.length})
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            {sources.map(source => (
                              <SourceCard
                                key={source.id}
                                source={source}
                                onDownload={handleDownloadSource}
                                downloading={downloadingSourceId === source.id}
                              />
                            ))}
                          </AccordionDetails>
                        </Accordion>
                      )
                    ))}
                  </Box>

                  {/* PDF Documents */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        PDF Documents
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Chip label={`${pdfs.length} / 20`} size="small" />
                        <Chip label={`${formatFileSize(getTotalPDFSize())} / 100 MB`} size="small" />
                      </Box>
                    </Box>

                    <input
                      accept=".pdf"
                      style={{ display: 'none' }}
                      id="pdf-upload-input"
                      type="file"
                      onChange={handleFileUpload}
                      disabled={pdfUploading || pdfs.length >= 20}
                    />
                    <label htmlFor="pdf-upload-input">
                      <Button
                        variant="outlined"
                        component="span"
                        startIcon={pdfUploading ? null : <UploadFileIcon />}
                        disabled={pdfUploading || pdfs.length >= 20}
                        fullWidth
                        sx={{ mb: 2 }}
                      >
                        {pdfUploading ? 'Uploading...' : 'Upload PDF'}
                      </Button>
                    </label>

                    {pdfs.length > 0 && (
                      <Box>
                        {pdfs.map(pdf => (
                          <Paper
                            key={pdf.id}
                            sx={{
                              p: 1.5,
                              mb: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              '&:hover': { boxShadow: 2 }
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
                              <PictureAsPdfIcon sx={{ color: '#d32f2f', flexShrink: 0 }} />
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {pdf.filename}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatFileSize(pdf.size)}
                                </Typography>
                              </Box>
                            </Box>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeletePDF(pdf.id)}
                              title="Delete PDF"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Paper>
                        ))}
                      </Box>
                    )}
                  </Box>
                </>
              )}
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>

      {/* Phase 2: Report Generation */}
      <Card sx={{ mb: 2, border: phase2Status === 'completed' ? '2px solid #4caf50' : '1px solid #e0e0e0' }}>
        <CardContent sx={{ p: 0 }}>
          <Accordion 
            expanded={expandedPhase.phase2} 
            onChange={() => togglePhase('phase2')}
            sx={{ boxShadow: 'none' }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: phase2Status === 'completed' ? '#f1f8f4' : phase2Status === 'in_progress' ? '#fff3e0' : '#fafafa',
                borderBottom: '1px solid #e0e0e0',
                px: 3,
                py: 2
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {phase2Status === 'completed' ? (
                    <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 28 }} />
                  ) : phase2Status === 'in_progress' ? (
                    <CircularProgress size={24} />
                  ) : (
                    <RadioButtonUncheckedIcon sx={{ color: '#ccc', fontSize: 28 }} />
                  )}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Phase 2: Report Generation
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {phase2Status === 'completed' 
                      ? `Report generated ${formatRelativeTime(currentReport?.generatedAt)}`
                      : phase2Status === 'in_progress'
                      ? `Generating report... (${reportProgress}%)`
                      : phase2Status === 'ready'
                      ? 'Ready to generate comprehensive analysis'
                      : 'Complete Phase 1 first'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  {phase2Status === 'completed' && (
                    <>
                      <Chip 
                        icon={<AccessTimeIcon sx={{ fontSize: 16 }} />}
                        label={formatRelativeTime(currentReport?.generatedAt)}
                        size="small"
                        variant="outlined"
                      />
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteReport();
                        }}
                        title="Delete report"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </>
                  )}
                  {phase2Status === 'completed' && (
                    <Chip label="Complete" color="success" size="small" />
                  )}
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 3, py: 3 }}>
              {phase2Status === 'ready' && !reportInProgress && (
                <>
                  <Alert severity="info" sx={{ mb: 3 }}>
                    <Typography variant="body2">
                      Generate comprehensive analysis using call report data, discovered sources, and attached PDFs.
                    </Typography>
                  </Alert>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<PsychologyIcon />}
                    onClick={generateAgentReport}
                    disabled={reportInProgress || !totalFound}
                    fullWidth
                    color="secondary"
                    sx={{ mb: 2 }}
                  >
                    Generate Agent Report
                  </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    <strong>Agent Mode:</strong> AI adaptively explores data, queries sources, and builds insights.
                  </Typography>
                </>
              )}

              {reportInProgress && (
                <>
                  <LinearProgress variant="determinate" value={reportProgress} sx={{ mb: 2 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                    {currentPhase === 'agent_research' 
                      ? `Agent exploring data and sources (${reportProgress}%)`
                      : `Generating report... (${reportProgress}%)`}
                  </Typography>

                  {/* Agent Milestones */}
                  {currentPhase === 'agent_research' && agentMilestones.length > 0 && (
                    <Paper
                      ref={milestonesRef}
                      sx={{ p: 2, mb: 2, bgcolor: '#f8f9ff', border: '1px solid #d97757', maxHeight: 200, overflow: 'auto' }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <img
                          src="/claude-icon.svg"
                          alt="Claude AI"
                          style={{ width: 18, height: 18 }}
                        />
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#d97757' }}>
                          Agent Activity Log
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {agentMilestones.slice(-10).map((milestone, idx) => (
                          <Box key={idx} sx={{ display: 'flex', gap: 1 }}>
                            <Chip label="✓" size="small" sx={{ bgcolor: '#d97757', color: 'white', height: 20, minWidth: 20 }} />
                            <Typography variant="caption">{milestone.message}</Typography>
                          </Box>
                        ))}
                      </Box>
                    </Paper>
                  )}

                  {/* Agent Insights */}
                  {currentPhase === 'agent_research' && agentInsights.length > 0 && (
                    <Paper 
                      ref={insightsRef}
                      sx={{ p: 2, mb: 2, bgcolor: '#fff9e6', border: '1px solid #ffc107', maxHeight: 200, overflow: 'auto' }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#f57c00' }}>
                        Key Insights ({agentInsights.length})
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {agentInsights.map((insight, idx) => (
                          <Box key={idx} sx={{ pl: 2, borderLeft: '2px solid #ffc107' }}>
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                              {insight.title}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Paper>
                  )}

                  {/* Streaming Thinking */}
                  {streamingThinking && (
                    <Accordion expanded={showThinking} onChange={() => setShowThinking(!showThinking)} sx={{ mb: 2 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle2">Claude's Thinking Process</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Paper 
                          ref={thinkingRef}
                          sx={{ p: 2, bgcolor: '#f5f5f5', maxHeight: 300, overflow: 'auto' }}
                        >
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                            {streamingThinking}
                          </Typography>
                        </Paper>
                      </AccordionDetails>
                    </Accordion>
                  )}

                  {/* Streaming Preview */}
                  {streamingText && (
                    <Accordion expanded={showStreamingPreview} onChange={() => setShowStreamingPreview(!showStreamingPreview)}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle2">Report Preview (Streaming...)</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Paper 
                          ref={streamingTextRef}
                          sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}
                        >
                          <ReactMarkdown>{streamingText}</ReactMarkdown>
                        </Paper>
                      </AccordionDetails>
                    </Accordion>
                  )}

                  <Button
                    size="small"
                    color="error"
                    onClick={() => cancelJob('report')}
                    sx={{ mt: 2 }}
                    fullWidth
                  >
                    Cancel
                  </Button>
                </>
              )}

              {phase2Status === 'completed' && currentReport && !reportInProgress && (
                <>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Report Generated Successfully
                    </Typography>
                    <Typography variant="caption">
                      Generated {formatRelativeTime(currentReport.generatedAt)} • Model: {currentReport.model || 'Claude Sonnet 4.5'}
                    </Typography>
                  </Alert>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                      Regenerate Report
                    </Typography>
                    <Button
                      variant="outlined"
                      size="medium"
                      startIcon={<PsychologyIcon />}
                      onClick={generateAgentReport}
                      disabled={reportInProgress || !totalFound}
                      fullWidth
                      color="secondary"
                    >
                      Regenerate Agent Report
                    </Button>
                  </Box>
                </>
              )}
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>

      {/* Phase 3: Podcast Generation */}
      <Card sx={{ mb: 2, border: phase3Status === 'completed' ? '2px solid #4caf50' : '1px solid #e0e0e0' }}>
        <CardContent sx={{ p: 0 }}>
          <Accordion 
            expanded={expandedPhase.phase3} 
            onChange={() => togglePhase('phase3')}
            sx={{ boxShadow: 'none' }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: phase3Status === 'completed' ? '#f1f8f4' : phase3Status === 'in_progress' ? '#fff3e0' : '#fafafa',
                borderBottom: '1px solid #e0e0e0',
                px: 3,
                py: 2
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {phase3Status === 'completed' ? (
                    <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 28 }} />
                  ) : phase3Status === 'in_progress' ? (
                    <CircularProgress size={24} />
                  ) : (
                    <RadioButtonUncheckedIcon sx={{ color: '#ccc', fontSize: 28 }} />
                  )}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Phase 3: Podcast Generation
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {phase3Status === 'completed' 
                      ? `Podcast generated ${formatRelativeTime(currentPodcast?.generatedAt || currentPodcast?.timestamp)}`
                      : phase3Status === 'in_progress'
                      ? `Generating podcast... (${podcastProgress}%)`
                      : phase3Status === 'ready'
                      ? 'Convert your research report into "The Bankskie Show" podcast'
                      : 'Complete Phase 2 first'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  {phase3Status === 'completed' && (
                    <>
                      <Chip 
                        icon={<AccessTimeIcon sx={{ fontSize: 16 }} />}
                        label={formatRelativeTime(currentPodcast?.generatedAt || currentPodcast?.timestamp)}
                        size="small"
                        variant="outlined"
                      />
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePodcast();
                        }}
                        title="Delete podcast"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </>
                  )}
                  {phase3Status === 'completed' && (
                    <Chip label="Complete" color="success" size="small" />
                  )}
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 3, py: 3 }}>
              {phase3Status === 'ready' && !podcastInProgress && (
                <>
                  <Alert severity="info" sx={{ mb: 3 }}>
                    <Typography variant="body2">
                      Select expert voices to include in your podcast discussion.
                    </Typography>
                  </Alert>

                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      Select Podcast Experts:
                    </Typography>
                    <FormGroup>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selectedPodcastExperts.includes('WARREN_VAULT')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPodcastExperts(prev => [...prev, 'WARREN_VAULT']);
                              } else {
                                setSelectedPodcastExperts(prev => prev.filter(ex => ex !== 'WARREN_VAULT'));
                              }
                            }}
                          />
                        }
                        label="Warren Vault (Investor Analyst)"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selectedPodcastExperts.includes('DR_SOFIA_BANKS')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPodcastExperts(prev => [...prev, 'DR_SOFIA_BANKS']);
                              } else {
                                setSelectedPodcastExperts(prev => prev.filter(ex => ex !== 'DR_SOFIA_BANKS'));
                              }
                            }}
                          />
                        }
                        label="Dr. Sofia Banks (Banking Professor)"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selectedPodcastExperts.includes('AVA_AGENTIC')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPodcastExperts(prev => [...prev, 'AVA_AGENTIC']);
                              } else {
                                setSelectedPodcastExperts(prev => prev.filter(ex => ex !== 'AVA_AGENTIC'));
                              }
                            }}
                          />
                        }
                        label="Ava Agentic (AI/Tech Expert)"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selectedPodcastExperts.includes('MAYA_CUSTOMER')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPodcastExperts(prev => [...prev, 'MAYA_CUSTOMER']);
                              } else {
                                setSelectedPodcastExperts(prev => prev.filter(ex => ex !== 'MAYA_CUSTOMER'));
                              }
                            }}
                          />
                        }
                        label="Maya Customer (Customer Experience)"
                      />
                    </FormGroup>
                  </Box>

                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<PodcastsIcon />}
                    onClick={() => generatePodcast(selectedPodcastExperts)}
                    disabled={podcastInProgress || selectedPodcastExperts.length === 0}
                    fullWidth
                  >
                    Generate Podcast
                  </Button>
                </>
              )}

              {podcastInProgress && (
                <>
                  <LinearProgress variant="determinate" value={podcastProgress} sx={{ mb: 2 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                    {podcastStatus || `Generating podcast... (${podcastProgress}%)`}
                  </Typography>
                </>
              )}

              {phase3Status === 'completed' && currentPodcast && !podcastInProgress && (
                <>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Podcast Generated Successfully
                    </Typography>
                    <Typography variant="caption">
                      Generated {formatRelativeTime(currentPodcast.generatedAt || currentPodcast.timestamp)}
                      {currentPodcast.duration && ` • ~${currentPodcast.duration} minutes`}
                    </Typography>
                  </Alert>
                  <Box sx={{ mb: 2 }}>
                    <audio
                      controls
                      style={{ width: '100%', borderRadius: '8px' }}
                      src={currentPodcast.url}
                    >
                      Your browser does not support the audio element.
                    </audio>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                      Regenerate Podcast
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                        Select Podcast Experts:
                      </Typography>
                      <FormGroup>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={selectedPodcastExperts.includes('WARREN_VAULT')}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPodcastExperts(prev => [...prev, 'WARREN_VAULT']);
                                } else {
                                  setSelectedPodcastExperts(prev => prev.filter(ex => ex !== 'WARREN_VAULT'));
                                }
                              }}
                            />
                          }
                          label="Warren Vault (Investor Analyst)"
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={selectedPodcastExperts.includes('DR_SOFIA_BANKS')}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPodcastExperts(prev => [...prev, 'DR_SOFIA_BANKS']);
                                } else {
                                  setSelectedPodcastExperts(prev => prev.filter(ex => ex !== 'DR_SOFIA_BANKS'));
                                }
                              }}
                            />
                          }
                          label="Dr. Sofia Banks (Banking Professor)"
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={selectedPodcastExperts.includes('AVA_AGENTIC')}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPodcastExperts(prev => [...prev, 'AVA_AGENTIC']);
                                } else {
                                  setSelectedPodcastExperts(prev => prev.filter(ex => ex !== 'AVA_AGENTIC'));
                                }
                              }}
                            />
                          }
                          label="Ava Agentic (AI/Tech Expert)"
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={selectedPodcastExperts.includes('MAYA_CUSTOMER')}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPodcastExperts(prev => [...prev, 'MAYA_CUSTOMER']);
                                } else {
                                  setSelectedPodcastExperts(prev => prev.filter(ex => ex !== 'MAYA_CUSTOMER'));
                                }
                              }}
                            />
                          }
                          label="Maya Customer (Customer Experience)"
                        />
                      </FormGroup>
                    </Box>
                    <Button
                      variant="outlined"
                      size="large"
                      startIcon={<PodcastsIcon />}
                      onClick={() => generatePodcast(selectedPodcastExperts)}
                      disabled={podcastInProgress || selectedPodcastExperts.length === 0}
                      fullWidth
                    >
                      Regenerate Podcast
                    </Button>
                  </Box>
                </>
              )}
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>

      {/* Clear All Confirmation Dialog */}
      <Dialog
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Clear All Data?</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will permanently delete ALL data for this bank:
          </Alert>
          <Box component="ul" sx={{ mt: 1, mb: 2, pl: 2 }}>
            <li><Typography variant="body2">All {totalFound} discovered sources</Typography></li>
            <li><Typography variant="body2">Generated reports</Typography></li>
            <li><Typography variant="body2">Generated podcasts</Typography></li>
          </Box>
          <Typography variant="body2" color="text.secondary">
            You will need to run all three phases again. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleClearAll}
            color="error"
            variant="contained"
            startIcon={<DeleteSweepIcon />}
          >
            Clear All Data
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AIBuilderTab;
