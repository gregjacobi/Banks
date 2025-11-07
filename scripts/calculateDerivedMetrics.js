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

        // Find previous period (for average calculations)
        const prevPeriod = i > 0 ? statements[i - 1] : null;

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

        // Calculate average assets and equity using previous period
        let avgTotalAssets = current.balanceSheet.assets.totalAssets;
        let avgTotalEquity = current.balanceSheet.equity.totalEquity;

        if (prevPeriod) {
          // Average Total Assets = (Beginning Period + Ending Period) / 2
          avgTotalAssets = (prevPeriod.balanceSheet.assets.totalAssets + current.balanceSheet.assets.totalAssets) / 2;
          // Average Total Equity = (Beginning Period + Ending Period) / 2
          avgTotalEquity = (prevPeriod.balanceSheet.equity.totalEquity + current.balanceSheet.equity.totalEquity) / 2;
        }

        // ROE = (Annualized Net Income / Average Total Equity) × 100
        if (avgTotalEquity > 0) {
          ratios.roe = (annualizedNetIncome / avgTotalEquity) * 100;
        }

        // ROA = (Annualized Net Income / Average Total Assets) × 100
        if (avgTotalAssets > 0) {
          ratios.roa = (annualizedNetIncome / avgTotalAssets) * 100;
        }

        // NIM = (Annualized NII / Average Earning Assets) × 100
        // Calculate current period earning assets (including equity securities)
        const currentEarningAssets =
          current.balanceSheet.assets.earningAssets.loansAndLeases.net +
          current.balanceSheet.assets.earningAssets.securities.availableForSale +
          current.balanceSheet.assets.earningAssets.securities.heldToMaturity +
          current.balanceSheet.assets.earningAssets.securities.equity +
          current.balanceSheet.assets.earningAssets.interestBearingBankBalances +
          current.balanceSheet.assets.earningAssets.fedFundsSoldAndRepos;

        // Calculate average earning assets if previous period is available
        let avgEarningAssets = currentEarningAssets;

        if (prevPeriod) {
          const prevEarningAssets =
            prevPeriod.balanceSheet.assets.earningAssets.loansAndLeases.net +
            prevPeriod.balanceSheet.assets.earningAssets.securities.availableForSale +
            prevPeriod.balanceSheet.assets.earningAssets.securities.heldToMaturity +
            prevPeriod.balanceSheet.assets.earningAssets.securities.equity +
            prevPeriod.balanceSheet.assets.earningAssets.interestBearingBankBalances +
            prevPeriod.balanceSheet.assets.earningAssets.fedFundsSoldAndRepos;

          // Average earning assets = (Beginning + Ending) / 2
          avgEarningAssets = (prevEarningAssets + currentEarningAssets) / 2;
        }

        if (avgEarningAssets > 0) {
          ratios.netInterestMargin = (annualizedNII / avgEarningAssets) * 100;
        }

        // Efficiency Ratio (already calculated correctly from YTD data)
        // It uses YTD revenue and YTD expenses which is fine

        // Operating Leverage (YoY comparison using PPNR-based formula)
        // Operating Leverage = (YoY % Change in PPNR) / (YoY % Change in Total Revenue)
        // Where:
        //   - Total Revenue = Total Interest Income + Total Non-Interest Income
        //   - PPNR (Pre-Provision Net Revenue) = Total Revenue - Total Operating Expenses
        // Only calculate if we have a year-ago quarter to compare against
        if (yearAgo) {
          // Get quarterly data for current period
          // Total Revenue = Interest Income + Noninterest Income (using raw totals, not net)
          let currentQuarterlyInterestIncome = current.incomeStatement.interestIncome.total;
          let currentQuarterlyNoninterestIncome = current.incomeStatement.noninterestIncome.total;
          let currentQuarterlyOperatingExpense = current.incomeStatement.noninterestExpense.total;

          // Get quarterly data for year-ago period
          const yearAgoMonth = new Date(yearAgo.reportingPeriod).getMonth();
          const yearAgoPrevQuarter = statements.find(s => {
            const d = new Date(s.reportingPeriod);
            return d.getFullYear() === currentYear - 1 && d < yearAgo.reportingPeriod;
          });

          let yearAgoQuarterlyInterestIncome = yearAgo.incomeStatement.interestIncome.total;
          let yearAgoQuarterlyNoninterestIncome = yearAgo.incomeStatement.noninterestIncome.total;
          let yearAgoQuarterlyOperatingExpense = yearAgo.incomeStatement.noninterestExpense.total;

          // If not Q1, subtract previous quarter's YTD to get quarterly amounts
          if (currentMonth !== 2 && prevQuarter) { // Current period, not March (Q1)
            currentQuarterlyInterestIncome -= prevQuarter.incomeStatement.interestIncome.total;
            currentQuarterlyNoninterestIncome -= prevQuarter.incomeStatement.noninterestIncome.total;
            currentQuarterlyOperatingExpense -= prevQuarter.incomeStatement.noninterestExpense.total;
          }

          if (yearAgoPrevQuarter && yearAgoMonth !== 2) { // Year-ago period, not March (Q1)
            yearAgoQuarterlyInterestIncome -= yearAgoPrevQuarter.incomeStatement.interestIncome.total;
            yearAgoQuarterlyNoninterestIncome -= yearAgoPrevQuarter.incomeStatement.noninterestIncome.total;
            yearAgoQuarterlyOperatingExpense -= yearAgoPrevQuarter.incomeStatement.noninterestExpense.total;
          }

          // Calculate Total Revenue for both periods
          const currentQuarterlyRevenue = currentQuarterlyInterestIncome + currentQuarterlyNoninterestIncome;
          const yearAgoQuarterlyRevenue = yearAgoQuarterlyInterestIncome + yearAgoQuarterlyNoninterestIncome;

          // Calculate PPNR for both periods
          const currentQuarterlyPPNR = currentQuarterlyRevenue - currentQuarterlyOperatingExpense;
          const yearAgoQuarterlyPPNR = yearAgoQuarterlyRevenue - yearAgoQuarterlyOperatingExpense;

          // Calculate YoY growth rates for Operating Leverage
          // Operating Leverage = (YoY % Change in PPNR) / (YoY % Change in Total Revenue)
          if (yearAgoQuarterlyRevenue !== 0 && yearAgoQuarterlyPPNR !== 0 && 
              currentQuarterlyRevenue !== 0 && currentQuarterlyPPNR !== 0) {
            const revenueGrowthPercent = ((currentQuarterlyRevenue - yearAgoQuarterlyRevenue) / Math.abs(yearAgoQuarterlyRevenue)) * 100;
            const ppnrGrowthPercent = ((currentQuarterlyPPNR - yearAgoQuarterlyPPNR) / Math.abs(yearAgoQuarterlyPPNR)) * 100;

            // Operating Leverage = % Change in PPNR / % Change in Revenue
            // Higher values (>1) indicate revenue changes have magnified impact on operating income
            if (Math.abs(revenueGrowthPercent) > 0.0001) { // Avoid division by zero
              ratios.operatingLeverage = ppnrGrowthPercent / revenueGrowthPercent;
              // Cap extreme values for display
              if (ratios.operatingLeverage > 999) ratios.operatingLeverage = 999;
              if (ratios.operatingLeverage < -999) ratios.operatingLeverage = -999;
            } else {
              // If revenue growth is near zero, set to null
              ratios.operatingLeverage = null;
            }
          } else {
            // Invalid data (zero values), set to null
            ratios.operatingLeverage = null;
          }
        } else {
          // No year-ago quarter available, explicitly set to null
          ratios.operatingLeverage = null;
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
