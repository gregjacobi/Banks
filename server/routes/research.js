const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const Institution = require('../models/Institution');
const FinancialStatement = require('../models/FinancialStatement');
const Source = require('../models/Source');
const PDF = require('../models/PDF');
const ClaudeService = require('../services/claudeService');
const AgentOrchestrator = require('../services/agentOrchestrator');
const ContentFetcher = require('../services/contentFetcher');
const PodcastScriptService = require('../services/podcastScriptService');
const ElevenLabsService = require('../services/elevenLabsService');
const prompts = require('../prompts/bankAnalysis');
const jobTracker = require('../services/jobTracker');

// Directories for storing research reports and podcasts
const RESEARCH_DIR = path.join(__dirname, '../data/research');
const PODCAST_DIR = path.join(__dirname, '../data/podcasts');
const PDFS_DIR = path.join(__dirname, '../data/research/pdfs');

// Ensure directories exist
const ensureDirectories = async () => {
  try {
    await fs.mkdir(RESEARCH_DIR, { recursive: true });
    await fs.mkdir(PODCAST_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating directories:', error);
  }
};

// Initialize directories on module load
ensureDirectories();

// Initialize services
const claudeService = new ClaudeService();
const contentFetcher = new ContentFetcher();

/**
 * GET /api/research/:idrssd/latest
 * Get the most recent research report for a bank
 */
router.get('/:idrssd/latest', async (req, res) => {
  try {
    const { idrssd } = req.params;

    // Find all reports for this bank
    const files = await fs.readdir(RESEARCH_DIR);
    const bankReports = files.filter(f => f.startsWith(`${idrssd}_`) && f.endsWith('.json'));

    if (bankReports.length === 0) {
      return res.status(404).json({
        error: 'No research reports found',
        hasReport: false
      });
    }

    // Sort by timestamp (filename format: idrssd_timestamp.json or idrssd_agent_timestamp.json)
    bankReports.sort((a, b) => {
      // Extract timestamp from filename, handling both formats
      const partsA = a.replace('.json', '').split('_');
      const partsB = b.replace('.json', '').split('_');

      // Timestamp is last element
      const timeA = parseInt(partsA[partsA.length - 1]);
      const timeB = parseInt(partsB[partsB.length - 1]);

      return timeB - timeA; // Most recent first
    });

    // Read the most recent report
    const latestFile = path.join(RESEARCH_DIR, bankReports[0]);
    const reportData = await fs.readFile(latestFile, 'utf-8');
    const report = JSON.parse(reportData);

    res.json({
      hasReport: true,
      report,
      generatedAt: report.generatedAt,
      fileName: bankReports[0]
    });

  } catch (error) {
    console.error('Error fetching research report:', error);
    res.status(500).json({ error: 'Failed to fetch research report' });
  }
});

/**
 * GET /api/research/:idrssd/job-status
 * Get the status of the current or most recent job for a bank
 */
router.get('/:idrssd/job-status', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { type } = req.query; // 'report' or 'podcast'

    const job = jobTracker.getLatestJob(idrssd, type || 'report');

    if (!job) {
      return res.json({ hasJob: false });
    }

    // Calculate elapsed time
    const elapsedMs = Date.now() - job.createdAt;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    res.json({
      hasJob: true,
      job: {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        message: job.message,
        result: job.result,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        elapsedSeconds
      }
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

/**
 * DELETE /api/research/:idrssd/job
 * Cancel/kill a running job
 */
router.delete('/:idrssd/job', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { type } = req.query; // 'report' or 'podcast'

    const job = jobTracker.getLatestJob(idrssd, type || 'report');

    if (!job) {
      return res.status(404).json({ error: 'No active job found' });
    }

    if (job.status === 'completed' || job.status === 'failed') {
      return res.status(400).json({ error: 'Job is already finished' });
    }

    // Mark job as cancelled
    jobTracker.failJob(job.jobId, new Error('Job cancelled by user'));

    res.json({
      success: true,
      message: 'Job cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling job:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

/**
 * GET /api/research/:idrssd/generate-agent
 * Generate a bank research report using agent-based approach
 * The agent adaptively explores data, searches for context, and queries documents
 */
router.get('/:idrssd/generate-agent', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { sessionId } = req.query;

    // Set up Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.set('Content-Encoding', 'none');
    res.flushHeaders();
    res.write(': connected\n\n');

    const sendStatus = (stage, message, data = {}) => {
      const payload = JSON.stringify({ stage, message, ...data });
      console.log('Agent SSE:', stage, message);
      res.write(`data: ${payload}\n\n`);
      if (res.socket && res.socket.writable) {
        res.socket.uncork();
      }
    };

    // Step 1: Fetch bank information
    sendStatus('init', 'Initializing agent research system...');

    const institution = await Institution.findOne({ idrssd });
    if (!institution) {
      sendStatus('error', 'Bank not found');
      res.end();
      return;
    }

    // Step 2: Fetch financial data
    sendStatus('fetching', 'Loading financial data...');

    const financialStatements = await FinancialStatement.find({ idrssd })
      .sort({ reportingPeriod: -1 })
      .limit(20);

    if (financialStatements.length === 0) {
      sendStatus('error', 'No financial data found for this bank');
      res.end();
      return;
    }

    const trendsData = prepareTrendsData(financialStatements);
    const latestStatement = financialStatements[0];

    // Fetch peer analysis data
    const peerAnalysis = latestStatement.peerAnalysis || null;
    let peerData = null;

    if (peerAnalysis && peerAnalysis.peers && peerAnalysis.peers.peerIds) {
      const peerIds = peerAnalysis.peers.peerIds;
      const peerInstitutions = await Institution.find({
        idrssd: { $in: peerIds }
      }).select('idrssd name').lean();

      const peerStatements = await FinancialStatement.find({
        idrssd: { $in: peerIds },
        reportingPeriod: latestStatement.reportingPeriod
      }).select('idrssd ratios balanceSheet.assets.totalAssets').lean();

      const peerMap = new Map(peerInstitutions.map(p => [p.idrssd, p.name]));

      peerData = {
        count: peerAnalysis.peers.count,
        rankings: peerAnalysis.rankings,
        peerAverages: peerAnalysis.peerAverages,
        peerBanks: peerStatements.map(stmt => ({
          idrssd: stmt.idrssd,
          name: peerMap.get(stmt.idrssd) || `Bank ${stmt.idrssd}`,
          totalAssets: stmt.balanceSheet?.assets?.totalAssets || 0,
          efficiencyRatio: stmt.ratios?.efficiencyRatio,
          roe: stmt.ratios?.roe,
          roa: stmt.ratios?.roa,
          nim: stmt.ratios?.netInterestMargin
        })).sort((a, b) => b.totalAssets - a.totalAssets)
      };
    }

    const bankInfo = {
      idrssd: institution.idrssd,
      name: institution.name,
      city: institution.city,
      state: institution.state,
      website: institution.website,
      totalAssets: latestStatement.balanceSheet.assets.totalAssets,
      latestPeriod: latestStatement.reportingPeriod.toISOString().split('T')[0]
    };

    // Step 3: Get approved sources if sessionId provided
    let approvedSources = [];
    if (sessionId) {
      sendStatus('preparing', 'Loading research sources...');
      approvedSources = await Source.getApprovedBySession(sessionId);
      console.log(`Found ${approvedSources.length} approved sources for session ${sessionId}`);
    }

    // Step 3.5: Load PDFs for this bank and convert them to queryable sources
    sendStatus('preparing', 'Loading PDF documents...');
    const pdfs = await PDF.getByBank(idrssd);
    console.log(`Found ${pdfs.length} PDFs for bank ${idrssd}`);
    
    // Convert PDFs to Source-like objects for querying
    // We'll extract PDF content on-demand when queried, but add them to available sources list
    const pdfSources = pdfs.map(pdf => ({
      sourceId: pdf.pdfId,
      idrssd: pdf.idrssd,
      sessionId: 'pdf-library', // Special session ID for PDFs
      category: pdf.description?.toLowerCase().includes('earnings') ? 'earningsTranscript' :
                pdf.description?.toLowerCase().includes('investor') ? 'investorPresentation' :
                pdf.description?.toLowerCase().includes('strategy') ? 'strategyAnalysis' : 'analystReports',
      url: pdf.sourceUrl || `pdf://${pdf.pdfId}`,
      title: pdf.originalFilename,
      date: pdf.uploadedAt ? new Date(pdf.uploadedAt).toLocaleDateString() : null,
      content: null, // Will be extracted when queried
      contentLength: 0,
      contentType: 'pdf',
      fetchable: true,
      fetchStatus: 'fetched',
      status: 'approved',
      isPDF: true,
      pdfObject: pdf // Store reference to PDF object for file access
    }));
    
    // Add PDF sources to approved sources list
    approvedSources = [...approvedSources, ...pdfSources];
    console.log(`Total sources available (including ${pdfs.length} PDFs): ${approvedSources.length}`);

    // Step 4: Initialize and run the agent
    sendStatus('agent_init', 'Starting agent research phase...');

    const agent = new AgentOrchestrator({
      maxIterations: 15,
      maxTimeout: 600000, // 10 minutes
      onProgress: (event) => {
        if (event.type === 'milestone') {
          sendStatus('agent_milestone', event.milestone, { details: event.details });
        } else if (event.type === 'insight') {
          sendStatus('agent_insight', event.insight.title, {
            insight: event.insight
          });
        }
      }
    });

    // Build initial prompt for agent
    const agentPrompt = `You are a financial research agent analyzing ${bankInfo.name}, a bank located in ${bankInfo.city}, ${bankInfo.state} with $${(bankInfo.totalAssets / 1000000).toFixed(0)}M in total assets.

Your mission is to conduct a comprehensive investigation of this bank's financial performance, strategic position, and future prospects. You have access to:
- ${financialStatements.length} quarters of detailed financial data
- ${peerData ? `Peer analysis comparing to ${peerData.count} similar banks` : 'No peer comparison data'}
- ${approvedSources.length} research sources (investor presentations, earnings transcripts, strategy documents, analyst reports)
  **PRIORITY:** These source documents (especially earnings transcripts and quarterly earnings decks) often contain the most current information about strategic initiatives, technology programs, and management priorities. Query these documents FIRST to identify specific initiatives before doing broad web searches.
- Web search capabilities for recent news and context

**Your Research Process:**
1. **Start by analyzing CRITICAL financial metrics:** Always begin by analyzing "efficiencyRatio" and "operatingLeverage" together using analyze_financials. These are the most important metrics for understanding operational efficiency and scalability. Pay special attention to these when investigating technology investments.
2. Analyze additional financial trends to identify notable patterns, strengths, and concerns
3. **PRIORITY: Query source documents FIRST (if available):**
   - ${approvedSources.length > 0 ? `You have ${approvedSources.length} source document(s) available (${approvedSources.filter(s => !s.isPDF).length} gathered sources + ${pdfs.length} uploaded PDFs)` : 'Source documents are available'}. Use query_documents tool to:
     * Identify strategic initiatives mentioned in earnings transcripts, investor presentations, or annual reports
     * Find technology programs and initiatives (e.g., "What technology initiatives or digital transformation programs are mentioned?")
     * Extract management commentary on strategic priorities
     * Find mentions of specific programs, partnerships, or investments
   - **CRITICAL:** Earnings call transcripts and quarterly earnings decks often contain the most up-to-date information on strategic initiatives
   - Extract specific program names, technology investments, strategic priorities mentioned in documents
4. **IDENTIFY KEY STRATEGIC INITIATIVES:** After querying documents, synthesize the findings to identify 3-5 KEY strategic initiatives:
   - Create a clear list of strategic priorities (e.g., "T3 Technology Platform", "Digital Banking Transformation", "Small Business Lending Expansion")
   - Note the stated goals and timelines for each initiative
   - Identify which initiatives relate to technology, operational efficiency, or digital transformation
   - **If documents don't reveal clear priorities:** Use web search to find strategic initiatives:
     * "[Bank Name] strategic priorities 2024" or "[Bank Name] strategic plan"
     * "[Bank Name] key initiatives" or "[Bank Name] strategic initiatives"
     * "[Bank Name] management priorities" or "[Bank Name] strategic focus"
   - **CRITICAL:** You must identify at least 2-3 strategic priorities before proceeding. If documents don't provide them, use web search.
5. **DEEP DIVE ON STRATEGIC INITIATIVES:** For each key strategic initiative identified:
   - **Web Search:** Perform targeted web searches for each initiative:
     * "[Bank Name] [Initiative Name]" or "[Bank Name] [Initiative Name] 2024"
     * Look for recent updates, progress reports, partnerships, or challenges
     * Find management commentary and analyst perspectives
   - **Financial Analysis:** Use analyze_financials to cross-reference initiatives with financial metrics:
     * For technology/digital initiatives: Analyze "efficiencyRatio" and "operatingLeverage" trends to see if the initiative is improving operational efficiency
     * For growth initiatives: Analyze revenue trends, loan growth, deposit growth
     * For cost initiatives: Analyze expense trends, cost-to-income ratios
   - **Assessment:** Determine whether the financial metrics support the success of each initiative
     * Are efficiency ratios improving? (Lower is better)
     * Is operating leverage positive/high? (Higher = good, revenue growing faster than expenses)
     * Are expenses growing slower than revenue?
6. **AI, AGENTS, AND DIGITAL LABOR ANALYSIS:** For each strategic initiative, provide insights on how AI, agents, and digital labor could help BUILD OPERATING LEVERAGE:
   - **OPERATING LEVERAGE = Revenue Growth FASTER than Expense Growth (positive operating leverage)**
   - **For each initiative, analyze BOTH sides of operating leverage:**
     * **Cost Savings Side:** How could AI/agents reduce expenses?
       - Automation of manual processes
       - Digital labor replacing human labor in repetitive tasks
       - Process efficiency improvements
       - Headcount reduction through automation
     * **Revenue Growth Side:** How could AI/agents increase revenue?
       - Accelerating time-to-market for new products/services
       - Enabling new revenue streams (e.g., AI-powered advisory services)
       - Improving customer acquisition and retention
       - Scaling operations without proportional cost increases
       - Digital labor enabling 24/7 service capabilities
   - **For technology/digital initiatives:** How could AI agents automate processes? What digital labor opportunities exist for both cost reduction AND revenue generation?
   - **For operational efficiency initiatives:** How could AI improve the efficiency ratio? Where could agents reduce manual work? How could this enable revenue growth at lower cost?
   - **For growth initiatives:** How could AI/agents accelerate implementation? What repetitive tasks could be automated? What new revenue opportunities could digital labor enable?
   - **Generate insights** using generate_insight with type "technology_investment" or "strategic_initiative" that include:
     * Assessment of the initiative's financial impact (based on metrics)
     * Specific recommendations for how AI/agents/digital labor could help:
       - **Cost savings opportunities** (expense reduction)
       - **Revenue growth opportunities** (revenue expansion)
       - **Operating leverage impact** (how it helps achieve positive operating leverage)
     * Potential efficiency gains, cost reductions, AND revenue growth opportunities
     * Estimated impact on efficiency ratio and operating leverage metrics
7. **MANDATORY WEB SEARCHES - Additional context:**
   - **If you found strategic initiatives in documents:** Search for those SPECIFIC initiatives by name (e.g., if you found "T3" mentioned, search "[Bank Name] T3" or "[Bank Name] T3 technology")
   - **If you found technology programs in documents:** Search for details on those SPECIFIC programs
   - **If NO documents provided OR documents don't contain initiatives:** Use web search to find strategic priorities:
     * "[Bank Name] strategic priorities 2024" or "[Bank Name] strategic plan"
     * "[Bank Name] key initiatives" or "[Bank Name] strategic initiatives"
     * "[Bank Name] technology initiatives" or "[Bank Name] digital transformation"
     * "[Bank Name] management priorities" or "[Bank Name] strategic focus"
   - **ALWAYS perform these searches regardless:**
     * "[Bank Name] news 2024" or "[Bank Name] announcements" - Recent news, press releases, major developments
     * "[Bank Name] earnings commentary" or "[Bank Name] investor day" - Additional management commentary
     * "[Bank Name] technology investment" or "[Bank Name] innovation" - Technology spend, partnerships, digital capabilities
     * "[Bank Name] leadership team" or "[Bank Name] executives" - Find key executives and their backgrounds
   **DO NOT SKIP WEB SEARCHES** - These provide critical context that financial data alone cannot reveal. Use the search_web tool with appropriate focus areas (technology, strategy, news, general, leadership).
5. **MANDATORY LEADERSHIP RESEARCH:** Research and profile key executives. You MUST identify and research:
   - CEO: Search "[Bank Name] CEO [Name]" to find name, background, tenure, strategic vision
   - CFO: Search "[Bank Name] CFO [Name]" - Financial leadership and capital allocation strategy
   - CIO/CTO: Search "[Bank Name] CIO" or "[Bank Name] chief information officer" - Technology leadership
   - Head of AI/Digital Innovation: Search "[Bank Name] head of AI" or "[Bank Name] chief digital officer" - AI and innovation leadership
   - Head of Procurement: Search "[Bank Name] head of procurement" or "[Bank Name] chief procurement officer" - Procurement and vendor management
   - Business Line Leaders: Search "[Bank Name] head of [business line]" - Consumer banking, commercial banking, wealth management leaders
   For EACH executive, search for their photo: "[Executive Name] [Bank Name] photo" or "[Executive Name] [Bank Name] LinkedIn" to find professional headshots
9. Generate insights as you discover important findings - incorporate document findings, web search results, leadership information, and strategic initiative assessments into your insights
10. When you have sufficient information, signal completion

**IMPORTANT:** If you complete research without performing web searches, you are missing critical information. Always use web search to find recent strategic initiatives, technology programs, and management commentary.

**Focus Areas (PRIORITY: Query Documents First, Then Deep Dive on Strategic Initiatives):**
- **Strategic Initiative Discovery & Analysis:**
  - **STEP 1 - Query documents FIRST:** Ask "What are the key strategic initiatives or strategic priorities mentioned by management?" Extract specific program names, technology initiatives, market expansion plans, business model changes
  - **STEP 2 - Identify 3-5 Key Initiatives:** Synthesize document findings to create a prioritized list of strategic initiatives with stated goals and timelines
  - **STEP 3 - Deep Dive Each Initiative:**
    * Perform targeted web searches: "[Bank Name] [Initiative Name]" to find recent updates, progress, challenges
    * Analyze relevant financial metrics using analyze_financials:
      - Technology/digital initiatives → efficiencyRatio, operatingLeverage
      - Growth initiatives → revenue trends, loan growth, deposit growth
      - Cost initiatives → expense trends, cost ratios
    * Assess whether metrics support initiative success
  - **STEP 4 - AI/Digital Labor Recommendations:** For each initiative, analyze how AI, agents, and digital labor could help BUILD OPERATING LEVERAGE:
    * **Cost Savings Side:**
      - Identify automation opportunities that reduce expenses
      - Estimate potential cost reductions
      - Recommend digital labor use cases for expense reduction
    * **Revenue Growth Side:**
      - Identify opportunities to accelerate revenue growth
      - Estimate potential revenue expansion (new products, faster time-to-market, scale)
      - Recommend AI/agent use cases that enable new revenue streams
    * **Operating Leverage Impact:**
      - Assess how the initiative helps achieve positive operating leverage (revenue growth > expense growth)
      - Estimate combined impact on efficiency ratio and operating leverage metrics
  - **STEP 5 - Generate Insights:** Create insights for each major initiative that includes:
    * Financial metric assessment (is it working?)
    * AI/agents/digital labor recommendations covering BOTH:
      - Cost savings opportunities (expense reduction)
      - Revenue growth opportunities (revenue expansion)
    * Potential impact on efficiency ratio and operating leverage
    * Operating leverage assessment (will this help achieve positive operating leverage?)
  
- **Technology and digital initiatives (sub-set of strategic initiatives):**
  - Cross-reference ALL technology investments with efficiency ratio and operating leverage trends
  - Look for cloud migration, API platforms, mobile banking initiatives, fintech partnerships
  - Assess how current tech investments are performing using metrics
  - Provide specific recommendations on how AI/agents/digital labor could enhance or accelerate these initiatives
  - **Focus on operating leverage:** For each tech initiative, analyze how it can drive BOTH cost savings AND revenue growth to build positive operating leverage
  
- **Financial performance trends (MUST INCLUDE efficiency ratio and operating leverage):**
  - Efficiency Ratio: Analyze trends (LOWER is better). How has it changed over time? Is technology investment improving it?
  - Operating Leverage: Analyze trends (HIGHER is better). Is the bank achieving sustained positive operating leverage? What does this indicate about scalability?
  - Profitability metrics (ROE, ROA, NIM)
  - Credit quality
  
- **Recent news and market context (MANDATORY WEB SEARCH):**
  - Search for recent news, press releases, major announcements from last 6 months
  - Look for regulatory developments, market changes, competitive dynamics
  - **Example searches:** "[Bank Name] news 2024", "[Bank Name] announces", "[Bank Name] press release"
  
- Competitive positioning vs peers
- **Leadership and management quality (MANDATORY):**
  - Research and profile key executives: CEO, CFO, CIO/CTO, Head of AI/Digital Innovation, Head of Procurement, and business line leaders
  - For each executive, find: name, title, background, tenure, key initiatives, strategic focus, recent achievements
  - Search for professional headshots: "[Name] [Bank Name] photo", "[Name] [Bank Name] LinkedIn", "[Name] [Bank Name] headshot"
  - Use web searches to find executives on bank's leadership page, LinkedIn, press releases, industry publications
- Risk factors and concerns
- Growth opportunities

**CRITICAL METRIC INTERPRETATION GUIDANCE:**
When analyzing financial metrics, understand the correct direction for each:
- **Efficiency Ratio**: LOWER is better. A 45% efficiency ratio is excellent, while 75% is poor. Decreasing efficiency ratio = improvement. Increasing efficiency ratio = worsening. **Always analyze this metric when evaluating technology investments, operational improvements, or cost management initiatives.**
- **Operating Leverage**: HIGHER is better. Operating leverage measures operational scalability by measuring how changes in revenue amplify changes in operating income. **Formula:** Operating Leverage = (YoY % Change in PPNR) / (YoY % Change in Total Revenue), where Total Revenue = Total Interest Income + Total Non-Interest Income, and PPNR (Pre-Provision Net Revenue) = Total Revenue - Total Operating Expenses. Higher values (> 1.0) indicate revenue changes have a magnified impact on operating income (positive leverage, EXCELLENT). Values < 1.0 indicate operating income changes less than revenue (negative leverage) = BAD. Sustained operating leverage > 1.0 over multiple quarters indicates scalable, efficient operations. **CRITICAL: Always analyze operating leverage when evaluating technology investments or operational efficiency. Technology investments should lead to sustained operating leverage > 1.0 if successful.**
- **ROE (Return on Equity)**: HIGHER is better (15% is strong, 5% is weak).
- **NIM (Net Interest Margin)**: HIGHER is better (4% is healthy, 2% is compressed).

**MANDATORY ANALYSIS:** 
- When using analyze_financials tool, ALWAYS include both "efficiencyRatio" and "operatingLeverage" in your metrics array when analyzing:
  - Operational efficiency
  - Technology investments
  - Cost management
  - Digital transformation initiatives
  - Scalability and operational discipline

When generating insights about these metrics, always state the correct direction and what it means for the bank's performance.

Use your tools strategically to build a comprehensive understanding. Be thorough but efficient. When you've gathered sufficient insights, call complete_research.`;

    const agentContext = {
      bankInfo,
      financialData: financialStatements,
      peerData: peerData,
      sessionId: sessionId,
      approvedSources: approvedSources, // Includes both Source documents and PDF sources
      totalAssets: bankInfo.totalAssets // Add for memory context
    };

    // Run the agent
    sendStatus('agent_running', 'Agent exploring financial data...');

    const agentResult = await agent.run(agentPrompt, agentContext);

    sendStatus('agent_complete', `Research complete: ${agentResult.insights.length} insights discovered`, {
      stats: agentResult.stats
    });

    // Step 5: Synthesize final report using insights
    sendStatus('synthesizing', 'Synthesizing final report from agent insights...');

    const claudeService = new ClaudeService();

    // Build comprehensive sources list
    const allSources = [];
    let sourceIndex = 1;
    const sourceMap = new Map(); // Track source -> citation number

    // Add web search sources from agent
    if (agentResult.stats && agentResult.stats.webSearches && agentResult.stats.webSearches.length > 0) {
      agentResult.stats.webSearches.forEach(search => {
        // Use sourceDetails if available (structured data), otherwise fall back to sources array
        const sourcesToProcess = search.sourceDetails && search.sourceDetails.length > 0
          ? search.sourceDetails
          : (search.sources || []).map(url => ({ url, title: url, snippet: null }));
        
        sourcesToProcess.forEach(sourceInfo => {
          const url = typeof sourceInfo === 'string' ? sourceInfo : sourceInfo.url;
          const title = typeof sourceInfo === 'string' ? sourceInfo : (sourceInfo.title || search.query || 'Web search result');
          const sourceKey = url;
          
          if (!sourceMap.has(sourceKey)) {
            sourceMap.set(sourceKey, sourceIndex);
            allSources.push({
              number: sourceIndex,
              type: `Web Search - ${search.focus || 'General'}`,
              title: title,
              url: url,
              query: search.query,
              summary: search.summary || null,
              snippet: typeof sourceInfo === 'object' ? sourceInfo.snippet : null
            });
            sourceIndex++;
          }
        });
      });
    }

    // Add document query sources
    if (agentResult.stats.documentsQueried && agentResult.stats.documentsQueried.length > 0) {
      agentResult.stats.documentsQueried.forEach(query => {
        if (query.documents && query.documents.length > 0) {
          query.documents.forEach(doc => {
            const sourceKey = doc.url || doc.title;
            if (!sourceMap.has(sourceKey)) {
              sourceMap.set(sourceKey, sourceIndex);
              allSources.push({
                number: sourceIndex,
                type: doc.category || 'Document',
                title: doc.title,
                url: doc.url,
                date: doc.publishDate
              });
              sourceIndex++;
            }
          });
        }
      });
    }

    // Add approved sources that were made available
    if (approvedSources && approvedSources.length > 0) {
      approvedSources.forEach(source => {
        const sourceKey = source.url || source.title;
        if (!sourceMap.has(sourceKey)) {
          sourceMap.set(sourceKey, sourceIndex);
          allSources.push({
            number: sourceIndex,
            type: source.category || 'Research Source',
            title: source.title,
            url: source.url,
            date: source.publishDate
          });
          sourceIndex++;
        }
      });
    }

    // Format sources list with clickable links
    const sourcesSection = allSources.length > 0 ? `
# Available Sources for Citation

Use these source numbers in your citations: [Source 1], [Source 2], [Source 3], etc. or [1], [2], [3], etc.

${allSources.map(s => {
  let citation = `**[${s.number}] ${s.type}**`;
  if (s.title && s.url) {
    // Always include clickable link if URL exists
    citation += `: [${s.title}](${s.url})`;
  } else if (s.title && !s.url) {
    citation += `: ${s.title}`;
  } else if (s.url) {
    // If no title but has URL, use URL as both text and link
    citation += `: [${s.url}](${s.url})`;
  }
  if (s.date) citation += ` (${new Date(s.date).toLocaleDateString()})`;
  if (s.query) citation += ` - Search: "${s.query}"`;
  if (s.snippet) citation += `\n  *${s.snippet.substring(0, 150)}${s.snippet.length > 150 ? '...' : ''}*`;
  return citation;
}).join('\n\n')}

**Call Report Data Available:**
Financial statements from Q1 2021 through Q2 2025. Cite as: [Call Report: Q# YYYY]
` : '**Note:** Limited source data available. Use [Call Report: Q# YYYY] format for financial data citations.';

    // Build synthesis prompt
    const insightsSummary = agentResult.insights
      .sort((a, b) => {
        const importanceOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return importanceOrder[a.importance] - importanceOrder[b.importance];
      })
      .map((insight, idx) => {
        return `## Insight ${idx + 1}: ${insight.title} [${insight.importance.toUpperCase()}]
**Type:** ${insight.type}
${insight.content}
**Evidence:** ${insight.evidence.join(', ')}
`;
      }).join('\n\n');

    // Build leadership research reminder for synthesis
    const leadershipReminder = `**CRITICAL - LEADERSHIP PROFILES REQUIRED:**
You MUST include a comprehensive "Leadership & Management" section with detailed profiles of key executives. For each executive, use the <leader> tag format:

<leader name="Full Name" title="Job Title" image="https://photo-url.com/headshot.jpg">
Brief bio including background, tenure at ${bankInfo.name}, key initiatives they've led, strategic focus areas, and recent achievements. [Source #]
</leader>

**Required executives to profile:**
1. CEO (Chief Executive Officer) - Strategic vision, public statements, leadership style
2. CFO (Chief Financial Officer) - Financial leadership, capital allocation strategy
3. CIO/CTO (Chief Information/Technology Officer) - Technology strategy, digital transformation
4. Head of AI/Digital Innovation (or Chief Digital Officer, Chief Innovation Officer) - AI initiatives, digital capabilities
5. Head of Procurement (or Chief Procurement Officer) - Vendor management, procurement strategy
6. Key business line leaders:
   - Head of Consumer Banking
   - Head of Commercial Banking  
   - Head of Wealth Management (if applicable)
   - Other major business line leaders

**Photo search instructions:**
For each executive, you should have searched for their photo using queries like:
- "[Executive Name] ${bankInfo.name} photo"
- "[Executive Name] ${bankInfo.name} LinkedIn"
- "[Executive Name] ${bankInfo.name} headshot"

If you found a photo URL from web searches, include it in the image attribute. If no photo was found after searching, use image="" (empty string).

**Important:**
- Write leader tags directly in your response (NOT in code blocks or with backticks)
- Include specific details about each executive's background, tenure, and contributions
- Cite sources for executive information using [Source #] format
- Place all leader profiles in the "Leadership & Management" section
- Each profile should be 2-4 sentences with concrete details about their role and impact
`;

    // Build web search summary section
    const webSearchSummary = agentResult.stats.webSearches && agentResult.stats.webSearches.length > 0
      ? `\n\n# Web Search Results

The following web searches were performed to gather additional context:

${agentResult.stats.webSearches.map((search, idx) => {
  return `## Search ${idx + 1}: ${search.query || 'General search'} (Focus: ${search.focus || 'general'})
${search.summary || 'Results found but summary not available'}
${search.sources && search.sources.length > 0 ? `Sources: ${search.sources.slice(0, 5).join(', ')}` : 'No sources found'}
`;
}).join('\n')}

**IMPORTANT:** Incorporate information from these web searches into your report, especially:
- Technology initiatives and programs (e.g., T3, digital transformation, cloud migration)
- Strategic initiatives and business model changes
- Recent news and announcements
- Management commentary on strategy and performance
- Digital capabilities and innovation investments
- **Leadership and executive information:** Use web search results to build comprehensive executive profiles with names, titles, backgrounds, and headshot URLs
`
      : '\n\n**NOTE:** No web searches were performed. This may mean critical information about technology initiatives, strategic programs, and recent news is missing.';

    // Build call report citation references
    const callReportPeriods = financialStatements.map(stmt => {
      const date = new Date(stmt.reportingPeriod);
      const year = date.getFullYear();
      const quarter = Math.ceil((date.getMonth() + 1) / 3);
      return `Q${quarter} ${year}`;
    }).join(', ');

    const synthesisPrompt = `You have conducted extensive research on ${bankInfo.name}. Below are key findings you discovered during your investigation. These should be INCORPORATED directly into your report narrative - do NOT create a separate "Key Insights" or "Research Insights" section.

**CRITICAL INSTRUCTION:** DO NOT create a "Key Insights" or "Research Insights" section. Instead, INCORPORATE these findings naturally into the report narrative. For each finding:
- If it's a key strategic initiative, create a detailed section analyzing that initiative with financial metrics, progress assessment, and recommendations
- If it's a critical finding, weave it into the relevant section with supporting evidence
- If it's important enough, create visual representations using charts or expand into a dedicated subsection
- Use these findings as building blocks for comprehensive analysis, not as a separate list

${insightsSummary}

${webSearchSummary}

# Financial Data Summary

${JSON.stringify(trendsData, null, 2)}

${peerData ? `# Peer Analysis\n\n${JSON.stringify(peerData, null, 2)}` : ''}

${sourcesSection}

---

Now synthesize these insights into a comprehensive, well-structured research report. The report should:

1. **Executive Summary** - High-level overview of the bank's position and key findings
2. **Financial Performance Analysis** - Deep dive into trends, with specific metrics and charts
   - **CRITICAL:** Cite call report data using format: [Call Report: Q# YYYY] for each specific metric or data point
   - **CRITICAL - Number Labeling:** ALWAYS explicitly label what each number represents. Never list dollar amounts, percentages, or metrics without clear context.
   - **CORRECT Examples:**
     * "Total assets grew to $15.2B in Q2 2025 [Call Report: Q2 2025], representing 8% YoY growth"
     * "Business loans totaling $8.5B [Call Report: Q2 2025] represent 56% of total assets"
     * "Net interest income of $125M [Call Report: Q2 2025] increased 8% year-over-year"
     * "The efficiency ratio improved to 58% [Call Report: Q2 2025]"
   - **INCORRECT Examples (DO NOT USE):**
     * "$15.2B [Call Report: Q2 2025], representing 8% YoY growth" (missing label - what is $15.2B?)
     * "$8.5B [Call Report: Q2 2025], representing 56% of total assets" (missing label - what category?)
     * "$125M [Call Report: Q2 2025]" (missing label - what metric?)
   - When discussing trends over multiple periods: "Net income increased from $45M in Q1 2024 [Call Report: Q1 2024] to $52M in Q2 2025 [Call Report: Q2 2025]"
   - **Rule:** Every number must be preceded or immediately followed by a clear label (e.g., "Total assets of $X", "Business loans totaling $X", "Efficiency ratio of X%")
3. **Strategic Position** - Competitive positioning, differentiation, strategic initiatives
   - For strategic initiatives found in documents: Cite as [Source #] where # matches the source number
   - For initiatives from web searches: Cite as [Source #] where # matches the web search source
   - Example: "The bank's T3 technology platform [Source 3] aims to improve operational efficiency..."
4. **Technology & Innovation** - Digital capabilities, technology investments
   - Cite PDF documents and web sources when discussing technology programs
5. **Leadership & Management** - ${leadershipReminder}
6. **Risk Assessment** - Key risks and concerns
7. **Future Outlook** - Growth opportunities and challenges
8. **Sources** - List all sources referenced in the report with clickable links

**AGGRESSIVE CITATION REQUIREMENTS:**

1. **Call Report Citations:**
   - Cite EVERY financial metric, ratio, or data point with: [Call Report: Q# YYYY]
   - Examples:
     * "Efficiency ratio improved to 58% [Call Report: Q2 2025], down from 62% [Call Report: Q1 2024]"
     * "Net interest income reached $125M [Call Report: Q2 2025]"
     * "Operating leverage of 1.8x [Call Report: Q2 2025] indicates revenue growing faster than expenses"
   - When referencing balance sheet items: "Total assets of $15.2B [Call Report: Q2 2025] include $8.5B in loans [Call Report: Q2 2025]"
   - When referencing income statement: "Net income of $45M [Call Report: Q2 2025] was driven by $120M in net interest income [Call Report: Q2 2025]"

2. **PDF Document Citations:**
   - When referencing information from PDFs (investor presentations, earnings transcripts, etc.): Use [Source #] where # is the source number
   - Example: "According to the Q2 2025 earnings transcript [Source 5], management emphasized digital transformation..."
   - Include specific page references or quotes when available: "The investor presentation [Source 7] states: 'We are investing $50M in digital capabilities...'"

3. **Web Source Citations:**
   - When referencing news, articles, or web content: Use [Source #] where # is the source number
   - Example: "Recent news [Source 12] indicates the bank is expanding into new markets..."
   - For leadership information: "The CEO, John Smith [Source 8], has led the bank since 2020..."

4. **Citation Format Rules:**
   - Place citations IMMEDIATELY after the fact or statement: "Revenue grew 10% [Call Report: Q2 2025] [Source 3]"
   - Multiple citations are fine: "The bank announced a new initiative [Source 5] that aligns with its efficiency goals [Call Report: Q2 2025]"
   - For paragraphs with multiple facts, cite each: "Assets increased to $15B [Call Report: Q2 2025]. The bank's strategy [Source 7] focuses on digital transformation. Efficiency improved to 58% [Call Report: Q2 2025]."
   - Be GENEROUS with citations - it's better to over-cite than under-cite

5. **Sources Section Format:**
   At the end of the report, include a comprehensive "Sources" section:
   
   ## Sources
   
   **Call Report Data:**
   - Q1 2021 through Q2 2025 - Federal Financial Institutions Examination Council (FFIEC) Call Reports, accessed via regulatory databases
   
   **PDF Documents:**
   [List all PDF sources with clickable links - ONLY include sources you actually cited in the report]
   - [1] [Title](URL) - [Date if available]
   - [2] [Title](URL) - [Date if available]
   
   **Web Sources:**
   [List all web sources with clickable links - ONLY include sources you actually cited in the report]
   - [3] [Title](URL) - [Search query if relevant]
   - [4] [Title](URL) - [Search query if relevant]
   
   **CRITICAL:** 
   - For web sources, use the actual URL from the source. Format as: [Title](URL) where URL is the actual clickable link.
   - ONLY list sources that you actually cited in the report body using [Source #] or [#] format.
   - Group sources by type (PDF Documents, Web Sources) for clarity.
   - Include the search query for web sources when it provides context about what information was found.

**Chart Instructions:**
Use chart tags where appropriate (use kebab-case for metric names):
- <chart:net-income /> for income trends
- <chart:asset-composition /> for asset breakdowns
- <chart:loan-portfolio /> for lending analysis
- <chart:efficiency-ratio /> for efficiency metrics
- <chart:roe /> for return on equity
- <chart:nim /> for net interest margin
Available metric names: net-income, asset-composition, loan-portfolio, income-breakdown, expense-breakdown, efficiency-ratio, roe, roa, nim, operating-leverage, fte-trends

Write in a professional, analytical tone suitable for investors and executives. Ensure all factual claims are properly cited.`;

    let fullReport = '';

    // Use Claude to synthesize the report
    const Anthropic = require('@anthropic-ai/sdk');
    const modelResolver = require('../services/modelResolver');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Get latest model
    const latestModel = await modelResolver.getLatestSonnetModel();

    const synthesisStream = await anthropic.messages.stream({
      model: latestModel,
      max_tokens: 16000,
      thinking: {
        type: 'enabled',
        budget_tokens: 10000
      },
      messages: [{
        role: 'user',
        content: synthesisPrompt
      }]
    });

    for await (const event of synthesisStream) {
      if (event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta') {
        const chunk = event.delta.text;
        fullReport += chunk;
        sendStatus('synthesis_stream', 'Generating report...', {
          textChunk: chunk
        });
      }
    }

    // Step 6: Save report
    sendStatus('saving', 'Saving research report...');

    const timestamp = Date.now();
    const fileName = `${idrssd}_agent_${timestamp}.json`;
    const filePath = path.join(RESEARCH_DIR, fileName);

    // Extract web search sources for tracking
    const webSearchSources = [];
    if (agentResult.stats && agentResult.stats.webSearches && agentResult.stats.webSearches.length > 0) {
      agentResult.stats.webSearches.forEach(search => {
        const sourcesToProcess = search.sourceDetails && search.sourceDetails.length > 0
          ? search.sourceDetails
          : (search.sources || []).map(url => ({ url, title: url, snippet: null }));
        
        sourcesToProcess.forEach(sourceInfo => {
          const url = typeof sourceInfo === 'string' ? sourceInfo : sourceInfo.url;
          const title = typeof sourceInfo === 'string' ? sourceInfo : (sourceInfo.title || search.query || 'Web search result');
          
          webSearchSources.push({
            url: url,
            title: title,
            query: search.query,
            focus: search.focus || 'General',
            snippet: typeof sourceInfo === 'object' ? sourceInfo.snippet : null,
            summary: search.summary || null
          });
        });
      });
    }

    const reportData = {
      idrssd,
      bankName: institution.name,
      generatedAt: new Date().toISOString(),
      method: 'agent-based',
      model: 'claude-sonnet-4.5',
      analysis: fullReport,
      agentInsights: agentResult.insights,
      agentStats: agentResult.stats,
      trendsData,
      sessionId: sessionId || null,
      webSearchSources: webSearchSources // Track web search sources for citation tracking
    };

    await fs.writeFile(filePath, JSON.stringify(reportData, null, 2));

    // Step 7: Complete
    sendStatus('complete', 'Agent-based report generated successfully', {
      report: reportData,
      fileName
    });

    res.end();

  } catch (error) {
    console.error('Error in agent-based report generation:', error);
    res.write(`data: ${JSON.stringify({
      stage: 'error',
      message: `Error: ${error.message}`
    })}\n\n`);
    res.end();
  }
});

/**
 * DELETE /api/research/:idrssd/clear-all
 * Clear all data for a bank: sources, reports, and podcasts
 * NOTE: This route MUST come before /:idrssd/:filename to avoid wildcard matching
 */
router.delete('/:idrssd/clear-all', async (req, res) => {
  try {
    const { idrssd } = req.params;

    console.log(`[ClearAll] Clearing all data for bank: ${idrssd}`);

    // 1. Delete all sources for this bank
    const sourcesResult = await Source.deleteMany({ idrssd });
    console.log(`[ClearAll] Deleted ${sourcesResult.deletedCount} sources`);

    // 2. Delete all report files for this bank
    let deletedReports = 0;
    try {
      const reportFiles = (await fs.readdir(RESEARCH_DIR)).filter(f => f.startsWith(`${idrssd}_`) && f.endsWith('.json'));
      for (const file of reportFiles) {
        await fs.unlink(path.join(RESEARCH_DIR, file));
        deletedReports++;
      }
      console.log(`[ClearAll] Deleted ${deletedReports} report files`);
    } catch (err) {
      console.error('[ClearAll] Error deleting reports:', err.message);
    }

    // 3. Delete all podcast files for this bank
    let deletedPodcasts = 0;
    try {
      const podcastFiles = (await fs.readdir(PODCAST_DIR)).filter(f => f.startsWith(`${idrssd}_`) && f.endsWith('.mp3'));
      for (const file of podcastFiles) {
        await fs.unlink(path.join(PODCAST_DIR, file));
        deletedPodcasts++;
      }
      console.log(`[ClearAll] Deleted ${deletedPodcasts} podcast files`);
    } catch (err) {
      console.error('[ClearAll] Error deleting podcasts:', err.message);
    }

    res.json({
      success: true,
      deletedSources: sourcesResult.deletedCount,
      deletedReports,
      deletedPodcasts,
      message: `Cleared all data: ${sourcesResult.deletedCount} sources, ${deletedReports} reports, ${deletedPodcasts} podcasts`
    });

  } catch (error) {
    console.error('[ClearAll] Error:', error);
    res.status(500).json({
      error: 'Failed to clear all data',
      details: error.message
    });
  }
});

/**
 * DELETE /api/research/:idrssd/:filename
 * Delete a specific research report
 */
router.delete('/:idrssd/:filename', async (req, res) => {
  try {
    const { idrssd, filename } = req.params;

    // Validate filename format and idrssd match
    if (!filename.startsWith(`${idrssd}_`) || !filename.endsWith('.json')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(RESEARCH_DIR, filename);
    await fs.unlink(filePath);

    res.json({ success: true, message: 'Report deleted successfully' });

  } catch (error) {
    console.error('Error deleting research report:', error);
    res.status(500).json({ error: 'Failed to delete research report' });
  }
});

/**
 * Helper function to prepare trends data from financial statements
 */
function prepareTrendsData(financialStatements) {
  // Ensure statements are sorted by date (oldest first) for proper chart ordering
  const sortedStatements = [...financialStatements].sort((a, b) => 
    new Date(a.reportingPeriod) - new Date(b.reportingPeriod)
  );
  
  const periods = sortedStatements.map(stmt => {
    const date = new Date(stmt.reportingPeriod);
    const year = date.getFullYear();
    const quarter = Math.ceil((date.getMonth() + 1) / 3);

    // Calculate consumer and business lending
    const portfolio = stmt.balanceSheet.assets.earningAssets.loansAndLeases.portfolio;
    const consumerLending =
      (portfolio.realEstate.securedBy1To4Family.revolvingOpenEnd || 0) +
      (portfolio.realEstate.securedBy1To4Family.closedEndFirstLiens || 0) +
      (portfolio.realEstate.securedBy1To4Family.closedEndJuniorLiens || 0) +
      (portfolio.consumer.creditCards || 0) +
      (portfolio.consumer.automobileLoans || 0) +
      (portfolio.consumer.otherRevolvingCredit || 0) +
      (portfolio.consumer.otherConsumerLoans || 0) +
      (portfolio.leaseFinancingReceivables.consumerLeases || 0);

    const businessLending =
      (portfolio.realEstate.constructionAndLandDevelopment.total || 0) +
      (portfolio.realEstate.multifamily || 0) +
      (portfolio.realEstate.nonfarmNonresidential.ownerOccupied || 0) +
      (portfolio.realEstate.nonfarmNonresidential.otherNonfarmNonresidential || 0) +
      (portfolio.realEstate.farmland || 0) +
      (portfolio.commercialAndIndustrial.usAddressees || 0) +
      (portfolio.commercialAndIndustrial.nonUsAddressees || 0) +
      (portfolio.other.agriculturalProduction || 0) +
      (portfolio.other.toDepositoryInstitutions || 0) +
      (portfolio.leaseFinancingReceivables.allOtherLeases || 0) +
      (portfolio.other.allOtherLoans || 0);

    return {
      period: `${year} Q${quarter}`,
      date: stmt.reportingPeriod,
      assets: {
        total: stmt.balanceSheet.assets.totalAssets,
        consumerLending,
        businessLending,
        // Granular loan breakdown for chart
        residentialMortgages: (portfolio.realEstate.securedBy1To4Family.revolvingOpenEnd || 0) +
          (portfolio.realEstate.securedBy1To4Family.closedEndFirstLiens || 0) +
          (portfolio.realEstate.securedBy1To4Family.closedEndJuniorLiens || 0),
        creditCards: portfolio.consumer.creditCards || 0,
        autoLoans: portfolio.consumer.automobileLoans || 0,
        otherConsumer: (portfolio.consumer.otherRevolvingCredit || 0) +
          (portfolio.consumer.otherConsumerLoans || 0) +
          (portfolio.leaseFinancingReceivables.consumerLeases || 0),
        commercialRealEstate: (portfolio.realEstate.constructionAndLandDevelopment.total || 0) +
          (portfolio.realEstate.multifamily || 0) +
          (portfolio.realEstate.nonfarmNonresidential.ownerOccupied || 0) +
          (portfolio.realEstate.nonfarmNonresidential.otherNonfarmNonresidential || 0) +
          (portfolio.realEstate.farmland || 0),
        cAndI: (portfolio.commercialAndIndustrial.usAddressees || 0) +
          (portfolio.commercialAndIndustrial.nonUsAddressees || 0),
        otherBusiness: (portfolio.other.agriculturalProduction || 0) +
          (portfolio.other.toDepositoryInstitutions || 0) +
          (portfolio.leaseFinancingReceivables.allOtherLeases || 0) +
          (portfolio.other.allOtherLoans || 0),
        securities:
          stmt.balanceSheet.assets.earningAssets.securities.availableForSale +
          stmt.balanceSheet.assets.earningAssets.securities.heldToMaturity,
        cash: stmt.balanceSheet.assets.nonearningAssets.cashAndDueFromBanks,
        other:
          stmt.balanceSheet.assets.nonearningAssets.premisesAndFixedAssets +
          stmt.balanceSheet.assets.nonearningAssets.intangibleAssets +
          stmt.balanceSheet.assets.nonearningAssets.otherAssets
      },
      income: {
        netIncome: stmt.incomeStatement.netIncome,
        netInterestIncome: stmt.incomeStatement.netInterestIncome,
        interestIncome: stmt.incomeStatement.interestIncome.total,
        noninterestIncome: stmt.incomeStatement.noninterestIncome.total,
        noninterestExpense: stmt.incomeStatement.noninterestExpense.total
      },
      expenses: {
        salariesAndBenefits: stmt.incomeStatement.noninterestExpense.salariesAndBenefits,
        occupancy: stmt.incomeStatement.noninterestExpense.premisesExpense,
        other: stmt.incomeStatement.noninterestExpense.other
      },
      fte: stmt.incomeStatement.fullTimeEquivalentEmployees,
      ratios: {
        efficiencyRatio: stmt.ratios?.efficiencyRatio,
        roe: stmt.ratios?.roe,
        roa: stmt.ratios?.roa,
        nim: stmt.ratios?.netInterestMargin,
        operatingLeverage: stmt.ratios?.operatingLeverage
      }
    };
  });

  // Prepare lending composition for latest period
  const latestStmt = sortedStatements[sortedStatements.length - 1];
  const latestPortfolio = latestStmt.balanceSheet.assets.earningAssets.loansAndLeases.portfolio;

  const lendingComposition = [{
    period: periods[periods.length - 1].period,
    categories: [
      {
        name: 'Consumer Lending',
        current: periods[periods.length - 1].assets.consumerLending,
        percentage: (periods[periods.length - 1].assets.consumerLending /
                     periods[periods.length - 1].assets.total * 100).toFixed(1),
        growth: periods.length > 4 ?
          ((periods[periods.length - 1].assets.consumerLending - periods[0].assets.consumerLending) /
           periods[0].assets.consumerLending * 100) : 0,
        subcategories: [
          {
            name: 'Residential Mortgages',
            value: (latestPortfolio.realEstate.securedBy1To4Family.revolvingOpenEnd || 0) +
                   (latestPortfolio.realEstate.securedBy1To4Family.closedEndFirstLiens || 0) +
                   (latestPortfolio.realEstate.securedBy1To4Family.closedEndJuniorLiens || 0)
          },
          {
            name: 'Credit Cards',
            value: latestPortfolio.consumer.creditCards || 0
          },
          {
            name: 'Auto Loans',
            value: latestPortfolio.consumer.automobileLoans || 0
          },
          {
            name: 'Other Consumer',
            value: (latestPortfolio.consumer.otherRevolvingCredit || 0) +
                   (latestPortfolio.consumer.otherConsumerLoans || 0) +
                   (latestPortfolio.leaseFinancingReceivables.consumerLeases || 0)
          }
        ]
      },
      {
        name: 'Business Lending',
        current: periods[periods.length - 1].assets.businessLending,
        percentage: (periods[periods.length - 1].assets.businessLending /
                     periods[periods.length - 1].assets.total * 100).toFixed(1),
        growth: periods.length > 4 ?
          ((periods[periods.length - 1].assets.businessLending - periods[0].assets.businessLending) /
           periods[0].assets.businessLending * 100) : 0,
        subcategories: [
          {
            name: 'Commercial Real Estate',
            value: (latestPortfolio.realEstate.constructionAndLandDevelopment.total || 0) +
                   (latestPortfolio.realEstate.multifamily || 0) +
                   (latestPortfolio.realEstate.nonfarmNonresidential.ownerOccupied || 0) +
                   (latestPortfolio.realEstate.nonfarmNonresidential.otherNonfarmNonresidential || 0) +
                   (latestPortfolio.realEstate.farmland || 0)
          },
          {
            name: 'C&I (US)',
            value: latestPortfolio.commercialAndIndustrial.usAddressees || 0
          },
          {
            name: 'C&I (Non-US)',
            value: latestPortfolio.commercialAndIndustrial.nonUsAddressees || 0
          },
          {
            name: 'Other Business',
            value: (latestPortfolio.other.agriculturalProduction || 0) +
                   (latestPortfolio.other.toDepositoryInstitutions || 0) +
                   (latestPortfolio.leaseFinancingReceivables.allOtherLeases || 0) +
                   (latestPortfolio.other.allOtherLoans || 0)
          }
        ]
      }
    ]
  }];

  return {
    periods,
    lendingComposition
  };
}

/**
 * GET /api/research/:idrssd/podcast/latest
 * Get the most recent podcast for a bank
 */
router.get('/:idrssd/podcast/latest', async (req, res) => {
  try {
    const { idrssd } = req.params;

    // Find all podcasts for this bank
    const files = await fs.readdir(PODCAST_DIR);
    const bankPodcasts = files.filter(f => f.startsWith(`${idrssd}_`) && f.endsWith('.mp3'));

    if (bankPodcasts.length === 0) {
      return res.status(404).json({
        error: 'No podcasts found',
        podcast: null
      });
    }

    // Sort by timestamp (filename format: idrssd_timestamp.mp3)
    bankPodcasts.sort((a, b) => {
      const timeA = parseInt(a.split('_')[1].split('.')[0]);
      const timeB = parseInt(b.split('_')[1].split('.')[0]);
      return timeB - timeA; // Most recent first
    });

    const latestPodcast = bankPodcasts[0];
    const timestamp = parseInt(latestPodcast.split('_')[1].split('.')[0]);

    // Get file size to estimate duration (rough estimate: 1MB ≈ 1 minute)
    const filePath = path.join(PODCAST_DIR, latestPodcast);
    const stats = await fs.stat(filePath);
    const estimatedDuration = Math.round(stats.size / 1024 / 1024); // MB as rough minutes

    res.json({
      podcast: {
        url: `/api/research/${idrssd}/podcast/download/${latestPodcast}`,
        duration: estimatedDuration,
        generatedAt: new Date(timestamp).toISOString(),
        filename: latestPodcast
      }
    });
  } catch (error) {
    console.error('Error fetching latest podcast:', error);
    res.status(500).json({ error: 'Failed to fetch podcast' });
  }
});

/**
 * GET /api/research/:idrssd/podcast/download/:filename
 * Download a specific podcast file
 */
router.get('/:idrssd/podcast/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(PODCAST_DIR, filename);

    // Check if file exists
    await fs.access(filePath);

    // Stream the file
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading podcast:', error);
    res.status(404).json({ error: 'Podcast not found' });
  }
});

/**
 * DELETE /api/research/:idrssd/podcast/:filename
 * Delete a specific podcast file
 */
router.delete('/:idrssd/podcast/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(PODCAST_DIR, filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'Podcast not found' });
    }

    // Delete the file
    await fs.unlink(filePath);
    console.log(`[Podcast Delete] Deleted podcast file: ${filename}`);

    // Also update the report JSON if it has podcast metadata
    try {
      const reportFiles = (await fs.readdir(RESEARCH_DIR)).filter(f => 
        f.startsWith(`${req.params.idrssd}_`) && f.endsWith('.json')
      );
      
      if (reportFiles.length > 0) {
        // Sort by timestamp (most recent first)
        reportFiles.sort((a, b) => {
          const partsA = a.replace('.json', '').split('_');
          const partsB = b.replace('.json', '').split('_');
          const timeA = parseInt(partsA[partsA.length - 1]);
          const timeB = parseInt(partsB[partsB.length - 1]);
          return timeB - timeA;
        });

        // Check the most recent report
        const latestReport = path.join(RESEARCH_DIR, reportFiles[0]);
        const reportData = JSON.parse(await fs.readFile(latestReport, 'utf-8'));
        
        if (reportData.podcast && reportData.podcast.filename === filename) {
          delete reportData.podcast;
          await fs.writeFile(latestReport, JSON.stringify(reportData, null, 2));
          console.log(`[Podcast Delete] Removed podcast metadata from report`);
        }
      }
    } catch (err) {
      console.warn('[Podcast Delete] Could not update report metadata:', err.message);
      // Not a fatal error - continue
    }

    res.json({ 
      success: true, 
      message: 'Podcast deleted successfully' 
    });

  } catch (error) {
    console.error('[Podcast Delete] Error:', error);
    res.status(500).json({ error: 'Failed to delete podcast' });
  }
});

/**
 * POST /api/research/:idrssd/podcast/generate-background
 * Start podcast generation as a background job
 * Returns immediately with a job ID
 */
router.post('/:idrssd/podcast/generate-background', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { experts } = req.body;

    // Parse expert IDs
    const selectedExperts = experts || [];

    console.log(`Starting background podcast generation for ${idrssd} with experts:`, selectedExperts);

    // Create a background job
    const jobId = jobTracker.createJob(idrssd, 'podcast');

    // Return immediately with job ID
    res.json({
      success: true,
      jobId,
      message: 'Podcast generation started in background'
    });

    // Start generation in background (don't await)
    generatePodcastInBackground(idrssd, jobId, selectedExperts).catch(error => {
      console.error(`[Job ${jobId}] Fatal error:`, error);
      jobTracker.failJob(jobId, error);
    });

  } catch (error) {
    console.error('Error starting background podcast job:', error);
    res.status(500).json({ error: 'Failed to start background podcast job' });
  }
});

/**
 * GET /api/research/:idrssd/podcast/generate
 * Generate podcast for an existing research report
 * Query params: experts (comma-separated list of expert IDs)
 */
router.get('/:idrssd/podcast/generate', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { experts } = req.query;

    // Parse expert IDs
    const selectedExperts = experts ? experts.split(',').filter(e => e.length > 0) : [];

    console.log(`Generating podcast for ${idrssd} with experts:`, selectedExperts);

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.set('Content-Encoding', 'none');
    res.flushHeaders();

    // Send initial comment
    res.write(': connected\n\n');

    const sendStatus = (stage, message, data = {}) => {
      const payload = JSON.stringify({ stage, message, ...data });
      console.log('Podcast SSE:', stage, message);
      res.write(`data: ${payload}\n\n`);

      // Force flush
      if (res.socket && res.socket.writable) {
        res.socket.uncork();
      }
    };

    // Step 1: Load existing research report
    sendStatus('loading', 'Loading research report...');

    const files = await fs.readdir(RESEARCH_DIR);
    const bankReports = files.filter(f => f.startsWith(`${idrssd}_`) && f.endsWith('.json'));

    if (bankReports.length === 0) {
      sendStatus('error', 'No research report found. Please generate a report first.');
      res.end();
      return;
    }

    // Get most recent report
    bankReports.sort((a, b) => {
      const timeA = parseInt(a.split('_')[1].split('.')[0]);
      const timeB = parseInt(b.split('_')[1].split('.')[0]);
      return timeB - timeA;
    });

    const reportFile = path.join(RESEARCH_DIR, bankReports[0]);
    const reportData = JSON.parse(await fs.readFile(reportFile, 'utf-8'));

    // Step 2: Generate podcast script
    sendStatus('script', 'Bankskie is preparing the show script...');

    const podcastScriptService = new PodcastScriptService();
    const scriptResult = await podcastScriptService.generateScript(
      reportData.bankName,
      reportData.analysis,
      selectedExperts,
      reportData.trendsData,
      (event) => {
        sendStatus(event.stage, event.message);
      },
      reportData.agentInsights || null,  // Pass agent insights if available
      reportData.agentStats || null       // Pass agent stats if available
    );

    const script = scriptResult.script;
    const stats = podcastScriptService.getScriptStats(script.segments);
    const duration = podcastScriptService.estimateDuration(script.fullText);

    sendStatus('script_complete', `Script ready: ${stats.totalSegments} segments, ~${duration} minutes`, {
      stats,
      duration
    });

    // Step 3: Generate audio
    sendStatus('audio', 'Generating audio with ElevenLabs...');

    const elevenLabsService = new ElevenLabsService();
    const audioBuffer = await elevenLabsService.generatePodcastAudio(
      script.segments,
      (event) => {
        sendStatus('audio_progress', `Generating audio: ${event.current}/${event.total}`, {
          current: event.current,
          total: event.total,
          speaker: elevenLabsService.getCharacterName(event.speaker)
        });
      }
    );

    // Step 4: Save audio file
    sendStatus('saving', 'Saving podcast file...');

    const timestamp = Date.now();
    const filename = `${idrssd}_${timestamp}.mp3`;
    const filePath = path.join(PODCAST_DIR, filename);

    await elevenLabsService.saveAudioFile(audioBuffer, filePath);

    // Step 5: Update report with podcast metadata
    reportData.podcast = {
      filename,
      generatedAt: new Date().toISOString(),
      experts: selectedExperts,
      duration,
      stats,
      scriptMetadata: script.metadata
    };

    await fs.writeFile(reportFile, JSON.stringify(reportData, null, 2));

    // Send completion
    sendStatus('complete', 'Podcast generated successfully!', {
      podcast: {
        filename,
        url: `/api/research/${idrssd}/podcast/${filename}`,
        duration,
        experts: selectedExperts.map(id => elevenLabsService.getCharacterName(id))
      }
    });

    res.end();

  } catch (error) {
    console.error('Error generating podcast:', error);
    res.write(`data: ${JSON.stringify({
      stage: 'error',
      message: `Error: ${error.message}`
    })}\n\n`);
    res.end();
  }
});

/**
 * GET /api/research/:idrssd/podcast/:filename
 * Download podcast audio file
 */
router.get('/:idrssd/podcast/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(PODCAST_DIR, filename);

    // Check if file exists
    await fs.access(filePath);

    // Send file
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(filePath);

  } catch (error) {
    console.error('Error serving podcast file:', error);
    res.status(404).json({ error: 'Podcast file not found' });
  }
});

/**
 * Generate podcast in background (async function)
 * For multi-user support: each bank has its own job
 */
async function generatePodcastInBackground(idrssd, jobId, selectedExperts) {
  try {
    console.log(`[Job ${jobId}] Starting podcast generation for ${idrssd}`);

    // Step 1: Load research report
    jobTracker.updateJob(jobId, {
      status: 'running',
      progress: 10,
      message: 'Loading research report...'
    });

    const files = await fs.readdir(RESEARCH_DIR);
    const bankReports = files.filter(f => f.startsWith(`${idrssd}_`) && f.endsWith('.json'));

    if (bankReports.length === 0) {
      throw new Error('No research report found. Please generate a report first.');
    }

    // Get most recent report
    bankReports.sort((a, b) => {
      const timeA = parseInt(a.split('_')[1].split('.')[0]);
      const timeB = parseInt(b.split('_')[1].split('.')[0]);
      return timeB - timeA;
    });

    const reportFile = path.join(RESEARCH_DIR, bankReports[0]);
    const reportData = JSON.parse(await fs.readFile(reportFile, 'utf-8'));

    // Step 2: Generate script
    jobTracker.updateJob(jobId, {
      progress: 30,
      message: 'Generating podcast script...'
    });

    const podcastScriptService = new PodcastScriptService();
    const scriptResult = await podcastScriptService.generateScript(
      reportData.bankName,
      reportData.analysis,
      selectedExperts,
      reportData.trendsData,
      (event) => {
        jobTracker.updateJob(jobId, { message: event.message });
      },
      reportData.agentInsights || null,  // Pass agent insights if available
      reportData.agentStats || null       // Pass agent stats if available
    );

    const script = scriptResult.script;
    const duration = podcastScriptService.estimateDuration(script.fullText);

    // Step 3: Generate audio
    jobTracker.updateJob(jobId, {
      progress: 50,
      message: 'Generating audio with ElevenLabs...'
    });

    const elevenLabsService = new ElevenLabsService();
    const audioBuffer = await elevenLabsService.generatePodcastAudio(
      script.segments,
      (event) => {
        const audioProgress = 50 + Math.round((event.current / event.total) * 40);
        jobTracker.updateJob(jobId, {
          progress: audioProgress,
          message: `Generating audio: ${event.current}/${event.total}`
        });
      }
    );

    // Step 4: Save audio file
    jobTracker.updateJob(jobId, {
      progress: 95,
      message: 'Saving podcast file...'
    });

    const timestamp = Date.now();
    const filename = `${idrssd}_${timestamp}.mp3`;
    const filePath = path.join(PODCAST_DIR, filename);

    await elevenLabsService.saveAudioFile(audioBuffer, filePath);

    // Step 5: Update report with podcast metadata
    reportData.podcast = {
      filename,
      generatedAt: new Date().toISOString(),
      experts: selectedExperts,
      duration
    };

    await fs.writeFile(reportFile, JSON.stringify(reportData, null, 2));

    // Step 6: Complete job
    jobTracker.completeJob(jobId, {
      filename,
      url: `/api/research/${idrssd}/podcast/${filename}`,
      duration,
      experts: selectedExperts
    });

    console.log(`[Job ${jobId}] Podcast generation completed successfully`);

  } catch (error) {
    console.error(`[Job ${jobId}] Error:`, error);
    jobTracker.failJob(jobId, error);
    throw error;
  }
}

/**
 * ============================================================================
 * NEW ENDPOINTS: Two-Stage AI Research Workflow
 * ============================================================================
 */

/**
 * GET /api/research/:idrssd/gather-sources
 * Stage 1: Gather data sources with SSE streaming
 * Searches for sources and streams them as they're found
 */
router.get('/:idrssd/gather-sources', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { sessionId, config } = req.query;

    const userConfig = config ? JSON.parse(decodeURIComponent(config)) : {};

    // Get bank info
    const bank = await Institution.findOne({ idrssd });
    if (!bank) {
      return res.status(404).json({ error: 'Bank not found' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent('progress', { progress: 0, message: 'Starting source gathering...' });

    // Always search all 4 streamlined categories (focused on high-quality, recent sources)
    const categoriesToSearch = [
      'investorPresentation',
      'earningsTranscript',
      'strategyAnalysis',
      'analystReports'
    ];

    // Search for each category
    const totalCategories = categoriesToSearch.length;
    let completedCategories = 0;

    for (const category of categoriesToSearch) {
      try {
        // Use Claude to search for sources in this category
        const sources = await searchSourcesForCategory(bank, category);

        // Apply recommendation logic
        const rankedSources = rankAndRecommendSources(sources, category);

        // Save each source to database (without fetching content)
        for (const sourceData of rankedSources) {
          const source = new Source({
            sourceId: `src_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            idrssd,
            sessionId,
            category,
            ...sourceData,
            status: 'pending',
            fetchStatus: 'not_fetched' // Track fetch status separately
          });

          await source.save();

          // Stream the source to frontend without content
          // Content will only be fetched after user approves
          sendEvent('source-found', {
            category,
            source: {
              id: source.sourceId,
              url: source.url,
              title: source.title,
              preview: source.preview,
              date: source.date,
              status: source.status,
              confidence: source.confidence,
              recommended: source.recommended,
              fetchStatus: 'not_fetched'
            }
          });
        }

        completedCategories++;
        const progress = Math.round((completedCategories / totalCategories) * 100);
        sendEvent('progress', { progress, message: `Completed ${category}` });
        sendEvent('category-complete', { category, foundCount: sources.length });

      } catch (error) {
        console.error(`Error searching for ${category}:`, error);
        sendEvent('category-complete', { category, foundCount: 0, error: error.message });
        completedCategories++;
      }
    }

    sendEvent('complete', { message: 'Source gathering complete' });
    res.end();

  } catch (error) {
    console.error('Error in gather-sources:', error);
    res.status(500).json({ error: 'Failed to gather sources' });
  }
});

/**
 * Helper: Rank and recommend sources based on quality and recency
 */
function rankAndRecommendSources(sources, category) {
  if (!sources || sources.length === 0) return sources;

  // Reputable news domains (prioritize these)
  const reputableDomains = [
    'wsj.com', 'ft.com', 'bloomberg.com', 'reuters.com', 'apnews.com',
    'nytimes.com', 'washingtonpost.com', 'economist.com', 'cnbc.com',
    'axios.com', 'forbes.com', 'businessinsider.com', 'marketwatch.com'
  ];

  // PR/Clickbait domains (deprioritize these)
  const prDomains = [
    'prnewswire.com', 'businesswire.com', 'globenewswire.com',
    'accesswire.com', 'prweb.com', 'stockhouse.com'
  ];

  // Score each source
  const scoredSources = sources.map(source => {
    let score = source.confidence || 0.5;
    const url = source.url.toLowerCase();
    const title = (source.title || '').toLowerCase();

    // Check domain reputation
    const isReputable = reputableDomains.some(domain => url.includes(domain));
    const isPR = prDomains.some(domain => url.includes(domain));

    if (isReputable) score += 0.3;
    if (isPR) score -= 0.3;

    // Enhanced category-specific scoring
    if (category === 'investorPresentation') {
      // Strongly prefer PDF files from official IR sites
      if (url.includes('.pdf')) score += 0.3;
      if (url.includes('investor') || url.includes('/ir/')) score += 0.25;
      if (title.includes('investor deck') || title.includes('investor presentation')) score += 0.2;
      // Boost recent presentations (2025)
      if (source.date && source.date.includes('2025')) score += 0.2;
      // Penalize older presentations
      if (source.date && source.date.includes('2024')) score -= 0.15;
      if (source.date && source.date.includes('2023')) score -= 0.3;
    }

    if (category === 'earningsTranscript') {
      // Prefer full transcripts (not summaries)
      if (title.toLowerCase().includes('full transcript') || title.toLowerCase().includes('complete transcript')) score += 0.3;
      if (title.includes('earnings call') || title.includes('transcript')) score += 0.2;
      // Trusted transcript sources
      if (url.includes('seekingalpha.com') || url.includes('fool.com')) score += 0.2;
      // Penalize summaries
      if (title.toLowerCase().includes('summary') || title.toLowerCase().includes('highlights only')) score -= 0.4;
      // Recent quarters strongly preferred
      if (source.date && (source.date.includes('Q4 2025') || source.date.includes('Q3 2025') || source.date.includes('Q2 2025'))) score += 0.25;
    }

    if (category === 'strategyAnalysis') {
      // Prefer PDF documents and analysis from reputable firms
      if (url.includes('.pdf')) score += 0.25;
      if (url.includes('mckinsey.com') || url.includes('bcg.com') || url.includes('bain.com')) score += 0.35;
      if (title.toLowerCase().includes('strategy') || title.toLowerCase().includes('strategic plan')) score += 0.2;
      if (title.toLowerCase().includes('digital transformation') || title.toLowerCase().includes('strategic initiatives')) score += 0.15;
      // Strongly penalize PR and news wires
      if (isPR) score -= 0.5;
      // Recent content preferred
      if (source.date && source.date.includes('2025')) score += 0.2;
    }

    if (category === 'analystReports') {
      // Strongly prefer reports from top analyst firms
      if (url.includes('forrester.com') || url.includes('gartner.com')) score += 0.4;
      if (url.includes('idc.com') || url.includes('jdpower.com')) score += 0.3;
      if (url.includes('.pdf')) score += 0.25;
      if (title.toLowerCase().includes('analyst report') || title.toLowerCase().includes('research report')) score += 0.2;
      // Recent reports strongly preferred
      if (source.date && source.date.includes('2025')) score += 0.25;
      if (source.date && source.date.includes('2024')) score -= 0.1;
    }

    return { ...source, score };
  });

  // Sort by score (highest first)
  scoredSources.sort((a, b) => b.score - a.score);

  // Mark top source(s) as recommended based on category
  if (scoredSources.length > 0) {
    // For investor presentations and earnings transcripts, recommend only the top 1 (most recent, official)
    if (category === 'investorPresentation' || category === 'earningsTranscript') {
      scoredSources[0].recommended = true;
    }
    // For strategy analysis and analyst reports, recommend top 2-3 high-quality sources
    else if (category === 'strategyAnalysis' || category === 'analystReports') {
      scoredSources.forEach((source, idx) => {
        if (idx < 3 && source.score > 0.75) {
          source.recommended = true;
        }
      });
    }
  }

  return scoredSources;
}

/**
 * Helper: Search for sources in a specific category
 */
async function searchSourcesForCategory(bank, category) {
  const sources = [];

  // Calculate date for 6 months ago
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const dateFilter = `after:${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

  // Extract domain from website URL for targeted searching
  let domain = '';
  if (bank.website) {
    try {
      const url = new URL(bank.website.startsWith('http') ? bank.website : `https://${bank.website}`);
      domain = url.hostname.replace('www.', '');
    } catch (e) {
      domain = bank.website.replace('www.', '');
    }
  }

  // For investor presentations, use a two-step search strategy
  if (category === 'investorPresentation') {
    try {
      // Step 1: First find the investor relations website
      let irSiteQuery = domain ? 
        `"${bank.name}" investor relations site:${domain} OR site:investor.${domain} OR site:ir.${domain} OR site:${domain}/investor OR site:${domain}/ir` :
        `"${bank.name}" investor relations website`;
      
      const irSiteResults = await claudeService.searchForSources(irSiteQuery, category, bank, 
        `CRITICAL: Find ${bank.name}'s investor relations (IR) website URL. Look for URLs containing "investor" or "ir" such as:
- investor.bankname.com
- ir.bankname.com  
- bankname.com/investor
- bankname.com/ir
- bankname.com/investor-relations

Return the actual IR website URL (the main investor relations page URL), not PDFs. This will be used to search for presentations. If the IR site URL is found, return it as a source with the URL field containing the IR site address.`
      );

      // Extract IR site URL from results if found
      let irSiteUrl = null;
      if (irSiteResults && irSiteResults.length > 0) {
        // Try to find an IR site URL in the results - check URL, title, and preview
        for (const result of irSiteResults) {
          // Check URL field
          const urlToCheck = result.url || '';
          // Also check title and preview for URLs
          const textToCheck = `${urlToCheck} ${result.title || ''} ${result.preview || ''}`.toLowerCase();
          
          if (textToCheck.includes('investor.') || 
              textToCheck.includes('ir.') || 
              textToCheck.includes('/ir') || 
              textToCheck.includes('/investor') ||
              textToCheck.includes('investor-relations')) {
            // Prefer the URL if it's an IR site, otherwise try to extract from text
            if (urlToCheck && (
              urlToCheck.includes('investor.') || 
              urlToCheck.includes('ir.') || 
              urlToCheck.includes('/ir') || 
              urlToCheck.includes('/investor')
            )) {
              irSiteUrl = urlToCheck;
            } else {
              // Try to extract URL from text
              const urlMatch = textToCheck.match(/(https?:\/\/[^\s]*investor[^\s]*|https?:\/\/[^\s]*\/ir[^\s]*)/);
              if (urlMatch) {
                irSiteUrl = urlMatch[1];
              }
            }
            if (irSiteUrl) break;
          }
        }
      }

      // Step 2: Search for presentations/events on the IR site (or use broader search if IR site not found)
      let presentationsQuery;
      if (irSiteUrl) {
        // Extract domain from IR site URL
        try {
          const irUrl = new URL(irSiteUrl.startsWith('http') ? irSiteUrl : `https://${irSiteUrl}`);
          const irDomain = irUrl.hostname.replace('www.', '');
          // Search for PDFs in events, presentations, or earnings sections of the IR site
          presentationsQuery = `site:${irDomain} (presentations OR events OR "investor presentation" OR "investor deck" OR "earnings supplement" OR "earnings presentation" OR "quarterly presentation") filetype:pdf ${dateFilter}`;
        } catch (e) {
          // Fallback to broader search
          presentationsQuery = domain ? 
            `"${bank.name}" (investor presentation OR investor deck OR earnings supplement OR earnings presentation) filetype:pdf ${dateFilter} (site:investor.${domain} OR site:ir.${domain} OR site:${domain}/investor OR site:${domain}/ir)` :
            `"${bank.name}" (investor presentation OR investor deck OR earnings supplement OR earnings presentation) filetype:pdf ${dateFilter}`;
        }
      } else {
        // If IR site not found, do broader search including common IR site patterns
        presentationsQuery = domain ? 
          `"${bank.name}" (investor presentation OR investor deck OR earnings supplement OR earnings presentation) filetype:pdf ${dateFilter} (site:investor.${domain} OR site:ir.${domain} OR site:${domain}/investor OR site:${domain}/ir)` :
          `"${bank.name}" (investor presentation OR investor deck OR earnings supplement OR earnings presentation) filetype:pdf ${dateFilter}`;
      }

      const presentationResults = await claudeService.searchForSources(presentationsQuery, category, bank,
        `Find PDF investor presentations or earnings call PDF supplements from ${bank.name}'s investor relations site. Look for:
- Quarterly earnings presentation PDFs
- Investor day presentation PDFs  
- Earnings call PDF supplements (accompany earnings transcripts)
- Event presentation PDFs (conferences, roadshows)

Must be official PDF documents from the investor relations section. Look in areas like "Events & Presentations", "Presentations", "Earnings & Events", or "Investor Materials". Only return PDF files (filetype:pdf).`
      );
      return presentationResults || [];
    } catch (error) {
      console.error(`Error in two-step investor presentation search:`, error);
      // Fallback to single search
      const fallbackQuery = domain ? 
        `"${bank.name}" (investor presentation filetype:pdf ${dateFilter} site:investor.${domain} OR site:ir.${domain}` :
        `"${bank.name}" investor presentation filetype:pdf ${dateFilter}`;
      return await claudeService.searchForSources(fallbackQuery, category, bank) || [];
    }
  }

  // For other categories, use standard single search
  const searchQueries = {
    // Full earnings call transcripts - exclude summaries and paywalls
    earningsTranscript: `"${bank.name}" ("earnings call transcript" OR "quarterly earnings transcript") ${dateFilter} (site:seekingalpha.com OR site:fool.com) -"summary" -"highlights only" -subscribe -paywall`,

    // Detailed strategy documents and analysis - recent, non-paywalled
    strategyAnalysis: `"${bank.name}" (strategy OR "strategic plan" OR "digital transformation" OR "strategic initiatives") ${dateFilter} (filetype:pdf OR site:mckinsey.com OR site:bcg.com OR site:bain.com) -prnewswire -businesswire -subscribe -paywall`,

    // Analyst reports from reputable firms - recent only
    analystReports: `"${bank.name}" ("analyst report" OR "industry report" OR "research report") ${dateFilter} (site:forrester.com OR site:gartner.com OR site:idc.com OR site:jdpower.com OR filetype:pdf) -subscribe -paywall`
  };

  const query = searchQueries[category];

  try {
    // Use Claude with search to find relevant sources
    const searchResults = await claudeService.searchForSources(query, category, bank);

    // Parse results and extract source information
    // This would be implemented in ClaudeService
    return searchResults || [];

  } catch (error) {
    console.error(`Error searching for ${category}:`, error);
    return [];
  }
}

/**
 * GET /api/research/:idrssd/sources/latest
 * Get sources from the latest session for this bank
 */
router.get('/:idrssd/sources/latest', async (req, res) => {
  try {
    const { idrssd } = req.params;
    console.log(`GET /api/research/${idrssd}/sources/latest - Request received`);

    // Find the most recent source for this bank to get its session ID
    const latestSource = await Source.findOne({ idrssd })
      .sort({ foundAt: -1 })
      .limit(1);

    console.log('Latest source found:', latestSource ? latestSource.sessionId : 'none');

    if (!latestSource) {
      console.log('No sources found for bank:', idrssd);
      return res.json({ sources: [], sessionId: null });
    }

    // Get all sources from that session
    const sources = await Source.getBySession(latestSource.sessionId);
    console.log(`Found ${sources.length} sources from session ${latestSource.sessionId}`);

    res.json({
      sessionId: latestSource.sessionId,
      sources: sources.map(s => ({
        id: s.sourceId,
        category: s.category,
        url: s.url,
        title: s.title,
        preview: s.preview,
        date: s.date,
        status: s.status,
        confidence: s.confidence,
        recommended: s.recommended,
        fetchStatus: s.fetchStatus,
        fetchError: s.fetchError,
        contentLength: s.contentLength,
        contentType: s.contentType,
        fetchable: s.fetchable,
        hasContent: !!s.content,
        isProbablyPaywalled: s.isProbablyPaywalled,
        isProbablyTruncated: s.isProbablyTruncated,
        requiresWebSearch: s.requiresWebSearch,
        foundAt: s.foundAt
      }))
    });

  } catch (error) {
    console.error('Error fetching latest sources:', error);
    res.status(500).json({ error: 'Failed to fetch latest sources' });
  }
});

/**
 * GET /api/research/:idrssd/sources
 * Get all sources for a session
 */
router.get('/:idrssd/sources', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { sessionId } = req.query;

    const sources = await Source.getBySession(sessionId);

    res.json({
      sessionId,
      sources: sources.map(s => ({
        id: s.sourceId,
        category: s.category,
        url: s.url,
        title: s.title,
        preview: s.preview,
        date: s.date,
        status: s.status,
        confidence: s.confidence,
        recommended: s.recommended,
        fetchStatus: s.fetchStatus,
        fetchError: s.fetchError,
        contentLength: s.contentLength,
        contentType: s.contentType,
        fetchable: s.fetchable,
        hasContent: !!s.content,
        isProbablyPaywalled: s.isProbablyPaywalled,
        isProbablyTruncated: s.isProbablyTruncated,
        requiresWebSearch: s.requiresWebSearch,
        foundAt: s.foundAt
      }))
    });

  } catch (error) {
    console.error('Error fetching sources:', error);
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

/**
 * POST /api/research/:idrssd/sources/:sourceId/approve
 * Approve a source (no automatic content fetching - user downloads PDFs manually)
 */
router.post('/:idrssd/sources/:sourceId/approve', async (req, res) => {
  try {
    const { sourceId } = req.params;

    console.log(`[Approve] Approving source: ${sourceId}`);

    const source = await Source.findOne({ sourceId });
    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    await source.approve();

    res.json({
      success: true,
      source: {
        id: source.sourceId,
        status: source.status,
        approvedAt: source.approvedAt,
        url: source.url,
        title: source.title
      }
    });

  } catch (error) {
    console.error('Error approving source:', error);
    res.status(500).json({ error: 'Failed to approve source' });
  }
});

/**
 * POST /api/research/:idrssd/sources/:sourceId/ignore
 * Ignore a source (won't be used in report)
 */
router.post('/:idrssd/sources/:sourceId/ignore', async (req, res) => {
  try {
    const { sourceId } = req.params;

    const source = await Source.findOne({ sourceId });
    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    await source.ignore();

    res.json({
      success: true,
      source: {
        id: source.sourceId,
        status: source.status
      }
    });

  } catch (error) {
    console.error('Error ignoring source:', error);
    res.status(500).json({ error: 'Failed to ignore source' });
  }
});

/**
 * POST /api/research/:idrssd/sources/:sourceId/fetch-content
 * Fetch content for a specific source
 */
router.post('/:idrssd/sources/:sourceId/fetch-content', async (req, res) => {
  try {
    const { sourceId } = req.params;

    console.log(`[FetchContent] Request to fetch content for source: ${sourceId}`);

    const source = await Source.findOne({ sourceId });
    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    // Mark fetch as in progress
    await source.startFetch();

    // Fetch content
    console.log(`[FetchContent] Fetching content from: ${source.url}`);
    const fetchResult = await contentFetcher.fetchAndParse(source.url);

    // Store result
    await source.storeFetchedContent(fetchResult);

    console.log(`[FetchContent] Fetch complete. Status: ${source.fetchStatus}, Fetchable: ${source.fetchable}`);

    // Return updated source
    res.json({
      success: true,
      source: {
        id: source.sourceId,
        fetchStatus: source.fetchStatus,
        fetchable: source.fetchable,
        contentLength: source.contentLength,
        contentType: source.contentType,
        fetchError: source.fetchError,
        hasContent: !!source.content
      }
    });

  } catch (error) {
    console.error('[FetchContent] Error:', error);

    // Try to mark source as failed
    try {
      const source = await Source.findOne({ sourceId: req.params.sourceId });
      if (source) {
        await source.markFetchFailed(error.message);
      }
    } catch (saveError) {
      console.error('[FetchContent] Error saving failure status:', saveError);
    }

    res.status(500).json({
      error: 'Failed to fetch content',
      details: error.message
    });
  }
});

/**
 * POST /api/research/:idrssd/find-better-source
 * User-guided search for better sources
 */
router.post('/:idrssd/find-better-source', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { category, sessionId, refinementPrompt } = req.body;

    const bank = await Institution.findOne({ idrssd });
    if (!bank) {
      return res.status(404).json({ error: 'Bank not found' });
    }

    // Use Claude to perform targeted search based on user's refinement
    const customQuery = `${bank.name} ${refinementPrompt}`;
    const searchResults = await claudeService.searchForSources(customQuery, category, bank, refinementPrompt);

    if (searchResults && searchResults.length > 0) {
      // Save the new source(s)
      const newSources = [];
      for (const sourceData of searchResults) {
        const source = new Source({
          sourceId: `src_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          idrssd,
          sessionId,
          category,
          ...sourceData,
          status: 'pending'
        });

        await source.save();
        newSources.push({
          id: source.sourceId,
          url: source.url,
          title: source.title,
          preview: source.preview,
          date: source.date,
          status: source.status
        });
      }

      res.json({
        success: true,
        sources: newSources
      });
    } else {
      res.json({
        success: false,
        message: 'No additional sources found'
      });
    }

  } catch (error) {
    console.error('Error finding better source:', error);
    res.status(500).json({ error: 'Failed to find better source' });
  }
});

/**
 * GET /api/research/:idrssd/generate-with-sources
 * Stage 2: Generate report using ONLY approved sources + call report data
 * No new web searches performed
 */
router.get('/:idrssd/generate-with-sources', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { sourceIds, sessionId } = req.query;

    console.log('=== STAGE 2: GENERATE WITH SOURCES ===');
    console.log('Bank ID:', idrssd);
    console.log('Session ID:', sessionId);
    console.log('Raw sourceIds:', sourceIds);

    const approvedSourceIds = sourceIds ? JSON.parse(decodeURIComponent(sourceIds)) : [];
    console.log('Parsed approved source IDs:', approvedSourceIds);

    // Get bank and approved sources
    const bank = await Institution.findOne({ idrssd });
    if (!bank) {
      console.error('Bank not found:', idrssd);
      return res.status(404).json({ error: 'Bank not found' });
    }
    console.log('Bank found:', bank.name);

    const approvedSources = await Source.getByIds(approvedSourceIds);
    console.log('Approved sources fetched:', approvedSources.length);
    approvedSources.forEach((s, idx) => {
      console.log(`  Source ${idx + 1}: ${s.title}`);
      console.log(`    - URL: ${s.url}`);
      console.log(`    - Has content: ${!!s.content}`);
      console.log(`    - Content length: ${s.contentLength || 0}`);
      console.log(`    - Fetchable: ${s.fetchable}`);
    });

    // Get financial data (always included)
    // Sort ascending (oldest first) for proper chronological order in charts
    const statements = await FinancialStatement.find({ idrssd })
      .sort({ reportingPeriod: 1 })
      .limit(20);
    console.log('Financial statements found:', statements.length);

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent('status', { phase: 'analysis', progress: 34, message: 'Analyzing with approved sources...' });

    try {
      console.log('Starting generateReportWithApprovedSources...');

      // Generate report using approved sources
      await generateReportWithApprovedSources(
        idrssd,
        bank,
        statements,
        approvedSources,
        sessionId,
        sendEvent
      );

      console.log('Report generation completed successfully');
      sendEvent('complete', { message: 'Report generation complete' });
    } catch (error) {
      console.error('ERROR in report generation:', error);
      console.error('Error stack:', error.stack);
      sendEvent('error', { message: error.message });
    } finally {
      res.end();
    }

  } catch (error) {
    console.error('ERROR in generate-with-sources endpoint:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * Helper: Generate report using approved sources
 */
async function generateReportWithApprovedSources(idrssd, bank, statements, approvedSources, sessionId, sendEvent) {
  try {
    console.log('\n=== generateReportWithApprovedSources START ===');
    console.log('Bank:', bank.name);
    console.log('Statements count:', statements.length);
    console.log('Approved sources count:', approvedSources.length);
    console.log('Session ID:', sessionId);

    sendEvent('status', { phase: 'analysis', progress: 40, message: 'Preparing approved sources...' });

    // Use pre-fetched content from Stage 1 (RAG pipeline)
    // No additional web fetching required - content was already downloaded
    const sourcesWithContent = approvedSources.map((source) => {
      if (!source.content || !source.fetchable) {
        console.warn(`Source ${source.sourceId} has no content or was not fetchable`);
        source.content = `[Content for "${source.title}" (${source.url}) was not available. Reason: ${source.contentType === 'error' ? 'fetch error' : 'not fetchable'}]`;
      }
      return source;
    });

    console.log(`Using ${sourcesWithContent.length} approved sources with pre-fetched content`);
    sendEvent('status', { phase: 'analysis', progress: 50, message: 'Generating comprehensive analysis...' });

    // Build prompt with approved sources
    const sourceContext = sourcesWithContent.map((s, idx) => `
Source ${idx + 1}: ${s.title}
URL: ${s.url}
Category: ${s.category}
Content:
${s.content}

---
`).join('\n');

    // Call Claude with streaming, providing ONLY approved sources
    // (Modified prompt to prevent new web searches)
    console.log('Calling claudeService.generateReportFromApprovedSources...');
    console.log('Source context length:', sourceContext.length, 'characters');

    const result = await claudeService.generateReportFromApprovedSources({
      bank,
      statements,
      sourcesContext: sourceContext,
      approvedSources: sourcesWithContent,
      onThinking: (text) => {
        sendEvent('thinking', { text });
      },
      onText: (text) => {
        sendEvent('text', { text });
        sendEvent('status', { phase: 'synthesis', progress: 75, message: 'Synthesizing final report...' });
      }
    });

    console.log('Claude service call completed');
    console.log('Result keys:', Object.keys(result));

    // Save report with source references
    const timestamp = Date.now();
    const reportFile = path.join(RESEARCH_DIR, `${idrssd}_${timestamp}.json`);

    const reportData = {
      idrssd,
      bankName: bank.name,
      generatedAt: new Date().toISOString(),
      model: result.model || 'Claude Sonnet 4.5',
      analysis: result.analysis,
      thinking: result.thinking,
      trendsData: result.trendsData,
      sessionId,
      sourcesUsed: approvedSources.map(s => ({
        id: s.sourceId,
        category: s.category,
        title: s.title,
        url: s.url,
        date: s.date
      })),
      metadata: result.metadata
    };

    console.log('Writing report file:', reportFile);
    await fs.writeFile(reportFile, JSON.stringify(reportData, null, 2));
    console.log('Report file written successfully');

    // Update source usage tracking
    console.log('Updating source usage tracking...');
    for (const source of approvedSources) {
      source.referencedCount = (source.referencedCount || 0) + 1;
      source.usedInReports.push(reportFile);
      await source.save();
    }
    console.log('Source tracking updated');

    sendEvent('status', { phase: 'synthesis', progress: 100, message: 'Report saved successfully' });
    console.log('=== generateReportWithApprovedSources END ===\n');

  } catch (error) {
    console.error('\n!!! ERROR in generateReportWithApprovedSources !!!');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw error;
  }
}

/**
 * ============================================================================
 * PDF MANAGEMENT ENDPOINTS
 * ============================================================================
 */

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const { idrssd } = req.params;
    const bankPdfDir = path.join(PDFS_DIR, idrssd);

    // Ensure bank's PDF directory exists
    try {
      await fs.mkdir(bankPdfDir, { recursive: true });
      cb(null, bankPdfDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}_${randomId}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit per file
  },
  fileFilter: (req, file, cb) => {
    // Only allow PDF files
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

/**
 * POST /api/research/:idrssd/pdfs/upload
 * Upload a PDF file for a bank
 */
router.post('/:idrssd/pdfs/upload', upload.single('pdf'), async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { description, sourceId, sourceUrl } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    console.log(`[PDF Upload] Received PDF for bank ${idrssd}: ${req.file.originalname} (${req.file.size} bytes)`);

    // Check total PDF count and size for this bank
    const existingCount = await PDF.getCount(idrssd);
    const existingSize = await PDF.getTotalSize(idrssd);

    if (existingCount >= 20) {
      // Delete the uploaded file
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'Maximum of 20 PDFs per bank reached' });
    }

    if (existingSize + req.file.size > 100 * 1024 * 1024) { // 100MB total limit
      // Delete the uploaded file
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'Total PDF size limit (100MB) exceeded' });
    }

    // Create PDF record
    const pdf = new PDF({
      pdfId: `pdf_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      idrssd,
      originalFilename: req.file.originalname,
      storedFilename: req.file.filename,
      fileSize: req.file.size,
      sourceId: sourceId || undefined,
      sourceUrl: sourceUrl || undefined,
      uploadType: sourceId ? 'from_source' : 'manual',
      description: description || undefined
    });

    await pdf.save();

    console.log(`[PDF Upload] Saved PDF record: ${pdf.pdfId}`);

    res.json({
      success: true,
      pdf: {
        id: pdf.pdfId,
        filename: pdf.originalFilename,
        size: pdf.fileSize,
        uploadedAt: pdf.uploadedAt,
        description: pdf.description
      }
    });

  } catch (error) {
    console.error('[PDF Upload] Error:', error);
    res.status(500).json({ error: 'Failed to upload PDF' });
  }
});

/**
 * POST /api/research/:idrssd/pdfs/download-from-source
 * Download a PDF from a source URL and add to library
 */
router.post('/:idrssd/pdfs/download-from-source', async (req, res) => {
  try {
    const { idrssd } = req.params;
    const { sourceId } = req.body;

    if (!sourceId) {
      return res.status(400).json({ error: 'sourceId is required' });
    }

    console.log(`[PDF Download] Downloading PDF from source ${sourceId} for bank ${idrssd}`);

    // Get the source
    const source = await Source.findOne({ sourceId });
    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    // Check if URL is a PDF
    const url = source.url;
    const isPdfUrl = url.toLowerCase().endsWith('.pdf') || source.contentType === 'pdf';

    if (!isPdfUrl) {
      return res.status(400).json({ error: 'Source is not a PDF file' });
    }

    // Check total PDF count and size for this bank
    const existingCount = await PDF.getCount(idrssd);
    const existingSize = await PDF.getTotalSize(idrssd);

    if (existingCount >= 20) {
      return res.status(400).json({ error: 'Maximum of 20 PDFs per bank reached' });
    }

    // Download the PDF
    console.log(`[PDF Download] Fetching PDF from: ${url}`);
    const axios = require('axios');
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      maxContentLength: 50 * 1024 * 1024, // 50MB max
      timeout: 60000 // 60 second timeout
    });

    const pdfBuffer = Buffer.from(response.data);
    const fileSize = pdfBuffer.length;

    console.log(`[PDF Download] Downloaded ${fileSize} bytes`);

    // Check size limits
    if (existingSize + fileSize > 100 * 1024 * 1024) {
      return res.status(400).json({ error: 'Total PDF size limit (100MB) exceeded' });
    }

    // Generate filename from source title or URL
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const originalFilename = source.title ?
      `${source.title.substring(0, 50).replace(/[^a-z0-9]/gi, '_')}.pdf` :
      `source_${randomId}.pdf`;
    const storedFilename = `${timestamp}_${randomId}.pdf`;

    // Ensure directory exists
    const bankPdfDir = path.join(PDFS_DIR, idrssd);
    await fs.mkdir(bankPdfDir, { recursive: true });

    // Write file
    const filePath = path.join(bankPdfDir, storedFilename);
    await fs.writeFile(filePath, pdfBuffer);

    console.log(`[PDF Download] Saved to: ${filePath}`);

    // Create PDF record
    const pdf = new PDF({
      pdfId: `pdf_${timestamp}_${randomId}`,
      idrssd,
      originalFilename,
      storedFilename,
      fileSize,
      sourceId,
      sourceUrl: url,
      uploadType: 'from_source',
      description: source.preview || `Downloaded from ${url}`
    });

    await pdf.save();

    console.log(`[PDF Download] Created PDF record: ${pdf.pdfId}`);

    res.json({
      success: true,
      pdf: {
        id: pdf.pdfId,
        filename: pdf.originalFilename,
        size: pdf.fileSize,
        uploadedAt: pdf.uploadedAt,
        sourceId: pdf.sourceId,
        description: pdf.description
      }
    });

  } catch (error) {
    console.error('[PDF Download] Error:', error);
    if (error.response) {
      res.status(500).json({ error: `Failed to download PDF: ${error.response.status} ${error.response.statusText}` });
    } else if (error.code === 'ECONNABORTED') {
      res.status(500).json({ error: 'Download timed out - PDF may be too large' });
    } else {
      res.status(500).json({ error: 'Failed to download PDF from source' });
    }
  }
});

/**
 * GET /api/research/:idrssd/pdfs
 * List all PDFs for a bank
 */
router.get('/:idrssd/pdfs', async (req, res) => {
  try {
    const { idrssd } = req.params;

    const pdfs = await PDF.getByBank(idrssd);
    const totalSize = await PDF.getTotalSize(idrssd);

    res.json({
      success: true,
      pdfs: pdfs.map(p => ({
        id: p.pdfId,
        filename: p.originalFilename,
        size: p.fileSize,
        sourceId: p.sourceId,
        sourceUrl: p.sourceUrl,
        uploadType: p.uploadType,
        description: p.description,
        uploadedAt: p.uploadedAt
      })),
      totalSize,
      count: pdfs.length
    });

  } catch (error) {
    console.error('[PDF List] Error:', error);
    res.status(500).json({ error: 'Failed to list PDFs' });
  }
});

/**
 * GET /api/research/:idrssd/pdfs/:pdfId/download
 * Download a PDF file
 */
router.get('/:idrssd/pdfs/:pdfId/download', async (req, res) => {
  try {
    const { pdfId } = req.params;

    const pdf = await PDF.findOne({ pdfId });
    if (!pdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    const filePath = pdf.getFilePath();

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'PDF file not found on disk' });
    }

    res.download(filePath, pdf.originalFilename);

  } catch (error) {
    console.error('[PDF Download] Error:', error);
    res.status(500).json({ error: 'Failed to download PDF' });
  }
});

/**
 * DELETE /api/research/:idrssd/pdfs/:pdfId
 * Delete a PDF file
 */
router.delete('/:idrssd/pdfs/:pdfId', async (req, res) => {
  try {
    const { pdfId } = req.params;

    const pdf = await PDF.findOne({ pdfId });
    if (!pdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    // Delete file from disk
    const filePath = pdf.getFilePath();
    try {
      await fs.unlink(filePath);
      console.log(`[PDF Delete] Deleted file: ${filePath}`);
    } catch (error) {
      console.warn(`[PDF Delete] File not found on disk: ${filePath}`);
    }

    // Delete database record
    await PDF.deleteOne({ pdfId });
    console.log(`[PDF Delete] Deleted PDF record: ${pdfId}`);

    res.json({ success: true });

  } catch (error) {
    console.error('[PDF Delete] Error:', error);
    res.status(500).json({ error: 'Failed to delete PDF' });
  }
});

/**
 * POST /api/research/:idrssd/sources/:sourceId/download-pdf
 * Download a source as PDF (if it's already a PDF URL)
 */
router.post('/:idrssd/sources/:sourceId/download-pdf', async (req, res) => {
  try {
    const { idrssd, sourceId } = req.params;

    const source = await Source.findOne({ sourceId });
    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    // Check if the URL is a PDF
    if (!source.url.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({
        error: 'Source is not a PDF. Please download manually from your browser and upload it.'
      });
    }

    console.log(`[PDF Download from Source] Downloading PDF from: ${source.url}`);

    // Download the PDF
    const axios = require('axios');
    const response = await axios.get(source.url, {
      responseType: 'arraybuffer',
      timeout: 60000, // 60 second timeout
      maxContentLength: 50 * 1024 * 1024, // 50MB limit
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    // Save to disk
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const filename = `${timestamp}_${randomId}.pdf`;
    const bankPdfDir = path.join(PDFS_DIR, idrssd);
    await fs.mkdir(bankPdfDir, { recursive: true });
    const filePath = path.join(bankPdfDir, filename);

    await fs.writeFile(filePath, response.data);

    // Create PDF record
    const pdf = new PDF({
      pdfId: `pdf_${timestamp}_${randomId}`,
      idrssd,
      originalFilename: source.title + '.pdf' || 'download.pdf',
      storedFilename: filename,
      fileSize: response.data.length,
      sourceId: source.sourceId,
      sourceUrl: source.url,
      uploadType: 'from_source',
      description: source.preview
    });

    await pdf.save();

    console.log(`[PDF Download from Source] Saved PDF: ${pdf.pdfId}`);

    res.json({
      success: true,
      pdf: {
        id: pdf.pdfId,
        filename: pdf.originalFilename,
        size: pdf.fileSize,
        uploadedAt: pdf.uploadedAt
      }
    });

  } catch (error) {
    console.error('[PDF Download from Source] Error:', error);
    res.status(500).json({
      error: 'Failed to download PDF',
      details: error.message
    });
  }
});

module.exports = router;
