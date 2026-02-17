import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AIContext = createContext();

export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
};

export const AIProvider = ({ children, idrssd, bankName }) => {
  // Terminal logging state
  const [logs, setLogs] = useState([]);

  const addLog = (message, level = 'info') => {
    setLogs(prev => [...prev, {
      message,
      level,
      timestamp: new Date().toISOString()
    }]);
  };

  // Stage 1: Source Gathering State
  const [gatheringInProgress, setGatheringInProgress] = useState(false);
  const [gatheringProgress, setGatheringProgress] = useState(0);
  const [discoveredSources, setDiscoveredSources] = useState({
    investorPresentation: [],
    earningsTranscript: [],
    managementInterview: [],
    techAnnouncement: [],
    strategyAnalysis: [],
    analystReports: []
  });
  const [sessionId, setSessionId] = useState(null);

  // Stage 2: Report Generation State
  const [reportInProgress, setReportInProgress] = useState(false);
  const [reportProgress, setReportProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(null); // 'analysis' | 'synthesis' | 'agent_research'
  const [streamingText, setStreamingText] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  
  // Agent Research State (for milestones and insights during generation)
  const [agentMilestones, setAgentMilestones] = useState([]);
  const [agentInsights, setAgentInsights] = useState([]);

  // Generated Content State
  const [reportVersions, setReportVersions] = useState([]); // All report versions (metadata only)
  const [currentReport, setCurrentReport] = useState(null); // Full report data for selected version
  const [selectedReportTimestamp, setSelectedReportTimestamp] = useState(null); // Currently selected version
  const [podcasts, setPodcasts] = useState([]);
  const [currentPodcast, setCurrentPodcast] = useState(null);

  // PDF State
  const [pdfs, setPdfs] = useState([]);
  const [pdfUploading, setPdfUploading] = useState(false);

  // RAG Infrastructure State
  const [ragStats, setRagStats] = useState(null);
  const [documentChecklist, setDocumentChecklist] = useState(null);

  // Strategic Insights State
  const [insightExtracting, setInsightExtracting] = useState(false);
  const [insightProgress, setInsightProgress] = useState(0);
  const [insightStatus, setInsightStatus] = useState('');

  // Podcast State
  const [podcastInProgress, setPodcastInProgress] = useState(false);
  const [podcastProgress, setPodcastProgress] = useState(0);
  const [podcastStatus, setPodcastStatus] = useState('');

  // Persistent Podcast Player State (for fixed player that stays during navigation)
  const [persistentPodcast, setPersistentPodcast] = useState(null);

  // Presentation State
  const [presentationInProgress, setPresentationInProgress] = useState(false);
  const [presentationStatus, setPresentationStatus] = useState('');
  const [currentPresentation, setCurrentPresentation] = useState(null);

  // Metadata State (logo, org chart, ticker)
  const [metadata, setMetadata] = useState(null);
  const [metadataGathering, setMetadataGathering] = useState(false);
  const [metadataProgress, setMetadataProgress] = useState(0);
  const [metadataStatus, setMetadataStatus] = useState({
    logo: { status: 'pending', error: null },
    ticker: { status: 'pending', error: null },
    orgChart: { status: 'pending', error: null }
  });

  // Configuration State (simplified - always searches all 4 categories)
  const [userConfig, setUserConfig] = useState({
    depth: 'standard',
    focusAreas: ['profitability', 'credit-risk', 'liquidity', 'leadership', 'technology']
  });

  // Error State
  const [error, setError] = useState(null);

  // Load existing reports, podcasts, and sources on mount
  useEffect(() => {
    const loadData = async () => {
      if (idrssd) {
        console.log('AIContext: Loading data for bank:', idrssd);
        await Promise.all([
          loadReports(),
          loadPodcasts(),
          loadPresentations(),
          checkForActiveJobs(),
          loadLatestSources(), // Load sources from latest session
          loadPDFs(), // Load PDFs for this bank
          loadMetadata(), // Load metadata (logo, org chart, ticker)
          loadRAGStats(), // Load RAG infrastructure stats
          loadDocumentChecklist() // Load persistent document checklist
        ]);
      }
    };
    loadData();
  }, [idrssd]);

  /**
   * Load existing reports for this bank (all versions)
   */
  const loadReports = async () => {
    try {
      // Load all report versions (metadata only)
      const historyResponse = await axios.get(`/api/research/${idrssd}/history`);
      const versions = historyResponse.data.history || []; // Fixed: backend returns 'history' not 'reports'
      setReportVersions(versions);

      // Load latest report by default
      if (versions.length > 0) {
        const latestTimestamp = versions[0].timestamp;
        await selectReportVersion(latestTimestamp);
      }
    } catch (err) {
      console.error('Error loading reports:', err);
    }
  };

  /**
   * Select a specific report version to display
   */
  const selectReportVersion = async (timestamp) => {
    try {
      const response = await axios.get(`/api/research/${idrssd}/report/${timestamp}`);
      setCurrentReport(response.data.report);
      setSelectedReportTimestamp(timestamp);

      // Load podcast associated with this report version
      await loadPodcastForReport(timestamp);
    } catch (err) {
      console.error('Error loading report version:', err);
    }
  };

  /**
   * Load existing podcasts for this bank
   */
  const loadPodcasts = async () => {
    try {
      const response = await axios.get(`/api/research/${idrssd}/podcast/latest`);
      if (response.data.podcast) {
        const podcast = response.data.podcast;
        setCurrentPodcast(podcast);
        setPodcasts([podcast]);
      } else {
        setCurrentPodcast(null);
        setPodcasts([]);
      }
    } catch (err) {
      console.error('Error loading podcasts:', err);
      setCurrentPodcast(null);
      setPodcasts([]);
    }
  };

  /**
   * Load podcast associated with a specific report version
   */
  const loadPodcastForReport = async (reportTimestamp) => {
    try {
      // Try to load podcast with matching report timestamp
      const response = await axios.get(`/api/research/${idrssd}/podcast/for-report/${reportTimestamp}`);
      if (response.data.podcast) {
        setCurrentPodcast(response.data.podcast);
      }
      // Note: If no podcast found for this specific report, keep the current podcast
      // Don't clear it - the latest podcast is still valid to show
    } catch (err) {
      // No podcast for this report version - keep showing current podcast if it exists
      console.log('No podcast found for report version, keeping current podcast if available');
    }
  };

  /**
   * Delete the current report
   */
  const deleteReport = async () => {
    try {
      if (!currentReport || !currentReport.generatedAt) {
        throw new Error('No report to delete');
      }

      // Find the report filename from the report data
      // The filename format is: idrssd_timestamp.json or idrssd_agent_timestamp.json
      const response = await axios.get(`/api/research/${idrssd}/latest`);
      if (!response.data.hasReport || !response.data.fileName) {
        throw new Error('Report file not found');
      }

      await axios.delete(`/api/research/${idrssd}/${response.data.fileName}`);
      setCurrentReport(null);
      setReportVersions([]);
      await loadReports(); // Refresh to confirm deletion
    } catch (err) {
      console.error('Error deleting report:', err);
      throw err;
    }
  };

  /**
   * Delete the current podcast
   */
  const deletePodcast = async () => {
    try {
      if (!currentPodcast || !currentPodcast.filename) {
        throw new Error('No podcast to delete');
      }

      await axios.delete(`/api/research/${idrssd}/podcast/${currentPodcast.filename}`);
      setCurrentPodcast(null);
      setPodcasts([]);
      await loadPodcasts(); // Refresh to confirm deletion
    } catch (err) {
      console.error('Error deleting podcast:', err);
      throw err;
    }
  };

  /**
   * Load existing presentations for this bank
   */
  const loadPresentations = async () => {
    try {
      const response = await axios.get(`/api/research/${idrssd}/presentation/latest`);
      if (response.data.presentation) {
        setCurrentPresentation(response.data.presentation);
      } else {
        setCurrentPresentation(null);
      }
    } catch (err) {
      console.error('Error loading presentations:', err);
      setCurrentPresentation(null);
    }
  };

  /**
   * Generate presentation from current report (SSE)
   */
  const generatePresentation = async () => {
    try {
      if (!currentReport || !selectedReportTimestamp) {
        throw new Error('No report selected');
      }

      setError(null);
      setPresentationInProgress(true);
      setPresentationStatus('Generating presentation...');

      const response = await fetch(`/api/research/${idrssd}/presentation/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportTimestamp: selectedReportTimestamp
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let presentationResult = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.substring(6));

            if (data.stage === 'loading') {
              setPresentationStatus('Loading research report...');
            } else if (data.stage === 'generating') {
              setPresentationStatus('Analyzing report and creating slides...');
            } else if (data.stage === 'saving') {
              setPresentationStatus('Saving presentation...');
            } else if (data.stage === 'complete') {
              if (data.presentation) {
                presentationResult = data.presentation;
              }
              setPresentationStatus('Presentation generated successfully');
            } else if (data.stage === 'error') {
              throw new Error(data.message);
            }
          }
        }
      }

      // Refresh presentations list and open the new one
      setPresentationInProgress(false);
      setPresentationStatus('');
      await loadPresentations();

      if (presentationResult && presentationResult.url) {
        window.open(presentationResult.url, '_blank');
      }

    } catch (err) {
      console.error('Error generating presentation:', err);
      setError('Failed to generate presentation: ' + err.message);
      setPresentationInProgress(false);
      setPresentationStatus('');
      throw err;
    }
  };

  /**
   * Delete the current presentation
   */
  const deletePresentation = async () => {
    try {
      if (!currentPresentation || !currentPresentation.filename) {
        throw new Error('No presentation to delete');
      }

      await axios.delete(`/api/research/${idrssd}/presentation/${currentPresentation.filename}`);
      setCurrentPresentation(null);
      await loadPresentations(); // Refresh to confirm deletion
    } catch (err) {
      console.error('Error deleting presentation:', err);
      throw err;
    }
  };

  /**
   * Load PDFs for this bank
   */
  const loadPDFs = async () => {
    try {
      const response = await axios.get(`/api/research/${idrssd}/pdfs`);
      if (response.data.pdfs) {
        setPdfs(response.data.pdfs);
      }
    } catch (err) {
      console.error('Error loading PDFs:', err);
    }
  };

  /**
   * Load RAG infrastructure statistics
   */
  const loadRAGStats = async () => {
    try {
      const response = await axios.get(`/api/research/${idrssd}/rag-stats`);
      if (response.data.stats) {
        setRagStats(response.data.stats);
      }
    } catch (err) {
      console.error('Error loading RAG stats:', err);
    }
  };

  /**
   * Load document checklist
   */
  const loadDocumentChecklist = async () => {
    try {
      const response = await axios.get(`/api/research/${idrssd}/document-checklist`);
      if (response.data.checklist) {
        setDocumentChecklist(response.data.checklist);
      }
    } catch (err) {
      console.error('Error loading document checklist:', err);
    }
  };

  /**
   * Set document type for a source
   */
  const setSourceDocumentType = async (sourceId, documentType) => {
    try {
      await axios.post(`/api/research/${idrssd}/sources/${sourceId}/set-document-type`, {
        documentType
      });
      await loadDocumentChecklist(); // Reload checklist
    } catch (err) {
      console.error('Error setting document type:', err);
      throw err;
    }
  };

  /**
   * Upload a source to RAG pipeline
   */
  const uploadSourceToRAG = async (sourceId) => {
    try {
      const response = await axios.post(`/api/research/${idrssd}/sources/${sourceId}/upload-to-rag`);

      // Reload everything to reflect updated RAG status
      await Promise.all([
        loadDocumentChecklist(),
        loadRAGStats(),
        loadLatestSources(), // Reload sources to update ragStatus in UI
        loadPDFs() // Reload PDFs to show in sidebar
      ]);

      return response.data;
    } catch (err) {
      console.error('Error uploading to RAG:', err);
      throw err;
    }
  };

  /**
   * Refresh/reprocess all RAG documents (pending or failed)
   */
  const refreshRAG = async () => {
    try {
      const response = await axios.post(`/api/research/${idrssd}/refresh-rag`);

      // Reload everything to reflect updated RAG status
      await Promise.all([
        loadRAGStats(),
        loadLatestSources(),
        loadPDFs() // Reload PDFs to show updated RAG status in sidebar
      ]);

      return response.data;
    } catch (err) {
      console.error('Error refreshing RAG:', err);
      throw err;
    }
  };

  /**
   * Delete entire RAG environment for this bank
   */
  const deleteRAG = async () => {
    try {
      console.log(`[AIContext] deleteRAG called for bank idrssd: ${idrssd}`);
      console.log(`[AIContext] Sending DELETE request to: /api/research/${idrssd}/delete-rag`);

      const response = await axios.delete(`/api/research/${idrssd}/delete-rag`);

      console.log(`[AIContext] Delete response status:`, response.status);
      console.log(`[AIContext] Delete response data:`, response.data);

      // Reload everything to reflect deleted RAG
      console.log(`[AIContext] Reloading data after deletion...`);
      try {
        await Promise.all([
          loadRAGStats(),
          loadLatestSources(),
          loadPDFs(),
          loadMetadata()
        ]);
        console.log(`[AIContext] Data reload completed`);
      } catch (reloadErr) {
        console.error('[AIContext] Error reloading data (non-fatal):', reloadErr);
        // Don't throw - deletion was successful even if reload fails
      }

      console.log(`[AIContext] Delete completed successfully`);
      return response.data;
    } catch (err) {
      console.error('[AIContext] Error deleting RAG:', err);
      console.error('[AIContext] Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        statusText: err.response?.statusText,
        headers: err.response?.headers,
        url: `/api/research/${idrssd}/delete-rag`
      });
      console.error('[AIContext] Full error response:', err.response);
      throw err;
    }
  };

  /**
   * Extract strategic insights from RAG
   */
  const extractInsights = async () => {
    try {
      setInsightExtracting(true);
      setInsightProgress(0);
      setInsightStatus('Starting insight extraction...');
      addLog('🔍 Starting insight extraction...', 'info');

      const eventSource = new EventSource(`/api/research/${idrssd}/extract-insights`);

      return new Promise((resolve, reject) => {
        eventSource.addEventListener('status', (e) => {
          try {
            const data = JSON.parse(e.data);
            console.log('[Insight Extraction] Status:', data.message);
            setInsightStatus(data.message);
            addLog(data.message, 'info');
            if (data.progress !== undefined) {
              setInsightProgress(data.progress);
            }
          } catch (err) {
            console.error('[Insight Extraction] Failed to parse status event:', err, e);
          }
        });

        eventSource.addEventListener('complete', (e) => {
          try {
            const data = JSON.parse(e.data);
            console.log('[Insight Extraction] Complete:', data);
            setInsightExtracting(false);
            setInsightProgress(100);
            setInsightStatus('Insight extraction complete');
            addLog('✅ Insight extraction complete', 'success');
            eventSource.close();

            // Reload metadata to get updated insights
            loadMetadata();

            resolve(data.insights);
          } catch (err) {
            console.error('[Insight Extraction] Failed to parse complete event:', err, e);
            eventSource.close();
            reject(err);
          }
        });

        eventSource.addEventListener('error', (e) => {
          try {
            // Only try to parse if e.data exists
            if (e.data) {
              const data = JSON.parse(e.data);
              console.error('[Insight Extraction] Error:', data);
              setInsightExtracting(false);
              setInsightStatus(`Error: ${data.message}`);
              addLog(`❌ Insight extraction error: ${data.message}`, 'error');
              eventSource.close();
              reject(new Error(data.message));
            } else {
              throw new Error('No error data provided');
            }
          } catch (err) {
            console.error('[Insight Extraction] Error event without parseable data:', err, e);
            setInsightExtracting(false);
            setInsightStatus('Error during extraction');
            addLog('❌ Error during extraction', 'error');
            eventSource.close();
            reject(new Error('Error during extraction'));
          }
        });

        eventSource.onerror = (err) => {
          console.error('[Insight Extraction] EventSource error:', err);
          setInsightExtracting(false);
          setInsightStatus('Connection error');
          addLog('❌ Connection error during insight extraction', 'error');
          eventSource.close();
          reject(err);
        };
      });
    } catch (err) {
      console.error('Error extracting insights:', err);
      setInsightExtracting(false);
      setInsightStatus('Error extracting insights');
      addLog(`❌ ${err.message}`, 'error');
      throw err;
    }
  };

  /**
   * Load metadata (logo, org chart, ticker) for this bank
   */
  const loadMetadata = async () => {
    try {
      const response = await axios.get(`/api/research/${idrssd}/metadata`);
      if (response.data.metadata) {
        const md = response.data.metadata;
        setMetadata(md);

        // Update metadataStatus based on what exists in the database
        setMetadataStatus({
          logo: {
            status: md.logo?.localPath ? 'success' : 'pending',
            error: null
          },
          ticker: {
            status: md.ticker?.symbol ? 'success' : 'pending',
            error: null
          },
          orgChart: {
            status: (md.orgChart?.executives?.length > 0 || md.orgChart?.boardMembers?.length > 0) ? 'success' : 'pending',
            error: null
          }
        });
      }
    } catch (err) {
      console.error('Error loading metadata:', err);
    }
  };

  /**
   * Start metadata gathering in parallel (called when source gathering starts)
   */
  const startMetadataGathering = async () => {
    try {
      setMetadataGathering(true);
      setMetadataProgress(0);

      const eventSource = new EventSource(`/api/research/${idrssd}/gather-metadata`);

      eventSource.addEventListener('status', (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('[Metadata] Status:', data.message);
          if (data.progress !== undefined) {
            setMetadataProgress(data.progress);
          }
        } catch (err) {
          console.error('[Metadata] Failed to parse status event:', err);
        }
      });

      eventSource.addEventListener('logo', (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('[Metadata] Logo:', data.success ? 'found' : 'not found');
          if (data.success) {
            setMetadata(prev => ({
              ...prev,
              logo: data
            }));
          }
          setMetadataStatus(prev => ({
            ...prev,
            logo: { status: data.success ? 'success' : 'failed', error: data.error || null }
          }));
        } catch (err) {
          console.error('[Metadata] Failed to parse logo event:', err);
        }
      });

      eventSource.addEventListener('ticker', (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('[Metadata] Ticker:', data.success ? 'found' : 'not found');
          if (data.success) {
            setMetadata(prev => ({
              ...prev,
              ticker: data
            }));
          }
          setMetadataStatus(prev => ({
            ...prev,
            ticker: { status: data.success ? 'success' : 'failed', error: data.error || null }
          }));
        } catch (err) {
          console.error('[Metadata] Failed to parse ticker event:', err);
        }
      });

      eventSource.addEventListener('orgchart', (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('[Metadata] Org chart:', data.success ? `found (${data.executives?.length || 0} executives)` : 'not found');
          if (data.success) {
            setMetadata(prev => ({
              ...prev,
              orgChart: data
            }));
          }
          setMetadataStatus(prev => ({
            ...prev,
            orgChart: { status: data.success ? 'success' : 'failed', error: data.error || null }
          }));
        } catch (err) {
          console.error('[Metadata] Failed to parse orgchart event:', err);
        }
      });

      eventSource.addEventListener('complete', (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('[Metadata] Gathering complete');
          setMetadata(data.metadata);
          setMetadataGathering(false);
          setMetadataProgress(100);
          eventSource.close();
        } catch (err) {
          console.error('[Metadata] Failed to parse complete event:', err);
          setMetadataGathering(false);
          eventSource.close();
        }
      });

      eventSource.addEventListener('error', (e) => {
        console.error('[Metadata] Error event:', e);
        setMetadataGathering(false);
        eventSource.close();
      });

      eventSource.onerror = () => {
        console.error('[Metadata] EventSource error');
        setMetadataGathering(false);
        eventSource.close();
      };

    } catch (err) {
      console.error('Error starting metadata gathering:', err);
      setMetadataGathering(false);
    }
  };

  /**
   * Upload a PDF file
   */
  const uploadPDF = async (file, description = '') => {
    try {
      setPdfUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('pdf', file);
      if (description) {
        formData.append('description', description);
      }

      const response = await axios.post(
        `/api/research/${idrssd}/pdfs/upload`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      // Reload PDFs and RAG stats to get updated status
      await Promise.all([loadPDFs(), loadRAGStats()]);
      setPdfUploading(false);
      return response.data.pdf;
    } catch (err) {
      console.error('Error uploading PDF:', err);
      setError(err.response?.data?.error || 'Failed to upload PDF');
      setPdfUploading(false);
      throw err;
    }
  };

  /**
   * Delete a PDF
   */
  const deletePDF = async (pdfId) => {
    try {
      await axios.delete(`/api/research/${idrssd}/pdfs/${pdfId}`);

      // Reload PDFs and RAG stats after deletion
      await Promise.all([loadPDFs(), loadRAGStats()]);
    } catch (err) {
      console.error('Error deleting PDF:', err);
      setError('Failed to delete PDF');
      throw err;
    }
  };

  /**
   * Download a source as PDF and add to library
   */
  const downloadSourceAsPDF = async (sourceId) => {
    try {
      setError(null);
      const response = await axios.post(`/api/research/${idrssd}/pdfs/download-from-source`, {
        sourceId
      });

      // Add to local PDF state
      if (response.data.pdf) {
        setPdfs(prev => [...prev, response.data.pdf]);
      }

      return response.data;
    } catch (err) {
      console.error('Error downloading source as PDF:', err);
      setError(err.response?.data?.error || 'Failed to download PDF');
      throw err;
    }
  };

  /**
   * Generate podcast from report
   */
  const generatePodcast = async (selectedExperts = []) => {
    try {
      setError(null);
      setPodcastInProgress(true);
      setPodcastProgress(0);
      setPodcastStatus('Starting podcast generation...');

      // Start SSE connection for podcast generation
      const expertsParam = selectedExperts.length > 0 ? `?experts=${selectedExperts.join(',')}` : '';
      const eventSource = new EventSource(
        `/api/research/${idrssd}/podcast/generate${expertsParam}`
      );

      eventSource.addEventListener('loading', (e) => {
        try {
          const data = JSON.parse(e.data);
          setPodcastStatus(data.message || 'Loading report...');
          setPodcastProgress(10);
        } catch (err) {
          console.error('[Podcast] Failed to parse loading event:', err);
        }
      });

      eventSource.addEventListener('script', (e) => {
        try {
          const data = JSON.parse(e.data);
          setPodcastStatus(data.message || 'Generating script...');
          setPodcastProgress(30);
        } catch (err) {
          console.error('[Podcast] Failed to parse script event:', err);
        }
      });

      eventSource.addEventListener('script_complete', (e) => {
        try {
          const data = JSON.parse(e.data);
          setPodcastStatus(data.message || 'Script complete');
          setPodcastProgress(50);
        } catch (err) {
          console.error('[Podcast] Failed to parse script_complete event:', err);
        }
      });

      eventSource.addEventListener('audio', (e) => {
        try {
          const data = JSON.parse(e.data);
          setPodcastStatus(data.message || 'Generating audio...');
          setPodcastProgress(60);
        } catch (err) {
          console.error('[Podcast] Failed to parse audio event:', err);
        }
      });

      eventSource.addEventListener('audio_progress', (e) => {
        try {
          const data = JSON.parse(e.data);
          const progress = 60 + (data.current / data.total) * 30;
          setPodcastProgress(Math.round(progress));
          setPodcastStatus(`Generating audio: ${data.speaker || ''} (${data.current}/${data.total})`);
        } catch (err) {
          console.error('[Podcast] Failed to parse audio_progress event:', err);
        }
      });

      eventSource.addEventListener('saving', (e) => {
        try {
          const data = JSON.parse(e.data);
          setPodcastStatus(data.message || 'Saving podcast...');
          setPodcastProgress(95);
        } catch (err) {
          console.error('[Podcast] Failed to parse saving event:', err);
        }
      });

      let podcastCompleted = false;

      eventSource.addEventListener('complete', async () => {
        console.log('Podcast generation complete');
        podcastCompleted = true;
        setPodcastInProgress(false);
        setPodcastProgress(100);
        setPodcastStatus('');
        await loadPodcasts();
        eventSource.close();
      });

      eventSource.addEventListener('error', (e) => {
        console.error('SSE error:', e);
        if (!podcastCompleted) {
          setPodcastInProgress(false);
          setError('Podcast generation failed');
        }
        eventSource.close();
      });

      eventSource.onerror = () => {
        console.log('EventSource connection closed');
        if (!podcastCompleted) {
          setPodcastInProgress(false);
        }
        eventSource.close();
      };

    } catch (err) {
      console.error('Error generating podcast:', err);
      setError('Failed to generate podcast');
      setPodcastInProgress(false);
    }
  };

  /**
   * Check for active jobs on mount
   */
  const checkForActiveJobs = async () => {
    try {
      // Check for active source gathering job
      const gatherResponse = await axios.get(`/api/research/${idrssd}/job-status?type=gather-sources`);
      if (gatherResponse.data.hasJob &&
          (gatherResponse.data.job.status === 'running' || gatherResponse.data.job.status === 'pending')) {
        setGatheringInProgress(true);
        setSessionId(gatherResponse.data.job.sessionId);
        // Load discovered sources for this session
        loadDiscoveredSources(gatherResponse.data.job.sessionId);
      }

      // Check for active report generation job
      const reportResponse = await axios.get(`/api/research/${idrssd}/job-status?type=report`);
      if (reportResponse.data.hasJob &&
          (reportResponse.data.job.status === 'running' || reportResponse.data.job.status === 'pending')) {
        setReportInProgress(true);
        setReportProgress(reportResponse.data.job.progress || 0);
      }
    } catch (err) {
      console.error('Error checking for active jobs:', err);
    }
  };

  /**
   * Load discovered sources for a session
   */
  const loadDiscoveredSources = async (sid) => {
    try {
      const response = await axios.get(`/api/research/${idrssd}/sources?sessionId=${sid}`);
      if (response.data.sources) {
        // Group sources by category (must match backend categories)
        const grouped = {
          investorPresentation: [],
          earningsTranscript: [],
          strategyAnalysis: [],
          analystReports: []
        };
        response.data.sources.forEach(source => {
          if (grouped[source.category]) {
            grouped[source.category].push(source);
          }
        });
        setDiscoveredSources(grouped);

        // If we got a session ID back, set it
        if (response.data.sessionId) {
          setSessionId(response.data.sessionId);
        }
      }
    } catch (err) {
      console.error('Error loading discovered sources:', err);
    }
  };

  /**
   * Load sources from the latest session (for page refresh)
   */
  const loadLatestSources = async () => {
    try {
      console.log('loadLatestSources: Fetching sources for bank', idrssd);
      const response = await axios.get(`/api/research/${idrssd}/sources/latest`);
      console.log('loadLatestSources: Response received', response.data);

      if (response.data.sources && response.data.sources.length > 0) {
        console.log(`loadLatestSources: Found ${response.data.sources.length} sources`);

        // Group sources by category (must match backend categories)
        const grouped = {
          investorPresentation: [],
          earningsTranscript: [],
          strategyAnalysis: [],
          analystReports: []
        };
        response.data.sources.forEach(source => {
          if (grouped[source.category]) {
            grouped[source.category].push(source);
          }
        });

        console.log('loadLatestSources: Grouped sources', grouped);
        setDiscoveredSources(grouped);

        // Set the session ID from the latest sources
        if (response.data.sessionId) {
          console.log('loadLatestSources: Setting session ID', response.data.sessionId);
          setSessionId(response.data.sessionId);
        }
      } else {
        console.log('loadLatestSources: No sources found');
      }
    } catch (err) {
      // It's okay if there are no sources yet
      console.log('loadLatestSources: Error loading sources (this is normal for first time)', err.message);
    }
  };

  /**
   * Start data gathering (Stage 1)
   */
  const startDataGathering = async (config = userConfig) => {
    try {
      setError(null);
      setGatheringInProgress(true);
      setGatheringProgress(0);
      // Initialize all categories that will be searched (must match backend categories)
      setDiscoveredSources({
        investorPresentation: [],
        earningsTranscript: [],
        strategyAnalysis: [],
        analystReports: []
      });

      // Generate new session ID
      const newSessionId = `session-${Date.now()}`;
      setSessionId(newSessionId);

      // Add initial log
      addLog('🔍 Starting source gathering...', 'info');

      // Start metadata gathering in parallel (logo, org chart, ticker)
      startMetadataGathering();

      // Start SSE connection for source gathering
      const eventSource = new EventSource(
        `/api/research/${idrssd}/gather-sources?sessionId=${newSessionId}&config=${encodeURIComponent(JSON.stringify(config))}`
      );

      eventSource.addEventListener('source-found', (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('Source found:', data);

          // Add source to the appropriate category with category field included
          setDiscoveredSources(prev => ({
            ...prev,
            [data.category]: [...(prev[data.category] || []), { ...data.source, category: data.category }]
          }));

          // Add log entry
          const source = data.source || {};
          addLog(`✓ Found ${data.category}: ${source.title || source.url}`, 'success');
        } catch (err) {
          console.error('[Gather Sources] Failed to parse source-found event:', err);
        }
      });

      eventSource.addEventListener('progress', (e) => {
        try {
          const data = JSON.parse(e.data);
          setGatheringProgress(data.progress);
          if (data.message) {
            addLog(data.message, 'info');
          }
        } catch (err) {
          console.error('[Gather Sources] Failed to parse progress event:', err);
        }
      });

      eventSource.addEventListener('category-complete', (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('Category complete:', data);
          const categoryName = data.category.replace(/([A-Z])/g, ' $1').trim();
          addLog(`📦 ${categoryName}: ${data.foundCount} source(s) found`, 'info');
        } catch (err) {
          console.error('[Gather Sources] Failed to parse category-complete event:', err);
        }
      });

      eventSource.addEventListener('complete', () => {
        console.log('Source gathering complete');
        setGatheringInProgress(false);
        setGatheringProgress(100);
        addLog('✓ Source gathering complete', 'success');
        eventSource.close();
      });

      eventSource.addEventListener('error', (e) => {
        console.error('SSE error:', e);
        setGatheringInProgress(false);
        setError('Source gathering failed');
        addLog('❌ Source gathering failed', 'error');
        eventSource.close();
      });

      // Catch-all handler for any SSE events without specific handlers
      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          // Log any unhandled events
          if (data.message) {
            addLog(data.message, data.level || 'info');
          } else {
            // Log the raw data if no message field
            addLog(JSON.stringify(data), 'info');
          }
        } catch (err) {
          // If it's not JSON, just log the raw data
          addLog(e.data, 'info');
        }
      };

      eventSource.onerror = () => {
        console.log('EventSource connection closed');
        eventSource.close();
      };

    } catch (err) {
      console.error('Error starting data gathering:', err);
      setError('Failed to start data gathering');
      setGatheringInProgress(false);
    }
  };

  /**
   * Approve a source and start polling for fetch status
   */
  const approveSource = async (sourceId, category) => {
    try {
      const response = await axios.post(`/api/research/${idrssd}/sources/${sourceId}/approve`);

      // Update local state immediately
      setDiscoveredSources(prev => ({
        ...prev,
        [category]: prev[category].map(source =>
          source.id === sourceId ? {
            ...source,
            status: 'approved',
            fetchStatus: response.data.source.fetchStatus || 'not_fetched'
          } : source
        )
      }));

      // Start polling for fetch status if fetching started
      if (response.data.source.fetchStatus === 'not_fetched') {
        pollFetchStatus(sourceId, category);
      }
    } catch (err) {
      console.error('Error approving source:', err);
      setError('Failed to approve source');
    }
  };

  /**
   * Poll for fetch status updates for a source
   */
  const pollFetchStatus = async (sourceId, category, attempts = 0) => {
    const maxAttempts = 30; // Poll for up to 30 seconds (30 * 1 second)

    if (attempts >= maxAttempts) {
      console.log(`Stopped polling for ${sourceId} after ${maxAttempts} attempts`);
      return;
    }

    // Wait 1 second before polling
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      const response = await axios.get(`/api/research/${idrssd}/sources/latest`);
      const sources = response.data.sources || [];
      const source = sources.find(s => s.id === sourceId);

      if (source) {
        // Update local state with latest fetch status
        setDiscoveredSources(prev => ({
          ...prev,
          [category]: prev[category].map(s =>
            s.id === sourceId ? {
              ...s,
              fetchStatus: source.fetchStatus,
              fetchError: source.fetchError,
              contentLength: source.contentLength,
              contentType: source.contentType,
              fetchable: source.fetchable,
              hasContent: source.hasContent
            } : s
          )
        }));

        // If still fetching, poll again
        if (source.fetchStatus === 'fetching') {
          pollFetchStatus(sourceId, category, attempts + 1);
        }
      }
    } catch (err) {
      console.error('Error polling fetch status:', err);
    }
  };

  /**
   * Ignore a source
   */
  const ignoreSource = async (sourceId, category) => {
    try {
      await axios.post(`/api/research/${idrssd}/sources/${sourceId}/ignore`);

      // Update local state
      setDiscoveredSources(prev => ({
        ...prev,
        [category]: prev[category].map(source =>
          source.id === sourceId ? { ...source, status: 'ignored' } : source
        )
      }));
    } catch (err) {
      console.error('Error ignoring source:', err);
      setError('Failed to ignore source');
    }
  };

  /**
   * Find a better source (user can provide refinement instructions)
   */
  const findBetterSource = async (category, refinementPrompt) => {
    try {
      const response = await axios.post(`/api/research/${idrssd}/find-better-source`, {
        category,
        sessionId,
        refinementPrompt
      });

      if (response.data.source) {
        // Add new source to the category
        setDiscoveredSources(prev => ({
          ...prev,
          [category]: [...prev[category], response.data.source]
        }));
      }

      return response.data;
    } catch (err) {
      console.error('Error finding better source:', err);
      setError('Failed to find better source');
      throw err;
    }
  };

  /**
   * Generate report from approved sources (Stage 2)
   */
  const generateReportFromApprovedSources = async () => {
    try {
      setError(null);
      setReportInProgress(true);
      setReportProgress(0);
      setCurrentPhase('analysis');
      setStreamingText('');
      setStreamingThinking('');

      // Collect all approved source IDs
      const approvedSourceIds = [];
      Object.values(discoveredSources).forEach(category => {
        category.forEach(source => {
          if (source.status === 'approved') {
            approvedSourceIds.push(source.id);
          }
        });
      });

      // Start SSE connection for report generation
      const eventSource = new EventSource(
        `/api/research/${idrssd}/generate-with-sources?sourceIds=${encodeURIComponent(JSON.stringify(approvedSourceIds))}&sessionId=${sessionId}`
      );

      eventSource.addEventListener('status', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.phase) setCurrentPhase(data.phase);
          if (data.progress !== undefined) setReportProgress(data.progress);
        } catch (err) {
          console.error('[Generate Report] Failed to parse status event:', err);
        }
      });

      eventSource.addEventListener('thinking', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.text) {
            setStreamingThinking(prev => prev + data.text);
          }
        } catch (err) {
          console.error('[Generate Report] Failed to parse thinking event:', err);
        }
      });

      eventSource.addEventListener('text', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.text) {
            setStreamingText(prev => prev + data.text);
          }
        } catch (err) {
          console.error('[Generate Report] Failed to parse text event:', err);
        }
      });

      let reportCompleted = false;

      eventSource.addEventListener('complete', async () => {
        console.log('Report generation complete');
        reportCompleted = true;
        setReportInProgress(false);
        setReportProgress(100);
        setStreamingText('');
        setStreamingThinking('');
        await loadReports();
        eventSource.close();
      });

      eventSource.addEventListener('error', (e) => {
        console.error('SSE error:', e);
        // Only show error if report didn't complete successfully
        if (!reportCompleted) {
          setReportInProgress(false);
          setError('Connection lost. Report generation may have stopped due to a server error. Please check the server logs or try again.');
        }
        eventSource.close();
      });

      eventSource.onerror = () => {
        console.error('EventSource connection closed or error');
        // Only show error if report didn't complete successfully
        if (!reportCompleted) {
          setReportInProgress(false);
          setError('Connection lost. Report generation may have stopped due to a server error. Please check the server logs or try again.');
        }
        eventSource.close();
      };

    } catch (err) {
      console.error('Error generating report:', err);
      setError('Failed to generate report');
      setReportInProgress(false);
    }
  };

  /**
   * Generate report using agent-based approach
   * The agent adaptively explores data and queries sources
   */
  const generateAgentReport = async () => {
    try {
      setError(null);
      setReportInProgress(true);
      setReportProgress(0);
      setCurrentPhase('agent_research');
      setStreamingText('');
      setStreamingThinking('');
      setAgentMilestones([]);  // Reset milestones
      setAgentInsights([]);    // Reset insights
      addLog('🔬 Starting agent report generation...', 'info');

      // Start SSE connection for agent-based report generation
      const eventSource = new EventSource(
        `/api/research/${idrssd}/generate-agent?sessionId=${sessionId}`
      );

      let reportCompleted = false;

      // Status updates
      eventSource.addEventListener('message', (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('Agent SSE message:', data);

          // Update progress based on stage
          if (data.stage === 'init') {
            setReportProgress(5);
            addLog('Initializing agent...', 'info');
          } else if (data.stage === 'fetching') {
            setReportProgress(10);
            addLog('Fetching data...', 'info');
          } else if (data.stage === 'preparing') {
            setReportProgress(15);
            addLog('Preparing research context...', 'info');
          } else if (data.stage === 'agent_init') {
            setCurrentPhase('agent_research');
            setReportProgress(20);
            addLog('Agent research initialized', 'info');
          } else if (data.stage === 'agent_running') {
            setReportProgress(25);
            addLog('Agent researching...', 'info');
          } else if (data.stage === 'agent_milestone') {
            // Agent reached a milestone (e.g., analyzing financials, querying documents)
            const milestone = {
              message: data.message || data.milestone || 'Milestone reached',
              details: data.details || '',
              timestamp: new Date()
            };
            setAgentMilestones(prev => [...prev, milestone]);
            setReportProgress(Math.min(60, reportProgress + 3));
            addLog(`📍 ${milestone.message}`, 'info');
          } else if (data.stage === 'agent_insight' && data.insight) {
            // Agent discovered an insight
            const insight = data.insight;
            setAgentInsights(prev => [...prev, insight]);
            setReportProgress(Math.min(65, reportProgress + 2));
            addLog(`💡 Insight: ${typeof insight === 'string' ? insight : insight.title || 'New insight'}`, 'success');
          } else if (data.stage === 'agent_complete') {
            setReportProgress(70);
            addLog('Agent research complete', 'info');
          } else if (data.stage === 'synthesizing') {
            setCurrentPhase('synthesis');
            setReportProgress(75);
            addLog('Synthesizing report...', 'info');
          } else if (data.stage === 'synthesis_generating') {
            setCurrentPhase('synthesis');
            setReportProgress(80);
            addLog('Generating final report...', 'info');
          } else if (data.stage === 'synthesis_complete') {
            setReportProgress(95);
            addLog('Report synthesis complete', 'info');
          } else if (data.stage === 'saving') {
            setReportProgress(98);
            addLog('Saving report...', 'info');
          } else if (data.stage === 'complete') {
            console.log('Agent report generation complete');
            reportCompleted = true;
            setReportInProgress(false);
            setReportProgress(100);
            setStreamingText('');
            setStreamingThinking('');
            setAgentMilestones([]);  // Clear milestones on completion
            setAgentInsights([]);    // Clear insights (they're now in the report)
            loadReports();
            eventSource.close();
            addLog('✅ Agent report generation complete', 'success');
          } else if (data.stage === 'error') {
            console.error('Agent report generation error:', data.message);
            if (!reportCompleted) {
              setError(data.message || 'Agent report generation failed');
              setReportInProgress(false);
              addLog(`❌ Report error: ${data.message || 'Unknown error'}`, 'error');
            }
            eventSource.close();
          } else if (data.message) {
            // Log any other messages that have a message field
            addLog(data.message, 'info');
          }
        } catch (parseError) {
          console.error('Error parsing agent SSE message:', parseError);
        }
      });

      eventSource.onerror = (e) => {
        console.error('Agent EventSource connection error:', e);
        if (!reportCompleted) {
          setReportInProgress(false);
          setError('Connection lost. The agent workflow may have stopped due to a server error. Please check the server logs or try again.');
          addLog('❌ Connection lost during report generation', 'error');
        }
        eventSource.close();
      };

    } catch (err) {
      console.error('Error generating agent report:', err);
      setError('Failed to generate agent report');
      setReportInProgress(false);
      addLog(`❌ ${err.message}`, 'error');
    }
  };

  /**
   * Cancel active job
   */
  const cancelJob = async (jobType) => {
    try {
      await axios.delete(`/api/research/${idrssd}/job?type=${jobType}`);

      if (jobType === 'gather-sources') {
        setGatheringInProgress(false);
      } else if (jobType === 'report') {
        setReportInProgress(false);
        setStreamingText('');
        setStreamingThinking('');
      }
    } catch (err) {
      console.error('Error cancelling job:', err);
      setError('Failed to cancel job');
    }
  };

  /**
   * Clear all data for this bank (sources, reports, podcasts)
   */
  const clearAllSources = async () => {
    try {
      console.log(`Clearing all data for bank: ${idrssd}`);

      // Delete all data from the backend
      const response = await axios.delete(`/api/research/${idrssd}/clear-all`);

      console.log('Clear result:', response.data);

      // Reset all local state
      setDiscoveredSources({
        investorPresentation: [],
        earningsTranscript: [],
        strategyAnalysis: [],
        analystReports: []
      });
      setSessionId(null);
      setGatheringProgress(0);
      setError(null);

      // Reset report and podcast state
      setCurrentReport(null);
      setReportVersions([]);
      setCurrentPodcast(null);
      setPodcasts([]);

      console.log('All data cleared successfully');
    } catch (err) {
      console.error('Error clearing all data:', err);
      setError('Failed to clear all data');
    }
  };

  /**
   * Get approved sources count
   */
  const getApprovedSourcesCount = () => {
    let count = 0;
    Object.values(discoveredSources).forEach(category => {
      category.forEach(source => {
        if (source.status === 'approved') {
          count++;
        }
      });
    });
    return count;
  };

  /**
   * Get pending sources count
   */
  const getPendingSourcesCount = () => {
    let count = 0;
    Object.values(discoveredSources).forEach(category => {
      category.forEach(source => {
        if (source.status === 'pending') {
          count++;
        }
      });
    });
    return count;
  };

  const value = {
    // Terminal Logging
    logs,

    // Stage 1 State
    gatheringInProgress,
    gatheringProgress,
    discoveredSources,
    sessionId,

    // Stage 2 State
    reportInProgress,
    reportProgress,
    currentPhase,
    streamingText,
    streamingThinking,
    
    // Agent Research State
    agentMilestones,
    agentInsights,

    // Content State
    reportVersions, // All report versions (metadata)
    currentReport, // Currently selected full report
    selectedReportTimestamp, // Timestamp of selected report
    podcasts,
    currentPodcast,

    // PDF State
    pdfs,
    pdfUploading,
    ragStats,
    documentChecklist,

    // Strategic Insights State
    insightExtracting,
    insightProgress,
    insightStatus,

    // Podcast State
    podcastInProgress,
    podcastProgress,
    podcastStatus,

    // Presentation State
    presentationInProgress,
    presentationStatus,
    currentPresentation,

    // Metadata State
    metadata,
    metadataGathering,
    metadataProgress,
    metadataStatus,

    // Persistent Podcast Player
    persistentPodcast,
    setPersistentPodcast,

    // Configuration
    userConfig,
    setUserConfig,

    // Error State
    error,
    setError,

    // Actions
    startDataGathering,
    approveSource,
    ignoreSource,
    findBetterSource,
    generateReportFromApprovedSources,
    generateAgentReport,
    generatePodcast,
    generatePresentation,
    cancelJob,
    clearAllSources,
    loadReports,
    selectReportVersion, // Select a specific report version to view
    loadPodcasts,
    loadPresentations,
    loadPDFs,
    loadRAGStats,
    refreshRAG,
    deleteRAG,
    loadDocumentChecklist,
    setSourceDocumentType,
    uploadSourceToRAG,
    extractInsights,
    uploadPDF,
    deletePDF,
    downloadSourceAsPDF,
    deleteReport,
    deletePodcast,
    deletePresentation,
    loadMetadata,
    startMetadataGathering,

    // Computed
    getApprovedSourcesCount,
    getPendingSourcesCount
  };

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
};
