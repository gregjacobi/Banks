const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const AdmZip = require('adm-zip');
const ffiecImportService = require('../server/services/ffiecImportService');

// Check for --production flag
const isProduction = process.argv.includes('--production');

// Load appropriate .env file
if (isProduction) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.production') });
  console.log('🚀 Running in PRODUCTION mode');
} else {
  require('dotenv').config();
  console.log('🔧 Running in DEVELOPMENT mode');
}

/**
 * Re-import all ZIP files from the data directory
 * This is useful when the parser logic has been updated
 */

/**
 * Extract reporting period from filename
 */
function extractReportingPeriod(filename) {
  const match = filename.match(/(\d{8})/);
  if (match) {
    const dateStr = match[1];
    const month = dateStr.substring(0, 2);
    const day = dateStr.substring(2, 4);
    const year = dateStr.substring(4, 8);
    return new Date(`${year}-${month}-${day}`);
  }
  return null;
}

/**
 * Find all required files in the extracted directory
 */
async function findRequiredFiles(extractPath) {
  return ffiecImportService.findRequiredFiles(extractPath);
}

/**
 * Process a single ZIP file
 */
async function processZipFile(zipPath) {
  const zipFileName = path.basename(zipPath);
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📦 Processing: ${zipFileName}`);
  console.log('='.repeat(80));

  let extractPath = null;

  try {
    // Extract zip file
    console.log('📂 Extracting ZIP file...');
    extractPath = path.join(path.dirname(zipPath), `extract_${Date.now()}`);
    await fs.mkdir(extractPath, { recursive: true });

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);

    const extractedFiles = await fs.readdir(extractPath);
    console.log(`✓ Extracted ${extractedFiles.length} files`);

    // Find required files
    console.log('🔍 Locating required data files...');
    const files = await findRequiredFiles(extractPath);

    const missingFiles = [];
    if (!files.por) missingFiles.push('POR (Bank Information)');
    if (!files.rc) missingFiles.push('RC (Balance Sheet)');
    if (!files.rcci) missingFiles.push('RCCI (Loan Detail)');
    if (!files.ri) missingFiles.push('RI (Income Statement)');

    if (missingFiles.length > 0) {
      throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
    }

    console.log('✓ All required files found');

    // Extract reporting period from filename
    const reportingPeriod = extractReportingPeriod(zipFileName) ||
                           extractReportingPeriod(extractedFiles[0]) ||
                           new Date();

    console.log(`📅 Reporting Period: ${reportingPeriod.toISOString().split('T')[0]}`);

    // Process the import using the centralized service (includes RC-M parsing for website URLs)
    await ffiecImportService.processImport(files, reportingPeriod, (msg, type) => {
      if (type === 'error') console.error(msg);
      else if (type === 'warning') console.warn(msg);
      else console.log(msg);
    });

    // Clean up
    console.log('🧹 Cleaning up temporary files...');
    await fs.rm(extractPath, { recursive: true, force: true });
    console.log('✓ Cleanup complete');

    return { success: true, zipFileName };

  } catch (error) {
    console.error(`❌ Error processing ${zipFileName}:`, error.message);

    // Clean up on error
    if (extractPath) {
      try {
        await fs.rm(extractPath, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }

    return { success: false, zipFileName, error: error.message };
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    // Find all ZIP files in data directory
    const dataDir = path.join(__dirname, '..', 'data');
    const files = await fs.readdir(dataDir);
    const zipFiles = files
      .filter(f => f.toLowerCase().endsWith('.zip'))
      .map(f => path.join(dataDir, f));

    if (zipFiles.length === 0) {
      console.log('❌ No ZIP files found in data directory');
      process.exit(0);
    }

    console.log(`📦 Found ${zipFiles.length} ZIP file(s) to process:`);
    zipFiles.forEach(f => console.log(`   - ${path.basename(f)}`));

    // Process each ZIP file
    const results = [];
    for (const zipPath of zipFiles) {
      const result = await processZipFile(zipPath);
      results.push(result);
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('🎉 IMPORT SUMMARY');
    console.log('='.repeat(80));

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Total ZIP files: ${results.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);

    if (failed > 0) {
      console.log('\n❌ Failed imports:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`   - ${r.zipFileName}: ${r.error}`);
      });
    }

    console.log('');

    // Close connection
    await mongoose.connection.close();
    process.exit(failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('💥 Fatal error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { processZipFile };
