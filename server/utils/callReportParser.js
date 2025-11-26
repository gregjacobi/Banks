const fs = require('fs');
const readline = require('readline');
const { CREDIT_QUALITY_MAPPINGS, VALIDATION_TOTALS, calculateCategorizedTotals } = require('./loanCategories');

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
    // Read entire file at once to avoid line buffering issues
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split(/\r?\n/);

    let fieldCodes = [];
    let fieldDescriptions = [];
    const banks = [];

    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber];
      if (!line.trim()) continue; // Skip empty lines

      const fields = line.split('\t');

      if (lineNumber === 0) {
        // First row: MDRM field codes
        fieldCodes = fields;
        // DEBUG: Log header parsing
        if (!this._headerDebugLogged) {
          this._headerDebugLogged = true;
          console.error('🔍 HEADER DEBUG - Raw line length:', line.length);
          console.error('🔍 HEADER DEBUG - Line starts with:', line.substring(0, 100));
          console.error('🔍 HEADER DEBUG - Line ends with:', line.substring(line.length - 50));
          console.error('🔍 HEADER DEBUG - Tab count in line:', (line.match(/\t/g) || []).length);
          console.error('🔍 HEADER DEBUG - Fields parsed:', fields.length);
          console.error('🔍 HEADER DEBUG - First 10 fields:', fields.slice(0, 10));
        }
      } else if (lineNumber === 1) {
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
   * Transform Schedule RC-N (Past Due and Nonaccrual Loans) to structured format
   * @param {Object} bankData - Raw bank data including RC-N fields
   * @param {String} prefix - RCFD or RCON prefix
   * @returns {Object} Structured credit quality data
   */
  transformCreditQuality(bankData, prefix) {
    // Helper function to get value with fallback across prefixes
    const getValue = (code) => {
      return bankData[`${prefix}${code}`] ||
             bankData[`RCON${code}`] ||
             bankData[`RCFD${code}`] ||
             bankData[`RCFN${code}`] || 0;
    };

    return {
      // Past Due 30-89 Days (still accruing)
      pastDue30to89: {
        realEstate: {
          construction: getValue('2759'),
          residential1to4Family: getValue('5398'),
          multifamily: getValue('3499'),
          cre: getValue('3500'),
          farmland: getValue('3501'),
          total: getValue('2759') + getValue('5398') + getValue('3499') + getValue('3500') + getValue('3501')
        },
        ci: getValue('1607'),
        consumer: {
          total: getValue('1609'),
          creditCards: getValue('K129'),
          autoLoans: getValue('K205'),
          other: getValue('K206')
        },
        agricultural: getValue('1594'),
        leases: getValue('1611'),
        other: getValue('1613'),
        grandTotal: getValue('1406') // Total past due 30-89
      },

      // Past Due 90+ Days (still accruing)
      pastDue90Plus: {
        realEstate: {
          construction: getValue('2769'),
          residential1to4Family: getValue('5399'),
          multifamily: getValue('3502'),
          cre: getValue('3503'),
          farmland: getValue('3504'),
          total: getValue('2769') + getValue('5399') + getValue('3502') + getValue('3503') + getValue('3504')
        },
        ci: getValue('1608'),
        consumer: {
          total: getValue('1610'),
          creditCards: getValue('K130'),
          autoLoans: getValue('K207'),
          other: getValue('K208')
        },
        agricultural: getValue('1597'),
        leases: getValue('1612'),
        other: getValue('1614'),
        grandTotal: getValue('1407') // Total past due 90+
      },

      // Nonaccrual Loans
      nonaccrual: {
        realEstate: {
          construction: getValue('3505'),
          residential1to4Family: getValue('3506'),
          multifamily: getValue('3507'),
          cre: getValue('3508'),
          farmland: getValue('3509'),
          total: getValue('3505') + getValue('3506') + getValue('3507') + getValue('3508') + getValue('3509')
        },
        ci: getValue('1227'),
        consumer: {
          total: getValue('1228'),
          creditCards: getValue('K131'),
          autoLoans: getValue('K209'),
          other: getValue('K210')
        },
        agricultural: getValue('1583'),
        leases: getValue('1229'),
        other: getValue('1230'),
        grandTotal: getValue('1403') // Total nonaccrual
      },

      // Summary metrics
      summary: {
        totalPastDue30to89: getValue('1406'),
        totalPastDue90Plus: getValue('1407'),
        totalNonaccrual: getValue('1403'),
        totalNonperforming: getValue('1403') + getValue('1407'), // Nonaccrual + 90+ days past due
        totalPastDueAndNonaccrual: getValue('1406') + getValue('1407') + getValue('1403')
      }
    };
  }

  /**
   * Transform Charge-off and Recovery data from Schedule RI-B
   * @param {Object} bankData - Raw bank data including RI-B fields
   * @returns {Object} Structured charge-off data
   */
  transformChargeOffsAndRecoveries(bankData) {
    // Helper function to get value from RIAD prefix (year-to-date income data)
    const getValue = (code) => {
      return bankData[`RIAD${code}`] || 0;
    };

    return {
      chargeOffs: {
        total: getValue('4635'),
        realEstate: getValue('4651'),
        ci: getValue('4645'),
        consumer: {
          total: getValue('4648'),
          creditCards: getValue('C891'),
          autoLoans: getValue('C234'),
          other: getValue('C235')
        },
        agricultural: getValue('4655'),
        leases: getValue('4658')
      },
      recoveries: {
        total: getValue('4605'),
        realEstate: getValue('4661'),
        ci: getValue('4617'),
        consumer: {
          total: getValue('4628'),
          creditCards: getValue('C893'),
          autoLoans: getValue('C236'),
          other: getValue('C237')
        },
        agricultural: getValue('4665'),
        leases: getValue('4668')
      },
      netChargeOffs: {
        total: getValue('4635') - getValue('4605'),
        realEstate: getValue('4651') - getValue('4661'),
        ci: getValue('4645') - getValue('4617'),
        consumer: getValue('4648') - getValue('4628'),
        agricultural: getValue('4655') - getValue('4665'),
        leases: getValue('4658') - getValue('4668')
      }
    };
  }

  /**
   * Get validation totals for loan portfolio
   * @param {Object} bankData - Raw bank data
   * @param {String} prefix - RCFD or RCON prefix
   * @returns {Object} Validation totals for comparing calculated vs reported
   */
  getValidationTotals(bankData, prefix) {
    const getValue = (code) => {
      return bankData[`${prefix}${code}`] ||
             bankData[`RCON${code}`] ||
             bankData[`RCFD${code}`] ||
             bankData[`RCFN${code}`] || 0;
    };

    return {
      totalRealEstateLoans: getValue('1410'),
      totalLoansGross: getValue('B528'),
      totalLoansNet: getValue('2122'),
      allowanceForLosses: getValue('3123')
    };
  }

  /**
   * Get categorized loan totals using the new categorization system
   * @param {Object} portfolio - The loan portfolio data from transformLoanPortfolio
   * @returns {Object} Categorized totals with consumer/business breakdown
   */
  getCategorizedLoanTotals(portfolio) {
    return calculateCategorizedTotals(portfolio);
  }

  /**
   * Transform Schedule RI (Income Statement) to UBPR structure
   * @param {Object} bankData - Raw bank data from Schedule RI
   * @returns {Object} Structured income statement
   */
  transformIncomeStatement(bankData) {
    // DEBUG - log once
    if (!this._debugLogged) {
      this._debugLogged = true;
      const keys = Object.keys(bankData);
      console.error('\n🔍 ========== DEBUG transformIncomeStatement ==========');
      console.error('🔍 IDRSSD:', bankData.IDRSSD);
      console.error('🔍 Total keys:', keys.length);
      console.error('🔍 Sample keys (first 20):', keys.slice(0, 20));
      console.error('🔍 Keys starting with RIAD:', keys.filter(k => k.startsWith('RIAD')).slice(0, 10));
      console.error('🔍 RIAD4340 (net income):', bankData['RIAD4340']);
      console.error('🔍 ==================================================\n');
    }

    // Helper function to get value from RIAD prefix
    // RIAD = Year-to-date income data (calendar year-to-date)
    const getValue = (code) => {
      return bankData[`RIAD${code}`] || 0;
    };

    return {
      interestIncome: {
        loans: getValue('4010'),
        securities: getValue('4060'),
        fedFunds: getValue('4020'),
        other: getValue('5415'),
        total: getValue('4107')
      },
      interestExpense: {
        deposits: getValue('4170'),
        borrowings: getValue('4180'),
        subordinatedDebt: getValue('4200'),
        total: getValue('4073')
      },
      netInterestIncome: getValue('4074'),
      provisionForCreditLosses: getValue('JJ33'),
      noninterestIncome: {
        serviceFees: getValue('4080'),
        tradingRevenue: getValue('A220'),
        investmentBanking: getValue('C888'),
        otherNoninterestIncome: getValue('B497'),
        total: getValue('4079')
      },
      noninterestExpense: {
        salariesAndBenefits: getValue('4135'),
        premisesExpense: getValue('4217'),
        other: getValue('4092'),
        total: getValue('4093')
      },
      incomeBeforeTaxes: getValue('4301'),
      applicableTaxes: getValue('4302'),
      netIncome: getValue('4340'),
      fullTimeEquivalentEmployees: getValue('4150')
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
