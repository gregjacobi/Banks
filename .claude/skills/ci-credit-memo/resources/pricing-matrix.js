#!/usr/bin/env node

/**
 * Pricing Matrix Calculator for C&I Loans
 *
 * This script takes risk rating and loan amount (and optional overrides) and generates
 * a complete set of inputs for the RAROC calculator based on bank-specific assumptions.
 *
 * Usage:
 *   Interactive: node pricing-matrix.js
 *   CLI: node pricing-matrix.js --risk-rating 5 --loan-amount 5000000
 *   Generate RAROC command: node pricing-matrix.js --risk-rating 5 --loan-amount 5000000 --output-command
 */

const readline = require('readline');

// ============================================================================
// BANK ASSUMPTIONS (from BANK_ASSUMPTIONS.md)
// ============================================================================

const BANK_ASSUMPTIONS = {
  // Funding costs
  fundingCost: 4.50, // %

  // Deposit economics
  depositCost: 0.50, // %
  depositReinvestmentRate: 4.50, // %

  // Operating cost by loan size (basis points)
  operatingCostBps: {
    under1M: 100,
    from1Mto5M: 75,
    from5Mto10M: 50,
    over10M: 50
  },

  // Origination fee % by risk rating
  originationFeePct: {
    1: 0.50, 2: 0.50, 3: 0.50,
    4: 0.75, 5: 0.75, 6: 0.75,
    7: 1.00, 8: 1.00,
    9: 1.50, 10: 1.50
  },

  // Annual fees by loan size
  annualFees: {
    under1M: 1000,
    under5M: 2500,
    over5M: 5000
  },

  // Treasury management fees (default)
  defaultTreasuryFees: 15000,

  // Other fee income (default conservative)
  defaultOtherFees: 5000,

  // Target spread over funding cost (bps) by risk rating
  targetSpreadBps: {
    1: 200, 2: 225, 3: 225,
    4: 250, 5: 275, 6: 300,
    7: 350, 8: 400,
    9: 500, 10: 600
  },

  // LGD defaults by collateral type
  lgdByCollateral: {
    'cash': 0.10,
    'ar-investment-grade': 0.25,
    'ar-standard': 0.35,
    'inventory-finished': 0.40,
    'inventory-raw': 0.50,
    'equipment-general': 0.45,
    'equipment-specialized': 0.55,
    'real-estate-owner-occupied': 0.30,
    'real-estate-investment': 0.35,
    'unsecured': 0.60,
    'subordinated': 0.75,
    // Common defaults
    'senior-secured-strong': 0.30,
    'senior-secured-standard': 0.40,
    'senior-unsecured': 0.55
  }
};

// Hurdle rates by risk rating (from RAROC_METHODOLOGY.md)
const HURDLE_RATES = {
  1: 12, 2: 12, 3: 12,
  4: 15, 5: 15, 6: 15,
  7: 18, 8: 18,
  9: 20, 10: 20
};

// ============================================================================
// PRICING MATRIX CALCULATOR
// ============================================================================

class PricingMatrix {
  constructor(inputs) {
    this.inputs = inputs;
    this.results = {};
  }

  calculate() {
    this.validateInputs();
    this.calculateOperatingCosts();
    this.calculateFees();
    this.calculateInterestRate();
    this.determineCollateralLGD();
    this.calculateRelationshipDefaults();
    this.buildRAROCCommand();
    return this.results;
  }

  validateInputs() {
    const { riskRating, loanAmount } = this.inputs;

    if (!riskRating || riskRating < 1 || riskRating > 10) {
      throw new Error('Risk rating must be between 1 and 10');
    }

    if (!loanAmount || loanAmount <= 0) {
      throw new Error('Loan amount must be greater than 0');
    }
  }

  calculateOperatingCosts() {
    const { loanAmount } = this.inputs;
    let bps;

    if (loanAmount < 1000000) {
      bps = BANK_ASSUMPTIONS.operatingCostBps.under1M;
    } else if (loanAmount < 5000000) {
      bps = BANK_ASSUMPTIONS.operatingCostBps.from1Mto5M;
    } else if (loanAmount < 10000000) {
      bps = BANK_ASSUMPTIONS.operatingCostBps.from5Mto10M;
    } else {
      bps = BANK_ASSUMPTIONS.operatingCostBps.over10M;
    }

    this.results.operatingCostBps = this.inputs.operatingCostBps || bps;
  }

  calculateFees() {
    const { riskRating, loanAmount } = this.inputs;

    // Origination fee
    const originationFeePct = this.inputs.originationFeePct ||
                              BANK_ASSUMPTIONS.originationFeePct[riskRating];
    this.results.originationFeePct = originationFeePct;
    this.results.originationFeeAmount = loanAmount * (originationFeePct / 100);

    // Annual fees
    let annualFees;
    if (loanAmount < 1000000) {
      annualFees = BANK_ASSUMPTIONS.annualFees.under1M;
    } else if (loanAmount < 5000000) {
      annualFees = BANK_ASSUMPTIONS.annualFees.under5M;
    } else {
      annualFees = BANK_ASSUMPTIONS.annualFees.over5M;
    }
    this.results.annualFees = this.inputs.annualFees || annualFees;
  }

  calculateInterestRate() {
    const { riskRating } = this.inputs;

    if (this.inputs.interestRate) {
      this.results.interestRate = this.inputs.interestRate;
      this.results.interestRateSource = 'User Override';
    } else {
      const targetSpreadBps = BANK_ASSUMPTIONS.targetSpreadBps[riskRating];
      const fundingCost = BANK_ASSUMPTIONS.fundingCost;
      const targetRate = fundingCost + (targetSpreadBps / 100);

      this.results.interestRate = targetRate;
      this.results.interestRateSource = 'Calculated from Target Spread';
      this.results.targetSpreadBps = targetSpreadBps;
    }
  }

  determineCollateralLGD() {
    const { collateralType } = this.inputs;

    if (this.inputs.lgd !== undefined) {
      this.results.lgd = this.inputs.lgd;
      this.results.lgdSource = 'User Override';
    } else if (collateralType && BANK_ASSUMPTIONS.lgdByCollateral[collateralType]) {
      this.results.lgd = BANK_ASSUMPTIONS.lgdByCollateral[collateralType];
      this.results.lgdSource = `Default for ${collateralType}`;
    } else {
      // Default to senior secured standard
      this.results.lgd = 0.40;
      this.results.lgdSource = 'Default (senior secured standard)';
    }
  }

  calculateRelationshipDefaults() {
    const { loanAmount } = this.inputs;

    // Average deposits - default to 30-40% of loan amount for middle market
    this.results.avgDeposits = this.inputs.avgDeposits || (loanAmount * 0.35);

    // Deposit costs
    this.results.depositCost = this.inputs.depositCost || BANK_ASSUMPTIONS.depositCost;
    this.results.depositReinvestmentRate = this.inputs.depositReinvestmentRate ||
                                           BANK_ASSUMPTIONS.depositReinvestmentRate;

    // Treasury management fees
    this.results.treasuryFees = this.inputs.treasuryFees ||
                                BANK_ASSUMPTIONS.defaultTreasuryFees;

    // Other fees
    this.results.otherFees = this.inputs.otherFees ||
                             BANK_ASSUMPTIONS.defaultOtherFees;
  }

  buildRAROCCommand() {
    const { loanAmount, riskRating } = this.inputs;
    const r = this.results;

    this.results.rarocCommand = `node resources/raroc-calculator.js \\
  --loan-amount ${loanAmount} \\
  --interest-rate ${r.interestRate.toFixed(2)} \\
  --risk-rating ${riskRating} \\
  --lgd ${r.lgd.toFixed(2)} \\
  --funding-cost ${BANK_ASSUMPTIONS.fundingCost.toFixed(2)} \\
  --operating-cost-bps ${r.operatingCostBps} \\
  --origination-fee-pct ${r.originationFeePct.toFixed(2)} \\
  --annual-fees ${Math.round(r.annualFees)} \\
  --avg-deposits ${Math.round(r.avgDeposits)} \\
  --deposit-cost ${r.depositCost.toFixed(2)} \\
  --deposit-reinvestment-rate ${r.depositReinvestmentRate.toFixed(2)} \\
  --treasury-mgmt-fees ${Math.round(r.treasuryFees)} \\
  --other-fees ${Math.round(r.otherFees)}`;
  }

  generateReport() {
    const { loanAmount, riskRating, borrowerName } = this.inputs;
    const r = this.results;

    const report = `
═══════════════════════════════════════════════════════════
           PRICING MATRIX - RAROC INPUT BUILDER
═══════════════════════════════════════════════════════════

${borrowerName ? `BORROWER: ${borrowerName}\n` : ''}LOAN DETAILS:
  Loan Amount:              $${loanAmount.toLocaleString()}
  Risk Rating:              ${riskRating}
  Hurdle Rate:              ${HURDLE_RATES[riskRating]}%

PRICING INPUTS (Generated):
─────────────────────────────────────────────────────────

Interest Rate:            ${r.interestRate.toFixed(2)}%
  Source: ${r.interestRateSource}
  ${r.targetSpreadBps ? `Target Spread: ${r.targetSpreadBps} bps over funding cost` : ''}
  Funding Cost: ${BANK_ASSUMPTIONS.fundingCost}%

Collateral LGD:           ${(r.lgd * 100).toFixed(0)}%
  Source: ${r.lgdSource}

Operating Costs:          ${r.operatingCostBps} bps
  Annual Dollar Amount: $${Math.round(loanAmount * (r.operatingCostBps / 10000)).toLocaleString()}

FEES:
  Origination Fee:        ${r.originationFeePct}% = $${Math.round(r.originationFeeAmount).toLocaleString()}
  Annual Fees:            $${r.annualFees.toLocaleString()}

RELATIONSHIP VALUE (Assumed):
  Average Deposits:       $${Math.round(r.avgDeposits).toLocaleString()}
    (${((r.avgDeposits / loanAmount) * 100).toFixed(0)}% of loan amount)
  Deposit Cost:           ${r.depositCost}%
  Reinvestment Rate:      ${r.depositReinvestmentRate}%
  Treasury Mgmt Fees:     $${r.treasuryFees.toLocaleString()}
  Other Fee Income:       $${r.otherFees.toLocaleString()}

─────────────────────────────────────────────────────────
RAROC CALCULATOR COMMAND:
─────────────────────────────────────────────────────────

${r.rarocCommand}

─────────────────────────────────────────────────────────
USAGE NOTES:
─────────────────────────────────────────────────────────

1. Review all generated inputs for reasonableness
2. Adjust based on specific deal characteristics:
   - Interest rate: May need adjustment for market conditions
   - Deposits: Replace default with actual committed amounts
   - LGD: Adjust for specific collateral package
   - Fees: Adjust based on competitive factors

3. Run the RAROC calculator command above to get pricing analysis

4. If RAROC is below hurdle:
   - Increase interest rate
   - Reduce loan amount
   - Increase fees
   - Document relationship value to justify exception

═══════════════════════════════════════════════════════════
`;

    return report;
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

function parseCommandLineArgs() {
  const args = process.argv.slice(2);
  const inputs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      case '--risk-rating':
        inputs.riskRating = parseInt(nextArg);
        i++;
        break;
      case '--loan-amount':
        inputs.loanAmount = parseFloat(nextArg);
        i++;
        break;
      case '--borrower-name':
        inputs.borrowerName = nextArg;
        i++;
        break;
      case '--interest-rate':
        inputs.interestRate = parseFloat(nextArg);
        i++;
        break;
      case '--collateral-type':
        inputs.collateralType = nextArg;
        i++;
        break;
      case '--lgd':
        inputs.lgd = parseFloat(nextArg);
        i++;
        break;
      case '--avg-deposits':
        inputs.avgDeposits = parseFloat(nextArg);
        i++;
        break;
      case '--treasury-fees':
        inputs.treasuryFees = parseFloat(nextArg);
        i++;
        break;
      case '--other-fees':
        inputs.otherFees = parseFloat(nextArg);
        i++;
        break;
      case '--origination-fee-pct':
        inputs.originationFeePct = parseFloat(nextArg);
        i++;
        break;
      case '--annual-fees':
        inputs.annualFees = parseFloat(nextArg);
        i++;
        break;
      case '--operating-cost-bps':
        inputs.operatingCostBps = parseFloat(nextArg);
        i++;
        break;
      case '--output-command':
        inputs.outputCommandOnly = true;
        break;
      case '--json':
        inputs.jsonOutput = true;
        break;
    }
  }

  return inputs;
}

function showHelp() {
  console.log(`
Pricing Matrix Calculator - RAROC Input Builder

This tool generates a complete set of pricing inputs for the RAROC calculator
based on risk rating, loan amount, and bank-specific assumptions.

USAGE:
  Interactive Mode:
    node pricing-matrix.js

  Command Line Mode:
    node pricing-matrix.js --risk-rating 5 --loan-amount 5000000

  Generate RAROC Command Only:
    node pricing-matrix.js --risk-rating 5 --loan-amount 5000000 --output-command

REQUIRED PARAMETERS:
  --risk-rating [1-10]      Internal risk rating
  --loan-amount [dollars]   Loan amount

OPTIONAL PARAMETERS:
  --borrower-name [name]           Borrower name for report
  --interest-rate [%]              Override calculated rate
  --collateral-type [type]         Collateral type for LGD lookup
  --lgd [0-1]                      Override calculated LGD
  --avg-deposits [dollars]         Expected average deposits
  --treasury-fees [dollars]        Expected treasury mgmt fees
  --other-fees [dollars]           Other expected fee income
  --origination-fee-pct [%]        Override origination fee %
  --annual-fees [dollars]          Override annual fees
  --operating-cost-bps [bps]       Override operating cost allocation

OUTPUT OPTIONS:
  --output-command                 Output only the RAROC command (for piping)
  --json                          Output results as JSON

COLLATERAL TYPES (for LGD lookup):
  cash, ar-investment-grade, ar-standard, inventory-finished, inventory-raw,
  equipment-general, equipment-specialized, real-estate-owner-occupied,
  real-estate-investment, unsecured, subordinated,
  senior-secured-strong, senior-secured-standard, senior-unsecured

EXAMPLES:

  1. Basic usage:
     node pricing-matrix.js --risk-rating 5 --loan-amount 5000000

  2. With specific collateral:
     node pricing-matrix.js --risk-rating 5 --loan-amount 5000000 \\
       --collateral-type ar-standard

  3. With relationship overrides:
     node pricing-matrix.js --risk-rating 5 --loan-amount 5000000 \\
       --avg-deposits 2500000 --treasury-fees 25000

  4. Generate RAROC command only (for scripts):
     node pricing-matrix.js --risk-rating 5 --loan-amount 5000000 \\
       --output-command

  5. Override interest rate (competitive match):
     node pricing-matrix.js --risk-rating 5 --loan-amount 5000000 \\
       --interest-rate 6.50

NOTES:
  - All pricing inputs are based on bank assumptions in BANK_ASSUMPTIONS.md
  - Generated inputs should be reviewed and adjusted for deal specifics
  - Use --output-command to pipe directly to RAROC calculator
  - Relationship assumptions are defaults - replace with actual commitments
`);
}

async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('     PRICING MATRIX - RAROC INPUT BUILDER');
  console.log('═══════════════════════════════════════════════════════════\n');

  const inputs = {};

  inputs.borrowerName = await question('Borrower name (optional): ');
  inputs.loanAmount = parseFloat(await question('Loan amount ($): '));
  inputs.riskRating = parseInt(await question('Risk rating (1-10): '));

  console.log('\nOptional overrides (press Enter to use defaults):');

  const interestRate = await question('Interest rate (% or Enter for calculated): ');
  if (interestRate) inputs.interestRate = parseFloat(interestRate);

  console.log('\nAvailable collateral types:');
  console.log('  senior-secured-strong, senior-secured-standard, senior-unsecured');
  console.log('  ar-standard, equipment-general, real-estate-owner-occupied, etc.');
  const collateralType = await question('Collateral type (or Enter for default): ');
  if (collateralType) inputs.collateralType = collateralType;

  const avgDeposits = await question('Expected avg deposits ($ or Enter for default): ');
  if (avgDeposits) inputs.avgDeposits = parseFloat(avgDeposits);

  const treasuryFees = await question('Expected treasury fees ($ or Enter for default): ');
  if (treasuryFees) inputs.treasuryFees = parseFloat(treasuryFees);

  rl.close();

  return inputs;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    let inputs;

    // Check if command-line args provided
    const cliInputs = parseCommandLineArgs();

    if (cliInputs.riskRating && cliInputs.loanAmount) {
      // Use CLI inputs
      inputs = cliInputs;
    } else if (process.argv.length > 2) {
      // Args provided but missing required fields
      console.error('❌ Error: Missing required parameters');
      console.error('Run with --help for usage information\n');
      showHelp();
      process.exit(1);
    } else {
      // Interactive mode
      inputs = await interactiveMode();
    }

    // Calculate pricing matrix
    const matrix = new PricingMatrix(inputs);
    const results = matrix.calculate();

    // Output based on format requested
    if (inputs.outputCommandOnly) {
      console.log(results.rarocCommand);
    } else if (inputs.jsonOutput) {
      console.log(JSON.stringify({ inputs, results }, null, 2));
    } else {
      console.log(matrix.generateReport());
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { PricingMatrix, BANK_ASSUMPTIONS };
