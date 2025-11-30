const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const AdmZip = require('adm-zip');
const ffiecImportService = require('../services/ffiecImportService');

// Configure multer for zip file upload (use memoryStorage for Heroku compatibility)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' ||
        file.mimetype === 'application/x-zip-compressed' ||
        file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'));
    }
  }
});

/**
 * Extract ZIP file using manual extraction (fixes AdmZip line truncation issues)
 * AdmZip's extractAllTo() has issues with very long lines in tab-delimited files
 * @param {Buffer} zipBuffer - ZIP file buffer from multer memoryStorage
 * @param {string} extractPath - Path to extract files to
 */
async function extractZipManually(zipBuffer, extractPath) {
  await fs.mkdir(extractPath, { recursive: true });

  const zip = new AdmZip(zipBuffer);
  const zipEntries = zip.getEntries();

  for (const entry of zipEntries) {
    if (entry.isDirectory) continue;

    // Extract file with proper buffer handling to preserve long lines
    const entryPath = path.join(extractPath, entry.entryName);
    const entryDir = path.dirname(entryPath);

    await fs.mkdir(entryDir, { recursive: true });

    // Get the raw buffer and write it directly (avoids encoding issues)
    const buffer = entry.getData();
    await fs.writeFile(entryPath, buffer);
  }

  return extractPath;
}

/**
 * POST /api/ffiec/upload
 * Upload and process FFIEC zip file
 */
router.post('/upload', upload.single('ffiecZip'), async (req, res) => {
  const logs = [];
  let extractPath = null;
  let tempZipPath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    logs.push({ message: `Received file: ${req.file.originalname}`, type: 'info' });
    logs.push({ message: `File size: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`, type: 'info' });

    // Extract zip file with manual extraction to avoid AdmZip truncation issues
    logs.push({ message: 'Extracting ZIP file...', type: 'info' });

    // Extract to /tmp directory (Heroku-compatible temporary processing)
    extractPath = path.join('/tmp', `ffiec_extract_${Date.now()}`);

    await extractZipManually(req.file.buffer, extractPath);

    const extractedFiles = await fs.readdir(extractPath);
    logs.push({ message: `✓ Extracted ${extractedFiles.length} files`, type: 'success' });

    // Log first 10 files for debugging
    logs.push({ message: 'First 10 extracted files:', type: 'info' });
    extractedFiles.slice(0, 10).forEach(file => {
      logs.push({ message: `  - ${file}`, type: 'info' });
    });

    // Find required files using shared service
    logs.push({ message: 'Locating required data files...', type: 'info' });
    const files = await ffiecImportService.findRequiredFiles(extractPath);

    // Log which files were found
    logs.push({ message: 'Files found:', type: 'info' });
    for (const [key, path] of Object.entries(files)) {
      if (path) {
        const filename = require('path').basename(path);
        logs.push({ message: `  ✓ ${key.toUpperCase()}: ${filename}`, type: 'success' });
      } else {
        logs.push({ message: `  ✗ ${key.toUpperCase()}: NOT FOUND`, type: 'warning' });
      }
    }

    const missingFiles = [];
    if (!files.por) missingFiles.push('POR (Bank Information)');
    if (!files.rc) missingFiles.push('RC (Balance Sheet)');
    if (!files.rcci) missingFiles.push('RCCI (Loan Detail)');
    if (!files.ri) missingFiles.push('RI (Income Statement)');

    if (missingFiles.length > 0) {
      logs.push({
        message: `Missing required files: ${missingFiles.join(', ')}`,
        type: 'error'
      });
      return res.status(400).json({
        error: `Missing required schedule files: ${missingFiles.join(', ')}`,
        logs
      });
    }

    logs.push({ message: '✓ All required files found', type: 'success' });

    // Extract reporting period from filename using shared service
    const reportingPeriod = ffiecImportService.extractReportingPeriod(req.file.originalname) ||
                           ffiecImportService.extractReportingPeriod(extractedFiles[0]) ||
                           new Date(); // fallback to current date

    logs.push({
      message: `Reporting Period: ${reportingPeriod.toISOString().split('T')[0]}`,
      type: 'info'
    });

    // Process the import using shared service
    const logFn = (message, type) => logs.push({ message, type });
    const result = await ffiecImportService.processImport(files, reportingPeriod, logFn);

    // Clean up temporary extraction directory
    logs.push({ message: 'Cleaning up temporary files...', type: 'info' });
    await fs.rm(extractPath, { recursive: true, force: true });

    logs.push({ message: '✓ Cleanup complete', type: 'success' });

    res.json({
      success: true,
      logs,
      result
    });

  } catch (error) {
    console.error('FFIEC upload error:', error);
    logs.push({
      message: `Error: ${error.message}`,
      type: 'error'
    });

    // Clean up on error
    if (extractPath) {
      try {
        await fs.rm(extractPath, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }

    res.status(500).json({
      error: error.message,
      logs
    });
  }
});

module.exports = router;
