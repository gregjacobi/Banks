const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
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
 * Import all quarters of Call Report data into MongoDB
 * Uses the centralized ffiecImportService which includes:
 * - RC-M (website URLs)
 * - RC-N (credit quality - past due, nonaccrual)
 * - RI-B (charge-offs and recoveries)
 * - Loan categorization (Consumer vs Business)
 * - Validation totals
 *
 * Usage:
 *   node scripts/importAllQuarters.js              # Development (local DB)
 *   node scripts/importAllQuarters.js --production # Production (Atlas DB)
 */
async function importAllQuarters() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bankexplorer';
    console.log(`📊 Connecting to: ${mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    // Define all quarters to import (Q1 2020 - Q3 2025)
    const quarters = [
      // 2020
      { date: '2020-03-31', dir: 'FFIEC CDR Call Bulk All Schedules 03312020', suffix: '03312020' },
      { date: '2020-06-30', dir: 'FFIEC CDR Call Bulk All Schedules 06302020', suffix: '06302020' },
      { date: '2020-09-30', dir: 'FFIEC CDR Call Bulk All Schedules 09302020', suffix: '09302020' },
      { date: '2020-12-31', dir: 'FFIEC CDR Call Bulk All Schedules 12312020', suffix: '12312020' },
      // 2021
      { date: '2021-03-31', dir: 'FFIEC CDR Call Bulk All Schedules 03312021', suffix: '03312021' },
      { date: '2021-06-30', dir: 'FFIEC CDR Call Bulk All Schedules 06302021', suffix: '06302021' },
      { date: '2021-09-30', dir: 'FFIEC CDR Call Bulk All Schedules 09302021', suffix: '09302021' },
      { date: '2021-12-31', dir: 'FFIEC CDR Call Bulk All Schedules 12312021', suffix: '12312021' },
      // 2022
      { date: '2022-03-31', dir: 'FFIEC CDR Call Bulk All Schedules 03312022', suffix: '03312022' },
      { date: '2022-06-30', dir: 'FFIEC CDR Call Bulk All Schedules 06302022', suffix: '06302022' },
      { date: '2022-09-30', dir: 'FFIEC CDR Call Bulk All Schedules 09302022', suffix: '09302022' },
      { date: '2022-12-31', dir: 'FFIEC CDR Call Bulk All Schedules 12312022', suffix: '12312022' },
      // 2023
      { date: '2023-03-31', dir: 'FFIEC CDR Call Bulk All Schedules 03312023', suffix: '03312023' },
      { date: '2023-06-30', dir: 'FFIEC CDR Call Bulk All Schedules 06302023', suffix: '06302023' },
      { date: '2023-09-30', dir: 'FFIEC CDR Call Bulk All Schedules 09302023', suffix: '09302023' },
      { date: '2023-12-31', dir: 'FFIEC CDR Call Bulk All Schedules 12312023', suffix: '12312023' },
      // 2024
      { date: '2024-03-31', dir: 'FFIEC CDR Call Bulk All Schedules 03312024', suffix: '03312024' },
      { date: '2024-06-30', dir: 'FFIEC CDR Call Bulk All Schedules 06302024', suffix: '06302024' },
      { date: '2024-09-30', dir: 'FFIEC CDR Call Bulk All Schedules 09302024', suffix: '09302024' },
      { date: '2024-12-31', dir: 'FFIEC CDR Call Bulk All Schedules 12312024', suffix: '12312024' },
      // 2025
      { date: '2025-03-31', dir: 'FFIEC CDR Call Bulk All Schedules 03312025', suffix: '03312025' },
      { date: '2025-06-30', dir: 'FFIEC CDR Call Bulk All Schedules 06302025', suffix: '06302025' },
      { date: '2025-09-30', dir: 'FFIEC CDR Call Bulk All Schedules 09302025', suffix: '09302025' },
      { date: '2025-12-31', dir: 'FFIEC CDR Call Bulk All Schedules 12312025', suffix: '12312025' }
    ];

    let totalInstitutions = 0;
    let totalStatements = 0;
    let totalValidationErrors = 0;
    let quartersProcessed = 0;
    let quartersSkipped = 0;

    for (const quarter of quarters) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📅 Processing Quarter: ${quarter.date}`);
      console.log('='.repeat(80));

      const dataDir = path.join(__dirname, '..', 'data', quarter.dir);

      // Check if directory exists
      if (!fs.existsSync(dataDir)) {
        console.log(`⚠️ Directory not found: ${quarter.dir}`);
        console.log('   Skipping this quarter...');
        quartersSkipped++;
        continue;
      }

      // Helper to find file by pattern (handles multi-part files and variations)
      const findFile = (pattern) => {
        const dirFiles = fs.readdirSync(dataDir);
        // Find first file matching the pattern (case-insensitive)
        const match = dirFiles.find(f => f.toLowerCase().includes(pattern.toLowerCase()));
        return match ? path.join(dataDir, match) : null;
      };

      // Build file paths for this quarter
      const files = {
        por: path.join(dataDir, `FFIEC CDR Call Bulk POR ${quarter.suffix}.txt`),
        rc: path.join(dataDir, `FFIEC CDR Call Schedule RC ${quarter.suffix}.txt`),
        rcci: path.join(dataDir, `FFIEC CDR Call Schedule RCCI ${quarter.suffix}.txt`),
        ri: path.join(dataDir, `FFIEC CDR Call Schedule RI ${quarter.suffix}.txt`),
        // Optional files - find by pattern since naming varies
        rcm: findFile(`Schedule RCM ${quarter.suffix}`),
        rcn: findFile(`Schedule RCN ${quarter.suffix}`),  // May be split into (1 of 2), (2 of 2)
        rib: findFile(`Schedule RIBI ${quarter.suffix}`)   // Named RIBI, not RIB
      };

      // Check required files exist
      const requiredFiles = ['por', 'rc', 'rcci', 'ri'];
      const missingRequired = requiredFiles.filter(f => !fs.existsSync(files[f]));

      if (missingRequired.length > 0) {
        console.log(`⚠️ Missing required files: ${missingRequired.join(', ')}`);
        console.log('   Skipping this quarter...');
        quartersSkipped++;
        continue;
      }

      try {
        // Use centralized import service
        const reportingPeriod = new Date(quarter.date);
        const result = await ffiecImportService.processImport(files, reportingPeriod, (msg, type) => {
          if (type === 'error') console.error(`   ${msg}`);
          else if (type === 'warning') console.warn(`   ${msg}`);
          else if (type === 'success') console.log(`   ✓ ${msg}`);
          else console.log(`   ${msg}`);
        });

        totalInstitutions += result.institutionsCreated;
        totalStatements += result.financialStatementsCreated;
        totalValidationErrors += result.validationErrors;
        quartersProcessed++;

        console.log(`\n✅ Quarter ${quarter.date} Complete!`);

      } catch (error) {
        console.error(`❌ Error processing quarter ${quarter.date}:`, error.message);
        quartersSkipped++;
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('🎉 IMPORT COMPLETE!');
    console.log('='.repeat(80));
    console.log(`   Quarters Processed: ${quartersProcessed}`);
    console.log(`   Quarters Skipped: ${quartersSkipped}`);
    console.log(`   Total Institutions: ${totalInstitutions}`);
    console.log(`   Total Financial Statements: ${totalStatements}`);
    console.log(`   Total Validation Errors: ${totalValidationErrors}`);

  } catch (error) {
    console.error('❌ Error importing data:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
  }
}

// Run import
if (require.main === module) {
  importAllQuarters()
    .then(() => {
      console.log('\n🎉 Import successful!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Import failed:', error);
      process.exit(1);
    });
}

module.exports = importAllQuarters;
