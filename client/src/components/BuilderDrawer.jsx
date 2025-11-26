import React, { useState, useEffect, useRef } from 'react';
import { useAI } from '../contexts/AIContext';
import RAGManagementTab from './RAGManagementTab';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Paper,
  Chip,
  Divider,
  TextField,
  FormControlLabel,
  Checkbox,
  FormGroup,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MinimizeIcon from '@mui/icons-material/Minimize';
import MaximizeIcon from '@mui/icons-material/Maximize';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import PsychologyIcon from '@mui/icons-material/Psychology';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LinkIcon from '@mui/icons-material/Link';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CategoryIcon from '@mui/icons-material/Category';
import StorageIcon from '@mui/icons-material/Storage';

/**
 * Terminal-style log viewer
 */
function TerminalLog({ logs, title }) {
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <Paper
      sx={{
        bgcolor: '#1e1e1e',
        color: '#d4d4d4',
        p: 2,
        fontFamily: 'monospace',
        fontSize: '0.85rem',
        maxHeight: 400,
        overflowY: 'auto',
        borderRadius: 1
      }}
    >
      {title && (
        <Typography variant="caption" sx={{ color: '#4ec9b0', mb: 1, display: 'block' }}>
          {title}
        </Typography>
      )}
      {logs.length === 0 ? (
        <Typography variant="caption" sx={{ color: '#858585', fontStyle: 'italic' }}>
          No activity yet...
        </Typography>
      ) : (
        <Box>
          {logs.map((log, idx) => (
            <Box key={idx} sx={{ mb: 0.5, display: 'flex', gap: 1 }}>
              <Typography
                component="span"
                sx={{
                  color: log.type === 'error' ? '#f48771' : log.type === 'success' ? '#4ec9b0' : '#858585',
                  fontSize: '0.8rem'
                }}
              >
                [{new Date(log.timestamp).toLocaleTimeString()}]
              </Typography>
              <Typography
                component="span"
                sx={{
                  color: log.type === 'error' ? '#f48771' : log.type === 'success' ? '#4ec9b0' : '#d4d4d4',
                  fontSize: '0.8rem',
                  flex: 1
                }}
              >
                {log.message}
              </Typography>
            </Box>
          ))}
          <div ref={logEndRef} />
        </Box>
      )}
    </Paper>
  );
}

/**
 * BuilderDrawer - Minimizable builder interface (now managed by BuilderManagerContext)
 */
function BuilderDrawer({ open, onClose, onMinimize, idrssd, bankName }) {
  const {
    gatheringInProgress,
    discoveredSources,
    reportInProgress,
    currentPhase,
    agentMilestones,
    agentInsights,
    currentReport,
    currentPodcast,
    error,
    pdfs,
    pdfUploading,
    ragStats,
    documentChecklist,
    insightExtracting,
    insightProgress,
    insightStatus,
    podcastInProgress,
    podcastStatus,
    startDataGathering,
    generateAgentReport,
    generatePodcast,
    cancelJob,
    clearAllSources,
    uploadPDF,
    deletePDF,
    loadPDFs,
    deleteReport,
    deletePodcast,
    metadataStatus,
    metadata,
    setSourceDocumentType,
    uploadSourceToRAG,
    extractInsights,
    loadDocumentChecklist,
    refreshRAG,
    deleteRAG
  } = useAI();
  const [expandedSection, setExpandedSection] = useState('phase1');
  const [selectedPodcastExperts, setSelectedPodcastExperts] = useState([
    'WARREN_VAULT',
    'DR_SOFIA_BANKS',
    'AVA_AGENTIC'
  ]);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [ragRefreshing, setRagRefreshing] = useState(false);
  const [ragDeleting, setRagDeleting] = useState(false);

  // State for document type selection and upload status (by source ID)
  const [sourceDocTypes, setSourceDocTypes] = useState({});
  const [sourceUploading, setSourceUploading] = useState({});

  // Initialize document types from sources when they load
  useEffect(() => {
    if (discoveredSources && discoveredSources.length > 0) {
      const docTypes = {};
      discoveredSources.forEach(source => {
        docTypes[source.id] = source.documentType || '';
      });
      setSourceDocTypes(docTypes);
    }
  }, [discoveredSources]);

  // Convert milestones and insights to terminal logs
  useEffect(() => {
    const logs = [];

    // Add milestones
    agentMilestones.forEach(milestone => {
      logs.push({
        timestamp: milestone.timestamp || Date.now(),
        message: milestone.message,
        type: 'info'
      });
    });

    // Add insights
    agentInsights.forEach(insight => {
      logs.push({
        timestamp: insight.timestamp || Date.now(),
        message: `💡 ${insight.title}: ${insight.content}`,
        type: 'success'
      });
    });

    // Add error if present
    if (error) {
      logs.push({
        timestamp: Date.now(),
        message: `❌ Error: ${error}`,
        type: 'error'
      });
    }

    // Sort by timestamp
    logs.sort((a, b) => a.timestamp - b.timestamp);

    setTerminalLogs(logs);
  }, [agentMilestones, agentInsights, error]);

  const totalFound = Object.values(discoveredSources).flat().length;

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

  const handleDownloadPDFFromSource = async (source) => {
    try {
      const response = await fetch(`/api/research/${idrssd}/sources/${source.id}/download-pdf`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to download PDF');
        return;
      }

      const result = await response.json();
      alert(`PDF downloaded successfully: ${result.pdf.filename}`);
      // Reload PDFs to show the new one
      await loadPDFs();
    } catch (error) {
      console.error('Error downloading PDF from source:', error);
      alert('Failed to download PDF. Please try again.');
    }
  };

  const handleRefreshRAG = async () => {
    try {
      setRagRefreshing(true);
      const result = await refreshRAG();
      if (result.reprocessedCount > 0) {
        alert(`Successfully reprocessed ${result.reprocessedCount} document(s)`);
      } else {
        alert('No documents needed reprocessing');
      }
    } catch (err) {
      console.error('Error refreshing RAG:', err);
      alert('Failed to refresh RAG. Please try again.');
    } finally {
      setRagRefreshing(false);
    }
  };

  const handleDeleteRAG = async () => {
    if (!window.confirm('Are you sure you want to delete the entire RAG environment? This will remove all embedded documents and reset strategic insights. This action cannot be undone.')) {
      return;
    }

    try {
      setRagDeleting(true);
      const result = await deleteRAG();

      // Build detailed success message
      const details = [];
      if (result.deletedDocuments > 0) {
        details.push(`${result.deletedDocuments} document(s)`);
      }
      if (result.deletedChunks > 0) {
        details.push(`${result.deletedChunks} chunk(s)`);
      }
      if (result.resetPDFs > 0) {
        details.push(`${result.resetPDFs} PDF(s) reset`);
      }

      const message = details.length > 0
        ? `Successfully deleted RAG environment:\n• ${details.join('\n• ')}`
        : 'RAG environment is already clean (no data to delete).';

      if (result.errors > 0) {
        alert(`${message}\n\nWarning: ${result.errors} error(s) occurred during deletion.`);
      } else {
        alert(message);
      }

      console.log('Delete RAG result:', result);
    } catch (err) {
      console.error('Error deleting RAG:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Unknown error';
      alert(`Failed to delete RAG environment:\n${errorMessage}\n\nCheck the console for details.`);
    } finally {
      setRagDeleting(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getTotalPDFSize = () => {
    return pdfs.reduce((sum, pdf) => sum + (pdf.size || 0), 0);
  };

  // Helper to render RAG status badge
  const getRagStatusBadge = (ragStatus) => {
    const statusConfig = {
      completed: { label: 'In RAG', color: 'success', icon: '✓' },
      processing: { label: 'Processing', color: 'info', icon: '⟳' },
      failed: { label: 'Failed', color: 'error', icon: '✗' },
      pending: { label: 'Pending', color: 'default', icon: '⏱' }
    };

    const config = statusConfig[ragStatus] || statusConfig.pending;
    return (
      <Chip
        label={`${config.icon} ${config.label}`}
        color={config.color}
        size="small"
        sx={{ fontSize: '0.7rem', height: 20 }}
      />
    );
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: '75%', md: '75%' },
          p: 0
        }
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box
          sx={{
            p: 2,
            background: 'linear-gradient(135deg, #d97757 0%, #c25a39 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <img src="/claude-icon.svg" alt="Claude AI" style={{ width: 28, height: 28 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                AI Research Builder
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                {bankName}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton size="small" onClick={onMinimize} sx={{ color: 'white' }}>
              <MinimizeIcon />
            </IconButton>
            <IconButton size="small" onClick={onClose} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Comprehensive Status Section */}
          <Paper elevation={2} sx={{ p: 2, mb: 3, bgcolor: '#f8f9fa' }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CategoryIcon /> Research Status
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              {/* Document Checklist */}
              <Paper elevation={1} sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: '#d97757' }}>
                  Document Checklist
                </Typography>
                {documentChecklist ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption">Investor Presentations</Typography>
                      <Chip
                        label={documentChecklist.investor_presentation?.length || 0}
                        size="small"
                        color={documentChecklist.investor_presentation?.length > 0 ? 'success' : 'default'}
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption">Management Interviews</Typography>
                      <Chip
                        label={documentChecklist.management_interview?.length || 0}
                        size="small"
                        color={documentChecklist.management_interview?.length > 0 ? 'success' : 'default'}
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption">Earnings Transcripts</Typography>
                      <Chip
                        label={documentChecklist.earnings_transcript?.length || 0}
                        size="small"
                        color={documentChecklist.earnings_transcript?.length > 0 ? 'success' : 'default'}
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption">Tech Announcements</Typography>
                      <Chip
                        label={documentChecklist.tech_announcement?.length || 0}
                        size="small"
                        color={documentChecklist.tech_announcement?.length > 0 ? 'success' : 'default'}
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </Box>
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary">No documents categorized yet</Typography>
                )}
              </Paper>

              {/* RAG Infrastructure */}
              <Paper elevation={1} sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: '#d97757' }}>
                  RAG Infrastructure
                </Typography>
                {ragStats && ragStats.documentCount > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption">Documents in RAG</Typography>
                      <Chip
                        label={ragStats.documentCount}
                        size="small"
                        color="success"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption">Total Chunks</Typography>
                      <Chip
                        label={ragStats.chunkCount}
                        size="small"
                        color="info"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </Box>
                    {/* Document List */}
                    {ragStats.documents && ragStats.documents.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                          Documents:
                        </Typography>
                        <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                          {ragStats.documents.map((doc, idx) => (
                            <Box
                              key={doc._id}
                              sx={{
                                p: 0.5,
                                mb: 0.5,
                                bgcolor: '#f5f5f5',
                                borderRadius: 0.5,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5
                              }}
                            >
                              <PictureAsPdfIcon sx={{ fontSize: 14, color: '#d32f2f', flexShrink: 0 }} />
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontSize: '0.7rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    display: 'block'
                                  }}
                                  title={doc.title || doc.filename}
                                >
                                  {doc.title || doc.filename}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25 }}>
                                  {doc.processingStatus === 'completed' && (
                                    <CheckCircleIcon sx={{ fontSize: 10, color: 'success.main' }} />
                                  )}
                                  {doc.topics && doc.topics.length > 0 && (
                                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                                      {doc.topics.slice(0, 2).join(', ')}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    )}
                    <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        fullWidth
                        onClick={handleRefreshRAG}
                        disabled={ragRefreshing || ragDeleting}
                        sx={{ fontSize: '0.7rem', py: 0.5 }}
                      >
                        {ragRefreshing ? 'Refreshing...' : 'Refresh RAG'}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        fullWidth
                        onClick={handleDeleteRAG}
                        disabled={ragDeleting || ragRefreshing}
                        sx={{ fontSize: '0.7rem', py: 0.5 }}
                      >
                        {ragDeleting ? 'Deleting...' : 'Delete RAG'}
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary">No documents in RAG yet</Typography>
                )}
              </Paper>

              {/* Strategic Insights */}
              <Paper elevation={1} sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: '#d97757' }}>
                  Strategic Insights
                </Typography>
                {metadata?.strategicInsights?.status === 'completed' ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption">Priorities Identified</Typography>
                      <Chip
                        label={metadata.strategicInsights.priorities?.length || 0}
                        size="small"
                        color="success"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption">Focus Metrics</Typography>
                      <Chip
                        label={metadata.strategicInsights.focusMetrics?.length || 0}
                        size="small"
                        color="success"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption">Tech Partnerships</Typography>
                      <Chip
                        label={metadata.strategicInsights.techPartnerships?.length || 0}
                        size="small"
                        color="success"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                    </Box>
                  </Box>
                ) : insightExtracting ? (
                  <Box>
                    <Typography variant="caption" color="info.main">{insightStatus}</Typography>
                    <LinearProgress variant="determinate" value={insightProgress} sx={{ mt: 0.5 }} />
                  </Box>
                ) : (
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      Not extracted yet
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      fullWidth
                      onClick={extractInsights}
                      disabled={!ragStats || ragStats.completedDocuments === 0}
                      sx={{ fontSize: '0.75rem', py: 0.5 }}
                    >
                      Extract Insights from RAG
                    </Button>
                  </Box>
                )}
              </Paper>

              {/* Metadata Status */}
              <Paper elevation={1} sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: '#d97757' }}>
                  Metadata
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption">Logo</Typography>
                    {metadataStatus.logo.status === 'success' ? (
                      <CheckCircleIcon sx={{ color: 'success.main', fontSize: 16 }} />
                    ) : (
                      <CancelIcon sx={{ color: 'text.disabled', fontSize: 16 }} />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption">Ticker</Typography>
                    {metadataStatus.ticker.status === 'success' ? (
                      <CheckCircleIcon sx={{ color: 'success.main', fontSize: 16 }} />
                    ) : (
                      <CancelIcon sx={{ color: 'text.disabled', fontSize: 16 }} />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption">Org Chart</Typography>
                    {metadataStatus.orgChart.status === 'success' ? (
                      <CheckCircleIcon sx={{ color: 'success.main', fontSize: 16 }} />
                    ) : (
                      <CancelIcon sx={{ color: 'text.disabled', fontSize: 16 }} />
                    )}
                  </Box>
                </Box>
              </Paper>
            </Box>
          </Paper>

          {/* Terminal Log - Always visible when job is running */}
          {(gatheringInProgress || reportInProgress || podcastInProgress) && (
            <Box sx={{ mb: 3 }}>
              <TerminalLog
                logs={terminalLogs}
                title={
                  gatheringInProgress
                    ? '🔍 Gathering Data Sources...'
                    : reportInProgress
                    ? '🤖 Generating Report...'
                    : '🎙️ Generating Podcast...'
                }
              />
            </Box>
          )}

          {/* Phase 1: Data Gathering */}
          <Accordion
            expanded={expandedSection === 'phase1'}
            onChange={() => setExpandedSection(expandedSection === 'phase1' ? '' : 'phase1')}
            sx={{ mb: 2 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                {gatheringInProgress && <CircularProgress size={20} />}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Phase 1: Data Gathering
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {totalFound > 0
                      ? `${totalFound} sources discovered • ${pdfs.length} PDFs uploaded`
                      : 'Search for investor materials and reports'}
                  </Typography>
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {totalFound === 0 && !gatheringInProgress ? (
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<SearchIcon />}
                  onClick={() => startDataGathering({})}
                  disabled={gatheringInProgress}
                >
                  Start Data Gathering
                </Button>
              ) : (
                <>
                  {gatheringInProgress && (
                    <Button
                      variant="outlined"
                      color="error"
                      fullWidth
                      onClick={() => cancelJob('gather-sources')}
                      sx={{ mb: 2 }}
                    >
                      Cancel
                    </Button>
                  )}

                  {totalFound > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                        Discovered Sources ({totalFound})
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                        External sources found from web searches
                      </Typography>
                      <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                        {Object.entries(discoveredSources).map(([category, sources]) => (
                          sources.length > 0 && (
                            <Box key={category} sx={{ mb: 2 }}>
                              <Chip
                                label={`${category.replace(/([A-Z])/g, ' $1').trim()}: ${sources.length}`}
                                size="small"
                                sx={{ mb: 1 }}
                              />
                              {sources.map((source, idx) => {
                                const isPDF = source.url?.toLowerCase().endsWith('.pdf');
                                const docType = sourceDocTypes[source.id] || '';
                                const uploading = sourceUploading[source.id] || false;

                                const handleSetDocType = async (sourceId, type) => {
                                  try {
                                    await setSourceDocumentType(sourceId, type);
                                    setSourceDocTypes(prev => ({ ...prev, [sourceId]: type }));
                                  } catch (err) {
                                    console.error('Failed to set document type:', err);
                                    alert('Failed to set document type');
                                  }
                                };

                                const handleUploadToRAG = async (sourceId) => {
                                  try {
                                    setSourceUploading(prev => ({ ...prev, [sourceId]: true }));
                                    await uploadSourceToRAG(sourceId);
                                    alert('Document uploaded to RAG successfully!');
                                  } catch (err) {
                                    console.error('Failed to upload to RAG:', err);
                                    alert('Failed to upload to RAG: ' + err.message);
                                  } finally {
                                    setSourceUploading(prev => ({ ...prev, [sourceId]: false }));
                                  }
                                };

                                return (
                                  <Paper
                                    key={idx}
                                    sx={{
                                      p: 1.5,
                                      mb: 1,
                                      bgcolor: '#fafafa',
                                      '&:hover': { bgcolor: '#f0f0f0' }
                                    }}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                                      {isPDF && (
                                        <PictureAsPdfIcon sx={{ color: '#d32f2f', fontSize: 18, flexShrink: 0, mt: 0.2 }} />
                                      )}
                                      {!isPDF && (
                                        <LinkIcon sx={{ color: '#666', fontSize: 18, flexShrink: 0, mt: 0.2 }} />
                                      )}
                                      <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            fontWeight: 600,
                                            display: 'block',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                          }}
                                        >
                                          {source.title || 'Untitled'}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            color: 'text.secondary',
                                            fontSize: '0.7rem',
                                            display: 'block',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                          }}
                                        >
                                          {source.url}
                                        </Typography>
                                      </Box>
                                      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                                        {isPDF && (
                                          <IconButton
                                            size="small"
                                            onClick={() => handleDownloadPDFFromSource(source)}
                                            title="Download PDF and add to uploaded PDFs"
                                            sx={{ color: '#d97757' }}
                                          >
                                            <DownloadIcon fontSize="small" />
                                          </IconButton>
                                        )}
                                        <IconButton
                                          size="small"
                                          onClick={() => window.open(source.url, '_blank')}
                                          title="Open in new tab"
                                          sx={{ color: '#666' }}
                                        >
                                          <OpenInNewIcon fontSize="small" />
                                        </IconButton>
                                      </Box>
                                    </Box>

                                    {/* Document Categorization and RAG Upload */}
                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                      <FormControl size="small" sx={{ minWidth: 180, flex: 1 }}>
                                        <InputLabel sx={{ fontSize: '0.75rem' }}>Document Type</InputLabel>
                                        <Select
                                          value={docType}
                                          label="Document Type"
                                          onChange={(e) => handleSetDocType(source.id, e.target.value)}
                                          sx={{ fontSize: '0.75rem', height: 32 }}
                                        >
                                          <MenuItem value="investor_presentation">Investor Presentation</MenuItem>
                                          <MenuItem value="management_interview">Management Interview</MenuItem>
                                          <MenuItem value="earnings_transcript">Earnings Transcript</MenuItem>
                                          <MenuItem value="tech_announcement">Tech Announcement</MenuItem>
                                          <MenuItem value="other">Other</MenuItem>
                                        </Select>
                                      </FormControl>

                                      {isPDF && docType && (
                                        <Button
                                          size="small"
                                          variant="contained"
                                          startIcon={uploading ? <CircularProgress size={12} color="inherit" /> : <CloudUploadIcon />}
                                          onClick={() => handleUploadToRAG(source.id)}
                                          disabled={uploading || source.ragStatus === 'completed'}
                                          sx={{
                                            fontSize: '0.7rem',
                                            py: 0.5,
                                            px: 1.5,
                                            bgcolor: '#d97757',
                                            '&:hover': { bgcolor: '#c25a39' }
                                          }}
                                        >
                                          {source.ragStatus === 'completed' ? 'In RAG' : uploading ? 'Uploading...' : 'Upload to RAG'}
                                        </Button>
                                      )}

                                      {source.ragStatus === 'completed' && (
                                        <Chip
                                          label="✓ In RAG"
                                          size="small"
                                          color="success"
                                          sx={{ fontSize: '0.7rem', height: 24 }}
                                        />
                                      )}
                                    </Box>
                                  </Paper>
                                );
                              })}
                            </Box>
                          )
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* PDF Upload */}
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Upload PDFs ({pdfs.length}/20)
                  </Typography>
                  <input
                    accept=".pdf"
                    style={{ display: 'none' }}
                    id="pdf-upload-drawer"
                    type="file"
                    onChange={handleFileUpload}
                    disabled={pdfUploading || pdfs.length >= 20}
                  />
                  <label htmlFor="pdf-upload-drawer">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={pdfUploading ? <CircularProgress size={16} /> : <UploadFileIcon />}
                      disabled={pdfUploading || pdfs.length >= 20}
                      fullWidth
                      sx={{ mb: 1 }}
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
                            p: 1,
                            mb: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                            <PictureAsPdfIcon sx={{ color: '#d32f2f', fontSize: 20, flexShrink: 0 }} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography
                                variant="caption"
                                sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                              >
                                {pdf.filename}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                <Typography variant="caption" color="text.secondary">
                                  {formatFileSize(pdf.size)}
                                </Typography>
                                {pdf.ragStatus && getRagStatusBadge(pdf.ragStatus)}
                                {pdf.ragStatus === 'completed' && pdf.ragChunkCount > 0 && (
                                  <Typography variant="caption" color="text.secondary">
                                    • {pdf.ragChunkCount} chunks
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </Box>
                          <IconButton size="small" color="error" onClick={() => handleDeletePDF(pdf.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Paper>
                      ))}
                    </Box>
                  )}

                  {totalFound > 0 && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        startIcon={<DeleteSweepIcon />}
                        onClick={clearAllSources}
                        fullWidth
                      >
                        Clear All Sources
                      </Button>
                    </>
                  )}
                </>
              )}
            </AccordionDetails>
          </Accordion>

          {/* Phase 2: Report Generation */}
          <Accordion
            expanded={expandedSection === 'phase2'}
            onChange={() => setExpandedSection(expandedSection === 'phase2' ? '' : 'phase2')}
            sx={{ mb: 2 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                {reportInProgress && <CircularProgress size={20} />}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Phase 2: Report Generation
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {currentReport
                      ? 'Report generated'
                      : totalFound > 0 || (metadata?.strategicInsights?.status === 'completed')
                      ? 'Ready to generate'
                      : 'Complete Phase 1 first'}
                  </Typography>
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {!currentReport && !reportInProgress && (totalFound > 0 || (metadata?.strategicInsights?.status === 'completed')) && (
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<PsychologyIcon />}
                  onClick={generateAgentReport}
                  color="secondary"
                >
                  Generate Agent Report
                </Button>
              )}

              {reportInProgress && (
                <Button
                  variant="outlined"
                  color="error"
                  fullWidth
                  onClick={() => cancelJob('report')}
                >
                  Cancel
                </Button>
              )}

              {currentReport && !reportInProgress && (
                <>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    Report generated successfully
                  </Alert>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<PsychologyIcon />}
                    onClick={generateAgentReport}
                    sx={{ mb: 1 }}
                  >
                    Regenerate Report
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    fullWidth
                    onClick={deleteReport}
                  >
                    Delete Report
                  </Button>
                </>
              )}
            </AccordionDetails>
          </Accordion>

          {/* Phase 3: Podcast Generation */}
          <Accordion
            expanded={expandedSection === 'phase3'}
            onChange={() => setExpandedSection(expandedSection === 'phase3' ? '' : 'phase3')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                {podcastInProgress && <CircularProgress size={20} />}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Phase 3: Podcast Generation
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {currentPodcast
                      ? 'Podcast generated'
                      : currentReport
                      ? 'Ready to generate'
                      : 'Complete Phase 2 first'}
                  </Typography>
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {!currentPodcast && !podcastInProgress && currentReport && (
                <>
                  <Typography variant="caption" sx={{ mb: 1, display: 'block' }}>
                    Select Experts:
                  </Typography>
                  <FormGroup sx={{ mb: 2 }}>
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
                          size="small"
                        />
                      }
                      label={<Typography variant="caption">Warren Vault (Investor)</Typography>}
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
                          size="small"
                        />
                      }
                      label={<Typography variant="caption">Dr. Sofia Banks (Professor)</Typography>}
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
                          size="small"
                        />
                      }
                      label={<Typography variant="caption">Ava Agentic (AI/Tech)</Typography>}
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
                          size="small"
                        />
                      }
                      label={<Typography variant="caption">Maya Customer (CX Expert)</Typography>}
                    />
                  </FormGroup>
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<PodcastsIcon />}
                    onClick={() => generatePodcast(selectedPodcastExperts)}
                    disabled={selectedPodcastExperts.length === 0}
                  >
                    Generate Podcast
                  </Button>
                </>
              )}

              {podcastInProgress && (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                    {podcastStatus || 'Generating podcast...'}
                  </Typography>
                  <Button
                    variant="outlined"
                    color="error"
                    fullWidth
                    onClick={() => cancelJob('podcast')}
                  >
                    Cancel
                  </Button>
                </>
              )}

              {currentPodcast && !podcastInProgress && (
                <>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    Podcast generated successfully
                    {currentPodcast.duration && ` • ~${currentPodcast.duration} min`}
                  </Alert>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    fullWidth
                    onClick={deletePodcast}
                  >
                    Delete Podcast
                  </Button>
                </>
              )}
            </AccordionDetails>
          </Accordion>
        </Box>
      </Box>
    </Drawer>
  );
}

export default BuilderDrawer;
