import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  CircularProgress,
  Button,
  Paper,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Menu,
  MenuItem as MenuItemComponent,
  Divider,
  Collapse,
  Tooltip
} from '@mui/material';
import {
  ExpandMore,
  Image,
  Business,
  ShowChart,
  Description,
  PlayArrow,
  Stop,
  Clear,
  Search,
  UploadFile,
  Delete,
  PictureAsPdf,
  Download,
  OpenInNew,
  Link as LinkIcon,
  CloudUpload,
  Psychology,
  Podcasts,
  Slideshow,
  DeleteSweep,
  Refresh,
  MoreVert,
  InsertDriveFile,
  Star,
  Storage
} from '@mui/icons-material';
import { useAI, AIProvider } from '../contexts/AIContext';
import RAGManagementTab from '../components/RAGManagementTab';

/**
 * Research IDE - Full IDE-style interface for bank research workflow
 * Layout: Left sidebar (data explorer) | Main area (phase tabs) | Bottom terminal
 */
function ResearchIDEContent() {
  const { idrssd } = useParams();
  const [bankName, setBankName] = useState('');
  const [activePhase, setActivePhase] = useState('phase1');
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [isResizing, setIsResizing] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [sseReconnecting, setSseReconnecting] = useState(false);
  const terminalRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Helper: Get phase status icon
  const getPhaseIcon = (status) => {
    const icons = {
      'not_started': '⏳',
      'in_progress': '🔄',
      'completed': '✅',
      'failed': '❌'
    };
    return icons[status] || '⏳';
  };

  // Helper: Get consolidated Phase 3 status (combines Phase 3: Extract Insights + Phase 4: Generate Outputs)
  const getConsolidatedPhase3Status = (researchPhases) => {
    if (!researchPhases) return 'not_started';
    const phase3Status = researchPhases.phase3?.status || 'not_started';
    const phase4Status = researchPhases.phase4?.status || 'not_started';

    // Failed if either phase failed
    if (phase3Status === 'failed' || phase4Status === 'failed') return 'failed';
    // In progress if either phase is in progress
    if (phase3Status === 'in_progress' || phase4Status === 'in_progress') return 'in_progress';
    // Completed only if both are completed
    if (phase3Status === 'completed' && phase4Status === 'completed') return 'completed';
    // Otherwise not started
    return 'not_started';
  };

  // Get AI context
  const {
    logs: aiLogs,
    metadata,
    gatheringInProgress,
    discoveredSources,
    reportInProgress,
    agentMilestones,
    agentInsights,
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
    presentationInProgress,
    presentationStatus,
    currentReport,
    currentPodcast,
    currentPresentation,
    startDataGathering,
    generateAgentReport,
    generatePodcast,
    generatePresentation,
    clearAllSources,
    uploadPDF,
    deletePDF,
    deleteReport,
    deletePodcast,
    deletePresentation,
    setSourceDocumentType,
    uploadSourceToRAG,
    extractInsights,
    refreshRAG,
    deleteRAG
  } = useAI();

  useEffect(() => {
    loadBankData();
    setupSSEConnection();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [idrssd]);

  // Sync AIContext logs to terminal
  useEffect(() => {
    if (aiLogs && aiLogs.length > 0) {
      setTerminalLogs(prev => {
        // Get the last log from AIContext
        const lastAiLog = aiLogs[aiLogs.length - 1];

        // Check if it's already in terminal logs
        const isDuplicate = prev.some(log =>
          log.timestamp === lastAiLog.timestamp &&
          log.message === lastAiLog.message
        );

        if (!isDuplicate) {
          return [...prev, {
            timestamp: new Date(lastAiLog.timestamp).toLocaleTimeString(),
            message: lastAiLog.message,
            type: lastAiLog.level
          }];
        }
        return prev;
      });

      // Auto-scroll terminal to bottom
      setTimeout(() => {
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
      }, 10);
    }
  }, [aiLogs]);

  // Convert milestones, insights, and errors to terminal logs (append, don't replace)
  const prevMilestonesRef = useRef([]);
  const prevInsightsRef = useRef([]);
  const prevErrorRef = useRef(null);

  useEffect(() => {
    const formatTimestamp = (ts) => {
      if (!ts) return new Date().toLocaleTimeString();
      if (typeof ts === 'number') return new Date(ts).toLocaleTimeString();
      if (ts instanceof Date) return ts.toLocaleTimeString();
      if (typeof ts === 'string') return new Date(ts).toLocaleTimeString();
      return new Date().toLocaleTimeString();
    };

    const newLogs = [];

    // Only add NEW milestones (not already in terminal)
    const prevMilestoneCount = prevMilestonesRef.current.length;
    if (agentMilestones.length > prevMilestoneCount) {
      agentMilestones.slice(prevMilestoneCount).forEach(milestone => {
        newLogs.push({
          timestamp: formatTimestamp(milestone.timestamp),
          message: `📍 ${milestone.message}`,
          type: 'info'
        });
      });
    }
    prevMilestonesRef.current = agentMilestones;

    // Only add NEW insights
    const prevInsightCount = prevInsightsRef.current.length;
    if (agentInsights.length > prevInsightCount) {
      agentInsights.slice(prevInsightCount).forEach(insight => {
        newLogs.push({
          timestamp: formatTimestamp(insight.timestamp),
          message: `💡 ${insight.title}: ${insight.content}`,
          type: 'success'
        });
      });
    }
    prevInsightsRef.current = agentInsights;

    // Only add error if it changed
    if (error && error !== prevErrorRef.current) {
      newLogs.push({
        timestamp: formatTimestamp(Date.now()),
        message: `❌ Error: ${error}`,
        type: 'error'
      });
    }
    prevErrorRef.current = error;

    // Append new logs to existing terminal logs
    if (newLogs.length > 0) {
      setTerminalLogs(prev => [...prev, ...newLogs]);

      // Auto-scroll terminal to bottom
      setTimeout(() => {
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
      }, 10);
    }
  }, [agentMilestones, agentInsights, error]);

  const setupSSEConnection = () => {
    // Create SSE connection for real-time updates
    const eventSource = new EventSource(`/api/research/${idrssd}/status-stream`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setSseConnected(true);
      setSseReconnecting(false);
      addLog('SSE connection established', 'success');
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      setSseConnected(false);
      setSseReconnecting(true);
      addLog('SSE connection lost, attempting to reconnect...', 'warning');

      // EventSource will automatically try to reconnect
      setTimeout(() => {
        if (eventSource.readyState === EventSource.CONNECTING) {
          setSseReconnecting(true);
        }
      }, 1000);
    };

    // Listen for multiple event types
    eventSource.addEventListener('status', (e) => {
      try {
        const data = JSON.parse(e.data);
        addLog(data.message, 'info');
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    });

    eventSource.addEventListener('log', (e) => {
      try {
        const data = JSON.parse(e.data);
        addLog(data.message, data.level || 'info');
      } catch (error) {
        console.error('Error parsing SSE log:', error);
      }
    });

    eventSource.addEventListener('milestone', (e) => {
      try {
        const data = JSON.parse(e.data);
        addLog(`📍 ${data.message}`, 'info');
      } catch (error) {
        console.error('Error parsing SSE milestone:', error);
      }
    });

    eventSource.addEventListener('progress', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.message) {
          addLog(data.message, 'info');
        }
      } catch (error) {
        console.error('Error parsing SSE progress:', error);
      }
    });

    eventSource.addEventListener('source-found', (e) => {
      try {
        const data = JSON.parse(e.data);
        const source = data.source || {};
        addLog(`✓ Found ${data.category}: ${source.title || source.url}`, 'success');
      } catch (error) {
        console.error('Error parsing SSE source-found:', error);
      }
    });

    eventSource.addEventListener('category-complete', (e) => {
      try {
        const data = JSON.parse(e.data);
        const categoryName = data.category.replace(/([A-Z])/g, ' $1').trim();
        addLog(`📦 ${categoryName}: ${data.foundCount} source(s) found`, 'info');
      } catch (error) {
        console.error('Error parsing SSE category-complete:', error);
      }
    });

    eventSource.addEventListener('complete', (e) => {
      try {
        const data = JSON.parse(e.data);
        addLog(`✓ ${data.message}`, 'success');
      } catch (error) {
        console.error('Error parsing SSE complete:', error);
      }
    });

    eventSource.addEventListener('error', (e) => {
      try {
        const data = JSON.parse(e.data);
        addLog(`❌ ${data.message}`, 'error');
      } catch (error) {
        console.error('Error parsing SSE error:', error);
      }
    });

    // Also listen to default message events
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.message) {
          addLog(data.message, data.level || 'info');
        }
      } catch (error) {
        // Might not be JSON, just log as text
        addLog(e.data, 'info');
      }
    };
  };

  const loadBankData = async () => {
    try {
      const response = await axios.get(`/api/banks/${idrssd}`);
      setBankName(response.data.institution.name);
    } catch (error) {
      console.error('Error loading bank data:', error);
    }
  };

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setTerminalLogs(prev => [...prev, { timestamp, message, type }]);

    // Auto-scroll terminal to bottom
    setTimeout(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
    }, 10);
  };

  const clearLogs = () => {
    setTerminalLogs([]);
  };

  // Terminal resize handlers
  const startResize = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizing) {
        const newHeight = window.innerHeight - e.clientY;
        setTerminalHeight(Math.max(100, Math.min(600, newHeight)));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#1e1e1e' }}>
      {/* Top Bar */}
      <Box sx={{
        height: 48,
        bgcolor: '#2d2d30',
        borderBottom: '1px solid #3e3e42',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <img src="/claude-icon.svg" alt="Claude AI" style={{ width: 24, height: 24 }} />
          <Typography variant="h6" sx={{ color: '#cccccc', fontWeight: 600, fontSize: '14px' }}>
            Research Builder: {bankName}
          </Typography>
        </Box>

        {/* SSE Connection Indicator */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: sseConnected ? '#89d185' : (sseReconnecting ? '#f48771' : '#858585'),
              animation: sseReconnecting ? 'pulse 1.5s infinite' : 'none',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 }
              }
            }}
          />
          <Typography variant="caption" sx={{ color: '#858585', fontSize: '11px' }}>
            {sseConnected ? 'Connected' : (sseReconnecting ? 'Reconnecting...' : 'Disconnected')}
          </Typography>
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar - Data Explorer */}
        <Box sx={{
          width: 280,
          bgcolor: '#252526',
          borderRight: '1px solid #3e3e42',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <Box sx={{ p: 1.5, borderBottom: '1px solid #3e3e42' }}>
            <Typography variant="subtitle2" sx={{ color: '#cccccc', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Data Explorer
            </Typography>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <DataExplorer metadata={metadata} idrssd={idrssd} pdfs={pdfs} ragStats={ragStats} addLog={addLog} />
          </Box>
        </Box>

        {/* Main Area - Phase Tabs */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ borderBottom: '1px solid #3e3e42', bgcolor: '#2d2d30' }}>
            <Tabs
              value={activePhase}
              onChange={(e, newValue) => setActivePhase(newValue)}
              sx={{
                minHeight: 36,
                '& .MuiTab-root': {
                  color: '#969696',
                  minHeight: 36,
                  fontSize: '13px',
                  textTransform: 'none',
                  '&.Mui-selected': {
                    color: '#ffffff'
                  }
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: '#d97757'
                }
              }}
            >
              <Tab
                label={`Phase 1: Gather Sources ${getPhaseIcon(metadata?.researchPhases?.phase1?.status || 'not_started')}`}
                value="phase1"
              />
              <Tab
                label={`Phase 2: Generate Report ${getPhaseIcon(metadata?.researchPhases?.phase2?.status || 'not_started')}`}
                value="phase2"
              />
              <Tab
                label={`Phase 3: Generate Outputs ${getPhaseIcon(getConsolidatedPhase3Status(metadata?.researchPhases))}`}
                value="phase3"
              />
              <Tab
                label="RAG Management"
                value="rag"
                icon={<Storage />}
                iconPosition="start"
              />
            </Tabs>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#1e1e1e', p: 3 }}>
            <PhaseContent
              phase={activePhase}
              idrssd={idrssd}
              bankName={bankName}
              addLog={addLog}
              gatheringInProgress={gatheringInProgress}
              discoveredSources={discoveredSources}
              startDataGathering={startDataGathering}
              clearAllSources={clearAllSources}
              setSourceDocumentType={setSourceDocumentType}
              uploadSourceToRAG={uploadSourceToRAG}
              pdfs={pdfs}
              pdfUploading={pdfUploading}
              uploadPDF={uploadPDF}
              deletePDF={deletePDF}
              ragStats={ragStats}
              documentChecklist={documentChecklist}
              insightExtracting={insightExtracting}
              insightProgress={insightProgress}
              insightStatus={insightStatus}
              extractInsights={extractInsights}
              refreshRAG={refreshRAG}
              deleteRAG={deleteRAG}
              metadata={metadata}
              reportInProgress={reportInProgress}
              currentReport={currentReport}
              generateAgentReport={generateAgentReport}
              deleteReport={deleteReport}
              podcastInProgress={podcastInProgress}
              podcastStatus={podcastStatus}
              currentPodcast={currentPodcast}
              generatePodcast={generatePodcast}
              deletePodcast={deletePodcast}
              presentationInProgress={presentationInProgress}
              presentationStatus={presentationStatus}
              currentPresentation={currentPresentation}
              generatePresentation={generatePresentation}
              deletePresentation={deletePresentation}
              error={error}
            />
          </Box>
        </Box>
      </Box>

      {/* Bottom Terminal */}
      <Box>
        {/* Resize Handle */}
        <Box
          onMouseDown={startResize}
          sx={{
            height: 4,
            bgcolor: '#3e3e42',
            cursor: 'ns-resize',
            '&:hover': {
              bgcolor: '#d97757'
            }
          }}
        />

        {/* Terminal Panel */}
        <Box sx={{
          height: terminalHeight,
          bgcolor: '#1e1e1e',
          borderTop: '1px solid #3e3e42',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Box sx={{
            height: 35,
            bgcolor: '#2d2d30',
            borderBottom: '1px solid #3e3e42',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1.5
          }}>
            <Typography variant="subtitle2" sx={{ color: '#cccccc', fontSize: '13px' }}>
              Terminal
            </Typography>
            <IconButton size="small" onClick={clearLogs} sx={{ color: '#cccccc', padding: 0.5 }}>
              <Clear fontSize="small" />
            </IconButton>
          </Box>
          <Box
            ref={terminalRef}
            sx={{
              flex: 1,
              overflow: 'auto',
              fontFamily: 'Monaco, Consolas, "Courier New", monospace',
              fontSize: '12px',
              color: '#cccccc',
              p: 1,
              '& .log-entry': {
                mb: 0.5,
                display: 'flex',
                gap: 1
              },
              '& .timestamp': {
                color: '#858585'
              },
              '& .info': {
                color: '#4fc1ff'
              },
              '& .success': {
                color: '#89d185'
              },
              '& .warning': {
                color: '#f48771'
              },
              '& .error': {
                color: '#f14c4c'
              }
            }}
          >
            {terminalLogs.map((log, index) => (
              <div key={index} className="log-entry">
                <span className="timestamp">[{log.timestamp}]</span>
                <span className={log.type}>{log.message}</span>
              </div>
            ))}
            {terminalLogs.length === 0 && (
              <Typography variant="body2" sx={{ color: '#858585', fontStyle: 'italic' }}>
                Terminal output will appear here...
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// Data Explorer Component (Left Sidebar)
function DataExplorer({ metadata, idrssd, pdfs, ragStats, addLog }) {
  const [expanded, setExpanded] = useState([]); // All sections collapsed by default
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Debug logging
  useEffect(() => {
    console.log('DataExplorer - pdfs:', pdfs);
    console.log('DataExplorer - ragStats:', ragStats);
    if (pdfs) {
      const completedPdfs = pdfs.filter(p => p.ragStatus === 'completed');
      console.log('DataExplorer - completed PDFs:', completedPdfs);
    }
  }, [pdfs, ragStats]);

  const handleToggle = (panel) => {
    setExpanded(prev =>
      prev.includes(panel)
        ? prev.filter(p => p !== panel)
        : [...prev, panel]
    );
  };

  const handleDocClick = (doc) => {
    // Open PDF in new window
    if (doc.id) {
      window.open(`/api/research/${idrssd}/pdfs/${doc.id}/view`, '_blank');
    }
  };

  const handleContextMenu = (event, doc) => {
    event.preventDefault();
    setSelectedDoc(doc);
    setContextMenu(
      contextMenu === null
        ? { mouseX: event.clientX - 2, mouseY: event.clientY - 4 }
        : null
    );
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
    setSelectedDoc(null);
  };

  const handleDeleteFromRAG = async () => {
    if (selectedDoc && window.confirm(`Delete ${selectedDoc.filename} from RAG?`)) {
      try {
        await axios.delete(`/api/research/${idrssd}/pdfs/${selectedDoc.id}`);
        handleCloseContextMenu();
      } catch (error) {
        console.error('Error deleting from RAG:', error);
        alert('Failed to delete document');
      }
    }
  };

  const handleRerunRAG = async () => {
    if (selectedDoc) {
      try {
        await axios.post(`/api/research/${idrssd}/pdfs/${selectedDoc.id}/reprocess`);
        addLog(`✓ RAG reprocessing started for ${selectedDoc.title || selectedDoc.filename}`, 'success');
        handleCloseContextMenu();
      } catch (error) {
        console.error('Error reprocessing RAG:', error);
        addLog(`✗ Failed to reprocess document: ${error.message}`, 'error');
      }
    }
  };

  return (
    <Box>
      {/* Logos Section */}
      <Accordion
        expanded={expanded.includes('logos')}
        onChange={() => handleToggle('logos')}
        sx={{ bgcolor: 'transparent', boxShadow: 'none', '&:before': { display: 'none' } }}
      >
        <AccordionSummary
          expandIcon={<ExpandMore sx={{ color: '#cccccc' }} />}
          sx={{
            minHeight: 32,
            '& .MuiAccordionSummary-content': { margin: '8px 0' }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Image sx={{ fontSize: 16, color: '#cccccc' }} />
            <Typography sx={{ color: '#cccccc', fontSize: '13px' }}>Logos</Typography>
            {(metadata?.logo?.localPath || metadata?.logo?.symbolLocalPath) && (
              <Chip
                label={[metadata?.logo?.localPath, metadata?.logo?.symbolLocalPath].filter(Boolean).length}
                size="small"
                sx={{ height: 16, fontSize: '10px', bgcolor: '#d97757', color: 'white' }}
              />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ py: 1 }}>
          {(metadata?.logo?.localPath || metadata?.logo?.symbolLocalPath) ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Full Logo */}
              {metadata?.logo?.localPath && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#858585', fontSize: '11px', fontWeight: 600 }}>
                    Full Logo
                  </Typography>
                  <img
                    src={`http://localhost:5001/api/research/${idrssd}/logo`}
                    alt="Bank full logo"
                    style={{ maxWidth: '100%', maxHeight: 60, objectFit: 'contain' }}
                  />
                </Box>
              )}

              {/* Symbol Logo */}
              {metadata?.logo?.symbolLocalPath && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#858585', fontSize: '11px', fontWeight: 600 }}>
                    Symbol Logo
                  </Typography>
                  <img
                    src={`http://localhost:5001/api/research/${idrssd}/logo-symbol`}
                    alt="Bank symbol logo"
                    style={{ maxWidth: '100%', maxHeight: 60, objectFit: 'contain' }}
                  />
                </Box>
              )}

              <Typography variant="caption" sx={{ color: '#858585', fontSize: '11px' }}>
                Source: {metadata.logo.source || 'Unknown'}
              </Typography>
            </Box>
          ) : (
            <Typography variant="caption" sx={{ color: '#858585', fontSize: '11px' }}>
              No logos found
            </Typography>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Org Chart Section */}
      <Accordion
        expanded={expanded.includes('orgChart')}
        onChange={() => handleToggle('orgChart')}
        sx={{ bgcolor: 'transparent', boxShadow: 'none', '&:before': { display: 'none' } }}
      >
        <AccordionSummary
          expandIcon={<ExpandMore sx={{ color: '#cccccc' }} />}
          sx={{
            minHeight: 32,
            '& .MuiAccordionSummary-content': { margin: '8px 0' }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Business sx={{ fontSize: 16, color: '#cccccc' }} />
            <Typography sx={{ color: '#cccccc', fontSize: '13px' }}>Org Chart</Typography>
            {metadata?.orgChart?.executives?.length > 0 && (
              <Chip
                label={metadata.orgChart.executives.length}
                size="small"
                sx={{ height: 16, fontSize: '10px', bgcolor: '#d97757', color: 'white' }}
              />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ py: 1 }}>
          {metadata?.orgChart?.executives?.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {metadata.orgChart.executives.slice(0, 5).map((exec, index) => (
                <Box key={index} sx={{ borderLeft: '2px solid #d97757', pl: 1 }}>
                  <Typography variant="caption" sx={{ color: '#cccccc', fontSize: '11px', fontWeight: 600 }}>
                    {exec.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#858585', fontSize: '10px', display: 'block' }}>
                    {exec.title}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="caption" sx={{ color: '#858585', fontSize: '11px' }}>
              No org chart data
            </Typography>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Ticker/Stock Data Section */}
      <Accordion
        expanded={expanded.includes('ticker')}
        onChange={() => handleToggle('ticker')}
        sx={{ bgcolor: 'transparent', boxShadow: 'none', '&:before': { display: 'none' } }}
      >
        <AccordionSummary
          expandIcon={<ExpandMore sx={{ color: '#cccccc' }} />}
          sx={{
            minHeight: 32,
            '& .MuiAccordionSummary-content': { margin: '8px 0' }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShowChart sx={{ fontSize: 16, color: '#cccccc' }} />
            <Typography sx={{ color: '#cccccc', fontSize: '13px' }}>Ticker / Stock</Typography>
            {metadata?.ticker?.symbol && (
              <Chip label="Public" size="small" sx={{ height: 16, fontSize: '10px', bgcolor: '#d97757', color: 'white' }} />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ py: 1 }}>
          {metadata?.ticker?.symbol ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="caption" sx={{ color: '#cccccc', fontSize: '12px', fontWeight: 600 }}>
                {metadata.ticker.symbol}
              </Typography>
              <Typography variant="caption" sx={{ color: '#858585', fontSize: '11px' }}>
                {metadata.ticker.exchange || 'Unknown Exchange'}
              </Typography>
            </Box>
          ) : (
            <Typography variant="caption" sx={{ color: '#858585', fontSize: '11px' }}>
              Not publicly traded
            </Typography>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Strategy & KPIs Section */}
      <Accordion
        expanded={expanded.includes('strategy')}
        onChange={() => handleToggle('strategy')}
        sx={{ bgcolor: 'transparent', boxShadow: 'none', '&:before': { display: 'none' } }}
      >
        <AccordionSummary
          expandIcon={<ExpandMore sx={{ color: '#cccccc' }} />}
          sx={{
            minHeight: 32,
            '& .MuiAccordionSummary-content': { margin: '8px 0' }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShowChart sx={{ fontSize: 16, color: '#cccccc' }} />
            <Typography sx={{ color: '#cccccc', fontSize: '13px' }}>Strategy & KPIs</Typography>
            {metadata?.strategicInsights?.priorities?.length > 0 && (
              <Chip
                label={metadata.strategicInsights.priorities.length}
                size="small"
                sx={{ height: 16, fontSize: '10px', bgcolor: '#d97757', color: 'white' }}
              />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ py: 1 }}>
          {metadata?.strategicInsights?.priorities?.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {metadata.strategicInsights.priorities.map((priority, index) => (
                <Box key={index}>
                  <Typography variant="caption" sx={{ color: '#cccccc', fontSize: '11px', fontWeight: 600 }}>
                    {priority.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#858585', fontSize: '10px', display: 'block' }}>
                    {priority.description}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="caption" sx={{ color: '#858585', fontSize: '11px' }}>
              No strategic insights
            </Typography>
          )}
        </AccordionDetails>
      </Accordion>

      {/* RAG Documents Section */}
      <Accordion
        expanded={expanded.includes('ragDocs')}
        onChange={() => handleToggle('ragDocs')}
        sx={{ bgcolor: 'transparent', boxShadow: 'none', '&:before': { display: 'none' } }}
      >
        <AccordionSummary
          expandIcon={<ExpandMore sx={{ color: '#cccccc' }} />}
          sx={{
            minHeight: 32,
            '& .MuiAccordionSummary-content': { margin: '8px 0' }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Description sx={{ fontSize: 16, color: '#cccccc' }} />
            <Typography sx={{ color: '#cccccc', fontSize: '13px' }}>RAG Documents</Typography>
            {ragStats && ragStats.documentCount > 0 && (
              <Chip
                label={ragStats.documentCount}
                size="small"
                sx={{ height: 16, fontSize: '10px', bgcolor: '#d97757', color: 'white' }}
              />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ py: 1 }}>
          {ragStats && ragStats.documents && ragStats.documents.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {ragStats.documents.map((doc, index) => (
                <Box
                  key={doc._id}
                  onClick={() => handleDocClick(doc)}
                  onContextMenu={(e) => handleContextMenu(e, doc)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    p: 0.5,
                    borderRadius: 0.5,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(217, 119, 87, 0.1)' }
                  }}
                >
                  <InsertDriveFile sx={{ fontSize: 14, color: '#d97757', flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#cccccc',
                        fontSize: '11px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block'
                      }}
                    >
                      {doc.title || doc.filename}
                    </Typography>
                    {doc.topics && doc.topics.length > 0 && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#858585',
                          fontSize: '9px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'block'
                        }}
                      >
                        {doc.topics.join(', ')}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="caption" sx={{ color: '#858585', fontSize: '11px' }}>
              No documents in RAG yet
            </Typography>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Context Menu for RAG Documents */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
        sx={{
          '& .MuiPaper-root': {
            bgcolor: '#2d2d30',
            border: '1px solid #3e3e42'
          }
        }}
      >
        <MenuItemComponent
          onClick={handleDocClick.bind(null, selectedDoc)}
          sx={{ fontSize: '13px', color: '#cccccc' }}
        >
          <OpenInNew sx={{ fontSize: 16, mr: 1 }} />
          Open in New Window
        </MenuItemComponent>
        <Divider sx={{ bgcolor: '#3e3e42' }} />
        <MenuItemComponent
          onClick={handleRerunRAG}
          sx={{ fontSize: '13px', color: '#cccccc' }}
        >
          <Refresh sx={{ fontSize: 16, mr: 1 }} />
          Rerun RAG Pipeline
        </MenuItemComponent>
        <MenuItemComponent
          onClick={handleDeleteFromRAG}
          sx={{ fontSize: '13px', color: '#f48771' }}
        >
          <Delete sx={{ fontSize: 16, mr: 1 }} />
          Delete from RAG
        </MenuItemComponent>
      </Menu>
    </Box>
  );
}

// Phase Content Component (Main Area)
function PhaseContent(props) {
  const {
    phase,
    idrssd,
    addLog,
    gatheringInProgress,
    discoveredSources,
    startDataGathering,
    clearAllSources,
    setSourceDocumentType,
    uploadSourceToRAG,
    pdfs,
    pdfUploading,
    uploadPDF,
    deletePDF,
    ragStats,
    documentChecklist,
    insightExtracting,
    insightProgress,
    insightStatus,
    extractInsights,
    refreshRAG,
    deleteRAG,
    metadata,
    reportInProgress,
    currentReport,
    generateAgentReport,
    deleteReport,
    podcastInProgress,
    podcastStatus,
    currentPodcast,
    generatePodcast,
    deletePodcast,
    presentationInProgress,
    presentationStatus,
    currentPresentation,
    generatePresentation,
    deletePresentation,
    error
  } = props;

  const [sourceDocTypes, setSourceDocTypes] = useState({});
  const [sourceUploading, setSourceUploading] = useState({});
  const [ragRefreshing, setRagRefreshing] = useState(false);
  const [ragDeleting, setRagDeleting] = useState(false);

  // Manual upload state
  const [manualUploadFile, setManualUploadFile] = useState(null);
  const [manualUploadDocType, setManualUploadDocType] = useState('');
  const [manualUploading, setManualUploading] = useState(false);
  const [selectedPodcastExperts, setSelectedPodcastExperts] = useState([
    'WARREN_VAULT',
    'DR_SOFIA_BANKS',
    'AVA_AGENTIC'
  ]);

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
    } catch (error) {
      console.error('Error downloading PDF from source:', error);
      alert('Failed to download PDF. Please try again.');
    }
  };

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

      // Find the source to get its category
      let source = null;
      for (const category of Object.keys(discoveredSources)) {
        const found = discoveredSources[category].find(s => s.id === sourceId);
        if (found) {
          source = found;
          break;
        }
      }

      // If document type not already set, set it using the default for this category
      if (source && !sourceDocTypes[sourceId]) {
        const categoryToDocType = {
          investorPresentation: 'investor_presentation',
          earningsTranscript: 'earnings_transcript',
          strategyAnalysis: 'strategy_analysis',
          analystReports: 'analyst_report'
        };

        const defaultDocType = categoryToDocType[source.category];
        if (defaultDocType) {
          addLog(`Setting document type to: ${defaultDocType}`, 'info');
          await setSourceDocumentType(sourceId, defaultDocType);
          setSourceDocTypes(prev => ({ ...prev, [sourceId]: defaultDocType }));
        }
      }

      await uploadSourceToRAG(sourceId);
      addLog('✓ Document uploaded to RAG successfully', 'success');
    } catch (err) {
      console.error('Failed to upload to RAG:', err);
      addLog(`✗ Failed to upload to RAG: ${err.message}`, 'error');
    } finally {
      setSourceUploading(prev => ({ ...prev, [sourceId]: false }));
    }
  };

  const handleManualFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setManualUploadFile(file);
      // Reset document type when new file selected
      setManualUploadDocType('');
    }
  };

  const handleManualUpload = async () => {
    if (!manualUploadFile || !manualUploadDocType) return;

    try {
      setManualUploading(true);

      // Upload the PDF file
      await uploadPDF(manualUploadFile);

      // Get the latest PDFs to find the newly uploaded one
      const response = await axios.get(`/api/research/${idrssd}/pdfs`);
      const pdfs = response.data.pdfs || [];

      // Find the most recent PDF (should be our upload)
      const sortedPdfs = pdfs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      const uploadedPdf = sortedPdfs[0];

      if (uploadedPdf) {
        // Set document type
        await axios.post(`/api/research/${idrssd}/pdfs/${uploadedPdf.id}/set-document-type`, {
          documentType: manualUploadDocType
        });

        // Upload to RAG
        await axios.post(`/api/research/${idrssd}/pdfs/${uploadedPdf.id}/upload-to-rag`);

        // Clear form
        setManualUploadFile(null);
        setManualUploadDocType('');

        // Reset file input
        const fileInput = document.getElementById('manual-upload-input');
        if (fileInput) fileInput.value = '';

        addLog(`✅ Successfully uploaded ${manualUploadFile.name} to RAG`, 'success');
      }
    } catch (err) {
      console.error('Failed to upload:', err);
      alert('Failed to upload document: ' + err.message);
    } finally {
      setManualUploading(false);
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
      alert(`Successfully deleted RAG environment. Removed ${result.deletedDocuments} document(s) and reset ${result.resetPDFs} PDF(s).`);
    } catch (err) {
      console.error('Error deleting RAG:', err);
      alert('Failed to delete RAG environment. Please try again.');
    } finally {
      setRagDeleting(false);
    }
  };

  const handleDeleteAllInsights = async () => {
    if (!window.confirm('Are you sure you want to delete all extracted strategic insights? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.post(`/api/research/${idrssd}/delete-insights`);
      addLog('Successfully deleted all strategic insights', 'success');
      // Refresh metadata to reflect the deletion
      window.location.reload();
    } catch (err) {
      console.error('Error deleting insights:', err);
      alert('Failed to delete insights. Please try again.');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

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

  // PHASE 1: Gather Sources
  if (phase === 'phase1') {
    // Map category keys to display names (must match backend categories)
    const categoryLabels = {
      investorPresentation: 'Investor Presentations',
      earningsTranscript: 'Earnings Transcripts',
      strategyAnalysis: 'Strategy Analysis',
      analystReports: 'Analyst Reports'
    };

    // Map category to default document type
    const categoryToDocType = {
      investorPresentation: 'investor_presentation',
      earningsTranscript: 'earnings_transcript',
      strategyAnalysis: 'strategy_analysis',
      analystReports: 'analyst_report'
    };

    // All categories to display (in order, must match backend categories)
    const allCategories = ['investorPresentation', 'earningsTranscript', 'strategyAnalysis', 'analystReports'];

    // Helper function to render source row
    const renderSourceRow = (source) => {
      const isPDF = source.url?.toLowerCase().endsWith('.pdf');
      // Auto-set doc type for recommended sources, otherwise use saved or default
      const docType = sourceDocTypes[source.id] ||
        (source.recommended && source.category ? categoryToDocType[source.category] : '') ||
        (source.category ? categoryToDocType[source.category] : '');
      const uploading = sourceUploading[source.id] || false;

      // Calculate quality color based on confidence
      const confidence = source.confidence || 0.5;
      const getQualityColor = (conf) => {
        if (conf >= 0.75) return '#4caf50'; // Green
        if (conf >= 0.5) return '#ff9800'; // Orange
        return '#f44336'; // Red
      };

      // Tooltip content
      const tooltipContent = (
        <Box>
          {source.recommended && (
            <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 600, display: 'block', mb: 0.5 }}>
              ⭐ Recommended Source
            </Typography>
          )}
          {source.preview && (
            <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
              {source.preview}
            </Typography>
          )}
          <Typography variant="caption" sx={{ color: '#858585', fontSize: '10px' }}>
            Confidence: {Math.round(confidence * 100)}%
          </Typography>
        </Box>
      );

      return (
        <TableRow
          key={source.id}
          sx={{
            '&:hover': { bgcolor: 'rgba(217, 119, 87, 0.05)' },
            borderBottom: '1px solid #3e3e42',
            bgcolor: source.recommended ? 'rgba(76, 175, 80, 0.05)' : 'transparent'
          }}
        >
          {/* Quality Column */}
          <TableCell sx={{ borderBottom: '1px solid #3e3e42', padding: '8px' }}>
            <Tooltip title={tooltipContent} arrow placement="right">
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                {source.recommended && (
                  <Star sx={{ color: '#4caf50', fontSize: 16 }} />
                )}
                <Box
                  sx={{
                    width: 40,
                    height: 4,
                    bgcolor: '#3e3e42',
                    borderRadius: 2,
                    overflow: 'hidden'
                  }}
                >
                  <Box
                    sx={{
                      width: `${confidence * 100}%`,
                      height: '100%',
                      bgcolor: getQualityColor(confidence),
                      transition: 'width 0.3s ease'
                    }}
                  />
                </Box>
                <Typography variant="caption" sx={{ color: '#858585', fontSize: '10px' }}>
                  {Math.round(confidence * 100)}%
                </Typography>
              </Box>
            </Tooltip>
          </TableCell>

          {/* File Name Column */}
          <TableCell sx={{ color: '#cccccc', borderBottom: '1px solid #3e3e42' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isPDF ? (
                <PictureAsPdf sx={{ color: '#d32f2f', fontSize: 16 }} />
              ) : (
                <LinkIcon sx={{ color: '#858585', fontSize: 16 }} />
              )}
              <Typography variant="body2" sx={{ fontSize: '13px' }}>
                {source.title || 'Untitled'}
              </Typography>
            </Box>
          </TableCell>
          <TableCell sx={{ color: '#858585', fontSize: '12px', borderBottom: '1px solid #3e3e42', maxWidth: 300 }}>
            <Typography
              variant="caption"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block'
              }}
            >
              {source.url}
            </Typography>
          </TableCell>
          <TableCell sx={{ borderBottom: '1px solid #3e3e42' }}>
            <FormControl size="small" fullWidth>
              <Select
                value={docType}
                onChange={(e) => handleSetDocType(source.id, e.target.value)}
                displayEmpty
                sx={{
                  color: '#cccccc',
                  fontSize: '12px',
                  '.MuiOutlinedInput-notchedOutline': { borderColor: '#3e3e42' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#d97757' }
                }}
              >
                <MenuItem value="" sx={{ fontSize: '12px' }}>Select type...</MenuItem>
                <MenuItem value="investor_presentation" sx={{ fontSize: '12px' }}>Investor Presentation</MenuItem>
                <MenuItem value="earnings_transcript" sx={{ fontSize: '12px' }}>Earnings Transcript</MenuItem>
                <MenuItem value="strategy_analysis" sx={{ fontSize: '12px' }}>Strategy Analysis</MenuItem>
                <MenuItem value="analyst_report" sx={{ fontSize: '12px' }}>Analyst Report</MenuItem>
                <MenuItem value="other" sx={{ fontSize: '12px' }}>Other</MenuItem>
              </Select>
            </FormControl>
          </TableCell>
          <TableCell sx={{ borderBottom: '1px solid #3e3e42' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {isPDF && docType ? (
                source.ragStatus === 'completed' ? (
                  <Chip
                    label="✓ In RAG"
                    size="small"
                    color="success"
                    sx={{ fontSize: '11px' }}
                  />
                ) : (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={uploading ? <CircularProgress size={12} color="inherit" /> : <CloudUpload />}
                    onClick={() => handleUploadToRAG(source.id)}
                    disabled={uploading}
                    sx={{
                      fontSize: '11px',
                      py: 0.5,
                      px: 1.5,
                      bgcolor: '#d97757',
                      '&:hover': { bgcolor: '#c25a39' }
                    }}
                  >
                    {uploading ? 'Uploading' : 'Add to RAG'}
                  </Button>
                )
              ) : null}
              <IconButton
                size="small"
                onClick={() => window.open(source.url, '_blank')}
                title="Open in new tab"
                sx={{ color: '#858585' }}
              >
                <OpenInNew fontSize="small" />
              </IconButton>
            </Box>
          </TableCell>
        </TableRow>
      );
    };

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ color: '#ffffff', fontWeight: 600 }}>
            Phase 1: Gather Sources
          </Typography>
          <Button
            variant="contained"
            startIcon={gatheringInProgress ? <CircularProgress size={16} color="inherit" /> : <Search />}
            onClick={() => startDataGathering({})}
            disabled={gatheringInProgress}
            sx={{ bgcolor: '#d97757', '&:hover': { bgcolor: '#c25a39' } }}
          >
            {gatheringInProgress ? 'Gathering...' : totalFound > 0 ? 'Gather More' : 'Start Gathering'}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {gatheringInProgress && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">Gathering data sources... Check terminal for progress</Typography>
          </Alert>
        )}

        {gatheringInProgress || totalFound > 0 ? (
          <Box>
            {totalFound > 0 && (
              <Typography variant="body2" sx={{ color: '#858585', mb: 3 }}>
                {totalFound} source(s) discovered across {Object.keys(discoveredSources).filter(k => discoveredSources[k].length > 0).length} categories
              </Typography>
            )}

            {/* Grouped sources by category - show all categories */}
            {allCategories.map((category) => {
              const sources = (discoveredSources[category] || [])
                .sort((a, b) => {
                  // Sort by recommended status first, then by confidence score
                  if (a.recommended && !b.recommended) return -1;
                  if (!a.recommended && b.recommended) return 1;
                  return (b.confidence || 0.5) - (a.confidence || 0.5);
                });
              const hasResults = sources.length > 0;

              return (
                <Accordion
                  key={category}
                  defaultExpanded={hasResults}
                  sx={{
                    bgcolor: '#2d2d30',
                    border: '1px solid #3e3e42',
                    mb: 2,
                    '&:before': { display: 'none' }
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMore sx={{ color: '#cccccc' }} />}
                    sx={{
                      bgcolor: '#1e1e1e',
                      '&:hover': { bgcolor: '#252526' }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Description sx={{ color: hasResults ? '#d97757' : '#858585', fontSize: 20 }} />
                      <Typography sx={{ color: hasResults ? '#ffffff' : '#858585', fontWeight: 600 }}>
                        {categoryLabels[category] || category}
                      </Typography>
                      {hasResults ? (
                        <Chip
                          label={sources.length}
                          size="small"
                          sx={{
                            bgcolor: '#d97757',
                            color: 'white',
                            fontSize: '11px',
                            height: 20
                          }}
                        />
                      ) : gatheringInProgress ? (
                        <Chip
                          label="Searching..."
                          size="small"
                          sx={{
                            bgcolor: 'rgba(217, 119, 87, 0.3)',
                            color: '#858585',
                            fontSize: '11px',
                            height: 20
                          }}
                        />
                      ) : (
                        <Chip
                          label="None found"
                          size="small"
                          sx={{
                            bgcolor: 'transparent',
                            border: '1px solid #3e3e42',
                            color: '#858585',
                            fontSize: '11px',
                            height: 20
                          }}
                        />
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    {hasResults ? (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#1e1e1e' }}>
                              <TableCell sx={{ color: '#cccccc', fontWeight: 600, borderBottom: '1px solid #3e3e42', width: 60 }}>Quality</TableCell>
                              <TableCell sx={{ color: '#cccccc', fontWeight: 600, borderBottom: '1px solid #3e3e42' }}>File Name</TableCell>
                              <TableCell sx={{ color: '#cccccc', fontWeight: 600, borderBottom: '1px solid #3e3e42' }}>URL</TableCell>
                              <TableCell sx={{ color: '#cccccc', fontWeight: 600, borderBottom: '1px solid #3e3e42', width: 180 }}>Document Type</TableCell>
                              <TableCell sx={{ color: '#cccccc', fontWeight: 600, borderBottom: '1px solid #3e3e42', width: 200 }}>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {sources.map(renderSourceRow)}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Box sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ color: '#858585', fontSize: '12px' }}>
                          {gatheringInProgress ? 'Searching for sources...' : 'No sources found in this category'}
                        </Typography>
                      </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              );
            })}

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<DeleteSweep />}
                onClick={clearAllSources}
              >
                Clear All Sources
              </Button>
            </Box>
          </Box>
        ) : !gatheringInProgress ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Search sx={{ fontSize: 64, color: '#858585', mb: 2 }} />
            <Typography variant="h6" sx={{ color: '#cccccc', mb: 1 }}>
              No Sources Yet
            </Typography>
            <Typography variant="body2" sx={{ color: '#858585' }}>
              Click "Start Gathering" to search for investor materials and reports
            </Typography>
          </Box>
        ) : null}

        {/* RAG Management Section */}
        {ragStats && ragStats.totalDocuments > 0 && (
          <Box sx={{ mt: 4 }}>
            <Divider sx={{ borderColor: '#3e3e42', mb: 3 }} />
            <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 600, mb: 2 }}>
              RAG Environment
            </Typography>
            <Paper sx={{ bgcolor: '#2d2d30', border: '1px solid #3e3e42', p: 3 }}>
              <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#858585' }}>Documents in RAG</Typography>
                  <Typography variant="h5" sx={{ color: '#4ec9b0', fontWeight: 600 }}>
                    {ragStats.completedDocuments}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#858585' }}>Total Chunks</Typography>
                  <Typography variant="h5" sx={{ color: '#4fc1ff', fontWeight: 600 }}>
                    {ragStats.totalChunks}
                  </Typography>
                </Box>
                {ragStats.processingDocuments > 0 && (
                  <Box>
                    <Typography variant="caption" sx={{ color: '#858585' }}>Processing</Typography>
                    <Typography variant="h5" sx={{ color: '#f48771', fontWeight: 600 }}>
                      {ragStats.processingDocuments}
                    </Typography>
                  </Box>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Refresh />}
                  onClick={handleRefreshRAG}
                  disabled={ragRefreshing || ragDeleting}
                  sx={{
                    color: '#cccccc',
                    borderColor: '#3e3e42',
                    '&:hover': { borderColor: '#d97757', color: '#d97757' }
                  }}
                >
                  {ragRefreshing ? 'Refreshing...' : 'Refresh RAG'}
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  fullWidth
                  startIcon={<Delete />}
                  onClick={handleDeleteRAG}
                  disabled={ragDeleting || ragRefreshing}
                >
                  {ragDeleting ? 'Deleting...' : 'Delete RAG'}
                </Button>
              </Box>
            </Paper>
          </Box>
        )}

        {/* Manual Upload Section */}
        <Box sx={{ mt: 4 }}>
          <Divider sx={{ borderColor: '#3e3e42', mb: 3 }} />
          <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 600, mb: 2 }}>
            Manual Upload
          </Typography>
          <Typography variant="body2" sx={{ color: '#858585', mb: 2 }}>
            Upload documents directly and add them to RAG
          </Typography>
          <Paper sx={{ bgcolor: '#2d2d30', border: '1px solid #3e3e42', p: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <input
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                id="manual-upload-input"
                onChange={handleManualFileSelect}
              />
              <label htmlFor="manual-upload-input">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<UploadFile />}
                  sx={{
                    color: '#cccccc',
                    borderColor: '#3e3e42',
                    '&:hover': { borderColor: '#d97757', color: '#d97757' }
                  }}
                >
                  Select PDF File
                </Button>
              </label>

              {manualUploadFile && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PictureAsPdf sx={{ color: '#d32f2f' }} />
                    <Typography sx={{ color: '#cccccc' }}>{manualUploadFile.name}</Typography>
                    <Typography sx={{ color: '#858585', fontSize: '12px' }}>
                      ({(manualUploadFile.size / 1024 / 1024).toFixed(2)} MB)
                    </Typography>
                  </Box>

                  <FormControl size="small" sx={{ maxWidth: 300 }}>
                    <InputLabel sx={{ color: '#cccccc' }}>Document Type</InputLabel>
                    <Select
                      value={manualUploadDocType}
                      onChange={(e) => setManualUploadDocType(e.target.value)}
                      label="Document Type"
                      sx={{
                        color: '#cccccc',
                        '.MuiOutlinedInput-notchedOutline': { borderColor: '#3e3e42' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#d97757' }
                      }}
                    >
                      <MenuItem value="investor_presentation">Investor Presentation</MenuItem>
                      <MenuItem value="management_interview">Management Interview</MenuItem>
                      <MenuItem value="earnings_transcript">Earnings Transcript</MenuItem>
                      <MenuItem value="tech_announcement">Tech Announcement</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </Select>
                  </FormControl>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      startIcon={manualUploading ? <CircularProgress size={16} color="inherit" /> : <CloudUpload />}
                      onClick={handleManualUpload}
                      disabled={!manualUploadDocType || manualUploading}
                      sx={{ bgcolor: '#d97757', '&:hover': { bgcolor: '#c25a39' } }}
                    >
                      {manualUploading ? 'Uploading...' : 'Upload & Add to RAG'}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setManualUploadFile(null);
                        setManualUploadDocType('');
                      }}
                      disabled={manualUploading}
                      sx={{ color: '#858585', borderColor: '#3e3e42' }}
                    >
                      Cancel
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>
          </Paper>
        </Box>
      </Box>
    );
  }

  // PHASE 2: Extract Strategic Insights
  if (phase === 'phase2') {
    return (
      <Box>
        <Typography variant="h5" sx={{ mb: 3, color: '#ffffff', fontWeight: 600 }}>
          Phase 2: Extract Strategic Insights
        </Typography>

        {metadata?.strategicInsights?.status === 'completed' ? (
          <Box>
            <Alert severity="success" sx={{ mb: 3 }}>
              Strategic insights extracted successfully!
            </Alert>

            <Paper sx={{ p: 3, mb: 3, bgcolor: '#2d2d30', border: '1px solid #3e3e42' }}>
              <Typography variant="h6" sx={{ mb: 2, color: '#ffffff' }}>
                Strategic Priorities
              </Typography>
              {metadata.strategicInsights.priorities?.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {metadata.strategicInsights.priorities.map((priority, index) => (
                    <Box key={index} sx={{ pl: 2, borderLeft: '3px solid #d97757' }}>
                      <Typography variant="subtitle1" sx={{ color: '#cccccc', fontWeight: 600, mb: 0.5 }}>
                        {priority.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#858585', mb: 1 }}>
                        {priority.description}
                      </Typography>
                      {priority.citations && priority.citations.length > 0 && (
                        <Box sx={{ mt: 1, pl: 2 }}>
                          <Typography variant="caption" sx={{ color: '#858585', fontStyle: 'italic' }}>
                            Citations ({priority.citations.length}):
                          </Typography>
                          {priority.citations.map((citation, citIdx) => (
                            <Box key={citIdx} sx={{ mt: 0.5, pl: 1, borderLeft: '2px solid #4ec9b0' }}>
                              <Typography variant="caption" sx={{ color: '#4ec9b0', display: 'block' }}>
                                {citation.documentTitle} {citation.pageNumber && `(Page ${citation.pageNumber})`}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#858585', display: 'block', fontStyle: 'italic' }}>
                                "{citation.citedText?.substring(0, 150)}{citation.citedText?.length > 150 ? '...' : ''}"
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: '#858585' }}>No priorities identified</Typography>
              )}
            </Paper>

            <Paper sx={{ p: 3, mb: 3, bgcolor: '#2d2d30', border: '1px solid #3e3e42' }}>
              <Typography variant="h6" sx={{ mb: 2, color: '#ffffff' }}>
                Focus Metrics
              </Typography>
              {metadata.strategicInsights.focusMetrics?.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {metadata.strategicInsights.focusMetrics.map((metricItem, index) => {
                    const metric = typeof metricItem === 'string' ? { metric: metricItem } : metricItem;
                    return (
                      <Box key={index} sx={{ pl: 2, borderLeft: '3px solid #d97757' }}>
                        <Typography variant="subtitle1" sx={{ color: '#cccccc', fontWeight: 600, mb: 0.5 }}>
                          {metric.metric}
                        </Typography>
                        {metric.commentary && (
                          <Typography variant="body2" sx={{ color: '#858585', mb: 1 }}>
                            {metric.commentary}
                          </Typography>
                        )}
                        {metric.citations && metric.citations.length > 0 && (
                          <Box sx={{ mt: 1, pl: 2 }}>
                            <Typography variant="caption" sx={{ color: '#858585', fontStyle: 'italic' }}>
                              Citations ({metric.citations.length}):
                            </Typography>
                            {metric.citations.map((citation, citIdx) => (
                              <Box key={citIdx} sx={{ mt: 0.5, pl: 1, borderLeft: '2px solid #4ec9b0' }}>
                                <Typography variant="caption" sx={{ color: '#4ec9b0', display: 'block' }}>
                                  {citation.documentTitle} {citation.pageNumber && `(Page ${citation.pageNumber})`}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#858585', display: 'block', fontStyle: 'italic' }}>
                                  "{citation.citedText?.substring(0, 150)}{citation.citedText?.length > 150 ? '...' : ''}"
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: '#858585' }}>No focus metrics identified</Typography>
              )}
            </Paper>

            <Paper sx={{ p: 3, bgcolor: '#2d2d30', border: '1px solid #3e3e42' }}>
              <Typography variant="h6" sx={{ mb: 2, color: '#ffffff' }}>
                Tech Partnerships
              </Typography>
              {metadata.strategicInsights.techPartnerships?.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {metadata.strategicInsights.techPartnerships.map((partnershipItem, index) => {
                    const partnership = typeof partnershipItem === 'string' ? { partner: partnershipItem } : partnershipItem;
                    return (
                      <Box key={index} sx={{ pl: 2, borderLeft: '3px solid #d97757' }}>
                        <Typography variant="subtitle1" sx={{ color: '#cccccc', fontWeight: 600, mb: 0.5 }}>
                          {partnership.partner}
                        </Typography>
                        {partnership.description && (
                          <Typography variant="body2" sx={{ color: '#858585', mb: 1 }}>
                            {partnership.description}
                          </Typography>
                        )}
                        {partnership.announcedDate && (
                          <Typography variant="caption" sx={{ color: '#858585', display: 'block', mb: 1 }}>
                            Announced: {partnership.announcedDate}
                          </Typography>
                        )}
                        {partnership.citations && partnership.citations.length > 0 && (
                          <Box sx={{ mt: 1, pl: 2 }}>
                            <Typography variant="caption" sx={{ color: '#858585', fontStyle: 'italic' }}>
                              Citations ({partnership.citations.length}):
                            </Typography>
                            {partnership.citations.map((citation, citIdx) => (
                              <Box key={citIdx} sx={{ mt: 0.5, pl: 1, borderLeft: '2px solid #4ec9b0' }}>
                                <Typography variant="caption" sx={{ color: '#4ec9b0', display: 'block' }}>
                                  {citation.documentTitle} {citation.pageNumber && `(Page ${citation.pageNumber})`}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#858585', display: 'block', fontStyle: 'italic' }}>
                                  "{citation.citedText?.substring(0, 150)}{citation.citedText?.length > 150 ? '...' : ''}"
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: '#858585' }}>No tech partnerships identified</Typography>
              )}
            </Paper>

            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                fullWidth
                onClick={extractInsights}
              >
                Re-extract Insights
              </Button>
              <Button
                variant="outlined"
                color="error"
                fullWidth
                startIcon={<DeleteSweep />}
                onClick={handleDeleteAllInsights}
              >
                Delete All Insights
              </Button>
            </Box>
          </Box>
        ) : insightExtracting ? (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">{insightStatus}</Typography>
              <LinearProgress variant="determinate" value={insightProgress} sx={{ mt: 2 }} />
            </Alert>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Psychology sx={{ fontSize: 64, color: '#d97757', mb: 2 }} />
            <Typography variant="h6" sx={{ color: '#cccccc', mb: 1 }}>
              Extract Strategic Insights
            </Typography>
            <Typography variant="body2" sx={{ color: '#858585', mb: 3 }}>
              {!ragStats || ragStats.completedDocuments === 0
                ? 'Upload PDFs to RAG first (Phase 2)'
                : 'Analyze documents in RAG to extract strategic priorities, metrics, and partnerships'}
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={<Psychology />}
              onClick={extractInsights}
              disabled={!ragStats || ragStats.completedDocuments === 0}
              sx={{ bgcolor: '#d97757', '&:hover': { bgcolor: '#c25a39' } }}
            >
              Extract Insights from RAG
            </Button>
          </Box>
        )}
      </Box>
    );
  }

  // PHASE 3: Generate Research Report & Podcast
  if (phase === 'phase3') {
    return (
      <Box>
        <Typography variant="h5" sx={{ mb: 3, color: '#ffffff', fontWeight: 600 }}>
          Phase 3: Generate Research Report
        </Typography>

        {/* Report Section */}
        <Paper sx={{ p: 3, mb: 3, bgcolor: '#2d2d30', border: '1px solid #3e3e42' }}>
          <Typography variant="h6" sx={{ mb: 2, color: '#ffffff' }}>
            Agent Report
          </Typography>

          {!currentReport && !reportInProgress && (totalFound > 0 || metadata?.strategicInsights?.status === 'completed') && (
            <Box>
              <Typography variant="body2" sx={{ color: '#858585', mb: 2 }}>
                Generate a comprehensive research report using gathered sources and insights.
              </Typography>
              <Button
                variant="contained"
                fullWidth
                startIcon={<Psychology />}
                onClick={generateAgentReport}
                sx={{ bgcolor: '#d97757', '&:hover': { bgcolor: '#c25a39' } }}
              >
                Generate Agent Report
              </Button>
            </Box>
          )}

          {reportInProgress && (
            <Alert severity="info">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={20} />
                <Typography>Generating report... Check terminal for progress</Typography>
              </Box>
            </Alert>
          )}

          {currentReport && !reportInProgress && (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Report generated successfully
              </Alert>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Psychology />}
                  onClick={generateAgentReport}
                >
                  Regenerate Report
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  fullWidth
                  onClick={deleteReport}
                >
                  Delete Report
                </Button>
              </Box>
            </Box>
          )}

          {!currentReport && !reportInProgress && !(totalFound > 0 || metadata?.strategicInsights?.status === 'completed') && (
            <Alert severity="warning">
              Complete Phase 1 (gather sources) or Phase 2 (extract insights) first
            </Alert>
          )}
        </Paper>

        {/* Podcast Section */}
        <Paper sx={{ p: 3, mb: 3, bgcolor: '#2d2d30', border: '1px solid #3e3e42' }}>
          <Typography variant="h6" sx={{ mb: 2, color: '#ffffff' }}>
            Podcast Generation
          </Typography>

          {!currentPodcast && !podcastInProgress && currentReport && (
            <Box>
              <Typography variant="body2" sx={{ color: '#858585', mb: 2 }}>
                Select experts for the podcast discussion:
              </Typography>
              <FormGroup sx={{ mb: 3 }}>
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
                      sx={{ color: '#858585', '&.Mui-checked': { color: '#d97757' } }}
                    />
                  }
                  label={<Typography sx={{ color: '#cccccc' }}>Warren Vault (Investor)</Typography>}
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
                      sx={{ color: '#858585', '&.Mui-checked': { color: '#d97757' } }}
                    />
                  }
                  label={<Typography sx={{ color: '#cccccc' }}>Dr. Sofia Banks (Professor)</Typography>}
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
                      sx={{ color: '#858585', '&.Mui-checked': { color: '#d97757' } }}
                    />
                  }
                  label={<Typography sx={{ color: '#cccccc' }}>Ava Agentic (AI/Tech)</Typography>}
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
                      sx={{ color: '#858585', '&.Mui-checked': { color: '#d97757' } }}
                    />
                  }
                  label={<Typography sx={{ color: '#cccccc' }}>Maya Customer (CX Expert)</Typography>}
                />
              </FormGroup>
              <Button
                variant="contained"
                fullWidth
                startIcon={<Podcasts />}
                onClick={() => generatePodcast(selectedPodcastExperts)}
                disabled={selectedPodcastExperts.length === 0}
                sx={{ bgcolor: '#d97757', '&:hover': { bgcolor: '#c25a39' } }}
              >
                Generate Podcast
              </Button>
            </Box>
          )}

          {podcastInProgress && (
            <Alert severity="info">
              <Typography variant="body2" sx={{ mb: 1 }}>
                {podcastStatus || 'Generating podcast...'}
              </Typography>
              <LinearProgress />
            </Alert>
          )}

          {currentPodcast && !podcastInProgress && (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Podcast generated successfully
                {currentPodcast.duration && ` • ~${currentPodcast.duration} min`}
              </Alert>
              <Button
                variant="outlined"
                color="error"
                fullWidth
                onClick={deletePodcast}
              >
                Delete Podcast
              </Button>
            </Box>
          )}

          {!currentPodcast && !podcastInProgress && !currentReport && (
            <Alert severity="warning">
              Generate a report first to create a podcast
            </Alert>
          )}
        </Paper>

        {/* Presentation Section */}
        <Paper sx={{ p: 3, bgcolor: '#2d2d30', border: '1px solid #3e3e42' }}>
          <Typography variant="h6" sx={{ mb: 2, color: '#ffffff' }}>
            Presentation Generation
          </Typography>

          {!currentPresentation && !presentationInProgress && currentReport && (
            <Box>
              <Typography variant="body2" sx={{ color: '#858585', mb: 2 }}>
                Generate an HTML presentation with key findings and charts
              </Typography>
              <Button
                variant="contained"
                fullWidth
                startIcon={<Slideshow />}
                onClick={generatePresentation}
                sx={{ bgcolor: '#d97757', '&:hover': { bgcolor: '#c25a39' } }}
              >
                Generate Presentation
              </Button>
            </Box>
          )}

          {presentationInProgress && (
            <Alert severity="info">
              <Typography variant="body2" sx={{ mb: 1 }}>
                {presentationStatus || 'Generating presentation...'}
              </Typography>
              <LinearProgress />
            </Alert>
          )}

          {currentPresentation && !presentationInProgress && (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Presentation generated successfully
                {currentPresentation.slideCount && ` • ${currentPresentation.slideCount} slides`}
              </Alert>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<OpenInNew />}
                  onClick={() => window.open(currentPresentation.url, '_blank')}
                >
                  Open Presentation
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  fullWidth
                  onClick={deletePresentation}
                >
                  Delete
                </Button>
              </Box>
            </Box>
          )}

          {!currentPresentation && !presentationInProgress && !currentReport && (
            <Alert severity="warning">
              Generate a report first to create a presentation
            </Alert>
          )}
        </Paper>
      </Box>
    );
  }

  // RAG MANAGEMENT TAB
  if (phase === 'rag') {
    return <RAGManagementTab selectedBank={{ idrssd, name: props.bankName }} />;
  }

  return null;
}

// Wrapper component with AIProvider
function ResearchIDE() {
  const { idrssd } = useParams();
  const [bankName, setBankName] = useState('');

  useEffect(() => {
    loadBankData();
  }, [idrssd]);

  const loadBankData = async () => {
    try {
      const response = await axios.get(`/api/banks/${idrssd}`);
      setBankName(response.data.institution.name);
    } catch (error) {
      console.error('Error loading bank data:', error);
    }
  };

  return (
    <AIProvider idrssd={idrssd} bankName={bankName}>
      <ResearchIDEContent />
    </AIProvider>
  );
}

export default ResearchIDE;
