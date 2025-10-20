const path = require('path');
const mongoose = require('mongoose');
const CallReportParser = require('../server/utils/callReportParser');
const Institution = require('../server/models/Institution');
const FinancialStatement = require('../server/models/FinancialStatement');

/**
 * Import all quarters of Call Report data into MongoDB
 * Usage: node scripts/importAllQuarters.js
 */
async function importAllQuarters() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bankexplorer';
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    const parser = new CallReportParser();

    // Define all quarters to import
    const quarters = [
      { date: '2023-03-31', dir: 'FFIEC CDR Call Bulk All Schedules 03312023', suffix: '03312023' },
      { date: '2023-06-30', dir: 'FFIEC CDR Call Bulk All Schedules 06302023', suffix: '06302023' },
      { date: '2023-09-30', dir: 'FFIEC CDR Call Bulk All Schedules 09302023', suffix: '09302023' },
      { date: '2023-12-31', dir: 'FFIEC CDR Call Bulk All Schedules 12312023', suffix: '12312023' },
      { date: '2024-03-31', dir: 'FFIEC CDR Call Bulk All Schedules 03312024', suffix: '03312024' },
      { date: '2024-06-30', dir: 'FFIEC CDR Call Bulk All Schedules 06302024', suffix: '06302024' },
      { date: '2024-09-30', dir: 'FFIEC CDR Call Bulk All Schedules 09302024', suffix: '09302024' },
      { date: '2024-12-31', dir: 'FFIEC CDR Call Bulk All Schedules 12312024', suffix: '12312024' },
      { date: '2025-03-31', dir: 'FFIEC CDR Call Bulk All Schedules 03312025', suffix: '03312025' },
      { date: '2025-06-30', dir: 'FFIEC CDR Call Bulk All Schedules 06302025', suffix: '06302025' }
    ];

    let totalInstitutions = 0;
    let totalStatements = 0;
    let totalValidationErrors = 0;

    for (const quarter of quarters) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📅 Processing Quarter: ${quarter.date}`);
      console.log('='.repeat(80));

      const dataDir = path.join(__dirname, '..', 'data', quarter.dir);

      // File paths
      const porFile = path.join(dataDir, `FFIEC CDR Call Bulk POR ${quarter.suffix}.txt`);
      const rcFile = path.join(dataDir, `FFIEC CDR Call Schedule RC ${quarter.suffix}.txt`);
      const rcciFile = path.join(dataDir, `FFIEC CDR Call Schedule RCCI ${quarter.suffix}.txt`);
      const riFile = path.join(dataDir, `FFIEC CDR Call Schedule RI ${quarter.suffix}.txt`);

    console.log('\n📖 Parsing Schedule POR (Bank Information)...');
    const porData = await parser.parseSchedule(porFile);
    console.log(`✓ Found ${porData.banks.length} banks`);

    console.log('\n📖 Parsing Schedule RC (Balance Sheet)...');
    const rcData = await parser.parseSchedule(rcFile);
    console.log(`✓ Parsed ${rcData.banks.length} balance sheets`);

    console.log('\n📖 Parsing Schedule RCCI (Loan Detail)...');
    const rcciData = await parser.parseSchedule(rcciFile);
    console.log(`✓ Parsed ${rcciData.banks.length} loan portfolios`);

    console.log('\n📖 Parsing Schedule RI (Income Statement)...');
    const riData = await parser.parseSchedule(riFile);
    console.log(`✓ Parsed ${riData.banks.length} income statements`);

    // Create lookup maps by IDRSSD
    const rcMap = new Map(rcData.banks.map(b => [b.IDRSSD, b]));
    const rcciMap = new Map(rcciData.banks.map(b => [b.IDRSSD, b]));
    const riMap = new Map(riData.banks.map(b => [b.IDRSSD, b]));

    console.log('\n💾 Importing data to MongoDB...');
    let institutionsCreated = 0;
    let financialStatementsCreated = 0;
    let validationErrors = 0;

    for (const bank of porData.banks) {
      const idrssd = bank.IDRSSD;

      // Create/update institution
      await Institution.findOneAndUpdate(
        { idrssd },
        {
          idrssd,
          name: bank['Financial Institution Name'],
          fdicCert: bank['FDIC Certificate Number'],
          occCharter: bank['OCC Charter Number'],
          abaRouting: bank['Primary ABA Routing Number'],
          address: bank['Financial Institution Address'],
          city: bank['Financial Institution City'],
          state: bank['Financial Institution State'],
          zipCode: bank['Financial Institution Zip Code'],
          filingType: bank['Financial Institution Filing Type'],
          lastUpdated: new Date(bank['Last Date/Time Submission Updated On'])
        },
        { upsert: true, new: true }
      );
      institutionsCreated++;

      // Get corresponding balance sheet, loan detail, and income statement data
      const rcBank = rcMap.get(idrssd);
      const rcciBank = rcciMap.get(idrssd);
      const riBank = riMap.get(idrssd);

      if (rcBank && riBank) {
        // Merge RC and RCCI data for complete balance sheet
        const mergedData = { ...rcBank, ...rcciBank };

        // Transform data
        const balanceSheet = parser.transformBalanceSheet(mergedData);
        const incomeStatement = parser.transformIncomeStatement(riBank);

        // Calculate ratios
        const ratios = parser.calculateRatios(balanceSheet, incomeStatement);

        // Validate
        const bsValidation = parser.validateBalanceSheet(balanceSheet);
        const isValidation = parser.validateIncomeStatement(incomeStatement);

        const errors = [];
        if (!bsValidation.isValid) {
          errors.push(`Balance sheet doesn't balance: Assets=${bsValidation.assets}, Liab+Equity=${bsValidation.liabilitiesAndEquity}`);
          validationErrors++;
        }
        if (!isValidation.isValid) {
          errors.push(`Income statement NII mismatch: Calculated=${isValidation.calculated}, Reported=${isValidation.reported}`);
        }

        // Create financial statement
        await FinancialStatement.findOneAndUpdate(
          { idrssd, reportingPeriod: new Date(quarter.date) },
          {
            idrssd,
            reportingPeriod: new Date(quarter.date),
            balanceSheet,
            incomeStatement,
            ratios,
            validation: {
              balanceSheetValid: bsValidation.isValid,
              incomeStatementValid: isValidation.isValid,
              errors
            }
          },
          { upsert: true, new: true }
        );
        financialStatementsCreated++;
      }

      // Progress indicator
      if (financialStatementsCreated % 500 === 0 && financialStatementsCreated > 0) {
        console.log(`  Processed ${financialStatementsCreated} statements...`);
      }
    }

    console.log(`\n✅ Quarter ${quarter.date} Complete!`);
    console.log(`   Institutions: ${institutionsCreated}`);
    console.log(`   Financial Statements: ${financialStatementsCreated}`);
    console.log(`   Validation Errors: ${validationErrors}`);

    totalInstitutions += institutionsCreated;
    totalStatements += financialStatementsCreated;
    totalValidationErrors += validationErrors;
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('🎉 ALL QUARTERS IMPORTED!');
  console.log('='.repeat(80));
  console.log(`   Total Institutions: ${totalInstitutions}`);
  console.log(`   Total Financial Statements: ${totalStatements}`);
  console.log(`   Total Validation Errors: ${totalValidationErrors}`);

  // Create text index for search
  console.log('\n🔍 Creating search indexes...');
  await Institution.createIndexes();
  await FinancialStatement.createIndexes();
  console.log('✓ Indexes created');

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
