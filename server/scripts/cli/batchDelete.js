#!/usr/bin/env node

/**
 * Batch Delete CLI Tool
 *
 * Delete research metadata for banks (Phases 1, 2, 3) without touching Call Report data
 * Also clears: stock ticker, org chart, strategic insights, logos, and research phases
 *
 * Usage:
 *   # Single bank mode
 *   node server/scripts/cli/batchDelete.js --idrssd 852218
 *   node server/scripts/cli/batchDelete.js --idrssd 852218 --phases 1,2
 *   node server/scripts/cli/batchDelete.js --idrssd 852218 --dry-run
 *
 *   # Batch mode (top N banks)
 *   node server/scripts/cli/batchDelete.js --count 10
 *   node server/scripts/cli/batchDelete.js --count 25 --phases 1,2,3
 *   node server/scripts/cli/batchDelete.js --count 25 --include-rag
 *
 *   # List mode
 *   node server/scripts/cli/batchDelete.js --list
 *
 * Options:
 *   --idrssd            Delete metadata for a specific bank by IDRSSD (single bank mode)
 *   --count, -c         Number of banks to process in batch mode (default: 10)
 *   --phases, -p        Comma-separated phases to delete: 1,2,3 (default: 1,2,3)
 *                       Phase 1: Web sources
 *                       Phase 2: AI research reports
 *                       Phase 3: Podcasts and presentations
 *                       Always: Ticker, org chart, strategic insights/KPIs, logos
 *   --include-rag       Also delete RAG documents and chunks for the bank
 *   --include-pdfs      Also delete uploaded PDF files for the bank
 *   --dry-run, -d       Show what would be deleted without actually deleting
 *   --force, -f         Skip confirmation prompts (USE WITH CAUTION)
 *   --list, -l          List banks and their current research data status
 */

const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bankexplorer';

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.findIndex(arg => arg === flag || arg === flag.replace('--', '-'));
  return index !== -1 ? args[index + 1] : null;
};
const hasFlag = (flag) => args.includes(flag) || args.includes(flag.replace('--', '-'));

const idrssd = getArg('--idrssd');
const count = parseInt(getArg('--count') || getArg('-c') || '10');
const phasesArg = getArg('--phases') || getArg('-p') || '1,2,3';
const phases = phasesArg.split(',').map(p => parseInt(p.trim())).filter(p => p >= 1 && p <= 3);
const includeRAG = hasFlag('--include-rag');
const includePDFs = hasFlag('--include-pdfs');
const dryRun = hasFlag('--dry-run') || hasFlag('-d');
const force = hasFlag('--force') || hasFlag('-f');
const listOnly = hasFlag('--list') || hasFlag('-l');
const showHelp = hasFlag('--help') || hasFlag('-h');

// Show help
if (showHelp) {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║         Bank Explorer - Batch Metadata Deletion Tool          ║
╚════════════════════════════════════════════════════════════════╝

DESCRIPTION:
  Delete research metadata for banks without touching Call Report data.
  Removes: sources, reports, podcasts, presentations, ticker, org chart,
  strategic insights, logos, and RAG documents (optional).

USAGE:
  node server/scripts/cli/batchDelete.js [OPTIONS]

OPTIONS:
  --idrssd <id>        Delete metadata for a specific bank by IDRSSD
  --count, -c <num>    Number of banks to process in batch mode (default: 10)
  --phases, -p <list>  Comma-separated phases to delete: 1,2,3 (default: 1,2,3)
                       Phase 1: Web sources
                       Phase 2: AI research reports
                       Phase 3: Podcasts and presentations
                       Always: Ticker, org chart, strategic insights, logos
  --include-rag        Also delete RAG documents and chunks for the bank
  --include-pdfs       Also delete uploaded PDF files for the bank
  --dry-run, -d        Show what would be deleted without actually deleting
  --force, -f          Skip confirmation prompts (USE WITH CAUTION)
  --list, -l           List banks and their current research data status
  --help, -h           Show this help message

EXAMPLES:
  # List all banks with research data
  node server/scripts/cli/batchDelete.js --list

  # Single bank - dry run to see what would be deleted
  node server/scripts/cli/batchDelete.js --idrssd 852218 --dry-run

  # Single bank - delete only Phase 1 sources
  node server/scripts/cli/batchDelete.js --idrssd 852218 --phases 1

  # Single bank - delete all phases
  node server/scripts/cli/batchDelete.js --idrssd 852218 --phases 1,2,3

  # Single bank - delete everything including RAG and PDFs
  node server/scripts/cli/batchDelete.js --idrssd 852218 --include-rag --include-pdfs

  # Batch mode - delete Phase 1 and 2 for top 10 banks
  node server/scripts/cli/batchDelete.js --count 10 --phases 1,2

  # Batch mode - delete everything for top 25 banks (with confirmation)
  node server/scripts/cli/batchDelete.js --count 25 --include-rag

  # Force deletion without confirmation (USE WITH CAUTION!)
  node server/scripts/cli/batchDelete.js --idrssd 852218 --force

PROTECTED DATA (NOT DELETED):
  ✓ Call Report data (FinancialStatement model)
  ✓ Institution records
  ✓ UBPR data
  ✓ Data from other banks (only specified banks affected)

NOTES:
  - Always requires confirmation unless --force or --dry-run is used
  - Dry-run mode shows what would be deleted without actually deleting
  - BankMetadata is cleared (ticker, org chart, insights, logos, phases)
`);
  process.exit(0);
}

// Validate phases
if (phases.length === 0) {
  console.error('❌ Error: --phases must include at least one of: 1, 2, or 3');
  console.error('Run with --help for usage information');
  process.exit(1);
}

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

async function getTopBanks(limit) {
  const Institution = require('../../models/Institution');
  const FinancialStatement = require('../../models/FinancialStatement');

  // Get latest statements to determine top banks by assets
  const latestStatements = await FinancialStatement.aggregate([
    {
      $sort: { reportingPeriod: -1 }
    },
    {
      $group: {
        _id: '$idrssd',
        latestPeriod: { $first: '$reportingPeriod' },
        totalAssets: { $first: '$balanceSheet.assets.totalAssets' }
      }
    },
    {
      $match: {
        totalAssets: { $gt: 0 }
      }
    },
    {
      $sort: { totalAssets: -1 }
    },
    {
      $limit: limit
    }
  ]);

  const idrssdList = latestStatements.map(s => s._id);
  const institutions = await Institution.find({ idrssd: { $in: idrssdList } }).lean();

  // Merge institutions with asset data
  const banks = latestStatements.map(stmt => {
    const institution = institutions.find(i => i.idrssd === stmt._id);
    return {
      idrssd: stmt._id,
      name: institution?.name || 'Unknown Bank',
      totalAssets: stmt.totalAssets
    };
  });

  return banks;
}

async function getBankData(idrssd) {
  const Institution = require('../../models/Institution');
  const Source = require('../../models/Source');
  const BankMetadata = require('../../models/BankMetadata');
  const GroundingDocument = require('../../models/GroundingDocument');
  const PDF = require('../../models/PDF');

  const institution = await Institution.findOne({ idrssd }).lean();
  if (!institution) {
    return null;
  }

  // Count sources (Phase 1)
  const sourcesCount = await Source.countDocuments({ idrssd });

  // Check for reports (Phase 2)
  const researchDir = path.join(__dirname, '../../data/research');
  let reportFiles = [];
  try {
    const allFiles = await fs.readdir(researchDir);
    reportFiles = allFiles.filter(f => f.startsWith(`${idrssd}_agent_`) && f.endsWith('.json'));
  } catch (err) {
    // Directory might not exist
  }

  // Check for podcasts (Phase 3)
  const podcastDir = path.join(__dirname, '../../data/podcasts');
  let podcastFiles = [];
  try {
    const allFiles = await fs.readdir(podcastDir);
    podcastFiles = allFiles.filter(f => f.startsWith(`${idrssd}_`) && f.endsWith('.mp3'));
  } catch (err) {
    // Directory might not exist
  }

  // Check for presentations (Phase 3)
  const presentationDir = path.join(__dirname, '../../data/presentations');
  let presentationFiles = [];
  try {
    const allFiles = await fs.readdir(presentationDir);
    presentationFiles = allFiles.filter(f => f.startsWith(`${idrssd}_`) && f.endsWith('.json'));
  } catch (err) {
    // Directory might not exist
  }

  // Count RAG documents
  const ragDocumentsCount = await GroundingDocument.countDocuments({ idrssd });

  // Count PDFs
  const pdfsCount = await PDF.countDocuments({ idrssd });

  // Get metadata
  const metadata = await BankMetadata.findOne({ idrssd }).lean();

  return {
    idrssd,
    name: institution.name,
    sourcesCount,
    reportFiles,
    podcastFiles,
    presentationFiles,
    ragDocumentsCount,
    pdfsCount,
    metadata
  };
}

async function listBanksWithData() {
  const Source = require('../../models/Source');
  const BankMetadata = require('../../models/BankMetadata');
  const GroundingDocument = require('../../models/GroundingDocument');

  // Get all unique banks with sources
  const banksWithSources = await Source.distinct('idrssd');

  // Get all banks with metadata
  const allMetadata = await BankMetadata.find({}).lean();

  // Get all banks with RAG documents
  const banksWithRAG = await GroundingDocument.distinct('idrssd');

  // Combine and get data for each
  const allBankIds = [...new Set([...banksWithSources, ...allMetadata.map(m => m.idrssd), ...banksWithRAG.filter(id => id)])];

  console.log('Banks with research data:\n');
  console.log('═'.repeat(120));
  console.log(
    'IDRSSD'.padEnd(12) +
    'Bank Name'.padEnd(45) +
    'Sources'.padEnd(10) +
    'Reports'.padEnd(10) +
    'Podcasts'.padEnd(10) +
    'Presents'.padEnd(10) +
    'RAG Docs'.padEnd(10)
  );
  console.log('═'.repeat(120));

  for (const id of allBankIds) {
    const data = await getBankData(id);
    if (data) {
      console.log(
        id.padEnd(12) +
        (data.name.substring(0, 43)).padEnd(45) +
        data.sourcesCount.toString().padEnd(10) +
        data.reportFiles.length.toString().padEnd(10) +
        data.podcastFiles.length.toString().padEnd(10) +
        data.presentationFiles.length.toString().padEnd(10) +
        data.ragDocumentsCount.toString().padEnd(10)
      );
    }
  }

  console.log('═'.repeat(120));
  console.log(`\nTotal banks with data: ${allBankIds.length}`);
}

async function deletePhase1Data(idrssd, bankName, dryRun) {
  const Source = require('../../models/Source');

  const count = await Source.countDocuments({ idrssd });

  if (count === 0) {
    console.log(`   ℹ️  No Phase 1 sources found`);
    return { deleted: 0 };
  }

  if (dryRun) {
    console.log(`   🔍 [DRY RUN] Would delete ${count} source records`);
    return { deleted: 0 };
  }

  const result = await Source.deleteMany({ idrssd });
  console.log(`   ✅ Deleted ${result.deletedCount} source records`);

  return { deleted: result.deletedCount };
}

async function deletePhase2Data(idrssd, bankName, dryRun) {
  const researchDir = path.join(__dirname, '../../data/research');
  let deletedFiles = 0;

  try {
    const allFiles = await fs.readdir(researchDir);
    const reportFiles = allFiles.filter(f => f.startsWith(`${idrssd}_agent_`) && f.endsWith('.json'));

    if (reportFiles.length === 0) {
      console.log(`   ℹ️  No Phase 2 reports found`);
      return { deleted: 0, files: [] };
    }

    if (dryRun) {
      console.log(`   🔍 [DRY RUN] Would delete ${reportFiles.length} report files:`);
      reportFiles.forEach(f => console.log(`      - ${f}`));
      return { deleted: 0, files: reportFiles };
    }

    for (const file of reportFiles) {
      const filePath = path.join(researchDir, file);
      await fs.unlink(filePath);
      deletedFiles++;
      console.log(`   ✅ Deleted report: ${file}`);
    }

    return { deleted: deletedFiles, files: reportFiles };
  } catch (err) {
    console.error(`   ⚠️  Error deleting Phase 2 data: ${err.message}`);
    return { deleted: deletedFiles, files: [], error: err.message };
  }
}

async function deletePhase3Data(idrssd, bankName, dryRun) {
  let deletedFiles = 0;
  const deletedFileNames = [];

  // Delete podcasts
  const podcastDir = path.join(__dirname, '../../data/podcasts');
  try {
    const allFiles = await fs.readdir(podcastDir);
    const podcastFiles = allFiles.filter(f => f.startsWith(`${idrssd}_`) && f.endsWith('.mp3'));

    if (podcastFiles.length > 0) {
      if (dryRun) {
        console.log(`   🔍 [DRY RUN] Would delete ${podcastFiles.length} podcast files:`);
        podcastFiles.forEach(f => console.log(`      - ${f}`));
      } else {
        for (const file of podcastFiles) {
          const filePath = path.join(podcastDir, file);
          await fs.unlink(filePath);
          deletedFiles++;
          deletedFileNames.push(file);
          console.log(`   ✅ Deleted podcast: ${file}`);
        }
      }
    }
  } catch (err) {
    // Directory might not exist
  }

  // Delete presentations
  const presentationDir = path.join(__dirname, '../../data/presentations');
  try {
    const allFiles = await fs.readdir(presentationDir);
    const presentationFiles = allFiles.filter(f => f.startsWith(`${idrssd}_`) && f.endsWith('.json'));

    if (presentationFiles.length > 0) {
      if (dryRun) {
        console.log(`   🔍 [DRY RUN] Would delete ${presentationFiles.length} presentation files:`);
        presentationFiles.forEach(f => console.log(`      - ${f}`));
      } else {
        for (const file of presentationFiles) {
          const filePath = path.join(presentationDir, file);
          await fs.unlink(filePath);
          deletedFiles++;
          deletedFileNames.push(file);
          console.log(`   ✅ Deleted presentation: ${file}`);
        }
      }
    }
  } catch (err) {
    // Directory might not exist
  }

  if (deletedFiles === 0 && !dryRun) {
    console.log(`   ℹ️  No Phase 3 podcasts/presentations found`);
  }

  return { deleted: deletedFiles, files: deletedFileNames };
}

async function deleteRAGData(idrssd, bankName, dryRun) {
  const GroundingDocument = require('../../models/GroundingDocument');
  const GroundingChunk = require('../../models/GroundingChunk');

  const docsCount = await GroundingDocument.countDocuments({ idrssd });
  const chunksCount = await GroundingChunk.countDocuments({ idrssd });

  if (docsCount === 0 && chunksCount === 0) {
    console.log(`   ℹ️  No RAG documents found`);
    return { documents: 0, chunks: 0 };
  }

  if (dryRun) {
    console.log(`   🔍 [DRY RUN] Would delete ${docsCount} RAG documents and ${chunksCount} chunks`);
    return { documents: 0, chunks: 0 };
  }

  // Get documents to delete their physical files
  const documents = await GroundingDocument.find({ idrssd }).lean();

  // Delete physical PDF files
  for (const doc of documents) {
    try {
      if (doc.filePath) {
        await fs.unlink(doc.filePath);
        console.log(`   ✅ Deleted RAG file: ${doc.filename}`);
      }
    } catch (err) {
      console.log(`   ⚠️  Could not delete file: ${doc.filename} (${err.message})`);
    }
  }

  // Delete chunks
  const chunksResult = await GroundingChunk.deleteMany({ idrssd });
  console.log(`   ✅ Deleted ${chunksResult.deletedCount} RAG chunks`);

  // Delete documents
  const docsResult = await GroundingDocument.deleteMany({ idrssd });
  console.log(`   ✅ Deleted ${docsResult.deletedCount} RAG documents`);

  return { documents: docsResult.deletedCount, chunks: chunksResult.deletedCount };
}

async function deletePDFData(idrssd, bankName, dryRun) {
  const PDF = require('../../models/PDF');

  const pdfsCount = await PDF.countDocuments({ idrssd });

  if (pdfsCount === 0) {
    console.log(`   ℹ️  No uploaded PDFs found`);
    return { deleted: 0 };
  }

  if (dryRun) {
    console.log(`   🔍 [DRY RUN] Would delete ${pdfsCount} uploaded PDF files`);
    return { deleted: 0 };
  }

  // Get PDFs to delete their physical files
  const pdfs = await PDF.find({ idrssd }).lean();

  // Delete physical files
  for (const pdf of pdfs) {
    try {
      const filePath = pdf.getFilePath ? pdf.getFilePath() : path.join(__dirname, '../../data/research/pdfs', pdf.filename);
      await fs.unlink(filePath);
      console.log(`   ✅ Deleted PDF file: ${pdf.originalFilename}`);
    } catch (err) {
      console.log(`   ⚠️  Could not delete file: ${pdf.originalFilename} (${err.message})`);
    }
  }

  // Delete PDF records
  const result = await PDF.deleteMany({ idrssd });
  console.log(`   ✅ Deleted ${result.deletedCount} PDF records`);

  return { deleted: result.deletedCount };
}

async function clearBankMetadata(idrssd, dryRun) {
  const BankMetadata = require('../../models/BankMetadata');

  const metadata = await BankMetadata.findOne({ idrssd });

  if (!metadata) {
    return { updated: false };
  }

  const itemsToClean = [];

  // Check what will be cleaned
  if (metadata.ticker && metadata.ticker.symbol) itemsToClean.push('ticker');
  if (metadata.orgChart && (metadata.orgChart.executives?.length || metadata.orgChart.boardMembers?.length)) itemsToClean.push('org chart');
  if (metadata.strategicInsights && (metadata.strategicInsights.priorities?.length || metadata.strategicInsights.focusMetrics?.length)) itemsToClean.push('strategic insights');
  if (metadata.logo && (metadata.logo.url || metadata.logo.symbolUrl)) itemsToClean.push('logo');

  if (dryRun) {
    console.log(`   🔍 [DRY RUN] Would clear BankMetadata: ${itemsToClean.length > 0 ? itemsToClean.join(', ') : 'research phases only'}`);
    return { updated: false, items: itemsToClean };
  }

  // Clear ticker information
  if (metadata.ticker) {
    metadata.ticker = undefined;
  }

  // Clear org chart
  if (metadata.orgChart) {
    metadata.orgChart = undefined;
  }

  // Clear strategic insights
  if (metadata.strategicInsights) {
    metadata.strategicInsights = undefined;
  }

  // Clear logo information
  if (metadata.logo) {
    metadata.logo = undefined;
  }

  // Reset research phases
  metadata.researchPhases = {
    phase1: { status: 'not_started' },
    phase2: { status: 'not_started' },
    phase3: { status: 'not_started' },
    phase4: { status: 'not_started' }
  };

  await metadata.save();

  const cleanedItems = ['research phases'];
  if (itemsToClean.length > 0) {
    cleanedItems.push(...itemsToClean);
  }
  console.log(`   ✅ Cleared BankMetadata: ${cleanedItems.join(', ')}`);

  return { updated: true, items: itemsToClean };
}

async function deleteBankData(bank, phases, includeRAG, includePDFs, dryRun) {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`${dryRun ? '🔍 [DRY RUN] ' : ''}Deleting data for: ${bank.name} (${bank.idrssd})`);
  console.log(`${'═'.repeat(80)}`);

  const results = {
    bank: bank.name,
    idrssd: bank.idrssd,
    phase1: null,
    phase2: null,
    phase3: null,
    rag: null,
    pdfs: null,
    metadata: null
  };

  // Phase 1: Sources
  if (phases.includes(1)) {
    console.log('\n📋 Phase 1: Deleting web sources...');
    results.phase1 = await deletePhase1Data(bank.idrssd, bank.name, dryRun);
  }

  // Phase 2: Reports
  if (phases.includes(2)) {
    console.log('\n📄 Phase 2: Deleting research reports...');
    results.phase2 = await deletePhase2Data(bank.idrssd, bank.name, dryRun);
  }

  // Phase 3: Podcasts & Presentations
  if (phases.includes(3)) {
    console.log('\n🎙️  Phase 3: Deleting podcasts and presentations...');
    results.phase3 = await deletePhase3Data(bank.idrssd, bank.name, dryRun);
  }

  // RAG documents
  if (includeRAG) {
    console.log('\n📚 Deleting RAG documents...');
    results.rag = await deleteRAGData(bank.idrssd, bank.name, dryRun);
  }

  // Uploaded PDFs
  if (includePDFs) {
    console.log('\n📎 Deleting uploaded PDFs...');
    results.pdfs = await deletePDFData(bank.idrssd, bank.name, dryRun);
  }

  // Clear metadata
  if (!dryRun) {
    console.log('\n🔄 Resetting metadata...');
    results.metadata = await clearBankMetadata(bank.idrssd, dryRun);
  }

  return results;
}

async function confirmDeletion(banks, phases, includeRAG, includePDFs) {
  if (force) {
    return true;
  }

  console.log('\n⚠️  WARNING: You are about to delete research data!\n');
  console.log(`Banks to process: ${banks.length}`);
  console.log(`Phases to delete: ${phases.join(', ')}`);
  if (includeRAG) console.log('✓ Will delete RAG documents');
  if (includePDFs) console.log('✓ Will delete uploaded PDFs');
  console.log('');

  // Show first 5 banks
  console.log('Banks that will be affected:');
  banks.slice(0, 5).forEach(b => {
    console.log(`  - ${b.name} (${b.idrssd})`);
  });
  if (banks.length > 5) {
    console.log(`  ... and ${banks.length - 5} more`);
  }

  // Prompt for confirmation
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    readline.question('\nType "DELETE" to confirm (anything else to cancel): ', (answer) => {
      readline.close();
      resolve(answer.trim() === 'DELETE');
    });
  });
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         Bank Explorer - Batch Metadata Deletion Tool          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  await connectDB();

  // List mode
  if (listOnly) {
    await listBanksWithData();
    await mongoose.disconnect();
    return;
  }

  let banks = [];

  // Single bank mode
  if (idrssd) {
    const bankData = await getBankData(idrssd);
    if (!bankData) {
      console.error(`❌ Bank with IDRSSD ${idrssd} not found`);
      await mongoose.disconnect();
      process.exit(1);
    }
    banks = [{ idrssd: bankData.idrssd, name: bankData.name }];
  } else {
    // Batch mode - get top N banks
    banks = await getTopBanks(count);
  }

  if (banks.length === 0) {
    console.log('No banks found to process');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${banks.length} bank${banks.length > 1 ? 's' : ''} to process\n`);

  if (dryRun) {
    console.log('🔍 DRY RUN MODE: No data will be actually deleted\n');
  }

  // Confirm deletion unless dry run or forced
  if (!dryRun) {
    const confirmed = await confirmDeletion(banks, phases, includeRAG, includePDFs);
    if (!confirmed) {
      console.log('\n❌ Deletion cancelled');
      await mongoose.disconnect();
      return;
    }
  }

  // Process each bank
  const allResults = [];
  for (let i = 0; i < banks.length; i++) {
    const bank = banks[i];
    console.log(`\nProcessing ${i + 1}/${banks.length}...`);

    const result = await deleteBankData(bank, phases, includeRAG, includePDFs, dryRun);
    allResults.push(result);
  }

  // Summary
  console.log('\n' + '═'.repeat(80));
  console.log(`${dryRun ? '🔍 DRY RUN ' : ''}SUMMARY`);
  console.log('═'.repeat(80));

  let totalSources = 0;
  let totalReports = 0;
  let totalPodcasts = 0;
  let totalRAGDocs = 0;
  let totalPDFs = 0;

  allResults.forEach(r => {
    if (r.phase1) totalSources += r.phase1.deleted;
    if (r.phase2) totalReports += r.phase2.deleted;
    if (r.phase3) totalPodcasts += r.phase3.deleted;
    if (r.rag) totalRAGDocs += r.rag.documents;
    if (r.pdfs) totalPDFs += r.pdfs.deleted;
  });

  console.log(`\nBanks processed: ${allResults.length}`);
  if (phases.includes(1)) console.log(`Sources deleted: ${totalSources}`);
  if (phases.includes(2)) console.log(`Reports deleted: ${totalReports}`);
  if (phases.includes(3)) console.log(`Podcasts/Presentations deleted: ${totalPodcasts}`);
  if (includeRAG) console.log(`RAG documents deleted: ${totalRAGDocs}`);
  if (includePDFs) console.log(`PDFs deleted: ${totalPDFs}`);

  if (dryRun) {
    console.log('\n💡 Run without --dry-run flag to actually delete the data');
  } else {
    console.log('\n✅ Deletion complete!');
  }

  await mongoose.disconnect();
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
