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
    // Determine if bank uses RCFD (consolidated) or RCON (domestic)
    const useRCFD = bankData.RCFD2170 && bankData.RCFD2170 > 0;
    const prefix = useRCFD ? 'RCFD' : 'RCON';

    return {
      assets: {
        earningAssets: {
          loansAndLeases: {
            net: bankData[`${prefix}B528`] || 0,
            netOfAllowance: bankData[`${prefix}B529`] || 0,
            heldForSale: bankData[`${prefix}5369`] || 0,
            portfolio: this.transformLoanPortfolio(bankData, prefix)
          },
          securities: {
            availableForSale: bankData[`${prefix}1773`] || 0,
            heldToMaturity: bankData[`${prefix}JJ34`] || 0,
            equity: bankData[`${prefix}JA22`] || 0
          },
          interestBearingBankBalances: bankData[`${prefix}0071`] || 0,
          fedFundsSoldAndRepos: bankData[`${prefix}B989`] || 0
        },
        nonearningAssets: {
          cashAndDueFromBanks: bankData[`${prefix}0081`] || 0,
          premisesAndFixedAssets: bankData[`${prefix}2145`] || 0,
          intangibleAssets: bankData[`${prefix}2143`] || 0,
          otherRealEstate: bankData[`${prefix}2150`] || 0,
          otherAssets: bankData[`${prefix}2160`] || 0
        },
        totalAssets: bankData[`${prefix}2170`] || 0
      },
      liabilities: {
        deposits: {
          total: bankData[`${prefix}2200`] || 0,
          nonInterestBearing: bankData[`${prefix}6631`] || 0,
          interestBearing: bankData[`${prefix}6636`] || 0
        },
        borrowings: {
          fedFundsPurchasedAndRepos: bankData[`${prefix}B993`] || 0,
          otherBorrowedMoney: bankData[`${prefix}3190`] || 0,
          subordinatedDebt: bankData[`${prefix}3200`] || 0
        },
        otherLiabilities: bankData[`${prefix}2930`] || 0,
        totalLiabilities: bankData[`${prefix}2948`] || 0
      },
      equity: {
        commonStock: bankData[`${prefix}3230`] || 0,
        surplus: bankData[`${prefix}3839`] || 0,
        retainedEarnings: bankData[`${prefix}3632`] || 0,
        accumulatedOCI: bankData[`${prefix}B530`] || 0,
        totalEquity: bankData[`${prefix}3210`] || 0
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
    return {
      realEstate: {
        constructionAndLandDevelopment: {
          total: bankData[`${prefix}2746`] || 0,
          residential1To4Family: bankData[`${prefix}F158`] || 0,
          otherConstructionAndLandDevelopment: bankData[`${prefix}F159`] || 0
        },
        securedBy1To4Family: {
          revolvingOpenEnd: bankData[`${prefix}1797`] || 0,
          closedEndFirstLiens: bankData[`${prefix}5367`] || 0,
          closedEndJuniorLiens: bankData[`${prefix}5368`] || 0
        },
        multifamily: bankData[`${prefix}1460`] || 0,
        nonfarmNonresidential: {
          ownerOccupied: bankData[`${prefix}F160`] || 0,
          otherNonfarmNonresidential: bankData[`${prefix}F161`] || 0
        },
        farmland: bankData[`${prefix}1420`] || 0
      },
      commercialAndIndustrial: {
        usAddressees: bankData[`${prefix}1763`] || 0,
        nonUsAddressees: bankData[`${prefix}1764`] || 0
      },
      consumer: {
        creditCards: bankData[`${prefix}B537`] || 0,
        automobileLoans: bankData[`${prefix}K137`] || 0,
        otherRevolvingCredit: bankData[`${prefix}B538`] || 0,
        otherConsumerLoans: bankData[`${prefix}B539`] || 0
      },
      other: {
        agriculturalProduction: bankData[`${prefix}1590`] || 0,
        toDepositoryInstitutions: bankData[`${prefix}1288`] || 0,
        loansToForeignGovernments: bankData[`${prefix}2081`] || 0,
        municipalLoans: bankData[`${prefix}2107`] || 0,
        loansToOtherDepositoryUS: bankData[`${prefix}B534`] || 0,
        loansToBanksForeign: bankData[`${prefix}B535`] || 0,
        allOtherLoans: bankData[`${prefix}A570`] || 0
      },
      leaseFinancingReceivables: {
        consumerLeases: bankData[`${prefix}F162`] || 0,
        allOtherLeases: bankData[`${prefix}F163`] || 0
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
   * @returns {Object} Calculated ratios
   */
  calculateRatios(balanceSheet, incomeStatement) {
    const ratios = {};

    // Efficiency Ratio = (Noninterest Expense / (Net Interest Income + Noninterest Income)) × 100
    const revenue = incomeStatement.netInterestIncome + incomeStatement.noninterestIncome.total;
    if (revenue > 0) {
      ratios.efficiencyRatio = (incomeStatement.noninterestExpense.total / revenue) * 100;
    }

    // Return on Assets (ROA) = (Net Income / Total Assets) × 100
    if (balanceSheet.assets.totalAssets > 0) {
      ratios.roa = (incomeStatement.netIncome / balanceSheet.assets.totalAssets) * 100;
    }

    // Return on Equity (ROE) = (Net Income / Total Equity) × 100
    if (balanceSheet.equity.totalEquity > 0) {
      ratios.roe = (incomeStatement.netIncome / balanceSheet.equity.totalEquity) * 100;
    }

    // Net Interest Margin (NIM) = (Net Interest Income / Earning Assets) × 100
    // Approximate earning assets as sum of loans, securities, and interest-bearing balances
    const earningAssets =
      balanceSheet.assets.earningAssets.loansAndLeases.net +
      balanceSheet.assets.earningAssets.securities.availableForSale +
      balanceSheet.assets.earningAssets.securities.heldToMaturity +
      balanceSheet.assets.earningAssets.interestBearingBankBalances +
      balanceSheet.assets.earningAssets.fedFundsSoldAndRepos;

    if (earningAssets > 0) {
      ratios.netInterestMargin = (incomeStatement.netInterestIncome / earningAssets) * 100;
    }

    // Tier 1 Leverage Ratio = (Tier 1 Capital / Total Assets) × 100
    // Approximation: use Total Equity as proxy for Tier 1 Capital
    if (balanceSheet.assets.totalAssets > 0) {
      ratios.tier1LeverageRatio = (balanceSheet.equity.totalEquity / balanceSheet.assets.totalAssets) * 100;
    }

    // Note: Operating Leverage (QoQ) will be calculated separately when comparing periods

    return ratios;
  }
}

module.exports = CallReportParser;
