const CallReportParser = require('../utils/callReportParser');
const Institution = require('../models/Institution');
const FinancialStatement = require('../models/FinancialStatement');

/**
 * Shared FFIEC data import service
 * Used by both the upload route and command-line scripts
 */
class FFIECImportService {

  /**
   * Process FFIEC data import from extracted files
   * @param {Object} files - Object with paths to por, rc, rcci, ri files
   * @param {Date} reportingPeriod - The reporting period date
   * @param {Function} logFn - Optional logging function (message, type)
   * @returns {Promise<Object>} Import results
   */
  async processImport(files, reportingPeriod, logFn = null) {
    const log = (message, type = 'info') => {
      if (logFn) logFn(message, type);
      else if (type === 'error') console.error(message);
      else console.log(message);
    };

    const parser = new CallReportParser();

    log('Parsing Schedule POR (Bank Information)...', 'info');
    const porData = await parser.parseSchedule(files.por);
    log(`✓ Found ${porData.banks.length} banks`, 'success');

    log('Parsing Schedule RC (Balance Sheet)...', 'info');
    const rcData = await parser.parseSchedule(files.rc);
    log(`✓ Parsed ${rcData.banks.length} balance sheets`, 'success');

    log('Parsing Schedule RCCI (Loan Detail)...', 'info');
    const rcciData = await parser.parseSchedule(files.rcci);
    log(`✓ Parsed ${rcciData.banks.length} loan portfolios`, 'success');

    log('Parsing Schedule RI (Income Statement)...', 'info');
    const riData = await parser.parseSchedule(files.ri);
    log(`✓ Parsed ${riData.banks.length} income statements`, 'success');

    // Parse Schedule RC-M (Memoranda) if available - contains website URL
    let rcmData = null;
    let rcmMap = null;
    if (files.rcm) {
      try {
        log('Parsing Schedule RC-M (Memoranda - contains website URLs)...', 'info');
        rcmData = await parser.parseSchedule(files.rcm);
        log(`✓ Parsed ${rcmData.banks.length} memoranda records with website URLs`, 'success');
        rcmMap = new Map(rcmData.banks.map(b => [b.IDRSSD, b]));
      } catch (error) {
        log(`⚠ Could not parse RC-M schedule: ${error.message}`, 'warning');
      }
    } else {
      log('⚠ RC-M schedule not found in data files', 'warning');
    }

    // Parse Schedule RC-N (Past Due and Nonaccrual) if available
    let rcnData = null;
    let rcnMap = null;
    if (files.rcn) {
      try {
        log('Parsing Schedule RC-N (Past Due and Nonaccrual Loans)...', 'info');
        rcnData = await parser.parseSchedule(files.rcn);
        log(`✓ Parsed ${rcnData.banks.length} credit quality records`, 'success');
        rcnMap = new Map(rcnData.banks.map(b => [b.IDRSSD, b]));
      } catch (error) {
        log(`⚠ Could not parse RC-N schedule: ${error.message}`, 'warning');
      }
    } else {
      log('⚠ RC-N schedule not found - credit quality data will not be imported', 'warning');
    }

    // Parse Schedule RI-B (Charge-offs and Recoveries) if available
    let ribData = null;
    let ribMap = null;
    if (files.rib) {
      try {
        log('Parsing Schedule RI-B (Charge-offs and Recoveries)...', 'info');
        ribData = await parser.parseSchedule(files.rib);
        log(`✓ Parsed ${ribData.banks.length} charge-off records`, 'success');
        ribMap = new Map(ribData.banks.map(b => [b.IDRSSD, b]));
      } catch (error) {
        log(`⚠ Could not parse RI-B schedule: ${error.message}`, 'warning');
      }
    } else {
      log('⚠ RI-B schedule not found - charge-off data will not be imported', 'warning');
    }

    // Create lookup maps by IDRSSD
    const rcMap = new Map(rcData.banks.map(b => [b.IDRSSD, b]));
    const rcciMap = new Map(rcciData.banks.map(b => [b.IDRSSD, b]));
    const riMap = new Map(riData.banks.map(b => [b.IDRSSD, b]));

    log('Importing data to MongoDB...', 'info');
    let institutionsCreated = 0;
    let financialStatementsCreated = 0;
    let validationErrors = 0;

    for (const bank of porData.banks) {
      const idrssd = bank.IDRSSD;

      // Get website URL from RC-M schedule if available
      let websiteUrl = null;
      if (rcmMap) {
        const rcmBank = rcmMap.get(idrssd);
        if (rcmBank) {
          // TEXT4087 is the website URL field in RC-M schedule
          websiteUrl = rcmBank.TEXT4087 || null;

          // Clean up website URL if found
          if (websiteUrl && typeof websiteUrl === 'string') {
            websiteUrl = websiteUrl.trim();
            // Ensure it has a protocol
            if (websiteUrl && !websiteUrl.startsWith('http')) {
              websiteUrl = `https://${websiteUrl}`;
            }
          }
        }
      }

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
          lastUpdated: new Date(bank['Last Date/Time Submission Updated On']),
          ...(websiteUrl && { website: websiteUrl })  // Only add if we found a website
        },
        { upsert: true, new: true }
      );
      institutionsCreated++;

      // Get corresponding balance sheet, loan detail, and income statement data
      const rcBank = rcMap.get(idrssd);
      const rcciBank = rcciMap.get(idrssd);
      const riBank = riMap.get(idrssd);
      const rcnBank = rcnMap ? rcnMap.get(idrssd) : null;
      const ribBank = ribMap ? ribMap.get(idrssd) : null;

      if (rcBank && riBank) {
        // Merge RC and RCCI data for complete balance sheet
        const mergedData = { ...rcBank, ...rcciBank };

        // Determine prefix (RCFD for consolidated, RCON for domestic only)
        const useRCFD = rcBank.RCFD2170 && rcBank.RCFD2170 > 0;
        const prefix = useRCFD ? 'RCFD' : 'RCON';

        // Transform data
        const balanceSheet = parser.transformBalanceSheet(mergedData);
        const incomeStatement = parser.transformIncomeStatement(riBank);

        // Calculate ratios
        const ratios = parser.calculateRatios(balanceSheet, incomeStatement, reportingPeriod);

        // Get validation totals
        const validationTotals = parser.getValidationTotals(mergedData, prefix);

        // Get categorized loan totals
        const loanCategories = parser.getCategorizedLoanTotals(balanceSheet.assets.earningAssets.loansAndLeases.portfolio);

        // Transform credit quality data if available
        let creditQuality = null;
        if (rcnBank) {
          const mergedCreditData = { ...rcBank, ...rcnBank };
          creditQuality = parser.transformCreditQuality(mergedCreditData, prefix);
        }

        // Transform charge-off data if available
        let chargeOffsAndRecoveries = null;
        if (ribBank) {
          const mergedChargeOffData = { ...riBank, ...ribBank };
          chargeOffsAndRecoveries = parser.transformChargeOffsAndRecoveries(mergedChargeOffData);
        }

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

        // Create financial statement with all data
        const statementData = {
          idrssd,
          reportingPeriod,
          balanceSheet,
          incomeStatement,
          ratios,
          validationTotals,
          loanCategories,
          validation: {
            balanceSheetValid: bsValidation.isValid,
            incomeStatementValid: isValidation.isValid,
            errors
          }
        };

        // Add credit quality if available
        if (creditQuality) {
          statementData.creditQuality = creditQuality;
        }

        // Add charge-offs if available
        if (chargeOffsAndRecoveries) {
          statementData.chargeOffsAndRecoveries = chargeOffsAndRecoveries;
        }

        await FinancialStatement.findOneAndUpdate(
          { idrssd, reportingPeriod },
          statementData,
          { upsert: true, new: true }
        );
        financialStatementsCreated++;
      }

      // Progress indicator
      if (institutionsCreated % 500 === 0) {
        log(`  Processed ${institutionsCreated} banks...`, 'info');
      }
    }

    log('Import Complete!', 'success');
    log(`   Institutions: ${institutionsCreated}`, 'success');
    log(`   Financial Statements: ${financialStatementsCreated}`, 'success');
    log(`   Validation Errors: ${validationErrors}`, validationErrors > 0 ? 'warning' : 'success');

    // Create search indexes
    log('Creating search indexes...', 'info');
    await Institution.createIndexes();
    await FinancialStatement.createIndexes();
    log('✓ Indexes created', 'success');

    return {
      institutionsCreated,
      financialStatementsCreated,
      validationErrors,
      reportingPeriod
    };
  }

  /**
   * Find all required files in the extracted directory
   * @param {string} extractPath - Path to extracted directory
   * @returns {Promise<Object>} Object with paths to required files
   */
  async findRequiredFiles(extractPath) {
    const fs = require('fs').promises;
    const path = require('path');

    const files = await fs.readdir(extractPath);

    const requiredFiles = {
      por: null,
      rc: null,
      rcci: null,
      ri: null,
      rcm: null,  // Memoranda schedule (contains website URL)
      rcn: null,  // Past Due and Nonaccrual schedule (credit quality)
      rib: null   // Charge-offs and Recoveries schedule
    };

    for (const file of files) {
      const lowerFile = file.toLowerCase();
      if (lowerFile.includes('por') && lowerFile.endsWith('.txt')) {
        requiredFiles.por = path.join(extractPath, file);
      } else if (lowerFile.includes('schedule rc.txt') || (lowerFile.includes('schedule rc ') && !lowerFile.includes('rcci') && !lowerFile.includes('rcm') && !lowerFile.includes('rcn') && lowerFile.endsWith('.txt'))) {
        requiredFiles.rc = path.join(extractPath, file);
      } else if (lowerFile.includes('rcci') && lowerFile.endsWith('.txt')) {
        requiredFiles.rcci = path.join(extractPath, file);
      } else if (lowerFile.includes('schedule ri.') && lowerFile.endsWith('.txt') && !lowerFile.includes('rib')) {
        requiredFiles.ri = path.join(extractPath, file);
      } else if (lowerFile.includes('rcm') && lowerFile.endsWith('.txt')) {
        requiredFiles.rcm = path.join(extractPath, file);
      } else if ((lowerFile.includes('rcn') || lowerFile.includes('rc-n')) && lowerFile.endsWith('.txt') && !requiredFiles.rcn) {
        // RCN may be split into multiple parts - take first one found
        requiredFiles.rcn = path.join(extractPath, file);
      } else if ((lowerFile.includes('ribi') || lowerFile.includes('ri-b')) && lowerFile.endsWith('.txt') && !requiredFiles.rib) {
        // RIB is named RIBI (Part I) and RIBII (Part II) - take RIBI
        requiredFiles.rib = path.join(extractPath, file);
      }
    }

    return requiredFiles;
  }

  /**
   * Extract reporting period from filename
   * @param {string} filename - Filename to parse
   * @returns {Date|null} Extracted date or null
   */
  extractReportingPeriod(filename) {
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
}

module.exports = new FFIECImportService();
