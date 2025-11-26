const path = require('path');
const fs = require('fs').promises;
const Anthropic = require('@anthropic-ai/sdk');
const Institution = require('../models/Institution');
const FinancialStatement = require('../models/FinancialStatement');
const BankMetadata = require('../models/BankMetadata');
const Source = require('../models/Source');
const AgentOrchestrator = require('./agentOrchestrator');
const modelResolver = require('./modelResolver');

const RESEARCH_DIR = path.join(__dirname, '../data/research');

/**
 * Prepare trends data from financial statements
 */
function prepareTrendsData(financialStatements) {
  return {
    periods: financialStatements.map(stmt => {
      // Format period as "YYYY Q#" (e.g., "2024 Q2")
      const date = new Date(stmt.reportingPeriod);
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-indexed
      const quarter = Math.floor(month / 3) + 1;
      const formattedPeriod = `${year} Q${quarter}`;

      // Extract loan portfolio data for asset composition chart
      const portfolio = stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.portfolio || {};
      const realEstate = portfolio.realEstate || {};
      const consumer = portfolio.consumer || {};
      const cni = portfolio.commercialAndIndustrial || {};
      const securities = stmt.balanceSheet?.assets?.earningAssets?.securities || {};
      const nonearning = stmt.balanceSheet?.assets?.nonearningAssets || {};

      // Calculate loan categories for asset composition
      const residentialMortgages = (realEstate.securedBy1To4Family?.revolvingOpenEnd || 0) +
        (realEstate.securedBy1To4Family?.closedEndFirstLiens || 0) +
        (realEstate.securedBy1To4Family?.closedEndJuniorLiens || 0);
      const commercialRealEstate = (realEstate.multifamily || 0) +
        (realEstate.nonfarmNonresidential?.ownerOccupied || 0) +
        (realEstate.nonfarmNonresidential?.otherNonfarmNonresidential || 0) +
        (realEstate.constructionAndLandDevelopment?.total || 0);
      const cAndI = (cni.usAddressees || 0) + (cni.nonUsAddressees || 0);
      const creditCards = consumer.creditCards || 0;
      const autoLoans = consumer.automobileLoans || 0;
      const otherConsumer = (consumer.otherRevolvingCredit || 0) + (consumer.otherConsumerLoans || 0);
      const otherBusiness = (portfolio.other?.agriculturalProduction || 0) +
        (portfolio.other?.allOtherLoans || 0) +
        (realEstate.farmland || 0);

      // Calculate total consumer and business lending
      const consumerLending = residentialMortgages + creditCards + autoLoans + otherConsumer;
      const businessLending = commercialRealEstate + cAndI + otherBusiness;

      return {
        period: formattedPeriod,
        date: stmt.reportingPeriod, // Keep raw date for sorting
        // Asset composition for stacked area chart
        assets: {
          total: stmt.balanceSheet?.assets?.totalAssets || 0,
          // Consumer loans (blue shades)
          residentialMortgages,
          creditCards,
          autoLoans,
          otherConsumer,
          // Business loans (green shades)
          commercialRealEstate,
          cAndI,
          otherBusiness,
          // Non-loan assets
          securities: (securities.availableForSale || 0) + (securities.heldToMaturity || 0) + (securities.equity || 0),
          cash: nonearning.cashAndDueFromBanks || 0,
          other: (nonearning.premisesAndFixedAssets || 0) + (nonearning.intangibleAssets || 0) +
            (nonearning.otherAssets || 0) + (nonearning.otherRealEstate || 0),
          // Aggregated for other charts
          consumerLending,
          businessLending
        },
        loans: stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.net || 0,
        deposits: stmt.balanceSheet?.liabilities?.deposits?.total || 0,
        equity: stmt.balanceSheet?.equity?.totalEquity || 0,
        // Income data for charts
        income: {
          netIncome: stmt.incomeStatement?.netIncome || 0,
          netInterestIncome: stmt.incomeStatement?.netInterestIncome || 0,
          // Interest income total for revenue breakdown chart
          interestIncome: stmt.incomeStatement?.interestIncome?.total || 0,
          // Non-interest income for revenue breakdown chart
          noninterestIncome: stmt.incomeStatement?.noninterestIncome?.total || 0,
          totalNoninterestIncome: stmt.incomeStatement?.noninterestIncome?.total || 0
        },
        // Expense data for expense breakdown chart
        expenses: {
          salariesAndBenefits: stmt.incomeStatement?.noninterestExpense?.salariesAndBenefits || 0,
          occupancy: stmt.incomeStatement?.noninterestExpense?.premisesExpense || 0,
          other: stmt.incomeStatement?.noninterestExpense?.other || 0,
          total: stmt.incomeStatement?.noninterestExpense?.total || 0
        },
        // FTE data
        fte: stmt.incomeStatement?.fullTimeEquivalentEmployees || 0,
        ratios: {
          nim: stmt.ratios?.netInterestMargin || 0,
          roe: stmt.ratios?.roe || 0,
          roa: stmt.ratios?.roa || 0,
          efficiencyRatio: stmt.ratios?.efficiencyRatio || 0,
          operatingLeverage: stmt.ratios?.operatingLeverage || null
        },
        // Include peer analysis for peer comparison charts
        peerAnalysis: stmt.peerAnalysis || null
      };
    })
  };
}

/**
 * Generate agent-based research report
 *
 * @param {string} idrssd - Bank IDRSSD
 * @param {string} sessionId - Optional session ID for approved sources
 * @param {object} options - Optional configuration
 * @param {function} options.onProgress - Progress callback for SSE: (event) => {}
 *   event: { stage, message, ...data }
 * @returns {Promise<object>} { success, report, fileName, error }
 */
async function generateAgentReport(idrssd, sessionId = null, options = {}) {
  const { onProgress } = options;

  // Helper to send progress updates
  const sendProgress = (stage, message, data = {}) => {
    if (onProgress) {
      onProgress({ stage, message, ...data });
    }
    console.log(`[Agent Report] ${stage}: ${message}`);
  };

  try {
    // Step 1: Fetch bank information
    sendProgress('init', 'Initializing agent research system...');

    const institution = await Institution.findOne({ idrssd });
    if (!institution) {
      throw new Error('Bank not found');
    }

    // Mark phase2 as in_progress
    try {
      const metadataForPhase = await BankMetadata.getOrCreate(idrssd, institution.name);
      await metadataForPhase.updateResearchPhase('phase2', 'in_progress', {
        startedAt: new Date()
      });
      console.log(`[Agent Report Service] Marked phase2 as in_progress for bank ${idrssd}`);
    } catch (phaseError) {
      console.error(`[Agent Report Service] Warning: Failed to update phase status:`, phaseError.message);
    }

    // Step 2: Fetch financial data
    sendProgress('fetching', 'Loading financial data...');

    const financialStatements = await FinancialStatement.find({ idrssd })
      .sort({ reportingPeriod: -1 })
      .limit(20);

    if (financialStatements.length === 0) {
      throw new Error('No financial data found for this bank');
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

    // Step 2.5: Load strategic priorities from BankMetadata (from Phase 3 insights extraction)
    sendProgress('preparing', 'Loading strategic priorities...');
    const metadata = await BankMetadata.findOne({ idrssd });
    let existingPriorities = [];
    let existingMetrics = [];
    let existingPartnerships = [];

    if (metadata && metadata.strategicInsights) {
      existingPriorities = metadata.strategicInsights.priorities || [];
      existingMetrics = metadata.strategicInsights.focusMetrics || [];
      existingPartnerships = metadata.strategicInsights.techPartnerships || [];
      console.log(`Loaded ${existingPriorities.length} strategic priorities from BankMetadata`);
    } else {
      console.log('No existing strategic priorities found in BankMetadata - will use web search fallback');
    }

    // Step 3: Check RAG document availability
    sendProgress('preparing', 'Checking RAG document library...');
    const ragDocumentCount = await require('../models/GroundingDocument').countDocuments({
      idrssd,
      processingStatus: 'completed'
    });
    console.log(`Found ${ragDocumentCount} documents in RAG for bank ${idrssd}`);

    // Step 4: Get approved sources if sessionId provided (legacy sources)
    let approvedSources = [];
    if (sessionId) {
      sendProgress('preparing', 'Loading research sources...');
      approvedSources = await Source.getApprovedBySession(sessionId);
      console.log(`Found ${approvedSources.length} approved sources for session ${sessionId}`);
    }

    // Step 5: Initialize and run the agent
    sendProgress('agent_init', 'Starting agent research phase...');

    const agent = new AgentOrchestrator({
      maxIterations: 15,
      maxTimeout: 600000, // 10 minutes
      onProgress: (event) => {
        if (event.type === 'milestone') {
          sendProgress('agent_milestone', event.milestone, { details: event.details });
        } else if (event.type === 'insight') {
          sendProgress('agent_insight', event.insight.title, {
            insight: event.insight
          });
        }
      }
    });

    // Build initial prompt for agent (includes strategic priorities, focus metrics, etc.)
    const agentPrompt = buildAgentPrompt(
      bankInfo,
      financialStatements.length,
      peerData,
      ragDocumentCount,
      existingPriorities,
      existingMetrics,
      existingPartnerships
    );

    const agentContext = {
      bankInfo,
      financialData: financialStatements,
      peerData: peerData,
      sessionId: sessionId,
      approvedSources: approvedSources,
      totalAssets: bankInfo.totalAssets
    };

    // Run the agent
    sendProgress('agent_running', 'Agent exploring financial data...');

    const agentResult = await agent.run(agentPrompt, agentContext);

    sendProgress('agent_complete', `Research complete: ${agentResult.insights.length} insights discovered`, {
      stats: agentResult.stats
    });

    // Step 6: Synthesize final report using insights
    sendProgress('synthesizing', 'Synthesizing final report from agent insights...');

    const fullReport = await synthesizeReport(
      agentResult,
      bankInfo,
      trendsData,
      peerData,
      approvedSources,
      financialStatements,
      sendProgress
    );

    // Step 7: Save report
    sendProgress('saving', 'Saving research report...');

    const timestamp = Date.now();
    const fileName = `${idrssd}_agent_${timestamp}.json`;
    const filePath = path.join(RESEARCH_DIR, fileName);

    // Extract web search sources for tracking
    const webSearchSources = extractWebSearchSources(agentResult);

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
      peerData,  // Include peer comparison data for presentation generation
      sessionId: sessionId || null,
      webSearchSources: webSearchSources
    };

    // Ensure directory exists
    await fs.mkdir(RESEARCH_DIR, { recursive: true });

    await fs.writeFile(filePath, JSON.stringify(reportData, null, 2));

    // Step 8: Complete - Update phase status
    try {
      const metadataForPhase = await BankMetadata.getOrCreate(idrssd, institution.name);
      await metadataForPhase.updateResearchPhase('phase2', 'completed', {
        reportFile: fileName,
        completedAt: new Date()
      });
      console.log(`[Agent Report Service] Marked phase2 as completed for bank ${idrssd}`);
    } catch (phaseError) {
      console.error(`[Agent Report Service] Warning: Failed to update phase status:`, phaseError.message);
    }

    sendProgress('complete', 'Agent-based report generated successfully', {
      report: reportData,
      fileName
    });

    return {
      success: true,
      report: reportData,
      fileName
    };

  } catch (error) {
    console.error('[Agent Report Service] Error:', error.message);
    console.error('[Agent Report Service] Stack:', error.stack);
    console.error('[Agent Report Service] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

    // Update phase status to failed
    try {
      const metadataForPhase = await BankMetadata.getOrCreate(idrssd, null);
      await metadataForPhase.updateResearchPhase('phase2', 'failed', {
        error: error.message,
        failedAt: new Date()
      });
      console.log(`[Agent Report Service] Marked phase2 as failed for bank ${idrssd}`);
    } catch (phaseError) {
      console.error(`[Agent Report Service] Warning: Failed to update phase status:`, phaseError.message);
    }

    sendProgress('error', `Error: ${error.message}`);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Build the agent prompt with strategic priorities and context
 */
function buildAgentPrompt(
  bankInfo,
  statementCount,
  peerData,
  ragDocumentCount,
  existingPriorities,
  existingMetrics,
  existingPartnerships
) {
  const strategicPrioritiesText = existingPriorities.length > 0
    ? `\n**EXISTING STRATEGIC PRIORITIES (from Phase 3 insights extraction):**
${existingPriorities.map((p, i) => `${i + 1}. ${p}`).join('\n')}

These priorities were previously extracted from documents in RAG. START with these as your foundation.`
    : '\n**No existing strategic priorities found.** You will need to discover them using RAG queries and web search.';

  const focusMetricsText = existingMetrics.length > 0
    ? `\n**KEY FOCUS METRICS (from Phase 3):** ${existingMetrics.join(', ')}`
    : '';

  const techPartnershipsText = existingPartnerships.length > 0
    ? `\n**KNOWN TECHNOLOGY PARTNERSHIPS (from Phase 3):** ${existingPartnerships.join(', ')}`
    : '';

  return `You are a financial research agent analyzing ${bankInfo.name}, a bank located in ${bankInfo.city}, ${bankInfo.state} with $${(bankInfo.totalAssets / 1000000).toFixed(0)}M in total assets.

Your mission is to conduct a comprehensive investigation of this bank's financial performance, strategic position, and future prospects. You have access to:
- ${statementCount} quarters of detailed financial data
- ${peerData ? `Peer analysis comparing to ${peerData.count} similar banks` : 'No peer comparison data'}
- ${ragDocumentCount} documents in RAG system (investor presentations, earnings transcripts, annual reports, analyst reports)
  **IMPORTANT:** Use the query_bank_documents tool to search these documents for specific information
- Web search capabilities for recent news and context${strategicPrioritiesText}${focusMetricsText}${techPartnershipsText}

**Your Research Process:**
1. **Start by analyzing CRITICAL financial metrics:** Always begin by analyzing "efficiencyRatio" and "operatingLeverage" together using analyze_financials. These are the most important metrics for understanding operational efficiency and scalability.
2. Analyze additional financial trends to identify notable patterns, strengths, and concerns
3. **STRATEGIC PRIORITIES - Use existing priorities as foundation:**
   ${existingPriorities.length > 0 ? `- START with the ${existingPriorities.length} strategic priorities listed above from Phase 3
   - Use query_bank_documents to get more details on each priority (e.g., "What details are available about [Priority Name]?")
   - Use web search to find recent updates, progress, and news about these specific priorities` : `- Use query_bank_documents to discover strategic priorities: "What are the bank's strategic priorities and key initiatives?"
   - Use web search if RAG doesn't provide sufficient information`}
4. Research and profile key executives (CEO, CFO, CIO/CTO, Head of AI, Head of Procurement, business line leaders)
5. Generate insights as you discover important findings
6. When you have sufficient information, signal completion

**CRITICAL METRIC INTERPRETATION GUIDANCE:**
- **Efficiency Ratio**: LOWER is better. Decreasing = improvement.
- **Operating Leverage**: HIGHER is better. Values > 1.0 = EXCELLENT (revenue growing faster than expenses).

**CRITICAL: ALWAYS COMPARE TO PEER GROUP PERFORMANCE**
When analyzing ANY trend or metric improvement:
- **NEVER present absolute changes alone** - Always include peer comparison
- **Example:** If efficiency ratio improved 250bp but peer average improved 400bp, the bank underperformed despite absolute improvement
- **Apply to ALL metrics:** Efficiency ratio, ROE, ROA, NIM, asset growth, operating leverage
- **Use generate_insight to capture peer-relative performance** - Include peer comparison in every insight about trends

Use your tools strategically to build a comprehensive understanding. Be thorough but efficient. When you've gathered sufficient insights, call complete_research.`;
}

/**
 * Synthesize the final report from agent insights
 */
async function synthesizeReport(
  agentResult,
  bankInfo,
  trendsData,
  peerData,
  approvedSources,
  financialStatements,
  sendProgress
) {
  // Build comprehensive sources list
  const allSources = [];
  let sourceIndex = 1;
  const sourceMap = new Map();

  // Add web search sources from agent
  if (agentResult.stats && agentResult.stats.webSearches && agentResult.stats.webSearches.length > 0) {
    agentResult.stats.webSearches.forEach(search => {
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

  // Format sources section
  const sourcesSection = allSources.length > 0 ? `
# Available Sources for Citation

Use these source numbers in your citations: [Source 1], [Source 2], [Source 3], etc.

${allSources.map(s => {
  let citation = `**[${s.number}] ${s.type}**`;
  if (s.title && s.url) {
    citation += `: [${s.title}](${s.url})`;
  } else if (s.title && !s.url) {
    citation += `: ${s.title}`;
  } else if (s.url) {
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

  // Build insights summary
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

  // Build synthesis prompt (abbreviated for brevity)
  const synthesisPrompt = `You have conducted extensive research on ${bankInfo.name}. Below are key findings you discovered during your investigation.

${insightsSummary}

${sourcesSection}

# Financial Data Summary
${JSON.stringify(trendsData, null, 2)}

${peerData ? `# Peer Analysis\n${JSON.stringify(peerData, null, 2)}` : ''}

---

Now synthesize these insights into a comprehensive, well-structured research report with proper citations.

**CRITICAL INSTRUCTION: PEER COMPARISON ANALYSIS**
When discussing ANY metric trend or improvement in the report:
- **NEVER present absolute changes alone** - Always include peer group comparison
- **Example:** "The bank's efficiency ratio improved 250 basis points from 68% to 65.5% over the past 5 years. However, the peer group average improved 400 basis points from 65% to 61% over the same period, indicating the bank underperformed peers despite absolute improvement."
- **Apply to ALL metrics:** Efficiency ratio, ROE, ROA, NIM, asset growth, loan growth, operating leverage
- **Frame conclusions correctly:** State both absolute performance AND relative performance vs peers
- **Use comparative language:** "outperformed peers", "lagged peer group", "kept pace with peers", "lost competitive ground"

**CRITICAL: INCLUDE VISUAL CHARTS**
The report MUST include charts to visualize key metrics and trends. Insert chart tags using this format: \`<chart:chart-type />\`

**Available Chart Types:**
- **Financial Performance Charts:**
  - \`<chart:net-income />\` - Net income trend over time (line chart)
  - \`<chart:net-income-yoy />\` - Year-over-year net income comparison
  - \`<chart:income-breakdown />\` - Revenue composition breakdown
  - \`<chart:net-interest-income />\` - Net interest income trend
  - \`<chart:expense-breakdown />\` - Expense composition
  - \`<chart:fte-trends />\` - Employee count trends

- **Ratio/Metric Charts:**
  - \`<chart:efficiency-ratio />\` - Efficiency ratio trend (LOWER is better)
  - \`<chart:roe />\` - Return on equity trend
  - \`<chart:nim />\` - Net interest margin trend
  - \`<chart:operating-leverage />\` - Operating leverage by quarter (HIGHER is better)

- **Balance Sheet Charts:**
  - \`<chart:asset-composition />\` - Asset composition over time (stacked column: Consumer, Business, Securities, Cash)
  - \`<chart:loan-portfolio />\` - Loan portfolio doughnut chart (consumer vs business)
  - \`<chart:loan-mix />\` - Detailed loan breakdown over time (stacked column: Residential, Cards, Auto, CRE, C&I, Other)

- **Peer Comparison Charts (PREFER THESE - they show competitive context):**
  - \`<chart:peer-efficiency />\` - Efficiency ratio vs peer average (with peer comparison context)
  - \`<chart:peer-roe />\` - ROE vs peer average
  - \`<chart:peer-nim />\` - NIM vs peer average
  - \`<chart:peer-operating-leverage />\` - Operating leverage vs peer average

**Chart Placement Strategy:**
- Place charts IMMEDIATELY after discussing the related metric or topic
- Use peer comparison charts (\`peer-*\`) when discussing competitive positioning
- Include 4-6 charts throughout the report in relevant sections
- Charts make data more accessible and professional

**Example Usage:**
\`\`\`
## Financial Performance Analysis

The bank reported net income of $1.2B in Q2 2025, representing a 15% increase year-over-year.

<chart:net-income />

When examining operational efficiency, the efficiency ratio improved from 68% to 65.5% over the past 5 years (250bp improvement). However, the peer group average improved from 65% to 61% (400bp improvement), indicating the bank underperformed peers despite absolute improvement.

<chart:peer-efficiency />
\`\`\`

**STORYTELLING STRUCTURE (3 parts):**
1. "Tell them what you'll tell them" → Executive Summary (SHORT - 3-4 key points)
2. "Tell them" → Detailed sections with charts
3. "Tell them what you told them" → Recommended Actions (what to DO)

**REPORT STRUCTURE:**

## 1. Executive Summary
Keep it SHORT - just 3-4 bullet points:
- **Who**: $XXB [type] bank in [location], focused on [differentiator] [Call Report: Q# YYYY]
- **Key Insight**: [Main financial finding with peer comparison] [Call Report: Q# YYYY]
- **Opportunity**: [One specific Anthropic use case tied to their business]

<chart:efficiency-ratio-peer /> (or most relevant chart)

## 2. Financial Performance
Detailed analysis with peer comparisons and charts [Call Report citations]

## 3. Strategic Position & Leadership
Management team, strategic priorities, technology initiatives [Source # citations]

## 4. Balance Sheet & Loan Portfolio
Asset composition, loan mix, deposit trends [Call Report citations]

## 5. Risk Assessment & Outlook
Risks, challenges, forward guidance from management [Source # citations]

## 6. Recommended Actions
NOT a summary - answer "What should we DO?"
- **Action 1**: [Verb] on [area] because [finding] → Expected outcome
- **Action 2**: [Verb] on [area] because [finding] → Expected outcome
- **Action 3**: [Verb] on [area] because [finding] → Expected outcome

## 7. Sources
(clickable links)

**SOURCE CITATION REQUIREMENTS:**
- **EVERY factual claim MUST have a citation** - no exceptions
- Financial data: [Call Report: Q# YYYY] (e.g., [Call Report: Q2 2025])
- Leadership info: [Source #] referencing the numbered source list
- Strategic info: [Source #] from earnings calls, investor presentations
- If information cannot be verified from sources, explicitly state "Not available in sources"
- Never make claims without backing them up with a source

Write in a professional, analytical tone suitable for investors and executives. REMEMBER: Include 4-6 charts throughout using the \`<chart:type />\` format.`;

  let fullReport = '';

  // Use Claude to synthesize the report
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const latestModel = await modelResolver.getLatestKitModel();

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
      sendProgress('synthesis_stream', 'Generating report...', {
        textChunk: chunk
      });
    }
  }

  return fullReport;
}

/**
 * Extract web search sources from agent result
 */
function extractWebSearchSources(agentResult) {
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

  return webSearchSources;
}

module.exports = {
  generateAgentReport
};
