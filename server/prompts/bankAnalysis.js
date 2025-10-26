/**
 * Editable prompt templates for AI-powered bank analysis
 * Modify these prompts to adjust the analysis style and focus
 */

module.exports = {
  /**
   * System prompt - defines the AI's role and expertise
   */
  systemPrompt: `You are an expert banking industry analyst with deep knowledge of:
- Commercial and retail banking operations
- Financial statement analysis and accounting principles
- Regulatory requirements (Basel III, Dodd-Frank, etc.)
- Market trends and competitive dynamics
- Risk management and credit analysis

Your role is to analyze bank financial data, identify meaningful trends, assess strategic positioning,
and provide actionable insights for investors, analysts, and banking professionals.

Be specific, data-driven, and balanced in your assessments. Highlight both strengths and concerns.
Use industry terminology appropriately but explain complex concepts clearly.`,

  /**
   * Main analysis prompt - structures the overall research task
   */
  analysisPrompt: `Analyze the financial performance and strategic positioning of {bankName} (IDRSSD: {idrssd}).

**Bank Information:**
- Name: {bankName}
- Location: {city}, {state}
- Website: {website}
- Latest Reporting Period: {latestPeriod}
- Total Assets: {totalAssets}

**Your Task:**
1. Review all provided financial trend data (assets, lending portfolio, income, ratios)
2. **PRIORITY RESEARCH - Track your findings for the Research Checklist:**
   - Search for recent investor presentations (last 12 months)
   - Search for earnings call transcripts
   - Search for business interviews with C-suite executives
   - Search for major news stories (last 3 months)
   - Search for evidence of AI projects, partnerships, or initiatives
3. Search for additional context: recent news articles about this bank (last 6 months)
4. Find and analyze their latest investor presentation or earnings materials
5. **Search job postings** to understand hiring strategy:
   - Search: "{bankName} jobs LinkedIn" and "{bankName} careers"
   - Focus on: Volume of openings, departments hiring, tech roles and stack
   - Look for patterns in job titles, required skills, and technologies mentioned
5. Identify the bank's strategic priorities and business model focus
6. Generate a comprehensive research report with embedded visualizations

**Available Custom Tags:**
You can embed interactive charts and components in your report using these custom tags:

**Chart Tags:**
- \`<chart:asset-composition />\` - Shows asset mix over time (consumer lending, business lending, securities, cash, other)
- \`<chart:loan-portfolio />\` - Detailed lending portfolio breakdown (consumer vs business with subcategories)
- \`<chart:net-income />\` - Net income trends by quarter and year
- \`<chart:net-income-yoy />\` - Year-over-year net income comparison by quarter (each year as separate line)
- \`<chart:income-breakdown />\` - Interest income vs. non-interest income breakdown
- \`<chart:net-interest-income />\` - Net interest income trends by quarter and year
- \`<chart:expense-breakdown />\` - Operating expenses by category (salaries, premises, other)
- \`<chart:fte-trends />\` - Full-time equivalent employee count over time
- \`<chart:efficiency-ratio />\` - Efficiency ratio over time
- \`<chart:roe />\` - Return on equity trends
- \`<chart:nim />\` - Net interest margin trends
- \`<chart:operating-leverage />\` - Operating leverage (YoY) analysis
- \`<chart:peer-efficiency />\` - Efficiency ratio comparison with peer banks (column chart)
- \`<chart:peer-roe />\` - ROE comparison with peer banks (column chart)
- \`<chart:peer-nim />\` - Net interest margin comparison with peer banks (column chart)
- \`<chart:peer-operating-leverage />\` - Operating leverage comparison with peer banks (column chart)

**Leadership Profile Tag:**
- Use this custom tag for each executive in the Leadership section:
  <leader name="John Doe" title="Chief Executive Officer" image="https://example.com/photo.jpg">Brief bio and background...</leader>

  * Write the tag directly in your response (NOT in a code block or with backticks)
  * Search for professional headshots (LinkedIn, company website, press photos)
  * Only include image URL if you find a professional headshot
  * Keep bio concise (2-3 sentences)

**Important:** Use these chart tags throughout your analysis when discussing relevant metrics. Place them right after the paragraph where you discuss that metric. For example:
"The bank's asset composition has shifted significantly toward business lending..."
<chart:asset-composition />

**Citation Requirements:**
You MUST cite all claims with inline references:
- For financial data from provided statements: Use [Call Report: Q# YYYY] format
  Example: "Total assets grew 15% year-over-year [Call Report: Q2 2025]"
- For web search results: Use [Source #] format and list all sources at end
  Example: "The CEO announced a new digital strategy [Source 1]"
- Always cite specific data points, news, quotes, and strategic information
- Include a "Sources" section at the end listing all web sources with full URLs

**Formatting Guidelines:**
- Use bullet format "• **Label**: Description" ONLY within bulleted lists
- For section subsections, use "### Subsection Title" followed by regular paragraphs
- Do NOT start regular paragraphs with "**Bold Text**: " - this creates formatting issues
- Keep section flow natural with proper headings and regular paragraph text

**Report Structure:**
# Executive Summary
- Key findings (3-5 bullet points with citations, using "• **Label**: Description" format)
- Overall assessment of financial health
- **Peer Performance Snapshot:** How does the bank rank vs. its 20 peer banks on key metrics? (1-2 sentences)
- Strategic positioning

# Asset and Lending Trends
Provide 2-3 paragraphs analyzing the bank's asset composition and lending strategy.

Use subsections for clarity:
### Business Lending
Regular paragraph describing business lending trends...

**IMPORTANT:** If "Other Specialized Loans" is >15% of total loans, add a subsection:
### Other Specialized Loans
This category typically includes securities-based lending (margin loans, prime brokerage), loans to financial institutions, and specialized institutional finance. Search for information about the bank's specialized lending operations. Investment banks often have 80-100% here, while consumer banks have <10%. Explain what likely comprises this based on the bank's business model.

### Consumer Lending
Regular paragraph describing consumer lending trends...

Include relevant charts: <chart:asset-composition /> and <chart:loan-portfolio />

# Income and Profitability Analysis
Write flowing paragraphs that analyze revenue, expenses, and profitability. Use subsections like:

### Revenue Trends
Analyze the composition and trends of revenue sources. Discuss the balance between net interest income (core lending operations) and non-interest income (fees, services). Is the bank reliant on interest income or diversified? How has this mix evolved over time? [Include citations]

**Key chart to use:** <chart:income-breakdown /> - Shows interest vs non-interest income

### Year-over-Year Performance
Compare net income performance across years by quarter. Are there consistent seasonal patterns? Is the current year trending ahead or behind prior years? What does this reveal about momentum and growth trajectory?

**Key chart to use:** <chart:net-income-yoy /> - Year-over-year quarterly net income comparison

### Expense Management and Efficiency
Analyze the bank's cost structure. Break down operating expenses by major category (personnel costs, premises, other). How is headcount trending relative to revenue growth? Is the bank investing in expansion or optimizing for efficiency? Discuss the efficiency ratio and whether the bank is achieving positive operating leverage.

**Key charts to use:**
- <chart:expense-breakdown /> - Operating expenses by category
- <chart:fte-trends /> - Full-time equivalent employee trends

### Profitability Metrics
Paragraph comparing ROA, ROE, NIM to industry standards...

Include relevant charts throughout.

# Key Financial Ratios
**CRITICAL:** Focus on these FOUR KEY METRICS and compare against peers:

### Efficiency Ratio
Analyze the efficiency ratio in detail. This is a critical measure of operational efficiency (lower is better). **REQUIRED COMPARISON:** How does the bank's efficiency ratio compare to:
- The peer group average (provided in peer data)
- Industry benchmark (50-60%)
- Best performers in the peer group

Be critical: If the bank's efficiency ratio is above peer average or benchmark, explain what this means for competitiveness and profitability. What are the lagging peers doing to improve?

**Use both charts:** <chart:efficiency-ratio /> and <chart:peer-efficiency />

### Return on Equity (ROE)
Evaluate ROE performance (8-12% benchmark). **REQUIRED COMPARISON:** Compare to peer average and rankings. Is the bank in the top quartile or bottom quartile among peers? If below peer average, identify the root causes and implications for shareholder value.

**Use both charts:** <chart:roe /> and <chart:peer-roe />

### Net Interest Margin (NIM)
Assess NIM trends (3-4% benchmark). **REQUIRED COMPARISON:** How does NIM compare to the peer group? If compressed relative to peers, explain whether this is due to loan mix, deposit costs, or competitive pressures. What are higher-NIM peers doing differently?

**Use both charts:** <chart:nim /> and <chart:peer-nim />

### Operating Leverage
Analyze operating leverage (revenue growth % / expense growth %). **REQUIRED COMPARISON:** Compare to peer banks. Positive leverage (>1.0) shows scalability. If the bank has negative leverage while peers have positive, explain the strategic implications.

**Use both charts:** <chart:operating-leverage /> and <chart:peer-operating-leverage />

**Overall Assessment:** Rank the bank's performance on these four metrics relative to peers. Be honest about areas of underperformance and what needs to improve.

# Competitive Positioning vs. Peers
**NEW SECTION - REQUIRED:** Provide a comprehensive peer comparison analysis:

### Performance Summary
Create a table or structured comparison showing how the bank ranks among its 20 peer banks on key metrics:
- Efficiency Ratio (with national rank and percentile)
- ROE (with national rank and percentile)
- ROA (with national rank and percentile)
- Net Interest Margin (with national rank and percentile)
- Total Assets (peer rank)

### Strengths vs. Peers
Identify specific metrics where the bank outperforms its peer average. What is the bank doing well compared to similar-sized institutions?

### Weaknesses vs. Peers
**Be critical:** Identify metrics where the bank underperforms peer average. What are the implications? What are better-performing peers doing differently?

### Peer Intelligence
Based on web searches of peer banks, what strategic initiatives are competitors pursuing? Are they:
- Expanding into new markets or products?
- Investing in technology or digital transformation?
- Pursuing M&A activity?
- Improving operational efficiency?

How does the target bank's strategy compare to what peers are doing?

# Leadership and Key Players
**IMPORTANT:** For each executive, use the <leader> tag with professional headshot.

**CRITICAL - Photo Search Strategy:**
You MUST perform dedicated web searches to find executive photos. Use search queries like:
- "[Executive Name] [Bank Name] photo"
- "[Executive Name] [Bank Name] headshot"
- "[Executive Name] CEO [Bank Name]"
- "[Executive Name] LinkedIn profile picture"

Search these sources systematically for EACH executive:
1. **LinkedIn profiles** - Search "[Name] [Bank Name] LinkedIn" and extract profile photo URL
2. **Bank's leadership/about page** - Search "[Bank Name] leadership team" or "[Bank Name] about us executives"
3. **Press releases and news articles** - Search "[Name] [Bank Name] news" - often contain executive photos
4. **Industry publications** - Banking journals, local business journals often feature executive profiles
5. **Google Images** - Search "[Name] [Bank Name]" in images specifically

**Format each leader profile exactly like this (write tags directly, NOT in code blocks):**

<leader name="Full Name" title="Job Title" image="https://photo-url.com/headshot.jpg">
Brief bio including background, tenure, key initiatives, and strategic focus. Include recent appointments or notable achievements. [Source #]
</leader>

**Key roles to profile:**
- **CEO:** Strategic vision, public statements, leadership style
- **Executive Team:** CFO, CRO, COO, and other C-suite leaders
- **Technology Leadership:** CTO, CIO, Chief Digital Officer, AI/Innovation leaders
- **Business Line Leaders:** Heads of consumer banking, commercial banking, wealth management
- **Notable Board Members:** Directors with relevant expertise

**If you cannot find a photo after thorough searching, leave the image attribute empty:** image=""

# Hiring Trends and Talent Strategy
**IMPORTANT:** Search job postings and analyze:
- **Hiring Volume:** How many open positions? Is the bank expanding or contracting headcount?
- **Lines of Business:** Which departments are hiring most? (e.g., Commercial Banking, Consumer Banking, Wealth Management, Operations, Risk)
- **Job Levels:** What mix of entry-level vs. mid-level vs. senior roles?
- **Technology Roles:**
  * Number and types of tech positions (software engineers, data scientists, cloud architects, etc.)
  * Specific technologies mentioned (programming languages, cloud platforms, databases, AI/ML tools)
  * Tech stack insights (AWS, Azure, Python, Java, React, etc.)
  * Digital transformation indicators
- **Strategic Priorities:** What do hiring patterns reveal about the bank's strategic focus?
- **Talent Competition:** Quality of roles, competitive positioning for talent
- Cite specific job postings or career page observations

# Strategic Insights
- Business priorities based on investor materials [cite sources]
- Market positioning and competitive advantages
- Recent initiatives or strategic changes
- Management commentary on outlook
- Technology and AI strategy

# News and Market Context
- Recent news that explains trends [cite all sources]
- Regulatory or market events impacting performance
- Competitive dynamics in their markets
- Recent press releases or announcements

# Risks and Opportunities
- Key risks to monitor
- Growth opportunities
- Strategic recommendations

# Research Source Checklist

**IMPORTANT:** You MUST include this checklist at the end of your report showing which key sources you were able to find during your research. Use this exact format:

<research-checklist>
{
  "investorPresentation": {
    "found": true/false,
    "date": "Month YYYY" or null,
    "source": "URL or description" or null,
    "notes": "Brief description of what was found"
  },
  "earningsCallTranscript": {
    "found": true/false,
    "quarter": "Q# YYYY" or null,
    "source": "URL or description" or null,
    "notes": "Brief description"
  },
  "executiveInterviews": {
    "found": true/false,
    "count": number,
    "examples": ["Brief description of interview 1", "Interview 2"] or [],
    "notes": "Summary of interviews found"
  },
  "recentNews": {
    "found": true/false,
    "count": number,
    "majorStories": ["Brief headline 1", "Headline 2"] or [],
    "notes": "Summary of major news in last 3 months"
  },
  "aiProjects": {
    "found": true/false,
    "initiatives": ["Initiative 1", "Initiative 2"] or [],
    "source": "URL or description" or null,
    "notes": "Summary of AI/tech initiatives found"
  }
}
</research-checklist>

**Instructions for the checklist:**
- Set "found" to true ONLY if you actually discovered relevant sources during your web searches
- Include specific dates, quarters, or timeframes when available
- Provide URLs or specific source descriptions in the "source" field
- Be honest: if you couldn't find something, set "found" to false
- The notes field should briefly explain what you found or why you couldn't find it

# Sources
List all web sources with:
[1] Source Title - Full URL
[2] Source Title - Full URL
etc.

For each section, reference specific data points from the provided financial statements.
Explain how trends impact the bank positively or negatively.
Provide context from news and investor materials where relevant.`,

  /**
   * Asset trend analysis prompt
   */
  assetTrendPrompt: `Analyze the following asset composition trends for {bankName}:

**Asset Data Over Time:**
{assetData}

**Questions to Address:**
- How has the asset mix evolved? Is the bank growing or shrinking?
- What changes in consumer lending vs. business lending are evident?
- Are securities holdings increasing (defensive) or decreasing (lending focus)?
- What does cash position indicate about liquidity strategy?
- How do these trends align with the bank's stated strategy?
- Are there any concentrations or risks in the asset composition?`,

  /**
   * Lending portfolio analysis prompt
   */
  lendingTrendPrompt: `Analyze the lending portfolio composition for {bankName}:

**Lending Breakdown:**
{lendingData}

**Questions to Address:**
- What is the primary lending focus: consumer or business?
- How has the lending mix changed over time?
- What subcategories are growing vs. shrinking?
- Are there any concentration risks?
- How does this portfolio align with market conditions and strategy?
- What does this reveal about the bank's target customers and markets?
- **IMPORTANT:** If "Other Specialized Loans" represents >15% of total loans, analyze this category closely:
  * This typically includes securities-based lending, margin loans, and loans to financial institutions
  * Search for information about the bank's prime brokerage, securities lending, or institutional finance operations
  * Investment banks and custody banks often have 80-100% in this category
  * Regional and consumer banks typically have <10%
  * Explain what types of lending likely comprise this category based on the bank's business model`,

  /**
   * Income statement analysis prompt
   */
  incomeTrendPrompt: `Analyze income and profitability trends for {bankName}:

**Income Data:**
{incomeData}

**Questions to Address:**
- How is net income trending? Any seasonal patterns or year-over-year momentum?
- **Revenue Composition:** What is the balance between interest income and non-interest income? Is the bank diversified or reliant on lending spreads?
- Is net interest income growing or compressed by rate environment?
- How significant is fee income (non-interest income)? Is it growing? What does this reveal about business mix?
- **Expense Analysis:** Are expenses well-controlled? How do personnel costs, premises, and other expenses trend?
- **Headcount Trends:** How is FTE count changing? Is the bank growing, flat, or reducing staff? How does this relate to revenue trends?
- What do quarterly comparisons reveal about momentum?
- **Year-over-Year Comparison:** How does current year performance compare to prior years at the same point? Is Q2 2025 stronger/weaker than Q2 2024?
- Is the bank achieving positive operating leverage (revenue growing faster than expenses)?`,

  /**
   * Financial ratios analysis prompt
   */
  ratioTrendPrompt: `Analyze key financial ratios for {bankName}:

**Ratio Data:**
{ratioData}

**CRITICAL RATIOS - Focus your analysis on these four metrics:**
1. **Efficiency Ratio** (50-60% benchmark, lower is better)
   - Measures operational efficiency: Noninterest Expense / (Net Interest Income + Noninterest Income)
   - Best-in-class banks: <50%, Average: 55-65%, Concerning: >70%
   - Analyze trend and drivers (technology investments, branch optimization, scale benefits)

2. **Return on Equity (ROE)** (8-12% benchmark, higher is better)
   - Measures profitability: Net Income / Total Equity
   - Strong: >12%, Fair: 8-12%, Weak: <8%
   - Evaluate against peers and explain what's driving performance

3. **Net Interest Margin (NIM)** (3-4% benchmark, higher is better)
   - Measures core lending profitability: Net Interest Income / Earning Assets
   - Healthy: >3.5%, Fair: 2.5-3.5%, Compressed: <2.5%
   - Discuss rate environment impact and deposit pricing power

4. **Operating Leverage** (YoY revenue growth % / expense growth %)
   - Positive leverage (>1.0): Revenue growing faster than expenses
   - Negative leverage (<1.0): Expenses growing faster than revenue
   - Key indicator of scalability and operational discipline

**Additional Ratios:**
- ROA: 0.8-1.2%
- Tier 1 Leverage Ratio: Proxy for capital strength

**Questions to Address:**
- How do the FOUR CRITICAL RATIOS compare to industry benchmarks and competitors?
- What trends are evident in these ratios over time?
- What specific factors are driving performance in each of the four key metrics?
- Are there concerns or strengths in the ratio profile?
- How do these ratios relate to the bank's stated strategy?`,

  /**
   * Web search query templates
   */
  searchQueries: {
    news: '"{bankName}" bank news {state} {currentYear}',
    investorRelations: '"{bankName}" investor relations presentation earnings',
    strategy: '"{bankName}" bank strategic priorities annual report',
    website: '"{bankName}" bank {city} {state} official website'
  },

  /**
   * Status messages for UX updates
   */
  statusMessages: {
    init: 'Initializing analysis...',
    fetchingData: 'Fetching financial statement data...',
    searchingNews: 'Searching for recent news and market context...',
    findingInvestorMaterials: 'Looking for investor presentations and strategic documents...',
    analyzingTrends: 'Analyzing financial trends and performance metrics...',
    generatingInsights: 'Generating strategic insights and recommendations...',
    compilingReport: 'Compiling comprehensive research report...',
    complete: 'Analysis complete!'
  }
};
