const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

const Institution = require('../models/Institution');
const BankMetadata = require('../models/BankMetadata');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bankexplorer';
const FDIC_API_BASE = 'https://api.fdic.gov/banks/institutions';

/**
 * Fetch website URL from FDIC API for a single institution
 * @param {string} fdicCert - FDIC certificate number
 * @returns {Promise<string|null>} Website URL or null if not found
 */
async function fetchWebsiteUrl(fdicCert) {
  try {
    const response = await axios.get(FDIC_API_BASE, {
      params: {
        filters: `CERT:${fdicCert}`,
        fields: 'WEBADDR',
        format: 'json',
        limit: 1
      },
      timeout: 10000
    });

    if (response.data && response.data.data && response.data.data.length > 0) {
      const webaddr = response.data.data[0].data.WEBADDR;
      if (webaddr) {
        // Ensure URL has protocol
        return webaddr.startsWith('http') ? webaddr : `https://${webaddr}`;
      }
    }
    return null;
  } catch (error) {
    console.error(`Error fetching website for FDIC cert ${fdicCert}:`, error.message);
    return null;
  }
}

/**
 * Main function to fetch and update website URLs for all institutions
 */
async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    // Get all institutions with FDIC cert numbers
    const institutions = await Institution.find({ fdicCert: { $exists: true, $ne: null } })
      .select('idrssd name fdicCert website')
      .sort({ name: 1 });

    console.log(`Found ${institutions.length} institutions with FDIC cert numbers\n`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const institution of institutions) {
      // Skip if website already populated
      if (institution.website) {
        skipped++;
        continue;
      }

      console.log(`Fetching website for ${institution.name} (CERT: ${institution.fdicCert})...`);

      const websiteUrl = await fetchWebsiteUrl(institution.fdicCert);

      if (websiteUrl) {
        // Update Institution record
        institution.website = websiteUrl;
        await institution.save();

        // Also update BankMetadata if it exists
        const metadata = await BankMetadata.findOne({ idrssd: institution.idrssd });
        if (metadata) {
          metadata.websiteUrl = websiteUrl;
          await metadata.save();
        } else {
          // Create BankMetadata record
          await BankMetadata.create({
            idrssd: institution.idrssd,
            bankName: institution.name,
            websiteUrl: websiteUrl
          });
        }

        console.log(`✓ Updated: ${websiteUrl}\n`);
        updated++;
      } else {
        console.log(`✗ No website found\n`);
        failed++;
      }

      // Rate limiting: wait 200ms between requests to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('\n' + '='.repeat(60));
    console.log('Summary:');
    console.log(`  Updated: ${updated}`);
    console.log(`  Skipped (already had website): ${skipped}`);
    console.log(`  Failed (no website found): ${failed}`);
    console.log(`  Total: ${institutions.length}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { fetchWebsiteUrl };
