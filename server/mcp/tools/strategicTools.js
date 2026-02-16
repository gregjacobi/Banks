const StrategicPrioritiesAnalysis = require('../../models/StrategicPrioritiesAnalysis');
const BankMetadata = require('../../models/BankMetadata');
const Institution = require('../../models/Institution');

function register(server) {
  // get-strategic-priorities: industry-wide or bank-specific strategic priorities
  server.tool(
    'get-strategic-priorities',
    'Get strategic priorities analysis. Without an idrssd, returns the latest industry-wide analysis of banking strategic priorities. With an idrssd, returns bank-specific priorities alongside industry context.',
    {
      idrssd: { type: 'string', description: 'Optional bank ID for bank-specific priorities. Omit for industry-wide analysis.' },
    },
    async ({ idrssd }) => {
      try {
        const analysis = await StrategicPrioritiesAnalysis.getLatest();

        if (!analysis) {
          return { content: [{ type: 'text', text: 'No strategic priorities analysis found. Run the analysis first.' }] };
        }

        if (!idrssd) {
          // Return industry-wide analysis
          return {
            content: [{ type: 'text', text: JSON.stringify({
              analysisDate: analysis.analysisDate,
              coverage: analysis.coverage,
              categories: analysis.categories,
              industrySummary: analysis.industrySummary,
              differentiatingStrategies: analysis.differentiatingStrategies,
            }, null, 2) }],
          };
        }

        // Bank-specific: get metadata + filter industry analysis
        const [metadata, institution] = await Promise.all([
          BankMetadata.findOne({ idrssd }).lean(),
          Institution.findOne({ idrssd }).lean(),
        ]);

        if (!institution) {
          return { content: [{ type: 'text', text: `No bank found with idrssd '${idrssd}'.` }] };
        }

        // Filter categories to show which ones mention this bank
        const bankName = institution.name;
        const relevantCategories = analysis.categories?.map(cat => {
          const bankPriorities = cat.priorities?.filter(p =>
            p.banks?.some(b => b.idrssd === idrssd || b.name === bankName)
          ) || [];
          return {
            name: cat.name,
            description: cat.description,
            bankPriorities,
            relevantToBank: bankPriorities.length > 0,
          };
        }).filter(cat => cat.relevantToBank) || [];

        const result = {
          bank: {
            idrssd: institution.idrssd,
            name: institution.name,
          },
          bankMetadata: metadata?.strategicPriorities || metadata?.insights?.strategicPriorities || null,
          relevantIndustryCategories: relevantCategories,
          industrySummary: analysis.industrySummary,
          analysisDate: analysis.analysisDate,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching strategic priorities: ${error.message}` }], isError: true };
      }
    }
  );

  // search-priorities: search within strategic priorities
  server.tool(
    'search-priorities',
    'Search across strategic priorities for specific topics, technologies, or themes. Returns matching priorities from the latest industry analysis.',
    {
      query: { type: 'string', description: 'Search query (e.g., "AI", "digital transformation", "core banking")' },
    },
    async ({ query }) => {
      try {
        const analysis = await StrategicPrioritiesAnalysis.getLatest();

        if (!analysis) {
          return { content: [{ type: 'text', text: 'No strategic priorities analysis found.' }] };
        }

        const queryLower = query.toLowerCase();
        const matches = [];

        // Search across categories and priorities
        for (const category of (analysis.categories || [])) {
          for (const priority of (category.priorities || [])) {
            const text = [
              priority.name,
              priority.description,
              priority.theme,
              ...(priority.keywords || []),
            ].filter(Boolean).join(' ').toLowerCase();

            if (text.includes(queryLower)) {
              matches.push({
                category: category.name,
                priority: priority.name,
                description: priority.description,
                theme: priority.theme,
                banks: priority.banks?.map(b => ({ name: b.name, idrssd: b.idrssd })) || [],
                prevalence: priority.prevalence,
              });
            }
          }
        }

        // Also search differentiating strategies
        const diffMatches = (analysis.differentiatingStrategies || []).filter(s => {
          const text = [s.strategy, s.description, s.bank].filter(Boolean).join(' ').toLowerCase();
          return text.includes(queryLower);
        });

        const result = {
          query,
          matchCount: matches.length + diffMatches.length,
          priorities: matches,
          differentiatingStrategies: diffMatches,
          analysisDate: analysis.analysisDate,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error searching priorities: ${error.message}` }], isError: true };
      }
    }
  );
}

module.exports = { register };
