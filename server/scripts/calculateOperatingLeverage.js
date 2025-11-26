require('dotenv').config();
const mongoose = require('mongoose');
const FinancialStatement = require('../models/FinancialStatement');

/**
 * Calculate operating leverage (quarter-over-quarter) for all banks
 *
 * Operating Leverage = (Revenue Growth % QoQ) / (Expense Growth % QoQ)
 *
 * Revenue = Net Interest Income + Noninterest Income
 * Expenses = Noninterest Expense
 *
 * This metric shows operational scalability:
 * - > 1.0: Revenue growing faster than expenses (positive leverage)
 * - < 1.0: Expenses growing faster than revenue (negative leverage)
 */

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bankexplorer';

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

async function calculateOperatingLeverage() {
  try {
    await connectDB();

    // Get all unique bank IDs
    const banks = await FinancialStatement.distinct('idrssd');
    console.log(`Found ${banks.length} banks`);

    let totalProcessed = 0;
    let totalUpdated = 0;

    for (const idrssd of banks) {
      // Get all statements for this bank, sorted chronologically (oldest first)
      const statements = await FinancialStatement.find({ idrssd })
        .sort({ reportingPeriod: 1 })
        .lean();

      if (statements.length < 2) {
        console.log(`Skipping bank ${idrssd} - only ${statements.length} statement(s)`);
        continue;
      }

      console.log(`Processing bank ${idrssd} - ${statements.length} statements`);

      // Calculate operating leverage for each quarter (starting from Q2)
      for (let i = 1; i < statements.length; i++) {
        const currentStmt = statements[i];
        const previousStmt = statements[i - 1];

        // Calculate revenue (Net Interest Income + Noninterest Income)
        const currentRevenue =
          currentStmt.incomeStatement.netInterestIncome +
          currentStmt.incomeStatement.noninterestIncome.total;

        const previousRevenue =
          previousStmt.incomeStatement.netInterestIncome +
          previousStmt.incomeStatement.noninterestIncome.total;

        // Calculate expenses (Noninterest Expense)
        const currentExpense = currentStmt.incomeStatement.noninterestExpense.total;
        const previousExpense = previousStmt.incomeStatement.noninterestExpense.total;

        // Calculate growth rates
        let operatingLeverage = null;

        if (previousRevenue > 0 && previousExpense > 0) {
          const revenueGrowth = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
          const expenseGrowth = ((currentExpense - previousExpense) / previousExpense) * 100;

          // Calculate operating leverage
          // If expense growth is near zero, handle specially
          if (Math.abs(expenseGrowth) < 0.01) {
            // If expenses flat but revenue growing, leverage is very high
            if (revenueGrowth > 0.01) {
              operatingLeverage = 999; // Cap at 999 for display
            } else if (revenueGrowth < -0.01) {
              operatingLeverage = -999;
            } else {
              operatingLeverage = 0; // Both flat
            }
          } else {
            operatingLeverage = revenueGrowth / expenseGrowth;
            // Cap extreme values for display
            if (operatingLeverage > 999) operatingLeverage = 999;
            if (operatingLeverage < -999) operatingLeverage = -999;
          }
        }

        // Update the statement with calculated operating leverage
        if (operatingLeverage !== null) {
          await FinancialStatement.updateOne(
            { _id: currentStmt._id },
            {
              $set: {
                'ratios.operatingLeverage': operatingLeverage
              }
            }
          );
          totalUpdated++;
        }

        totalProcessed++;
      }
    }

    console.log(`\n✓ Complete!`);
    console.log(`  Processed: ${totalProcessed} statements`);
    console.log(`  Updated: ${totalUpdated} with operating leverage`);

  } catch (error) {
    console.error('Error calculating operating leverage:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  }
}

// Run the calculation
calculateOperatingLeverage();
