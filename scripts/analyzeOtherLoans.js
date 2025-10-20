const mongoose = require('mongoose');
const Institution = require('../server/models/Institution');
const FinancialStatement = require('../server/models/FinancialStatement');

async function analyzeBanks() {
  try {
    await mongoose.connect('mongodb://localhost:27017/bankexplorer');
    
    const statements = await FinancialStatement.find({})
      .sort({ 'balanceSheet.assets.totalAssets': -1 })
      .limit(50);
    
    console.log('Top 50 Banks by Assets - Other Loans Analysis\n');
    console.log('Bank Name'.padEnd(40) + 'Total Loans'.padEnd(15) + 'Other Specialized'.padEnd(20) + '% of Total');
    console.log('='.repeat(100));
    
    for (const stmt of statements) {
      const institution = await Institution.findOne({ idrssd: stmt.idrssd });
      if (!institution) continue;
      
      const portfolio = stmt.balanceSheet.assets.earningAssets.loansAndLeases.portfolio;
      const totalLoans = stmt.balanceSheet.assets.earningAssets.loansAndLeases.net;
      const otherLoans = portfolio.other.allOtherLoans || 0;
      
      if (otherLoans > 0) {
        const pct = ((otherLoans / totalLoans) * 100).toFixed(1);
        const totalLoansB = (totalLoans / 1000000).toFixed(1);
        const otherLoansB = (otherLoans / 1000000).toFixed(1);
        
        console.log(
          institution.name.substring(0, 39).padEnd(40) + 
          ('$' + totalLoansB + 'B').padEnd(15) + 
          ('$' + otherLoansB + 'B').padEnd(20) + 
          pct + '%'
        );
      }
    }
    
    mongoose.connection.close();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

analyzeBanks();
