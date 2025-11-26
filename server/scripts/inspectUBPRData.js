const mongoose = require('mongoose');
const UBPRData = require('../models/UBPRData');
require('dotenv').config({ path: require('path').join(__dirname, '../..', '.env') });

async function inspectData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Find a recent UBPR record
    const ubprRecord = await UBPRData.findOne().sort({ fetchedAt: -1 }).lean();
    
    if (!ubprRecord) {
      console.log('No UBPR records found in database');
      process.exit(0);
    }

    console.log('=== UBPR Record ===');
    console.log('IDRSSD:', ubprRecord.idrssd);
    console.log('Period:', ubprRecord.reportingPeriod);
    console.log('Data Source:', ubprRecord.dataSource);
    console.log('Fetched At:', ubprRecord.fetchedAt);
    console.log('\n=== Metrics ===');
    console.log(JSON.stringify(ubprRecord.metrics, null, 2));
    
    console.log('\n=== Raw Data Structure ===');
    console.log('Type:', typeof ubprRecord.rawData);
    console.log('Is Array:', Array.isArray(ubprRecord.rawData));
    console.log('Is Object:', typeof ubprRecord.rawData === 'object' && ubprRecord.rawData !== null);
    
    if (ubprRecord.rawData && typeof ubprRecord.rawData === 'object') {
      const keys = Object.keys(ubprRecord.rawData);
      console.log('Total keys:', keys.length);
      console.log('\nFirst 30 keys:');
      keys.slice(0, 30).forEach(key => {
        const value = ubprRecord.rawData[key];
        const valueType = Array.isArray(value) ? 'array' : typeof value;
        const sampleValue = Array.isArray(value) 
          ? (value[0]?._ || value[0] || 'N/A')
          : (value?._ || value || 'N/A');
        console.log(`  ${key}: ${valueType} - ${JSON.stringify(sampleValue).substring(0, 50)}`);
      });
      
      // Check for UBPR2170 (Total Assets)
      console.log('\n=== Checking for UBPR2170 (Total Assets) ===');
      const keys2170 = keys.filter(k => k.includes('2170') || k.includes('UBPR2170'));
      console.log('Keys containing 2170:', keys2170);
      if (keys2170.length > 0) {
        console.log('Value:', JSON.stringify(ubprRecord.rawData[keys2170[0]], null, 2).substring(0, 200));
      }
      
      // Check for uc: prefix
      const ucKeys = keys.filter(k => k.startsWith('uc:'));
      console.log(`\nKeys with 'uc:' prefix: ${ucKeys.length}`);
      if (ucKeys.length > 0) {
        console.log('Sample uc: keys:', ucKeys.slice(0, 10));
      }
      
      // Check for UBPR prefix without uc:
      const ubprKeys = keys.filter(k => k.includes('UBPR') && !k.startsWith('uc:'));
      console.log(`\nKeys with 'UBPR' but no 'uc:' prefix: ${ubprKeys.length}`);
      if (ubprKeys.length > 0) {
        console.log('Sample UBPR keys:', ubprKeys.slice(0, 10));
      }
    } else {
      console.log('Raw data:', ubprRecord.rawData);
    }

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

inspectData();

