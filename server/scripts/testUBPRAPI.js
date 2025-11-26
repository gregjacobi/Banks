const axios = require('axios');
const xml2js = require('xml2js');
require('dotenv').config({ path: require('path').join(__dirname, '../..', '.env') });

async function testAPI() {
  const username = process.env.FFIEC_API_USERNAME;
  const token = process.env.FFIEC_API_PASSWORD;

  if (!username || !token) {
    console.error('❌ FFIEC API credentials not configured!');
    console.log('Please set FFIEC_API_USERNAME and FFIEC_API_PASSWORD in .env file');
    process.exit(1);
  }

  console.log('✅ API credentials found');
  console.log(`Username: ${username}`);
  console.log(`Token: ${token.substring(0, 20)}...\n`);

  // Test with a known bank (Webster Bank IDRSSD: 20313)
  const testIdrssd = '20313';
  const testPeriod = '06/30/2024';

  console.log(`Testing API with:`);
  console.log(`  Bank IDRSSD: ${testIdrssd}`);
  console.log(`  Period: ${testPeriod}\n`);

  try {
    const apiUrl = 'https://ffieccdr.azure-api.us/public/RetrieveUBPRXBRLFacsimile';
    
    console.log('Sending request to FFIEC API...');
    const response = await axios.get(apiUrl, {
      headers: {
        'Authentication': `Bearer ${token}`,
        'UserID': username,
        'reportingPeriodEndDate': testPeriod,
        'fiIdType': 'ID_RSSD',
        'fiId': testIdrssd
      },
      timeout: 30000,
      validateStatus: () => true
    });

    console.log(`\nResponse Status: ${response.status}`);
    
    if (response.status !== 200) {
      console.error(`❌ API returned error status: ${response.status}`);
      console.error(`Response:`, response.data);
      process.exit(1);
    }

    if (typeof response.data !== 'string') {
      console.error('❌ Unexpected response format. Expected base64 string.');
      console.error('Response type:', typeof response.data);
      console.error('Response:', JSON.stringify(response.data).substring(0, 200));
      process.exit(1);
    }

    console.log(`✅ Received base64 response (length: ${response.data.length})`);

    // Decode and parse
    const buffer = Buffer.from(response.data, 'base64');
    const xmlData = buffer.toString('utf-8');
    console.log(`✅ Decoded XML (length: ${xmlData.length})`);

    const parser = new xml2js.Parser({ explicitArray: false });
    const parsed = await parser.parseStringPromise(xmlData);
    
    if (!parsed.xbrl) {
      console.error('❌ No xbrl element found in parsed XML');
      console.log('Root keys:', Object.keys(parsed));
      process.exit(1);
    }

    console.log(`✅ Parsed XBRL successfully`);
    console.log(`XBRL keys count: ${Object.keys(parsed.xbrl).length}`);

    // Check for some expected fields
    const testFields = ['uc:UBPR2170', 'uc:UBPR3210', 'uc:UBPR2200'];
    console.log(`\nChecking for expected fields:`);
    testFields.forEach(field => {
      const exists = parsed.xbrl[field] !== undefined;
      console.log(`  ${field}: ${exists ? '✅ Found' : '❌ Not found'}`);
      if (exists) {
        const elem = parsed.xbrl[field];
        const value = Array.isArray(elem) ? elem[0]._ : elem._;
        console.log(`    Value: ${value}`);
      }
    });

    console.log(`\n✅ API test successful!`);
    console.log(`The API is working correctly.`);

  } catch (error) {
    console.error(`\n❌ API test failed:`);
    console.error(`Error: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data: ${JSON.stringify(error.response.data).substring(0, 500)}`);
    }
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    process.exit(1);
  }
}

testAPI();

