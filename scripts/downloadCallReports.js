const https = require('https');
const fs = require('fs');
const path = require('path');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream');
const { promisify } = require('util');
const zlib = require('zlib');

const streamPipeline = promisify(pipeline);

/**
 * Download and extract Call Report data from FFIEC
 * Downloads quarterly data from 2020 Q1 to present
 * Usage: node scripts/downloadCallReports.js
 */

// Generate quarters from 2020 Q1 to present
function generateQuarters() {
  const quarters = [];
  const startYear = 2020;
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);

  for (let year = startYear; year <= currentYear; year++) {
    const maxQuarter = (year === currentYear) ? currentQuarter : 4;
    for (let quarter = 1; quarter <= maxQuarter; quarter++) {
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

// Download a file from HTTPS
async function downloadFile(url, destinationPath) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destinationPath);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        return downloadFile(response.headers.location, destinationPath)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destinationPath, () => {});
      reject(err);
    });
  });
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

async function downloadQuarterlyData() {
  const dataDir = path.join(__dirname, '..', 'data');

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const quarters = generateQuarters();
  console.log(`\n📅 Downloading ${quarters.length} quarters of data from ${quarters[0].label} to ${quarters[quarters.length-1].label}...\n`);

  for (const quarter of quarters) {
    const { dateStr, label } = quarter;
    const url = `https://cdr.ffiec.gov/public/PWS/DownloadBulkData.aspx?RequestType=BULKDOWNLOAD&ID=FFIEC%20CDR%20Call%20Bulk%20All%20Schedules%20${dateStr}`;
    const zipFileName = `FFIEC_CDR_Call_Bulk_All_Schedules_${dateStr}.zip`;
    const zipPath = path.join(dataDir, zipFileName);
    const extractPath = path.join(dataDir, `FFIEC CDR Call Bulk All Schedules ${dateStr}`);

    // Skip if already downloaded and extracted
    if (fs.existsSync(extractPath)) {
      console.log(`✓ ${label} - Already downloaded and extracted`);
      continue;
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
  downloadQuarterlyData()
    .then(() => {
      console.log('🎉 All quarterly data downloaded successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Download failed:', error);
      process.exit(1);
    });
}

module.exports = downloadQuarterlyData;
