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

**CRITICAL OUTPUT FORMAT:**
You MUST format your entire response as dialogue lines ONLY. Start immediately with dialogue. No preamble, no commentary, no explanations.

Every line must follow this exact format:
[SPEAKER_ID]: Dialog text here

Available speakers:
- BANKSKIE (host)
- WARREN_VAULT (investor analyst)
- DR_SOFIA_BANKS (banking professor)
- AVA_AGENTIC (AI banking guru)
- MAYA_CUSTOMER (customer experience expert)

**IMPORTANT:**
- Start your response immediately with: [BANKSKIE]: Welcome to The Bankskie Show!
- Do NOT include any text before the first dialogue line
- Do NOT add commentary, notes, or explanations between dialogue
- Every single line must be in [SPEAKER_ID]: Dialog format
- Keep segments conversational (1-3 sentences per turn). Natural back-and-forth dialog.`,

  /**
   * Main podcast generation prompt
   */
  generatePodcastScript: (bankName, reportAnalysis, selectedExperts, trendsData, agentInsights = null, agentStats = null, groundingChunks = []) => {
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

    // Build grounding section if available
    let groundingSection = '';
    if (groundingChunks && groundingChunks.length > 0) {
      groundingSection = `\n**Expert Knowledge Base (${groundingChunks.length} guidance documents):**
${groundingChunks.map((chunk, idx) => {
  const sourceInfo = chunk.metadata?.source || 'Knowledge Base';
  return `[Document ${idx + 1}] Source: ${sourceInfo}
${chunk.content}`;
}).join('\n\n')}

These documents contain expert guidance on explaining banking concepts, discovery questions for sales professionals, and best practices for connecting financial metrics to business implications. Use this knowledge to enhance your explanations and make the podcast more valuable for AEs.\n`;
    }

    return `Generate a 12-15 minute podcast script for "The Bankskie Show" analyzing ${bankName}.

**TARGET AUDIENCE:** Account executives and sales professionals preparing for customer discovery conversations. The podcast should enable them to have intelligent, consultative discussions about the bank's business priorities, challenges, and strategic direction.

**Available Experts for This Episode:**
${selectedExpertsText}

**Bank Analysis Report:**
${reportAnalysis}
${agentResearchSection}${groundingSection}
**Financial Trends Data:**
${JSON.stringify(trendsData, null, 2)}

**CRITICAL METRIC INTERPRETATION - READ CAREFULLY:**
When discussing financial metrics in the podcast, you MUST correctly interpret the direction:

1. **Efficiency Ratio**: LOWER is better. A 45% efficiency ratio is excellent, while 75% is poor. When the efficiency ratio decreases, that's improvement. When it increases, that's worsening performance.

2. **Operating Leverage**: HIGHER is better. Operating leverage measures how changes in revenue amplify changes in operating income (operational scalability). **Formula:** Operating Leverage = (YoY % Change in PPNR) / (YoY % Change in Total Revenue), where Total Revenue = Total Interest Income + Total Non-Interest Income, and PPNR (Pre-Provision Net Revenue) = Total Revenue - Total Operating Expenses. Higher values (> 1.0) indicate revenue changes have a magnified impact on operating income (positive leverage, EXCELLENT). Sustained operating leverage > 1.0 over multiple quarters indicates scalable, efficient operations. Example: "The bank achieved 2.0x operating leverage this quarter, meaning PPNR grew twice as fast as Total Revenue - that's exactly what you want to see."

3. **ROE (Return on Equity)**: HIGHER is better. 15% is strong, 5% is weak.

4. **NIM (Net Interest Margin)**: HIGHER is better. 4% is healthy, 2% is compressed.

**DO NOT make the mistake of saying higher efficiency ratio is better - it's the opposite. Operating leverage should be HIGHER (values > 1.0), indicating PPNR growing faster than Total Revenue - this is the goal. Formula: (YoY % Change in PPNR) / (YoY % Change in Total Revenue), where PPNR = Pre-Provision Net Revenue (Total Revenue - Operating Expenses).**

**CRITICAL: ALWAYS COMPARE TO PEER GROUP PERFORMANCE**
When discussing ANY trend or improvement, you MUST provide peer comparison context:
- **NEVER present absolute improvement alone** - It's meaningless without peer context
- **Example of what to say:** "Their efficiency ratio improved 250 basis points over the last 5 years, dropping from 68% to 65.5%. Now here's the critical part - the peer group average improved 400 basis points over that same period, from 65% down to 61%. So while they got better in absolute terms, they actually LOST GROUND relative to their competitors. That tells you they're being outmanaged."
- **Example of good performance:** "Efficiency ratio improved 400bp vs peer average of 250bp - they're pulling ahead of the pack"
- **Apply to ALL metrics:** When discussing efficiency ratio, ROE, ROA, NIM, asset growth, operating leverage - ALWAYS include the peer comparison
- **Make it conversational:** "Sure, their ROE went up from 8% to 10%, but guess what? The peer average went from 9% to 12%. They're falling behind."
- **This is a common mistake in banking analysis** - Call it out! "A lot of people would look at that 250bp improvement and think they're doing great, but when you compare it to peers improving 400bp, you realize management is underperforming."

**Podcast Structure:**

**[Intro - 30 seconds]**
[BANKSKIE]: Welcome to The Bankskie Show! Quick intro with energy, mention this is a prep session for AEs who want to understand ${bankName}'s business.

**[Elevator Pitch - 2 minutes] (FIVE SECTIONS)**
[BANKSKIE]: "Alright, here's what you NEED to know before walking into ${bankName}. I'm breaking this into five parts: who they are, who's running it, what's happening, where they're headed, and your Anthropic angle."

**ABOUT THE BANK (20 seconds):**
[BANKSKIE]: "So first, the basics..."
- Total assets size and tier (e.g., "$45 billion regional bank")
- Where they're headquartered and their markets
- Their top strategic priorities
- One sentence positioning: "This is a [type] bank focused on [differentiator]"

**LEADERSHIP (20 seconds):**
[BANKSKIE]: "Now let me tell you who you're dealing with..."
- CEO name and tenure (e.g., "John Smith has been CEO since 2019")
- Any notable executive changes in the past 12-18 months
- Key executives the AE might meet (CFO, CIO, Head of AI)
- Leadership direction: "Under Smith, they've been pushing hard on digital transformation"
- **If leadership info not available**: "We don't have detailed leadership info in our sources - that's something you'll want to research before your meeting"
- **CITE YOUR SOURCE**: Mention where this info came from (e.g., "According to their 2024 annual report...")

**KEY BUSINESS INSIGHTS (30 seconds):**
[BANKSKIE]: "Now here's what's actually happening..."
- 2-3 punchy insights with PEER COMPARISONS (e.g., "Their ROE is 9.2% vs 11% peer average - they're lagging")
- Highlight one strength and one concern
- Use language like "What this means for you..."
- **CITE YOUR SOURCES**: Reference Call Reports for financial data (e.g., "According to their Q2 2025 Call Report...")

**FUTURE OUTLOOK (20 seconds):**
[BANKSKIE]: "Here's where they say they're headed..."
- Management's forward guidance (from earnings calls, investor presentations)
- Key initiatives they're planning
- Any risks or challenges they've mentioned
- **If no forward guidance available**: "We don't have their forward guidance in our sources - ask them about their strategic roadmap"
- **CITE YOUR SOURCE**: Mention earnings calls or investor presentations

**ANTHROPIC ANGLE (30 seconds):**
[BANKSKIE]: "And here's your opener for the conversation..."
- **Foundation (quick)**: "Everyone needs Claude Code and Claude for Enterprise - that's table stakes"
- **The interesting part**: Based on their strategic priorities, suggest 1-2 specific AI transformation opportunities:
  * Loan processing automation, customer service AI, compliance monitoring, document processing
  * Connect to their specific pain points: "They mentioned loan processing as a priority - that's a perfect Claude use case"
- Frame as business outcomes: "Walk in talking about how AI agents can cut their loan origination time in half"

**[Executive Summary - 2-3 minutes]**
Now dig deeper. Bankskie and ALL experts expand on each section:
- Experts react to the About section - add context about the bank's market position
- **Experts discuss Leadership** - What does the leadership team's background tell us? Any executive changes that signal strategic shifts?
- Experts analyze the Key Insights - each adds their perspective (Warren on numbers, Sofia on context, Ava on tech, Maya on customers)
- **Experts discuss Future Outlook** - What's management saying about the future? What should the AE probe on?
- Experts discuss the Anthropic opportunities - suggest specific use cases from their lens
- **IMPORTANT: Cite sources throughout** - "According to their Q2 earnings call...", "Their annual report mentions...", "Call Report data shows..."

**[Business Context & Strategic Priorities - 2-3 minutes]**
Frame the bank's strategic situation from a business perspective:
- [BANKSKIE]: "Let's talk about what's driving their strategy right now..."
- What business outcomes are they prioritizing? (growth, efficiency, digital transformation, risk management)
- What market pressures are they facing?
- How does their strategy compare to peer banks?
- Recent strategic initiatives from earnings calls or news
- Use phrases like "If I'm the CEO, I'm thinking about..." or "The board is probably pushing them to..."
- Make this conversational but insightful

**[Financial Deep Dive - 3 minutes]**
Discuss specific metrics AND link them to business needs. MAKE SURE ALL SELECTED EXPERTS PARTICIPATE:
- If WARREN_VAULT is selected: He MUST analyze investor metrics (ROE, efficiency ratio, profitability). Give him multiple turns to geek out on the numbers.
- If DR_SOFIA_BANKS is selected: She MUST explain complex concepts or regulatory context with upbeat clarity. Give her multiple turns.
- **CRITICAL**: When discussing each metric, explicitly connect it to business implications:
  * "This efficiency ratio suggests they might be interested in..."
  * "That operating leverage tells me they've built scalable operations, which means..."
  * "The NIM compression means they're hunting for..."
- Use actual numbers from the data
- Create natural back-and-forth dialog

**[Pain Points & Opportunities - 3 minutes]**
Frame as BUSINESS CHALLENGES and OPPORTUNITIES (not just financial risks). Make this actionable for AEs:
- Operational challenges they're likely facing
- Technology gaps or digital transformation needs
- Competitive threats requiring response
- Areas where they might be seeking solutions
- If AVA_AGENTIC is selected: She MUST discuss digital transformation opportunities and technology gaps
- If MAYA_CUSTOMER is selected: She MUST discuss customer experience challenges
- Use language like: "This is a pain point because..." or "They're probably getting pressure to..."
- Quick comparison to competitors: "Compared to peers, they're lagging/leading in..."

**[Discovery Questions for AEs - 2 minutes]**
[BANKSKIE]: "Alright, you're walking into a meeting with ${bankName}. Here are the questions you should be asking..."
- Have each expert suggest 1-2 thoughtful discovery questions from their perspective
- Frame as: "Warren, what would YOU want to know about their capital strategy?"
- Make questions open-ended and consultative (not product pitches)
- Include "what to listen for" hints
- Examples:
  * "Ask them how they're thinking about efficiency improvement - listen for whether it's a cost-cutting or revenue optimization play"
  * "What's keeping the CIO up at night regarding digital transformation?"
  * "How are they measuring customer experience success?"

**[Outro - "Tell them what you told them" - 45 seconds]**
[BANKSKIE]: This is NOT just a recap - it's ACTION-ORIENTED. Frame as "Here's what you need to DO with this information":
- **3 Specific Actions**: "When you walk in there, DO this: 1) [action], 2) [action], 3) [action]"
- Connect each action to a finding: "Because we learned they have X issue, you should ask about Y"
- End with energy: "Armed with this, you're going to have a great conversation. Go get 'em!"

**STORYTELLING PRINCIPLE:**
Follow the classic communication structure throughout:
1. "Tell them what you're going to tell them" → Elevator Pitch (5 sections, concise overview)
2. "Tell them" → Executive Summary, Business Context, Financial Deep Dive, Pain Points, Discovery Questions
3. "Tell them what you told them" → Outro (ACTION-ORIENTED closing, not just recap)

**IMPORTANT GUIDELINES:**
1. **CRITICAL**: Every expert that was selected MUST appear throughout the podcast with multiple speaking turns in EVERY section. Do not leave anyone out. If 4 experts are selected, all 4 must participate actively.
2. **AE ENABLEMENT FOCUS**: This is a business prep tool. Frame insights as "What this means for your conversation..." or "Here's what to ask about..."
3. Use specific data points from the report (cite numbers, percentages, trends) AND connect them to business implications
4. Keep individual speaking turns SHORT (1-3 sentences max)
5. Include natural reactions: "Wow, that's interesting because...", "Hold on, what about...", "Exactly!"
6. Make Bankskie sharp and conversational - think All-In podcast style (casual but smart) - but remember this is prep for AEs
7. Each expert has a distinct voice:
   - Warren: Fast-talking finance bro - throws around terms like ROIC, multiple compression, capital allocation. Gets excited about numbers. Confident and direct. But also connects metrics to business decisions.
   - Dr. Sofia: Educational, upbeat, explains concepts with enthusiasm and clarity. Helps AEs understand the "why" behind banking practices.
   - Ava: Tech-forward, discusses innovation and AI. Spots digital transformation opportunities and gaps.
   - Maya: Empathetic, customer-focused, practical impact. Helps AEs understand customer pain points.
8. NO markdown formatting, citations, or chart references - this is for audio
9. Reference the bank by name frequently
10. In the Discovery Questions section, make sure questions are:
    - Open-ended (not yes/no)
    - Consultative (not product pitches)
    - Designed to uncover business priorities and challenges
11. Total script should be approximately 3,000-3,500 words (12-15 minutes at ~250 words/minute)
12. **VERIFY**: Before finishing, check that:
    - EVERY selected expert has spoken at least 8-10 times throughout the episode
    - The 3 elevator pitch points are clear and memorable
    - At least 5-7 discovery questions are provided
    - Business implications are connected to financial metrics throughout

**OUTPUT FORMAT REMINDER:**
Start your response IMMEDIATELY with dialogue in this format:
[BANKSKIE]: Welcome to The Bankskie Show!

Do NOT include:
- Any preamble or introduction text
- Commentary or stage directions
- Notes or explanations
- Anything that isn't dialogue in [SPEAKER_ID]: Dialog format

Begin the script now:`;
  },

  /**
   * Fallback for when no experts are selected (Bankskie solo)
   */
  generateSoloScript: (bankName, reportAnalysis, agentInsights = null, agentStats = null, groundingChunks = []) => {
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

    // Build grounding section if available
    let groundingSection = '';
    if (groundingChunks && groundingChunks.length > 0) {
      groundingSection = `\n**Expert Knowledge Base (${groundingChunks.length} guidance documents):**
${groundingChunks.map((chunk, idx) => {
  const sourceInfo = chunk.metadata?.source || 'Knowledge Base';
  return `[Document ${idx + 1}] Source: ${sourceInfo}
${chunk.content}`;
}).join('\n\n')}

These documents contain expert guidance on explaining banking concepts, discovery questions for sales professionals, and best practices for connecting financial metrics to business implications. Use this knowledge to enhance your explanations and make the podcast more valuable for AEs.\n`;
    }

    return `Generate a 10-12 minute solo podcast script where Bankskie analyzes ${bankName} by himself as a prep session for account executives.

**TARGET AUDIENCE:** Account executives and sales professionals preparing for customer discovery conversations.

**Bank Analysis:**
${reportAnalysis}
${agentResearchSection}${groundingSection}

**CRITICAL METRIC INTERPRETATION - READ CAREFULLY:**
When discussing financial metrics, you MUST correctly interpret the direction:

1. **Efficiency Ratio**: LOWER is better. A 45% efficiency ratio is excellent, while 75% is poor. When the efficiency ratio decreases, that's improvement.

2. **Operating Leverage**: HIGHER is better. Operating leverage measures operational scalability. When revenue grows faster than expenses (positive operating leverage or values > 1.0), that's GOOD. Sustained positive operating leverage over multiple quarters indicates scalable operations.

3. **ROE**: HIGHER is better. 4. **NIM**: HIGHER is better.

**DO NOT make the mistake of saying higher efficiency ratio is better - it's the opposite. Operating leverage should be HIGHER (values > 1.0), indicating PPNR growing faster than Total Revenue - this is the goal. Formula: (YoY % Change in PPNR) / (YoY % Change in Total Revenue), where PPNR = Pre-Provision Net Revenue (Total Revenue - Operating Expenses).**

**CRITICAL: ALWAYS COMPARE TO PEER GROUP PERFORMANCE**
When discussing ANY trend or improvement, you MUST provide peer comparison context:
- **NEVER present absolute improvement alone** - It's meaningless without peer context
- **Example:** "Their efficiency ratio improved 250bp over 5 years. Sounds good, right? But here's what matters - their peers improved 400bp. They're actually LOSING GROUND despite absolute improvement."
- **Apply to ALL metrics:** Efficiency ratio, ROE, ROA, NIM, asset growth, operating leverage
- **Make it conversational:** "Sure, ROE went up from 8% to 10%, but the peer average jumped from 9% to 12%. They're falling behind."

**Structure:**
1. **Intro** (30 sec): Quick welcome, mention this is AE prep for ${bankName}
2. **Elevator Pitch** (60 sec): THE 3 MUST-KNOW POINTS before meeting with ${bankName}. Frame as "What this means for you..."
3. **Business Context** (2-3 min): What's driving their strategy, market pressures, priorities
4. **Financial Deep Dive** (2-3 min): Metrics with business implications ("This NIM tells you they're hunting for...")
5. **Pain Points & Opportunities** (2 min): Business challenges, technology gaps, competitive pressures
6. **Discovery Questions** (2 min): 5-7 questions AEs should ask, with "listen for..." hints
7. **Outro** (30 sec): Recap the 3 must-know points

Bankskie should:
- Lead with the elevator pitch right after intro
- Be energetic and engaging as he walks through the analysis
- Frame everything through the lens of "What does this mean for your customer conversation?"
- Connect financial metrics to business needs: "They're likely looking for..."
- Use phrases like "If I'm walking into this bank, I want to know..."
- Suggest thoughtful discovery questions throughout
- Use storytelling to make the data interesting
- Ask rhetorical questions to engage listeners
- Keep it conversational and accessible
- Think like a sales enablement coach, not just an analyst

Total script should be approximately 2,500-3,000 words.

**OUTPUT FORMAT REMINDER:**
Start your response IMMEDIATELY with dialogue:
[BANKSKIE]: Welcome to The Bankskie Show!

Do NOT include any preamble, commentary, or explanations. Every line must be in [BANKSKIE]: Dialog format.

Begin the script now:`;
  }
};
