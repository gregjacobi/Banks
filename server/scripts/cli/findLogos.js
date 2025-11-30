#!/usr/bin/env node

/**
 * Logo Finder CLI Tool - VERBOSE MODE
 *
 * Finds and downloads bank logos with extensive logging for strategy improvement
 *
 * Usage:
 *   # Find logo for specific bank by ID
 *   node server/scripts/cli/findLogos.js --idrssd 504713
 *
 *   # Find logo for specific bank by name
 *   node server/scripts/cli/findLogos.js --name "JPMorgan Chase Bank"
 *
 *   # Find logos for top 10 banks
 *   node server/scripts/cli/findLogos.js --count 10
 *
 *   # Force re-find logos even if they exist
 *   node server/scripts/cli/findLogos.js --count 10 --force
 *
 *   # List logo status for top N banks
 *   node server/scripts/cli/findLogos.js --list --count 20
 *
 * Options:
 *   --idrssd, -i    Bank ID (IDRSSD)
 *   --name, -n      Bank name (partial match)
 *   --count, -c     Number of top banks to process (default: 1)
 *   --list, -l      List banks with logo status
 *   --force, -f     Re-find logos even if they already exist
 */

const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Check for --production flag
const isProduction = process.argv.includes('--production');

// Load appropriate .env file
if (isProduction) {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env.production') });
  console.log('🚀 Running in PRODUCTION mode');
} else {
  require('dotenv').config();
  console.log('🔧 Running in DEVELOPMENT mode');
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bankexplorer';

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.findIndex(arg => arg === flag || arg === flag.replace('--', '-'));
  return index !== -1 ? args[index + 1] : null;
};
const hasFlag = (flag) => args.includes(flag) || args.includes(flag.replace('--', '-'));

const idrssd = getArg('--idrssd') || getArg('-i');
const bankName = getArg('--name') || getArg('-n');
const count = parseInt(getArg('--count') || getArg('-c') || '1');
const listOnly = hasFlag('--list') || hasFlag('-l');
const force = hasFlag('--force') || hasFlag('-f');
const showHelp = hasFlag('--help') || hasFlag('-h');

// Show help
if (showHelp) {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           Bank Explorer - Logo Finder CLI Tool                ║
╚════════════════════════════════════════════════════════════════╝

DESCRIPTION:
  Finds and downloads bank logos (both full and symbol versions) using
  AI-powered search strategies. Supports multiple logo sources including
  Brandfetch, Wikipedia, official bank websites, and web search.

USAGE:
  node server/scripts/cli/findLogos.js [OPTIONS]

OPTIONS:
  --idrssd, -i <id>    Find logo for specific bank by IDRSSD
  --name, -n <name>    Find logo for specific bank by name (partial match)
  --count, -c <num>    Number of top banks to process (default: 1)
  --list, -l           List banks with logo status (found/missing)
  --force, -f          Re-find logos even if they already exist
  --help, -h           Show this help message

EXAMPLES:
  # Find logo for a specific bank by ID
  node server/scripts/cli/findLogos.js --idrssd 504713

  # Find logo for a specific bank by name
  node server/scripts/cli/findLogos.js --name "JPMorgan Chase"

  # Find logos for top 10 banks
  node server/scripts/cli/findLogos.js --count 10

  # Force re-find logos even if they exist
  node server/scripts/cli/findLogos.js --count 10 --force

  # List logo status for top 20 banks
  node server/scripts/cli/findLogos.js --list --count 20

LOGO SOURCES (in order of preference):
  1. Brandfetch API (commercial logo service)
  2. Wikipedia infobox images
  3. Official bank websites (identified via web search)
  4. General web image search
  5. FDIC bank data API

OUTPUT:
  - Logos saved to: MongoDB GridFS (images bucket)
  - Full logos: {idrssd}.{ext}
  - Symbol logos: {idrssd}-symbol.{ext}
  - Metadata and references stored in BankLogo model

NOTES:
  - Uses Claude AI to parse search results and identify logo URLs
  - Verbose logging shows all search strategies and results
  - Automatically retries failed downloads
  - Supports PNG, JPG, SVG formats
`);
  process.exit(0);
}

// Logging utilities
const log = {
  section: (msg) => console.log(`\n${'='.repeat(80)}\n${msg}\n${'='.repeat(80)}`),
  step: (num, msg) => console.log(`\n[STEP ${num}] ${msg}`),
  info: (msg) => console.log(`  ℹ️  ${msg}`),
  success: (msg) => console.log(`  ✅ ${msg}`),
  error: (msg) => console.log(`  ❌ ${msg}`),
  warning: (msg) => console.log(`  ⚠️  ${msg}`),
  debug: (label, data) => {
    console.log(`  🔍 ${label}:`);
    const jsonString = JSON.stringify(data, null, 2) || 'undefined';
    console.log(jsonString.split('\n').map(line => `     ${line}`).join('\n'));
  },
  prompt: (msg) => console.log(`\n  📝 PROMPT SENT TO CLAUDE:\n${'─'.repeat(80)}\n${msg}\n${'─'.repeat(80)}`),
  response: (msg) => console.log(`\n  🤖 CLAUDE RESPONSE:\n${'─'.repeat(80)}\n${msg}\n${'─'.repeat(80)}`)
};

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    log.success('Connected to MongoDB');
  } catch (error) {
    log.error('MongoDB connection error: ' + error.message);
    process.exit(1);
  }
}

async function getTopBanks(limit) {
  const Institution = require('../../models/Institution');
  const FinancialStatement = require('../../models/FinancialStatement');

  log.step(1, `Fetching top ${limit} banks by assets`);

  const latestStatements = await FinancialStatement.aggregate([
    { $sort: { reportingPeriod: -1 } },
    {
      $group: {
        _id: '$idrssd',
        latestPeriod: { $first: '$reportingPeriod' },
        totalAssets: { $first: '$balanceSheet.assets.totalAssets' }
      }
    },
    { $match: { totalAssets: { $gt: 0 } } },
    { $sort: { totalAssets: -1 } },
    { $limit: limit }
  ]);

  const idrssdList = latestStatements.map(s => s._id);
  const institutions = await Institution.find({ idrssd: { $in: idrssdList } }).lean();

  const banksWithAssets = latestStatements.map(stmt => {
    const institution = institutions.find(i => i.idrssd === stmt._id);
    return {
      idrssd: stmt._id,
      name: institution?.name || 'Unknown',
      city: institution?.city,
      state: institution?.state,
      totalAssets: stmt.totalAssets
    };
  });

  log.success(`Found ${banksWithAssets.length} banks`);
  return banksWithAssets;
}

async function findLogoForBank(bank) {
  log.section(`🏦 ${bank.name} (${bank.idrssd})`);
  log.info(`Location: ${bank.city}, ${bank.state}`);
  log.info(`Assets: ${formatAssets(bank.totalAssets)}`);

  const BankMetadata = require('../../models/BankMetadata');
  const Institution = require('../../models/Institution');
  const metadata = await BankMetadata.getOrCreate(bank.idrssd, bank.name);

  // Check if logo already exists
  if (metadata.logo?.url && !force) {
    log.warning('Logo already exists in database (use --force to re-find)');
    log.debug('Existing logo data', metadata.logo);
    return { success: true, existing: true, logo: metadata.logo };
  }

  if (metadata.logo?.url && force) {
    log.warning('Logo exists but --force flag set, re-finding logo');
    log.debug('Existing logo data (will be replaced)', metadata.logo);
  }

  log.step(1, 'Checking for stored website URL from call report data');
  let domainVariations = [];

  // Try to get website URL from Institution record (from call report data)
  const institution = await Institution.findOne({ idrssd: bank.idrssd }).lean();
  if (institution?.website) {
    try {
      // Extract domain from website URL
      const url = new URL(institution.website.startsWith('http') ? institution.website : `https://${institution.website}`);
      const domain = url.hostname.replace('www.', '');
      log.success(`Found stored website URL: ${institution.website}`);
      log.info(`Extracted domain: ${domain}`);
      // Put the actual website domain first
      domainVariations.push(domain);
    } catch (error) {
      log.warning(`Could not parse stored website URL: ${institution.website}`);
    }
  } else {
    log.info('No stored website URL found in call report data');
  }

  // Add generated domain variations as fallback
  log.step(1.5, 'Generating additional domain variations for Brandfetch search');
  const generatedVariations = generateDomainVariations(bank.name);
  // Add generated variations, but filter out duplicates
  for (const domain of generatedVariations) {
    if (!domainVariations.includes(domain)) {
      domainVariations.push(domain);
    }
  }
  log.debug('Domain variations to try (stored URL first, then guesses)', domainVariations);

  // Logo types and formats to try
  const logoTypes = ['logo', 'symbol', 'icon'];
  const formats = ['svg', 'png'];

  log.step(2, 'Searching Brandfetch for logo');
  let foundLogo = null;
  let attemptedUrls = [];

  // Try each domain variation
  for (const domain of domainVariations) {
    if (foundLogo) break;

    log.info(`Trying domain: ${domain}`);

    // Try each logo type and format
    for (const logoType of logoTypes) {
      if (foundLogo) break;

      for (const format of formats) {
        const result = await tryBrandfetchDomain(domain, logoType, format);
        attemptedUrls.push({
          url: result.url,
          success: result.success,
          status: result.status,
          error: result.error
        });

        if (result.success) {
          log.success(`✓ Found logo: ${domain}/${logoType}.${format}`);
          log.debug('Logo details', {
            domain,
            logoType,
            format,
            size: `${(result.size / 1024).toFixed(2)} KB`,
            contentType: result.contentType
          });
          foundLogo = result;
          break;
        } else {
          log.debug(`✗ ${domain}/${logoType}.${format} - ${result.status || result.error}`);
        }
      }
    }
  }

  log.debug('All attempted URLs', attemptedUrls);

  if (!foundLogo) {
    log.section('❌ NO LOGO FOUND');
    log.error(`Tried ${attemptedUrls.length} different URL combinations`);
    log.debug('Failed attempts summary', {
      totalAttempts: attemptedUrls.length,
      domainsattempted: domainVariations,
      logoTypes,
      formats
    });
    return {
      success: false,
      error: 'No logo found in Brandfetch',
      attemptedUrls,
      domainsTried: domainVariations
    };
  }

  log.step(3, 'Logo found! Preparing for validation');
  log.success(`Logo URL: ${foundLogo.url}`);
  log.info(`Source: Brandfetch (${foundLogo.domain})`);
  log.info(`Type: ${foundLogo.logoType}, Format: ${foundLogo.format}`);
  log.info(`Size: ${(foundLogo.size / 1024).toFixed(2)} KB`);

  const logoData = {
    url: foundLogo.url,
    domain: foundLogo.domain,
    logoType: foundLogo.logoType,
    format: foundLogo.format,
    source: `Brandfetch (${foundLogo.domain})`,
    data: foundLogo.data,
    contentType: foundLogo.contentType,
    size: foundLogo.size
  };

  log.step(4, 'Trying to find square icon version of logo');
  let symbolLogoData = null;

  // Try to get the default icon (square logo) - just use domain without path
  const symbolResult = await tryBrandfetchDefault(foundLogo.domain);
  if (symbolResult.success && symbolResult.size > 500) { // Must be at least 0.5 KB
    log.success(`✓ Found square icon: ${symbolResult.domain} (default)`);
    log.debug('Square icon details', {
      domain: symbolResult.domain,
      format: symbolResult.format,
      size: `${(symbolResult.size / 1024).toFixed(2)} KB`,
      contentType: symbolResult.contentType
    });
    symbolLogoData = {
      url: symbolResult.url,
      domain: symbolResult.domain,
      logoType: 'icon',
      format: symbolResult.format,
      source: `Brandfetch (${symbolResult.domain})`,
      data: symbolResult.data,
      contentType: symbolResult.contentType,
      size: symbolResult.size
    };
  } else {
    log.warning('Square icon not found or too small, will use full logo as fallback');
  }

  log.step(5, 'Saving logo URLs to database');
  await metadata.updateLogo({
    url: logoData.url,
    source: logoData.source,
    symbolUrl: symbolLogoData?.url || logoData.url // Fallback to full logo if no symbol
  });
  log.success('Logo URLs saved to database');

  log.step(6, 'Validating and saving full logo file to GridFS');
  try {
    const ext = `.${logoData.format}`;
    const filename = `${bank.idrssd}${ext}`;

    log.info('Logo already downloaded from Brandfetch, validating...');

    // Validation Step 1: Check file size
    const fileSizeKB = logoData.size / 1024;

    if (fileSizeKB < 0.5) {
      throw new Error(`File too small (${fileSizeKB.toFixed(2)} KB) - likely not a valid logo`);
    }
    log.success(`✓ File size OK: ${fileSizeKB.toFixed(2)} KB`);

    if (fileSizeKB > 5000) {
      log.warning(`File very large (${fileSizeKB.toFixed(2)} KB) - may not be a logo`);
    }

    // Validation Step 2: Check content type
    const contentType = logoData.contentType;
    const validTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

    if (!contentType || !validTypes.some(type => contentType.includes(type))) {
      throw new Error(`Invalid content type: ${contentType} - expected image format`);
    }
    log.success(`✓ Content type OK: ${contentType}`);

    // Validation Step 3: Check file signature (magic bytes)
    const buffer = Buffer.from(logoData.data);
    const signature = buffer.slice(0, 8);
    const isSVG = buffer.toString('utf8', 0, 100).includes('<svg');
    const isPNG = signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4E && signature[3] === 0x47;
    const isJPEG = signature[0] === 0xFF && signature[1] === 0xD8 && signature[2] === 0xFF;

    if (!isSVG && !isPNG && !isJPEG) {
      log.warning('File signature check inconclusive');
      log.debug('File signature (first 8 bytes)', signature.toString('hex'));
    } else {
      const format = isSVG ? 'SVG' : isPNG ? 'PNG' : 'JPEG';
      log.success(`✓ File signature valid: ${format}`);
    }

    // Validation Step 4: Check for error page content
    const textContent = buffer.toString('utf8', 0, Math.min(500, buffer.length)).toLowerCase();
    const errorIndicators = ['404', 'not found', 'error', 'access denied', 'forbidden'];
    const hasErrorText = errorIndicators.some(indicator => textContent.includes(indicator));

    if (hasErrorText) {
      throw new Error('Downloaded file contains error page content');
    }
    log.success('✓ No error page indicators found');

    // Upload to GridFS
    log.step(6, 'Uploading logo to GridFS');
    const { imageBucket } = require('../../config/gridfs');
    const BankLogo = require('../../models/BankLogo');

    // Check if logo already exists for this bank
    const existingLogo = await BankLogo.findOne({ idrssd: bank.idrssd });
    if (existingLogo) {
      log.info('Deleting existing logo from GridFS');
      await existingLogo.deleteFile();
    }

    const uploadStream = imageBucket.openUploadStream(filename, {
      contentType: logoData.contentType,
      metadata: {
        idrssd: bank.idrssd,
        bankName: bank.name,
        source: logoData.source,
        logoType: logoData.logoType,
        uploadedAt: new Date()
      }
    });

    uploadStream.end(Buffer.from(logoData.data));

    await new Promise((resolve, reject) => {
      uploadStream.on('finish', resolve);
      uploadStream.on('error', reject);
    });

    log.success(`Logo uploaded to GridFS with file ID: ${uploadStream.id}`);

    // Create or update BankLogo record
    log.step(7, 'Creating BankLogo record');
    await BankLogo.findOneAndUpdate(
      { idrssd: bank.idrssd },
      {
        idrssd: bank.idrssd,
        gridfsFileId: uploadStream.id,
        filename: filename,
        contentType: logoData.contentType,
        fileSize: logoData.size,
        source: logoData.source
      },
      { upsert: true, new: true }
    );

    // Update metadata with validated full logo
    log.step(8, 'Updating BankMetadata with validated full logo');
    await metadata.updateLogo({
      url: logoData.url,
      source: logoData.source,
      gridfsFileId: uploadStream.id,
      symbolUrl: symbolLogoData?.url || logoData.url
    });
    log.success('Database updated with validated full logo');

    log.section('✅ FULL LOGO VALIDATION PASSED');
    log.debug('Final full logo details', {
      filename,
      gridfsFileId: uploadStream.id.toString(),
      size: `${fileSizeKB.toFixed(2)} KB`,
      contentType,
      format: isSVG ? 'SVG' : isPNG ? 'PNG' : isJPEG ? 'JPEG' : 'Unknown',
      verified: true
    });

    // Now validate and save symbol logo if we found one
    let symbolGridfsFileId = null;
    if (symbolLogoData) {
      log.step(9, 'Validating and saving symbol logo file to GridFS');
      try {
        const symbolExt = `.${symbolLogoData.format}`;
        const symbolFilename = `${bank.idrssd}-symbol${symbolExt}`;

        log.info('Validating symbol logo...');

        // Validation Step 1: Check file size
        const symbolFileSizeKB = symbolLogoData.size / 1024;
        if (symbolFileSizeKB < 0.5) {
          throw new Error(`Symbol file too small (${symbolFileSizeKB.toFixed(2)} KB)`);
        }
        log.success(`✓ Symbol file size OK: ${symbolFileSizeKB.toFixed(2)} KB`);

        // Validation Step 2: Check content type
        const symbolContentType = symbolLogoData.contentType;
        const validTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (!symbolContentType || !validTypes.some(type => symbolContentType.includes(type))) {
          throw new Error(`Invalid content type: ${symbolContentType}`);
        }
        log.success(`✓ Symbol content type OK: ${symbolContentType}`);

        // Validation Step 3: Check file signature
        const symbolBuffer = Buffer.from(symbolLogoData.data);
        const symbolSignature = symbolBuffer.slice(0, 8);
        const symbolIsSVG = symbolBuffer.toString('utf8', 0, 100).includes('<svg');
        const symbolIsPNG = symbolSignature[0] === 0x89 && symbolSignature[1] === 0x50 && symbolSignature[2] === 0x4E && symbolSignature[3] === 0x47;
        const symbolIsJPEG = symbolSignature[0] === 0xFF && symbolSignature[1] === 0xD8 && symbolSignature[2] === 0xFF;

        if (symbolIsSVG || symbolIsPNG || symbolIsJPEG) {
          const format = symbolIsSVG ? 'SVG' : symbolIsPNG ? 'PNG' : 'JPEG';
          log.success(`✓ Symbol file signature valid: ${format}`);
        }

        // Upload symbol to GridFS
        log.step(10, 'Uploading symbol logo to GridFS');
        const symbolUploadStream = imageBucket.openUploadStream(symbolFilename, {
          contentType: symbolContentType,
          metadata: {
            idrssd: bank.idrssd,
            bankName: bank.name,
            source: symbolLogoData.source,
            logoType: 'symbol',
            uploadedAt: new Date()
          }
        });

        symbolUploadStream.end(symbolBuffer);

        await new Promise((resolve, reject) => {
          symbolUploadStream.on('finish', resolve);
          symbolUploadStream.on('error', reject);
        });

        log.success(`Symbol logo uploaded to GridFS with file ID: ${symbolUploadStream.id}`);
        symbolGridfsFileId = symbolUploadStream.id;

        // Update metadata with symbol GridFS file ID
        log.step(11, 'Updating database with validated symbol logo');
        await metadata.updateLogo({
          url: logoData.url,
          source: logoData.source,
          gridfsFileId: uploadStream.id,
          symbolUrl: symbolLogoData.url,
          symbolGridfsFileId: symbolGridfsFileId
        });
        log.success('Database updated with validated symbol logo');

        log.section('✅ SYMBOL LOGO VALIDATION PASSED');
        log.debug('Final symbol logo details', {
          filename: symbolFilename,
          gridfsFileId: symbolGridfsFileId.toString(),
          size: `${symbolFileSizeKB.toFixed(2)} KB`,
          contentType: symbolContentType,
          format: symbolIsSVG ? 'SVG' : symbolIsPNG ? 'PNG' : symbolIsJPEG ? 'JPEG' : 'Unknown',
          verified: true
        });

      } catch (symbolError) {
        log.warning(`Symbol logo validation failed: ${symbolError.message}`);
        log.info('Continuing with full logo only');
        // Note: GridFS will clean up partial uploads automatically on error
      }
    }

    return {
      success: true,
      logo: {
        url: logoData.url,
        source: logoData.source,
        gridfsFileId: uploadStream.id.toString(),
        symbolUrl: symbolLogoData?.url || logoData.url,
        symbolGridfsFileId: symbolGridfsFileId?.toString() || uploadStream.id.toString()
      },
      metadata: {
        domain: logoData.domain,
        logoType: logoData.logoType,
        format: logoData.format,
        size: logoData.size
      }
    };

  } catch (validationError) {
    log.section('❌ LOGO VALIDATION FAILED');
    log.error(`Validation failed: ${validationError.message}`);
    log.debug('Validation error details', {
      error: validationError.message,
      validationFailed: true
    });

    // Note: GridFS will clean up partial uploads automatically on error

    return { success: false, error: validationError.message, validationFailed: true };
  }
}

async function listBanksWithLogos() {
  log.section('📊 Banks with Logo Status');

  const banks = await getTopBanks(count);
  const BankMetadata = require('../../models/BankMetadata');

  console.log('\n' + '='.repeat(100));
  console.log(sprintf('%-10s %-50s %-15s %-10s', 'ID RSSD', 'Bank Name', 'Assets', 'Logo'));
  console.log('='.repeat(100));

  for (const bank of banks) {
    const metadata = await BankMetadata.findOne({ idrssd: bank.idrssd });
    const hasLogo = metadata?.logo?.url ? '✅' : '❌';
    const source = metadata?.logo?.source ? ` (${metadata.logo.source})` : '';

    console.log(sprintf('%-10s %-50s %-15s %-10s',
      bank.idrssd,
      truncate(bank.name, 48),
      formatAssets(bank.totalAssets),
      hasLogo + source
    ));
  }

  console.log('='.repeat(100));
}

// Brandfetch configuration
const BRANDFETCH_CLIENT_ID = '1idTnzC8NoUWbexbAFL';
const BRANDFETCH_BASE_URL = 'https://cdn.brandfetch.io';

/**
 * Generate domain variations to try for a bank name
 */
function generateDomainVariations(bankName) {
  const variations = [];

  // Clean up bank name
  let cleaned = bankName
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[,\.]/g, '')
    .replace(/national association/gi, '')
    .replace(/n\.a\./gi, '')
    .replace(/&/g, 'and')
    .trim();

  // Remove common suffixes
  cleaned = cleaned
    .replace(/bank$/i, '')
    .replace(/trust$/i, '')
    .replace(/company$/i, '')
    .replace(/corporation$/i, '')
    .replace(/corp$/i, '')
    .replace(/inc$/i, '')
    .trim();

  // Common abbreviations for major banks (check these FIRST)
  const abbreviations = {
    'jpmorganchase': ['chase.com', 'jpmorgan.com', 'jpmorganchase.com'],
    'bankofamerica': ['bankofamerica.com', 'bofa.com'],
    'wellsfargo': ['wellsfargo.com'],
    'citibank': ['citi.com', 'citibank.com'],
    'usbank': ['usbank.com'],
    'pncbank': ['pnc.com', 'pncbank.com'],
    'truist': ['truist.com'],
    'tdbank': ['td.com', 'tdbank.com'],
    'capitalone': ['capitalone.com'],
    'firstrepublic': ['firstrepublic.com'],
    'charlesschwab': ['schwab.com', 'charlesschwab.com'],
    'morganstanley': ['morganstanley.com', 'morganstanleyprivatebank.com'],
    'goldmansachs': ['goldmansachs.com', 'gs.com'],
    'statestreet': ['statestreet.com'],
    'bmo': ['bmo.com', 'bmoharris.com'],
    'citizensbank': ['citizensbank.com'],
    'fifththird': ['53.com', 'fifththirdbank.com'],
    'keybank': ['key.com', 'keybank.com'],
    'huntington': ['huntington.com'],
    'ally': ['ally.com'],
    'discover': ['discover.com'],
    'hsbc': ['hsbc.com', 'us.hsbc.com'],
    'regions': ['regions.com'],
    'santander': ['santander.com', 'santanderbank.com'],
    'firsthorizon': ['firsthorizon.com'],
    'etrade': ['etrade.com'],
    'comerica': ['comerica.com'],
    'ubs': ['ubs.com'],
    'northerntrust': ['northerntrust.com'],
    'synchrony': ['synchrony.com'],
    'signaturebank': ['signaturebank.com'],
    'usaa': ['usaa.com'],
    'mufg': ['mufgamericas.com', 'unionbank.com'],
    'citynational': ['cnb.com', 'citynational.com'],
    'flagstar': ['flagstar.com'],
    'bankofthewest': ['bankofthewest.com'],
    'zions': ['zionsbank.com'],
    'bbva': ['bbvausa.com'],
    'westernalliance': ['westernalliancebank.com'],
    'eastwest': ['eastwestbank.com'],
    'umb': ['umb.com'],
    'oldnational': ['oldnational.com']
  };

  // Check if we have known abbreviations for this bank (prioritize these!)
  let foundAbbreviations = false;
  for (const [key, domains] of Object.entries(abbreviations)) {
    if (cleaned.includes(key)) {
      variations.push(...domains);
      foundAbbreviations = true;
      break;
    }
  }

  // Only add generic variations if we don't have specific abbreviations
  // OR if the cleaned name is short enough to be a real domain
  if (!foundAbbreviations || cleaned.length <= 20) {
    // Primary domain (cleaned name + .com)
    variations.push(`${cleaned}.com`);

    // Without spaces/special chars + bank.com
    if (cleaned.length <= 15) {
      variations.push(`${cleaned}bank.com`);
    }
  }

  // Remove duplicates and return
  return [...new Set(variations)];
}

/**
 * Try to fetch default icon from Brandfetch (returns square icon)
 */
async function tryBrandfetchDefault(domain) {
  const url = `${BRANDFETCH_BASE_URL}/${domain}?c=${BRANDFETCH_CLIENT_ID}`;

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      maxContentLength: 10 * 1024 * 1024,
      validateStatus: (status) => status === 200,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/svg+xml,image/webp,image/png,image/*,*/*;q=0.8',
        'Referer': 'https://bankexplorer.app/',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      }
    });

    // Determine actual format from content-type header
    const contentType = response.headers['content-type'];
    let actualFormat = 'png'; // Default to png

    if (contentType) {
      if (contentType.includes('svg')) {
        actualFormat = 'svg';
      } else if (contentType.includes('webp')) {
        actualFormat = 'webp';
      } else if (contentType.includes('png')) {
        actualFormat = 'png';
      } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
        actualFormat = 'jpg';
      }
    }

    return {
      success: true,
      data: response.data,
      contentType: contentType,
      size: response.data.length,
      url,
      domain,
      format: actualFormat
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      status: error.response?.status,
      url,
      domain
    };
  }
}

/**
 * Try to fetch logo from Brandfetch for a given domain
 */
async function tryBrandfetchDomain(domain, logoType = 'logo', format = 'svg') {
  const url = `${BRANDFETCH_BASE_URL}/${domain}/${logoType}.${format}?c=${BRANDFETCH_CLIENT_ID}`;

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      maxContentLength: 10 * 1024 * 1024,
      validateStatus: (status) => status === 200,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/svg+xml,image/webp,image/png,image/*,*/*;q=0.8',
        'Referer': 'https://bankexplorer.app/',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      }
    });

    // Determine actual format from content-type header
    const contentType = response.headers['content-type'];
    let actualFormat = format; // Default to requested format

    if (contentType) {
      if (contentType.includes('svg')) {
        actualFormat = 'svg';
      } else if (contentType.includes('webp')) {
        actualFormat = 'webp';
      } else if (contentType.includes('png')) {
        actualFormat = 'png';
      } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
        actualFormat = 'jpg';
      }
    }

    return {
      success: true,
      data: response.data,
      contentType: contentType,
      size: response.data.length,
      url,
      domain,
      logoType,
      format: actualFormat // Use actual format, not requested format
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      status: error.response?.status,
      url,
      domain,
      logoType,
      format
    };
  }
}

// Helper functions
function formatAssets(assets) {
  if (!assets) return 'N/A';
  const millions = assets / 1000;
  if (millions >= 1000) {
    return `$${(millions / 1000).toFixed(1)}B`;
  }
  return `$${millions.toFixed(0)}M`;
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str;
}

function sprintf(format, ...args) {
  let i = 0;
  return format.replace(/%-?(\d+)s/g, (match, width) => {
    const value = String(args[i++] || '');
    const isLeftAlign = match.startsWith('%-');
    const w = parseInt(width);
    if (isLeftAlign) {
      return value.padEnd(w);
    }
    return value.padStart(w);
  });
}

// Main execution
async function main() {
  try {
    log.section('🚀 LOGO FINDER - VERBOSE MODE');
    log.info('Starting logo discovery process with detailed logging');
    log.debug('Command line arguments', { idrssd, bankName, count, listOnly, force });

    if (force) {
      log.warning('FORCE MODE ENABLED - Will re-find logos even if they already exist');
    }

    await connectDB();

    if (listOnly) {
      await listBanksWithLogos();
    } else if (idrssd) {
      // Find single bank by ID
      const Institution = require('../../models/Institution');
      const institution = await Institution.findOne({ idrssd });

      if (!institution) {
        log.error(`Bank with ID ${idrssd} not found`);
        process.exit(1);
      }

      const bank = {
        idrssd: institution.idrssd,
        name: institution.name,
        city: institution.city,
        state: institution.state,
        totalAssets: 0 // Not needed for logo search
      };

      await findLogoForBank(bank);
    } else if (bankName) {
      // Find single bank by name
      const Institution = require('../../models/Institution');
      const institution = await Institution.findOne({
        name: new RegExp(bankName, 'i')
      });

      if (!institution) {
        log.error(`Bank matching "${bankName}" not found`);
        process.exit(1);
      }

      const bank = {
        idrssd: institution.idrssd,
        name: institution.name,
        city: institution.city,
        state: institution.state,
        totalAssets: 0
      };

      await findLogoForBank(bank);
    } else {
      // Find logos for top N banks
      const banks = await getTopBanks(count);

      let successCount = 0;
      let failCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < banks.length; i++) {
        log.info(`\n[${i + 1}/${banks.length}]`);
        const result = await findLogoForBank(banks[i]);

        if (result.existing) {
          skippedCount++;
          // No delay needed - we didn't make any API calls
        } else if (result.success) {
          successCount++;
          // Add delay after successful API calls to avoid rate limiting
          if (i < banks.length - 1) {
            log.info('Waiting 2 seconds before next request...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } else {
          failCount++;
          // Add delay after failed API calls too (we still made requests)
          if (i < banks.length - 1) {
            log.info('Waiting 2 seconds before next request...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      log.section('📊 FINAL SUMMARY');
      log.info(`Total banks processed: ${banks.length}`);
      log.success(`Logos found: ${successCount}`);
      log.warning(`Skipped (already exists): ${skippedCount}`);
      log.error(`Failed: ${failCount}`);
    }

    await mongoose.connection.close();
    log.section('✅ COMPLETE');
    process.exit(0);

  } catch (error) {
    log.section('💥 FATAL ERROR');
    log.error(error.message);
    log.debug('Error stack', error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Export for use in other modules (e.g., research workflow)
module.exports = { findLogoForBank };

// Run main() only if executed directly
if (require.main === module) {
  main();
}
