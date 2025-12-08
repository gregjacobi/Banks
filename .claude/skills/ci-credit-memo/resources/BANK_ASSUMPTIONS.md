# Bank-Specific Pricing Assumptions

**Last Updated:** 2024-12-02
**Review Frequency:** Quarterly
**Owner:** Treasury Department

---

## Funding Costs

### Base Rate
- **Current SOFR:** 4.50%
- **Term Adjustment:** 0 bps
- **Total Funding Cost:** 4.50%

**Notes:**
- Updated based on current market conditions
- Reflects bank's actual cost of funds
- Should be reviewed monthly and updated as market moves

---

## Deposit Economics

### Operating Account Assumptions
- **Average Deposit Cost:** 0.50%
- **Reinvestment Rate:** 4.50% (equals funding cost)
- **Net Interest Margin on Deposits:** 4.00%

**Notes:**
- Deposit cost reflects blended rate on operating accounts
- Reinvestment rate typically equals or slightly exceeds funding cost
- Review quarterly based on deposit pricing strategy

---

## Operating Cost Allocations

### Loan Servicing Costs (Basis Points)

| Loan Size | Operating Cost (bps) | Rationale |
|-----------|---------------------|-----------|
| < $1M | 150-200 | High touch, more relative overhead |
| $1M - $5M | 75-100 | Standard middle market |
| $5M - $10M | 50-75 | Economies of scale |
| $10M+ | 25-50 | Large loans, efficient servicing |

**Default for Calculator:**
- Use **75 bps** for loans $1M-$10M
- Use **50 bps** for loans $10M+
- Use **100 bps** for loans under $1M

**Notes:**
- Includes origination, underwriting, servicing, monitoring
- Based on bank's cost accounting analysis
- May vary by product type or complexity

---

## Fee Structure Standards

### Origination Fees

| Risk Rating | Standard Fee (%) | Range (%) |
|-------------|------------------|-----------|
| 1-3 | 0.50% | 0.25-0.75% |
| 4-6 | 0.75% | 0.50-1.00% |
| 7-8 | 1.00% | 0.75-1.50% |
| 9-10 | 1.50% | 1.00-2.00% |

**Notes:**
- Higher risk requires higher upfront fees
- Competitive pressure may require flexibility
- Material deviations require credit officer approval

### Annual Fees
- **Standard:** $5,000 for facilities over $5M
- **Under $5M:** $2,500
- **Under $1M:** $1,000

### Unused Commitment Fees
- **Standard:** 0.25-0.50% of unused portion
- Applied to revolving lines and commitments

---

## Relationship Banking Assumptions

### Treasury Management Services (Annual)

| Service Level | Annual Fees | Description |
|--------------|-------------|-------------|
| Basic | $5,000-$10,000 | ACH, wire transfers, basic reporting |
| Standard | $10,000-$20,000 | Plus fraud protection, enhanced reporting |
| Premium | $20,000-$40,000 | Full suite, integrated systems |

**Default for Calculator:** Use $15,000 for standard middle market

### Other Fee Income Expectations

| Fee Source | Typical Annual $ | Notes |
|-----------|------------------|-------|
| Wire Transfers | $1,000-$5,000 | Depends on transaction volume |
| FX Services | $2,000-$10,000 | If applicable to business |
| Lockbox | $5,000-$15,000 | If required for receivables |
| Merchant Services | Variable | Case-by-case |

**Default for Calculator:** Use $5,000 for "other fees" as conservative baseline

---

## Pricing Strategy Targets

### Target Spreads Over Funding Cost

| Risk Rating | Target Spread (bps) | Range (bps) |
|-------------|-------------------|-------------|
| 1-3 | 200-250 | 175-300 |
| 4-6 | 250-325 | 225-400 |
| 7-8 | 350-450 | 300-550 |
| 9-10 | 500+ | 450-700 |

**Example:**
- Risk Rating 5, Funding Cost 4.50%
- Target Rate: 4.50% + 2.75% = 7.25%

**Notes:**
- These are targets, not absolutes
- Relationship value may justify tighter spreads
- Competitive market may require flexibility
- RAROC must still exceed hurdle rate

---

## Collateral LGD Guidelines

### Loss Given Default by Collateral Type

| Collateral Type | LGD Range (%) | Default LGD (%) |
|-----------------|---------------|-----------------|
| Cash/Marketable Securities | 5-15 | 10 |
| Accounts Receivable - Investment Grade | 20-30 | 25 |
| Accounts Receivable - Standard | 30-40 | 35 |
| Inventory - Finished Goods | 35-50 | 40 |
| Inventory - Raw Materials | 45-60 | 50 |
| Equipment - General Use | 40-50 | 45 |
| Equipment - Specialized | 50-65 | 55 |
| Real Estate - Owner Occupied | 25-35 | 30 |
| Real Estate - Investment | 30-45 | 35 |
| Unsecured | 50-70 | 60 |
| Subordinated | 65-85 | 75 |

**Notes:**
- Use blended LGD for mixed collateral packages
- Adjust based on advance rates and coverage
- Strong controls and monitoring can justify lower LGD
- Weak collateral management increases LGD

### Collateral Coverage Impact on LGD

| Coverage Ratio | LGD Adjustment |
|----------------|----------------|
| > 2.0x | -5 to -10% |
| 1.5x - 2.0x | -0 to -5% |
| 1.25x - 1.5x | No adjustment |
| < 1.25x | +5 to +10% |

---

## Market Rate Intelligence

### Current Market Pricing (Informational)

**Last Updated:** [Date]

| Product | Rate Range | Comments |
|---------|-----------|----------|
| Prime-based loans | P + 0 to 50 | (P = 7.50%) |
| SOFR-based loans | SOFR + 200-400 | Varies by credit |
| Asset-based lending | SOFR/P + 150-300 | Depends on advance rates |
| Real estate | SOFR + 200-350 | Term vs. floating |

**Notes:**
- Update based on competitive intelligence
- Track competitor wins/losses and pricing
- Monitor market rate surveys

---

## Policy Constraints

### Minimum Acceptable Terms

1. **All-In Rate Minimum:**
   - Must exceed funding cost + expected loss + operating costs
   - Absolute floor: RAROC ≥ cost of equity (12%)

2. **Below-Hurdle Exceptions:**
   - Require documented relationship value
   - Relationship RAROC must exceed hurdle
   - Senior credit officer approval required

3. **Fair Lending Compliance:**
   - All pricing decisions must be documented
   - Exceptions require legitimate business justification
   - Consistent treatment for similarly situated borrowers

---

## Usage Notes for Pricing Matrix Calculator

**This file provides defaults for the pricing matrix calculator:**

1. **Fixed Inputs** (same for all loans):
   - Funding cost: 4.50%
   - Deposit cost: 0.50%
   - Reinvestment rate: 4.50%

2. **Loan-Specific Inputs** (vary by deal):
   - Risk rating → determines PD, economic capital, hurdle rate
   - Loan amount → determines operating cost basis points
   - Collateral type → determines LGD
   - Relationship components → deposits, treasury fees

3. **Calculator Will Auto-Populate:**
   - Interest rate based on risk rating and target spreads
   - Operating costs based on loan size
   - Fee structure based on risk rating
   - Default relationship assumptions if not specified

4. **Override Capability:**
   - Banker can override any calculated input
   - Overrides must be documented with business justification
   - Material overrides flagged for credit analyst review

---

## Review and Update Schedule

**Monthly:**
- Funding cost (based on actual rates)
- Market rate intelligence

**Quarterly:**
- Deposit economics
- Fee structures
- Operating cost allocations
- Collateral LGD ranges

**Annually:**
- Full comprehensive review
- Benchmark against peer banks
- Validate assumptions with actual results
- Update policy constraints as needed

---

**Maintained By:** Treasury Department
**Approved By:** Chief Credit Officer & CFO
**Contact for Questions:** [treasury@bank.com]
