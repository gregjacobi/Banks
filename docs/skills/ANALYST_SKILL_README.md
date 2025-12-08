# Credit Analyst Review Skill - Complete Package

## ✅ Ready for Upload

You now have a **complementary credit analyst skill** that provides independent review of credit memos created by the commercial banker skill.

---

## 📦 Package Contents

### Main Upload File
- **[credit-analyst-skill.zip](credit-analyst-skill.zip)** (32KB) ⭐
  - Location: `/Users/gjacobi/BankExplorer/Banks/credit-analyst-skill.zip`
  - Format: Validated for Claude Enterprise upload
  - Structure: ✅ Correct

### ZIP Contents
```
credit-analyst-skill/
├── SKILL.md (20KB)
│   ├── Independent review workflow
│   ├── Financial validation procedures
│   ├── Risk assessment framework
│   ├── Policy compliance checking
│   └── Analyst report template
│
└── resources/
    ├── UNDERWRITING_STANDARDS.md (29KB) - Ratio thresholds
    ├── ANALYST_REVIEW_FRAMEWORK.md (18KB) - Detailed methodology
    ├── RED_FLAGS_GUIDE.md (14KB) - Warning signs reference
    └── README.md (2KB) - Resource overview
```

---

## 🎯 What This Skill Does

The **Credit Analyst** skill provides independent review and risk assessment of commercial loan credit memos.

### Key Responsibilities

**1. Independent Risk Assessment**
- Reviews from risk management perspective (not sales)
- Identifies ALL material risks, including those overlooked
- Assesses risk probability and impact independently
- Challenges risk ratings when warranted

**2. Financial Analysis Validation**
- Recalculates all key ratios to verify accuracy
- Validates data sources and citations
- Checks for inconsistencies
- Assesses reasonableness of projections

**3. Underwriting Standards Compliance**
- Compares against bank policy
- Flags exceptions or violations
- Assesses whether mitigants are sufficient

**4. Gap Identification**
- Identifies missing information
- Highlights areas needing additional diligence
- Points out unaddressed risks

**5. Credit Committee Preparation**
- Provides clear, actionable recommendation
- Anticipates committee questions
- Suggests conditions or modifications

---

## 🔄 How It Works with Commercial Banker Skill

These two skills create a **checks-and-balances system**:

### Step 1: Commercial Banker Creates Credit Memo
Use the **`ci-credit-memo`** skill to:
- Interview banker
- Gather data
- Analyze financials
- Create credit memo with recommendation

### Step 2: Credit Analyst Reviews Credit Memo
Use the **`credit-analyst-review`** skill to:
- Review the credit memo
- Recalculate ratios
- Identify additional risks
- Validate policy compliance
- Provide independent recommendation

### Step 3: Present to Credit Committee
The committee sees:
- ✅ **Banker's perspective** (growth opportunity, relationship value)
- ✅ **Analyst's perspective** (independent risk assessment)
- ✅ **Both recommendations** (may agree or disagree)

---

## 🚀 Upload Instructions

### Quick Upload (3 steps):
1. **claude.ai** → Settings → Capabilities
2. **Upload skill** → select `credit-analyst-skill.zip`
3. **Test:** "Review this credit memo as a credit analyst"

### Activation Triggers

The analyst skill activates when you say:
- "Review this credit memo"
- "Credit analyst review"
- "Provide independent risk assessment"
- "Analyst perspective on this credit"

---

## 🧪 Testing the Analyst Skill

### Test Scenario 1: Review a Credit Memo

**Step 1:** Create a credit memo (or use the demo below)

Using the **ci-credit-memo** skill:
```
Create a demo credit memo for $5M line of credit to
Manufacturing Co with $20M revenue. Use realistic demo data.
```

**Step 2:** Ask analyst to review it

Using the **credit-analyst-review** skill:
```
Please review this credit memo from an independent credit analyst perspective.
[Paste or upload the credit memo]
```

**Expected analyst output:**
- Ratio verification (recalculates DSCR, leverage ratios, etc.)
- Risk assessment (validates banker's risks, identifies additional risks)
- Policy compliance check
- Independent recommendation (Concur/Conditional/Non-Concur/Refer)
- Specific additional conditions (if any)
- Questions for credit committee

---

### Test Scenario 2: Analyst Finds Issues

Create a credit memo with a **weak DSCR**:
```
[Using ci-credit-memo skill]
Create demo credit memo for $8M term loan, company has
EBITDA of $1.5M and existing debt service of $800K/year.
```

This should result in DSCR around 1.20x (below 1.25x minimum).

Then ask analyst to review:
```
[Using credit-analyst-review skill]
Review this credit memo and provide your independent assessment.
```

**Expected analyst response:**
- **NON-CONCUR** recommendation (DSCR below minimum)
- Recalculation showing actual DSCR
- Statement that policy minimum is 1.25x
- Suggestion to either decline or reduce loan amount to improve coverage

---

### Test Scenario 3: Analyst Concurs But Adds Conditions

Create a solid credit memo:
```
[Using ci-credit-memo skill]
Create demo credit memo for $3M equipment loan, company has
$25M revenue, EBITDA $4M, existing debt $2M. Strong profile.
```

Then ask analyst:
```
[Using credit-analyst-review skill]
Review this credit memo.
```

**Expected analyst response:**
- **CONCUR** with approval (credit meets standards)
- Ratios validated
- Risks adequately identified
- **Additional conditions recommended** (e.g., annual equipment appraisal, stronger financial reporting covenant)

---

## ✨ Key Features

### ✓ Independence
- Analyst works for the bank, not the commercial banker
- Provides genuine independent assessment
- Challenges assumptions objectively

### ✓ Thorough Validation
- Recalculates all key ratios
- Verifies data sources
- Checks for calculation errors
- Identifies inconsistencies

### ✓ Comprehensive Risk Assessment
- Reviews ALL banker-identified risks
- Identifies ADDITIONAL risks overlooked
- Assesses mitigation adequacy
- Rates risks independently

### ✓ Policy Compliance
- Compares against underwriting standards
- Flags policy exceptions
- Assesses whether exceptions are justified
- Determines approval authority required

### ✓ Four Possible Recommendations
1. **CONCUR** - Agree with banker's approval
2. **CONDITIONAL APPROVAL** - Approve with stronger/additional conditions
3. **NON-CONCUR** - Recommend decline
4. **REFER TO COMMITTEE** - Borderline case requiring discussion

### ✓ Actionable Output
- Specific conditions recommended
- Clear rationale for recommendation
- Anticipated committee questions
- Concrete modifications suggested

---

## 📊 Validation Checklist

After analyst review, verify output includes:

### Analysis Sections
- [ ] **Ratio Verification Table** (banker calc vs. analyst calc)
- [ ] **Financial Statement Quality Assessment**
- [ ] **Trend Analysis** (revenue, profitability, leverage, liquidity)
- [ ] **Risk Assessment** (banker's risks + analyst-identified risks)
- [ ] **Policy Compliance Review** (standards met/exceptions noted)
- [ ] **Stress Testing Validation** (scenarios tested, results assessed)
- [ ] **Collateral Assessment** (valuation, marketability, coverage)
- [ ] **Gap Analysis** (missing info, questions for borrower/banker)

### Recommendation Section
- [ ] **Clear Recommendation** (Concur/Conditional/Non-Concur/Refer)
- [ ] **Detailed Rationale** (2-4 paragraphs explaining)
- [ ] **Required Conditions** (beyond banker's proposal, if any)
- [ ] **Risk Rating** (analyst's independent rating)
- [ ] **Questions for Credit Committee** (anticipated)

### Quality
- [ ] Professional, objective tone
- [ ] Specific, actionable recommendations
- [ ] Calculations shown (DSCR, other ratios)
- [ ] References to underwriting standards
- [ ] Independent perspective (not just echoing banker)

---

## 🎓 Advanced Usage

### Analyst Challenging the Banker

If you want to see the analyst disagree with the banker:

**Create a marginal credit memo** (low DSCR, high leverage, significant risks)
Then ask analyst to review it.

The analyst should:
- Point out the weaknesses
- NON-CONCUR if standards aren't met
- Suggest modifications to make it work OR recommend decline

### Analyst Questions Needing Answers

The analyst may ask questions like:
- "Do you have the A/R aging report?"
- "What are the customer concentration details?"
- "Can you provide the equipment appraisal?"

You can either:
1. **Provide information** → Analyst incorporates into review
2. **Say it's not available** → Analyst notes gap and assesses impact
3. **Say to proceed anyway** → Analyst makes conservative assumptions

The analyst is designed to **proceed with available information** and note gaps, not hold up the review indefinitely.

---

## 💡 Best Practices

### 1. Use Both Skills Together

**Workflow:**
1. Create credit memo (ci-credit-memo skill)
2. Review credit memo (credit-analyst-review skill)
3. Present both perspectives to committee

### 2. Test Disagreements

Create scenarios where analyst should disagree:
- DSCR below 1.25x
- Missing critical information
- Inadequate risk mitigants
- Policy violations without justification

### 3. Leverage the Red Flags Guide

The analyst has access to a comprehensive red flags guide. Test edge cases:
- Customer concentration >60%
- Declining revenue
- Weak collateral
- Rapid growth straining systems

### 4. Use for Training

This skill can help train commercial bankers:
- See how an analyst thinks
- Learn what analysts look for
- Understand common objections
- Improve credit memo quality

---

## 🔍 What Makes This Skill Valuable

### For Banks
- **Risk Management:** Independent check on credit quality
- **Policy Compliance:** Ensures standards are followed
- **Credit Committee Efficiency:** Better prepared discussions
- **Training:** Teaches best practices

### For Commercial Bankers
- **Quality Check:** Catch errors before committee
- **Strengthen Proposals:** Address weaknesses proactively
- **Learn:** Understand analyst perspective
- **Improve:** Better credit memos over time

### For Credit Committees
- **Two Perspectives:** Banker and analyst views
- **Informed Decisions:** Thorough risk assessment
- **Clear Recommendations:** Actionable guidance
- **Better Questions:** Anticipated concerns addressed

---

## 📁 File Locations

All files are in: `/Users/gjacobi/BankExplorer/Banks/`

- **Upload this:** `credit-analyst-skill.zip` ⭐
- **Instructions:** `ANALYST_SKILL_README.md` (this file)
- **Source files:** `credit-analyst-skill/` (directory)

### Both Skills Available
- `ci-credit-memo-skill.zip` (37KB) - Commercial banker skill
- `credit-analyst-skill.zip` (32KB) - Credit analyst skill

---

## 🔄 Updating the Skill

To modify and re-upload:

1. **Edit files** in `credit-analyst-skill/` directory
2. **Re-create ZIP:**
   ```bash
   cd /Users/gjacobi/BankExplorer/Banks
   zip -r credit-analyst-skill.zip credit-analyst-skill -x "*.DS_Store"
   ```
3. **Re-upload** to claude.ai (remove old version first)

---

## 🎯 Success Criteria

Your analyst review is successful if:

1. ✅ **Independent assessment provided** (not just echoing banker)
2. ✅ **Ratios recalculated** and verified
3. ✅ **Additional risks identified** beyond banker's list
4. ✅ **Clear recommendation** (Concur/Conditional/Non-Concur/Refer)
5. ✅ **Specific conditions** suggested (if needed)
6. ✅ **Policy compliance** checked against standards
7. ✅ **Professional quality** suitable for credit committee

---

## 🚦 Next Steps

### 1. Upload Both Skills
- Upload `ci-credit-memo-skill.zip` (if not already done)
- Upload `credit-analyst-skill.zip`

### 2. Test the Workflow
**Complete Test:**
```
[Conversation 1 - Using ci-credit-memo skill]
Create a demo credit memo for Johnson Manufacturing, $5M line of credit.

[Conversation 2 - Using credit-analyst-review skill]
Review the credit memo for Johnson Manufacturing and provide your
independent analyst assessment.
```

### 3. Try Different Scenarios
- Strong credit (analyst concurs)
- Weak credit (analyst declines)
- Marginal credit (analyst requires conditions)
- Borderline credit (analyst refers to committee)

---

## 💬 Example Interaction

**User:** Review this credit memo from an analyst perspective.

[Paste credit memo]

**Analyst Skill:**
```
I'll conduct an independent credit analyst review of this credit memo.

ANALYST RECOMMENDATION: CONDITIONAL APPROVAL

RATIO VERIFICATION:
- DSCR: Banker calculated 1.45x, I verify 1.42x (minor variance, acceptable)
- Debt/TNW: 2.8x, within 4.0x policy limit ✓
- Current Ratio: 1.65, above 1.2 minimum ✓

RISK ASSESSMENT:
The banker identified 3 risks. I concur with these but also identify:

Additional Risk #4: Customer Concentration - 55% from top 3 customers
- Severity: HIGH
- Probability: MEDIUM
- This was not adequately addressed in the banker's memo
- Mitigant needed: Customer contract reviews, concentration covenant

RECOMMENDATION:
I CONCUR with approval SUBJECT TO additional conditions:
1. Obtain copies of customer contracts for top 3 customers
2. Add covenant: Notify bank if any customer exceeds 40% of revenue
3. Quarterly customer concentration reporting

With these conditions, the credit meets acceptable standards.
```

---

## ✅ Package Status

- [x] SKILL.md created with proper YAML frontmatter
- [x] Underwriting standards included
- [x] Analyst review framework included
- [x] Red flags guide included
- [x] README created
- [x] ZIP file created and validated (32KB)
- [x] Upload instructions complete

**You're ready to upload! 🚀**

---

**Quick Upload:** claude.ai → Settings → Capabilities → Skills → Upload `credit-analyst-skill.zip`
