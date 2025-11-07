const fs = require('fs');
const readline = require('readline');

/**
 * Parse tab-delimited Call Report files into structured JSON
 * Following UBPR structure for balance sheet and income statement
 */
class CallReportParser {

  /**
   * Parse a single schedule file (tab-delimited)
   * @param {string} filePath - Path to the schedule file
   * @returns {Promise<Array>} Array of bank data objects
   */
  async parseSchedule(filePath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let fieldCodes = [];
    let fieldDescriptions = [];
    const banks = [];
    let lineNumber = 0;

    for await (const line of rl) {
      lineNumber++;
      const fields = line.split('\t');

      if (lineNumber === 1) {
        // First row: MDRM field codes
        fieldCodes = fields;
      } else if (lineNumber === 2) {
        // Second row: Field descriptions
        fieldDescriptions = fields;
      } else {
        // Data rows: each bank
        const bankData = {};
        fields.forEach((value, index) => {
          const code = fieldCodes[index];
          if (code && code !== '""') {
            // Remove quotes from IDRSSD field
            const cleanCode = code.replace(/"/g, '');
            // Parse numeric values, keep empty strings as null
            bankData[cleanCode] = value === '' ? null : (isNaN(value) ? value : parseFloat(value));
          }
        });
        banks.push(bankData);
      }
    }

    return { fieldCodes, fieldDescriptions, banks };
  }

  /**
   * Transform Schedule RC (Balance Sheet) to UBPR structure
   * @param {Object} bankData - Raw bank data from Schedule RC and RCCI (loan detail)
   * @returns {Object} Structured balance sheet
   */
  transformBalanceSheet(bankData) {
    // Determine which prefix to use based on total assets reporting
    // RCFD = consolidated (foreign + domestic), RCON = domestic only, RCFN = foreign only
    const useRCFD = bankData.RCFD2170 && bankData.RCFD2170 > 0;
    const useRCFN = !useRCFD && bankData.RCFN2170 && bankData.RCFN2170 > 0;
    const prefix = useRCFD ? 'RCFD' : (useRCFN ? 'RCFN' : 'RCON');

    // Helper function to get value with fallback across prefixes
    // Some fields may only exist in certain prefix variants
    const getValue = (code) => {
      return bankData[`${prefix}${code}`] ||
             bankData[`RCON${code}`] ||
             bankData[`RCFD${code}`] ||
             bankData[`RCFN${code}`] || 0;
    };

    return {
      assets: {
        earningAssets: {
          loansAndLeases: {
            net: getValue('B528'),
            netOfAllowance: getValue('B529'),
            heldForSale: getValue('5369'),
            portfolio: this.transformLoanPortfolio(bankData, prefix)
          },
          securities: {
            availableForSale: getValue('1773'),
            heldToMaturity: getValue('JJ34'),
            equity: getValue('JA22')
          },
          interestBearingBankBalances: getValue('0071'),
          fedFundsSoldAndRepos: getValue('B989')
        },
        nonearningAssets: {
          cashAndDueFromBanks: getValue('0081'),
          premisesAndFixedAssets: getValue('2145'),
          intangibleAssets: getValue('2143'),
          otherRealEstate: getValue('2150'),
          otherAssets: getValue('2160')
        },
        totalAssets: getValue('2170')
      },
      liabilities: {
        deposits: {
          // For consolidated banks, total deposits = RCFN (foreign) + RCON (domestic)
          // Since RCFD2200 doesn't exist in Call Reports, we must add the components
          total: useRCFD
            ? (bankData.RCFN2200 || 0) + (bankData.RCON2200 || 0)
            : getValue('2200'),
          nonInterestBearing: useRCFD
            ? (bankData.RCFN6631 || 0) + (bankData.RCON6631 || 0)
            : getValue('6631'),
          interestBearing: useRCFD
            ? (bankData.RCFN6636 || 0) + (bankData.RCON6636 || 0)
            : getValue('6636')
        },
        borrowings: {
          fedFundsPurchasedAndRepos: getValue('B993'),
          otherBorrowedMoney: getValue('3190'),
          subordinatedDebt: getValue('3200')
        },
        otherLiabilities: getValue('2930'),
        totalLiabilities: getValue('2948')
      },
      equity: {
        commonStock: getValue('3230'),
        surplus: getValue('3839'),
        retainedEarnings: getValue('3632'),
        accumulatedOCI: getValue('B530'),
        totalEquity: getValue('3210')
      },
      dataSource: useRCFD ? 'consolidated' : 'domestic'
    };
  }

  /**
   * Transform Schedule RCCI (Loan Portfolio Detail) to structured format
   * @param {Object} bankData - Raw bank data including RCCI fields
   * @param {String} prefix - RCFD or RCON prefix
   * @returns {Object} Structured loan portfolio breakdown
   */
  transformLoanPortfolio(bankData, prefix) {
    // Helper function to get value with fallback across prefixes
    const getValue = (code) => {
      return bankData[`${prefix}${code}`] ||
             bankData[`RCON${code}`] ||
             bankData[`RCFD${code}`] ||
             bankData[`RCFN${code}`] || 0;
    };

    return {
      realEstate: {
        constructionAndLandDevelopment: {
          total: getValue('2746'),
          residential1To4Family: getValue('F158'),
          otherConstructionAndLandDevelopment: getValue('F159')
        },
        securedBy1To4Family: {
          revolvingOpenEnd: getValue('1797'),
          closedEndFirstLiens: getValue('5367'),
          closedEndJuniorLiens: getValue('5368')
        },
        multifamily: getValue('1460'),
        nonfarmNonresidential: {
          ownerOccupied: getValue('F160'),
          otherNonfarmNonresidential: getValue('F161')
        },
        farmland: getValue('1420')
      },
      commercialAndIndustrial: {
        usAddressees: getValue('1763'),
        nonUsAddressees: getValue('1764')
      },
      consumer: {
        creditCards: getValue('B537'),
        automobileLoans: getValue('K137'),
        otherRevolvingCredit: getValue('B538'),
        otherConsumerLoans: getValue('B539')
      },
      other: {
        agriculturalProduction: getValue('1590'),
        toDepositoryInstitutions: getValue('1288'),
        loansToForeignGovernments: getValue('2081'),
        municipalLoans: getValue('2107'),
        loansToOtherDepositoryUS: getValue('B534'),
        loansToBanksForeign: getValue('B535'),
        allOtherLoans: getValue('A570')
      },
      leaseFinancingReceivables: {
        consumerLeases: getValue('F162'),
        allOtherLeases: getValue('F163')
      }
    };
  }

  /**
   * Transform Schedule RI (Income Statement) to UBPR structure
   * @param {Object} bankData - Raw bank data from Schedule RI
   * @returns {Object} Structured income statement
   */
  transformIncomeStatement(bankData) {
    return {
      interestIncome: {
        loans: bankData.RIAD4010 || 0,
        securities: bankData.RIAD4060 || 0,
        fedFunds: bankData.RIAD4020 || 0,
        other: bankData.RIAD5415 || 0,
        total: bankData.RIAD4107 || 0
      },
      interestExpense: {
        deposits: bankData.RIAD4170 || 0,
        borrowings: bankData.RIAD4180 || 0,
        subordinatedDebt: bankData.RIAD4200 || 0,
        total: bankData.RIAD4073 || 0
      },
      netInterestIncome: bankData.RIAD4074 || 0,
      provisionForCreditLosses: bankData.RIADJJ33 || 0,
      noninterestIncome: {
        serviceFees: bankData.RIAD4080 || 0,
        tradingRevenue: bankData.RIADA220 || 0,
        investmentBanking: bankData.RIADC888 || 0,
        otherNoninterestIncome: bankData.RIADB497 || 0,
        total: bankData.RIAD4079 || 0
      },
      noninterestExpense: {
        salariesAndBenefits: bankData.RIAD4135 || 0,
        premisesExpense: bankData.RIAD4217 || 0,
        other: bankData.RIAD4092 || 0,
        total: bankData.RIAD4093 || 0
      },
      incomeBeforeTaxes: bankData.RIAD4301 || 0,
      applicableTaxes: bankData.RIAD4302 || 0,
      netIncome: bankData.RIAD4340 || 0,
      fullTimeEquivalentEmployees: bankData.RIAD4150 || 0
    };
  }

  /**
   * Validate balance sheet accounting equation
   * @param {Object} balanceSheet - Structured balance sheet
   * @returns {Object} Validation result
   */
  validateBalanceSheet(balanceSheet) {
    const assets = balanceSheet.assets.totalAssets;
    const liabilitiesAndEquity = balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity;
    const difference = Math.abs(assets - liabilitiesAndEquity);

    return {
      isValid: difference < 1, // Allow for rounding
      assets,
      liabilitiesAndEquity,
      difference
    };
  }

  /**
   * Validate income statement calculations
   * @param {Object} incomeStatement - Structured income statement
   * @returns {Object} Validation result
   */
  validateIncomeStatement(incomeStatement) {
    const calculatedNII = incomeStatement.interestIncome.total - incomeStatement.interestExpense.total;
    const reportedNII = incomeStatement.netInterestIncome;
    const difference = Math.abs(calculatedNII - reportedNII);

    return {
      isValid: difference < 1,
      calculated: calculatedNII,
      reported: reportedNII,
      difference
    };
  }

  /**
   * Calculate key financial ratios
   * @param {Object} balanceSheet - Structured balance sheet
   * @param {Object} incomeStatement - Structured income statement
   * @param {Date} reportingPeriod - Optional reporting period for proper annualization
   * @returns {Object} Calculated ratios
   */
  calculateRatios(balanceSheet, incomeStatement, reportingPeriod = null) {
    const ratios = {};

    // Efficiency Ratio = (Noninterest Expense / (Net Interest Income + Noninterest Income)) × 100
    const revenue = incomeStatement.netInterestIncome + incomeStatement.noninterestIncome.total;
    if (revenue > 0) {
      ratios.efficiencyRatio = (incomeStatement.noninterestExpense.total / revenue) * 100;
    }

    // Determine annualization factor based on reporting period
    let annualizationFactor = 1;
    if (reportingPeriod) {
      const month = reportingPeriod.getMonth();
      // Q1 (March 31): month = 2, factor = 4
      // Q2 (June 30): month = 5, factor = 2
      // Q3 (September 30): month = 8, factor = 4/3
      // Q4 (December 31): month = 11, factor = 1 (already annual)
      if (month === 2) {
        annualizationFactor = 4;
      } else if (month === 5) {
        annualizationFactor = 2;
      } else if (month === 8) {
        annualizationFactor = 4 / 3;
      }
    }

    // Annualize YTD income statement data
    const annualizedNetIncome = incomeStatement.netIncome * annualizationFactor;
    const annualizedNII = incomeStatement.netInterestIncome * annualizationFactor;

    // Return on Assets (ROA) = (Annualized Net Income / Total Assets) × 100
    if (balanceSheet.assets.totalAssets > 0) {
      ratios.roa = (annualizedNetIncome / balanceSheet.assets.totalAssets) * 100;
    }

    // Return on Equity (ROE) = (Annualized Net Income / Total Equity) × 100
    if (balanceSheet.equity.totalEquity > 0) {
      ratios.roe = (annualizedNetIncome / balanceSheet.equity.totalEquity) * 100;
    }

    // Net Interest Margin (NIM) = (Annualized Net Interest Income / Earning Assets) × 100
    // Earning assets include: loans, all securities (AFS, HTM, equity), interest-bearing deposits, and fed funds sold
    // NOTE: Uses point-in-time earning assets. For proper UBPR comparison, use average earning assets
    // (calculated in calculateDerivedMetrics.js which has access to previous period data)
    const earningAssets =
      balanceSheet.assets.earningAssets.loansAndLeases.net +
      balanceSheet.assets.earningAssets.securities.availableForSale +
      balanceSheet.assets.earningAssets.securities.heldToMaturity +
      balanceSheet.assets.earningAssets.securities.equity +
      balanceSheet.assets.earningAssets.interestBearingBankBalances +
      balanceSheet.assets.earningAssets.fedFundsSoldAndRepos;

    if (earningAssets > 0) {
      ratios.netInterestMargin = (annualizedNII / earningAssets) * 100;
    }

    // Tier 1 Leverage Ratio = (Tier 1 Capital / Total Assets) × 100
    // Approximation: use Total Equity as proxy for Tier 1 Capital
    if (balanceSheet.assets.totalAssets > 0) {
      ratios.tier1LeverageRatio = (balanceSheet.equity.totalEquity / balanceSheet.assets.totalAssets) * 100;
    }

    // Note: Operating Leverage (YoY) will be calculated separately when comparing periods

    return ratios;
  }
}

module.exports = CallReportParser;
