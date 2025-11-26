const Anthropic = require('@anthropic-ai/sdk');
const modelResolver = require('./modelResolver');
const BankMetadata = require('../models/BankMetadata');
const FinancialStatement = require('../models/FinancialStatement');
const StrategicPrioritiesAnalysis = require('../models/StrategicPrioritiesAnalysis');

/**
 * Strategic Priorities Agent
 * Analyzes strategic priorities across all banks to identify industry themes,
 * categorize priorities, and find differentiating strategies
 */
class StrategicPrioritiesAgent {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 300000 // 5 minutes for complex analysis
    });
    this.model = modelResolver.getModelSync();
    this.initializeModel();
  }

  async initializeModel() {
    try {
      const latestModel = await modelResolver.getLatestKitModel();
      this.model = latestModel;
      console.log(`StrategicPrioritiesAgent initialized with model: ${this.model}`);
    } catch (error) {
      console.error('Error initializing model:', error.message);
    }
  }

  /**
   * Gather all strategic priorities data from banks
   * @returns {Promise<Object>} Raw data for analysis
   */
  async gatherPrioritiesData() {
    console.log('Gathering strategic priorities data from all banks...');

    // Get all banks with strategic priorities
    const banksWithPriorities = await BankMetadata.find({
      'strategicInsights.status': 'completed',
      'strategicInsights.priorities.0': { $exists: true }
    }).lean();

    console.log(`Found ${banksWithPriorities.length} banks with strategic priorities`);

    // Get financial data for asset sizes
    const idrssdList = banksWithPriorities.map(b => b.idrssd);
    const latestStatements = await FinancialStatement.aggregate([
      { $match: { idrssd: { $in: idrssdList } } },
      { $sort: { reportingPeriod: -1 } },
      {
        $group: {
          _id: '$idrssd',
          totalAssets: { $first: '$balanceSheet.assets.totalAssets' }
        }
      }
    ]);

    const assetMap = new Map(latestStatements.map(s => [s._id, s.totalAssets]));

    // Get total banks count
    const totalBanks = await BankMetadata.countDocuments();

    // Combine data
    const banksData = banksWithPriorities.map(bank => ({
      idrssd: bank.idrssd,
      bankName: bank.bankName,
      totalAssets: assetMap.get(bank.idrssd) || 0,
      priorities: bank.strategicInsights.priorities || [],
      focusMetrics: bank.strategicInsights.focusMetrics || [],
      techPartnerships: bank.strategicInsights.techPartnerships || []
    }));

    // Calculate statistics
    const totalPriorities = banksData.reduce((sum, b) => sum + b.priorities.length, 0);
    const banksWithFocusMetrics = banksData.filter(b => b.focusMetrics.length > 0).length;
    const banksWithTechPartnerships = banksData.filter(b => b.techPartnerships.length > 0).length;
    const totalAssetsRepresented = banksData.reduce((sum, b) => sum + (b.totalAssets || 0), 0);

    return {
      banks: banksData,
      stats: {
        totalBanks,
        banksWithPriorities: banksWithPriorities.length,
        banksWithFocusMetrics,
        banksWithTechPartnerships,
        totalPrioritiesAnalyzed: totalPriorities,
        averagePrioritiesPerBank: totalPriorities / banksWithPriorities.length,
        totalAssetsRepresented
      }
    };
  }

  /**
   * Run the full strategic priorities analysis
   * @returns {Promise<Object>} Complete analysis results
   */
  async runAnalysis() {
    const startTime = Date.now();
    console.log('Starting strategic priorities analysis...');

    // Gather data
    const rawData = await this.gatherPrioritiesData();

    if (rawData.banks.length === 0) {
      throw new Error('No banks with strategic priorities found. Run batch research first.');
    }

    console.log(`Analyzing ${rawData.stats.totalPrioritiesAnalyzed} priorities across ${rawData.stats.banksWithPriorities} banks...`);

    // Step 1: Categorize priorities
    console.log('Step 1: Categorizing priorities into themes...');
    const categories = await this.categorizePriorities(rawData.banks);

    // Step 2: Generate industry summary
    console.log('Step 2: Generating industry-level insights...');
    const industrySummary = await this.generateIndustrySummary(rawData.banks, categories);

    // Step 3: Identify differentiating strategies
    console.log('Step 3: Identifying differentiating strategies...');
    const differentiatingStrategies = await this.identifyDifferentiatingStrategies(rawData.banks, categories);

    // Step 4: Analyze focus metrics (if available)
    console.log('Step 4: Analyzing focus metrics...');
    const focusMetricsAnalysis = this.analyzeFocusMetrics(rawData.banks);

    // Step 5: Analyze tech partnerships (if available)
    console.log('Step 5: Analyzing technology partnerships...');
    const techPartnershipsAnalysis = this.analyzeTechPartnerships(rawData.banks);

    const processingTime = (Date.now() - startTime) / 1000;
    console.log(`Analysis completed in ${processingTime.toFixed(1)} seconds`);

    // Create analysis document
    const analysis = new StrategicPrioritiesAnalysis({
      analysisDate: new Date(),
      coverage: {
        totalBanks: rawData.stats.totalBanks,
        banksWithPriorities: rawData.stats.banksWithPriorities,
        banksWithFocusMetrics: rawData.stats.banksWithFocusMetrics,
        banksWithTechPartnerships: rawData.stats.banksWithTechPartnerships,
        totalPrioritiesAnalyzed: rawData.stats.totalPrioritiesAnalyzed,
        averagePrioritiesPerBank: rawData.stats.averagePrioritiesPerBank,
        totalAssetsRepresented: rawData.stats.totalAssetsRepresented
      },
      categories,
      industrySummary,
      differentiatingStrategies,
      focusMetricsAnalysis,
      techPartnershipsAnalysis,
      rawData: {
        banksAnalyzed: rawData.banks.map(b => ({
          idrssd: b.idrssd,
          bankName: b.bankName,
          totalAssets: b.totalAssets,
          priorityCount: b.priorities.length
        }))
      },
      analysisMetadata: {
        model: this.model,
        processingTime,
        version: '1.0'
      }
    });

    await analysis.save();
    console.log(`Analysis saved with ID: ${analysis._id}`);

    return analysis;
  }

  /**
   * Categorize priorities into logical themes using Claude
   * @param {Array} banks - Bank data with priorities
   * @returns {Promise<Array>} Categorized priorities
   */
  async categorizePriorities(banks) {
    // Flatten all priorities with bank context
    const allPriorities = [];
    banks.forEach(bank => {
      bank.priorities.forEach(priority => {
        allPriorities.push({
          title: priority.title,
          description: priority.description,
          bankName: bank.bankName,
          idrssd: bank.idrssd,
          totalAssets: bank.totalAssets,
          citations: priority.citations || []
        });
      });
    });

    // Build prompt for categorization
    const prioritiesText = allPriorities.map((p, i) =>
      `${i + 1}. "${p.title}" - ${p.bankName}\n   Description: ${p.description?.substring(0, 200)}...`
    ).join('\n');

    const prompt = `You are analyzing strategic priorities from ${banks.length} banks in the US banking industry.

Here are all ${allPriorities.length} strategic priorities extracted from investor presentations and earnings calls:

${prioritiesText}

## Task
Categorize these priorities into logical thematic groups. Banks often express similar priorities in different ways.

## Requirements
1. Create 6-10 categories that capture the main strategic themes
2. Each category should have a clear, descriptive name
3. Group similar priorities together even if worded differently
4. For each priority in a category, note which banks have it
5. Identify common language/phrases used across banks for similar priorities

## Response Format (JSON)
{
  "categories": [
    {
      "name": "Category Name",
      "description": "Brief description of this strategic theme",
      "priorityIndices": [1, 5, 12, 23],  // Indices from the list above (1-indexed)
      "commonLanguage": ["phrase 1", "phrase 2"]
    }
  ]
}

Return ONLY valid JSON.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 8000,
        thinking: {
          type: 'enabled',
          budget_tokens: 6000
        },
        messages: [{ role: 'user', content: prompt }]
      });

      // Extract text content (skip thinking blocks)
      const textContent = response.content.find(c => c.type === 'text');
      const analysisText = textContent?.text || '';

      // Parse JSON response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('Failed to parse categorization response');
        return this.fallbackCategorization(allPriorities);
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Build full category objects with bank details
      const categories = parsed.categories.map(cat => {
        const prioritiesInCategory = cat.priorityIndices.map(idx => {
          const priority = allPriorities[idx - 1]; // Convert 1-indexed to 0-indexed
          if (!priority) return null;
          return {
            title: priority.title,
            normalizedTitle: this.normalizeTitle(priority.title),
            description: priority.description,
            banks: [{
              idrssd: priority.idrssd,
              bankName: priority.bankName,
              totalAssets: priority.totalAssets,
              originalTitle: priority.title,
              originalDescription: priority.description,
              citations: priority.citations
            }]
          };
        }).filter(Boolean);

        // Merge priorities with same normalized title
        const mergedPriorities = this.mergeSimilarPriorities(prioritiesInCategory);

        // Count unique banks in this category
        const uniqueBanks = new Set();
        mergedPriorities.forEach(p => p.banks.forEach(b => uniqueBanks.add(b.idrssd)));

        return {
          name: cat.name,
          description: cat.description,
          bankCount: uniqueBanks.size,
          prevalence: (uniqueBanks.size / banks.length) * 100,
          priorities: mergedPriorities.map(p => ({
            ...p,
            bankCount: p.banks.length
          })),
          commonLanguage: cat.commonLanguage || []
        };
      });

      // Sort by prevalence
      categories.sort((a, b) => b.prevalence - a.prevalence);

      return categories;

    } catch (error) {
      console.error('Error in categorization:', error);
      return this.fallbackCategorization(allPriorities);
    }
  }

  /**
   * Normalize a priority title for matching
   */
  normalizeTitle(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Merge priorities with similar titles
   */
  mergeSimilarPriorities(priorities) {
    const merged = new Map();

    priorities.forEach(priority => {
      const key = priority.normalizedTitle;
      if (merged.has(key)) {
        // Add bank to existing priority
        merged.get(key).banks.push(...priority.banks);
      } else {
        merged.set(key, { ...priority });
      }
    });

    return Array.from(merged.values());
  }

  /**
   * Fallback categorization if Claude fails
   */
  fallbackCategorization(priorities) {
    // Simple keyword-based categorization
    const categoryKeywords = {
      'Digital Transformation': ['digital', 'technology', 'cloud', 'mobile', 'online', 'platform'],
      'AI & Automation': ['ai', 'artificial intelligence', 'automation', 'machine learning', 'agentic'],
      'Customer Experience': ['customer', 'client', 'experience', 'service', 'relationship'],
      'Efficiency & Cost': ['efficiency', 'cost', 'expense', 'optimize', 'streamline', 'rationalize'],
      'Growth & Expansion': ['growth', 'expand', 'scale', 'market', 'acquisition'],
      'Risk & Compliance': ['risk', 'compliance', 'regulatory', 'credit', 'capital'],
      'ESG & Sustainability': ['esg', 'sustainability', 'environmental', 'social', 'governance'],
      'Talent & Culture': ['talent', 'employee', 'culture', 'workforce', 'diversity']
    };

    const categories = Object.entries(categoryKeywords).map(([name, keywords]) => {
      const matchingPriorities = priorities.filter(p => {
        const text = `${p.title} ${p.description}`.toLowerCase();
        return keywords.some(kw => text.includes(kw));
      });

      const uniqueBanks = new Set(matchingPriorities.map(p => p.idrssd));

      return {
        name,
        description: `Priorities related to ${name.toLowerCase()}`,
        bankCount: uniqueBanks.size,
        prevalence: (uniqueBanks.size / new Set(priorities.map(p => p.idrssd)).size) * 100,
        priorities: matchingPriorities.map(p => ({
          title: p.title,
          normalizedTitle: this.normalizeTitle(p.title),
          description: p.description,
          banks: [{
            idrssd: p.idrssd,
            bankName: p.bankName,
            totalAssets: p.totalAssets,
            originalTitle: p.title,
            originalDescription: p.description,
            citations: p.citations
          }],
          bankCount: 1
        })),
        commonLanguage: keywords
      };
    }).filter(c => c.priorities.length > 0);

    return categories;
  }

  /**
   * Generate industry-level summary and insights
   */
  async generateIndustrySummary(banks, categories) {
    // Prepare summary data
    const topCategories = categories.slice(0, 5).map(c => ({
      name: c.name,
      bankCount: c.bankCount,
      prevalence: c.prevalence.toFixed(1),
      topPriorities: c.priorities.slice(0, 3).map(p => p.title)
    }));

    const prompt = `You are a banking industry analyst reviewing strategic priorities across ${banks.length} US banks.

## Top Strategic Themes (by prevalence)
${topCategories.map((c, i) =>
  `${i + 1}. ${c.name} (${c.bankCount} banks, ${c.prevalence}%)
     Key priorities: ${c.topPriorities.join(', ')}`
).join('\n')}

## Banks Analyzed
${banks.slice(0, 10).map(b => `- ${b.bankName}: ${b.priorities.length} priorities`).join('\n')}
${banks.length > 10 ? `... and ${banks.length - 10} more banks` : ''}

## Task
Generate industry-level insights about the strategic direction of US banking.

## Requirements
1. Identify top 5 themes with explanations
2. Note 3-5 key observations about industry direction
3. Identify 2-3 emerging trends (themes with lower prevalence but notable significance)

## Response Format (JSON)
{
  "topThemes": [
    {
      "theme": "Theme Name",
      "description": "Why this theme is important",
      "bankCount": 15,
      "prevalence": 75.0,
      "exampleBanks": ["Bank 1", "Bank 2"]
    }
  ],
  "keyObservations": [
    {
      "observation": "Key observation about industry",
      "supportingEvidence": "Evidence from the data"
    }
  ],
  "emergingTrends": [
    {
      "trend": "Trend name",
      "description": "Why this is emerging",
      "bankCount": 3,
      "banks": ["Bank A", "Bank B", "Bank C"]
    }
  ]
}

Return ONLY valid JSON.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        thinking: {
          type: 'enabled',
          budget_tokens: 4000
        },
        messages: [{ role: 'user', content: prompt }]
      });

      const textContent = response.content.find(c => c.type === 'text');
      const analysisText = textContent?.text || '';

      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Error generating industry summary:', error);
    }

    // Fallback summary
    return {
      topThemes: categories.slice(0, 5).map(c => ({
        theme: c.name,
        description: c.description,
        bankCount: c.bankCount,
        prevalence: c.prevalence,
        exampleBanks: c.priorities.slice(0, 3).flatMap(p => p.banks.map(b => b.bankName))
      })),
      keyObservations: [{
        observation: 'Analysis requires manual review',
        supportingEvidence: 'Automated analysis could not be completed'
      }],
      emergingTrends: []
    };
  }

  /**
   * Identify differentiating strategies (unique to 1-3 banks)
   */
  async identifyDifferentiatingStrategies(banks, categories) {
    // Find priorities that appear in only 1-3 banks
    const allPrioritiesWithBanks = [];
    categories.forEach(cat => {
      cat.priorities.forEach(priority => {
        if (priority.bankCount <= 3) {
          allPrioritiesWithBanks.push({
            ...priority,
            category: cat.name
          });
        }
      });
    });

    // Also check for priorities not in any category
    banks.forEach(bank => {
      bank.priorities.forEach(priority => {
        const isInCategory = categories.some(cat =>
          cat.priorities.some(p => p.normalizedTitle === this.normalizeTitle(priority.title))
        );
        if (!isInCategory) {
          allPrioritiesWithBanks.push({
            title: priority.title,
            normalizedTitle: this.normalizeTitle(priority.title),
            description: priority.description,
            banks: [{
              idrssd: bank.idrssd,
              bankName: bank.bankName,
              totalAssets: bank.totalAssets,
              originalTitle: priority.title,
              originalDescription: priority.description,
              citations: priority.citations || []
            }],
            bankCount: 1,
            category: 'Uncategorized'
          });
        }
      });
    });

    // Filter to unique ones and prepare for Claude analysis
    const uniquePriorities = allPrioritiesWithBanks.filter(p => p.bankCount <= 3);

    if (uniquePriorities.length === 0) {
      return [];
    }

    const prompt = `You are analyzing unique strategic priorities that only 1-3 banks out of ${banks.length} are pursuing.

## Unique/Rare Priorities
${uniquePriorities.slice(0, 30).map((p, i) =>
  `${i + 1}. "${p.title}" (${p.banks.map(b => b.bankName).join(', ')})
     Category: ${p.category}
     Description: ${p.description?.substring(0, 150)}...`
).join('\n')}

## Task
Identify the most notable differentiating strategies - priorities that are truly unique and potentially give competitive advantage.

## Requirements
1. Select the top 10 most interesting differentiating strategies
2. Explain why each is notable/unique
3. Consider if the strategy relates to specific market focus, innovation, or competitive positioning

## Response Format (JSON)
{
  "differentiatingStrategies": [
    {
      "index": 1,
      "uniquenessReason": "Why this strategy stands out",
      "category": "Technology/Market Focus/Product Innovation/etc"
    }
  ]
}

Return ONLY valid JSON.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        thinking: {
          type: 'enabled',
          budget_tokens: 3000
        },
        messages: [{ role: 'user', content: prompt }]
      });

      const textContent = response.content.find(c => c.type === 'text');
      const analysisText = textContent?.text || '';

      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        return parsed.differentiatingStrategies.map(ds => {
          const priority = uniquePriorities[ds.index - 1];
          if (!priority) return null;
          return {
            title: priority.title,
            description: priority.description,
            uniquenessReason: ds.uniquenessReason,
            banks: priority.banks,
            bankCount: priority.bankCount,
            category: ds.category || priority.category
          };
        }).filter(Boolean);
      }
    } catch (error) {
      console.error('Error identifying differentiating strategies:', error);
    }

    // Fallback: return top 10 unique priorities
    return uniquePriorities.slice(0, 10).map(p => ({
      title: p.title,
      description: p.description,
      uniquenessReason: `Only pursued by ${p.bankCount} bank(s)`,
      banks: p.banks,
      bankCount: p.bankCount,
      category: p.category
    }));
  }

  /**
   * Analyze focus metrics across banks
   */
  analyzeFocusMetrics(banks) {
    const metricCounts = new Map();
    const metricBanks = new Map();

    banks.forEach(bank => {
      (bank.focusMetrics || []).forEach(fm => {
        const metric = fm.metric;
        metricCounts.set(metric, (metricCounts.get(metric) || 0) + 1);
        if (!metricBanks.has(metric)) {
          metricBanks.set(metric, []);
        }
        metricBanks.get(metric).push({
          idrssd: bank.idrssd,
          bankName: bank.bankName,
          commentary: fm.commentary
        });
      });
    });

    // Sort by count
    const sortedMetrics = Array.from(metricCounts.entries())
      .sort((a, b) => b[1] - a[1]);

    const banksWithMetrics = banks.filter(b => b.focusMetrics && b.focusMetrics.length > 0).length;

    return {
      topMetrics: sortedMetrics.slice(0, 10).map(([metric, count]) => ({
        metric,
        bankCount: count,
        prevalence: banksWithMetrics > 0 ? (count / banksWithMetrics) * 100 : 0,
        banks: metricBanks.get(metric)
      })),
      uniqueMetrics: sortedMetrics.filter(([_, count]) => count <= 2).slice(0, 10).map(([metric]) => ({
        metric,
        banks: metricBanks.get(metric)
      }))
    };
  }

  /**
   * Analyze technology partnerships across banks
   */
  analyzeTechPartnerships(banks) {
    const partnerCounts = new Map();
    const partnerBanks = new Map();
    const focusAreas = new Map();

    banks.forEach(bank => {
      (bank.techPartnerships || []).forEach(tp => {
        const partner = tp.partner;
        partnerCounts.set(partner, (partnerCounts.get(partner) || 0) + 1);
        if (!partnerBanks.has(partner)) {
          partnerBanks.set(partner, []);
        }
        partnerBanks.get(partner).push({
          idrssd: bank.idrssd,
          bankName: bank.bankName,
          description: tp.description
        });

        // Categorize by focus area
        const desc = (tp.description || '').toLowerCase();
        const areas = ['cloud', 'ai', 'payments', 'security', 'core banking', 'analytics', 'mobile'];
        areas.forEach(area => {
          if (desc.includes(area)) {
            focusAreas.set(area, (focusAreas.get(area) || 0) + 1);
          }
        });
      });
    });

    return {
      topPartners: Array.from(partnerCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([partner, count]) => ({
          partner,
          bankCount: count,
          banks: partnerBanks.get(partner)
        })),
      focusAreas: Array.from(focusAreas.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([area, count]) => ({
          area: area.charAt(0).toUpperCase() + area.slice(1),
          bankCount: count,
          examples: []
        }))
    };
  }
}

module.exports = new StrategicPrioritiesAgent();
