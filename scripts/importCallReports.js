const path = require('path');
const mongoose = require('mongoose');
const CallReportParser = require('../server/utils/callReportParser');
const Institution = require('../server/models/Institution');
const FinancialStatement = require('../server/models/FinancialStatement');

/**
 * Import Call Report data into MongoDB
 * Usage: node scripts/importCallReports.js
 */
async function importCallReports() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bankexplorer';
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    const parser = new CallReportParser();
    const dataDir = path.join(__dirname, '..', 'data', 'FFIEC CDR Call Bulk All Schedules 06302025');

    // File paths
    const porFile = path.join(dataDir, 'FFIEC CDR Call Bulk POR 06302025.txt');
    const rcFile = path.join(dataDir, 'FFIEC CDR Call Schedule RC 06302025.txt');
    const rcciFile = path.join(dataDir, 'FFIEC CDR Call Schedule RCCI 06302025.txt');
    const riFile = path.join(dataDir, 'FFIEC CDR Call Schedule RI 06302025.txt');

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

        // Calculate ratios (pass reporting period for proper annualization)
        const reportingPeriod = new Date('2025-06-30');
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
          { idrssd, reportingPeriod: new Date('2025-06-30') },
          {
            idrssd,
            reportingPeriod: new Date('2025-06-30'),
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
      if (institutionsCreated % 500 === 0) {
        console.log(`  Processed ${institutionsCreated} banks...`);
      }
    }

    console.log(`\n✅ Import Complete!`);
    console.log(`   Institutions: ${institutionsCreated}`);
    console.log(`   Financial Statements: ${financialStatementsCreated}`);
    console.log(`   Validation Errors: ${validationErrors}`);

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
  importCallReports()
    .then(() => {
      console.log('\n🎉 Import successful!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Import failed:', error);
      process.exit(1);
    });
}

module.exports = importCallReports;
