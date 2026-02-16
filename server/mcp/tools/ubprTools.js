const { z } = require('zod');
const FinancialStatement = require('../../models/FinancialStatement');
const Institution = require('../../models/Institution');
const ubprService = require('../../services/ubprService');

function register(server) {
  // compare-ubpr: compare our calculations with UBPR data
  server.tool(
    'compare-ubpr',
    'Compare our calculated financial ratios with FFIEC UBPR (Uniform Bank Performance Report) data for validation. Shows side-by-side comparison with variance analysis.',
    {
      idrssd: z.string().describe('Bank ID'),
      period: z.string().optional().describe('Optional reporting period (YYYY-MM-DD). Defaults to latest.'),
    },
    async ({ idrssd, period }) => {
      try {
        // If no period given, find latest
        if (!period) {
          const latest = await FinancialStatement.findOne({ idrssd })
            .sort({ reportingPeriod: -1 })
            .select('reportingPeriod')
            .lean();
          if (!latest) {
            return { content: [{ type: 'text', text: `No financial data found for bank ${idrssd}.` }] };
          }
          period = latest.reportingPeriod.toISOString().split('T')[0];
        }

        // Fetch our calculated data
        const ourStatement = await FinancialStatement.findOne({
          idrssd,
          reportingPeriod: new Date(period),
        }).lean();

        if (!ourStatement) {
          return { content: [{ type: 'text', text: `No financial statement found for bank ${idrssd} in period ${period}.` }] };
        }

        // Fetch UBPR data
        const ubprData = await ubprService.fetchUBPRData(idrssd, period);

        // Get institution name
        const institution = await Institution.findOne({ idrssd }).select('name').lean();

        // Compare key metrics
        const ourMetrics = {
          roa: ourStatement.ratios?.roa,
          roe: ourStatement.ratios?.roe,
          nim: ourStatement.ratios?.netInterestMargin,
          efficiencyRatio: ourStatement.ratios?.efficiencyRatio,
          tier1Leverage: ourStatement.ratios?.tier1LeverageRatio,
        };

        const ubprMetrics = {
          roa: ubprData.metrics?.roa,
          roe: ubprData.metrics?.roe,
          nim: ubprData.metrics?.nim,
          efficiencyRatio: ubprData.metrics?.efficiencyRatio,
          tier1Leverage: ubprData.metrics?.tier1LeverageRatio,
        };

        const differences = {};
        for (const key of Object.keys(ourMetrics)) {
          const ours = ourMetrics[key];
          const theirs = ubprMetrics[key];
          if (ours != null && theirs != null) {
            const diff = ours - theirs;
            const pctDiff = theirs !== 0 ? (diff / theirs) * 100 : 0;
            differences[key] = {
              ourValue: parseFloat(ours.toFixed(4)),
              ubprValue: parseFloat(theirs.toFixed(4)),
              absoluteDiff: parseFloat(diff.toFixed(4)),
              percentDiff: parseFloat(pctDiff.toFixed(2)),
            };
          } else {
            differences[key] = {
              ourValue: ours ?? null,
              ubprValue: theirs ?? null,
              absoluteDiff: null,
              percentDiff: null,
            };
          }
        }

        const result = {
          idrssd,
          bankName: institution?.name || 'Unknown',
          period,
          differences,
          dataSource: ubprData.dataSource,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error comparing UBPR data: ${error.message}` }], isError: true };
      }
    }
  );
}

module.exports = { register };
