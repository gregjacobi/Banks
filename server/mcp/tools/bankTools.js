const Institution = require('../../models/Institution');
const FinancialStatement = require('../../models/FinancialStatement');

function register(server) {
  // search-banks: fuzzy name search, returns ranked results
  server.tool(
    'search-banks',
    'Search for banks by name. Returns matching banks ranked by relevance with key financial metrics. Use this first to find a bank\'s idrssd ID, then use other tools with that ID.',
    {
      query: { type: 'string', description: 'Bank name to search for (fuzzy matching)' },
      state: { type: 'string', description: 'Optional 2-letter state code to filter by' },
      limit: { type: 'number', description: 'Max results to return (default 10)' },
    },
    async ({ query, state, limit = 10 }) => {
      try {
        const searchQuery = { $text: { $search: query } };
        if (state) searchQuery.state = state.toUpperCase();

        const institutions = await Institution.find(
          searchQuery,
          { score: { $meta: 'textScore' } }
        )
          .sort({ score: { $meta: 'textScore' } })
          .limit(limit)
          .lean();

        if (institutions.length === 0) {
          return { content: [{ type: 'text', text: `No banks found matching '${query}'.` }] };
        }

        // Get latest financial data for each match
        const idrssds = institutions.map(i => i.idrssd);
        const latestStatements = await FinancialStatement.aggregate([
          { $match: { idrssd: { $in: idrssds } } },
          { $sort: { reportingPeriod: -1 } },
          { $group: {
            _id: '$idrssd',
            reportingPeriod: { $first: '$reportingPeriod' },
            totalAssets: { $first: '$balanceSheet.assets.totalAssets' },
          }},
        ]);

        const fsMap = new Map(latestStatements.map(s => [s._id, s]));

        const results = institutions.map(inst => {
          const fs = fsMap.get(inst.idrssd);
          return {
            idrssd: inst.idrssd,
            name: inst.name,
            city: inst.city,
            state: inst.state,
            totalAssets: fs?.totalAssets || 0,
            latestPeriod: fs?.reportingPeriod?.toISOString().split('T')[0] || null,
          };
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error searching banks: ${error.message}` }], isError: true };
      }
    }
  );

  // get-bank-financials: full financial picture for a bank
  server.registerTool(
    'get-bank-financials',
    {
      title: 'Get Bank Financials',
      description: 'Get complete financial data for a bank: balance sheet, income statement, ratios, credit quality, and loan categories. Defaults to the most recent reporting period.',
      inputSchema: {
        idrssd: { type: 'string', description: 'Bank ID (from search-banks results)' },
        reportingPeriod: { type: 'string', description: 'Optional reporting period (YYYY-MM-DD). Defaults to latest.' },
      },
      _meta: { ui: { resourceUri: 'ui://bank-explorer/credit-quality.html' } },
    },
    async ({ idrssd, reportingPeriod }) => {
      try {
        const institution = await Institution.findOne({ idrssd }).lean();
        if (!institution) {
          return { content: [{ type: 'text', text: `No bank found with idrssd '${idrssd}'.` }] };
        }

        const query = { idrssd };
        if (reportingPeriod) query.reportingPeriod = new Date(reportingPeriod);

        const fs = await FinancialStatement.findOne(query)
          .sort({ reportingPeriod: -1 })
          .lean();

        if (!fs) {
          return { content: [{ type: 'text', text: `No financial data found for bank ${idrssd}.` }] };
        }

        const result = {
          institution: {
            idrssd: institution.idrssd,
            name: institution.name,
            city: institution.city,
            state: institution.state,
          },
          reportingPeriod: fs.reportingPeriod?.toISOString().split('T')[0],
          balanceSheet: fs.balanceSheet,
          incomeStatement: fs.incomeStatement,
          ratios: fs.ratios,
          creditQuality: fs.creditQuality,
          loanCategories: fs.loanCategories,
          chargeOffsAndRecoveries: fs.chargeOffsAndRecoveries,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching financials: ${error.message}` }], isError: true };
      }
    }
  );

  // get-time-series: multi-quarter trend data
  server.registerTool(
    'get-time-series',
    {
      title: 'Get Time Series',
      description: 'Get multi-quarter financial trend data for a bank. Returns time series of key metrics sorted oldest to newest. Use for trend analysis and charting.',
      inputSchema: {
        idrssd: { type: 'string', description: 'Bank ID' },
        periodCount: { type: 'number', description: 'Number of quarters to return (default 8)' },
      },
      _meta: { ui: { resourceUri: 'ui://bank-explorer/trends-chart.html' } },
    },
    async ({ idrssd, periodCount = 8 }) => {
      try {
        const statements = await FinancialStatement.find({ idrssd })
          .sort({ reportingPeriod: -1 })
          .limit(periodCount)
          .lean();

        if (statements.length === 0) {
          return { content: [{ type: 'text', text: `No financial data found for bank ${idrssd}.` }] };
        }

        // Sort oldest first for proper time-series ordering
        statements.sort((a, b) => new Date(a.reportingPeriod) - new Date(b.reportingPeriod));

        const institution = await Institution.findOne({ idrssd }).select('name').lean();

        const series = statements.map(fs => ({
          period: fs.reportingPeriod?.toISOString().split('T')[0],
          totalAssets: fs.balanceSheet?.assets?.totalAssets,
          totalLoans: fs.balanceSheet?.assets?.earningAssets?.loansAndLeases?.net,
          totalDeposits: fs.balanceSheet?.liabilities?.deposits?.total,
          totalEquity: fs.balanceSheet?.equity?.totalEquity,
          netIncome: fs.incomeStatement?.netIncome,
          netInterestIncome: fs.incomeStatement?.netInterestIncome,
          nim: fs.ratios?.netInterestMargin,
          roa: fs.ratios?.roa,
          roe: fs.ratios?.roe,
          efficiencyRatio: fs.ratios?.efficiencyRatio,
          operatingLeverage: fs.ratios?.operatingLeverage,
          tier1LeverageRatio: fs.ratios?.tier1LeverageRatio,
          nonperformingTotal: fs.creditQuality?.summary?.totalNonperforming,
          netChargeOffs: fs.chargeOffsAndRecoveries?.netChargeOffs?.total,
        }));

        const result = {
          bankName: institution?.name || idrssd,
          idrssd,
          periodCount: series.length,
          series,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching time series: ${error.message}` }], isError: true };
      }
    }
  );

  // get-peer-comparison: target bank vs 20 peers
  server.registerTool(
    'get-peer-comparison',
    {
      title: 'Get Peer Comparison',
      description: 'Compare a bank against its 20 asset-size peers across key financial ratios. Returns the target bank, peer averages, and individual peer data.',
      inputSchema: {
        idrssd: { type: 'string', description: 'Bank ID' },
      },
      _meta: { ui: { resourceUri: 'ui://bank-explorer/peer-comparison.html' } },
    },
    async ({ idrssd }) => {
      try {
        // Get latest statement with peer analysis
        const targetStmt = await FinancialStatement.findOne({
          idrssd,
          'peerAnalysis.peers.peerIds.0': { $exists: true },
        })
          .sort({ reportingPeriod: -1 })
          .lean();

        if (!targetStmt || !targetStmt.peerAnalysis) {
          return { content: [{ type: 'text', text: `No peer analysis data found for bank ${idrssd}. Run peer analysis calculation first.` }] };
        }

        const peerIds = targetStmt.peerAnalysis.peers.peerIds || [];
        const allIds = [idrssd, ...peerIds];
        const period = targetStmt.reportingPeriod;

        // Get all peer statements for same period
        const statements = await FinancialStatement.find({
          idrssd: { $in: allIds },
          reportingPeriod: period,
        })
          .select('idrssd ratios balanceSheet.assets.totalAssets')
          .lean();

        const institutions = await Institution.find({ idrssd: { $in: allIds } })
          .select('idrssd name')
          .lean();
        const nameMap = new Map(institutions.map(i => [i.idrssd, i.name]));

        const banks = statements.map(stmt => ({
          idrssd: stmt.idrssd,
          name: nameMap.get(stmt.idrssd) || stmt.idrssd,
          isTarget: stmt.idrssd === idrssd,
          totalAssets: stmt.balanceSheet?.assets?.totalAssets,
          efficiencyRatio: stmt.ratios?.efficiencyRatio,
          roa: stmt.ratios?.roa,
          roe: stmt.ratios?.roe,
          nim: stmt.ratios?.netInterestMargin,
          operatingLeverage: stmt.ratios?.operatingLeverage,
          tier1LeverageRatio: stmt.ratios?.tier1LeverageRatio,
        }));

        const result = {
          period: period?.toISOString().split('T')[0],
          targetBank: idrssd,
          peerAverages: targetStmt.peerAnalysis.peerAverages,
          rankings: targetStmt.peerAnalysis.rankings,
          banks,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching peer comparison: ${error.message}` }], isError: true };
      }
    }
  );
}

module.exports = { register };
