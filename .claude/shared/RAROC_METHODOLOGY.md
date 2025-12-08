# RAROC Pricing Methodology for C&I Loans

## Overview

This bank uses Risk-Adjusted Return on Capital (RAROC) as the primary framework for pricing commercial and industrial (C&I) loans. RAROC ensures that loan pricing adequately compensates the bank for the risk taken while creating shareholder value.

---

## Core RAROC Formula

**RAROC = (Net Income) / (Economic Capital)**

**Where:**
- **Net Income** = Expected Revenue - Operating Costs - Expected Loss
- **Economic Capital** = Capital required to cover unexpected losses at 99.9% confidence level

**Decision Rule:**
- **RAROC ≥ Hurdle Rate** → Approve (creates shareholder value)
- **RAROC < Hurdle Rate** → Decline or reprice (destroys shareholder value)

---

## Bank's RAROC Hurdle Rates

| Risk Rating | Risk Level | Hurdle Rate | Rationale |
|-------------|------------|-------------|-----------|
| 1-3 | Minimal to Low | 12% | Lower capital requirement, stable returns |
| 4-6 | Moderate | 15% | Standard middle-market hurdle |
| 7-8 | Management Attention | 18% | Increased capital allocation, higher uncertainty |
| 9-10 | Special Mention/Watch | 20%+ | Significant capital requirement |

**Note:** Our bank's cost of equity is **12%**. Hurdle rates include a margin for risk and competitive positioning.

---

## Risk Parameters by Internal Risk Rating

### Probability of Default (PD)

| Risk Rating | Description | PD Range |
|-------------|-------------|----------|
| 1-2 | Minimal Risk | 0.01% - 0.10% |
| 3-4 | Low Risk | 0.10% - 0.50% |
| 5-6 | Moderate Risk | 0.50% - 2.00% |
| 7-8 | Management Attention | 2.00% - 5.00% |
| 9-10 | Special Mention | 5.00% - 15.00% |

### Loss Given Default (LGD)

| Collateral Type | LGD Range |
|-----------------|-----------|
| Senior Secured - Strong Collateral | 25-35% |
| Senior Secured - Standard | 35-45% |
| Senior Unsecured | 45-60% |
| Subordinated | 60-75% |

### Economic Capital Allocation

| Risk Rating | Economic Capital (% of EAD) |
|-------------|----------------------------|
| 1-2 | 1-2% |
| 3-4 | 2-4% |
| 5-6 | 4-8% |
| 7-8 | 8-15% |
| 9-10 | 15-30% |

---

## Expected Loss Calculation

**Expected Loss ($) = PD × LGD × EAD**

**Where:**
- **PD** = Probability of Default (%)
- **LGD** = Loss Given Default (%)
- **EAD** = Exposure at Default ($) - typically the loan amount

**Example:**
- Loan Amount: $5,000,000
- Risk Rating: 5 (Moderate Risk)
- PD: 1.50%
- LGD: 40% (senior secured)
- **Expected Loss** = 1.50% × 40% × $5,000,000 = **$30,000 annually**

---

## Pricing Components

### All-In Rate Formula

**All-In Rate = Base Rate + Credit Spread + Operating Cost + Expected Loss + Economic Capital Charge + Profit Margin**

### Component Breakdown

#### 1. Base Rate (Funding Cost)
- Current benchmark: **SOFR + applicable term adjustment**
- Represents our cost to raise funds
- **Current Base Rate:** [Insert current rate - typically 4-5%]

#### 2. Credit Spread
- Compensates for default risk
- Varies by risk rating
- **Typical Range:** 200-350 basis points (2.00% - 3.50%)

#### 3. Operating Costs
- Allocation of direct costs: origination, servicing, monitoring
- **Standard Allocation:** 100-200 basis points (1.00% - 2.00%)
- Smaller loans require higher allocation

#### 4. Expected Loss Pricing
- Must be priced into loan to avoid value destruction
- Calculated as: (EL / Loan Amount) × 100
- **Example:** $30,000 EL / $5M loan = 0.60% or 60 basis points

#### 5. Economic Capital Charge
- Return required on economic capital
- **Formula:** (Economic Capital / Loan Amount) × Cost of Equity
- **Example:** (3% × 12%) = 0.36% or 36 basis points

#### 6. Profit Margin
- Additional return to exceed hurdle rate
- **Typical Range:** 50-200 basis points (0.50% - 2.00%)
- Depends on competition and relationship value

---

## Sample RAROC Calculation

### Loan Details
- **Borrower:** ABC Manufacturing Co.
- **Loan Amount:** $5,000,000
- **Term:** 5 years
- **Risk Rating:** 5 (Moderate)
- **Proposed Rate:** 6.25%

### Risk Parameters
- **PD:** 1.50%
- **LGD:** 40%
- **EAD:** $5,000,000
- **Expected Loss:** $30,000
- **Economic Capital:** 5% of EAD = $250,000

### Revenue Calculation
```
Interest Income (6.25%):     $312,500
Origination Fee (1.0%):      $50,000
Annual Fees:                 $5,000
───────────────────────────────────
Total Revenue:               $367,500
```

### Cost Calculation
```
Funding Cost (4.50%):        $225,000
Operating Costs (0.50%):     $25,000
Expected Loss:               $30,000
───────────────────────────────────
Total Costs:                 $280,000
```

### RAROC Calculation
```
Net Income = Revenue - Costs
Net Income = $367,500 - $280,000 = $87,500

RAROC = Net Income / Economic Capital
RAROC = $87,500 / $250,000
RAROC = 35.0%
```

### Decision
- **Stand-Alone RAROC:** 35.0% ✓
- **Hurdle Rate:** 15%
- **Result:** **APPROVE** - Significantly exceeds hurdle rate

---

## Relationship Value Adjustments

### Full Relationship Profitability

Modern commercial banking evaluates the **entire relationship**, not just the loan.

**Relationship Components:**
1. **Loan Income:** Interest and fees
2. **Deposit Value:** NIM on operating accounts
3. **Fee Income:** Treasury management, wires, etc.
4. **Cross-Sell:** FX, hedging, wealth management

### Quantifying Deposit Value

**Deposit Value ($) = Average Balance × (Reinvestment Rate - Deposit Cost)**

**Example:**
- Average Deposits: $2,000,000
- Reinvestment Rate: 4.50%
- Deposit Cost: 0.50%
- **Deposit Value** = $2,000,000 × (4.50% - 0.50%) = **$80,000 annually**

### Relationship RAROC Calculation

```
Loan Net Income:             $87,500
Deposit Value:               $80,000
Fee Income:                  $20,000
───────────────────────────────────
Total Relationship Income:   $187,500

Total Economic Capital:      $250,000 (loan only - deposits are low risk)

Relationship RAROC = $187,500 / $250,000 = 75.0%
```

**Key Insight:** Loan alone = 35% RAROC. Full relationship = 75% RAROC. This demonstrates the power of relationship banking.

---

## Pricing Exceptions and Adjustments

### When to Consider Exceptions

1. **Strong Relationship Value**
   - Significant deposits committed
   - High-margin fee income
   - Cross-sell pipeline documented

2. **Strategic Value**
   - Market share considerations
   - Industry expertise building
   - Future growth potential

3. **Competitive Positioning**
   - Defensive pricing to retain customer
   - Match competitive offer (if justified)
   - Maintain wallet share

### Exception Documentation Requirements

**CRITICAL for Fair Lending Compliance:**

Every pricing exception must be documented with:
1. **Business Justification:** Specific, legitimate reason
2. **Relationship Commitments:** Documented deposit/fee agreements
3. **Competitive Intelligence:** Specific competitor rate (if match)
4. **Approval Authority:** Required sign-off level
5. **RAROC Impact:** Show how relationship value justifies exception

### Banker's Case for Pricing Adjustments

When requesting pricing below calculated rate, banker must provide:

**A. Relationship Value Documentation:**
```
Current Deposits:            $[Amount]
Committed Deposits:          $[Amount] (with documentation)
Annual Fee Income:           $[Amount]
Cross-Sell Pipeline:         [Specific opportunities]
Relationship RAROC:          [X]% (must exceed hurdle)
```

**B. Competitive Justification:**
```
Competitor Bank:             [Name]
Competitor Rate:             [X.XX]%
Our Calculated Rate:         [X.XX]%
Requested Rate:              [X.XX]%
Rate Reduction:              [X] basis points
RAROC at Requested Rate:     [X]% (must show still profitable)
```

**C. Strategic Rationale:**
```
Strategic Importance:        [Specific reason]
Market Positioning:          [Impact]
Future Opportunity:          [Quantified potential]
Risk Mitigation:             [How risk is managed at lower rate]
```

### Approval Thresholds

| RAROC vs. Hurdle | Required Approval |
|------------------|-------------------|
| ≥ Hurdle + 5% | Relationship Manager |
| Hurdle to Hurdle + 5% | Credit Officer |
| Hurdle - 3% to Hurdle | Senior Credit Officer |
| < Hurdle - 3% | Chief Credit Officer + CEO |

---

## Stress Testing RAROC

### Downside Scenarios

Test RAROC under adverse conditions:

**Scenario 1: Credit Rating Downgrade**
- Risk rating moves from 5 → 7
- PD increases: 1.50% → 3.50%
- Expected Loss doubles
- Economic Capital increases 50%
- **Impact on RAROC:** [Calculate new RAROC]

**Scenario 2: Loss of Deposits**
- Customer moves 50% of deposits to another bank
- Deposit value reduced by half
- **Impact on Relationship RAROC:** [Calculate new RAROC]

**Scenario 3: Competitive Rate Pressure**
- Market rates compress by 50 basis points
- Revenue decreases by $25,000
- **Impact on RAROC:** [Calculate new RAROC]

### Minimum Acceptable Outcomes

- **Stressed RAROC** should remain **≥ Cost of Equity (12%)**
- If stressed RAROC < 12%, loan destroys value under stress
- Additional risk mitigants or pricing adjustments required

---

## RAROC Presentation Format for Credit Memos

### Standard Section Template

```markdown
## RAROC ANALYSIS

### Risk Parameters
- **Internal Risk Rating:** [X] ([Risk Level])
- **Probability of Default (PD):** [X.XX]%
- **Loss Given Default (LGD):** [XX]%
- **Exposure at Default (EAD):** $[Amount]
- **Expected Loss (EL):** $[Amount] ([X.XX]% of EAD)
- **Economic Capital:** $[Amount] ([X.X]% of EAD)

### Profitability Analysis

**Revenue:**
- Interest Income ([X.XX]%): $[Amount]
- Origination Fee: $[Amount]
- Annual Fees: $[Amount]
- **Total Revenue:** $[Amount]

**Costs:**
- Funding Cost ([X.XX]%): $[Amount]
- Operating Costs: $[Amount]
- Expected Loss: $[Amount]
- **Total Costs:** $[Amount]

**Net Income:** $[Amount]

### RAROC Calculation

**Stand-Alone RAROC = Net Income / Economic Capital**
**RAROC = $[Amount] / $[Amount] = [XX.X]%**

**Hurdle Rate:** [XX]%
**Spread to Hurdle:** +[X.X]% / -[X.X]%

✓ **Exceeds Hurdle** / ⚠ **Below Hurdle - See Relationship Value**

### Relationship Value (if applicable)

**Additional Income:**
- Average Deposits: $[Amount]
- Deposit Value (NIM [X.X]%): $[Amount]
- Treasury Management Fees: $[Amount]
- Other Fee Income: $[Amount]
- **Total Additional Income:** $[Amount]

**Total Relationship Income:** $[Amount]
**Relationship RAROC:** [XX.X]%

### Conclusion

[Summary of RAROC analysis and recommendation]
- Stand-Alone RAROC: [XX]% [✓ Exceeds / ⚠ Below] [XX]% hurdle
- Relationship RAROC: [XX]% [✓ Exceeds / ⚠ Below] [XX]% hurdle
- **Recommendation:** [APPROVE / CONDITIONAL / DECLINE]
```

---

## Key Takeaways

1. **RAROC must exceed hurdle rate** to create shareholder value
2. **Expected Loss must be priced** - it's not optional
3. **Economic Capital allocation** varies significantly by risk rating
4. **Relationship value** can transform unprofitable loans into attractive deals
5. **All exceptions require documentation** for compliance and governance
6. **Stress test RAROC** to ensure profitability under adverse scenarios
7. **Fair lending compliance** requires tracking all pricing decisions

---

**Last Updated:** [Date]
**Bank Policy Reference:** [Policy Number]
