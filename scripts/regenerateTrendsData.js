/**
 * Script to regenerate trendsData for existing research reports
 * This updates only the trendsData field without regenerating the full report
 *
 * Usage:
 *   node scripts/regenerateTrendsData.js [idrssd]              # Development
 *   node scripts/regenerateTrendsData.js --production [idrssd] # Production
 *
 * If idrssd is provided, only updates reports for that bank
 * If not provided, updates all reports
 */

const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');

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

const FinancialStatement = require('../server/models/FinancialStatement');

// Determine research directory - could be server/data/research or just data/research
const possibleDirs = [
  path.join(__dirname, '../server/data/research'),
  path.join(__dirname, '../data/research')
];

let RESEARCH_DIR;
async function findResearchDir() {
  for (const dir of possibleDirs) {
    try {
      await fs.access(dir);
      return dir;
    } catch (e) {
      // Directory doesn't exist, try next
    }
  }
  // Default to first option if none exist
  return possibleDirs[0];
}

/**
 * Prepare trends data from financial statements
 * (Copied from server/routes/research.js)
 */
function prepareTrendsData(financialStatements) {
  const periods = financialStatements.map(stmt => {
    const date = new Date(stmt.reportingPeriod);
    const year = date.getFullYear();
    const quarter = Math.ceil((date.getMonth() + 1) / 3);

    // Calculate consumer and business lending
    const portfolio = stmt.balanceSheet.assets.earningAssets.loansAndLeases.portfolio;
    const consumerLending =
      (portfolio.realEstate.securedBy1To4Family.revolvingOpenEnd || 0) +
      (portfolio.realEstate.securedBy1To4Family.closedEndFirstLiens || 0) +
      (portfolio.realEstate.securedBy1To4Family.closedEndJuniorLiens || 0) +
      (portfolio.consumer.creditCards || 0) +
      (portfolio.consumer.automobileLoans || 0) +
      (portfolio.consumer.otherRevolvingCredit || 0) +
      (portfolio.consumer.otherConsumerLoans || 0) +
      (portfolio.leaseFinancingReceivables.consumerLeases || 0);

    const businessLending =
      (portfolio.realEstate.constructionAndLandDevelopment.total || 0) +
      (portfolio.realEstate.multifamily || 0) +
      (portfolio.realEstate.nonfarmNonresidential.ownerOccupied || 0) +
      (portfolio.realEstate.nonfarmNonresidential.otherNonfarmNonresidential || 0) +
      (portfolio.realEstate.farmland || 0) +
      (portfolio.commercialAndIndustrial.usAddressees || 0) +
      (portfolio.commercialAndIndustrial.nonUsAddressees || 0) +
      (portfolio.other.agriculturalProduction || 0) +
      (portfolio.other.toDepositoryInstitutions || 0) +
      (portfolio.leaseFinancingReceivables.allOtherLeases || 0) +
      (portfolio.other.allOtherLoans || 0);

    return {
      period: `${year} Q${quarter}`,
      date: stmt.reportingPeriod,
      assets: {
        total: stmt.balanceSheet.assets.totalAssets,
        consumerLending,
        businessLending,
        securities:
          stmt.balanceSheet.assets.earningAssets.securities.availableForSale +
          stmt.balanceSheet.assets.earningAssets.securities.heldToMaturity,
        cash: stmt.balanceSheet.assets.nonearningAssets.cashAndDueFromBanks,
        other:
          stmt.balanceSheet.assets.nonearningAssets.premisesAndFixedAssets +
          stmt.balanceSheet.assets.nonearningAssets.intangibleAssets +
          stmt.balanceSheet.assets.nonearningAssets.otherAssets
      },
      income: {
        netIncome: stmt.incomeStatement.netIncome,
        netInterestIncome: stmt.incomeStatement.netInterestIncome,
        noninterestIncome: stmt.incomeStatement.noninterestIncome.total,
        noninterestExpense: stmt.incomeStatement.noninterestExpense.total
      },
      expenses: {
        salariesAndBenefits: stmt.incomeStatement.noninterestExpense.salariesAndBenefits,
        occupancy: stmt.incomeStatement.noninterestExpense.premisesExpense,
        other: stmt.incomeStatement.noninterestExpense.other
      },
      fte: stmt.incomeStatement.fullTimeEquivalentEmployees,
      ratios: {
        efficiencyRatio: stmt.ratios?.efficiencyRatio,
        roe: stmt.ratios?.roe,
        roa: stmt.ratios?.roa,
        nim: stmt.ratios?.netInterestMargin,
        operatingLeverage: stmt.ratios?.operatingLeverage
      }
    };
  });

  // Prepare lending composition for latest period
  const latestStmt = financialStatements[financialStatements.length - 1];
  const latestPortfolio = latestStmt.balanceSheet.assets.earningAssets.loansAndLeases.portfolio;

  const lendingComposition = [{
    period: periods[periods.length - 1].period,
    categories: [
      {
        name: 'Consumer Lending',
        current: periods[periods.length - 1].assets.consumerLending,
        percentage: (periods[periods.length - 1].assets.consumerLending /
                     periods[periods.length - 1].assets.total * 100).toFixed(1),
        growth: periods.length > 4 ?
          ((periods[periods.length - 1].assets.consumerLending - periods[0].assets.consumerLending) /
           periods[0].assets.consumerLending * 100) : 0,
        subcategories: [
          {
            name: 'Residential Mortgages',
            value: (latestPortfolio.realEstate.securedBy1To4Family.revolvingOpenEnd || 0) +
                   (latestPortfolio.realEstate.securedBy1To4Family.closedEndFirstLiens || 0) +
                   (latestPortfolio.realEstate.securedBy1To4Family.closedEndJuniorLiens || 0)
          },
          {
            name: 'Credit Cards',
            value: latestPortfolio.consumer.creditCards || 0
          },
          {
            name: 'Auto Loans',
            value: latestPortfolio.consumer.automobileLoans || 0
          },
          {
            name: 'Other Consumer',
            value: (latestPortfolio.consumer.otherRevolvingCredit || 0) +
                   (latestPortfolio.consumer.otherConsumerLoans || 0) +
                   (latestPortfolio.leaseFinancingReceivables.consumerLeases || 0)
          }
        ]
      },
      {
        name: 'Business Lending',
        current: periods[periods.length - 1].assets.businessLending,
        percentage: (periods[periods.length - 1].assets.businessLending /
                     periods[periods.length - 1].assets.total * 100).toFixed(1),
        growth: periods.length > 4 ?
          ((periods[periods.length - 1].assets.businessLending - periods[0].assets.businessLending) /
           periods[0].assets.businessLending * 100) : 0,
        subcategories: [
          {
            name: 'Commercial Real Estate',
            value: (latestPortfolio.realEstate.constructionAndLandDevelopment.total || 0) +
                   (latestPortfolio.realEstate.multifamily || 0) +
                   (latestPortfolio.realEstate.nonfarmNonresidential.ownerOccupied || 0) +
                   (latestPortfolio.realEstate.nonfarmNonresidential.otherNonfarmNonresidential || 0) +
                   (latestPortfolio.realEstate.farmland || 0)
          },
          {
            name: 'C&I (US)',
            value: latestPortfolio.commercialAndIndustrial.usAddressees || 0
          },
          {
            name: 'C&I (Non-US)',
            value: latestPortfolio.commercialAndIndustrial.nonUsAddressees || 0
          },
          {
            name: 'Other Business',
            value: (latestPortfolio.other.agriculturalProduction || 0) +
                   (latestPortfolio.other.toDepositoryInstitutions || 0) +
                   (latestPortfolio.leaseFinancingReceivables.allOtherLeases || 0) +
                   (latestPortfolio.other.allOtherLoans || 0)
          }
        ]
      }
    ]
  }];

  return {
    periods,
    lendingComposition
  };
}

async function regenerateTrendsDataForBank(idrssd) {
  try {
    console.log(`\nProcessing reports for bank ${idrssd}...`);

    // Find all reports for this bank
    const files = await fs.readdir(RESEARCH_DIR);
    const bankReports = files.filter(f => f.startsWith(`${idrssd}_`) && f.endsWith('.json'));

    if (bankReports.length === 0) {
      console.log(`  No reports found for bank ${idrssd}`);
      return 0;
    }

    console.log(`  Found ${bankReports.length} report(s)`);

    // Fetch financial statements for this bank
    const financialStatements = await FinancialStatement.find({ idrssd })
      .sort({ reportingPeriod: 1 })
      .limit(20);

    if (financialStatements.length === 0) {
      console.log(`  WARNING: No financial statements found for bank ${idrssd}, skipping`);
      return 0;
    }

    // Generate new trendsData
    const newTrendsData = prepareTrendsData(financialStatements);

    // Update each report
    let updatedCount = 0;
    for (const filename of bankReports) {
      const filePath = path.join(RESEARCH_DIR, filename);
      
      try {
        const reportData = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        
        // Update trendsData
        reportData.trendsData = newTrendsData;
        
        // Save updated report
        await fs.writeFile(filePath, JSON.stringify(reportData, null, 2));
        
        console.log(`  ✓ Updated ${filename}`);
        updatedCount++;
      } catch (error) {
        console.error(`  ✗ Error updating ${filename}:`, error.message);
      }
    }

    return updatedCount;
  } catch (error) {
    console.error(`Error processing bank ${idrssd}:`, error);
    return 0;
  }
}

async function main() {
  try {
    // Find research directory
    RESEARCH_DIR = await findResearchDir();
    console.log(`Using research directory: ${RESEARCH_DIR}`);

    // Ensure research directory exists
    try {
      await fs.mkdir(RESEARCH_DIR, { recursive: true });
    } catch (error) {
      // Directory might already exist, that's fine
    }

    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bankexplorer');
    console.log('Connected to MongoDB');

    const idrssd = process.argv[2];

    if (idrssd) {
      // Update reports for specific bank
      console.log(`Regenerating trendsData for bank ${idrssd}...`);
      const count = await regenerateTrendsDataForBank(idrssd);
      console.log(`\n✓ Updated ${count} report(s) for bank ${idrssd}`);
    } else {
      // Update all reports
      console.log('Regenerating trendsData for all banks...');
      
      const files = await fs.readdir(RESEARCH_DIR);
      const reportFiles = files.filter(f => f.endsWith('.json'));
      
      // Extract unique idrssd values from filenames
      const idrssdSet = new Set();
      reportFiles.forEach(file => {
        // Filenames: idrssd_timestamp.json or idrssd_agent_timestamp.json
        const match = file.match(/^(\d+)_/);
        if (match) {
          idrssdSet.add(match[1]);
        }
      });

      const uniqueIdrssds = Array.from(idrssdSet);
      console.log(`Found reports for ${uniqueIdrssds.length} bank(s)\n`);

      let totalUpdated = 0;
      for (const bankIdrssd of uniqueIdrssds) {
        const count = await regenerateTrendsDataForBank(bankIdrssd);
        totalUpdated += count;
      }

      console.log(`\n✓ Updated ${totalUpdated} report(s) across ${uniqueIdrssds.length} bank(s)`);
    }

    await mongoose.disconnect();
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

