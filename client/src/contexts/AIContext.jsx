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
  // Stage 1: Source Gathering State
  const [gatheringInProgress, setGatheringInProgress] = useState(false);
  const [gatheringProgress, setGatheringProgress] = useState(0);
  const [discoveredSources, setDiscoveredSources] = useState({
    investorPresentation: [],
    earningsTranscript: [],
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
  const [reports, setReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [podcasts, setPodcasts] = useState([]);
  const [currentPodcast, setCurrentPodcast] = useState(null);

  // PDF State
  const [pdfs, setPdfs] = useState([]);
  const [pdfUploading, setPdfUploading] = useState(false);

  // Podcast State
  const [podcastInProgress, setPodcastInProgress] = useState(false);
  const [podcastProgress, setPodcastProgress] = useState(0);
  const [podcastStatus, setPodcastStatus] = useState('');

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
          checkForActiveJobs(),
          loadLatestSources(), // Load sources from latest session
          loadPDFs() // Load PDFs for this bank
        ]);
      }
    };
    loadData();
  }, [idrssd]);

  /**
   * Load existing reports for this bank
   */
  const loadReports = async () => {
    try {
      const response = await axios.get(`/api/research/${idrssd}/latest`);
      if (response.data.hasReport) {
        const report = response.data.report;
        setCurrentReport(report);
        setReports([report]);
      }
    } catch (err) {
      console.error('Error loading reports:', err);
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
      setReports([]);
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

      // Add to local state
      setPdfs(prev => [...prev, response.data.pdf]);
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

      // Remove from local state
      setPdfs(prev => prev.filter(pdf => pdf.id !== pdfId));
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
        const data = JSON.parse(e.data);
        setPodcastStatus(data.message || 'Loading report...');
        setPodcastProgress(10);
      });

      eventSource.addEventListener('script', (e) => {
        const data = JSON.parse(e.data);
        setPodcastStatus(data.message || 'Generating script...');
        setPodcastProgress(30);
      });

      eventSource.addEventListener('script_complete', (e) => {
        const data = JSON.parse(e.data);
        setPodcastStatus(data.message || 'Script complete');
        setPodcastProgress(50);
      });

      eventSource.addEventListener('audio', (e) => {
        const data = JSON.parse(e.data);
        setPodcastStatus(data.message || 'Generating audio...');
        setPodcastProgress(60);
      });

      eventSource.addEventListener('audio_progress', (e) => {
        const data = JSON.parse(e.data);
        const progress = 60 + (data.current / data.total) * 30;
        setPodcastProgress(Math.round(progress));
        setPodcastStatus(`Generating audio: ${data.speaker || ''} (${data.current}/${data.total})`);
      });

      eventSource.addEventListener('saving', (e) => {
        const data = JSON.parse(e.data);
        setPodcastStatus(data.message || 'Saving podcast...');
        setPodcastProgress(95);
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
        // Group sources by category
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

        // Group sources by category
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
      setDiscoveredSources({
        investorPresentation: [],
        earningsTranscript: [],
        strategyAnalysis: [],
        analystReports: []
      });

      // Generate new session ID
      const newSessionId = `session-${Date.now()}`;
      setSessionId(newSessionId);

      // Start SSE connection for source gathering
      const eventSource = new EventSource(
        `/api/research/${idrssd}/gather-sources?sessionId=${newSessionId}&config=${encodeURIComponent(JSON.stringify(config))}`
      );

      eventSource.addEventListener('source-found', (e) => {
        const data = JSON.parse(e.data);
        console.log('Source found:', data);

        // Add source to the appropriate category
        setDiscoveredSources(prev => ({
          ...prev,
          [data.category]: [...prev[data.category], data.source]
        }));
      });

      eventSource.addEventListener('progress', (e) => {
        const data = JSON.parse(e.data);
        setGatheringProgress(data.progress);
      });

      eventSource.addEventListener('category-complete', (e) => {
        const data = JSON.parse(e.data);
        console.log('Category complete:', data);
      });

      eventSource.addEventListener('complete', () => {
        console.log('Source gathering complete');
        setGatheringInProgress(false);
        setGatheringProgress(100);
        eventSource.close();
      });

      eventSource.addEventListener('error', (e) => {
        console.error('SSE error:', e);
        setGatheringInProgress(false);
        setError('Source gathering failed');
        eventSource.close();
      });

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
        const data = JSON.parse(e.data);
        if (data.phase) setCurrentPhase(data.phase);
        if (data.progress !== undefined) setReportProgress(data.progress);
      });

      eventSource.addEventListener('thinking', (e) => {
        const data = JSON.parse(e.data);
        if (data.text) {
          setStreamingThinking(prev => prev + data.text);
        }
      });

      eventSource.addEventListener('text', (e) => {
        const data = JSON.parse(e.data);
        if (data.text) {
          setStreamingText(prev => prev + data.text);
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
   * Generate comprehensive report using PDFs + web search + extended thinking
   * This uses the original comprehensive endpoint with all features
   */
  const generateComprehensiveReport = async () => {
    try {
      setError(null);
      setReportInProgress(true);
      setReportProgress(0);
      setCurrentPhase('analysis');
      setStreamingText('');
      setStreamingThinking('');

      // Start SSE connection for comprehensive report generation
      // This endpoint automatically loads PDFs from the database
      const eventSource = new EventSource(
        `/api/research/${idrssd}/generate`
      );

      let reportCompleted = false;

      // Status updates
      eventSource.addEventListener('message', (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('SSE message:', data);

          // Update progress based on stage
          if (data.stage === 'init') {
            setReportProgress(5);
          } else if (data.stage === 'fetching') {
            setReportProgress(10);
          } else if (data.stage === 'preparing') {
            setReportProgress(15);
          } else if (data.stage === 'analyzing') {
            setCurrentPhase('analysis');
            setReportProgress(20);
          } else if (data.stage === 'thinking') {
            setReportProgress(30);
          } else if (data.stage === 'thinking_stream' && data.thinkingChunk) {
            setStreamingThinking(prev => prev + data.thinkingChunk);
          } else if (data.stage === 'text_stream' && data.textChunk) {
            setStreamingText(prev => prev + data.textChunk);
            setCurrentPhase('synthesis');
            setReportProgress(Math.min(90, reportProgress + 1));
          } else if (data.stage === 'saving') {
            setReportProgress(95);
          } else if (data.stage === 'complete') {
            console.log('Report generation complete');
            reportCompleted = true;
            setReportInProgress(false);
            setReportProgress(100);
            setStreamingText('');
            setStreamingThinking('');
            loadReports();
            eventSource.close();
          } else if (data.stage === 'error') {
            console.error('Report generation error:', data.message);
            if (!reportCompleted) {
              setError(data.message || 'Report generation failed');
              setReportInProgress(false);
            }
            eventSource.close();
          }
        } catch (parseError) {
          console.error('Error parsing SSE message:', parseError);
        }
      });

      eventSource.onerror = (e) => {
        console.log('EventSource connection closed or error');
        if (!reportCompleted) {
          setReportInProgress(false);
        }
        eventSource.close();
      };

    } catch (err) {
      console.error('Error generating comprehensive report:', err);
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
          } else if (data.stage === 'fetching') {
            setReportProgress(10);
          } else if (data.stage === 'preparing') {
            setReportProgress(15);
          } else if (data.stage === 'agent_init') {
            setCurrentPhase('agent_research');
            setReportProgress(20);
          } else if (data.stage === 'agent_running') {
            setReportProgress(25);
          } else if (data.stage === 'agent_milestone') {
            // Agent reached a milestone (e.g., analyzing financials, querying documents)
            const milestone = {
              message: data.message || data.milestone || 'Milestone reached',
              details: data.details || '',
              timestamp: new Date()
            };
            setAgentMilestones(prev => [...prev, milestone]);
            setReportProgress(Math.min(60, reportProgress + 3));
          } else if (data.stage === 'agent_insight' && data.insight) {
            // Agent discovered an insight
            const insight = data.insight;
            setAgentInsights(prev => [...prev, insight]);
            setReportProgress(Math.min(65, reportProgress + 2));
          } else if (data.stage === 'agent_complete') {
            setReportProgress(70);
          } else if (data.stage === 'synthesizing') {
            setCurrentPhase('synthesis');
            setReportProgress(75);
          } else if (data.stage === 'synthesis_stream' && data.textChunk) {
            setStreamingText(prev => prev + data.textChunk);
            setReportProgress(Math.min(95, reportProgress + 0.5));
          } else if (data.stage === 'saving') {
            setReportProgress(98);
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
          } else if (data.stage === 'error') {
            console.error('Agent report generation error:', data.message);
            if (!reportCompleted) {
              setError(data.message || 'Agent report generation failed');
              setReportInProgress(false);
            }
            eventSource.close();
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
        }
        eventSource.close();
      };

    } catch (err) {
      console.error('Error generating agent report:', err);
      setError('Failed to generate agent report');
      setReportInProgress(false);
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
      setReports([]);
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
    reports,
    currentReport,
    podcasts,
    currentPodcast,

    // PDF State
    pdfs,
    pdfUploading,

    // Podcast State
    podcastInProgress,
    podcastProgress,
    podcastStatus,

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
    generateComprehensiveReport,
    generateAgentReport,
    generatePodcast,
    cancelJob,
    clearAllSources,
    loadReports,
    loadPodcasts,
    loadPDFs,
    uploadPDF,
    deletePDF,
    downloadSourceAsPDF,
    deleteReport,
    deletePodcast,

    // Computed
    getApprovedSourcesCount,
    getPendingSourcesCount
  };

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
};
