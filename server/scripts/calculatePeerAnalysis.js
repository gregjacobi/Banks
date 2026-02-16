const path = require('path');
const mongoose = require('mongoose');
const Institution = require('../models/Institution');
const FinancialStatement = require('../models/FinancialStatement');

// Check for --production flag
const isProduction = process.argv.includes('--production');

// Load appropriate .env file
if (isProduction) {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.production') });
  console.log('🚀 Running in PRODUCTION mode');
} else {
  require('dotenv').config();
  console.log('🔧 Running in DEVELOPMENT mode');
}

// Parse --bank flag for single-bank mode
const bankFlagIdx = process.argv.indexOf('--bank');
const singleBankId = bankFlagIdx !== -1 ? process.argv[bankFlagIdx + 1] : null;

// Parse --period flag for single-period mode
const periodFlagIdx = process.argv.indexOf('--period');
const singlePeriod = periodFlagIdx !== -1 ? process.argv[periodFlagIdx + 1] : null;

// Parse --top flag (default 100)
const topFlagIdx = process.argv.indexOf('--top');
const TOP_N = topFlagIdx !== -1 ? parseInt(process.argv[topFlagIdx + 1]) || 100 : 100;

/**
 * Calculate peer analysis for all banks
 * Finds 10 larger and 10 smaller peers by total assets
 * Calculates peer averages and rankings for all key metrics
 */

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bankexplorer';

// Key metrics to track for peer comparison
const METRICS = [
  'totalAssets',
  'totalLoans',
  'totalDeposits',
  'totalEquity',
  'netIncome',
  'netInterestIncome',
  'noninterestIncome',
  'noninterestExpense',
  'roe',
  'roa',
  'nim',
  'efficiencyRatio',
  'operatingLeverage'
];

// Map metric names to their document paths for use in aggregation
const METRIC_PATHS = {
  totalAssets: '$balanceSheet.assets.totalAssets',
  totalLoans: '$balanceSheet.assets.earningAssets.loansAndLeases.net',
  totalDeposits: '$balanceSheet.liabilities.deposits.total',
  totalEquity: '$balanceSheet.equity.totalEquity',
  netIncome: '$incomeStatement.netIncome',
  netInterestIncome: '$incomeStatement.netInterestIncome',
  noninterestIncome: '$incomeStatement.noninterestIncome.total',
  noninterestExpense: '$incomeStatement.noninterestExpense.total',
  roe: '$ratios.roe',
  roa: '$ratios.roa',
  nim: '$ratios.netInterestMargin',
  efficiencyRatio: '$ratios.efficiencyRatio',
  operatingLeverage: '$ratios.operatingLeverage'
};

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

/**
 * Extract metric value from a lean statement object
 */
function extractMetricFromLean(stmt, metricName) {
  switch (metricName) {
    case 'totalAssets':
      return stmt.balanceSheet?.assets?.totalAssets || 0;
    case 'totalLoans':
      return stmt.balanceSheet?.assets?.earningAssets?.loansAndLeases?.net || 0;
    case 'totalDeposits':
      return stmt.balanceSheet?.liabilities?.deposits?.total || 0;
    case 'totalEquity':
      return stmt.balanceSheet?.equity?.totalEquity || 0;
    case 'netIncome':
      return stmt.incomeStatement?.netIncome || 0;
    case 'netInterestIncome':
      return stmt.incomeStatement?.netInterestIncome || 0;
    case 'noninterestIncome':
      return stmt.incomeStatement?.noninterestIncome?.total || 0;
    case 'noninterestExpense':
      return stmt.incomeStatement?.noninterestExpense?.total || 0;
    case 'roe':
      return stmt.ratios?.roe || null;
    case 'roa':
      return stmt.ratios?.roa || null;
    case 'nim':
      return stmt.ratios?.netInterestMargin || null;
    case 'efficiencyRatio':
      return stmt.ratios?.efficiencyRatio || null;
    case 'operatingLeverage':
      return stmt.ratios?.operatingLeverage || null;
    default:
      return null;
  }
}

/**
 * Find peer banks for a given bank (10 larger + 10 smaller by assets)
 */
async function findPeers(targetIdrssd, targetAssets, reportingPeriod) {
  const largerBanks = await FinancialStatement.aggregate([
    {
      $match: {
        reportingPeriod: new Date(reportingPeriod),
        idrssd: { $ne: targetIdrssd },
        'balanceSheet.assets.totalAssets': { $gt: targetAssets }
      }
    },
    { $sort: { 'balanceSheet.assets.totalAssets': 1 } },
    { $limit: 10 },
    { $project: { idrssd: 1, _id: 0 } }
  ]);

  const smallerBanks = await FinancialStatement.aggregate([
    {
      $match: {
        reportingPeriod: new Date(reportingPeriod),
        idrssd: { $ne: targetIdrssd },
        'balanceSheet.assets.totalAssets': { $lt: targetAssets }
      }
    },
    { $sort: { 'balanceSheet.assets.totalAssets': -1 } },
    { $limit: 10 },
    { $project: { idrssd: 1, _id: 0 } }
  ]);

  return {
    larger: largerBanks.map(b => b.idrssd),
    smaller: smallerBanks.map(b => b.idrssd),
    all: [...largerBanks.map(b => b.idrssd), ...smallerBanks.map(b => b.idrssd)]
  };
}

/**
 * Calculate peer averages using only the peer statements (lean query with projection)
 */
async function calculatePeerAverages(peerIds, reportingPeriod) {
  const statements = await FinancialStatement.find({
    idrssd: { $in: peerIds },
    reportingPeriod: new Date(reportingPeriod)
  })
    .select('idrssd balanceSheet incomeStatement ratios')
    .lean();

  if (statements.length === 0) {
    return null;
  }

  const averages = {};

  METRICS.forEach(metric => {
    const values = statements
      .map(stmt => extractMetricFromLean(stmt, metric))
      .filter(val => val !== null && val !== undefined && !isNaN(val));

    if (values.length > 0) {
      averages[metric] = values.reduce((sum, val) => sum + val, 0) / values.length;
    } else {
      averages[metric] = null;
    }
  });

  return averages;
}

/**
 * Calculate rankings using aggregation pipeline (memory efficient)
 * Instead of loading all 5000+ documents, we use MongoDB aggregation
 * to compute ranks server-side.
 */
async function calculateAllRankings(targetIdrssd, reportingPeriod) {
  const rankings = {};
  const period = new Date(reportingPeriod);

  // Build a single aggregation that extracts all metrics we need
  const metricProjection = { idrssd: 1 };
  for (const [name, docPath] of Object.entries(METRIC_PATHS)) {
    metricProjection[name] = docPath;
  }

  // Fetch only the metric fields we need (much smaller than full documents)
  const allBanks = await FinancialStatement.aggregate([
    { $match: { reportingPeriod: period } },
    { $project: metricProjection }
  ]);

  for (const metric of METRICS) {
    const values = allBanks
      .map(b => ({ idrssd: b.idrssd, value: b[metric] }))
      .filter(item => item.value !== null && item.value !== undefined && !isNaN(item.value));

    const isLowerBetter = metric === 'efficiencyRatio';
    values.sort((a, b) => isLowerBetter ? a.value - b.value : b.value - a.value);

    const rank = values.findIndex(item => item.idrssd === targetIdrssd) + 1;
    const total = values.length;
    const percentile = total > 0 ? ((total - rank + 1) / total) * 100 : null;

    rankings[metric] = {
      rank,
      total,
      percentile: percentile ? Math.round(percentile) : null,
      value: values.find(item => item.idrssd === targetIdrssd)?.value || null
    };
  }

  return rankings;
}

/**
 * Generate complete peer analysis for a bank
 */
async function generatePeerAnalysis(idrssd, institution, periodsToProcess) {
  const institutionName = institution?.name || idrssd;
  console.log(`\n📊 [${idrssd}] ${institutionName}`);

  // Get reporting periods for this bank
  let statements;
  if (periodsToProcess) {
    statements = await FinancialStatement.find({
      idrssd,
      reportingPeriod: { $in: periodsToProcess.map(p => new Date(p)) }
    })
      .select('reportingPeriod balanceSheet.assets.totalAssets')
      .sort({ reportingPeriod: 1 })
      .lean();
  } else {
    statements = await FinancialStatement.find({ idrssd })
      .select('reportingPeriod balanceSheet.assets.totalAssets')
      .sort({ reportingPeriod: 1 })
      .lean();
  }

  if (statements.length === 0) {
    console.log(`  ⚠️  No financial statements found`);
    return null;
  }

  const peerAnalysis = {
    idrssd,
    generatedAt: new Date().toISOString(),
    periods: []
  };

  for (const statement of statements) {
    const period = statement.reportingPeriod;
    const targetAssets = statement.balanceSheet?.assets?.totalAssets || 0;

    console.log(`  → ${period.toISOString().split('T')[0]} ($${(targetAssets / 1000).toFixed(1)}M)`);

    // Find peers
    const peers = await findPeers(idrssd, targetAssets, period);

    if (peers.all.length === 0) {
      console.log(`    ⚠️  No peers found for this period`);
      continue;
    }

    // Calculate peer averages (only loads peer statements, not all banks)
    const peerAverages = await calculatePeerAverages(peers.all, period);

    // Calculate rankings using aggregation (memory efficient)
    const rankings = await calculateAllRankings(idrssd, period);

    // Get the target bank's own metrics for this period
    const fullStmt = await FinancialStatement.findOne({ idrssd, reportingPeriod: period })
      .select('balanceSheet incomeStatement ratios')
      .lean();

    peerAnalysis.periods.push({
      reportingPeriod: period,
      peers: {
        count: peers.all.length,
        largerCount: peers.larger.length,
        smallerCount: peers.smaller.length,
        peerIds: peers.all
      },
      peerAverages,
      rankings,
      bankMetrics: METRICS.reduce((acc, metric) => {
        acc[metric] = extractMetricFromLean(fullStmt, metric);
        return acc;
      }, {})
    });
  }

  return peerAnalysis;
}

/**
 * Save peer analysis results to financial statements
 */
async function savePeerAnalysis(analysis) {
  for (const period of analysis.periods) {
    await FinancialStatement.updateOne(
      {
        idrssd: analysis.idrssd,
        reportingPeriod: period.reportingPeriod
      },
      {
        $set: {
          peerAnalysis: {
            peers: period.peers,
            peerAverages: period.peerAverages,
            rankings: period.rankings,
            generatedAt: analysis.generatedAt
          }
        }
      }
    );
  }
}

/**
 * Generate peer analysis for a single bank
 */
async function generateSingleBankPeerAnalysis(idrssd) {
  const institution = await Institution.findOne({ idrssd }).select('idrssd name').lean();
  if (!institution) {
    console.error(`Bank not found: ${idrssd}`);
    return;
  }

  const periodsToProcess = singlePeriod ? [singlePeriod] : null;
  const analysis = await generatePeerAnalysis(idrssd, institution, periodsToProcess);

  if (analysis && analysis.periods.length > 0) {
    await savePeerAnalysis(analysis);
    console.log(`\n✅ Peer analysis saved for ${institution.name} (${analysis.periods.length} periods)`);
  } else {
    console.log(`\n⚠️  No peer analysis generated for ${institution.name}`);
  }
}

/**
 * Generate peer analysis for all banks
 */
async function generateAllPeerAnalyses() {
  console.log('🏦 Starting peer analysis generation for all banks...\n');

  const uniqueBanks = await FinancialStatement.distinct('idrssd');
  console.log(`Found ${uniqueBanks.length} banks with financial data\n`);

  const institutions = await Institution.find({ idrssd: { $in: uniqueBanks } })
    .select('idrssd name')
    .lean();
  const institutionMap = new Map(institutions.map(i => [i.idrssd, i]));

  console.log('📊 Sorting banks by total assets...\n');
  const latestStatements = await FinancialStatement.aggregate([
    { $match: { idrssd: { $in: uniqueBanks } } },
    { $sort: { reportingPeriod: -1 } },
    { $group: {
        _id: '$idrssd',
        latestAssets: { $first: '$balanceSheet.assets.totalAssets' }
      }
    },
    { $sort: { latestAssets: -1 } }
  ]);

  const sortedBanks = latestStatements.map(s => s._id);
  console.log(`Sorted ${sortedBanks.length} banks by asset size (largest first)\n`);

  const banksToProcess = sortedBanks.slice(0, TOP_N);
  console.log(`Processing top ${banksToProcess.length} banks\n`);

  let processed = 0;
  let errors = 0;

  const periodsToProcess = singlePeriod ? [singlePeriod] : null;

  for (let i = 0; i < banksToProcess.length; i++) {
    const idrssd = banksToProcess[i];
    const bankNum = i + 1;

    console.log(`\n🏦 Bank ${bankNum}/${banksToProcess.length}`);

    try {
      const institution = institutionMap.get(idrssd);
      const analysis = await generatePeerAnalysis(idrssd, institution, periodsToProcess);

      if (analysis && analysis.periods.length > 0) {
        await savePeerAnalysis(analysis);
        processed++;
        console.log(`    ✓ ${institution?.name || idrssd} (${processed}/${banksToProcess.length})`);
      }
    } catch (error) {
      errors++;
      console.error(`    ✗ ${idrssd}: ${error.message}`);
    }
  }

  console.log(`\n✅ Peer analysis generation complete!`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Errors: ${errors}`);
}

// Main execution
async function main() {
  if (singleBankId) {
    console.log(`\n🎯 Single bank mode: ${singleBankId}`);
    if (singlePeriod) console.log(`   Period: ${singlePeriod}`);
  } else {
    console.log(`\n📋 Processing top ${TOP_N} banks`);
    if (singlePeriod) console.log(`   Period: ${singlePeriod}`);
  }

  try {
    await connectDB();
    if (singleBankId) {
      await generateSingleBankPeerAnalysis(singleBankId);
    } else {
      await generateAllPeerAnalyses();
    }
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
  }
}

main();
