const Anthropic = require('@anthropic-ai/sdk');
const Source = require('../models/Source');
const AgentMemoryService = require('./agentMemoryService');
const modelResolver = require('./modelResolver');

/**
 * AgentOrchestrator
 *
 * Implements an agent-based approach to bank research and analysis.
 * The agent has access to tools and can adaptively explore financial data,
 * search for additional context, and query source documents.
 */
class AgentOrchestrator {
  constructor(config = {}) {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    this.maxIterations = config.maxIterations || 15;
    this.maxTimeout = config.maxTimeout || 600000; // 10 minutes
    this.model = config.model || modelResolver.getModelSync();
    
    // Initialize model asynchronously if not provided in config
    if (!config.model) {
      this.initializeModel();
    }

    // Agent state
    this.state = {
      iterations: 0,
      startTime: null,
      exploredAreas: [],
      generatedInsights: [],
      queriedDocuments: [],  // Array to store full document info for citations
      webSearches: [],
      milestones: [],
      memory: {
        loaded: false,
        patterns: [],
        searchPatterns: [],
        documentPatterns: [],
        analysisStrategies: []
      },
      bankInfo: null,  // Store bank info for memory recording
      totalAssets: null
    };

    // Progress callback
    this.onProgress = config.onProgress || (() => {});
  }

  async initializeModel() {
    try {
      const latestModel = await modelResolver.getLatestSonnetModel();
      this.model = latestModel;
      console.log(`AgentOrchestrator initialized with model: ${this.model}`);
    } catch (error) {
      console.error('Error initializing model:', error.message);
    }
  }

  /**
   * Tool definitions for the agent
   */
  getTools() {
    return [
      {
        name: 'analyze_financials',
        description: 'Perform deep analysis on specific financial metrics across quarters. Use this to identify trends, anomalies, and patterns in the bank\'s financial performance. Returns detailed analysis of the requested metrics. **CRITICAL:** Always analyze "efficiencyRatio" and "operatingLeverage" together when evaluating operational efficiency, cost management, or technology investments. These are key metrics for understanding scalability and operational discipline.',
        input_schema: {
          type: 'object',
          properties: {
            metrics: {
              type: 'array',
              items: { type: 'string' },
              description: 'Financial metrics to analyze. Available metrics include: "efficiencyRatio" (lower is better), "operatingLeverage" (higher is better - indicates revenue growing faster than expenses), "netInterestMargin", "returnOnAssets", "returnOnEquity", "nonPerformingLoans". **ALWAYS include "efficiencyRatio" and "operatingLeverage" when analyzing operational efficiency or technology investments.**'
            },
            quarters: {
              type: 'number',
              description: 'Number of recent quarters to analyze (default: 8)'
            },
            analysis_type: {
              type: 'string',
              enum: ['trend', 'peer_comparison', 'detailed', 'anomaly_detection'],
              description: 'Type of analysis to perform'
            }
          },
          required: ['metrics', 'analysis_type']
        }
      },
      {
        name: 'search_web',
        description: 'Search the web for specific information about the bank. Use this to find recent news, strategic initiatives, management changes, executive profiles, executive photos, or market context. **CRITICAL FOR INVESTOR PRESENTATIONS:** When searching for investor presentations or earnings materials, first find the bank\'s investor relations (IR) website by searching "[Bank Name] investor relations", then search within that site for "events" or "presentations" to find PDF investor presentations or earnings call PDF supplements. Look specifically for PDF files from the IR site. **IMPORTANT:** Use this tool extensively to find leadership information, executive headshots, and strategic details that financial data cannot provide. Returns search results with URLs and snippets.',
        input_schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (be specific and include bank name)'
            },
            focus: {
              type: 'string',
              enum: ['news', 'strategy', 'leadership', 'technology', 'risk', 'general'],
              description: 'Focus area for the search. Use "leadership" when searching for executives, their backgrounds, photos, or management team information.'
            }
          },
          required: ['query', 'focus']
        }
      },
      {
        name: 'query_documents',
        description: 'Ask specific questions about uploaded source documents (PDFs, transcripts, reports). Use this to extract detailed information, quotes, or specific data points from sources. **PRIORITY USE:** Always query documents FIRST before doing web searches - they often contain the most current strategic initiatives, technology programs, and management commentary. Earnings transcripts and investor presentations are goldmines for strategic information. Returns relevant excerpts and citations.',
        input_schema: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'Specific question to ask about the documents. Examples: "What strategic initiatives are mentioned?", "What technology programs or digital transformation efforts are discussed?", "What are the key strategic priorities according to management?", "What specific technology investments or partnerships are mentioned?"'
            },
            source_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: specific source IDs to query (if empty, searches all approved sources)'
            },
            category: {
              type: 'string',
              enum: ['investorPresentation', 'earningsTranscript', 'strategyAnalysis', 'analystReports', 'all'],
              description: 'Category of sources to query'
            }
          },
          required: ['question', 'category']
        }
      },
      {
        name: 'generate_insight',
        description: 'Record a key insight or finding that should be included in the final report. Use this to capture important discoveries, trends, or conclusions as you explore the data. **CRITICAL:** When generating insights about strategic initiatives, technology investments, or operational efficiency, always include: (1) Financial metric assessment (efficiency ratio, operating leverage, growth metrics), (2) Specific recommendations on how AI, agents, and digital labor could help the initiative BUILD OPERATING LEVERAGE - covering BOTH cost savings (expense reduction) AND revenue growth opportunities, (3) Potential efficiency gains, cost reductions, AND revenue expansion opportunities, (4) Operating leverage impact assessment. These insights will be synthesized into the final report.',
        input_schema: {
          type: 'object',
          properties: {
            insight_type: {
              type: 'string',
              enum: ['financial_trend', 'strategic_initiative', 'risk_factor', 'competitive_position', 'leadership_change', 'technology_investment', 'market_opportunity'],
              description: 'Type of insight. For "strategic_initiative" and "technology_investment" insights, always include: (1) Financial metric assessment, (2) How AI/agents/digital labor could help, (3) Efficiency/cost impact analysis.'
            },
            title: {
              type: 'string',
              description: 'Brief title for the insight (1-10 words)'
            },
            content: {
              type: 'string',
              description: 'Detailed insight content with supporting evidence. For strategic initiatives and technology investments, include: (1) financial metric assessment, (2) AI/agents/digital labor recommendations covering BOTH cost savings (expense reduction) AND revenue growth opportunities to build operating leverage, (3) potential efficiency/cost impact AND revenue expansion opportunities, (4) operating leverage impact assessment.'
            },
            evidence: {
              type: 'array',
              items: { type: 'string' },
              description: 'Source IDs or data points that support this insight'
            },
            importance: {
              type: 'string',
              enum: ['critical', 'high', 'medium', 'low'],
              description: 'Importance level of this insight'
            }
          },
          required: ['insight_type', 'title', 'content', 'importance']
        }
      },
      {
        name: 'complete_research',
        description: 'Signal that research is complete and ready for final report synthesis. Use this when you have gathered sufficient insights and analysis to produce a comprehensive report.',
        input_schema: {
          type: 'object',
          properties: {
            summary: {
              type: 'string',
              description: 'Brief summary of what was discovered (2-3 sentences)'
            },
            confidence: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'Confidence in the completeness of research'
            }
          },
          required: ['summary', 'confidence']
        }
      }
    ];
  }

  /**
   * Execute a tool call
   */
  async executeTool(toolName, toolInput, context) {
    this.state.iterations++;

    // Check limits
    if (this.state.iterations > this.maxIterations) {
      throw new Error('Max iterations reached');
    }
    if (Date.now() - this.state.startTime > this.maxTimeout) {
      throw new Error('Timeout reached');
    }

    switch (toolName) {
      case 'analyze_financials':
        return await this.analyzeFinancials(toolInput, context);

      case 'search_web':
        return await this.searchWeb(toolInput, context);

      case 'query_documents':
        return await this.queryDocuments(toolInput, context);

      case 'generate_insight':
        return await this.generateInsight(toolInput, context);

      case 'complete_research':
        return await this.completeResearch(toolInput, context);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Analyze financial metrics
   */
  async analyzeFinancials(input, context) {
    const { metrics, quarters = 8, analysis_type } = input;
    const { financialData, peerData } = context;

    this.onProgress({
      type: 'milestone',
      milestone: `Analyzing ${metrics.join(', ')} (${analysis_type})`,
      details: `Examining ${quarters} quarters of data`
    });

    // Get relevant quarters (financialData is already sorted newest first)
    const recentData = financialData.slice(0, Math.min(quarters, financialData.length));

    let analysis = {
      metrics: metrics,
      analysis_type: analysis_type,
      quarters_analyzed: recentData.length,
      findings: []
    };

    for (const metric of metrics) {
      // Handle metric name variations (e.g., "efficiencyRatio" vs "efficiency")
      const metricKey = metric === 'efficiency' ? 'efficiencyRatio' : 
                       metric === 'operating-leverage' || metric === 'operatingLeverage' ? 'operatingLeverage' :
                       metric;
      
      const values = recentData.map(q => ({
        period: q.reportingPeriod,
        value: q.ratios?.[metricKey] || q.ratios?.[metric] || q[metric]
      })).filter(v => v.value != null);

      if (values.length === 0) continue;

      const finding = {
        metric: metric,
        current: values[0]?.value,
        historical: values,
        trend: this.calculateTrend(values)
      };

      // Add peer comparison if requested
      if (analysis_type === 'peer_comparison' && peerData) {
        // peerData is an object with peerAverages, not an array
        finding.peer_average = peerData.peerAverages?.[metric];
        finding.peer_count = peerData.count;
        finding.vs_peer = finding.current && finding.peer_average
          ? ((finding.current - finding.peer_average) / finding.peer_average * 100).toFixed(2) + '%'
          : 'N/A';
      }

      // Detect anomalies if requested
      if (analysis_type === 'anomaly_detection') {
        finding.anomalies = this.detectAnomalies(values);
      }

      analysis.findings.push(finding);
    }

    this.state.exploredAreas.push(`financial_analysis:${metrics.join(',')}`);

    // Record successful analysis strategy in memory
    if (this.state.memory.loaded && this.state.bankInfo && this.state.totalAssets && analysis) {
      const insightsGenerated = this.state.generatedInsights.length;
      
      AgentMemoryService.recordAnalysisStrategy(
        this.state.bankInfo,
        this.state.totalAssets,
        `Analyze ${metrics.join(', ')} with ${analysis_type} approach`,
        metrics,
        insightsGenerated
      ).catch(err => {
        console.error('[Agent Memory] Error recording analysis strategy:', err);
        // Don't fail the analysis - just log error
      });
    }

    return {
      success: true,
      analysis: analysis,
      message: `Analyzed ${metrics.length} metrics across ${recentData.length} quarters`
    };
  }

  /**
   * Search the web
   */
  async searchWeb(input, context) {
    const { query, focus } = input;
    const { bankInfo } = context;

    this.onProgress({
      type: 'milestone',
      milestone: `Web search: ${focus}`,
      details: query
    });

    // Use Claude's web search capability
    const searchMessage = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 12000,  // Must be greater than budget_tokens (10000)
      thinking: {
        type: 'enabled',
        budget_tokens: 10000
      },
      system: `You are a financial research assistant. Search for information about ${bankInfo.name} (${bankInfo.city}, ${bankInfo.state}).`,
      messages: [{
        role: 'user',
        content: `Search the web for: ${query}\n\nFocus area: ${focus}\n\nProvide a structured summary of the top 3-5 most relevant and recent results with URLs.`
      }],
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search'
      }]
    });

    const searchResults = {
      query: query,
      focus: focus,
      results: [],
      sources: [],
      sourceDetails: [] // Structured source information
    };

    // Extract search results from the response
    if (searchMessage.content) {
      for (const block of searchMessage.content) {
        if (block.type === 'text') {
          searchResults.summary = block.text;
          
          // Try to extract structured source information from the summary text
          // Look for patterns like "Title - URL" or markdown links [Title](URL)
          const markdownLinkRegex = /\[([^\]]+)\]\(([^\)]+)\)/g;
          const titleUrlRegex = /([^-\n]+)\s*-\s*(https?:\/\/[^\s\n]+)/g;
          
          let match;
          // Extract markdown links
          while ((match = markdownLinkRegex.exec(block.text)) !== null) {
            const title = match[1].trim();
            const url = match[2].trim();
            if (url.startsWith('http')) {
              searchResults.sources.push(url);
              searchResults.sourceDetails.push({
                url: url,
                title: title,
                snippet: null
              });
            }
          }
          
          // Extract title - URL patterns
          while ((match = titleUrlRegex.exec(block.text)) !== null) {
            const title = match[1].trim();
            const url = match[2].trim();
            if (url.startsWith('http') && !searchResults.sources.includes(url)) {
              searchResults.sources.push(url);
              searchResults.sourceDetails.push({
                url: url,
                title: title,
                snippet: null
              });
            }
          }
        } else if (block.type === 'tool_result' && block.content) {
          // Extract URLs from tool results
          try {
            const urls = block.content.match(/https?:\/\/[^\s\)]+/g) || [];
            urls.forEach(url => {
              if (!searchResults.sources.includes(url)) {
                searchResults.sources.push(url);
                // Try to extract title from surrounding context
                const urlIndex = block.content.indexOf(url);
                const beforeUrl = block.content.substring(Math.max(0, urlIndex - 100), urlIndex);
                const afterUrl = block.content.substring(urlIndex + url.length, urlIndex + url.length + 200);
                
                // Try to find a title (text before the URL, or in quotes)
                let title = null;
                const titleMatch = beforeUrl.match(/"([^"]+)"/) || beforeUrl.match(/'([^']+)'/);
                if (titleMatch) {
                  title = titleMatch[1];
                } else {
                  // Use the last sentence or phrase before the URL
                  const sentences = beforeUrl.split(/[.!?]\s+/);
                  if (sentences.length > 0) {
                    title = sentences[sentences.length - 1].trim().substring(0, 100);
                  }
                }
                
                searchResults.sourceDetails.push({
                  url: url,
                  title: title || url, // Fallback to URL if no title found
                  snippet: afterUrl.substring(0, 200).trim() || null
                });
              }
            });
          } catch (e) {
            console.error('Error extracting URLs:', e);
          }
        }
      }
    }
    
    // If we have sources but no details, create details from URLs
    if (searchResults.sources.length > 0 && searchResults.sourceDetails.length === 0) {
      searchResults.sourceDetails = searchResults.sources.map(url => ({
        url: url,
        title: url, // Will be improved later if possible
        snippet: null
      }));
    }

    this.state.webSearches.push(searchResults);
    this.state.exploredAreas.push(`web_search:${focus}`);

    // Record successful search pattern in memory
    if (this.state.memory.loaded && this.state.bankInfo && this.state.totalAssets) {
      const sourcesFound = searchResults.sources.length;
      const workedWell = sourcesFound > 0; // Consider it successful if sources found
      
      AgentMemoryService.recordSuccessfulSearch(
        this.state.bankInfo,
        this.state.totalAssets,
        query,
        focus,
        sourcesFound,
        workedWell
      ).catch(err => {
        console.error('[Agent Memory] Error recording search:', err);
        // Don't fail the search - just log error
      });
    }

    return {
      success: true,
      results: searchResults,
      sources: searchResults.sources,
      message: `Found ${searchResults.sources.length} sources about ${focus}`
    };
  }

  /**
   * Query source documents
   */
  async queryDocuments(input, context) {
    const { question, source_ids = [], category = 'all' } = input;
    const { sessionId } = context;

    this.onProgress({
      type: 'milestone',
      milestone: `Querying ${category} documents`,
      details: question
    });

    // Get relevant sources - handle both Source model documents and PDF objects
    let sources = [];
    
    // Get sources from Source model (if source_ids specified or if querying by category)
    if (source_ids.length > 0) {
      const dbSources = await Source.getByIds(source_ids);
      sources.push(...dbSources);
    } else if (sessionId) {
      // Get all approved sources for session
      const allSources = context.approvedSources || await Source.getApprovedBySession(sessionId);
      
      // Filter by category
      if (category === 'all') {
        sources = allSources;
      } else {
        sources = allSources.filter(s => s.category === category);
      }
    }

    // Separate PDF sources from regular sources
    const pdfSources = sources.filter(s => s.isPDF && s.pdfObject);
    const regularSources = sources.filter(s => !s.isPDF);

    // For PDF sources, we need to extract content using Claude
    const pdfContext = [];
    if (pdfSources.length > 0) {
      this.onProgress({
        type: 'milestone',
        milestone: `Reading ${pdfSources.length} PDF document(s)`,
        details: pdfSources.map(p => p.title).join(', ')
      });

      const fs = require('fs').promises;
      const PDF = require('../models/PDF');

      for (const pdfSource of pdfSources) {
        try {
          const pdf = pdfSource.pdfObject;
          const pdfPath = pdf.getFilePath();
          const pdfData = await fs.readFile(pdfPath);
          const base64Data = pdfData.toString('base64');

          // Use Claude to extract relevant content from PDF
          const pdfQueryMessage = await this.anthropic.messages.create({
            model: this.model,
            max_tokens: 12000,  // Must be greater than budget_tokens (10000)
            thinking: {
              type: 'enabled',
              budget_tokens: 10000
            },
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: {
                    type: 'base64',
                    media_type: 'application/pdf',
                    data: base64Data
                  }
                },
                {
                  type: 'text',
                  text: `Extract and summarize the content most relevant to this question: ${question}\n\nProvide a concise summary (under 2000 characters) of the key information from this PDF that answers the question. Include specific quotes, data points, or program names mentioned.`
                }
              ]
            }]
          });

          const pdfContent = pdfQueryMessage.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n');

          pdfContext.push({
            title: pdfSource.title,
            content: pdfContent
          });

          console.log(`Extracted ${pdfContent.length} characters from PDF: ${pdfSource.title}`);
        } catch (error) {
          console.error(`Error reading PDF ${pdfSource.title}:`, error);
          // Continue with other PDFs even if one fails
        }
      }
    }

    // Filter regular sources to those with content
    const regularSourcesWithContent = regularSources.filter(s =>
      s.fetchStatus === 'fetched' && s.content && s.content.length > 100
    );

    // Combine all sources
    const allSourcesWithContent = [
      ...regularSourcesWithContent.map(s => ({ title: s.title, content: s.content })),
      ...pdfContext
    ];

    if (allSourcesWithContent.length === 0) {
      return {
        success: false,
        message: `No sources available for category: ${category}`,
        answer: null
      };
    }

    // Build context from all sources
    const sourceContext = allSourcesWithContent.map((s, idx) =>
      `[Source ${idx + 1}: ${s.title}]\n${s.content.substring(0, 3000)}...\n`
    ).join('\n\n');

    // Query using Claude with combined context
    const queryMessage = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 12000,  // Must be greater than budget_tokens (10000)
      thinking: {
        type: 'enabled',
        budget_tokens: 10000
      },
      messages: [{
        role: 'user',
        content: `Based on the following source documents (including PDFs), answer this question:\n\n${question}\n\n---\n\n${sourceContext}\n\nProvide a detailed answer with specific citations to the sources (reference by Source number).`
      }]
    });

    const answer = queryMessage.content.find(c => c.type === 'text')?.text || '';

    // Track queried documents with full info for citations
    const documentQuery = {
      question: question,
      category: category,
      documents: [
        ...regularSourcesWithContent.map(s => ({
          id: s.sourceId,
          title: s.title,
          category: s.category,
          url: s.url,
          publishDate: s.publishDate,
          type: 'source'
        })),
        ...pdfSources.map(s => ({
          id: s.sourceId,
          title: s.title,
          category: s.category,
          url: s.url || `pdf://${s.sourceId}`,
          publishDate: s.date,
          type: 'pdf'
        }))
      ]
    };

    this.state.queriedDocuments.push(documentQuery);
    this.state.exploredAreas.push(`document_query:${category}`);

    // Record successful document query pattern in memory
    if (this.state.memory.loaded && this.state.bankInfo && this.state.totalAssets) {
      const relevantResults = answer ? 1 : 0; // Consider successful if we got an answer
      const workedWell = answer && answer.length > 50; // Meaningful answer
      
      AgentMemoryService.recordSuccessfulDocumentQuery(
        this.state.bankInfo,
        this.state.totalAssets,
        question,
        category,
        relevantResults,
        workedWell
      ).catch(err => {
        console.error('[Agent Memory] Error recording document query:', err);
        // Don't fail the query - just log error
      });
    }

    return {
      success: true,
      answer: answer,
      sources_queried: [
        ...regularSourcesWithContent.map(s => ({
          id: s.sourceId,
          title: s.title,
          category: s.category
        })),
        ...pdfSources.map(s => ({
          id: s.sourceId,
          title: s.title,
          category: s.category
        }))
      ],
      message: `Queried ${allSourcesWithContent.length} ${category} source(s) (${regularSourcesWithContent.length} documents, ${pdfSources.length} PDFs)`
    };
  }

  /**
   * Generate and store an insight
   */
  async generateInsight(input, context) {
    const { insight_type, title, content, evidence = [], importance } = input;

    const insight = {
      type: insight_type,
      title: title,
      content: content,
      evidence: evidence,
      importance: importance,
      timestamp: new Date()
    };

    this.state.generatedInsights.push(insight);

    this.onProgress({
      type: 'insight',
      insight: insight
    });

    return {
      success: true,
      message: `Recorded ${importance} importance insight: ${title}`,
      insights_count: this.state.generatedInsights.length
    };
  }

  /**
   * Complete research phase
   */
  async completeResearch(input, context) {
    const { summary, confidence } = input;

    this.onProgress({
      type: 'milestone',
      milestone: 'Research phase complete',
      details: summary
    });

    return {
      success: true,
      complete: true,
      summary: summary,
      confidence: confidence,
      stats: {
        iterations: this.state.iterations,
        insights: this.state.generatedInsights.length,
        areas_explored: this.state.exploredAreas.length,
        documents_queried: this.state.queriedDocuments.size,
        web_searches: this.state.webSearches.length
      }
    };
  }

  /**
   * Load relevant memories for the agent
   */
  async loadMemories(context) {
    if (this.state.memory.loaded) {
      return; // Already loaded
    }

    const bankInfo = context.bankInfo;
    const totalAssets = context.totalAssets || (context.financialData?.[0]?.balanceSheet?.assets?.totalAssets || 0);

    this.state.bankInfo = bankInfo;
    this.state.totalAssets = totalAssets;

    try {
      // Load relevant memories
      const memories = await AgentMemoryService.getRelevantMemories(bankInfo, totalAssets);
      this.state.memory.patterns = memories;
      
      // Load specific pattern types
      this.state.memory.searchPatterns = await AgentMemoryService.getSearchPatterns(bankInfo, totalAssets);
      this.state.memory.documentPatterns = await AgentMemoryService.getDocumentQueryPatterns(bankInfo, totalAssets);
      this.state.memory.analysisStrategies = await AgentMemoryService.getAnalysisStrategies(bankInfo, totalAssets);
      
      this.state.memory.loaded = true;
      
      console.log(`[Agent Memory] Loaded ${memories.length} relevant patterns for ${bankInfo.name}`);
    } catch (error) {
      console.error('[Agent Memory] Error loading memories:', error);
      // Continue without memory - don't fail the agent
    }
  }

  /**
   * Run the agent
   */
  async run(initialPrompt, context) {
    this.state.startTime = Date.now();

    // Load relevant memories before starting
    await this.loadMemories(context);

    // Build memory context if available
    let memoryContext = '';
    if (this.state.memory.loaded && this.state.memory.patterns.length > 0) {
      memoryContext = AgentMemoryService.buildMemoryContext(this.state.memory.patterns);
    }

    const messages = [{
      role: 'user',
      content: initialPrompt + memoryContext
    }];

    let continueLoop = true;

    while (continueLoop && this.state.iterations < this.maxIterations) {
      // Check timeout
      if (Date.now() - this.state.startTime > this.maxTimeout) {
        throw new Error('Agent timeout reached');
      }

      // Call Claude with tools
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 12000,  // Must be greater than budget_tokens (10000)
        thinking: {
          type: 'enabled',
          budget_tokens: 10000
        },
        tools: this.getTools(),
        messages: messages
      });

      // Add assistant response to messages
      messages.push({
        role: 'assistant',
        content: response.content
      });

      // Check for tool use
      const toolUses = response.content.filter(c => c.type === 'tool_use');

      if (toolUses.length === 0) {
        // No more tools to use - agent is done or stuck
        const textContent = response.content.filter(c => c.type === 'text').map(c => c.text).join('\n');

        if (textContent.toLowerCase().includes('complete') ||
            textContent.toLowerCase().includes('finished')) {
          continueLoop = false;
        } else {
          // Agent might be stuck - force completion
          console.log('Agent appears stuck, forcing completion');
          continueLoop = false;
        }
        break;
      }

      // Execute tools
      const toolResults = [];

      for (const toolUse of toolUses) {
        try {
          const result = await this.executeTool(
            toolUse.name,
            toolUse.input,
            context
          );

          // Check if research is complete
          if (toolUse.name === 'complete_research' && result.complete) {
            continueLoop = false;
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result)
          });
        } catch (error) {
          console.error(`Tool execution error (${toolUse.name}):`, error);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({
              success: false,
              error: error.message
            }),
            is_error: true
          });
        }
      }

      // Add tool results to messages
      messages.push({
        role: 'user',
        content: toolResults
      });
    }

    // Return final state
    return {
      insights: this.state.generatedInsights,
      exploredAreas: this.state.exploredAreas,
      stats: {
        iterations: this.state.iterations,
        duration: Date.now() - this.state.startTime,
        documentsQueried: this.state.queriedDocuments,
        webSearches: this.state.webSearches
      },
      messages: messages
    };
  }

  /**
   * Helper: Calculate trend from time series
   */
  calculateTrend(values) {
    if (values.length < 2) return 'insufficient_data';

    const recent = values.slice(0, Math.min(4, values.length));
    const older = values.slice(-Math.min(4, values.length));

    const recentAvg = recent.reduce((sum, v) => sum + v.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, v) => sum + v.value, 0) / older.length;

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (Math.abs(change) < 2) return 'stable';
    return change > 0 ? 'improving' : 'declining';
  }

  /**
   * Helper: Detect anomalies in time series
   */
  detectAnomalies(values) {
    if (values.length < 4) return [];

    const mean = values.reduce((sum, v) => sum + v.value, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v.value - mean, 2), 0) / values.length
    );

    return values
      .filter(v => Math.abs(v.value - mean) > 2 * stdDev)
      .map(v => ({
        period: v.period,
        value: v.value,
        deviation: ((v.value - mean) / stdDev).toFixed(2) + 'σ'
      }));
  }
}

module.exports = AgentOrchestrator;
