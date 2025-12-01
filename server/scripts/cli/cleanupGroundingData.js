#!/usr/bin/env node

/**
 * Cleanup Grounding Data Script
 *
 * Removes stale, duplicate, or irrelevant RAG data from MongoDB to free up storage space.
 *
 * Cleanup targets:
 * 1. Failed processing documents and their chunks
 * 2. Non-US banks (HSBC, UBS, BBVA, BMO, MUFG, etc.)
 * 3. Duplicate documents for the same bank/quarter
 * 4. Old quarterly presentations if multiple exist (keep most recent)
 *
 * IMPORTANT: This script permanently deletes data. Use --dry-run to preview changes first.
 */

const path = require('path');
const mongoose = require('mongoose');

// Load environment
const args = process.argv.slice(2);
const isProduction = args.includes('--production');
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose') || args.includes('-v');

if (isProduction) {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env.production') });
  console.log('🚀 Running in PRODUCTION mode');
} else {
  require('dotenv').config();
  console.log('🔧 Running in DEVELOPMENT mode');
}

if (isDryRun) {
  console.log('🔍 DRY RUN MODE - No data will be deleted\n');
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bankexplorer';

const GroundingDocument = require('../../models/GroundingDocument');
const GroundingChunk = require('../../models/GroundingChunk');

// Non-US banks to exclude (these are taking up space but not relevant for US bank analysis)
const NON_US_BANKS = [
  '413208',   // HSBC USA (UK parent)
  '3212149',  // UBS (Swiss)
  '697633',   // BBVA (Spanish)
  '75633',    // BMO Harris (Canadian parent - keep US subsidiary 804963)
  '804963',   // Bank of the West (now BMO, Canadian)
];

// Keep track of what we're deleting
const deletionReport = {
  failedDocs: [],
  nonUSBanks: [],
  duplicates: [],
  totalDocsDeleted: 0,
  totalChunksDeleted: 0,
  spaceSavedMB: 0
};

/**
 * Calculate approximate size of document + chunks in MB
 */
async function calculateDocumentSize(documentId) {
  const chunks = await GroundingChunk.find({ documentId }).lean();

  // Rough estimate: each chunk has ~500 chars content + 1024 float embedding
  // Content: ~500 bytes, Embedding: 1024 * 4 bytes = 4096 bytes, Metadata: ~500 bytes
  // Total per chunk: ~5KB
  const estimatedSize = chunks.length * 5 * 1024; // bytes

  return {
    chunkCount: chunks.length,
    sizeBytes: estimatedSize,
    sizeMB: (estimatedSize / 1024 / 1024)
  };
}

/**
 * Delete document and its chunks
 */
async function deleteDocument(doc, reason) {
  const size = await calculateDocumentSize(doc._id);

  if (isVerbose || isDryRun) {
    console.log(`  ${isDryRun ? '[DRY RUN]' : '🗑️ '} Deleting: ${doc.title || doc.filename}`);
    console.log(`    Reason: ${reason}`);
    console.log(`    Bank: ${doc.idrssd || 'unknown'}`);
    console.log(`    Chunks: ${size.chunkCount}`);
    console.log(`    Size: ${size.sizeMB.toFixed(2)} MB`);
  }

  if (!isDryRun) {
    // Delete chunks first
    await GroundingChunk.deleteMany({ documentId: doc._id });

    // Delete document
    await GroundingDocument.findByIdAndDelete(doc._id);
  }

  return {
    doc,
    reason,
    ...size
  };
}

/**
 * Main cleanup logic
 */
async function cleanup() {
  console.log('📊 Analyzing grounding data...\n');

  // 1. Find and delete failed documents
  console.log('Step 1: Removing failed processing documents...');
  const failedDocs = await GroundingDocument.find({ processingStatus: 'failed' });

  for (const doc of failedDocs) {
    const result = await deleteDocument(doc, 'Failed processing');
    deletionReport.failedDocs.push(result);
    deletionReport.totalDocsDeleted++;
    deletionReport.totalChunksDeleted += result.chunkCount;
    deletionReport.spaceSavedMB += result.sizeMB;
  }

  console.log(`  ✓ Found ${failedDocs.length} failed documents\n`);

  // 2. Remove non-US bank documents
  console.log('Step 2: Removing non-US bank documents...');
  const nonUSBankDocs = await GroundingDocument.find({
    idrssd: { $in: NON_US_BANKS }
  });

  for (const doc of nonUSBankDocs) {
    const result = await deleteDocument(doc, 'Non-US bank');
    deletionReport.nonUSBanks.push(result);
    deletionReport.totalDocsDeleted++;
    deletionReport.totalChunksDeleted += result.chunkCount;
    deletionReport.spaceSavedMB += result.sizeMB;
  }

  console.log(`  ✓ Found ${nonUSBankDocs.length} non-US bank documents\n`);

  // 3. Find and remove duplicate quarterly presentations (keep most recent)
  console.log('Step 3: Removing duplicate quarterly presentations...');

  // Get all completed documents grouped by bank
  const allDocs = await GroundingDocument.find({
    processingStatus: 'completed',
    idrssd: { $exists: true, $nin: NON_US_BANKS }
  }).sort({ createdAt: -1 });

  // Track unique presentations by bank + quarter + type
  const seen = new Map();
  const duplicatesToDelete = [];

  for (const doc of allDocs) {
    const title = doc.title || doc.filename || '';

    // Extract quarter/year from title (Q1 2025, Q2 2024, etc.)
    const quarterMatch = title.match(/Q([1-4])\s*(20\d{2})/i);
    if (!quarterMatch) continue; // Skip if no quarter found

    const quarter = quarterMatch[1];
    const year = quarterMatch[2];

    // Determine document type (earnings, presentation, supplement, etc.)
    let docType = 'other';
    if (title.toLowerCase().includes('earnings')) docType = 'earnings';
    else if (title.toLowerCase().includes('presentation') || title.toLowerCase().includes('investor')) docType = 'presentation';
    else if (title.toLowerCase().includes('supplement')) docType = 'supplement';
    else if (title.toLowerCase().includes('transcript')) docType = 'transcript';

    const key = `${doc.idrssd}-${year}-Q${quarter}-${docType}`;

    if (seen.has(key)) {
      // Duplicate found - mark for deletion (keeping the first one which is most recent due to sort)
      duplicatesToDelete.push(doc);
    } else {
      seen.set(key, doc);
    }
  }

  for (const doc of duplicatesToDelete) {
    const result = await deleteDocument(doc, 'Duplicate quarterly presentation');
    deletionReport.duplicates.push(result);
    deletionReport.totalDocsDeleted++;
    deletionReport.totalChunksDeleted += result.chunkCount;
    deletionReport.spaceSavedMB += result.sizeMB;
  }

  console.log(`  ✓ Found ${duplicatesToDelete.length} duplicate presentations\n`);
}

/**
 * Print summary report
 */
function printReport() {
  console.log('\n========================================');
  console.log('📋 CLEANUP SUMMARY REPORT');
  console.log('========================================\n');

  console.log(`${isDryRun ? 'Would delete' : 'Deleted'}:`);
  console.log(`  Documents: ${deletionReport.totalDocsDeleted}`);
  console.log(`  Chunks: ${deletionReport.totalChunksDeleted.toLocaleString()}`);
  console.log(`  Storage freed: ${deletionReport.spaceSavedMB.toFixed(2)} MB`);
  console.log('');

  console.log('Breakdown:');
  console.log(`  Failed documents: ${deletionReport.failedDocs.length} docs, ${deletionReport.failedDocs.reduce((sum, d) => sum + d.sizeMB, 0).toFixed(2)} MB`);
  console.log(`  Non-US banks: ${deletionReport.nonUSBanks.length} docs, ${deletionReport.nonUSBanks.reduce((sum, d) => sum + d.sizeMB, 0).toFixed(2)} MB`);
  console.log(`  Duplicates: ${deletionReport.duplicates.length} docs, ${deletionReport.duplicates.reduce((sum, d) => sum + d.sizeMB, 0).toFixed(2)} MB`);
  console.log('');

  if (deletionReport.totalDocsDeleted === 0) {
    console.log('✨ No cleanup needed - data is already clean!');
  } else if (isDryRun) {
    console.log('💡 Run without --dry-run to perform actual deletion');
  } else {
    console.log('✅ Cleanup completed successfully!');
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Connect to MongoDB
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    // Run cleanup
    await cleanup();

    // Print report
    printReport();

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Show help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Cleanup Grounding Data Script

USAGE:
  node cleanupGroundingData.js [options]

OPTIONS:
  --production        Use production MongoDB (from .env.production)
  --dry-run           Preview changes without deleting data
  --verbose, -v       Show detailed information about each deletion
  --help, -h          Show this help message

EXAMPLES:
  # Preview cleanup in development
  node cleanupGroundingData.js --dry-run --verbose

  # Preview cleanup in production
  node cleanupGroundingData.js --production --dry-run

  # Actually perform cleanup in production
  node cleanupGroundingData.js --production

WHAT GETS DELETED:
  1. Documents with processingStatus='failed'
  2. Documents from non-US banks (HSBC, UBS, BBVA, BMO)
  3. Duplicate quarterly presentations (keeps most recent)
`);
  process.exit(0);
}

// Run
main();
