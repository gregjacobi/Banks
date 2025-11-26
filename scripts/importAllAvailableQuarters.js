require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const ffiecImportService = require('../server/services/ffiecImportService');

/**
 * Import all available quarters from extracted data directories
 * Automatically discovers all extracted quarters in the data directory
 */
async function importAllAvailableQuarters() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    // Find all extracted directories in data directory
    const dataDir = path.join(__dirname, '..', 'data');
    const allItems = fs.readdirSync(dataDir);

    // Filter for directories that match the FFIEC pattern
    const extractedDirs = allItems.filter(item => {
      const itemPath = path.join(dataDir, item);
      const isDir = fs.statSync(itemPath).isDirectory();
      const matchesPattern = item.includes('FFIEC CDR Call Bulk All Schedules');
      return isDir && matchesPattern;
    });

    if (extractedDirs.length === 0) {
      console.log('❌ No extracted data directories found');
      process.exit(0);
    }

    console.log(`📦 Found ${extractedDirs.length} extracted quarter(s):\n`);

    // Extract quarter info and sort chronologically
    const quarters = extractedDirs.map(dir => {
      const dateMatch = dir.match(/(\d{8})/);
      if (dateMatch) {
        const dateStr = dateMatch[1];
        const month = dateStr.substring(0, 2);
        const day = dateStr.substring(2, 4);
        const year = dateStr.substring(4, 8);
        return {
          date: `${year}-${month}-${day}`,
          dir: dir,
          suffix: dateStr,
          sortKey: `${year}-${month}-${day}`
        };
      }
      return null;
    }).filter(q => q !== null).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    quarters.forEach((q, i) => {
      console.log(`   ${i + 1}. ${q.date} (${q.dir})`);
    });
    console.log('');

    let totalInstitutions = 0;
    let totalStatements = 0;
    let totalValidationErrors = 0;

    for (let i = 0; i < quarters.length; i++) {
      const quarter = quarters[i];
      console.log(`${'='.repeat(80)}`);
      console.log(`📅 Processing Quarter ${i + 1}/${quarters.length}: ${quarter.date}`);
      console.log('='.repeat(80));

      const extractedDir = path.join(dataDir, quarter.dir);

      // File paths
      const porFile = path.join(extractedDir, `FFIEC CDR Call Bulk POR ${quarter.suffix}.txt`);
      const rcFile = path.join(extractedDir, `FFIEC CDR Call Schedule RC ${quarter.suffix}.txt`);
      const rcciFile = path.join(extractedDir, `FFIEC CDR Call Schedule RCCI ${quarter.suffix}.txt`);
      const riFile = path.join(extractedDir, `FFIEC CDR Call Schedule RI ${quarter.suffix}.txt`);
      const rcmFile = path.join(extractedDir, `FFIEC CDR Call Schedule RCM ${quarter.suffix}.txt`);

      // Verify required files exist (RCM is optional)
      const files = { por: porFile, rc: rcFile, rcci: rcciFile, ri: riFile };
      if (fs.existsSync(rcmFile)) {
        files.rcm = rcmFile;
      }
      const missingFiles = Object.entries(files)
        .filter(([key, filepath]) => !fs.existsSync(filepath))
        .map(([key]) => key);

      if (missingFiles.length > 0) {
        console.log(`⚠️  Missing files for ${quarter.date}: ${missingFiles.join(', ')}`);
        console.log('   Skipping this quarter...\n');
        continue;
      }

      // Import the quarter
      const reportingPeriod = new Date(quarter.date);
      const result = await ffiecImportService.processImport(files, reportingPeriod, (msg, type) => {
        if (type === 'error') console.error(msg);
        else if (type === 'warning') console.warn(msg);
        else console.log(msg);
      });

      totalInstitutions += result.institutionsCreated;
      totalStatements += result.financialStatementsCreated;
      totalValidationErrors += result.validationErrors;

      console.log('');
    }

    console.log('='.repeat(80));
    console.log('🎉 ALL QUARTERS IMPORTED!');
    console.log('='.repeat(80));
    console.log(`   Total Institutions: ${totalInstitutions}`);
    console.log(`   Total Financial Statements: ${totalStatements}`);
    console.log(`   Total Validation Errors: ${totalValidationErrors}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error importing data:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('✓ Database connection closed\n');
  }
}

// Run import
if (require.main === module) {
  importAllAvailableQuarters()
    .then(() => {
      console.log('🎉 Import successful!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Import failed:', error);
      process.exit(1);
    });
}

module.exports = importAllAvailableQuarters;
