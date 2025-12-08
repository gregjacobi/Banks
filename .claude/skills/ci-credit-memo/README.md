# C&I Credit Memo Generator Skill

## Overview

This skill helps commercial bankers create comprehensive credit memos for Commercial & Industrial (C&I) loan applications. It automates the interview process, gathers data from multiple sources (Morningstar, S&P, Aiera, LSEG), performs financial analysis, and generates standardized credit approval documents.

## How It Works

The skill activates automatically when you mention keywords like:
- "I need to create a credit memo"
- "Help me write a credit approval"
- "I need to underwrite a C&I loan"
- "Credit memo for [company name]"

Once activated, the skill follows a structured 4-phase workflow:

### Phase 1: Interview & Information Gathering
- Asks targeted questions about the borrower, loan request, and deal structure
- Adapts based on your responses
- Identifies gaps in information

### Phase 2: Data Collection with Citation Tracking
- **For public companies:**
  - Queries Morningstar for financials
  - Queries S&P for ratings and industry data
  - Queries Aiera for earnings call transcripts
  - Queries LSEG for market data
- **For private companies:**
  - Prompts for financial statement uploads
  - Gathers industry benchmarks from available sources
- **All data sources are tracked with proper citations**

### Phase 3: Financial Analysis
- Calculates all key ratios (DSCR, leverage, liquidity, profitability)
- Compares to industry benchmarks
- Performs stress testing
- Identifies top risks and mitigants
- Applies the Five C's framework

### Phase 4: Credit Memo Generation
- Creates formatted credit memo using standardized template
- Includes all required sections
- Properly cites all data sources
- Generates clear recommendation with supporting rationale

## Demo Mode

The skill fully supports **demo mode** for demonstrations:

When you say:
- "Just make up the numbers"
- "Use placeholder data"
- "This is for a demo"

The skill will:
- Generate realistic simulated data
- Clearly mark all demo data with warnings
- Add prominent disclaimers throughout the memo
- Maintain proper structure and analytical rigor
- Still cite all sources (marking demo data appropriately)

## File Structure

```
.claude/skills/ci-credit-memo/
├── SKILL.md                      # Main skill instructions (AUTO-LOADED by Claude)
├── MEMO_TEMPLATE.md              # Standard credit memo format
├── UNDERWRITING_STANDARDS.md     # Ratio guidelines and thresholds
├── INTERVIEW_GUIDE.md            # Detailed interview questions
└── README.md                     # This file
```

## Key Features

### ✓ Comprehensive Interview Process
- Guided questions covering all critical areas
- Adaptive based on loan type and responses
- Handles missing information gracefully

### ✓ Multi-Source Data Gathering
- **MCP Integration:** Morningstar, S&P, Aiera, LSEG
- **Web Search:** For industry trends and company news
- **File Upload:** PDF and Excel financial statements
- **Manual Input:** Fallback when other sources unavailable

### ✓ Complete Citation Tracking
Every data point is tracked with its source:
- MCP queries (with timestamp)
- Uploaded documents (with filename and page)
- Web sources (with URL and date)
- Demo data (clearly marked)

### ✓ Rigorous Financial Analysis
- All standard C&I ratios calculated
- Industry benchmarking
- Trend analysis (3-5 years)
- Stress testing scenarios
- Five C's framework applied

### ✓ Risk Assessment
- Top 3-5 risks identified
- Mitigation strategies documented
- Risk rating assigned
- Policy compliance verified

### ✓ Standardized Output
- Consistent formatting across all memos
- Professional banking terminology
- Clear recommendation (Approve/Decline/Conditional)
- Complete supporting documentation

## Usage Examples

### Example 1: Public Company C&I Loan

**You:** "I need to create a credit memo for a $5M line of credit for Acme Manufacturing"

**Skill Response:**
```
I'll help you create a comprehensive credit memo for this C&I loan.
Let me start by gathering some basic information:

1. Is Acme Manufacturing a publicly traded or private company?
2. What industry/sector are they in?
3. What will they use the line of credit for?
```

The skill will then:
- Interview you about the deal
- Query Morningstar/S&P/Aiera/LSEG for public company data
- Analyze financials and calculate ratios
- Generate complete credit memo with citations

---

### Example 2: Private Company with File Upload

**You:** "Help me underwrite a $2M term loan for a private manufacturing company. I have their financials."

**Skill Response:**
```
I'll help you create the credit memo for this $2M term loan.

Since this is a private company, I'll need some financial information.
Can you tell me:
1. What is the company name?
2. What specific type of manufacturing?
3. What will the term loan be used for?

Also, please upload the financial statements when ready (PDF or Excel format).
I need at least 2-3 years of historical financials.
```

The skill will:
- Guide the interview process
- Process uploaded PDF/Excel files
- Extract and analyze financial data
- Gather industry benchmarks from S&P
- Generate credit memo with proper citations

---

### Example 3: Demo Mode

**You:** "I need to create a demo credit memo for a bank presentation. Just make up realistic numbers for a $3M equipment loan."

**Skill Response:**
```
Understood! I'll create a realistic demo credit memo for a $3M equipment loan.
This will be clearly marked as simulated data throughout the document.

To make this realistic, what scenario should I model?
1. Strong borrower - exceeds all underwriting guidelines
2. Moderate risk - meets guidelines but some concerns
3. Challenging credit - requires strong mitigants

Also, what industry should the borrower be in?
```

The skill will:
- Generate realistic financial data
- Create proper credit memo structure
- Add prominent "DEMO DATA" disclaimers
- Mark all simulated values clearly
- Still demonstrate proper analytical approach

## Reference Documents

### MEMO_TEMPLATE.md
Complete template showing exact structure and formatting for credit memos. Includes:
- Header format
- Section structure (Executive Summary through Citations)
- Table formats for financial data
- Risk assessment framework
- Demo mode disclaimer templates

### UNDERWRITING_STANDARDS.md
Comprehensive reference guide including:
- Target ratios for all key metrics
- Risk rating system (1-10 scale)
- Five C's framework details
- Loan structuring guidelines
- Collateral valuation standards
- Industry-specific considerations
- Regulatory guidance summary

### INTERVIEW_GUIDE.md
Detailed question bank organized by:
- Loan type (line of credit, term loan, equipment, acquisition)
- Topic area (company background, financials, collateral, risks)
- Interview tips and best practices

## MCP Server Integration

### Required MCP Servers

For full functionality, ensure these MCP servers are configured:

1. **Morningstar** - Company financials, stock data, fundamentals
2. **S&P Capital IQ** - Credit ratings, industry benchmarks, research
3. **Aiera** - Earnings call transcripts, management commentary
4. **LSEG (Refinitiv)** - Market data, analyst estimates, news

### Fallback Strategy

If MCP servers are not available, the skill will:
1. Attempt web search for public information
2. Prompt for manual file upload
3. Offer demo mode with simulated data
4. Clearly document what data is missing

## Key Metrics & Thresholds

### Critical Ratio: Debt Service Coverage Ratio (DSCR)
- **Minimum:** 1.25x (absolute floor for approval)
- **Target:** 1.50x+ (comfortable cushion)
- **Formula:** EBITDA / Annual Debt Service

### Other Key Ratios
- **Current Ratio:** Target 1.2 - 2.0
- **Debt-to-Tangible Net Worth:** Target < 3.0x - 4.0x
- **Debt-to-EBITDA:** Target < 3.0x - 4.0x

See [UNDERWRITING_STANDARDS.md](UNDERWRITING_STANDARDS.md) for complete ratio guide.

## Output Format

The skill generates a markdown-formatted credit memo saved as:
```
CreditMemo_[CompanyName]_[LoanAmount]_[Date].md
```

Example: `CreditMemo_Acme_Manufacturing_5000K_20251202.md`

The memo includes:
- Executive Summary
- Loan Request Details
- Borrower Analysis
- Financial Analysis (with ratio tables)
- Risk Assessment
- Recommendation & Conditions
- Appendices
- Complete Citations & Data Sources

## Best Practices

### For Best Results:

1. **Have key information ready:**
   - Company name and industry
   - Loan amount and purpose
   - Financial statements (if available)

2. **Be specific about purpose:**
   - Not just "working capital" but "seasonal inventory buildup for Q4"
   - Not just "equipment" but "CNC machine for increased capacity"

3. **Identify known risks:**
   - Customer concentration
   - Key person dependency
   - Industry challenges
   - Any recent issues

4. **Clarify demo vs. real:**
   - If demonstrating, say so upfront
   - If real deal, indicate what data is available

5. **Upload documents when possible:**
   - Better than manual data entry
   - Allows citation of specific pages
   - More accurate analysis

## Limitations

### What This Skill Does NOT Do:

- ❌ Make credit decisions (provides recommendation and analysis only)
- ❌ Replace banker's judgment and expertise
- ❌ Guarantee regulatory compliance (follows guidelines but institution-specific policies vary)
- ❌ Access non-public information (only uses provided or publicly available data)
- ❌ Execute loan documents (analysis and memo only)

### Always Review:

- ✓ Verify all calculations
- ✓ Confirm data sources are appropriate
- ✓ Check that analysis aligns with your bank's policies
- ✓ Ensure recommendation is supportable
- ✓ Review citations for accuracy
- ✓ Confirm demo disclaimers if applicable

## Support & Customization

### Adapting to Your Bank's Policies

The skill uses industry-standard underwriting guidelines, but you should customize for your institution:

**In UNDERWRITING_STANDARDS.md:**
- Adjust minimum DSCR threshold (if different from 1.25x)
- Modify leverage limits
- Update risk rating scale
- Add institution-specific covenants

**In SKILL.md:**
- Add bank-specific terminology
- Include proprietary risk models
- Reference internal pricing grids
- Add bank-specific compliance requirements

### Questions or Issues?

If the skill:
- Misses critical information
- Uses incorrect formulas
- Doesn't follow your bank's format
- Has outdated regulatory guidance

You can:
1. Edit the SKILL.md file to update instructions
2. Modify templates in MEMO_TEMPLATE.md
3. Update standards in UNDERWRITING_STANDARDS.md
4. Provide feedback during skill execution

## Version History

**v1.0 (December 2025)**
- Initial release
- Support for C&I loans (lines of credit, term loans, equipment financing)
- Integration with Morningstar, S&P, Aiera, LSEG MCP servers
- Demo mode support
- Complete citation tracking
- Standardized output template

**Planned Enhancements:**
- Support for CRE loans
- Support for acquisition financing
- Covenant monitoring templates
- Portfolio-level analysis
- Multi-borrower credit analysis

---

## Quick Start

**To use this skill, simply start a conversation with:**

> "I need to create a credit memo for [company name]"

or

> "Help me underwrite a C&I loan for [company name]"

The skill will activate automatically and guide you through the process!

---

**Skill Location:** `.claude/skills/ci-credit-memo/`
**Primary File:** `SKILL.md` (auto-loaded by Claude Code)
**Created:** December 2025
**For:** Bank demonstrations and C&I credit underwriting
