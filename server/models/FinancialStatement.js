const mongoose = require('mongoose');

const financialStatementSchema = new mongoose.Schema({
  idrssd: {
    type: String,
    required: true,
    index: true
  },
  reportingPeriod: {
    type: Date,
    required: true,
    index: true
  },
  balanceSheet: {
    assets: {
      earningAssets: {
        loansAndLeases: {
          net: Number,
          netOfAllowance: Number,
          heldForSale: Number,
          portfolio: {
            realEstate: {
              constructionAndLandDevelopment: {
                total: Number,
                residential1To4Family: Number,
                otherConstructionAndLandDevelopment: Number
              },
              securedBy1To4Family: {
                revolvingOpenEnd: Number,
                closedEndFirstLiens: Number,
                closedEndJuniorLiens: Number
              },
              multifamily: Number,
              nonfarmNonresidential: {
                ownerOccupied: Number,
                otherNonfarmNonresidential: Number
              },
              farmland: Number
            },
            commercialAndIndustrial: {
              usAddressees: Number,
              nonUsAddressees: Number
            },
            consumer: {
              creditCards: Number,
              automobileLoans: Number,
              otherRevolvingCredit: Number,
              otherConsumerLoans: Number
            },
            other: {
              agriculturalProduction: Number,
              toDepositoryInstitutions: Number,
              loansToForeignGovernments: Number,
              municipalLoans: Number,
              loansToOtherDepositoryUS: Number,
              loansToBanksForeign: Number,
              allOtherLoans: Number
            },
            leaseFinancingReceivables: {
              consumerLeases: Number,
              allOtherLeases: Number
            }
          }
        },
        securities: {
          availableForSale: Number,
          heldToMaturity: Number,
          equity: Number
        },
        interestBearingBankBalances: Number,
        fedFundsSoldAndRepos: Number
      },
      nonearningAssets: {
        cashAndDueFromBanks: Number,
        premisesAndFixedAssets: Number,
        intangibleAssets: Number,
        otherRealEstate: Number,
        otherAssets: Number
      },
      totalAssets: {
        type: Number,
        required: true,
        index: true
      }
    },
    liabilities: {
      deposits: {
        total: Number,
        nonInterestBearing: Number,
        interestBearing: Number
      },
      borrowings: {
        fedFundsPurchasedAndRepos: Number,
        otherBorrowedMoney: Number,
        subordinatedDebt: Number
      },
      otherLiabilities: Number,
      totalLiabilities: Number
    },
    equity: {
      commonStock: Number,
      surplus: Number,
      retainedEarnings: Number,
      accumulatedOCI: Number,
      totalEquity: Number
    },
    dataSource: {
      type: String,
      enum: ['consolidated', 'domestic']
    }
  },
  incomeStatement: {
    interestIncome: {
      loans: Number,
      securities: Number,
      fedFunds: Number,
      other: Number,
      total: Number
    },
    interestExpense: {
      deposits: Number,
      borrowings: Number,
      subordinatedDebt: Number,
      total: Number
    },
    netInterestIncome: Number,
    provisionForCreditLosses: Number,
    noninterestIncome: {
      serviceFees: Number,
      tradingRevenue: Number,
      investmentBanking: Number,
      otherNoninterestIncome: Number,
      total: Number
    },
    noninterestExpense: {
      salariesAndBenefits: Number,
      premisesExpense: Number,
      other: Number,
      total: Number
    },
    incomeBeforeTaxes: Number,
    applicableTaxes: Number,
    netIncome: Number,
    fullTimeEquivalentEmployees: Number
  },
  validation: {
    balanceSheetValid: Boolean,
    incomeStatementValid: Boolean,
    errors: [String]
  },
  ratios: {
    efficiencyRatio: Number,        // (Noninterest Expense / (NII + Noninterest Income)) × 100
    roa: Number,                     // Return on Assets (Net Income / Avg Total Assets) × 100
    roe: Number,                     // Return on Equity (Net Income / Avg Equity) × 100
    netInterestMargin: Number,       // (NII / Avg Earning Assets) × 100
    tier1LeverageRatio: Number,      // (Tier 1 Capital / Total Assets) × 100
    operatingLeverage: Number        // % Revenue Growth / % Expense Growth (QoQ)
  },
  peerAnalysis: {
    peers: {
      count: Number,
      largerCount: Number,
      smallerCount: Number,
      peerIds: [String]  // Array of peer bank IDs
    },
    peerAverages: {
      totalAssets: Number,
      totalLoans: Number,
      totalDeposits: Number,
      totalEquity: Number,
      netIncome: Number,
      netInterestIncome: Number,
      noninterestIncome: Number,
      noninterestExpense: Number,
      roe: Number,
      roa: Number,
      nim: Number,
      efficiencyRatio: Number,
      operatingLeverage: Number
    },
    rankings: {
      totalAssets: {
        rank: Number,
        total: Number,
        percentile: Number,
        value: Number
      },
      totalLoans: {
        rank: Number,
        total: Number,
        percentile: Number,
        value: Number
      },
      totalDeposits: {
        rank: Number,
        total: Number,
        percentile: Number,
        value: Number
      },
      totalEquity: {
        rank: Number,
        total: Number,
        percentile: Number,
        value: Number
      },
      netIncome: {
        rank: Number,
        total: Number,
        percentile: Number,
        value: Number
      },
      netInterestIncome: {
        rank: Number,
        total: Number,
        percentile: Number,
        value: Number
      },
      noninterestIncome: {
        rank: Number,
        total: Number,
        percentile: Number,
        value: Number
      },
      noninterestExpense: {
        rank: Number,
        total: Number,
        percentile: Number,
        value: Number
      },
      roe: {
        rank: Number,
        total: Number,
        percentile: Number,
        value: Number
      },
      roa: {
        rank: Number,
        total: Number,
        percentile: Number,
        value: Number
      },
      nim: {
        rank: Number,
        total: Number,
        percentile: Number,
        value: Number
      },
      efficiencyRatio: {
        rank: Number,
        total: Number,
        percentile: Number,
        value: Number
      },
      operatingLeverage: {
        rank: Number,
        total: Number,
        percentile: Number,
        value: Number
      }
    },
    generatedAt: Date
  }
}, {
  timestamps: true
});

// Compound index for efficient time-series queries
financialStatementSchema.index({ idrssd: 1, reportingPeriod: -1 });

// Index for sorting by total assets
financialStatementSchema.index({ 'balanceSheet.assets.totalAssets': -1 });

module.exports = mongoose.model('FinancialStatement', financialStatementSchema);
