const SourceSelectionService = require('./server/services/sourceSelectionService');

// Test sources with different dates
const testSources = [
  {
    url: 'https://ir.usbank.com/files/doc_presentations/2019/09/USB-Investor-Day-2019_FINAL.pdf',
    title: 'U.S. Bancorp Investor Day 2019',
    date: 'September 12, 2019',
    category: 'investorPresentation'
  },
  {
    url: 'https://ir.usbank.com/files/doc_presentations/2024/09/USB-Investor-Day-2024.pdf',
    title: 'U.S. Bancorp Investor Day 2024 - September 12, 2024',
    date: 'September 12, 2024',
    category: 'investorPresentation'
  },
  {
    url: 'https://ir.usbank.com/files/doc_presentations/2025/06/USB-Morgan-Stanley-Conference-Deck.pdf',
    title: 'Morgan Stanley US Financials Conference 2025',
    date: 'June 11, 2025',
    category: 'investorPresentation'
  },
  {
    url: 'https://ir.usbank.com/files/doc_presentations/2025/03/USB-RBC-Conference-Deck.pdf',
    title: 'RBC Capital Markets Global Financial Institutions Conference 2025',
    date: 'March 5, 2025',
    category: 'investorPresentation'
  }
];

const service = new SourceSelectionService();

console.log('\n='.repeat(80));
console.log('TESTING NEW INTELLIGENT SOURCE SCORING');
console.log('='.repeat(80));
console.log('');

testSources.forEach(source => {
  const scoring = service.scoreSource(source);

  console.log(`📄 ${source.title}`);
  console.log(`   Date: ${source.date}`);
  console.log(`   URL: ${source.url}`);
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   TOTAL SCORE: ${scoring.totalScore}/100`);
  console.log(`   ├─ Authority:  ${scoring.breakdown.authority}/100`);
  console.log(`   ├─ Depth:      ${scoring.breakdown.depth}/100`);
  console.log(`   └─ Freshness:  ${scoring.breakdown.freshness}/100`);
  console.log('');
});

console.log('='.repeat(80));
console.log('EXPECTED RESULTS:');
console.log('  ✅ 2025 sources should score 85-95 (excellent)');
console.log('  ✅ 2024 sources should score 75-85 (good)');
console.log('  ❌ 2019 sources should score 40-50 (too old)');
console.log('='.repeat(80));
console.log('');
