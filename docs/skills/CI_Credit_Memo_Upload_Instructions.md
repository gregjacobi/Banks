# How to Test the C&I Credit Memo Skill in Claude.ai

## 📋 Step-by-Step Upload Instructions

### Step 1: Create a New Project in Claude.ai

1. Go to [claude.ai](https://claude.ai)
2. Click on **"Projects"** in the left sidebar
3. Click **"Create Project"**
4. Name it: **"C&I Credit Memo Generator"**
5. Add a description: **"Commercial loan credit memo creation tool"**

### Step 2: Add the Skill Instructions

1. In your new project, click **"Add content"** or the **Settings** icon
2. Click **"Set custom instructions"**
3. Open the file: `CI_Credit_Memo_Skill_Package.md`
4. Copy the ENTIRE contents of that file
5. Paste it into the **Project Instructions** field
6. Click **"Save"**

### Step 3: Start Testing

1. Click **"Start chatting"** or create a new conversation in the project
2. The skill is now active for all conversations in this project!

---

## 🧪 Test Scenarios

### Test 1: Simple Public Company Credit Memo

**User Message:**
```
I need to create a credit memo for a $3M line of credit for Apple Inc.
It's for working capital. Can you help?
```

**Expected Behavior:**
- Claude should recognize this as a credit memo request
- Start asking interview questions (company details, loan terms, etc.)
- Offer to search for Apple's financial data
- Guide you through the full interview process
- Eventually generate a complete credit memo

---

### Test 2: Demo Mode Credit Memo

**User Message:**
```
I need to create a demo credit memo for a bank presentation.
It's for a $5M term loan to a private manufacturing company.
Just make up realistic numbers.
```

**Expected Behavior:**
- Claude should recognize "demo" mode
- Ask what scenario to model (strong/moderate/marginal borrower)
- Generate realistic financial data
- Create complete memo with prominent **"DEMO DATA"** disclaimers
- All citations should indicate data is simulated

---

### Test 3: Private Company with File Upload

**User Message:**
```
Help me underwrite a $2M equipment loan for ABC Manufacturing (private company).
I have their financial statements I can upload.
```

**Expected Behavior:**
- Start interview process
- Ask you to upload financial statements
- Once you "upload" (or say you have them), offer to analyze
- Generate credit memo citing the uploaded documents

**Note:** Since you can't actually upload files in this test, you can simulate by saying:
```
Here are the key financials from their statements:
Revenue 2024: $15M
EBITDA 2024: $2.5M
Total Debt: $4M
Current Assets: $3M
Current Liabilities: $1.5M
```

---

### Test 4: Challenging Credit (Should Decline)

**User Message:**
```
Credit memo for $10M term loan to XYZ Corp. Use demo data.
The company has declining revenue (down 20% last year),
DSCR around 0.90x, and heavy customer concentration.
```

**Expected Behavior:**
- Generate credit memo
- Calculate ratios and identify violations (DSCR below 1.25x minimum)
- **Recommendation should be: DECLINED**
- Should provide clear rationale for decline
- Should suggest alternative structures or what would need to change

---

## ✅ Validation Checklist

After running a test, verify the output includes:

### Structure & Format
- [ ] Clear memo header with borrower, amount, recommendation
- [ ] Table of contents
- [ ] Executive summary (concise, <1 page equivalent)
- [ ] All 8 main sections present
- [ ] Professional markdown formatting (tables, headers, bullets)
- [ ] Consistent currency formatting ($X.XM)
- [ ] Consistent ratio formatting (X.XXx)

### Interview Process
- [ ] Asked questions in small batches (2-3 at a time)
- [ ] Adapted questions based on responses
- [ ] Handled missing data gracefully
- [ ] Recognized demo mode if mentioned

### Financial Analysis
- [ ] All key ratios calculated (liquidity, leverage, coverage, profitability)
- [ ] **DSCR prominently featured and calculated correctly**
- [ ] Ratios compared to industry benchmarks
- [ ] Five C's analysis included
- [ ] Stress testing scenarios included

### Risk Assessment
- [ ] 3-5 specific risks identified
- [ ] Each risk rated (High/Medium/Low)
- [ ] Mitigants provided for each risk
- [ ] Overall risk rating assigned and justified

### Recommendation
- [ ] Clear recommendation (Approved/Approved with Conditions/Declined)
- [ ] Detailed rationale supporting recommendation
- [ ] Conditions precedent listed (if approved)
- [ ] Covenants specified (if approved)
- [ ] **Decline is justified with specific policy violations (if declined)**

### Citations
- [ ] **Every data point has a source cited**
- [ ] Citations section at end is complete
- [ ] Demo data clearly marked (if demo mode)
- [ ] Demo disclaimer prominent (if demo mode)

### Professional Quality
- [ ] Banking terminology used correctly
- [ ] Objective tone (not overly positive or negative)
- [ ] Balanced analysis (strengths AND weaknesses)
- [ ] Clear writing, no typos
- [ ] Actionable for credit committee

---

## 🐛 Common Issues & Solutions

### Issue: Claude doesn't recognize it as a credit memo request

**Solution:** Be more explicit:
```
Activate the credit memo skill. I need to create a credit memo for [company].
```

### Issue: Claude asks all questions at once (overwhelming)

**Problem:** The instructions say to ask 2-3 at a time
**If this happens:** Provide feedback:
```
That's too many questions at once. Let's go through them 2-3 at a time.
```

### Issue: No citations in the output

**Problem:** Critical requirement is missing
**Action:** Report this as a bug - citations are mandatory in the instructions

### Issue: DSCR calculation is wrong

**Formula should be:** EBITDA / Annual Debt Service
**Check:** Pro forma calculation includes both existing and proposed debt service

### Issue: Demo mode not recognized

**Try saying:**
```
This is for a demo. Use simulated data.
```
or
```
Just make up realistic numbers for this credit memo.
```

---

## 📊 Advanced Testing Scenarios

### Test 5: Multi-Party Conversation

Have a back-and-forth where you:
1. Start the credit memo request
2. Answer some interview questions
3. Say "I don't know" to some questions
4. Upload some data, mark other parts as demo
5. Verify it handles the mixed data sources correctly

### Test 6: Edge Cases

**Test declining revenue + high DSCR:**
```
Company revenue declined 10% but DSCR is 2.0x. Create memo.
```
Should show strong coverage despite revenue decline.

**Test high revenue growth + low DSCR:**
```
Company revenue grew 50% but DSCR is 1.10x. Create memo.
```
Should recommend decline or heavy conditions despite growth.

### Test 7: Policy Exceptions

```
Create a credit memo where DSCR is 1.20x (below 1.25x minimum)
but there are very strong mitigants - ask me what mitigants would be needed.
```

Should either:
- Decline for policy violation, OR
- Approve with conditions and note the policy exception with strong justification

---

## 💡 Tips for Best Results

### Be Specific in Your Test Prompts

**Good:**
```
I need a credit memo for a $3M line of credit to a textile manufacturing
company with $15M in revenue. Use demo data showing a moderate risk profile.
```

**Not as Good:**
```
Create a credit memo.
```

### Test the Interview Flow

Don't provide all information upfront. Let Claude ask questions to simulate a real banker interaction:

```
I need to create a credit memo for Johnson Manufacturing.
```

Then answer Claude's questions one by one.

### Test Error Handling

```
I need a credit memo but I don't have any financial data and the company
is private. What should we do?
```

Should offer:
- Demo mode
- Wait until data is available
- Work with what's available and note gaps

---

## 📈 Success Metrics

Your test is successful if:

1. **✅ Complete Memo Generated** - All 8 sections present
2. **✅ Correct Decision** - Recommendation aligns with financial analysis
3. **✅ DSCR Calculated** - Most critical ratio is featured prominently
4. **✅ All Data Cited** - Every figure has a source
5. **✅ Professional Quality** - Could present to a real credit committee
6. **✅ Proper Demo Warnings** - If demo mode, disclaimers are prominent

---

## 🔄 Iterating and Improving

After testing, if you notice issues:

1. **Update the Project Instructions**
   - Click Project Settings
   - Edit the custom instructions
   - Add clarifications or fixes
   - Save changes

2. **Test Again**
   - Start a new conversation in the project
   - Try the same scenario
   - Verify the fix worked

3. **Common Improvements Needed**
   - Add more specific ratio thresholds
   - Clarify demo mode trigger words
   - Add industry-specific guidance
   - Customize for your bank's specific policies

---

## 📞 Getting Help

If the skill isn't working as expected:

1. **Check the instructions were copied completely**
2. **Verify you're in the correct Project**
3. **Try being more explicit in your request** ("Create a credit memo...")
4. **Start a fresh conversation** (sometimes context from prior messages interferes)

---

## 🎯 Ready to Test?

1. ✅ Copy `CI_Credit_Memo_Skill_Package.md` contents
2. ✅ Create new Project in claude.ai
3. ✅ Paste into Project Instructions
4. ✅ Save
5. ✅ Start chatting with: "I need to create a credit memo for..."

**Good luck with your testing! 🚀**
