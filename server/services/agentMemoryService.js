const AgentMemory = require('../models/AgentMemory');
const Institution = require('../models/Institution');

/**
 * AgentMemoryService
 * Manages agent memory: storing and retrieving learned patterns, strategies, and queries
 */
class AgentMemoryService {
  /**
   * Get bank context for memory matching
   */
  static getBankContext(bankInfo, totalAssets) {
    // Determine asset size category
    let assetSize = 'small';
    if (totalAssets >= 100000000000) assetSize = 'mega'; // >= $100B
    else if (totalAssets >= 10000000000) assetSize = 'large'; // >= $10B
    else if (totalAssets >= 1000000000) assetSize = 'medium'; // >= $1B

    return {
      assetSize,
      region: bankInfo.state || null,
      bankType: bankInfo.bankType || null // Could be enhanced with actual classification
    };
  }

  /**
   * Retrieve relevant memories for a given context
   */
  static async getRelevantMemories(bankInfo, totalAssets, memoryTypes = null, useCase = null) {
    const context = this.getBankContext(bankInfo, totalAssets);
    
    const query = {
      $or: [
        // Exact context match
        {
          'contextTags.assetSize': context.assetSize,
          'contextTags.region': context.region
        },
        // Same asset size, any region
        {
          'contextTags.assetSize': context.assetSize,
          'contextTags.region': { $exists: false }
        },
        // Same region, similar asset size (one level up/down)
        {
          'contextTags.region': context.region
        },
        // General patterns (no specific context)
        {
          'contextTags.assetSize': { $exists: false },
          'contextTags.region': { $exists: false }
        }
      ]
    };

    if (memoryTypes) {
      query.memoryType = { $in: Array.isArray(memoryTypes) ? memoryTypes : [memoryTypes] };
    }

    if (useCase) {
      query.useCase = useCase;
    }

    // Get most successful and recently used patterns
    const memories = await AgentMemory.find(query)
      .sort({ 
        successCount: -1, 
        lastUsed: -1,
        usageCount: -1
      })
      .limit(50) // Top 50 relevant memories
      .lean();

    return memories;
  }

  /**
   * Get search query patterns that worked well
   */
  static async getSearchPatterns(bankInfo, totalAssets, focus = null) {
    const memories = await this.getRelevantMemories(
      bankInfo, 
      totalAssets, 
      'search_query_pattern',
      focus ? `search_${focus}` : null
    );

    return memories.map(m => ({
      pattern: m.pattern,
      example: m.example,
      successRate: m.successCount / m.usageCount,
      workedForBanks: m.workedFor?.length || 0,
      useCase: m.useCase
    }));
  }

  /**
   * Get document query patterns that were effective
   */
  static async getDocumentQueryPatterns(bankInfo, totalAssets, category = null) {
    const memories = await this.getRelevantMemories(
      bankInfo,
      totalAssets,
      'document_query_pattern',
      category ? `query_${category}` : null
    );

    return memories.map(m => ({
      pattern: m.pattern,
      example: m.example,
      successRate: m.successCount / m.usageCount,
      workedForBanks: m.workedFor?.length || 0
    }));
  }

  /**
   * Get analysis strategies that worked
   */
  static async getAnalysisStrategies(bankInfo, totalAssets) {
    const memories = await this.getRelevantMemories(
      bankInfo,
      totalAssets,
      'analysis_strategy'
    );

    return memories.map(m => ({
      strategy: m.pattern,
      example: m.example,
      successRate: m.successCount / m.usageCount,
      notes: m.notes
    }));
  }

  /**
   * Store a successful search query pattern
   */
  static async recordSuccessfulSearch(bankInfo, totalAssets, query, focus, sourcesFound, workedWell = true) {
    const context = this.getBankContext(bankInfo, totalAssets);
    
    // Normalize query pattern (remove bank-specific names for patterns)
    const pattern = this.normalizeQueryPattern(query);
    
    const memory = await AgentMemory.findOne({
      memoryType: 'search_query_pattern',
      pattern: pattern,
      useCase: focus ? `search_${focus}` : null
    });

    if (memory) {
      // Update existing memory
      memory.usageCount += 1;
      if (workedWell) {
        memory.successCount += 1;
      }
      memory.lastUsed = new Date();
      
      // Add to workedFor if not already there
      const existing = memory.workedFor.find(w => w.idrssd === bankInfo.idrssd);
      if (!existing && workedWell) {
        memory.workedFor.push({
          idrssd: bankInfo.idrssd,
          bankName: bankInfo.name,
          date: new Date(),
          result: {
            sourcesFound: sourcesFound || 0,
            relevanceScore: sourcesFound > 0 ? 8 : 3
          }
        });
      }
      
      await memory.save();
    } else {
      // Create new memory
      const newMemory = new AgentMemory({
        memoryType: 'search_query_pattern',
        contextTags: context,
        pattern: pattern,
        example: query, // Store original as example
        useCase: focus ? `search_${focus}` : null,
        successCount: workedWell ? 1 : 0,
        usageCount: 1,
        workedFor: workedWell ? [{
          idrssd: bankInfo.idrssd,
          bankName: bankInfo.name,
          date: new Date(),
          result: {
            sourcesFound: sourcesFound || 0,
            relevanceScore: sourcesFound > 0 ? 8 : 3
          }
        }] : []
      });
      await newMemory.save();
    }
  }

  /**
   * Store a successful document query pattern
   */
  static async recordSuccessfulDocumentQuery(bankInfo, totalAssets, question, category, relevantResults, workedWell = true) {
    const context = this.getBankContext(bankInfo, totalAssets);
    
    const pattern = this.normalizeQueryPattern(question);
    
    const memory = await AgentMemory.findOne({
      memoryType: 'document_query_pattern',
      pattern: pattern,
      useCase: `query_${category}`
    });

    if (memory) {
      memory.usageCount += 1;
      if (workedWell) {
        memory.successCount += 1;
      }
      memory.lastUsed = new Date();
      
      const existing = memory.workedFor.find(w => w.idrssd === bankInfo.idrssd);
      if (!existing && workedWell) {
        memory.workedFor.push({
          idrssd: bankInfo.idrssd,
          bankName: bankInfo.name,
          date: new Date(),
          result: {
            insightsGenerated: relevantResults || 0,
            relevanceScore: relevantResults > 0 ? 9 : 2
          }
        });
      }
      
      await memory.save();
    } else {
      const newMemory = new AgentMemory({
        memoryType: 'document_query_pattern',
        contextTags: context,
        pattern: pattern,
        example: question,
        useCase: `query_${category}`,
        successCount: workedWell ? 1 : 0,
        usageCount: 1,
        workedFor: workedWell ? [{
          idrssd: bankInfo.idrssd,
          bankName: bankInfo.name,
          date: new Date(),
          result: {
            insightsGenerated: relevantResults || 0,
            relevanceScore: relevantResults > 0 ? 9 : 2
          }
        }] : []
      });
      await newMemory.save();
    }
  }

  /**
   * Store an analysis strategy that worked
   */
  static async recordAnalysisStrategy(bankInfo, totalAssets, strategy, metrics, insightsGenerated) {
    const context = this.getBankContext(bankInfo, totalAssets);
    
    const memory = await AgentMemory.findOne({
      memoryType: 'analysis_strategy',
      pattern: strategy
    });

    if (memory) {
      memory.usageCount += 1;
      memory.successCount += 1;
      memory.lastUsed = new Date();
      await memory.save();
    } else {
      const newMemory = new AgentMemory({
        memoryType: 'analysis_strategy',
        contextTags: context,
        pattern: strategy,
        example: `${strategy} - Metrics: ${metrics.join(', ')}`,
        successCount: 1,
        usageCount: 1,
        workedFor: [{
          idrssd: bankInfo.idrssd,
          bankName: bankInfo.name,
          date: new Date(),
          result: {
            insightsGenerated: insightsGenerated || 0,
            relevanceScore: insightsGenerated > 0 ? 9 : 5
          }
        }]
      });
      await newMemory.save();
    }
  }

  /**
   * Store cross-bank patterns (patterns seen across multiple banks)
   */
  static async recordCrossBankPattern(pattern, banks, commonality) {
    const memory = await AgentMemory.findOne({
      memoryType: 'cross_bank_pattern',
      pattern: pattern
    });

    if (memory) {
      memory.successCount += banks.length;
      memory.usageCount += 1;
      memory.lastUsed = new Date();
      memory.notes = `Observed across ${banks.length} banks. ${commonality}`;
      await memory.save();
    } else {
      const newMemory = new AgentMemory({
        memoryType: 'cross_bank_pattern',
        pattern: pattern,
        example: `${pattern} - Common across: ${banks.map(b => b.name).join(', ')}`,
        successCount: banks.length,
        usageCount: 1,
        notes: commonality,
        workedFor: banks.map(b => ({
          idrssd: b.idrssd,
          bankName: b.name,
          date: new Date(),
          result: {
            relevanceScore: 7
          }
        }))
      });
      await newMemory.save();
    }
  }

  /**
   * Normalize query patterns by removing bank-specific names
   * This allows patterns to be reusable across banks
   */
  static normalizeQueryPattern(query) {
    if (!query) return '';
    
    // Replace bank names with placeholder
    let pattern = String(query);
    
    // Remove common date variations (2024, 2025, etc.)
    pattern = pattern.replace(/\b(20\d{2})\b/g, '[YEAR]');
    
    // Replace quoted bank names with placeholder (simple heuristic)
    // This is a simple approach - could be enhanced with NLP
    pattern = pattern.replace(/"[^"]*"/g, '"[BANK_NAME]"');
    
    return pattern.trim();
  }

  /**
   * Build memory context prompt for agent
   */
  static buildMemoryContext(memories) {
    if (!memories || memories.length === 0) {
      return '';
    }

    const sections = {
      searchPatterns: memories.filter(m => m.memoryType === 'search_query_pattern'),
      documentPatterns: memories.filter(m => m.memoryType === 'document_query_pattern'),
      analysisStrategies: memories.filter(m => m.memoryType === 'analysis_strategy'),
      crossBankPatterns: memories.filter(m => m.memoryType === 'cross_bank_pattern')
    };

    let context = '\n\n## Learned Patterns from Previous Research\n\n';
    context += 'The following patterns have been successful in similar banks. Use these as guidance:\n\n';

    if (sections.searchPatterns.length > 0) {
      context += '### Successful Search Query Patterns:\n';
      sections.searchPatterns.slice(0, 10).forEach((m, i) => {
        context += `${i + 1}. Pattern: "${m.pattern}"\n`;
        if (m.example) context += `   Example: "${m.example}"\n`;
        context += `   Success rate: ${((m.successCount / m.usageCount) * 100).toFixed(0)}% across ${m.workedFor?.length || 0} banks\n\n`;
      });
    }

    if (sections.documentPatterns.length > 0) {
      context += '### Effective Document Query Patterns:\n';
      sections.documentPatterns.slice(0, 10).forEach((m, i) => {
        context += `${i + 1}. Pattern: "${m.pattern}"\n`;
        if (m.example) context += `   Example: "${m.example}"\n`;
        context += `   Success rate: ${((m.successCount / m.usageCount) * 100).toFixed(0)}%\n\n`;
      });
    }

    if (sections.analysisStrategies.length > 0) {
      context += '### Effective Analysis Strategies:\n';
      sections.analysisStrategies.slice(0, 5).forEach((m, i) => {
        context += `${i + 1}. ${m.pattern}\n`;
        if (m.notes) context += `   Note: ${m.notes}\n`;
        context += `   Success rate: ${((m.successCount / m.usageCount) * 100).toFixed(0)}%\n\n`;
      });
    }

    if (sections.crossBankPatterns.length > 0) {
      context += '### Cross-Bank Patterns:\n';
      sections.crossBankPatterns.slice(0, 5).forEach((m, i) => {
        context += `${i + 1}. ${m.pattern}\n`;
        if (m.notes) context += `   Note: ${m.notes}\n\n`;
      });
    }

    context += '\n**Important:** Use these patterns as inspiration, but adapt them to the specific bank context. Do not blindly copy - think about how they apply to this bank.\n';

    return context;
  }
}

module.exports = AgentMemoryService;
