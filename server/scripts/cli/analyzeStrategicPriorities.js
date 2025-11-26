#!/usr/bin/env node

/**
 * Strategic Priorities Analysis CLI Tool
 *
 * Analyzes strategic priorities across all banks to identify industry themes,
 * categorize priorities, and find differentiating strategies.
 *
 * Usage:
 *   # Run full analysis
 *   node server/scripts/cli/analyzeStrategicPriorities.js
 *
 *   # Show latest analysis summary
 *   node server/scripts/cli/analyzeStrategicPriorities.js --summary
 *
 *   # Show analysis history
 *   node server/scripts/cli/analyzeStrategicPriorities.js --history
 *
 *   # Export latest analysis to JSON
 *   node server/scripts/cli/analyzeStrategicPriorities.js --export
 *
 * Options:
 *   --summary, -s     Show summary of latest analysis
 *   --history, -h     Show analysis history
 *   --export, -e      Export latest analysis to JSON file
 *   --force, -f       Force new analysis even if recent one exists
 *   --help            Show this help message
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bankexplorer';

// Parse command line arguments
const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag) || args.includes(flag.replace('--', '-'));

const showSummary = hasFlag('--summary') || hasFlag('-s');
const showHistory = hasFlag('--history');
const exportAnalysis = hasFlag('--export') || hasFlag('-e');
const forceNew = hasFlag('--force') || hasFlag('-f');
const showHelp = hasFlag('--help');

if (showHelp) {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║       Strategic Priorities Industry Analysis Tool              ║
╚════════════════════════════════════════════════════════════════╝

DESCRIPTION:
  Analyzes strategic priorities across all banks to identify
  industry themes, categorize priorities, and find differentiating
  strategies unique to individual banks.

USAGE:
  node server/scripts/cli/analyzeStrategicPriorities.js [OPTIONS]

OPTIONS:
  --summary, -s     Show summary of latest analysis
  --history         Show analysis history (last 10 runs)
  --export, -e      Export latest analysis to JSON file
  --force, -f       Force new analysis even if recent one exists
  --help            Show this help message

EXAMPLES:
  # Run full analysis (takes 2-5 minutes)
  node server/scripts/cli/analyzeStrategicPriorities.js

  # View the latest analysis summary
  node server/scripts/cli/analyzeStrategicPriorities.js --summary

  # Export for use in presentations
  node server/scripts/cli/analyzeStrategicPriorities.js --export

PREREQUISITES:
  - Banks must have strategic priorities extracted (Phase 3 of research)
  - Run batch research first if no priorities exist:
    node server/scripts/cli/batchResearch.js --count 25 --max-phase 2

OUTPUT:
  - Stored in MongoDB: strategicprioritiesanalyses collection
  - Categories with prevalence across banks
  - Top industry themes
  - Differentiating strategies (unique to 1-3 banks)
  - Focus metrics and tech partnerships analysis
`);
  process.exit(0);
}

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

async function showLatestSummary() {
  const StrategicPrioritiesAnalysis = require('../../models/StrategicPrioritiesAnalysis');

  const latest = await StrategicPrioritiesAnalysis.getLatest();

  if (!latest) {
    console.log('\n⚠️  No strategic priorities analysis found.');
    console.log('Run without --summary to generate a new analysis.\n');
    return;
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 STRATEGIC PRIORITIES INDUSTRY ANALYSIS');
  console.log('='.repeat(80));

  console.log(`\nAnalysis Date: ${latest.analysisDate.toISOString()}`);
  console.log(`Model: ${latest.analysisMetadata?.model || 'Unknown'}`);
  console.log(`Processing Time: ${latest.analysisMetadata?.processingTime?.toFixed(1) || '?'}s`);

  console.log('\n📈 COVERAGE');
  console.log('-'.repeat(40));
  console.log(`Total Banks in Database:      ${latest.coverage.totalBanks}`);
  console.log(`Banks with Priorities:        ${latest.coverage.banksWithPriorities}`);
  console.log(`Coverage Rate:                ${((latest.coverage.banksWithPriorities / latest.coverage.totalBanks) * 100).toFixed(1)}%`);
  console.log(`Total Priorities Analyzed:    ${latest.coverage.totalPrioritiesAnalyzed}`);
  console.log(`Avg Priorities per Bank:      ${latest.coverage.averagePrioritiesPerBank?.toFixed(1) || 'N/A'}`);

  console.log('\n🎯 TOP STRATEGIC CATEGORIES');
  console.log('-'.repeat(40));
  latest.categories?.slice(0, 8).forEach((cat, i) => {
    console.log(`${i + 1}. ${cat.name}`);
    console.log(`   Banks: ${cat.bankCount} (${cat.prevalence?.toFixed(1)}% prevalence)`);
    console.log(`   Top priorities: ${cat.priorities?.slice(0, 2).map(p => p.title).join(', ')}`);
  });

  console.log('\n🔮 INDUSTRY THEMES');
  console.log('-'.repeat(40));
  latest.industrySummary?.topThemes?.slice(0, 5).forEach((theme, i) => {
    console.log(`${i + 1}. ${theme.theme}`);
    console.log(`   ${theme.description}`);
    console.log(`   Banks: ${theme.bankCount} (${theme.prevalence?.toFixed(1)}%)`);
  });

  console.log('\n💡 KEY OBSERVATIONS');
  console.log('-'.repeat(40));
  latest.industrySummary?.keyObservations?.forEach((obs, i) => {
    console.log(`${i + 1}. ${obs.observation}`);
    console.log(`   Evidence: ${obs.supportingEvidence}`);
  });

  console.log('\n🌟 DIFFERENTIATING STRATEGIES');
  console.log('-'.repeat(40));
  latest.differentiatingStrategies?.slice(0, 5).forEach((ds, i) => {
    console.log(`${i + 1}. ${ds.title}`);
    console.log(`   Banks: ${ds.banks?.map(b => b.bankName).join(', ')}`);
    console.log(`   Why unique: ${ds.uniquenessReason}`);
  });

  if (latest.industrySummary?.emergingTrends?.length > 0) {
    console.log('\n📈 EMERGING TRENDS');
    console.log('-'.repeat(40));
    latest.industrySummary.emergingTrends.forEach((trend, i) => {
      console.log(`${i + 1}. ${trend.trend}`);
      console.log(`   ${trend.description}`);
      console.log(`   Banks: ${trend.banks?.join(', ')}`);
    });
  }

  console.log('\n' + '='.repeat(80));
}

async function showAnalysisHistory() {
  const StrategicPrioritiesAnalysis = require('../../models/StrategicPrioritiesAnalysis');

  const history = await StrategicPrioritiesAnalysis.getHistory(10);

  if (history.length === 0) {
    console.log('\n⚠️  No analysis history found.\n');
    return;
  }

  console.log('\n📜 ANALYSIS HISTORY');
  console.log('='.repeat(80));
  console.log(sprintf('%-5s %-25s %-10s %-10s %-10s %-15s',
    '#', 'Date', 'Banks', 'Priorities', 'Time(s)', 'Model'));
  console.log('-'.repeat(80));

  history.forEach((h, i) => {
    console.log(sprintf('%-5s %-25s %-10s %-10s %-10s %-15s',
      i + 1,
      h.analysisDate.toISOString().replace('T', ' ').substring(0, 19),
      h.coverage?.banksWithPriorities || '?',
      h.coverage?.totalBanks || '?',
      h.analysisMetadata?.processingTime?.toFixed(1) || '?',
      (h.analysisMetadata?.model || 'unknown').substring(0, 15)
    ));
  });

  console.log('='.repeat(80) + '\n');
}

async function exportLatestAnalysis() {
  const StrategicPrioritiesAnalysis = require('../../models/StrategicPrioritiesAnalysis');

  const latest = await StrategicPrioritiesAnalysis.getLatest();

  if (!latest) {
    console.log('\n⚠️  No analysis to export. Run analysis first.\n');
    return;
  }

  const exportDir = path.join(__dirname, '../../data/strategic-analysis');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const timestamp = latest.analysisDate.toISOString().replace(/[:.]/g, '-');
  const filename = `strategic-priorities-${timestamp}.json`;
  const filepath = path.join(exportDir, filename);

  // Convert to plain object and clean up
  const exportData = {
    analysisDate: latest.analysisDate,
    coverage: latest.coverage,
    categories: latest.categories,
    industrySummary: latest.industrySummary,
    differentiatingStrategies: latest.differentiatingStrategies,
    focusMetricsAnalysis: latest.focusMetricsAnalysis,
    techPartnershipsAnalysis: latest.techPartnershipsAnalysis,
    analysisMetadata: latest.analysisMetadata
  };

  fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
  console.log(`\n✅ Exported to: ${filepath}\n`);
}

async function runNewAnalysis() {
  const StrategicPrioritiesAnalysis = require('../../models/StrategicPrioritiesAnalysis');
  const strategicPrioritiesAgent = require('../../services/strategicPrioritiesAgent');

  // Check if recent analysis exists (within last hour)
  if (!forceNew) {
    const latest = await StrategicPrioritiesAnalysis.getLatest();
    if (latest) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (latest.analysisDate > hourAgo) {
        console.log('\n⚠️  Recent analysis exists (within last hour).');
        console.log(`   Last run: ${latest.analysisDate.toISOString()}`);
        console.log('   Use --force to run a new analysis anyway.');
        console.log('   Use --summary to view the latest analysis.\n');
        return;
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('🚀 STRATEGIC PRIORITIES INDUSTRY ANALYSIS');
  console.log('='.repeat(80));
  console.log('\nStarting analysis... This may take 2-5 minutes.\n');

  try {
    const startTime = Date.now();
    const analysis = await strategicPrioritiesAgent.runAnalysis();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(80));
    console.log('✅ ANALYSIS COMPLETE');
    console.log('='.repeat(80));
    console.log(`Duration:                     ${duration}s`);
    console.log(`Banks Analyzed:               ${analysis.coverage.banksWithPriorities}`);
    console.log(`Total Priorities:             ${analysis.coverage.totalPrioritiesAnalyzed}`);
    console.log(`Categories Created:           ${analysis.categories?.length || 0}`);
    console.log(`Differentiating Strategies:   ${analysis.differentiatingStrategies?.length || 0}`);
    console.log('\nRun with --summary to see full results.\n');

  } catch (error) {
    console.error('\n❌ Analysis failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

function sprintf(format, ...args) {
  let i = 0;
  return format.replace(/%-?(\d+)s/g, (match, width) => {
    const value = String(args[i++] || '');
    const isLeftAlign = match.startsWith('%-');
    const w = parseInt(width);
    if (isLeftAlign) {
      return value.padEnd(w);
    }
    return value.padStart(w);
  });
}

async function main() {
  try {
    await connectDB();

    if (showSummary) {
      await showLatestSummary();
    } else if (showHistory) {
      await showAnalysisHistory();
    } else if (exportAnalysis) {
      await exportLatestAnalysis();
    } else {
      await runNewAnalysis();
    }

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

main();
