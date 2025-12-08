# Getting Started with the C&I Credit Memo Skill

## 🚀 Quick Start (3 Ways to Use)

### 1️⃣ Real Deal with Public Company
```
You: "I need a credit memo for a $5M line of credit for Tesla Inc"

The skill will:
→ Query Morningstar for Tesla financials
→ Query S&P for credit ratings and industry data
→ Query Aiera for recent earnings call insights
→ Query LSEG for market data
→ Analyze and generate complete credit memo with citations
```

### 2️⃣ Private Company with Documents
```
You: "Help me create a credit memo for XYZ Manufacturing.
     They need a $2M term loan for equipment.
     I have their financial statements to upload."

The skill will:
→ Interview you about the deal details
→ Process your uploaded financial PDFs/Excel
→ Gather industry benchmarks from S&P
→ Analyze and generate credit memo
```

### 3️⃣ Demo Mode
```
You: "I need a demo credit memo for a presentation.
     Make up realistic data for a $3M equipment loan
     to a mid-sized manufacturing company."

The skill will:
→ Ask what risk profile to model (strong/moderate/challenging)
→ Generate realistic simulated financials
→ Create proper credit memo with "DEMO DATA" disclaimers
→ Show analytical approach with fictional but realistic numbers
```

---

## 📁 What You Got

### Core Files:
1. **SKILL.md** (851 lines)
   - Main skill instructions
   - Auto-loaded by Claude Code
   - Contains complete workflow (interview → data → analysis → memo)

2. **MEMO_TEMPLATE.md** (1,029 lines)
   - Exact format for credit memo output
   - All sections pre-structured
   - Demo disclaimer templates included

3. **UNDERWRITING_STANDARDS.md** (955 lines)
   - Financial ratio targets and thresholds
   - Risk rating system (1-10 scale)
   - Five C's framework
   - Industry-specific guidelines
   - Regulatory guidance summary

4. **INTERVIEW_GUIDE.md** (82 lines)
   - Key questions organized by topic
   - Best practices for interviews
   - Minimum required information checklist

5. **README.md** (380 lines)
   - Complete overview and documentation
   - Usage examples
   - Integration details
   - Customization guide

6. **GETTING_STARTED.md** (this file)
   - Quick reference
   - Simple examples

---

## ⚡ Activation Triggers

The skill activates automatically when you say:

| Phrase | What Happens |
|--------|--------------|
| "I need to create a credit memo" | ✓ Activates skill |
| "Help me write a credit approval" | ✓ Activates skill |
| "Credit memo for [company]" | ✓ Activates skill |
| "Underwrite a C&I loan" | ✓ Activates skill |
| "Commercial loan analysis for [company]" | ✓ Activates skill |

---

## 🔄 The Workflow (What Happens Automatically)

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: INTERVIEW (2-5 minutes)                            │
├─────────────────────────────────────────────────────────────┤
│ • Company name, industry, public/private?                   │
│ • Loan type, amount, purpose?                               │
│ • Available data sources?                                   │
│ • Demo mode or real deal?                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: DATA COLLECTION (automatic)                        │
├─────────────────────────────────────────────────────────────┤
│ If PUBLIC:                                                  │
│   → Morningstar: financials, fundamentals                   │
│   → S&P: ratings, industry benchmarks                       │
│   → Aiera: earnings calls, management commentary            │
│   → LSEG: market data, analyst estimates                    │
│                                                             │
│ If PRIVATE:                                                 │
│   → Prompt for document upload (PDF/Excel)                  │
│   → Process and extract financial data                      │
│   → Get industry benchmarks from S&P                        │
│                                                             │
│ If DEMO:                                                    │
│   → Generate realistic simulated data                       │
│   → Mark all data as "DEMO DATA"                            │
│                                                             │
│ ✓ ALL SOURCES TRACKED WITH CITATIONS                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: FINANCIAL ANALYSIS (automatic)                     │
├─────────────────────────────────────────────────────────────┤
│ • Calculate ALL key ratios:                                 │
│   - DSCR (critical: must be ≥1.25x)                         │
│   - Debt-to-Worth, Debt-to-EBITDA                           │
│   - Current Ratio, Quick Ratio                              │
│   - Profitability ratios (margins, ROA, ROE)                │
│                                                             │
│ • Compare to industry benchmarks                            │
│ • Analyze 3-5 year trends                                   │
│ • Stress test scenarios                                     │
│ • Apply Five C's framework                                  │
│ • Identify top 3-5 risks + mitigants                        │
│ • Assign risk rating (1-10)                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: MEMO GENERATION (automatic)                        │
├─────────────────────────────────────────────────────────────┤
│ Creates formatted credit memo with:                         │
│                                                             │
│ 1. Executive Summary                                        │
│ 2. Loan Request Details                                     │
│ 3. Borrower Analysis                                        │
│ 4. Financial Analysis (tables, ratios, trends)              │
│ 5. Risk Assessment (with mitigants)                         │
│ 6. Recommendation & Conditions                              │
│ 7. Appendices                                               │
│ 8. Citations & Data Sources (complete list)                 │
│                                                             │
│ ✓ Consistent formatting                                     │
│ ✓ Professional banking terminology                          │
│ ✓ Clear recommendation (Approve/Decline/Conditional)        │
│ ✓ Demo disclaimers if applicable                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Key Features

### ✅ Citation Tracking (Every Data Point)
Every number, fact, and analysis point is cited:
- "Revenue $52M: Morningstar - Tesla 10-K 2024, retrieved 2025-12-02"
- "Industry growth 8.5%: S&P Industry Report - Auto Manufacturing Q4 2024"
- "Management expects 15% growth: Aiera - Earnings call Q3 2024, CEO remarks"
- "DEMO DATA: Revenue $45M - Simulated for demonstration purposes only"

### ✅ Comprehensive Ratio Analysis
Calculates and interprets:
- **Liquidity:** Current Ratio, Quick Ratio, Working Capital
- **Leverage:** Debt-to-Worth, Debt-to-EBITDA, Total Liabilities/Assets
- **Coverage:** DSCR (critical!), Interest Coverage
- **Profitability:** Gross/Operating/Net Margins, ROA, ROE
- **Efficiency:** DSO, DIO, Cash Conversion Cycle

### ✅ Risk Assessment Framework
- Identifies top 3-5 risks
- Documents mitigating factors for each
- Assigns probability and severity
- Recommends monitoring/covenants
- Provides overall risk rating (1-10 scale)

### ✅ Demo Mode Support
Perfect for bank presentations:
- Generates realistic simulated data
- Prominent disclaimers throughout
- Clear "DEMO DATA" labels on all simulated values
- Shows proper analytical approach
- Still includes citation section (marking demo sources)

---

## 🔧 MCP Server Setup (For Real Data)

### Required MCP Servers:
1. **Morningstar** - Company financials and fundamentals
2. **S&P Capital IQ** - Credit ratings and industry data
3. **Aiera** - Earnings call transcripts
4. **LSEG (Refinitiv)** - Market data and analyst estimates

### If MCP Servers Not Yet Set Up:
No problem! The skill will:
- Use web search as fallback
- Prompt for manual document upload
- Offer demo mode
- Clearly document what data sources were used

You mentioned these will be set up, so once they're configured, the skill will automatically use them.

---

## 📊 Critical Underwriting Thresholds

### Must-Know Minimums:

| Metric | Minimum | Target | Formula |
|--------|---------|--------|---------|
| **DSCR** | **1.25x** | 1.50x+ | EBITDA / Annual Debt Service |
| Current Ratio | 1.2 | 1.5-2.0 | Current Assets / Current Liabilities |
| Debt-to-Worth | - | <3.0-4.0x | Total Liabilities / Tangible Net Worth |
| Debt-to-EBITDA | - | <3.0-4.0x | Total Debt / EBITDA |

**DSCR is the most critical ratio** - Below 1.25x typically requires exceptional circumstances to approve.

---

## 💡 Pro Tips

### For Best Results:

1. **Be Specific About Purpose**
   - ❌ "Working capital"
   - ✅ "Seasonal inventory buildup for Q4 holiday sales surge"

2. **Mention Known Risks Upfront**
   - "By the way, their top customer is 40% of revenue"
   - "The founder is retiring next year"
   - "They had a loss in 2023 due to supply chain issues"

3. **Clarify Demo vs. Real Immediately**
   - "This is for a demo presentation"
   - "This is a real deal, I have their financials"

4. **Upload Documents When Possible**
   - More accurate than manual entry
   - Allows page-specific citations
   - Faster processing

5. **Review Generated Ratios**
   - Verify calculations match your expectations
   - Check that benchmarks seem reasonable
   - Confirm risk assessment aligns with your view

---

## 🎓 Example Conversations

### Example 1: Quick Demo
```
You: "I need a demo credit memo. Make up a strong borrower
     requesting $2M for equipment. Manufacturing sector."

Skill: "I'll create a demo credit memo with a strong credit profile.

       A few quick details:
       1. What type of manufacturing? (helps with realistic benchmarks)
       2. What equipment specifically? (CNC machines, packaging line, etc.)
       3. Any specific aspects you want to demonstrate in the analysis?"

You: "Industrial machinery manufacturing. CNC machines.
     Show how to handle customer concentration risk."

Skill: [Generates complete credit memo with:]
       → Realistic financials for industrial machinery sector
       → Customer concentration identified as risk with mitigants
       → DEMO DATA disclaimers throughout
       → Proper analytical structure
```

### Example 2: Real Deal, Has Documents
```
You: "Credit memo for ABC Manufacturing. $3M line of credit
     for working capital. Private company. I'll upload their
     financials now."

Skill: "Great! I'll help you create the credit memo for ABC Manufacturing.

       While you're uploading the financials, can you tell me:
       1. What does ABC Manufacturing make?
       2. How long have they been in business?
       3. How much are they currently drawing on any existing line?"

You: "They make automotive parts. 25 years in business.
     Currently have a $2M line, drawing about $1.5M typically."

Skill: [Processes uploaded financials]
       "I've extracted their financial data. I see:
       • Revenue $45M in 2024 (up from $42M in 2023)
       • EBITDA $5.2M (11.6% margin)
       • Some customer concentration - top 3 = 60%

       Let me gather industry benchmarks and complete the analysis..."

[Generates complete credit memo]
```

### Example 3: Public Company, Full Auto
```
You: "I need a credit memo for Ford Motor Company.
     $10M revolving line of credit."

Skill: "I'll create a credit memo for Ford Motor Company.

       Quick questions:
       1. What's the purpose of the line? (Working capital, specific project?)
       2. What terms are you proposing? (Rate, maturity)
       3. What collateral?"

You: "General working capital. Prime + 1.5%, 1 year renewable.
     Blanket lien on assets."

Skill: "Perfect. Let me gather Ford's financial data...

       [Querying Morningstar for financials...]
       [Querying S&P for credit rating and industry data...]
       [Querying Aiera for recent earnings commentary...]
       [Querying LSEG for market data...]

       I've gathered comprehensive data. Analyzing now..."

[Generates complete credit memo with all data properly cited]
```

---

## ❓ FAQ

### Q: Can I use this for CRE loans?
**A:** Currently optimized for C&I loans. CRE support planned for future version. Key differences are collateral analysis (property vs. equipment/A/R) and metrics (LTV, NOI vs. DSCR, EBITDA).

### Q: What if MCP servers aren't set up yet?
**A:** The skill works in demo mode or with uploaded documents. Once MCP servers are configured, they'll be used automatically.

### Q: Can I modify the templates?
**A:** Yes! Edit any of the .md files:
- **SKILL.md** - Change workflow or instructions
- **MEMO_TEMPLATE.md** - Adjust output format
- **UNDERWRITING_STANDARDS.md** - Update thresholds for your bank's policies

### Q: Does it work for startups with no history?
**A:** Yes, but requires more manual input. The skill will request projections, owner financial strength, and detailed business plan analysis.

### Q: Can it handle exceptions to policy?
**A:** Yes. The skill identifies policy exceptions (e.g., DSCR below 1.25x) and prompts for justification/mitigants to document in the memo.

### Q: What about foreign companies?
**A:** Best for US-based companies currently. International companies may have limited data availability in MCP servers.

---

## 🚦 Next Steps

**Ready to try it? Just say:**

> "I need to create a credit memo"

or

> "Help me create a demo credit memo for a manufacturing company"

**The skill will activate and guide you through the process!**

---

## 📚 Reference Documents

- **[SKILL.md](SKILL.md)** - Complete skill instructions
- **[MEMO_TEMPLATE.md](MEMO_TEMPLATE.md)** - Output format reference
- **[UNDERWRITING_STANDARDS.md](UNDERWRITING_STANDARDS.md)** - Ratios and guidelines
- **[INTERVIEW_GUIDE.md](INTERVIEW_GUIDE.md)** - Question reference
- **[README.md](README.md)** - Full documentation

---

**Questions? Issues? Suggestions?**

The skill is designed to be conversational - if something isn't working as expected, just tell it! For example:

- "That ratio doesn't look right, can you recalculate?"
- "I need more detail on the risk analysis"
- "Can you add a section about environmental considerations?"
- "The demo disclaimer should be more prominent"

The skill will adapt and adjust based on your feedback during execution.

---

**Skill Version:** 1.0 (December 2025)
**Skill Location:** `.claude/skills/ci-credit-memo/`
**Created For:** Bank demonstrations and C&I credit underwriting
