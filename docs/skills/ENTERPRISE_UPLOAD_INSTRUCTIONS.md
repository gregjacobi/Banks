# How to Upload C&I Credit Memo Skill to Claude for Enterprise

## 📦 What You Have

You now have a ZIP file ready for upload:
- **File:** `ci-credit-memo-skill.zip` (37KB)
- **Location:** `/Users/gjacobi/BankExplorer/Banks/ci-credit-memo-skill.zip`

### ZIP Contents
```
ci-credit-memo-skill/
├── SKILL.md (main instructions - 26KB)
└── resources/
    ├── INTERVIEW_GUIDE.md
    ├── MEMO_TEMPLATE.md
    ├── README.md
    └── UNDERWRITING_STANDARDS.md
```

---

## 🚀 Upload Instructions

### Step 1: Verify Admin Settings (One-Time Setup)

**If you're an admin:**
1. Go to **claude.ai**
2. Navigate to **Admin settings → Capabilities**
3. Ensure these are enabled:
   - ✅ "Code execution and file creation"
   - ✅ "Skills"
4. Click **Save**

**Note:** If you're not an admin, ask your organization admin to enable these capabilities first.

---

### Step 2: Upload the Skill (Individual User)

1. **Go to claude.ai** and log in
2. Click your **profile icon** (bottom left)
3. Click **Settings**
4. Click **Capabilities** in the left sidebar
5. Scroll down to the **Skills** section
6. Click **"Upload skill"** button
7. **Select the file:** `ci-credit-memo-skill.zip`
8. Click **Open**
9. Wait for upload confirmation

**Expected result:** You'll see "ci-credit-memo" listed in your Skills section.

---

### Step 3: Verify the Skill is Active

1. Start a **new conversation** in claude.ai
2. Type: **"I need to create a credit memo for ABC Manufacturing"**
3. Claude should recognize this and activate the credit memo skill
4. You'll see the skill start asking interview questions

---

## 🧪 Testing the Skill

### Test 1: Simple Demo Mode Test

**Type this in a new conversation:**
```
I need to create a demo credit memo for a $5M line of credit
to a private manufacturing company. Just use realistic placeholder data.
```

**Expected behavior:**
- Claude recognizes the credit memo request
- Asks clarifying questions (2-3 at a time)
- Generates realistic demo financial data
- Creates a complete credit memo with all 8 sections
- Marks all data as "DEMO DATA" with disclaimers

---

### Test 2: Interview Flow Test

**Type this:**
```
Help me create a credit memo for Johnson Manufacturing.
```

**Expected behavior:**
- Claude starts interview process
- Asks: "What industry are they in?"
- Asks: "Is this a public or private company?"
- Asks: "What type of loan are they requesting?"
- Continues asking 2-3 questions at a time

---

### Test 3: Complete Workflow Test

**Type this:**
```
I need a credit memo for a $3M term loan to a private company
called TechParts Inc. They manufacture industrial sensors.
Revenue is $15M, EBITDA $2.5M, existing debt $4M.
The loan is for equipment purchase.
```

**Expected behavior:**
- Claude gathers additional details through interview
- Calculates financial ratios (especially DSCR)
- Performs Five C's analysis
- Identifies risks and mitigants
- Generates complete credit memo with recommendation
- All data properly cited

---

## ✅ Validation Checklist

After running a test, verify the output includes:

### Structure
- [ ] Clear memo header with borrower, loan amount, recommendation
- [ ] Table of contents with 8 sections
- [ ] Executive summary (1 page equivalent)
- [ ] All main sections present (Loan Request, Borrower Analysis, Financial Analysis, Risk Assessment, Recommendation, Appendices, Citations)

### Financial Analysis
- [ ] **DSCR calculated and prominently featured** (most critical ratio)
- [ ] All key ratios calculated (liquidity, leverage, coverage, profitability)
- [ ] Ratios compared to benchmarks
- [ ] Five C's framework applied
- [ ] Stress testing performed

### Risk Assessment
- [ ] 3-5 specific risks identified
- [ ] Each risk rated (High/Medium/Low probability and severity)
- [ ] Mitigants provided
- [ ] Overall risk rating assigned

### Recommendation
- [ ] Clear recommendation (Approved/Approved with Conditions/Declined)
- [ ] Rationale supports the recommendation
- [ ] If DSCR < 1.25x, should recommend decline or require strong conditions
- [ ] Conditions and covenants listed (if approved)

### Citations
- [ ] **Every data point has a source** (this is critical!)
- [ ] Citations section at end is complete
- [ ] Demo data clearly marked (if demo mode)

### Quality
- [ ] Professional banking terminology
- [ ] Objective, balanced tone
- [ ] Well-formatted markdown tables
- [ ] No typos or formatting errors

---

## 🐛 Troubleshooting

### Issue: Skill not activating

**Try:**
- Be explicit: "Activate the credit memo skill for..."
- Use trigger words: "credit memo", "underwriting", "loan approval"
- Start a fresh conversation

### Issue: Upload fails

**Check:**
- File size is under 50MB ✓ (yours is 37KB)
- ZIP structure is correct ✓ (SKILL.md inside ci-credit-memo-skill/ folder)
- You have Skills enabled in Capabilities settings
- You're not hitting any organization upload limits

### Issue: Skill asks too many questions at once

**Expected:** Should ask 2-3 questions at a time
**If not working:** Provide feedback: "That's too many questions. Let's go through them 2-3 at a time."

### Issue: No citations in output

**This is a critical bug.** The SKILL.md explicitly requires citations for every data point.
- Provide feedback: "You need to cite all data sources per the skill instructions"
- Check that the Citations section (Section 8) is present in the memo

### Issue: DSCR not calculated or wrong

**Formula:** DSCR = EBITDA / Annual Debt Service
- Should include both existing and proposed new debt service
- Minimum threshold is 1.25x
- If below 1.25x, recommendation should be decline or conditional approval with strong mitigants

---

## 📊 What the Skill Does

### Phase 1: Interview (Interactive)
- Asks targeted questions about borrower, loan, and collateral
- Adapts based on your responses
- Handles missing data gracefully
- Recognizes demo mode signals

### Phase 2: Data Collection (Automated)
- For public companies: Searches web for financials, ratings, transcripts
- For private companies: Prompts for document uploads
- Tracks citations for every data point
- Generates demo data if requested

### Phase 3: Financial Analysis (Automated)
- Calculates all key ratios:
  - **DSCR** (debt service coverage) - MINIMUM 1.25x required
  - Current ratio, quick ratio (liquidity)
  - Debt-to-TNW, debt-to-EBITDA (leverage)
  - Interest coverage (coverage)
  - Margins, ROA, ROE (profitability)
- Compares to industry benchmarks
- Applies Five C's framework (Character, Capacity, Capital, Collateral, Conditions)
- Performs stress testing scenarios

### Phase 4: Memo Generation (Automated)
- Creates professional credit memo with 8 sections:
  1. Executive Summary
  2. Loan Request
  3. Borrower Analysis
  4. Financial Analysis
  5. Risk Assessment
  6. Recommendation & Conditions
  7. Appendices
  8. **Citations & Data Sources** (critical!)
- Recommendation is APPROVED, APPROVED WITH CONDITIONS, or DECLINED
- All data properly cited

---

## 🎯 Key Features

### ✓ Demo Mode Support
Say "use demo data" or "make up realistic numbers" and it will:
- Generate internally consistent financial data
- Create realistic credit scenarios
- Add prominent "DEMO DATA" disclaimers
- Still follow proper analytical framework

### ✓ Critical Ratio Focus
**DSCR (Debt Service Coverage Ratio) is the most important ratio:**
- Minimum: 1.25x (absolute floor)
- Target: 1.50x+ (comfortable)
- Below 1.25x → Decline or require exceptional mitigants

### ✓ Complete Citation Tracking
Every data point must have a source:
- Web searches: URL + date
- Uploaded docs: Filename + page number
- Demo data: "DEMO DATA - simulated"
- Calculations: Source data cited

### ✓ Risk-Based Recommendations
- Strong credit (DSCR 1.5x+, low risks) → APPROVED
- Adequate credit (DSCR 1.25-1.5x, manageable risks) → APPROVED WITH CONDITIONS
- Weak credit (DSCR <1.25x, high risks) → DECLINED

---

## 💡 Pro Tips

### Get Better Results

**Be specific about the scenario:**
```
Good: "Create a credit memo for a $5M line of credit to a textile
manufacturer with $20M revenue. Use demo data for a moderate risk profile."

Not as good: "Create a credit memo."
```

**Test the interview flow:**
Don't give all info upfront. Let Claude ask questions to simulate a real banker conversation.

**Test edge cases:**
- Declining revenue but strong DSCR
- Growing revenue but weak DSCR
- Missing critical data
- High customer concentration

### Customize for Your Bank

You can edit the skill to match your bank's policies:

1. **Re-download the directory** (if needed)
2. **Edit SKILL.md** to change:
   - DSCR minimum threshold (default: 1.25x)
   - Other ratio targets
   - Risk rating scale
   - Covenant templates
3. **Edit resources/UNDERWRITING_STANDARDS.md** to add:
   - Your bank's specific policies
   - Industry-specific guidelines
   - Pricing grids
4. **Re-zip and re-upload**

---

## 📝 Important Limitations

### What This Skill Does NOT Do:
- ❌ Make actual credit decisions (provides analysis and recommendation only)
- ❌ Replace banker judgment and expertise
- ❌ Guarantee regulatory compliance (institution-specific policies vary)
- ❌ Access non-public data (only uses provided or publicly available data)
- ❌ Share across your organization (each user uploads individually)

### Privacy Note:
- Skills uploaded to your account are **private to you**
- They are **not shared organization-wide**
- Other users must upload the skill separately
- If you want organization-wide deployment, contact your admin about managed skills

---

## 🔄 Updating the Skill

To update the skill with changes:

1. Make edits to files in the `ci-credit-memo-skill/` directory
2. Re-create the ZIP:
   ```bash
   cd /Users/gjacobi/BankExplorer/Banks
   zip -r ci-credit-memo-skill.zip ci-credit-memo-skill -x "*.DS_Store"
   ```
3. Go to claude.ai → Settings → Capabilities → Skills
4. **Remove** the old "ci-credit-memo" skill
5. **Upload** the new ZIP file
6. Test in a new conversation

---

## ✨ Quick Reference

### File Locations
- **ZIP file:** `/Users/gjacobi/BankExplorer/Banks/ci-credit-memo-skill.zip`
- **Source directory:** `/Users/gjacobi/BankExplorer/Banks/ci-credit-memo-skill/`

### Upload Path
**claude.ai → Settings → Capabilities → Skills → Upload skill**

### Test Command
```
I need to create a credit memo for ABC Manufacturing.
```

### Expected First Response
Claude should start asking interview questions like:
- "What industry is ABC Manufacturing in?"
- "Is this a public or private company?"
- "What type of loan are you considering?"

---

## 🎉 You're Ready!

1. ✅ ZIP file created and validated
2. ✅ Instructions reviewed
3. ✅ Test scenarios prepared
4. 🚀 **Ready to upload to claude.ai!**

Navigate to **claude.ai → Settings → Capabilities → Skills → Upload skill** and select `ci-credit-memo-skill.zip`.

Good luck with your testing! 🎯
