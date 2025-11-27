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
 * Extract metric value from financial statement
 */
function extractMetric(statement, metricName) {
  switch (metricName) {
    case 'totalAssets':
      return statement.balanceSheet?.assets?.totalAssets || 0;
    case 'totalLoans':
      return statement.balanceSheet?.assets?.earningAssets?.loansAndLeases?.net || 0;
    case 'totalDeposits':
      return statement.balanceSheet?.liabilities?.deposits?.total || 0;
    case 'totalEquity':
      return statement.balanceSheet?.equity?.totalEquity || 0;
    case 'netIncome':
      return statement.incomeStatement?.netIncome || 0;
    case 'netInterestIncome':
      return statement.incomeStatement?.netInterestIncome || 0;
    case 'noninterestIncome':
      return statement.incomeStatement?.noninterestIncome?.total || 0;
    case 'noninterestExpense':
      return statement.incomeStatement?.noninterestExpense?.total || 0;
    case 'roe':
      return statement.ratios?.roe || null;
    case 'roa':
      return statement.ratios?.roa || null;
    case 'nim':
      return statement.ratios?.netInterestMargin || null;
    case 'efficiencyRatio':
      return statement.ratios?.efficiencyRatio || null;
    case 'operatingLeverage':
      return statement.ratios?.operatingLeverage || null;
    default:
      return null;
  }
}

/**
 * Find peer banks for a given bank
 */
async function findPeers(targetIdrssd, targetAssets, reportingPeriod) {
  // Find 10 banks larger than target
  const largerBanks = await FinancialStatement.aggregate([
    {
      $match: {
        reportingPeriod: new Date(reportingPeriod),
        idrssd: { $ne: targetIdrssd },
        'balanceSheet.assets.totalAssets': { $gt: targetAssets }
      }
    },
    {
      $sort: { 'balanceSheet.assets.totalAssets': 1 } // Ascending - closest to target first
    },
    {
      $limit: 10
    },
    {
      $project: { idrssd: 1, _id: 0 }
    }
  ]);

  // Find 10 banks smaller than target
  const smallerBanks = await FinancialStatement.aggregate([
    {
      $match: {
        reportingPeriod: new Date(reportingPeriod),
        idrssd: { $ne: targetIdrssd },
        'balanceSheet.assets.totalAssets': { $lt: targetAssets }
      }
    },
    {
      $sort: { 'balanceSheet.assets.totalAssets': -1 } // Descending - closest to target first
    },
    {
      $limit: 10
    },
    {
      $project: { idrssd: 1, _id: 0 }
    }
  ]);

  return {
    larger: largerBanks.map(b => b.idrssd),
    smaller: smallerBanks.map(b => b.idrssd),
    all: [...largerBanks.map(b => b.idrssd), ...smallerBanks.map(b => b.idrssd)]
  };
}

/**
 * Calculate peer averages for all metrics at a given reporting period
 */
async function calculatePeerAverages(peerIds, reportingPeriod) {
  const statements = await FinancialStatement.find({
    idrssd: { $in: peerIds },
    reportingPeriod: new Date(reportingPeriod)
  });

  if (statements.length === 0) {
    return null;
  }

  const averages = {};

  METRICS.forEach(metric => {
    const values = statements
      .map(stmt => extractMetric(stmt, metric))
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
 * Calculate stack ranking for a bank across all peers for a given metric
 * DEPRECATED - Use calculateAllRankings instead for better performance
 */
async function calculateRanking(targetIdrssd, metric, reportingPeriod) {
  const statements = await FinancialStatement.find({
    reportingPeriod: new Date(reportingPeriod)
  });

  const values = statements
    .map(stmt => ({
      idrssd: stmt.idrssd,
      value: extractMetric(stmt, metric)
    }))
    .filter(item => item.value !== null && item.value !== undefined && !isNaN(item.value));

  // Sort by value (higher is better for most metrics except efficiency ratio)
  const isLowerBetter = metric === 'efficiencyRatio';
  values.sort((a, b) => isLowerBetter ? a.value - b.value : b.value - a.value);

  // Find target bank's rank
  const rank = values.findIndex(item => item.idrssd === targetIdrssd) + 1;
  const total = values.length;
  const percentile = total > 0 ? ((total - rank + 1) / total) * 100 : null;

  return {
    rank,
    total,
    percentile: percentile ? Math.round(percentile) : null,
    value: values.find(item => item.idrssd === targetIdrssd)?.value || null
  };
}

/**
 * Calculate all rankings for a bank in a single pass (OPTIMIZED)
 * Fetches all statements once and calculates rankings for all metrics
 */
async function calculateAllRankings(targetIdrssd, reportingPeriod, statements = null) {
  // If statements not provided, fetch them (but caller should provide to avoid duplicate fetches)
  if (!statements) {
    statements = await FinancialStatement.find({
      reportingPeriod: new Date(reportingPeriod)
    });
  }

  const rankings = {};

  // Calculate rankings for each metric
  for (const metric of METRICS) {
    const values = statements
      .map(stmt => ({
        idrssd: stmt.idrssd,
        value: extractMetric(stmt, metric)
      }))
      .filter(item => item.value !== null && item.value !== undefined && !isNaN(item.value));

    // Sort by value (higher is better for most metrics except efficiency ratio)
    const isLowerBetter = metric === 'efficiencyRatio';
    values.sort((a, b) => isLowerBetter ? a.value - b.value : b.value - a.value);

    // Find target bank's rank
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
async function generatePeerAnalysis(idrssd, institution) {
  const institutionName = institution?.name || idrssd;
  console.log(`\n📊 [${idrssd}] ${institutionName}`);

  // Get all reporting periods for this bank
  const statements = await FinancialStatement.find({ idrssd })
    .sort({ reportingPeriod: 1 });

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
    const targetAssets = extractMetric(statement, 'totalAssets');

    console.log(`  → ${period.toISOString().split('T')[0]} ($${(targetAssets / 1000).toFixed(1)}M)`);

    // Find peers
    const peers = await findPeers(idrssd, targetAssets, period);

    if (peers.all.length === 0) {
      console.log(`    ⚠️  No peers found for this period`);
      continue;
    }

    // Calculate peer averages
    const peerAverages = await calculatePeerAverages(peers.all, period);

    // OPTIMIZED: Calculate all rankings in a single pass
    // Fetch all statements for this period once, then calculate all rankings
    const allStatementsForPeriod = await FinancialStatement.find({
      reportingPeriod: period
    });
    const rankings = await calculateAllRankings(idrssd, period, allStatementsForPeriod);

    peerAnalysis.periods.push({
      reportingPeriod: period,
      peers: {
        count: peers.all.length,
        largerCount: peers.larger.length,
        smallerCount: peers.smaller.length,
        peerIds: peers.all  // Store the actual peer IDs
      },
      peerAverages,
      rankings,
      bankMetrics: METRICS.reduce((acc, metric) => {
        acc[metric] = extractMetric(statement, metric);
        return acc;
      }, {})
    });
  }

  return peerAnalysis;
}

/**
 * Generate peer analysis for all banks (with parallel processing)
 */
async function generateAllPeerAnalyses() {
  console.log('🏦 Starting peer analysis generation for all banks...\n');

  // Get all unique banks that have financial statements
  const uniqueBanks = await FinancialStatement.distinct('idrssd');

  console.log(`Found ${uniqueBanks.length} banks with financial data\n`);

  // Get institution names and latest assets for sorting
  const institutions = await Institution.find({ idrssd: { $in: uniqueBanks } })
    .select('idrssd name')
    .lean();
  const institutionMap = new Map(institutions.map(i => [i.idrssd, i]));

  // Get latest total assets for each bank to sort by size
  console.log('📊 Sorting banks by total assets...\n');
  const latestStatements = await FinancialStatement.aggregate([
    { $match: { idrssd: { $in: uniqueBanks } } },
    { $sort: { reportingPeriod: -1 } },
    { $group: {
        _id: '$idrssd',
        latestAssets: { $first: '$balanceSheet.assets.totalAssets' }
      }
    },
    { $sort: { latestAssets: -1 } }  // Sort largest to smallest
  ]);

  const sortedBanks = latestStatements.map(s => s._id);
  console.log(`Sorted ${sortedBanks.length} banks by asset size (largest first)\n`);

  let processed = 0;
  let errors = 0;

  // Process banks in parallel batches
  const BATCH_SIZE = 10;  // Process 10 banks at a time

  for (let i = 0; i < sortedBanks.length; i += BATCH_SIZE) {
    const batch = sortedBanks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(sortedBanks.length / BATCH_SIZE);

    console.log(`\n📦 Batch ${batchNum}/${totalBatches} (Banks ${i + 1}-${Math.min(i + BATCH_SIZE, sortedBanks.length)})`);

    // Process all banks in this batch concurrently
    const batchPromises = batch.map(async (idrssd) => {
      try {
        const institution = institutionMap.get(idrssd);
        const analysis = await generatePeerAnalysis(idrssd, institution);

        if (analysis && analysis.periods.length > 0) {
          // Store peer analysis in the financial statements
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

          processed++;
          console.log(`    ✓ ${institution?.name || idrssd} (${processed}/${sortedBanks.length})`);
          return { success: true, idrssd };
        }
      } catch (error) {
        errors++;
        console.error(`    ✗ ${idrssd}: ${error.message}`);
        return { success: false, idrssd, error: error.message };
      }
    });

    // Wait for all banks in this batch to complete
    await Promise.all(batchPromises);
  }

  console.log(`\n✅ Peer analysis generation complete!`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Errors: ${errors}`);
}

// Main execution
async function main() {
  try {
    await connectDB();
    await generateAllPeerAnalyses();
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
  }
}

main();
