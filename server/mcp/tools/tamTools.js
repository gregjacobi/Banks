const { z } = require('zod');
const tamCalculationService = require('../../services/tamCalculationService');
const TeamRoster = require('../../models/TeamRoster');

function register(server, registerAppTool) {
  // get-tam-dashboard: TAM summary for all banks
  server.tool(
    'get-tam-dashboard',
    'Get Total Addressable Market (TAM) dashboard showing TAM calculations for all tracked banks. Returns bank-level TAM estimates sorted by opportunity size.',
    {
      limit: z.number().optional().describe('Max banks to return (default 100)'),
      minAssets: z.number().optional().describe('Minimum total assets filter in dollars (default 0)'),
      sortBy: z.string().optional().describe('Sort field: tam, totalAssets, or name (default tam)'),
      sortOrder: z.string().optional().describe('Sort order: asc or desc (default desc)'),
    },
    async ({ limit = 100, minAssets = 0, sortBy = 'tam', sortOrder = 'desc' }) => {
      try {
        const result = await tamCalculationService.calculateAllBanksTAM({
          limit,
          minAssets,
          sortBy,
          sortOrder,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching TAM dashboard: ${error.message}` }], isError: true };
      }
    }
  );

  // get-bank-tam: detailed TAM for one bank
  registerAppTool(server,
    'get-bank-tam',
    {
      title: 'Get Bank TAM',
      description: 'Get detailed TAM breakdown for a specific bank including product-level revenue estimates, penetration assumptions, and quarterly projections.',
      inputSchema: {
        idrssd: z.string().describe('Bank ID'),
        period: z.string().optional().describe('Optional reporting period (YYYY-MM-DD). Defaults to latest.'),
      },
      _meta: { ui: { resourceUri: 'ui://bank-explorer/tam-dashboard.html' } },
    },
    async ({ idrssd, period }) => {
      try {
        const result = await tamCalculationService.calculateBankTAM(idrssd, { period });

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching bank TAM: ${error.message}` }], isError: true };
      }
    }
  );

  // get-tam-aggregate: aggregate TAM across all banks
  server.tool(
    'get-tam-aggregate',
    'Get aggregate TAM totals across all tracked banks. Returns total addressable market by product category and segment.',
    {},
    async () => {
      try {
        const result = await tamCalculationService.calculateAllBanksTAM({
          limit: 10000,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify({
            aggregate: result.aggregate,
            bankCount: result.banks?.length || 0,
          }, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching TAM aggregate: ${error.message}` }], isError: true };
      }
    }
  );

  // get-revenue-pipeline: capacity-based revenue projections
  server.tool(
    'get-revenue-pipeline',
    'Get revenue pipeline projections based on team capacity and hiring plan. Shows quarterly and yearly revenue forecasts accounting for hiring ramp.',
    {
      targetBankCount: z.number().optional().describe('Target number of banks to cover (optional)'),
    },
    async ({ targetBankCount }) => {
      try {
        const teamSizingResult = await tamCalculationService.calculateTeamSizing({
          targetBankCount: targetBankCount || undefined,
        });

        const capacityData = await tamCalculationService.calculateCapacityBasedRevenue(
          teamSizingResult.coveredBanks,
          teamSizingResult.teamByTier,
          teamSizingResult.penetrationBySegment
        );

        const result = {
          teamSizing: {
            totalAEs: teamSizingResult.totalAEsNeeded,
            totalSEs: teamSizingResult.totalSEsNeeded,
            coveredBankCount: teamSizingResult.coveredBanks?.length || 0,
          },
          capacityAnalysis: capacityData,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching revenue pipeline: ${error.message}` }], isError: true };
      }
    }
  );

  // get-team-sizing: team sizing with capacity analysis
  server.tool(
    'get-team-sizing',
    'Get team sizing analysis showing how many AEs and SEs are needed to cover the bank portfolio, broken down by tier. Includes current roster and hiring gaps.',
    {
      targetBankCount: z.number().optional().describe('Target number of banks to cover (optional)'),
    },
    async ({ targetBankCount }) => {
      try {
        const result = await tamCalculationService.calculateTeamSizing({
          targetBankCount: targetBankCount || undefined,
        });

        const capacityData = await tamCalculationService.calculateCapacityBasedRevenue(
          result.coveredBanks,
          result.teamByTier,
          result.penetrationBySegment
        );

        return {
          content: [{ type: 'text', text: JSON.stringify({
            ...result,
            capacityAnalysis: capacityData,
          }, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching team sizing: ${error.message}` }], isError: true };
      }
    }
  );
}

module.exports = { register };
