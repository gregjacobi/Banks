const mongoose = require('mongoose');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'Connection error:'));
db.once('open', async function() {
  console.log('Connected to MongoDB');

  try {
    // Get both collections
    const FinancialStatement = mongoose.model('FinancialStatement', new mongoose.Schema({}, { strict: false, collection: 'financialstatements' }));
    const Institution = mongoose.model('Institution', new mongoose.Schema({}, { strict: false, collection: 'institutions' }));

    // Get all banks with their most recent statement
    const pipeline = [
      // Sort by reporting period (newest first)
      { $sort: { reportingPeriod: -1 } },

      // Group by idrssd and get the most recent statement
      {
        $group: {
          _id: '$idrssd',
          latestPeriod: { $first: '$reportingPeriod' },
          totalEmployees: { $first: '$incomeStatement.fullTimeEquivalentEmployees' }
        }
      },

      // Join with institutions collection to get bank name and website
      {
        $lookup: {
          from: 'institutions',
          localField: '_id',
          foreignField: 'idrssd',
          as: 'institution'
        }
      },

      // Unwind the institution array
      { $unwind: '$institution' },

      // Filter out banks without names or IDs, and require > 4000 employees
      {
        $match: {
          _id: { $exists: true, $ne: null },
          'institution.name': { $exists: true, $ne: null },
          totalEmployees: { $gt: 4000 }
        }
      },

      // Project the fields we want
      {
        $project: {
          idrssd: '$_id',
          bankName: '$institution.name',
          totalEmployees: 1,
          website: '$institution.website',
          latestPeriod: 1
        }
      },

      // Sort by bank name
      { $sort: { bankName: 1 } }
    ];

    console.log('Querying database...');
    const results = await FinancialStatement.aggregate(pipeline);

    console.log(`Found ${results.length} banks with statements`);

    // Create CSV content
    const csvHeader = 'Bank Name,IDRSSD,Number of Employees,Website,Latest Statement Date\n';
    const csvRows = results.map(bank => {
      const name = (bank.bankName || '').replace(/"/g, '""');
      const idrssd = bank.idrssd || '';
      const employees = bank.totalEmployees || '';
      const website = (bank.website || '').replace(/"/g, '""');
      const latestPeriod = bank.latestPeriod ? bank.latestPeriod.toISOString().split('T')[0] : '';

      return `"${name}",${idrssd},${employees},"${website}",${latestPeriod}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // Write to file
    const outputPath = '/tmp/banks_export.csv';
    fs.writeFileSync(outputPath, csvContent);
    console.log(`✓ CSV file created: ${outputPath}`);
    console.log(`✓ Exported ${results.length} banks`);

    // Show first 5 rows as preview
    console.log('\nPreview (first 5 rows):');
    console.log(csvHeader + csvRows.split('\n').slice(0, 5).join('\n'));

    mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('Error:', error);
    mongoose.connection.close();
    process.exit(1);
  }
});
