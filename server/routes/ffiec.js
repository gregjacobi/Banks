const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const AdmZip = require('adm-zip');
const ffiecImportService = require('../services/ffiecImportService');

// Configure multer for zip file upload
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/ffiec');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `ffiec_${timestamp}_${file.originalname}`);
  }
});

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
 */
async function extractZipManually(zipPath, extractPath) {
  await fs.mkdir(extractPath, { recursive: true });

  const zip = new AdmZip(zipPath);
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

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    logs.push({ message: `Received file: ${req.file.originalname}`, type: 'info' });
    logs.push({ message: `File size: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`, type: 'info' });

    // Extract zip file with manual extraction to avoid AdmZip truncation issues
    logs.push({ message: 'Extracting ZIP file...', type: 'info' });
    const zipPath = req.file.path;
    extractPath = path.join(path.dirname(zipPath), `extract_${Date.now()}`);

    await extractZipManually(zipPath, extractPath);

    const extractedFiles = await fs.readdir(extractPath);
    logs.push({ message: `✓ Extracted ${extractedFiles.length} files`, type: 'success' });

    // Find required files using shared service
    logs.push({ message: 'Locating required data files...', type: 'info' });
    const files = await ffiecImportService.findRequiredFiles(extractPath);

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

    // Clean up temporary extraction
    logs.push({ message: 'Cleaning up temporary files...', type: 'info' });
    await fs.rm(extractPath, { recursive: true, force: true });

    // Copy ZIP to data directory for future re-imports
    const dataDir = path.join(__dirname, '../../data');
    await fs.mkdir(dataDir, { recursive: true });
    const archiveZipPath = path.join(dataDir, req.file.originalname);
    await fs.copyFile(zipPath, archiveZipPath);
    await fs.unlink(zipPath);

    logs.push({ message: `✓ ZIP file archived to: data/${req.file.originalname}`, type: 'success' });
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
