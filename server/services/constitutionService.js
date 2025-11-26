const Anthropic = require('@anthropic-ai/sdk');
const groundingService = require('./groundingService');
const researchConstitution = require('../prompts/researchConstitution');
const modelResolver = require('./modelResolver');

/**
 * Constitution Service
 *
 * Provides RAG-powered suggestions for improving the agent research constitution
 * based on expert knowledge stored in the grounding database.
 */
class ConstitutionService {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    this.model = modelResolver.getModelSync();
    this.initializeModel();
  }

  async initializeModel() {
    try {
      const latestModel = await modelResolver.getLatestKitModel();
      this.model = latestModel;
      console.log(`ConstitutionService initialized with model: ${this.model}`);
    } catch (error) {
      console.error('Error initializing model:', error.message);
    }
  }

  /**
   * Get the current research constitution
   * @returns {string} The current constitution text
   */
  getCurrentConstitution() {
    const mockContext = {
      bankName: '[Bank Name]',
      bankCity: '[City]',
      bankState: '[State]',
      totalAssets: 1000000000,
      quarterCount: 8,
      peerCount: 15,
      sourceCount: 10,
      pdfCount: 2
    };
    return researchConstitution.getResearchConstitution(mockContext);
  }

  /**
   * Analyze the constitution and suggest improvements using RAG
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis results with suggestions
   */
  async suggestImprovements(options = {}) {
    const {
      focusArea = 'general', // 'general', 'metrics', 'strategic_initiatives', 'leadership', 'technology'
      maxSuggestions = 5
    } = options;

    console.log(`[ConstitutionService] Analyzing constitution with focus: ${focusArea}`);

    // Get current constitution
    const currentConstitution = this.getCurrentConstitution();

    // Retrieve relevant RAG chunks based on focus area
    const queries = this._buildQueriesForFocus(focusArea);
    let groundingChunks = [];

    try {
      for (const query of queries) {
        // Filter to only global research agent grounding (idrssd: null), not bank-specific documents
        const chunks = await groundingService.retrieveChunks(query, { idrssd: null }, 3);
        groundingChunks.push(...chunks);
      }

      // Dedupe chunks
      const seen = new Set();
      groundingChunks = groundingChunks.filter(chunk => {
        const key = chunk.content.substring(0, 100);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      console.log(`[ConstitutionService] Retrieved ${groundingChunks.length} grounding chunks`);
    } catch (error) {
      console.error('[ConstitutionService] Error retrieving grounding chunks:', error);
      throw new Error('Failed to retrieve expert guidance');
    }

    // Build grounding context
    let groundingContext = '';
    if (groundingChunks.length > 0) {
      groundingContext = '\n\n## Expert Knowledge Documents\n\n';
      groundingChunks.forEach((chunk, index) => {
        groundingContext += `[Document ${index + 1}] ${chunk.documentTitle || 'Expert Guidance'}, p.${chunk.pageNumber || 'N/A'}:\n${chunk.content}\n\n`;
      });
    }

    // Create prompt for Claude to analyze and suggest improvements
    const analysisPrompt = `You are an expert in financial research methodologies and agent system design. Your task is to analyze the current research constitution and suggest improvements based on expert knowledge.

## Current Research Constitution

${currentConstitution}
${groundingContext}

## Analysis Task

Focus Area: ${focusArea === 'general' ? 'Overall improvements across all areas' : focusArea}

Based on the expert knowledge provided above, analyze the current research constitution and suggest up to ${maxSuggestions} specific, actionable improvements.

For each suggestion, provide:
1. **Section**: Which part of the constitution to improve (e.g., "Research Process Step 3", "Strategic Initiative Discovery", "Metric Interpretation")
2. **Current Gap**: What's missing or could be improved in the current constitution
3. **Suggested Change**: Specific text or guidance to add/modify
4. **Rationale**: Why this improvement matters, citing expert knowledge when possible
5. **Impact**: Expected benefit (e.g., "Improves research depth", "Reduces oversight risk", "Better strategic insights")
6. **Priority**: high, medium, or low

${focusArea !== 'general' ? `Focus specifically on improvements related to: ${focusArea}` : ''}

Return your analysis as a JSON array of suggestions with the following structure:
[
  {
    "section": "Section name",
    "currentGap": "Description of gap",
    "suggestedChange": "Specific change to make",
    "rationale": "Why this matters",
    "impact": "Expected benefit",
    "priority": "high|medium|low",
    "relatedDocuments": ["Document 1", "Document 2"]
  }
]

Important:
- Be specific and actionable
- Cite expert knowledge when relevant
- Focus on high-impact improvements
- Ensure suggestions are practical for an AI agent to follow
- Don't suggest changes that make the constitution significantly longer without clear benefit`;

    // Call Claude to analyze
    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 16000,
      thinking: {
        type: 'enabled',
        budget_tokens: 10000
      },
      messages: [{
        role: 'user',
        content: analysisPrompt
      }]
    });

    // Extract suggestions from response
    const textContent = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    let suggestions = [];
    try {
      // Try to extract JSON from the response
      const jsonMatch = textContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON array found in response');
      }
    } catch (error) {
      console.error('[ConstitutionService] Error parsing suggestions:', error);
      // Return structured error
      suggestions = [{
        section: 'Error',
        currentGap: 'Failed to parse suggestions',
        suggestedChange: textContent.substring(0, 500),
        rationale: 'Parser error',
        impact: 'None',
        priority: 'low',
        relatedDocuments: []
      }];
    }

    return {
      success: true,
      focusArea,
      suggestionsCount: suggestions.length,
      suggestions,
      groundingDocuments: groundingChunks.map(chunk => ({
        title: chunk.documentTitle || 'Expert Guidance',
        page: chunk.pageNumber,
        preview: chunk.content.substring(0, 200)
      })),
      analysisMetadata: {
        model: this.model,
        timestamp: new Date().toISOString(),
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      }
    };
  }

  /**
   * Build RAG queries based on focus area
   * @param {string} focusArea - Area to focus on
   * @returns {Array<string>} Query strings
   */
  _buildQueriesForFocus(focusArea) {
    const queryMap = {
      general: [
        'Best practices for financial research agent design and methodology',
        'Comprehensive financial analysis frameworks for banks',
        'Research quality assurance and validation techniques'
      ],
      metrics: [
        'Key financial metrics for bank analysis and interpretation',
        'Operating leverage and efficiency ratio analysis methodology',
        'Financial metric best practices for community and regional banks'
      ],
      strategic_initiatives: [
        'Identifying and analyzing strategic initiatives in banks',
        'Technology and digital transformation assessment in banking',
        'Strategic priority discovery methods'
      ],
      leadership: [
        'Executive leadership research and profiling methods',
        'Management quality assessment in financial institutions',
        'Leadership team analysis for banks'
      ],
      technology: [
        'Banking technology assessment frameworks',
        'Digital transformation evaluation methodologies',
        'AI and digital labor opportunities in banking'
      ]
    };

    return queryMap[focusArea] || queryMap.general;
  }

  /**
   * Apply a specific suggestion to the constitution
   * @param {string} suggestion - The suggestion to apply
   * @returns {Promise<Object>} Result of applying the suggestion
   */
  async applySuggestion(suggestion) {
    // This would need to be implemented to actually modify the constitution file
    // For now, return a placeholder
    console.log(`[ConstitutionService] Would apply suggestion to section: ${suggestion.section}`);

    return {
      success: true,
      message: 'Constitution update feature coming soon',
      suggestion: suggestion.section
    };
  }

  /**
   * Get constitution sections for targeted analysis
   * @returns {Array<Object>} Constitution sections
   */
  getConstitutionSections() {
    return [
      {
        id: 'research_process',
        name: 'Research Process',
        description: 'Step-by-step research methodology'
      },
      {
        id: 'focus_areas',
        name: 'Focus Areas',
        description: 'Strategic initiatives, technology, financial analysis'
      },
      {
        id: 'metrics',
        name: 'Metric Interpretation',
        description: 'Financial metrics guidance and formulas'
      },
      {
        id: 'leadership',
        name: 'Leadership Research',
        description: 'Executive profiling and research'
      },
      {
        id: 'mandatory_analysis',
        name: 'Mandatory Requirements',
        description: 'Required analyses and searches'
      }
    ];
  }
}

module.exports = ConstitutionService;
