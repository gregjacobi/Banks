#!/usr/bin/env node

/**
 * RAROC Calculator for C&I Loan Pricing
 *
 * This deterministic calculator ensures consistent RAROC calculations
 * across all credit memos and analyst reviews.
 *
 * Usage:
 *   node raroc-calculator.js --loan-amount 5000000 --rate 6.25 --risk-rating 5 ...
 *
 * Or interactively:
 *   node raroc-calculator.js
 */

// ============================================================================
// BANK POLICY CONSTANTS
// ============================================================================

const BANK_COST_OF_EQUITY = 0.12; // 12%

const HURDLE_RATES = {
  1: 0.12, 2: 0.12, 3: 0.12,  // Minimal to Low Risk: 12%
  4: 0.15, 5: 0.15, 6: 0.15,  // Moderate Risk: 15%
  7: 0.18, 8: 0.18,            // Management Attention: 18%
  9: 0.20, 10: 0.20            // Special Mention: 20%
};

const PD_RANGES = {
  1: 0.0001, 2: 0.0005,        // 0.01-0.10%
  3: 0.0025, 4: 0.0025,        // 0.10-0.50%
  5: 0.0150, 6: 0.0150,        // 0.50-2.00%
  7: 0.0350, 8: 0.0350,        // 2.00-5.00%
  9: 0.1000, 10: 0.1000        // 5.00-15.00%
};

const ECONOMIC_CAPITAL_RATES = {
  1: 0.015, 2: 0.015,          // 1-2%
  3: 0.030, 4: 0.030,          // 2-4%
  5: 0.060, 6: 0.060,          // 4-8%
  7: 0.115, 8: 0.115,          // 8-15%
  9: 0.225, 10: 0.225          // 15-30%
};

// ============================================================================
// RAROC CALCULATOR CLASS
// ============================================================================

class RAROCCalculator {
  constructor(inputs) {
    this.inputs = inputs;
    this.results = {};
    this.validate();
  }

  validate() {
    const required = [
      'loanAmount', 'interestRate', 'riskRating',
      'lgd', 'fundingCost', 'operatingCostBps'
    ];

    for (const field of required) {
      if (this.inputs[field] === undefined || this.inputs[field] === null) {
        throw new Error(`Required field missing: ${field}`);
      }
    }

    if (this.inputs.riskRating < 1 || this.inputs.riskRating > 10) {
      throw new Error('Risk rating must be between 1 and 10');
    }

    if (this.inputs.lgd < 0 || this.inputs.lgd > 1) {
      throw new Error('LGD must be between 0 and 1 (e.g., 0.40 for 40%)');
    }
  }

  calculate() {
    this.calculateRiskParameters();
    this.calculateRevenue();
    this.calculateCosts();
    this.calculateRAROC();
    this.calculateRelationshipRAROC();
    this.performStressTests();

    return this.results;
  }

  calculateRiskParameters() {
    const { riskRating, loanAmount, lgd } = this.inputs;

    // Use provided PD or default from risk rating
    const pd = this.inputs.pd || PD_RANGES[riskRating];

    // Use provided economic capital rate or default from risk rating
    const ecRate = this.inputs.economicCapitalRate || ECONOMIC_CAPITAL_RATES[riskRating];

    const expectedLoss = pd * lgd * loanAmount;
    const economicCapital = ecRate * loanAmount;
    const hurdleRate = HURDLE_RATES[riskRating];

    this.results.riskParameters = {
      riskRating,
      probabilityOfDefault: pd,
      probabilityOfDefaultPct: (pd * 100).toFixed(2) + '%',
      lossGivenDefault: lgd,
      lossGivenDefaultPct: (lgd * 100).toFixed(0) + '%',
      exposureAtDefault: loanAmount,
      expectedLoss: Math.round(expectedLoss),
      expectedLossPct: ((expectedLoss / loanAmount) * 100).toFixed(2) + '%',
      economicCapital: Math.round(economicCapital),
      economicCapitalPct: (ecRate * 100).toFixed(1) + '%',
      hurdleRate: hurdleRate,
      hurdleRatePct: (hurdleRate * 100).toFixed(0) + '%'
    };
  }

  calculateRevenue() {
    const { loanAmount, interestRate, originationFeePct = 0, annualFees = 0 } = this.inputs;

    const interestIncome = loanAmount * (interestRate / 100);
    const originationFee = loanAmount * (originationFeePct / 100);
    const totalRevenue = interestIncome + originationFee + annualFees;

    this.results.revenue = {
      interestIncome: Math.round(interestIncome),
      interestRate: interestRate + '%',
      originationFee: Math.round(originationFee),
      originationFeePct: originationFeePct + '%',
      annualFees: annualFees,
      totalRevenue: Math.round(totalRevenue)
    };
  }

  calculateCosts() {
    const { loanAmount, fundingCost, operatingCostBps } = this.inputs;
    const { expectedLoss } = this.results.riskParameters;

    const fundingCostAmount = loanAmount * (fundingCost / 100);
    const operatingCosts = loanAmount * (operatingCostBps / 10000); // bps to decimal
    const totalCosts = fundingCostAmount + operatingCosts + expectedLoss;

    this.results.costs = {
      fundingCost: Math.round(fundingCostAmount),
      fundingCostPct: fundingCost + '%',
      operatingCosts: Math.round(operatingCosts),
      operatingCostsBps: operatingCostBps + ' bps',
      expectedLoss: expectedLoss,
      totalCosts: Math.round(totalCosts)
    };
  }

  calculateRAROC() {
    const { totalRevenue } = this.results.revenue;
    const { totalCosts } = this.results.costs;
    const { economicCapital, hurdleRate } = this.results.riskParameters;

    const netIncome = totalRevenue - totalCosts;
    const raroc = economicCapital > 0 ? netIncome / economicCapital : 0;
    const spreadToHurdle = raroc - hurdleRate;
    const meetsHurdle = raroc >= hurdleRate;

    this.results.standAlone = {
      netIncome: Math.round(netIncome),
      economicCapital: economicCapital,
      raroc: raroc,
      rarocPct: (raroc * 100).toFixed(1) + '%',
      hurdleRate: hurdleRate,
      hurdleRatePct: (hurdleRate * 100).toFixed(0) + '%',
      spreadToHurdle: spreadToHurdle,
      spreadToHurdlePct: (spreadToHurdle * 100).toFixed(1) + '%',
      meetsHurdle: meetsHurdle,
      assessment: meetsHurdle ? 'EXCEEDS HURDLE ✓' : 'BELOW HURDLE ⚠'
    };
  }

  calculateRelationshipRAROC() {
    const {
      avgDeposits = 0,
      depositReinvestmentRate = 0,
      depositCost = 0,
      treasuryMgmtFees = 0,
      wireTransferFees = 0,
      otherFees = 0
    } = this.inputs;

    const depositValue = avgDeposits * ((depositReinvestmentRate - depositCost) / 100);
    const totalFeeIncome = treasuryMgmtFees + wireTransferFees + otherFees;
    const totalRelationshipIncome = this.results.standAlone.netIncome + depositValue + totalFeeIncome;

    const { economicCapital, hurdleRate } = this.results.riskParameters;
    const relationshipRAROC = economicCapital > 0 ? totalRelationshipIncome / economicCapital : 0;
    const spreadToHurdle = relationshipRAROC - hurdleRate;
    const meetsHurdle = relationshipRAROC >= hurdleRate;

    this.results.relationship = {
      loanNetIncome: this.results.standAlone.netIncome,
      avgDeposits: avgDeposits,
      depositValue: Math.round(depositValue),
      depositValueCalc: `$${avgDeposits.toLocaleString()} × (${depositReinvestmentRate}% - ${depositCost}%)`,
      treasuryMgmtFees: treasuryMgmtFees,
      wireTransferFees: wireTransferFees,
      otherFees: otherFees,
      totalFeeIncome: totalFeeIncome,
      totalRelationshipIncome: Math.round(totalRelationshipIncome),
      economicCapital: economicCapital,
      relationshipRAROC: relationshipRAROC,
      relationshipRAROCPct: (relationshipRAROC * 100).toFixed(1) + '%',
      hurdleRate: hurdleRate,
      hurdleRatePct: (hurdleRate * 100).toFixed(0) + '%',
      spreadToHurdle: spreadToHurdle,
      spreadToHurdlePct: (spreadToHurdle * 100).toFixed(1) + '%',
      meetsHurdle: meetsHurdle,
      assessment: meetsHurdle ? 'EXCEEDS HURDLE ✓' : 'BELOW HURDLE ⚠'
    };
  }

  performStressTests() {
    const { riskRating, loanAmount, lgd } = this.inputs;
    const { totalRevenue } = this.results.revenue;
    const { fundingCost, operatingCosts } = this.results.costs;
    const { economicCapital } = this.results.riskParameters;

    // Scenario A: Credit Downgrade (2 notches)
    const downgradedRating = Math.min(riskRating + 2, 10);
    const newPD = PD_RANGES[downgradedRating];
    const newEL = newPD * lgd * loanAmount;
    const newEC = Math.round(economicCapital * 1.5); // 50% increase
    const newNetIncome = totalRevenue - fundingCost - operatingCosts - newEL;
    const downgradeRAROC = newEC > 0 ? newNetIncome / newEC : 0;

    // Scenario B: Deposit Loss (50%)
    const newDepositValue = this.results.relationship.depositValue * 0.5;
    const depositLossIncome = this.results.standAlone.netIncome + newDepositValue + this.results.relationship.totalFeeIncome;
    const depositLossRAROC = economicCapital > 0 ? depositLossIncome / economicCapital : 0;

    // Scenario C: Rate Compression (50 bps)
    const rateReduction = loanAmount * 0.005; // 50 bps
    const compressedRevenue = totalRevenue - rateReduction;
    const compressedNetIncome = compressedRevenue - this.results.costs.totalCosts;
    const compressionRAROC = economicCapital > 0 ? compressedNetIncome / economicCapital : 0;

    this.results.stressTests = {
      creditDowngrade: {
        scenario: `Risk Rating ${riskRating} → ${downgradedRating}`,
        newPD: (newPD * 100).toFixed(2) + '%',
        newExpectedLoss: Math.round(newEL),
        newEconomicCapital: newEC,
        newRAROC: downgradeRAROC,
        newRAROCPct: (downgradeRAROC * 100).toFixed(1) + '%',
        aboveCostOfEquity: downgradeRAROC >= BANK_COST_OF_EQUITY,
        assessment: downgradeRAROC >= BANK_COST_OF_EQUITY ? 'Acceptable ✓' : 'Below Cost of Equity ⚠'
      },
      depositLoss: {
        scenario: '50% deposit reduction',
        newDepositValue: Math.round(newDepositValue),
        newRelationshipIncome: Math.round(depositLossIncome),
        newRAROC: depositLossRAROC,
        newRAROCPct: (depositLossRAROC * 100).toFixed(1) + '%',
        aboveCostOfEquity: depositLossRAROC >= BANK_COST_OF_EQUITY,
        assessment: depositLossRAROC >= BANK_COST_OF_EQUITY ? 'Acceptable ✓' : 'Below Cost of Equity ⚠'
      },
      rateCompression: {
        scenario: '50 basis points rate reduction',
        revenueReduction: Math.round(rateReduction),
        newRevenue: Math.round(compressedRevenue),
        newNetIncome: Math.round(compressedNetIncome),
        newRAROC: compressionRAROC,
        newRAROCPct: (compressionRAROC * 100).toFixed(1) + '%',
        aboveCostOfEquity: compressionRAROC >= BANK_COST_OF_EQUITY,
        assessment: compressionRAROC >= BANK_COST_OF_EQUITY ? 'Acceptable ✓' : 'Below Cost of Equity ⚠'
      },
      overallAssessment: this.assessStressTests(downgradeRAROC, depositLossRAROC, compressionRAROC)
    };
  }

  assessStressTests(downgradeRAROC, depositLossRAROC, compressionRAROC) {
    const scenarios = [downgradeRAROC, depositLossRAROC, compressionRAROC];
    const aboveHurdle = scenarios.filter(r => r >= this.results.riskParameters.hurdleRate).length;
    const aboveCOE = scenarios.filter(r => r >= BANK_COST_OF_EQUITY).length;

    if (aboveHurdle === 3) return 'Strong - All scenarios exceed hurdle';
    if (aboveCOE === 3) return 'Moderate - All scenarios above cost of equity';
    if (aboveCOE >= 2) return 'Acceptable - Most scenarios above cost of equity';
    return 'High Risk - Multiple scenarios below cost of equity';
  }

  printReport() {
    const r = this.results;

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                 RAROC CALCULATION REPORT');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('LOAN DETAILS:');
    console.log(`  Loan Amount:              $${this.inputs.loanAmount.toLocaleString()}`);
    console.log(`  Interest Rate:            ${this.inputs.interestRate}%`);
    console.log(`  Risk Rating:              ${this.inputs.riskRating}\n`);

    console.log('RISK PARAMETERS:');
    console.log(`  Probability of Default:   ${r.riskParameters.probabilityOfDefaultPct}`);
    console.log(`  Loss Given Default:       ${r.riskParameters.lossGivenDefaultPct}`);
    console.log(`  Expected Loss:            $${r.riskParameters.expectedLoss.toLocaleString()} (${r.riskParameters.expectedLossPct})`);
    console.log(`  Economic Capital:         $${r.riskParameters.economicCapital.toLocaleString()} (${r.riskParameters.economicCapitalPct})`);
    console.log(`  Hurdle Rate:              ${r.riskParameters.hurdleRatePct}\n`);

    console.log('REVENUE:');
    console.log(`  Interest Income:          $${r.revenue.interestIncome.toLocaleString()}`);
    console.log(`  Origination Fee:          $${r.revenue.originationFee.toLocaleString()}`);
    console.log(`  Annual Fees:              $${r.revenue.annualFees.toLocaleString()}`);
    console.log(`  ────────────────────────────────────────`);
    console.log(`  Total Revenue:            $${r.revenue.totalRevenue.toLocaleString()}\n`);

    console.log('COSTS:');
    console.log(`  Funding Cost:             $${r.costs.fundingCost.toLocaleString()} (${r.costs.fundingCostPct})`);
    console.log(`  Operating Costs:          $${r.costs.operatingCosts.toLocaleString()} (${r.costs.operatingCostsBps})`);
    console.log(`  Expected Loss:            $${r.costs.expectedLoss.toLocaleString()}`);
    console.log(`  ────────────────────────────────────────`);
    console.log(`  Total Costs:              $${r.costs.totalCosts.toLocaleString()}\n`);

    console.log('STAND-ALONE RAROC:');
    console.log(`  Net Income:               $${r.standAlone.netIncome.toLocaleString()}`);
    console.log(`  Economic Capital:         $${r.standAlone.economicCapital.toLocaleString()}`);
    console.log(`  ────────────────────────────────────────`);
    console.log(`  RAROC:                    ${r.standAlone.rarocPct}`);
    console.log(`  Hurdle Rate:              ${r.standAlone.hurdleRatePct}`);
    console.log(`  Spread to Hurdle:         ${r.standAlone.spreadToHurdlePct}`);
    console.log(`  Assessment:               ${r.standAlone.assessment}\n`);

    if (this.inputs.avgDeposits > 0 || this.inputs.treasuryMgmtFees > 0) {
      console.log('RELATIONSHIP RAROC:');
      console.log(`  Loan Net Income:          $${r.relationship.loanNetIncome.toLocaleString()}`);
      console.log(`  Deposit Value:            $${r.relationship.depositValue.toLocaleString()}`);
      console.log(`  Fee Income:               $${r.relationship.totalFeeIncome.toLocaleString()}`);
      console.log(`  ────────────────────────────────────────`);
      console.log(`  Total Income:             $${r.relationship.totalRelationshipIncome.toLocaleString()}`);
      console.log(`  Economic Capital:         $${r.relationship.economicCapital.toLocaleString()}`);
      console.log(`  ────────────────────────────────────────`);
      console.log(`  Relationship RAROC:       ${r.relationship.relationshipRAROCPct}`);
      console.log(`  Hurdle Rate:              ${r.relationship.hurdleRatePct}`);
      console.log(`  Spread to Hurdle:         ${r.relationship.spreadToHurdlePct}`);
      console.log(`  Assessment:               ${r.relationship.assessment}\n`);
    }

    console.log('STRESS TEST RESULTS:\n');
    console.log(`  Scenario A: ${r.stressTests.creditDowngrade.scenario}`);
    console.log(`    New RAROC:              ${r.stressTests.creditDowngrade.newRAROCPct}`);
    console.log(`    Assessment:             ${r.stressTests.creditDowngrade.assessment}\n`);

    console.log(`  Scenario B: ${r.stressTests.depositLoss.scenario}`);
    console.log(`    New RAROC:              ${r.stressTests.depositLoss.newRAROCPct}`);
    console.log(`    Assessment:             ${r.stressTests.depositLoss.assessment}\n`);

    console.log(`  Scenario C: ${r.stressTests.rateCompression.scenario}`);
    console.log(`    New RAROC:              ${r.stressTests.rateCompression.newRAROCPct}`);
    console.log(`    Assessment:             ${r.stressTests.rateCompression.assessment}\n`);

    console.log(`  Overall Stress Assessment: ${r.stressTests.overallAssessment}\n`);

    console.log('═══════════════════════════════════════════════════════════\n');
  }

  getJSON() {
    return JSON.stringify(this.results, null, 2);
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const inputs = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = parseFloat(args[i + 1]);

    // Convert kebab-case to camelCase
    const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    inputs[camelKey] = value;
  }

  return inputs;
}

function runInteractive() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const inputs = {};

  const questions = [
    { key: 'loanAmount', prompt: 'Loan Amount ($): ' },
    { key: 'interestRate', prompt: 'Interest Rate (%): ' },
    { key: 'riskRating', prompt: 'Risk Rating (1-10): ' },
    { key: 'lgd', prompt: 'Loss Given Default (0-1, e.g., 0.40 for 40%): ' },
    { key: 'fundingCost', prompt: 'Funding Cost Rate (%): ' },
    { key: 'operatingCostBps', prompt: 'Operating Cost (basis points): ' },
    { key: 'originationFeePct', prompt: 'Origination Fee (%, optional, press enter to skip): ', optional: true },
    { key: 'annualFees', prompt: 'Annual Fees ($, optional): ', optional: true },
    { key: 'avgDeposits', prompt: 'Average Deposits ($, optional): ', optional: true },
    { key: 'depositReinvestmentRate', prompt: 'Deposit Reinvestment Rate (%, optional): ', optional: true },
    { key: 'depositCost', prompt: 'Deposit Cost (%, optional): ', optional: true },
    { key: 'treasuryMgmtFees', prompt: 'Treasury Management Fees ($, optional): ', optional: true },
  ];

  let currentQuestion = 0;

  function askNext() {
    if (currentQuestion >= questions.length) {
      rl.close();
      try {
        const calculator = new RAROCCalculator(inputs);
        calculator.calculate();
        calculator.printReport();
      } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
      }
      return;
    }

    const q = questions[currentQuestion];
    rl.question(q.prompt, (answer) => {
      if (answer.trim() === '' && q.optional) {
        inputs[q.key] = 0;
      } else if (answer.trim() !== '') {
        inputs[q.key] = parseFloat(answer);
      }
      currentQuestion++;
      askNext();
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('            RAROC CALCULATOR - INTERACTIVE MODE');
  console.log('═══════════════════════════════════════════════════════════\n');

  askNext();
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
RAROC Calculator for C&I Loan Pricing

Usage:
  Interactive Mode:
    node raroc-calculator.js

  Command Line Mode:
    node raroc-calculator.js --loan-amount 5000000 --interest-rate 6.25 \\
      --risk-rating 5 --lgd 0.40 --funding-cost 4.5 --operating-cost-bps 100 \\
      [--origination-fee-pct 1.0] [--annual-fees 5000] \\
      [--avg-deposits 2000000] [--deposit-reinvestment-rate 4.5] \\
      [--deposit-cost 0.5] [--treasury-mgmt-fees 20000]

  JSON Output:
    node raroc-calculator.js ... --json

Required Parameters:
  --loan-amount            Loan amount in dollars
  --interest-rate          Annual interest rate (%)
  --risk-rating            Internal risk rating (1-10)
  --lgd                    Loss Given Default (0-1, e.g., 0.40 for 40%)
  --funding-cost           Funding cost rate (%)
  --operating-cost-bps     Operating cost in basis points

Optional Parameters:
  --origination-fee-pct    Origination fee (%)
  --annual-fees            Annual fees ($)
  --avg-deposits           Average deposits ($)
  --deposit-reinvestment-rate  Deposit reinvestment rate (%)
  --deposit-cost           Deposit cost rate (%)
  --treasury-mgmt-fees     Treasury management fees ($)
  --wire-transfer-fees     Wire transfer fees ($)
  --other-fees             Other fee income ($)
  --pd                     Override probability of default
  --economic-capital-rate  Override economic capital rate

Examples:
  # Simple loan calculation
  node raroc-calculator.js --loan-amount 5000000 --interest-rate 6.25 \\
    --risk-rating 5 --lgd 0.40 --funding-cost 4.5 --operating-cost-bps 100

  # With relationship value
  node raroc-calculator.js --loan-amount 5000000 --interest-rate 6.25 \\
    --risk-rating 5 --lgd 0.40 --funding-cost 4.5 --operating-cost-bps 100 \\
    --avg-deposits 2000000 --deposit-reinvestment-rate 4.5 --deposit-cost 0.5 \\
    --treasury-mgmt-fees 20000
`);
    process.exit(0);
  }

  if (args.includes('--json')) {
    const inputs = parseArgs();
    try {
      const calculator = new RAROCCalculator(inputs);
      calculator.calculate();
      console.log(calculator.getJSON());
    } catch (error) {
      console.error(JSON.stringify({ error: error.message }));
      process.exit(1);
    }
  } else if (args.length > 0 && args[0].startsWith('--')) {
    const inputs = parseArgs();
    try {
      const calculator = new RAROCCalculator(inputs);
      calculator.calculate();
      calculator.printReport();
    } catch (error) {
      console.error('\n❌ Error:', error.message);
      console.log('\nRun with --help for usage information\n');
      process.exit(1);
    }
  } else {
    runInteractive();
  }
}

// Export for use as module
module.exports = RAROCCalculator;
