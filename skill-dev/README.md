# Skill Development Directory

This directory contains skills under development for commercial lending workflows.

## Skills in Development

### 1. credit-analyst-skill
**Status:** ✅ Ready for testing
**Purpose:** Independent credit analyst that reviews C&I loan credit memos

**Key Features:**
- Independent risk assessment
- Recalculates and verifies financial ratios
- Identifies additional risks beyond banker's analysis
- Validates policy compliance
- Provides recommendations: Concur/Conditional/Non-Concur/Refer

**Files:**
- `SKILL.md` - Main skill instructions
- `resources/UNDERWRITING_STANDARDS.md` - Ratio thresholds and policies
- `resources/ANALYST_REVIEW_FRAMEWORK.md` - Detailed methodology
- `resources/RED_FLAGS_GUIDE.md` - Warning signs reference

### 2. ci-credit-memo-skill
**Status:** ✅ Ready for testing
**Purpose:** Commercial banker that creates comprehensive C&I loan credit memos

**Key Features:**
- Interview-based information gathering
- Data collection from multiple sources
- Financial ratio calculation (DSCR focus)
- Five C's analysis framework
- Professional 8-section credit memo generation

**Files:**
- `SKILL.md` - Main skill instructions
- `resources/MEMO_TEMPLATE.md` - Standard memo format
- `resources/UNDERWRITING_STANDARDS.md` - Ratio thresholds
- `resources/INTERVIEW_GUIDE.md` - Question templates

---

## Development Workflow

### Making Changes

1. **Edit files** in the respective skill directory
2. **Test locally** if needed
3. **When ready to test in Claude Code:**
   - Install to `.claude/skills/` using proper installation process
   - Test the skill in conversations
4. **Iterate** based on testing results

### Installing to Claude Code

When ready to test a skill in Claude Code:

```bash
# Option 1: Manual copy
cp -r skill-dev/credit-analyst-skill .claude/skills/

# Option 2: Symlink for easier development
ln -s ../../skill-dev/credit-analyst-skill .claude/skills/credit-analyst-skill
```

### Creating ZIP for Enterprise Upload

When ready to upload to claude.ai Enterprise:

```bash
# From Banks directory
cd skill-dev
zip -r ../credit-analyst-skill.zip credit-analyst-skill -x "*.DS_Store" -x "__MACOSX/*"
zip -r ../ci-credit-memo-skill.zip ci-credit-memo-skill -x "*.DS_Store" -x "__MACOSX/*"
```

---

## How the Skills Work Together

**Workflow:**

1. **Commercial Banker (ci-credit-memo)** creates credit memo
   - Gathers loan details through interview
   - Analyzes financials
   - Generates professional credit memo
   - Provides recommendation

2. **Credit Analyst (credit-analyst-skill)** reviews memo
   - Independent assessment
   - Verifies calculations
   - Identifies additional risks
   - Provides separate recommendation

3. **Credit Committee** receives both perspectives
   - Banker's view (relationship-focused)
   - Analyst's view (risk-focused)
   - Makes informed decision

---

## Testing Checklist

### Credit Analyst Skill

Test scenarios:
- [ ] Review a strong credit memo (should CONCUR)
- [ ] Review a weak credit memo with DSCR < 1.25x (should NON-CONCUR)
- [ ] Review a marginal credit (should add CONDITIONS)
- [ ] Identify calculation errors in banker's memo
- [ ] Find risks banker missed
- [ ] Validate policy compliance

### CI Credit Memo Skill

Test scenarios:
- [ ] Create demo credit memo
- [ ] Interview flow (2-3 questions at a time)
- [ ] Calculate DSCR correctly
- [ ] Generate all 8 sections
- [ ] Include citations for all data
- [ ] Handle missing information gracefully

---

## Current Status

**Both skills are complete and ready for testing!**

Next steps:
1. Install to `.claude/skills/` for local testing
2. Test in Claude Code conversations
3. Upload to claude.ai Enterprise for production use

---

## File Structure

```
skill-dev/
├── README.md (this file)
├── credit-analyst-skill/
│   ├── SKILL.md
│   └── resources/
│       ├── ANALYST_REVIEW_FRAMEWORK.md
│       ├── RED_FLAGS_GUIDE.md
│       ├── UNDERWRITING_STANDARDS.md
│       └── README.md
└── ci-credit-memo-skill/
    ├── SKILL.md
    └── resources/
        ├── MEMO_TEMPLATE.md
        ├── UNDERWRITING_STANDARDS.md
        ├── INTERVIEW_GUIDE.md
        └── README.md
```

---

## Notes

- Both skills share `UNDERWRITING_STANDARDS.md` but maintain separate copies
- Skills use proper YAML frontmatter for Enterprise compatibility
- All skills are validated and packaged for upload
- ZIP files are in parent directory (`../`) for easy upload
