const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const AdmZip = require('adm-zip');
const CallReportParser = require('../utils/callReportParser');
const Institution = require('../models/Institution');
const FinancialStatement = require('../models/FinancialStatement');

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
 * Extract reporting period from filename
 * Expected format: "FFIEC CDR Call Bulk All Schedules 06302025.zip"
 * or files inside: "FFIEC CDR Call Schedule RC 06302025.txt"
 */
function extractReportingPeriod(filename) {
  const match = filename.match(/(\d{8})/);
  if (match) {
    const dateStr = match[1];
    const month = dateStr.substring(0, 2);
    const day = dateStr.substring(2, 4);
    const year = dateStr.substring(4, 8);
    return new Date(`${year}-${month}-${day}`);
  }
  return null;
}

/**
 * Find all required files in the extracted directory
 */
async function findRequiredFiles(extractPath) {
  const files = await fs.readdir(extractPath);

  const requiredFiles = {
    por: null,
    rc: null,
    rcci: null,
    ri: null
  };

  for (const file of files) {
    const lowerFile = file.toLowerCase();
    if (lowerFile.includes('por') && lowerFile.endsWith('.txt')) {
      requiredFiles.por = path.join(extractPath, file);
    } else if (lowerFile.includes('schedule rc.txt') || (lowerFile.includes('schedule rc ') && !lowerFile.includes('rcci') && lowerFile.endsWith('.txt'))) {
      requiredFiles.rc = path.join(extractPath, file);
    } else if (lowerFile.includes('rcci') && lowerFile.endsWith('.txt')) {
      requiredFiles.rcci = path.join(extractPath, file);
    } else if (lowerFile.includes('schedule ri') && lowerFile.endsWith('.txt')) {
      requiredFiles.ri = path.join(extractPath, file);
    }
  }

  return requiredFiles;
}

/**
 * Process FFIEC data import
 */
async function processFFIECImport(files, reportingPeriod, logs) {
  const parser = new CallReportParser();

  logs.push({ message: 'Parsing Schedule POR (Bank Information)...', type: 'info' });
  const porData = await parser.parseSchedule(files.por);
  logs.push({ message: `✓ Found ${porData.banks.length} banks`, type: 'success' });

  logs.push({ message: 'Parsing Schedule RC (Balance Sheet)...', type: 'info' });
  const rcData = await parser.parseSchedule(files.rc);
  logs.push({ message: `✓ Parsed ${rcData.banks.length} balance sheets`, type: 'success' });

  logs.push({ message: 'Parsing Schedule RCCI (Loan Detail)...', type: 'info' });
  const rcciData = await parser.parseSchedule(files.rcci);
  logs.push({ message: `✓ Parsed ${rcciData.banks.length} loan portfolios`, type: 'success' });

  logs.push({ message: 'Parsing Schedule RI (Income Statement)...', type: 'info' });
  const riData = await parser.parseSchedule(files.ri);
  logs.push({ message: `✓ Parsed ${riData.banks.length} income statements`, type: 'success' });

  // Create lookup maps by IDRSSD
  const rcMap = new Map(rcData.banks.map(b => [b.IDRSSD, b]));
  const rcciMap = new Map(rcciData.banks.map(b => [b.IDRSSD, b]));
  const riMap = new Map(riData.banks.map(b => [b.IDRSSD, b]));

  logs.push({ message: 'Importing data to MongoDB...', type: 'info' });
  let institutionsCreated = 0;
  let financialStatementsCreated = 0;
  let validationErrors = 0;

  for (const bank of porData.banks) {
    const idrssd = bank.IDRSSD;

    // Create/update institution
    await Institution.findOneAndUpdate(
      { idrssd },
      {
        idrssd,
        name: bank['Financial Institution Name'],
        fdicCert: bank['FDIC Certificate Number'],
        occCharter: bank['OCC Charter Number'],
        abaRouting: bank['Primary ABA Routing Number'],
        address: bank['Financial Institution Address'],
        city: bank['Financial Institution City'],
        state: bank['Financial Institution State'],
        zipCode: bank['Financial Institution Zip Code'],
        filingType: bank['Financial Institution Filing Type'],
        lastUpdated: new Date(bank['Last Date/Time Submission Updated On'])
      },
      { upsert: true, new: true }
    );
    institutionsCreated++;

    // Get corresponding balance sheet, loan detail, and income statement data
    const rcBank = rcMap.get(idrssd);
    const rcciBank = rcciMap.get(idrssd);
    const riBank = riMap.get(idrssd);

    if (rcBank && riBank) {
      // Merge RC and RCCI data for complete balance sheet
      const mergedData = { ...rcBank, ...rcciBank };

      // Transform data
      const balanceSheet = parser.transformBalanceSheet(mergedData);
      const incomeStatement = parser.transformIncomeStatement(riBank);

      // Calculate ratios
      const ratios = parser.calculateRatios(balanceSheet, incomeStatement, reportingPeriod);

      // Validate
      const bsValidation = parser.validateBalanceSheet(balanceSheet);
      const isValidation = parser.validateIncomeStatement(incomeStatement);

      const errors = [];
      if (!bsValidation.isValid) {
        errors.push(`Balance sheet doesn't balance: Assets=${bsValidation.assets}, Liab+Equity=${bsValidation.liabilitiesAndEquity}`);
        validationErrors++;
      }
      if (!isValidation.isValid) {
        errors.push(`Income statement NII mismatch: Calculated=${isValidation.calculated}, Reported=${isValidation.reported}`);
      }

      // Create financial statement
      await FinancialStatement.findOneAndUpdate(
        { idrssd, reportingPeriod },
        {
          idrssd,
          reportingPeriod,
          balanceSheet,
          incomeStatement,
          ratios,
          validation: {
            balanceSheetValid: bsValidation.isValid,
            incomeStatementValid: isValidation.isValid,
            errors
          }
        },
        { upsert: true, new: true }
      );
      financialStatementsCreated++;
    }

    // Progress indicator
    if (institutionsCreated % 500 === 0) {
      logs.push({ message: `  Processed ${institutionsCreated} banks...`, type: 'info' });
    }
  }

  logs.push({ message: `Import Complete!`, type: 'success' });
  logs.push({ message: `   Institutions: ${institutionsCreated}`, type: 'success' });
  logs.push({ message: `   Financial Statements: ${financialStatementsCreated}`, type: 'success' });
  logs.push({ message: `   Validation Errors: ${validationErrors}`, type: validationErrors > 0 ? 'warning' : 'success' });

  // Create search indexes
  logs.push({ message: 'Creating search indexes...', type: 'info' });
  await Institution.createIndexes();
  await FinancialStatement.createIndexes();
  logs.push({ message: '✓ Indexes created', type: 'success' });

  return {
    institutionsCreated,
    financialStatementsCreated,
    validationErrors,
    reportingPeriod
  };
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

    // Extract zip file
    logs.push({ message: 'Extracting ZIP file...', type: 'info' });
    const zipPath = req.file.path;
    extractPath = path.join(path.dirname(zipPath), `extract_${Date.now()}`);

    await fs.mkdir(extractPath, { recursive: true });

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);

    const extractedFiles = await fs.readdir(extractPath);
    logs.push({ message: `✓ Extracted ${extractedFiles.length} files`, type: 'success' });

    // Find required files
    logs.push({ message: 'Locating required data files...', type: 'info' });
    const files = await findRequiredFiles(extractPath);

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

    // Extract reporting period from filename
    const reportingPeriod = extractReportingPeriod(req.file.originalname) ||
                           extractReportingPeriod(extractedFiles[0]) ||
                           new Date(); // fallback to current date

    logs.push({
      message: `Reporting Period: ${reportingPeriod.toISOString().split('T')[0]}`,
      type: 'info'
    });

    // Process the import
    const result = await processFFIECImport(files, reportingPeriod, logs);

    // Clean up
    logs.push({ message: 'Cleaning up temporary files...', type: 'info' });
    await fs.rm(extractPath, { recursive: true, force: true });
    await fs.unlink(zipPath);
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
