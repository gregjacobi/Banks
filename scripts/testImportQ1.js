const path = require('path');
const mongoose = require('mongoose');
const CallReportParser = require('../server/utils/callReportParser');
const Institution = require('../server/models/Institution');
const FinancialStatement = require('../server/models/FinancialStatement');

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

async function testImportQ1() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    const parser = new CallReportParser();
    const dataDir = path.join(__dirname, '..', 'data', 'FFIEC CDR Call Bulk All Schedules 03312025');

    const porFile = path.join(dataDir, 'FFIEC CDR Call Bulk POR 03312025.txt');
    const rcFile = path.join(dataDir, 'FFIEC CDR Call Schedule RC 03312025.txt');
    const rcciFile = path.join(dataDir, 'FFIEC CDR Call Schedule RCCI 03312025.txt');
    const riFile = path.join(dataDir, 'FFIEC CDR Call Schedule RI 03312025.txt');

    console.log('📖 Parsing Schedule POR (Bank Information)...');
    const porData = await parser.parseSchedule(porFile);
    console.log(`✓ Found ${porData.banks.length} banks`);
    console.log(`✓ Field codes: ${porData.fieldCodes.length}`);

    console.log('\n📖 Parsing Schedule RC (Balance Sheet)...');
    const rcData = await parser.parseSchedule(rcFile);
    console.log(`✓ Parsed ${rcData.banks.length} balance sheets`);
    console.log(`✓ Field codes: ${rcData.fieldCodes.length}`);

    console.log('\n📖 Parsing Schedule RCCI (Loan Detail)...');
    const rcciData = await parser.parseSchedule(rcciFile);
    console.log(`✓ Parsed ${rcciData.banks.length} loan portfolios`);
    console.log(`✓ Field codes: ${rcciData.fieldCodes.length}`);

    console.log('\n📖 Parsing Schedule RI (Income Statement)...');
    const riData = await parser.parseSchedule(riFile);
    console.log(`✓ Parsed ${riData.banks.length} income statements`);
    console.log(`✓ Field codes: ${riData.fieldCodes.length}`);

    // Check a specific bank's income data
    const testBank = riData.banks[0];
    console.log('\n🔍 Test Bank Income Data (first bank):');
    console.log(`   IDRSSD: ${testBank.IDRSSD}`);
    console.log(`   Total keys: ${Object.keys(testBank).length}`);
    console.log(`   RIAD4340 (Net Income): ${testBank.RIAD4340}`);
    console.log(`   RIAD4074 (NII): ${testBank.RIAD4074}`);
    console.log(`   RIAD4010 (Interest Income - Loans): ${testBank.RIAD4010}`);

    // Transform and check
    const incomeStatement = parser.transformIncomeStatement(testBank);
    console.log('\n🔍 Transformed Income Statement:');
    console.log(`   Net Income: ${incomeStatement.netIncome}`);
    console.log(`   Interest Income (Loans): ${incomeStatement.interestIncome.loans}`);
    console.log(`   Net Interest Income: ${incomeStatement.netInterestIncome}`);

    // Create lookup maps
    const rcMap = new Map(rcData.banks.map(b => [b.IDRSSD, b]));
    const rcciMap = new Map(rcciData.banks.map(b => [b.IDRSSD, b]));
    const riMap = new Map(riData.banks.map(b => [b.IDRSSD, b]));

    console.log('\n💾 Importing first 10 banks to test...');
    let count = 0;

    for (const bank of porData.banks.slice(0, 10)) {
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

      const rcBank = rcMap.get(idrssd);
      const rcciBank = rcciMap.get(idrssd);
      const riBank = riMap.get(idrssd);

      if (rcBank && riBank) {
        const mergedData = { ...rcBank, ...rcciBank };

        const balanceSheet = parser.transformBalanceSheet(mergedData);
        const incomeStatement = parser.transformIncomeStatement(riBank);

        console.log(`\n   Bank ${count + 1}: ${bank['Financial Institution Name']}`);
        console.log(`   IDRSSD: ${idrssd}`);
        console.log(`   Net Income: ${incomeStatement.netIncome}`);
        console.log(`   Interest Income (Loans): ${incomeStatement.interestIncome.loans}`);
        console.log(`   Total Assets: ${balanceSheet.assets.totalAssets}`);

        const reportingPeriod = new Date('2025-03-31');
        const ratios = parser.calculateRatios(balanceSheet, incomeStatement, reportingPeriod);

        const bsValidation = parser.validateBalanceSheet(balanceSheet);
        const isValidation = parser.validateIncomeStatement(incomeStatement);

        const errors = [];
        if (!bsValidation.isValid) {
          errors.push(`Balance sheet doesn't balance`);
        }
        if (!isValidation.isValid) {
          errors.push(`Income statement NII mismatch`);
        }

        await FinancialStatement.findOneAndUpdate(
          { idrssd, reportingPeriod },
          {
            idrssd,
            reportingPeriod,
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

        count++;
      }
    }

    console.log(`\n✅ Test Import Complete! Imported ${count} banks`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
  }
}

testImportQ1()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });
