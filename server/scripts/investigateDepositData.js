const mongoose = require('mongoose');
require('dotenv').config();

const Institution = require('../models/Institution');
const FinancialStatement = require('../models/FinancialStatement');

async function investigateDepositData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bank_explorer');
    console.log('Connected to MongoDB\n');

    // Find top 5 largest banks by looking at their latest financial statements
    console.log('=== TOP 5 LARGEST BANKS (by latest quarter assets) ===');

    const latestStatements = await FinancialStatement.aggregate([
      {
        $sort: { reportingPeriod: -1 }
      },
      {
        $group: {
          _id: '$idrssd',
          latestPeriod: { $first: '$reportingPeriod' },
          totalAssets: { $first: '$balanceSheet.assets.totalAssets' },
          dataSource: { $first: '$balanceSheet.dataSource' }
        }
      },
      {
        $sort: { totalAssets: -1 }
      },
      {
        $limit: 10
      }
    ]);

    const largestBankIds = latestStatements.map(s => s._id);
    const bankInfos = await Institution.find({ idrssd: { $in: largestBankIds } })
      .select('idrssd name city state');

    const bankMap = new Map(bankInfos.map(b => [b.idrssd, b]));

    const largeBanks = latestStatements.slice(0, 5).map(s => ({
      idrssd: s._id,
      name: bankMap.get(s._id)?.name || 'Unknown',
      city: bankMap.get(s._id)?.city || '',
      state: bankMap.get(s._id)?.state || '',
      totalAssets: s.totalAssets,
      dataSource: s.dataSource
    }));

    for (const bank of largeBanks) {
      console.log(`${bank.idrssd} | ${bank.name} | ${bank.city}, ${bank.state} | Assets: $${(bank.totalAssets / 1000000).toFixed(1)}B | Source: ${bank.dataSource}`);
    }

    // Investigate deposit data for the largest bank
    const largestBank = largeBanks[0];
    console.log(`\n=== INVESTIGATING DEPOSIT DATA FOR ${largestBank.name} (${largestBank.idrssd}) ===`);

    const statements = await FinancialStatement.find({ idrssd: largestBank.idrssd })
      .sort({ reportingPeriod: 1 })
      .limit(20)
      .select('reportingPeriod balanceSheet.liabilities.deposits balanceSheet.assets.totalAssets balanceSheet.dataSource');

    console.log(`\nFound ${statements.length} financial statements\n`);
    console.log('Date       | Data Source | Total Deposits | Total Assets | Non-Int Deposits | Int Deposits');
    console.log('-'.repeat(100));

    for (const stmt of statements) {
      const date = stmt.reportingPeriod.toISOString().split('T')[0];
      const dataSource = stmt.balanceSheet?.dataSource || 'UNKNOWN';
      const deposits = stmt.balanceSheet?.liabilities?.deposits;
      const totalDeposits = deposits?.total || 'NULL';
      const nonIntDeposits = deposits?.nonInterestBearing || 'NULL';
      const intDeposits = deposits?.interestBearing || 'NULL';
      const assets = stmt.balanceSheet?.assets?.totalAssets || 'NULL';

      const depositsStr = typeof totalDeposits === 'number' ? `$${(totalDeposits / 1000).toFixed(0)}M` : 'NULL';
      const assetsStr = typeof assets === 'number' ? `$${(assets / 1000).toFixed(0)}M` : 'NULL';
      const nonIntStr = typeof nonIntDeposits === 'number' ? `$${(nonIntDeposits / 1000).toFixed(0)}M` : 'NULL';
      const intStr = typeof intDeposits === 'number' ? `$${(intDeposits / 1000).toFixed(0)}M` : 'NULL';

      console.log(`${date} | ${dataSource.padEnd(11)} | ${depositsStr.padEnd(14)} | ${assetsStr.padEnd(12)} | ${nonIntStr.padEnd(16)} | ${intStr}`);
    }

    // Check a few more large banks
    console.log('\n\n=== CHECKING DEPOSIT DATA AVAILABILITY FOR OTHER LARGE BANKS ===\n');

    for (let i = 1; i < 5; i++) {
      const bank = largeBanks[i];
      const stmts = await FinancialStatement.find({ idrssd: bank.idrssd })
        .sort({ reportingPeriod: -1 })
        .limit(5)
        .select('reportingPeriod balanceSheet.liabilities.deposits.total balanceSheet.dataSource');

      const nullCount = stmts.filter(s => !s.balanceSheet?.liabilities?.deposits?.total).length;
      const dataSourcesUsed = [...new Set(stmts.map(s => s.balanceSheet?.dataSource))].join(', ');

      console.log(`${bank.name} (${bank.idrssd}):`);
      console.log(`  - Latest 5 quarters: ${stmts.length - nullCount} have deposits, ${nullCount} NULL`);
      console.log(`  - Data sources: ${dataSourcesUsed}`);
    }

    mongoose.connection.close();

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

investigateDepositData();
