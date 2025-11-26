const Anthropic = require('@anthropic-ai/sdk');
const Source = require('../models/Source');

/**
 * SourceSelectionService
 *
 * Intelligently scores and selects the best sources for research based on:
 * 1. Authority - Domain reputation, official sources
 * 2. Depth - Content substantiveness, comprehensive coverage
 * 3. Freshness - Recency of information
 */
class SourceSelectionService {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  /**
   * Score a single source based on authority, depth, and freshness
   * Returns a score from 0-100
   */
  scoreSource(source) {
    let score = 0;
    const weights = {
      authority: 0.4,  // 40% weight
      depth: 0.3,      // 30% weight
      freshness: 0.3   // 30% weight
    };

    // 1. AUTHORITY SCORE (0-100)
    const authorityScore = this.calculateAuthorityScore(source);

    // 2. DEPTH SCORE (0-100)
    const depthScore = this.calculateDepthScore(source);

    // 3. FRESHNESS SCORE (0-100)
    const freshnessScore = this.calculateFreshnessScore(source);

    // Calculate weighted average
    score = (
      authorityScore * weights.authority +
      depthScore * weights.depth +
      freshnessScore * weights.freshness
    );

    // 4. CATEGORY PRIORITY MULTIPLIER (boost preferred source types)
    // Priority order: investor presentations > earnings transcripts > strategy/reviews > analyst reports
    const categoryMultipliers = {
      'investorPresentation': 1.3,  // Highest priority: recent, in-depth presentations covering entire business
      'earningsTranscript': 1.2,    // High priority: in-depth transcripts with full business coverage
      'strategyAnalysis': 1.1,      // Medium priority: quarterly/annual reviews, management interviews
      'analystReports': 1.0         // Base priority: independent analysis
    };

    const categoryMultiplier = categoryMultipliers[source.category] || 1.0;
    score = score * categoryMultiplier;

    // Cap at 100
    score = Math.min(100, score);

    return {
      totalScore: Math.round(score),
      categoryMultiplier,
      breakdown: {
        authority: Math.round(authorityScore),
        depth: Math.round(depthScore),
        freshness: Math.round(freshnessScore)
      }
    };
  }

  /**
   * Calculate authority score based on domain and source type
   */
  calculateAuthorityScore(source) {
    let score = 0;

    // Extract domain from URL
    let domain = '';
    try {
      const url = new URL(source.url);
      domain = url.hostname.toLowerCase();
    } catch (e) {
      // Invalid URL, very low authority
      return 10;
    }

    // Official sources (highest authority)
    const officialIndicators = [
      'ir.', 'investor.', 'investors.', 's21.q4cdn.com', 's22.q4cdn.com',
      's23.q4cdn.com', 's24.q4cdn.com', 's25.q4cdn.com', // Q4 investor relations CDN
      'seekingalpha.com', 'fool.com'  // Reputable financial platforms with transcripts
    ];

    if (officialIndicators.some(indicator => domain.includes(indicator))) {
      score += 100; // Maximum authority
    }
    // Bank's own domain
    else if (source.url.includes(source.bankName?.toLowerCase().replace(/\s+/g, ''))) {
      score += 95;
    }
    // PDF files (typically official documents)
    else if (source.url.toLowerCase().endsWith('.pdf')) {
      score += 80;
    }
    // Financial news sites
    else if (domain.includes('bloomberg.com') || domain.includes('reuters.com') ||
             domain.includes('wsj.com') || domain.includes('ft.com')) {
      score += 75;
    }
    // Regional business journals
    else if (domain.includes('bizjournals.com') || domain.includes('americanbanker.com')) {
      score += 70;
    }
    // Press release sites
    else if (domain.includes('businesswire.com') || domain.includes('prnewswire.com')) {
      score += 65;
    }
    // General business sites
    else if (domain.includes('cnbc.com') || domain.includes('marketwatch.com')) {
      score += 60;
    }
    // Unknown/general sites
    else {
      score += 40;
    }

    // Category bonus (official investor presentations are most valuable)
    if (source.category === 'investorPresentation' && source.url.toLowerCase().endsWith('.pdf')) {
      score = Math.min(100, score + 10);
    } else if (source.category === 'earningsTranscript') {
      score = Math.min(100, score + 5);
    }

    return Math.min(100, score);
  }

  /**
   * Calculate depth score based on content indicators
   */
  calculateDepthScore(source) {
    let score = 50; // Start at middle

    // If we have actual content, analyze it
    if (source.content && source.contentLength) {
      const length = source.contentLength;

      // Length scoring (longer = more comprehensive, up to a point)
      if (length > 50000) {
        score = 100; // Very comprehensive
      } else if (length > 20000) {
        score = 90;
      } else if (length > 10000) {
        score = 75;
      } else if (length > 5000) {
        score = 60;
      } else if (length > 2000) {
        score = 45;
      } else if (length > 500) {
        score = 30;
      } else {
        score = 15; // Too short, probably not substantial
      }

      // Quality indicators boost
      if (source.content) {
        const contentLower = source.content.toLowerCase();

        // Check for financial depth indicators
        const depthIndicators = [
          'earnings per share', 'net interest margin', 'efficiency ratio',
          'return on equity', 'return on assets', 'noninterest income',
          'operating leverage', 'tangible book value', 'tier 1 capital'
        ];
        const indicatorMatches = depthIndicators.filter(ind => contentLower.includes(ind)).length;
        score += indicatorMatches * 3; // Up to +27 for very detailed financial content

        // Check for strategic depth indicators
        const strategyIndicators = [
          'strategic priority', 'strategic initiative', 'digital transformation',
          'technology investment', 'competitive advantage', 'market position'
        ];
        const strategyMatches = strategyIndicators.filter(ind => contentLower.includes(ind)).length;
        score += strategyMatches * 2; // Up to +12 for strategic content
      }
    }
    // If no content yet, estimate based on URL and title
    else {
      // PDF documents are typically comprehensive
      if (source.url.toLowerCase().endsWith('.pdf')) {
        score = 80;
      }
      // Earnings transcripts are usually detailed
      else if (source.category === 'earningsTranscript') {
        score = 75;
      }
      // Investor presentations are comprehensive
      else if (source.category === 'investorPresentation') {
        score = 85;
      }
      // Check title for depth indicators
      else if (source.title) {
        const titleLower = source.title.toLowerCase();
        if (titleLower.includes('presentation') || titleLower.includes('transcript')) {
          score = 70;
        } else if (titleLower.includes('earnings') || titleLower.includes('investor')) {
          score = 65;
        }
      }
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculate freshness score based on date
   */
  calculateFreshnessScore(source) {
    let score = 0;

    // Try to extract date from source.date field or URL
    let sourceDate = null;

    // Parse source.date field (e.g., "Q2 2025", "Oct 2025", "2025-06-30")
    if (source.date) {
      sourceDate = this.parseSourceDate(source.date);
    }

    // Try to extract date from URL if not found in date field
    if (!sourceDate) {
      sourceDate = this.extractDateFromUrl(source.url);
    }

    // If we found a date, score based on recency
    if (sourceDate) {
      const now = new Date();
      const ageInDays = (now - sourceDate) / (1000 * 60 * 60 * 24);

      // Scoring based on age
      if (ageInDays < 90) {
        score = 100; // Within 3 months - extremely fresh
      } else if (ageInDays < 180) {
        score = 90; // Within 6 months - very fresh
      } else if (ageInDays < 365) {
        score = 75; // Within 1 year - fresh
      } else if (ageInDays < 730) {
        score = 50; // Within 2 years - moderately fresh
      } else if (ageInDays < 1095) {
        score = 25; // Within 3 years - dated
      } else {
        score = 10; // Older than 3 years - very dated
      }
    } else {
      // No date found - assume moderate freshness (could be recent, could be old)
      score = 40;
    }

    return score;
  }

  /**
   * Parse various date formats from source.date field
   */
  parseSourceDate(dateString) {
    if (!dateString) return null;

    // Try parsing "Q1 2025", "Q2 2024", etc.
    const quarterMatch = dateString.match(/Q([1-4])\s+(\d{4})/i);
    if (quarterMatch) {
      const quarter = parseInt(quarterMatch[1]);
      const year = parseInt(quarterMatch[2]);
      const month = (quarter - 1) * 3; // Q1=0, Q2=3, Q3=6, Q4=9
      return new Date(year, month, 1);
    }

    // Try parsing "Jan 2025", "February 2024", etc.
    const monthMatch = dateString.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i);
    if (monthMatch) {
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthIndex = monthNames.indexOf(monthMatch[1].toLowerCase().substring(0, 3));
      const year = parseInt(monthMatch[2]);
      if (monthIndex !== -1) {
        return new Date(year, monthIndex, 1);
      }
    }

    // Try parsing ISO date "2025-06-30" or "2025-06"
    try {
      const isoDate = new Date(dateString);
      if (!isNaN(isoDate.getTime())) {
        return isoDate;
      }
    } catch (e) {
      // Ignore parsing errors
    }

    return null;
  }

  /**
   * Extract date from URL patterns
   */
  extractDateFromUrl(url) {
    if (!url) return null;

    // Match patterns like /2025/06/, /2025-06/, /2025/Q2/, etc.
    const urlDateMatch = url.match(/[\/\-](\d{4})[\/\-]([0-1]?\d|Q[1-4])[\/\-]?/i);
    if (urlDateMatch) {
      const year = parseInt(urlDateMatch[1]);
      let month = 0;

      if (urlDateMatch[2].startsWith('Q')) {
        const quarter = parseInt(urlDateMatch[2].substring(1));
        month = (quarter - 1) * 3;
      } else {
        month = parseInt(urlDateMatch[2]) - 1; // JS months are 0-indexed
      }

      return new Date(year, month, 1);
    }

    // Match patterns like earnings-2025-q2, investor-presentation-2024, etc.
    const filenameMatch = url.match(/(\d{4})[-_]?(q[1-4]|[0-1]?\d)?/i);
    if (filenameMatch) {
      const year = parseInt(filenameMatch[1]);
      let month = 0;

      if (filenameMatch[2]) {
        if (filenameMatch[2].toLowerCase().startsWith('q')) {
          const quarter = parseInt(filenameMatch[2].substring(1));
          month = (quarter - 1) * 3;
        } else {
          month = parseInt(filenameMatch[2]) - 1;
        }
      }

      return new Date(year, month, 1);
    }

    return null;
  }

  /**
   * Score and rank all sources for a session, marking the best ones as recommended
   * @param {string} sessionId - Session ID to process
   * @param {Object} options - Configuration options
   * @returns {Promise<Object>} - Scoring results and recommendations
   */
  async scoreAndRankSources(sessionId, options = {}) {
    const {
      minScoreThreshold = 60,  // Minimum score to be considered "good"
      topNPerCategory = 3       // Top N sources per category to recommend
    } = options;

    // Get all sources for this session
    const sources = await Source.find({ sessionId }).lean();

    if (sources.length === 0) {
      return {
        success: false,
        message: 'No sources found for this session',
        totalSources: 0
      };
    }

    console.log(`[SourceSelection] Scoring ${sources.length} sources for session ${sessionId}`);

    // Score each source
    const scoredSources = sources.map(source => {
      const scoring = this.scoreSource(source);
      return {
        ...source,
        scoring
      };
    });

    // Group by category
    const sourcesByCategory = scoredSources.reduce((acc, source) => {
      if (!acc[source.category]) {
        acc[source.category] = [];
      }
      acc[source.category].push(source);
      return acc;
    }, {});

    // For each category, rank and recommend top N
    const recommendations = {};
    const updates = [];

    for (const [category, categorySources] of Object.entries(sourcesByCategory)) {
      // Sort by total score (highest first)
      categorySources.sort((a, b) => b.scoring.totalScore - a.scoring.totalScore);

      // Select top N that meet minimum threshold
      const topSources = categorySources
        .filter(s => s.scoring.totalScore >= minScoreThreshold)
        .slice(0, topNPerCategory);

      recommendations[category] = {
        totalFound: categorySources.length,
        recommended: topSources.length,
        averageScore: Math.round(
          categorySources.reduce((sum, s) => sum + s.scoring.totalScore, 0) / categorySources.length
        ),
        topSources: topSources.map(s => ({
          sourceId: s.sourceId,
          title: s.title,
          url: s.url,
          date: s.date,
          score: s.scoring.totalScore,
          breakdown: s.scoring.breakdown
        }))
      };

      // Mark top sources as recommended in database
      for (const source of topSources) {
        updates.push(
          Source.findOneAndUpdate(
            { sourceId: source.sourceId },
            {
              $set: {
                score: source.scoring.totalScore,
                recommended: true,
                confidence: source.scoring.totalScore / 100
              }
            }
          )
        );
      }

      // Update scores for all other sources (not recommended)
      const nonTopSources = categorySources.filter(
        s => !topSources.find(t => t.sourceId === s.sourceId)
      );

      for (const source of nonTopSources) {
        updates.push(
          Source.findOneAndUpdate(
            { sourceId: source.sourceId },
            {
              $set: {
                score: source.scoring.totalScore,
                recommended: false,
                confidence: source.scoring.totalScore / 100
              }
            }
          )
        );
      }
    }

    // Execute all updates
    await Promise.all(updates);

    console.log(`[SourceSelection] Completed scoring. Recommendations:`,
      JSON.stringify(recommendations, null, 2));

    return {
      success: true,
      sessionId,
      totalSources: sources.length,
      recommendations,
      summary: {
        totalRecommended: Object.values(recommendations).reduce((sum, r) => sum + r.recommended, 0),
        averageScore: Math.round(
          scoredSources.reduce((sum, s) => sum + s.scoring.totalScore, 0) / scoredSources.length
        ),
        highestScore: Math.max(...scoredSources.map(s => s.scoring.totalScore)),
        lowestScore: Math.min(...scoredSources.map(s => s.scoring.totalScore))
      }
    };
  }

  /**
   * Assess the quality of sources selected for Phase 2
   * Uses Claude to evaluate whether the selected sources will produce a good Phase 3 report
   * @param {string} idrssd - Bank IDRSSD
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} - Quality assessment with decision
   */
  async assessPhase2Quality(idrssd, sessionId) {
    // Get all approved/recommended sources for this session
    const approvedSources = await Source.find({
      idrssd,
      sessionId,
      $or: [
        { status: 'approved' },
        { recommended: true }
      ]
    }).lean();

    if (approvedSources.length === 0) {
      return {
        decision: 'reject',
        confidence: 1.0,
        reasoning: 'No sources have been approved or recommended for this bank. Cannot proceed to Phase 3 without source materials.',
        recommendations: [
          'Run Phase 1 source gathering if not already done',
          'Review and approve sources found during Phase 1',
          'Consider expanding search criteria if no quality sources were found'
        ]
      };
    }

    // Prepare source summary for Claude
    const sourceSummary = approvedSources.map(source => ({
      category: source.category,
      title: source.title,
      url: source.url,
      date: source.date,
      score: source.score,
      authority: source.scoring?.breakdown?.authority || 'unknown',
      depth: source.scoring?.breakdown?.depth || 'unknown',
      freshness: source.scoring?.breakdown?.freshness || 'unknown',
      contentLength: source.contentLength,
      contentType: source.contentType,
      fetchable: source.fetchable
    }));

    // Group by category
    const byCategory = sourceSummary.reduce((acc, source) => {
      if (!acc[source.category]) acc[source.category] = [];
      acc[source.category].push(source);
      return acc;
    }, {});

    const assessmentPrompt = `You are assessing whether the selected sources for a bank research report are sufficient to produce a high-quality Phase 3 research report.

**Context:**
- Bank IDRSSD: ${idrssd}
- Session ID: ${sessionId}
- Total sources selected: ${approvedSources.length}

**Sources by Category:**
${JSON.stringify(byCategory, null, 2)}

**Assessment Criteria:**

1. **Coverage** - Do we have sufficient diversity of source types?
   - Ideal: Investor presentations, earnings transcripts, management interviews, tech announcements
   - Minimum: At least 2 different types of sources

2. **Authority** - Are sources from authoritative, credible origins?
   - Look for official investor relations sites, reputable financial news, official transcripts
   - Red flag: Only low-authority sources (blogs, forums, unverified sites)

3. **Depth** - Is there substantive content to work with?
   - Look for comprehensive documents (high content length, PDF presentations)
   - Red flag: Only short snippets or truncated content

4. **Freshness** - Is the information recent and relevant?
   - Ideal: Sources from last 12 months
   - Acceptable: Sources from last 24 months
   - Red flag: All sources older than 2 years

**Your Task:**
Evaluate whether these sources will produce a HIGH-QUALITY Phase 3 research report. Consider:
- Will there be enough substantive information to write detailed analysis?
- Are sources credible enough to base investment insights on?
- Is information recent enough to be actionable?
- Are there any critical gaps (e.g., no investor presentations, no recent data)?

**Response Format:**
Return a JSON object with:
{
  "decision": "approve" or "reject",
  "confidence": 0.0 to 1.0,
  "reasoning": "Detailed explanation of your decision",
  "strengths": ["List of 2-4 strengths"],
  "weaknesses": ["List of 2-4 weaknesses"],
  "recommendations": ["List of 2-4 actionable recommendations"],
  "missingCategories": ["Categories that should be added"]
}

**Decision Guidelines:**
- "approve" if sources meet minimum criteria for a decent report (even if not perfect)
- "reject" if sources are clearly insufficient, too old, or lack credibility

Be practical but maintain quality standards. A good report requires good sources.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: assessmentPrompt
        }]
      });

      const textContent = response.content.find(c => c.type === 'text')?.text || '';

      // Extract JSON from response
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const assessment = JSON.parse(jsonMatch[0]);

        console.log(`[SourceSelection] Phase 2 quality assessment:`,
          JSON.stringify(assessment, null, 2));

        return {
          ...assessment,
          metadata: {
            idrssd,
            sessionId,
            totalSources: approvedSources.length,
            assessedAt: new Date().toISOString()
          }
        };
      } else {
        throw new Error('Could not parse assessment response');
      }
    } catch (error) {
      console.error('[SourceSelection] Error assessing Phase 2 quality:', error);
      return {
        decision: 'reject',
        confidence: 0.0,
        reasoning: `Error during assessment: ${error.message}`,
        error: error.message
      };
    }
  }
}

module.exports = SourceSelectionService;
