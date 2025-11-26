const axios = require('axios');
const xml2js = require('xml2js');
const token = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJBY2Nlc3MgVG9rZW4iLCJqdGkiOiIzNWMwOTAyNi1jYzM3LTQxZGMtYTFhZS0zN2EyY2QwM2ZkZjQiLCJuYmYiOjE3NjE5NzkwMDIsImV4cCI6MTc2OTc1ODYwMiwiaXNzIjoiMWVmYzAyYmMtMmRkYS00MWM4LWE4ZWItMjMxYTMzNDMzMDkzIiwiYXVkIjoiUFdTIFVzZXIifQ.';

async function search() {
  const resp = await axios.get('https://ffieccdr.azure-api.us/public/RetrieveUBPRXBRLFacsimile', {
    headers: {
      'Authentication': `Bearer ${token}`,
      'UserID': 'gjacobiant',
      'reportingPeriodEndDate': '06/30/2024',
      'fiIdType': 'ID_RSSD',
      'fiId': '480228'
    }
  });

  const buffer = Buffer.from(resp.data, 'base64');
  const xmlData = buffer.toString('utf-8');
  const parser = new xml2js.Parser({ explicitArray: false });
  const parsed = await parser.parseStringPromise(xmlData);

  const allKeys = Object.keys(parsed.xbrl).filter(k => k.startsWith('uc:UBPR'));

  // Search for specific value ranges
  const searches = [
    { name: 'ROA ~1.2', min: 1.1, max: 1.3 },
    { name: 'ROE ~11.5', min: 11.0, max: 12.0 },
    { name: 'NIM ~2.9', min: 2.8, max: 3.0 },
    { name: 'Efficiency ~59', min: 58, max: 60 },
    { name: 'Tier1Lev ~9.7', min: 9.5, max: 10.0 }
  ];

  searches.forEach(search => {
    console.log(`\n${search.name}:`);
    allKeys.forEach(key => {
      const elem = parsed.xbrl[key];
      const singleElem = Array.isArray(elem) ? elem[0] : elem;
      const value = parseFloat(singleElem._);
      if (!isNaN(value) && value >= search.min && value <= search.max) {
        const unit = singleElem.$?.unitRef;
        const decimals = singleElem.$?.decimals;
        const code = key.replace('uc:', '');
        console.log(`  ${code}: ${value} (unit: ${unit}, decimals: ${decimals})`);
      }
    });
  });
}

search().catch(console.error);
