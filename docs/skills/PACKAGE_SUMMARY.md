# C&I Credit Memo Skill - Package Summary

## ✅ Ready for Upload to Claude for Enterprise

You now have a complete, properly formatted skill package ready to upload to claude.ai Enterprise settings.

---

## 📦 Package Contents

### Main File (Ready to Upload)
- **`ci-credit-memo-skill.zip`** (37KB)
  - Location: `/Users/gjacobi/BankExplorer/Banks/ci-credit-memo-skill.zip`
  - Format: Validated for Claude Enterprise upload
  - Structure: ✅ Correct (SKILL.md inside ci-credit-memo-skill/ folder)

### ZIP Contents
```
ci-credit-memo-skill/
├── SKILL.md (26KB)
│   ├── Proper YAML frontmatter (name, description)
│   ├── Complete workflow (4 phases)
│   ├── Interview process
│   ├── Financial analysis framework
│   └── Memo generation instructions
│
└── resources/
    ├── MEMO_TEMPLATE.md (31KB)
    ├── UNDERWRITING_STANDARDS.md (29KB)
    ├── INTERVIEW_GUIDE.md (3KB)
    └── README.md (12KB)
```

### Documentation Files
1. **`QUICK_START.md`** - 3-step upload guide (fastest way to get started)
2. **`ENTERPRISE_UPLOAD_INSTRUCTIONS.md`** - Complete upload and testing guide
3. **`PACKAGE_SUMMARY.md`** - This file

---

## 🎯 What This Skill Does

**Generates comprehensive C&I loan credit memos through 4 phases:**

### Phase 1: Interview
- Asks targeted questions (2-3 at a time)
- Gathers company info, loan details, collateral
- Handles missing data gracefully
- Recognizes "demo mode"

### Phase 2: Data Collection
- Public companies: Web searches for financials, ratings, transcripts
- Private companies: Prompts for document uploads
- Demo mode: Generates realistic simulated data
- **Tracks citations for every data point**

### Phase 3: Financial Analysis
- Calculates all key ratios:
  - **DSCR** (Debt Service Coverage) - CRITICAL: minimum 1.25x
  - Liquidity ratios (current, quick)
  - Leverage ratios (debt-to-TNW, debt-to-EBITDA)
  - Coverage ratios (interest coverage)
  - Profitability ratios (margins, ROA, ROE)
- Applies Five C's framework
- Performs stress testing

### Phase 4: Memo Generation
- Creates 8-section professional credit memo
- Clear recommendation (Approved/Conditional/Declined)
- Risk assessment with mitigants
- Conditions and covenants
- **Complete citations for all data**

---

## 🚀 How to Upload

### Quick Version (3 steps):
1. **claude.ai** → Settings → Capabilities
2. **Upload skill** → select `ci-credit-memo-skill.zip`
3. **Test:** "I need to create a credit memo for ABC Manufacturing"

### Detailed Version:
See [ENTERPRISE_UPLOAD_INSTRUCTIONS.md](ENTERPRISE_UPLOAD_INSTRUCTIONS.md)

---

## ✨ Key Features

- ✅ **Demo Mode**: Say "use demo data" and it generates realistic placeholders
- ✅ **Citation Tracking**: Every data point has a source
- ✅ **DSCR Focus**: Emphasizes the most critical ratio (minimum 1.25x)
- ✅ **Risk-Based Decisions**: Recommends approve/decline based on analysis
- ✅ **Professional Output**: Bank-quality credit memos
- ✅ **Flexible Interview**: Adapts questions based on responses

---

## 🧪 Recommended First Test

Start a new conversation in claude.ai and type:

```
I need to create a demo credit memo for a $5M line of credit
to a private manufacturing company with $20M revenue.
Use realistic placeholder data showing a moderate risk profile.
```

**Expected result:** 
- Interview questions
- Financial analysis with all ratios calculated
- Complete 8-section credit memo
- Clear recommendation with supporting rationale
- All demo data marked with disclaimers

---

## 📊 Validation Checklist

After your first test, verify the output has:

- [ ] All 8 sections present (Executive Summary through Citations)
- [ ] **DSCR calculated** and compared to 1.25x minimum
- [ ] All ratios calculated and compared to benchmarks
- [ ] Five C's analysis included
- [ ] 3-5 risks identified with mitigants
- [ ] Clear recommendation (Approved/Conditional/Declined)
- [ ] **Citations section** with sources for all data
- [ ] Professional markdown formatting
- [ ] Demo disclaimers (if demo mode)

---

## 🎓 Advanced Usage

### Customize for Your Bank
Edit files in `ci-credit-memo-skill/` directory:
- Adjust DSCR threshold in SKILL.md
- Add bank-specific policies in UNDERWRITING_STANDARDS.md
- Customize covenant templates in MEMO_TEMPLATE.md
- Re-zip and re-upload

### Test Scenarios
Try these to validate all features:
1. **Demo mode**: "Use placeholder data"
2. **Real public company**: "Credit memo for Apple Inc."
3. **Private company**: "I have financial statements to upload"
4. **Challenging credit**: "DSCR is 0.90x" (should decline)
5. **Edge case**: "Declining revenue but strong coverage"

---

## 📁 File Locations

All files are in: `/Users/gjacobi/BankExplorer/Banks/`

- **Upload this:** `ci-credit-memo-skill.zip` ⭐
- **Read first:** `QUICK_START.md`
- **Full guide:** `ENTERPRISE_UPLOAD_INSTRUCTIONS.md`
- **This summary:** `PACKAGE_SUMMARY.md`
- **Source files:** `ci-credit-memo-skill/` (directory)

---

## 🔍 Technical Details

### YAML Frontmatter (validated)
```yaml
---
name: ci-credit-memo
description: Generate comprehensive Commercial & Industrial (C&I) loan 
  credit memos for banking demos. Interviews bankers, gathers data, 
  handles file uploads, tracks citations, and produces standardized 
  credit approval documents. Use when a banker needs to create a 
  credit memo for a C&I loan application.
---
```

### Format Compliance
- ✅ Name: lowercase with hyphens
- ✅ Description: under 1024 characters
- ✅ Structure: SKILL.md inside single top-level directory
- ✅ Size: 37KB (well under limits)
- ✅ No invalid frontmatter fields

---

## 💡 Pro Tips

1. **Be explicit in your test prompts** - Include company name, loan amount, industry
2. **Let the interview flow** - Don't provide all info upfront
3. **Test demo mode first** - Easiest way to see complete functionality
4. **Verify DSCR calculation** - Most critical ratio for approval
5. **Check citations** - Every data point should have a source

---

## 🎯 Success Criteria

Your test is successful if you get:
1. ✅ Complete 8-section credit memo
2. ✅ DSCR calculated (with 1.25x threshold check)
3. ✅ All ratios analyzed
4. ✅ Risk assessment with 3-5 risks
5. ✅ Clear recommendation with rationale
6. ✅ Citations section listing all data sources
7. ✅ Professional formatting
8. ✅ Demo disclaimers (if demo mode)

---

## 🚦 Next Steps

1. **Upload:** Go to claude.ai and upload `ci-credit-memo-skill.zip`
2. **Test:** Start new conversation with "Create a credit memo for..."
3. **Validate:** Check output against validation checklist
4. **Iterate:** Edit and re-upload if needed
5. **Deploy:** Share ZIP with other users in your organization

---

## 📞 Need Help?

- **Quick questions:** See [QUICK_START.md](QUICK_START.md)
- **Upload issues:** See [ENTERPRISE_UPLOAD_INSTRUCTIONS.md](ENTERPRISE_UPLOAD_INSTRUCTIONS.md)
- **Skill not working:** Check that Skills are enabled in Capabilities settings
- **Wrong output:** Verify SKILL.md uploaded correctly by checking skill description

---

## ✅ Package Validation

**Status:** ✅ Ready for Upload

- [x] ZIP file created
- [x] Structure validated (SKILL.md in correct location)
- [x] YAML frontmatter validated
- [x] File size acceptable (37KB)
- [x] All resource files included
- [x] Documentation complete

**You're all set! Upload and test when ready.** 🚀

---

**Quick Upload:** claude.ai → Settings → Capabilities → Skills → Upload skill → `ci-credit-memo-skill.zip`
