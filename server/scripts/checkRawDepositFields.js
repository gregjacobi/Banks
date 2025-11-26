const mongoose = require('mongoose');
require('dotenv').config();

const FinancialStatement = require('../models/FinancialStatement');

async function checkRawData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bank_explorer');
    console.log('Connected to MongoDB\n');

    // Check JPMorgan Chase (852218)
    console.log('=== JPMORGAN CHASE - RAW DEPOSIT FIELD CODES ===\n');

    const statements = await FinancialStatement.find({ idrssd: '852218' })
      .sort({ reportingPeriod: 1 })
      .limit(10)
      .lean();

    console.log('Checking if raw Call Report data is stored...\n');

    if (statements.length > 0 && statements[0].rawData) {
      console.log('✓ Raw data IS stored in database\n');

      for (const stmt of statements) {
        const date = stmt.reportingPeriod.toISOString().split('T')[0];
        const raw = stmt.rawData || {};

        console.log(`\n${date}:`);
        console.log(`  RCFD2200 (consolidated total deposits): ${raw.RCFD2200 || 'NULL'}`);
        console.log(`  RCON2200 (domestic total deposits): ${raw.RCON2200 || 'NULL'}`);
        console.log(`  RCFD6631 (consol non-interest deposits): ${raw.RCFD6631 || 'NULL'}`);
        console.log(`  RCON6631 (dom non-interest deposits): ${raw.RCON6631 || 'NULL'}`);
        console.log(`  RCFD6636 (consol interest deposits): ${raw.RCFD6636 || 'NULL'}`);
        console.log(`  RCON6636 (dom interest deposits): ${raw.RCON6636 || 'NULL'}`);
        console.log(`  RCFD2170 (consolidated total assets): ${raw.RCFD2170 || 'NULL'}`);
        console.log(`  RCON2170 (domestic total assets): ${raw.RCON2170 || 'NULL'}`);
      }
    } else {
      console.log('✗ Raw data is NOT stored in database');
      console.log('   Cannot check field codes without raw data\n');

      console.log('Parsed balance sheet data:');
      for (const stmt of statements.slice(0, 3)) {
        const date = stmt.reportingPeriod.toISOString().split('T')[0];
        const deposits = stmt.balanceSheet?.liabilities?.deposits;
        const assets = stmt.balanceSheet?.assets?.totalAssets;
        const dataSource = stmt.balanceSheet?.dataSource;

        console.log(`\n${date} (${dataSource}):`);
        console.log(`  Total Deposits: ${deposits?.total || 'NULL'}`);
        console.log(`  Non-Interest Deposits: ${deposits?.nonInterestBearing || 'NULL'}`);
        console.log(`  Interest Deposits: ${deposits?.interestBearing || 'NULL'}`);
        console.log(`  Total Assets: ${assets || 'NULL'}`);
      }
    }

    mongoose.connection.close();

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkRawData();
