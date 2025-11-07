/**
 * Test script to examine XBRL structure from FFIEC API
 */
const axios = require('axios');
const xml2js = require('xml2js');
require('dotenv').config({ path: require('path').join(__dirname, '../..', '.env') });

async function testXBRL() {
  const username = process.env.FFIEC_API_USERNAME;
  const token = process.env.FFIEC_API_PASSWORD;

  console.log('Fetching UBPR data for Bank of America (480228)...\n');

  const response = await axios.get('https://ffieccdr.azure-api.us/public/RetrieveUBPRXBRLFacsimile', {
    headers: {
      'Authentication': `Bearer ${token}`,
      'UserID': username,
      'reportingPeriodEndDate': '06/30/2024',
      'fiIdType': 'ID_RSSD',
      'fiId': '480228'
    }
  });

  // Decode base64
  const buffer = Buffer.from(response.data, 'base64');
  const xmlData = buffer.toString('utf-8');

  // Parse XML
  const parser = new xml2js.Parser({ explicitArray: false });
  const parsed = await parser.parseStringPromise(xmlData);

  console.log('=== Finding UBPR Ratio Codes ===\n');

  // List all uc: elements that might be ratios (PURE unit, not USD)
  const allKeys = Object.keys(parsed.xbrl);
  const ratioKeys = allKeys.filter(key => {
    if (!key.startsWith('uc:UBPR')) return false;
    const elem = parsed.xbrl[key];
    const singleElem = Array.isArray(elem) ? elem[0] : elem;
    return singleElem?.$?.unitRef === 'PURE';
  });

  console.log(`Found ${ratioKeys.length} UBPR metrics with PURE unit (ratios/percentages)`);
  console.log('\nSearching for key metrics...\n');

  // Search for codes containing common terms
  const searchTerms = {
    '3': 'Likely profitability (3xxx series)',
    '7': 'Likely capital (7xxx series)',
    '2': 'Likely asset quality (2xxx series)'
  };

  for (const [prefix, desc] of Object.entries(searchTerms)) {
    const matches = ratioKeys.filter(k => k.startsWith(`uc:UBPR${prefix}`));
    console.log(`${desc}: ${matches.length} metrics`);

    // Show first 10
    matches.slice(0, 10).forEach(key => {
      const code = key.replace('uc:', '');
      const elem = parsed.xbrl[key];
      const singleElem = Array.isArray(elem) ? elem[0] : elem;
      const value = singleElem._;
      console.log(`  ${code}: ${value}`);
    });
    console.log();
  }

  // List all ratio codes with values between 0-20 (likely percentages expressed as decimals)
  console.log('\n=== Likely Performance Ratios (values 0-20) ===\n');
  const performanceRatios = ratioKeys.filter(key => {
    const elem = parsed.xbrl[key];
    const singleElem = Array.isArray(elem) ? elem[0] : elem;
    const value = parseFloat(singleElem._);
    return value >= 0 && value <= 20;
  });

  console.log(`Found ${performanceRatios.length} metrics with values 0-20`);
  performanceRatios.slice(0, 30).forEach(key => {
    const code = key.replace('uc:', '');
    const elem = parsed.xbrl[key];
    const singleElem = Array.isArray(elem) ? elem[0] : elem;
    console.log(`  ${code}: ${singleElem._} (decimals: ${singleElem.$?.decimals})`);
  });

  // Check for patterns in code numbers
  console.log('\n=== Checking Common UBPR Ratio Patterns ===\n');

  // ROA typically ends in 40
  const roaCandidates = ratioKeys.filter(k => k.includes('40') && !k.includes('7'));
  console.log(`\nROA candidates (contains '40', not '7xxx' series):`);
  roaCandidates.slice(0, 5).forEach(key => {
    const code = key.replace('uc:', '');
    const elem = parsed.xbrl[key];
    const singleElem = Array.isArray(elem) ? elem[0] : elem;
    console.log(`  ${code}: ${singleElem._}`);
  });

  // NIM typically in 48 range
  const nimCandidates = ratioKeys.filter(k => k.includes('48'));
  console.log(`\nNIM candidates (contains '48'):`);
  nimCandidates.slice(0, 5).forEach(key => {
    const code = key.replace('uc:', '');
    const elem = parsed.xbrl[key];
    const singleElem = Array.isArray(elem) ? elem[0] : elem;
    console.log(`  ${code}: ${singleElem._}`);
  });
}

testXBRL().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
