const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream');
const { promisify } = require('util');
const zlib = require('zlib');
const cheerio = require('cheerio');
const axios = require('axios');
const AdmZip = require('adm-zip');

const streamPipeline = promisify(pipeline);

/**
 * Download and extract Call Report data from FFIEC
 * Usage:
 *   node scripts/downloadCallReports.js                    # Downloads from 2020-Q1 to present
 *   node scripts/downloadCallReports.js 2023-01-01         # Downloads from 2023-Q1 to present
 *   node scripts/downloadCallReports.js 2023-01-01 2024-12-31  # Downloads from 2023-Q1 to 2024-Q4
 *
 * Date format: YYYY-MM-DD or YYYY-Q1, YYYY-Q2, YYYY-Q3, YYYY-Q4
 */

/**
 * Parse date string into year and quarter
 * Supports formats:
 *   - YYYY-MM-DD (e.g., "2023-03-15" -> 2023 Q1)
 *   - YYYY-QN (e.g., "2023-Q1" -> 2023 Q1)
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  // Handle YYYY-QN format
  const quarterMatch = dateStr.match(/^(\d{4})-Q([1-4])$/i);
  if (quarterMatch) {
    return {
      year: parseInt(quarterMatch[1]),
      quarter: parseInt(quarterMatch[2])
    };
  }

  // Handle YYYY-MM-DD format
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    const year = parseInt(dateMatch[1]);
    const month = parseInt(dateMatch[2]);
    const quarter = Math.ceil(month / 3);
    return { year, quarter };
  }

  throw new Error(`Invalid date format: ${dateStr}. Use YYYY-MM-DD or YYYY-Q1 format`);
}

/**
 * Generate quarters between start and end dates
 * @param {string} startDateStr - Start date (YYYY-MM-DD or YYYY-QN)
 * @param {string} endDateStr - End date (YYYY-MM-DD or YYYY-QN)
 */
function generateQuarters(startDateStr = null, endDateStr = null) {
  const quarters = [];

  // Parse start date or default to 2020 Q1
  let startYear, startQuarter;
  if (startDateStr) {
    const parsed = parseDate(startDateStr);
    startYear = parsed.year;
    startQuarter = parsed.quarter;
  } else {
    startYear = 2020;
    startQuarter = 1;
  }

  // Parse end date or default to current quarter
  let endYear, endQuarter;
  if (endDateStr) {
    const parsed = parseDate(endDateStr);
    endYear = parsed.year;
    endQuarter = parsed.quarter;
  } else {
    const currentDate = new Date();
    endYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    endQuarter = Math.ceil(currentMonth / 3);
  }

  // Validate date range
  if (startYear > endYear || (startYear === endYear && startQuarter > endQuarter)) {
    throw new Error('Start date must be before or equal to end date');
  }

  // Generate quarters in range
  for (let year = startYear; year <= endYear; year++) {
    const firstQuarter = (year === startYear) ? startQuarter : 1;
    const lastQuarter = (year === endYear) ? endQuarter : 4;

    for (let quarter = firstQuarter; quarter <= lastQuarter; quarter++) {
      const month = quarter * 3;
      const lastDay = new Date(year, month, 0).getDate();
      const dateStr = `${month.toString().padStart(2, '0')}${lastDay}${year}`;
      quarters.push({
        year,
        quarter,
        dateStr,
        label: `${year} Q${quarter}`
      });
    }
  }

  return quarters;
}

// Fetch HTML page to extract form fields
async function fetchFormPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        if (response.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`Failed to fetch form: ${response.statusCode} ${response.statusMessage}`));
        }
      });
    }).on('error', reject);
  });
}

// Parse ASP.NET form fields from HTML
function parseFormFields(html) {
  const $ = cheerio.load(html);
  const fields = {};

  // Extract all hidden input fields (VIEWSTATE, VIEWSTATEGENERATOR, etc.)
  $('input[type="hidden"]').each((i, elem) => {
    const name = $(elem).attr('name');
    const value = $(elem).attr('value') || '';
    if (name) {
      fields[name] = value;
    }
  });

  // Add product selection (Call Reports -- Single Period)
  fields['ctl00$MainContentHolder$ListBox1'] = 'ReportingSeriesSinglePeriod';

  // Add format selection (TSV - Tab Delimited)
  fields['ctl00$MainContentHolder$FormatType'] = 'TSVRadioButton';

  // Add the Download button click
  fields['ctl00$MainContentHolder$TabStrip1$Download_0'] = 'Download';

  return fields;
}

// Submit form to download file
async function submitFormAndDownload(url, formFields, destinationPath) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    // Build POST data
    const postData = Object.keys(formFields)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(formFields[key])}`)
      .join('&');

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    };

    const file = createWriteStream(destinationPath);

    const req = https.request(options, (response) => {
      // Follow redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl.startsWith('http')) {
          // Relative redirect
          const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
          return submitFormAndDownload(baseUrl + redirectUrl, {}, destinationPath)
            .then(resolve)
            .catch(reject);
        } else {
          // Absolute redirect - for downloads, just GET the redirect URL
          return downloadFileDirect(redirectUrl, destinationPath)
            .then(resolve)
            .catch(reject);
        }
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(destinationPath, () => {});
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        file.close();
        fs.unlink(destinationPath, () => {});
        reject(err);
      });
    });

    req.on('error', (err) => {
      file.close();
      fs.unlink(destinationPath, () => {});
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// Direct download for redirected URLs
async function downloadFileDirect(url, destinationPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = createWriteStream(destinationPath);

    protocol.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close();
        fs.unlink(destinationPath, () => {});
        return downloadFileDirect(response.headers.location, destinationPath)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(destinationPath, () => {});
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        file.close();
        fs.unlink(destinationPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      file.close();
      fs.unlink(destinationPath, () => {});
      reject(err);
    });
  });
}

// Download a file from FFIEC (handles ASP.NET form submission)
async function downloadFile(url, destinationPath) {
  try {
    // Step 1: Fetch the form page
    const html = await fetchFormPage(url);

    // Step 2: Parse form fields
    const formFields = parseFormFields(html);

    // Step 3: Submit form to download file
    await submitFormAndDownload(url, formFields, destinationPath);
  } catch (error) {
    throw error;
  }
}

// Extract ZIP file using unzip command
async function extractZip(zipPath, extractPath) {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  // Create extraction directory if it doesn't exist
  if (!fs.existsSync(extractPath)) {
    fs.mkdirSync(extractPath, { recursive: true });
  }

  try {
    await execAsync(`unzip -o "${zipPath}" -d "${extractPath}"`);
  } catch (error) {
    throw new Error(`Failed to extract ${zipPath}: ${error.message}`);
  }
}

async function downloadQuarterlyData(startDate = null, endDate = null) {
  const dataDir = path.join(__dirname, '..', 'data');

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const quarters = generateQuarters(startDate, endDate);

  if (quarters.length === 0) {
    console.log('❌ No quarters to download for the specified date range.');
    return;
  }

  console.log(`\n📅 Downloading ${quarters.length} quarters of data from ${quarters[0].label} to ${quarters[quarters.length-1].label}...\n`);

  for (const quarter of quarters) {
    const { dateStr, label } = quarter;
    const url = `https://cdr.ffiec.gov/public/PWS/DownloadBulkData.aspx?RequestType=BULKDOWNLOAD&ID=FFIEC%20CDR%20Call%20Bulk%20All%20Schedules%20${dateStr}`;
    const zipFileName = `FFIEC_CDR_Call_Bulk_All_Schedules_${dateStr}.zip`;
    const zipPath = path.join(dataDir, zipFileName);
    const extractPath = path.join(dataDir, `FFIEC CDR Call Bulk All Schedules ${dateStr}`);

    // Skip if already downloaded and extracted (check for actual data files)
    if (fs.existsSync(extractPath)) {
      const files = fs.readdirSync(extractPath);
      if (files.length > 0) {
        console.log(`✓ ${label} - Already downloaded and extracted`);
        continue;
      } else {
        // Directory exists but is empty, remove it
        fs.rmdirSync(extractPath);
      }
    }

    try {
      // Download ZIP file
      console.log(`⬇️  ${label} - Downloading...`);
      await downloadFile(url, zipPath);
      console.log(`   ${label} - Downloaded (${(fs.statSync(zipPath).size / 1024 / 1024).toFixed(2)} MB)`);

      // Extract ZIP file
      console.log(`📦 ${label} - Extracting...`);
      await extractZip(zipPath, extractPath);
      console.log(`✓ ${label} - Extracted successfully`);

      // Clean up ZIP file
      fs.unlinkSync(zipPath);
      console.log(`   ${label} - Cleaned up ZIP file\n`);

    } catch (error) {
      console.error(`❌ ${label} - Error: ${error.message}\n`);
      // Continue with next quarter even if one fails
    }
  }

  console.log('✅ Download complete!\n');
}

// Run download
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const startDate = args[0] || null;
  const endDate = args[1] || null;

  // Display usage if help requested
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage:
  node scripts/downloadCallReports.js [START_DATE] [END_DATE]

Arguments:
  START_DATE  Optional. Start date in YYYY-MM-DD or YYYY-Q1 format. Defaults to 2020-Q1.
  END_DATE    Optional. End date in YYYY-MM-DD or YYYY-Q1 format. Defaults to current quarter.

Examples:
  node scripts/downloadCallReports.js                      # Download from 2020-Q1 to present
  node scripts/downloadCallReports.js 2023-Q1              # Download from 2023-Q1 to present
  node scripts/downloadCallReports.js 2023-01-01           # Download from 2023-Q1 to present
  node scripts/downloadCallReports.js 2023-Q1 2024-Q4      # Download from 2023-Q1 to 2024-Q4
  node scripts/downloadCallReports.js 2023-01-01 2024-12-31  # Download from 2023-Q1 to 2024-Q4

Date Formats:
  YYYY-MM-DD  Calendar date (e.g., 2023-03-15 means Q1 2023)
  YYYY-QN     Quarter format (e.g., 2023-Q1, 2024-Q4)
`);
    process.exit(0);
  }

  // Display date range
  if (startDate || endDate) {
    console.log(`\n📅 Date Range:`);
    if (startDate) console.log(`   Start: ${startDate}`);
    if (endDate) console.log(`   End: ${endDate}`);
  }

  downloadQuarterlyData(startDate, endDate)
    .then(() => {
      console.log('🎉 All quarterly data downloaded successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Download failed:', error.message);
      process.exit(1);
    });
}

module.exports = downloadQuarterlyData;
