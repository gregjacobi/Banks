/**
 * Prompts for generating "The Bankskie Show" podcast scripts
 * Creates engaging interview-style conversations about bank analysis
 */

module.exports = {
  /**
   * System prompt for podcast script generation
   */
  systemPrompt: `You are a creative podcast scriptwriter for "The Bankskie Show" - a popular banking analysis podcast.

Your host is Bankskie, a sharp and naturally conversational financial analyst inspired by the All-In podcast style. He's confident, quick-witted, and cuts through the BS to get to what matters. Think Chamath or Jason Calacanis discussing banks - smart, direct, occasionally provocative.

Write natural, conversational dialogue that:
- Sounds like real people talking in a casual conversation (use contractions, natural speech patterns, "you know", "I mean", "right?")
- Includes natural banter, quick reactions, and back-and-forth flow
- Makes complex banking concepts accessible without being condescending
- Uses specific data points but doesn't get bogged down in jargon
- Has energy and momentum - keep it moving
- Balances sharp insights with entertainment value

Format your script as:
[SPEAKER_ID]: Dialog text here

Available speakers:
- BANKSKIE (host)
- WARREN_VAULT (investor analyst)
- DR_SOFIA_BANKS (banking professor)
- AVA_AGENTIC (AI banking guru)
- MAYA_CUSTOMER (customer experience expert)

Keep segments conversational (1-3 sentences per turn). Natural back-and-forth dialog.`,

  /**
   * Main podcast generation prompt
   */
  generatePodcastScript: (bankName, reportAnalysis, selectedExperts, trendsData, agentInsights = null, agentStats = null) => {
    const expertsDescription = {
      WARREN_VAULT: 'Warren Vault is a sharp investor analyst with serious credentials - he talks fast, throws around investor terminology freely, and gets excited about the numbers. Think hedge fund analyst who lives for earnings calls. He\'s confident, energetic, and doesn\'t sugarcoat when something looks bad. Professional but enthusiastic - avoid overusing casual slang like "dude" or "bro".',
      DR_SOFIA_BANKS: 'Dr. Sofia Banks is an upbeat banking professor who explains banking jargon, regulatory context, and fundamental concepts with clarity and enthusiasm. She helps listeners understand the "why" behind banking practices with infectious energy.',
      AVA_AGENTIC: 'Ava Agentic is a forward-thinking technologist who spots AI and digital transformation opportunities in banking. She\'s always thinking about how technology can improve banking operations and customer experience.',
      MAYA_CUSTOMER: 'Maya Customer is a customer experience expert who connects bank strategy to real customer impact. She advocates for customers and explains how banking decisions affect everyday people.'
    };

    const selectedExpertsText = selectedExperts
      .map(expert => `- ${expertsDescription[expert]}`)
      .join('\n');

    // Build agent research section if available
    let agentResearchSection = '';
    if (agentInsights && agentInsights.length > 0) {
      agentResearchSection = `\n**Agent Research Insights (${agentInsights.length} key discoveries):**
${agentInsights.map((insight, idx) => {
  return `[${idx + 1}] ${insight.title} (${insight.insight_type}, ${insight.importance} importance)
${insight.content}
Evidence: ${insight.evidence?.join(', ') || 'N/A'}`;
}).join('\n\n')}

**Agent Research Stats:**
- ${agentStats?.iterations || 'N/A'} research iterations
- ${agentInsights.length} insights generated
- ${agentStats?.documentsQueried?.length || 0} documents queried
- ${agentStats?.webSearches?.length || 0} web searches performed

These insights represent key findings from an AI agent that actively explored financial data, searched the web, and queried source documents. Incorporate these discoveries naturally into the conversation - they add depth and credibility to the analysis.\n`;
    }

    return `Generate a 10-12 minute podcast script for "The Bankskie Show" analyzing ${bankName}.

**Available Experts for This Episode:**
${selectedExpertsText}

**Bank Analysis Report:**
${reportAnalysis}
${agentResearchSection}
**Financial Trends Data:**
${JSON.stringify(trendsData, null, 2)}

**CRITICAL METRIC INTERPRETATION - READ CAREFULLY:**
When discussing financial metrics in the podcast, you MUST correctly interpret the direction:

1. **Efficiency Ratio**: LOWER is better. A 45% efficiency ratio is excellent, while 75% is poor. When the efficiency ratio decreases, that's improvement. When it increases, that's worsening performance.

2. **Operating Leverage**: HIGHER is better. Operating leverage measures how changes in revenue amplify changes in operating income (operational scalability). **Formula:** Operating Leverage = (YoY % Change in PPNR) / (YoY % Change in Total Revenue), where Total Revenue = Total Interest Income + Total Non-Interest Income, and PPNR (Pre-Provision Net Revenue) = Total Revenue - Total Operating Expenses. Higher values (> 1.0) indicate revenue changes have a magnified impact on operating income (positive leverage, EXCELLENT). Sustained operating leverage > 1.0 over multiple quarters indicates scalable, efficient operations. Example: "The bank achieved 2.0x operating leverage this quarter, meaning PPNR grew twice as fast as Total Revenue - that's exactly what you want to see."

3. **ROE (Return on Equity)**: HIGHER is better. 15% is strong, 5% is weak.

4. **NIM (Net Interest Margin)**: HIGHER is better. 4% is healthy, 2% is compressed.

**DO NOT make the mistake of saying higher efficiency ratio is better - it's the opposite. Operating leverage should be HIGHER (values > 1.0), indicating PPNR growing faster than Total Revenue - this is the goal. Formula: (YoY % Change in PPNR) / (YoY % Change in Total Revenue), where PPNR = Pre-Provision Net Revenue (Total Revenue - Operating Expenses).**

**Podcast Structure:**

**[Intro - 30 seconds]**
[BANKSKIE]: Welcome to The Bankskie Show! Quick intro with energy, tease the interesting findings.

**[Executive Summary - 2 minutes]**
Bankskie summarizes key findings with enthusiasm. Have ALL experts weigh in with quick reactions from their perspectives.

**[Financial Deep Dive - 3-4 minutes]**
Discuss specific metrics, trends, and what they mean. MAKE SURE ALL SELECTED EXPERTS PARTICIPATE:
- If WARREN_VAULT is selected: He MUST analyze investor metrics (ROE, efficiency ratio, profitability). Give him multiple turns to geek out on the numbers.
- If DR_SOFIA_BANKS is selected: She MUST explain complex concepts or regulatory context with upbeat clarity. Give her multiple turns.
- Use actual numbers from the data
- Create natural back-and-forth dialog - don't let any expert sit silent

**[Strategic Analysis - 3-4 minutes]**
Discuss bank's strategy and positioning. ENSURE EVERY SELECTED EXPERT SPEAKS MULTIPLE TIMES:
- If AVA_AGENTIC is selected: She MUST discuss AI/technology opportunities and digital transformation. Give her multiple speaking turns.
- If MAYA_CUSTOMER is selected: She MUST discuss customer impact and experience. Give her multiple speaking turns.
- Reference news items and leadership insights from the report
- Keep it conversational - rotate through ALL experts

**[Risks & Opportunities - 2 minutes]**
Quick-fire discussion of key risks and opportunities
- EVERY selected expert MUST weigh in with their unique perspective
- Go around the table - make sure no one is left out
- Keep it punchy and engaging

**[Outro - 30 seconds]**
[BANKSKIE]: Wrap up with key takeaway, thank experts, encourage listeners to subscribe

**IMPORTANT GUIDELINES:**
1. **CRITICAL**: Every expert that was selected MUST appear throughout the podcast with multiple speaking turns in EVERY section. Do not leave anyone out. If 4 experts are selected, all 4 must participate actively.
2. Use specific data points from the report (cite numbers, percentages, trends)
3. Keep individual speaking turns SHORT (1-3 sentences max)
4. Include natural reactions: "Wow, that's interesting because...", "Hold on, what about...", "Exactly!"
5. Make Bankskie sharp and conversational - think All-In podcast style (casual but smart)
6. Each expert has a distinct voice:
   - Warren: Fast-talking finance bro - throws around terms like ROIC, multiple compression, capital allocation. Gets excited about numbers. Confident and direct.
   - Dr. Sofia: Educational, upbeat, explains concepts with enthusiasm and clarity
   - Ava: Tech-forward, discusses innovation and AI
   - Maya: Empathetic, customer-focused, practical impact
7. NO markdown formatting, citations, or chart references - this is for audio
8. Reference the bank by name frequently
9. Total script should be approximately 2,500-3,000 words
10. **VERIFY**: Before finishing, check that EVERY selected expert has spoken at least 8-10 times throughout the episode

Begin the script now:`;
  },

  /**
   * Fallback for when no experts are selected (Bankskie solo)
   */
  generateSoloScript: (bankName, reportAnalysis, agentInsights = null, agentStats = null) => {
    // Build agent research section if available
    let agentResearchSection = '';
    if (agentInsights && agentInsights.length > 0) {
      agentResearchSection = `\n**Agent Research Insights (${agentInsights.length} key discoveries):**
${agentInsights.map((insight, idx) => {
  return `[${idx + 1}] ${insight.title} (${insight.insight_type}, ${insight.importance} importance)
${insight.content}
Evidence: ${insight.evidence?.join(', ') || 'N/A'}`;
}).join('\n\n')}

**Agent Research Stats:**
- ${agentStats?.iterations || 'N/A'} research iterations
- ${agentInsights.length} insights generated
- ${agentStats?.documentsQueried?.length || 0} documents queried
- ${agentStats?.webSearches?.length || 0} web searches performed

These insights represent key findings from an AI agent that actively explored financial data, searched the web, and queried source documents. Incorporate these discoveries naturally into your analysis - they add depth and credibility.\n`;
    }

    return `Generate a 8-10 minute solo podcast script where Bankskie analyzes ${bankName} by himself.

**Bank Analysis:**
${reportAnalysis}
${agentResearchSection}

**CRITICAL METRIC INTERPRETATION - READ CAREFULLY:**
When discussing financial metrics, you MUST correctly interpret the direction:

1. **Efficiency Ratio**: LOWER is better. A 45% efficiency ratio is excellent, while 75% is poor. When the efficiency ratio decreases, that's improvement.

2. **Operating Leverage**: HIGHER is better. Operating leverage measures operational scalability. When revenue grows faster than expenses (positive operating leverage or values > 1.0), that's GOOD. Sustained positive operating leverage over multiple quarters indicates scalable operations.

3. **ROE**: HIGHER is better. 4. **NIM**: HIGHER is better.

**DO NOT make the mistake of saying higher efficiency ratio is better - it's the opposite. Operating leverage should be HIGHER (values > 1.0), indicating PPNR growing faster than Total Revenue - this is the goal. Formula: (YoY % Change in PPNR) / (YoY % Change in Total Revenue), where PPNR = Pre-Provision Net Revenue (Total Revenue - Operating Expenses).**

Bankskie should:
- Be energetic and engaging as he walks through the analysis
- Use storytelling to make the data interesting
- Ask rhetorical questions to engage listeners
- Provide his own take on the metrics and strategy
- Keep it conversational and accessible

Total script should be approximately 2,000-2,500 words.

Begin with: [BANKSKIE]: Welcome to The Bankskie Show!`;
  }
};
