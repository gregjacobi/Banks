require('dotenv').config();
const path = require('path');
const mongoose = require('mongoose');
const CallReportParser = require('../server/utils/callReportParser');
const Institution = require('../server/models/Institution');
const FinancialStatement = require('../server/models/FinancialStatement');

/**
 * Import all available quarters from extracted data directories
 */
async function importAvailableQuarters() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    const parser = new CallReportParser();

    // Define quarters that are available (have extracted directories)
    const quarters = [
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

      console.log('📖 Parsing Schedule POR (Bank Information)...');
      const porData = await parser.parseSchedule(porFile);
      console.log(`✓ Found ${porData.banks.length} banks`);

      console.log('📖 Parsing Schedule RC (Balance Sheet)...');
      const rcData = await parser.parseSchedule(rcFile);
      console.log(`✓ Parsed ${rcData.banks.length} balance sheets`);

      console.log('📖 Parsing Schedule RCCI (Loan Detail)...');
      const rcciData = await parser.parseSchedule(rcciFile);
      console.log(`✓ Parsed ${rcciData.banks.length} loan portfolios`);

      console.log('📖 Parsing Schedule RI (Income Statement)...');
      const riData = await parser.parseSchedule(riFile);
      console.log(`✓ Parsed ${riData.banks.length} income statements`);

      // Create lookup maps by IDRSSD
      const rcMap = new Map(rcData.banks.map(b => [b.IDRSSD, b]));
      const rcciMap = new Map(rcciData.banks.map(b => [b.IDRSSD, b]));
      const riMap = new Map(riData.banks.map(b => [b.IDRSSD, b]));

      console.log('💾 Importing data to MongoDB...');
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

          // Calculate ratios (pass reporting period for proper annualization)
          const reportingPeriod = new Date(quarter.date);
          const ratios = parser.calculateRatios(balanceSheet, incomeStatement, reportingPeriod);

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
  importAvailableQuarters()
    .then(() => {
      console.log('\n🎉 Import successful!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Import failed:', error);
      process.exit(1);
    });
}

module.exports = importAvailableQuarters;
