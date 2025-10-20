const mongoose = require('mongoose');
const FinancialStatement = require('../server/models/FinancialStatement');

/**
 * Calculate derived metrics that require multiple periods:
 * 1. Convert YTD income statement to quarterly
 * 2. Recalculate ROE, ROA, NIM using annualized quarterly data
 * 3. Calculate Operating Leverage (YoY revenue vs expense growth)
 */
async function calculateDerivedMetrics() {
  try {
    await mongoose.connect('mongodb://localhost:27017/bankexplorer');
    console.log('✓ Connected to MongoDB');

    // Get all unique banks
    const banks = await FinancialStatement.distinct('idrssd');
    console.log(`\nProcessing ${banks.length} banks...`);

    let processedCount = 0;
    let updatedCount = 0;

    for (const idrssd of banks) {
      // Get all statements for this bank, sorted by date
      const statements = await FinancialStatement.find({ idrssd })
        .sort({ reportingPeriod: 1 });

      if (statements.length < 2) continue;

      for (let i = 0; i < statements.length; i++) {
        const current = statements[i];
        const currentDate = new Date(current.reportingPeriod);
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        // Find previous quarter (for YTD to quarterly conversion)
        // Need to find the LAST quarter within the same calendar year
        const prevQuarter = statements
          .filter(s => {
            const d = new Date(s.reportingPeriod);
            return d.getFullYear() === currentYear && d < currentDate;
          })
          .sort((a, b) => new Date(b.reportingPeriod) - new Date(a.reportingPeriod))[0];

        // Find year-ago quarter (for operating leverage)
        const yearAgo = statements.find(s => {
          const d = new Date(s.reportingPeriod);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear - 1;
        });

        // Calculate quarterly income statement (YTD to quarterly conversion)
        let quarterlyNetIncome = current.incomeStatement.netIncome;
        let quarterlyNII = current.incomeStatement.netInterestIncome;
        let quarterlyNonintIncome = current.incomeStatement.noninterestIncome.total;
        let quarterlyNonintExpense = current.incomeStatement.noninterestExpense.total;

        // If not Q1, subtract previous quarter's YTD to get quarterly
        if (prevQuarter && currentMonth !== 2) { // Not March (Q1)
          quarterlyNetIncome -= prevQuarter.incomeStatement.netIncome;
          quarterlyNII -= prevQuarter.incomeStatement.netInterestIncome;
          quarterlyNonintIncome -= prevQuarter.incomeStatement.noninterestIncome.total;
          quarterlyNonintExpense -= prevQuarter.incomeStatement.noninterestExpense.total;
        }

        // Annualize the quarterly data (multiply by 4)
        const annualizedNetIncome = quarterlyNetIncome * 4;
        const annualizedNII = quarterlyNII * 4;

        // Recalculate ratios using annualized quarterly data
        const ratios = { ...current.ratios };

        // ROE = (Annualized Net Income / Total Equity) × 100
        if (current.balanceSheet.equity.totalEquity > 0) {
          ratios.roe = (annualizedNetIncome / current.balanceSheet.equity.totalEquity) * 100;
        }

        // ROA = (Annualized Net Income / Total Assets) × 100
        if (current.balanceSheet.assets.totalAssets > 0) {
          ratios.roa = (annualizedNetIncome / current.balanceSheet.assets.totalAssets) * 100;
        }

        // NIM = (Annualized NII / Earning Assets) × 100
        const earningAssets =
          current.balanceSheet.assets.earningAssets.loansAndLeases.net +
          current.balanceSheet.assets.earningAssets.securities.availableForSale +
          current.balanceSheet.assets.earningAssets.securities.heldToMaturity +
          current.balanceSheet.assets.earningAssets.interestBearingBankBalances +
          current.balanceSheet.assets.earningAssets.fedFundsSoldAndRepos;

        if (earningAssets > 0) {
          ratios.netInterestMargin = (annualizedNII / earningAssets) * 100;
        }

        // Efficiency Ratio (already calculated correctly from YTD data)
        // It uses YTD revenue and YTD expenses which is fine

        // Operating Leverage (YoY comparison)
        if (yearAgo) {
          // Get quarterly data for year-ago
          const yearAgoMonth = new Date(yearAgo.reportingPeriod).getMonth();
          const yearAgoPrevQuarter = statements.find(s => {
            const d = new Date(s.reportingPeriod);
            return d.getFullYear() === currentYear - 1 && d < yearAgo.reportingPeriod;
          });

          let yearAgoQuarterlyRevenue = yearAgo.incomeStatement.netInterestIncome + yearAgo.incomeStatement.noninterestIncome.total;
          let yearAgoQuarterlyExpense = yearAgo.incomeStatement.noninterestExpense.total;

          if (yearAgoPrevQuarter && yearAgoMonth !== 2) {
            yearAgoQuarterlyRevenue -= (yearAgoPrevQuarter.incomeStatement.netInterestIncome + yearAgoPrevQuarter.incomeStatement.noninterestIncome.total);
            yearAgoQuarterlyExpense -= yearAgoPrevQuarter.incomeStatement.noninterestExpense.total;
          }

          const currentQuarterlyRevenue = quarterlyNII + quarterlyNonintIncome;
          const currentQuarterlyExpense = quarterlyNonintExpense;

          // Calculate YoY growth rates
          if (yearAgoQuarterlyRevenue > 0 && yearAgoQuarterlyExpense > 0) {
            const revenueGrowth = ((currentQuarterlyRevenue - yearAgoQuarterlyRevenue) / yearAgoQuarterlyRevenue) * 100;
            const expenseGrowth = ((currentQuarterlyExpense - yearAgoQuarterlyExpense) / yearAgoQuarterlyExpense) * 100;

            // Operating Leverage = Revenue Growth % / Expense Growth %
            // Positive leverage (>1) means revenue growing faster than expenses
            if (expenseGrowth !== 0) {
              ratios.operatingLeverage = revenueGrowth / expenseGrowth;
            }
          }
        }

        // Update the statement with corrected ratios
        await FinancialStatement.updateOne(
          { _id: current._id },
          { $set: { ratios } }
        );

        updatedCount++;
      }

      processedCount++;
      if (processedCount % 500 === 0) {
        console.log(`  Processed ${processedCount} banks, updated ${updatedCount} statements...`);
      }
    }

    console.log(`\n✅ Derived Metrics Calculation Complete!`);
    console.log(`   Banks Processed: ${processedCount}`);
    console.log(`   Statements Updated: ${updatedCount}`);

  } catch (error) {
    console.error('❌ Error calculating derived metrics:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
  }
}

// Run calculation
if (require.main === module) {
  calculateDerivedMetrics()
    .then(() => {
      console.log('\n🎉 Calculation successful!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Calculation failed:', error);
      process.exit(1);
    });
}

module.exports = calculateDerivedMetrics;
