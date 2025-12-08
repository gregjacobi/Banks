# Intelligent Source Selection & Quality Assessment

**Status:** ✅ Implemented
**Purpose:** Enable autonomous research pipeline from Phase 1 → Phase 3 by intelligently selecting the best sources and assessing their quality

## Overview

The research pipeline now includes intelligent source selection and quality assessment to move toward full autonomy. This system addresses the key bottleneck: **picking the right sources from Phase 1 data gathering**.

### The Problem

Previously, the research pipeline required manual review and selection of sources discovered in Phase 1. This created a bottleneck preventing full automation from data gathering → synthesis → output.

### The Solution

Two new capabilities have been added:

1. **Intelligent Source Scoring (Phase 1)** - Automatically scores and ranks sources based on authority, depth, and freshness
2. **Phase 2 Quality Assessment** - Claude evaluates whether selected sources are sufficient for generating a high-quality Phase 3 report

---

## How It Works

### 1. Intelligent Source Scoring (Automatic in Phase 1)

When Phase 1 completes source gathering, sources are automatically scored on three dimensions:

#### Scoring Dimensions

**Authority (40% weight)**
- Official investor relations sites: 100 points
- Bank's own domain: 95 points
- PDF documents: 80 points
- Financial news (Bloomberg, Reuters, WSJ): 75 points
- Regional business journals: 70 points
- Press release sites: 65 points
- General business sites: 60 points

**Depth (30% weight)**
- Based on content length and substantiveness
- Comprehensive documents (>50K chars): 100 points
- Long documents (>20K chars): 90 points
- Medium documents (>10K chars): 75 points
- Short documents (>5K chars): 60 points
- Bonus for financial metric depth (EPS, NIM, efficiency ratio mentions)
- Bonus for strategic content (digital transformation, competitive advantage)

**Freshness (30% weight)**
- Within 3 months: 100 points
- Within 6 months: 90 points
- Within 1 year: 75 points
- Within 2 years: 50 points
- Within 3 years: 25 points
- Older than 3 years: 10 points

#### Automatic Recommendations

For each source category (investor presentations, earnings transcripts, etc.):
- Top 3 sources that score ≥60 are marked as `recommended: true`
- All sources get a `score` (0-100) and `confidence` (0-1) value
- Recommendations are saved to the database automatically

### 2. Phase 2 Quality Assessment

After sources are selected (either automatically or manually), you can assess whether they're sufficient for Phase 3:

**Assessment Criteria:**
- **Coverage** - Sufficient diversity of source types (presentations, transcripts, interviews)
- **Authority** - Credible, authoritative origins (not just blogs/forums)
- **Depth** - Substantive content to work with (not just short snippets)
- **Freshness** - Recent and relevant information (ideally <12 months)

**Assessment Output:**
- **Decision:** `approve` or `reject`
- **Confidence:** 0.0 to 1.0
- **Reasoning:** Detailed explanation
- **Strengths:** What's good about the sources
- **Weaknesses:** What's missing or problematic
- **Recommendations:** Actionable next steps
- **Missing Categories:** Types of sources that should be added

---

## API Endpoints

### 1. Automatic Scoring (Built into Phase 1)

Sources are automatically scored when Phase 1 completes:

```bash
# Run Phase 1 for a bank (scoring happens automatically)
node server/scripts/cli/batchResearch.js --count 10
```

Logs will show:
```
[Batch] Source gathering completed: 12 sources found
[Batch] Scoring and ranking sources...
[Batch] Source scoring completed: {
  totalSources: 12,
  totalRecommended: 7,
  averageScore: 73
}
```

### 2. Manual Source Scoring

Manually trigger source scoring for a session:

```bash
POST /api/research/:idrssd/score-sources
```

**Request Body:**
```json
{
  "sessionId": "batch-1699888800000-504713",
  "options": {
    "minScoreThreshold": 60,
    "topNPerCategory": 3
  }
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "batch-1699888800000-504713",
  "totalSources": 12,
  "recommendations": {
    "investorPresentation": {
      "totalFound": 5,
      "recommended": 3,
      "averageScore": 82,
      "topSources": [
        {
          "sourceId": "src_123",
          "title": "Q2 2025 Investor Presentation",
          "url": "https://ir.bank.com/presentations/q2-2025.pdf",
          "date": "Q2 2025",
          "score": 95,
          "breakdown": {
            "authority": 100,
            "depth": 85,
            "freshness": 100
          }
        }
      ]
    },
    "earningsTranscript": {
      "totalFound": 7,
      "recommended": 3,
      "averageScore": 75,
      "topSources": [...]
    }
  },
  "summary": {
    "totalRecommended": 6,
    "averageScore": 78,
    "highestScore": 95,
    "lowestScore": 42
  }
}
```

### 3. Phase 2 Quality Assessment

Assess whether sources are sufficient for Phase 3:

```bash
POST /api/research/:idrssd/assess-phase2-quality
```

**Request Body:**
```json
{
  "sessionId": "batch-1699888800000-504713"
}
```

**Response (Approval):**
```json
{
  "success": true,
  "assessment": {
    "decision": "approve",
    "confidence": 0.85,
    "reasoning": "Sources demonstrate strong coverage with 3 official investor presentations and 2 recent earnings transcripts. Authority is excellent with documents from official IR site. Depth is comprehensive with detailed financial metrics. All sources are from last 6 months.",
    "strengths": [
      "Official investor relations documents with high authority",
      "Comprehensive financial metrics and strategic content",
      "Recent data (all within 6 months)",
      "Good diversity (presentations + transcripts)"
    ],
    "weaknesses": [
      "No management interviews found",
      "Limited technology-specific announcements"
    ],
    "recommendations": [
      "Consider searching for CEO/CFO interviews",
      "Look for technology partnership announcements",
      "Proceed with Phase 3 - sources are sufficient"
    ],
    "missingCategories": ["managementInterview", "techAnnouncement"],
    "metadata": {
      "idrssd": "504713",
      "sessionId": "batch-1699888800000-504713",
      "totalSources": 12,
      "assessedAt": "2025-11-17T10:30:00.000Z"
    }
  }
}
```

**Response (Rejection):**
```json
{
  "success": true,
  "assessment": {
    "decision": "reject",
    "confidence": 0.90,
    "reasoning": "Sources lack sufficient depth and authority. Only 2 sources found, both from general news sites with limited financial detail. No official investor presentations or earnings transcripts. Most recent source is 18 months old.",
    "strengths": [
      "Sources are from credible news outlets"
    ],
    "weaknesses": [
      "No official investor relations documents",
      "Limited financial depth - mostly high-level news",
      "Dated information (>18 months old)",
      "Insufficient coverage - only 2 sources total"
    ],
    "recommendations": [
      "Search for official investor presentations on IR website",
      "Find recent earnings call transcripts (last 6 months)",
      "Look for quarterly earnings releases",
      "Expand search to include bank's official website"
    ],
    "missingCategories": ["investorPresentation", "earningsTranscript"]
  }
}
```

### 4. Get Recommended Sources

View recommended sources for a bank:

```bash
GET /api/research/:idrssd/source-recommendations
```

**Response:**
```json
{
  "success": true,
  "totalRecommended": 7,
  "recommendations": {
    "investorPresentation": [
      {
        "sourceId": "src_123",
        "title": "Q2 2025 Investor Presentation",
        "url": "https://ir.bank.com/q2-2025.pdf",
        "date": "Q2 2025",
        "score": 95,
        "confidence": 0.95,
        "category": "investorPresentation",
        "fetchable": true,
        "contentLength": 45230
      }
    ],
    "earningsTranscript": [...]
  }
}
```

---

## Autonomous Pipeline Workflow

Here's how the intelligent selection enables autonomy:

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: Gather Sources                                    │
│ - Search web for investor presentations, transcripts       │
│ - Automatically SCORE all sources (authority/depth/fresh)  │
│ - Automatically RECOMMEND top 3 per category (score ≥60)   │
│ - Save to database with scores & recommendations           │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: Select & Upload PDFs                              │
│ Option A: Fully Autonomous                                 │
│   - Automatically select all "recommended" sources         │
│   - Upload to RAG                                           │
│   - Run QUALITY ASSESSMENT                                  │
│   ┌─────────────────────────────────────┐                  │
│   │ If assessment = "approve" → Phase 3 │                  │
│   │ If assessment = "reject" → Re-gather│                  │
│   └─────────────────────────────────────┘                  │
│                                                             │
│ Option B: Human Review                                     │
│   - Show recommended sources in UI                         │
│   - Allow human to approve/reject                          │
│   - Run QUALITY ASSESSMENT                                  │
│   - Human decides: proceed or re-gather                    │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: Generate Report                                   │
│ - Use approved sources + financial data                    │
│ - Generate comprehensive research report                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Scoring Algorithm Details

### Authority Score Calculation

```javascript
// Extract domain from URL
const domain = new URL(source.url).hostname.toLowerCase();

// Official investor relations (highest authority)
if (domain.includes('ir.') || domain.includes('investor.') ||
    domain.includes('s21.q4cdn.com') // Q4 IR CDN
) {
  score = 100;
}
// Bank's own domain
else if (url.includes(bankName.toLowerCase())) {
  score = 95;
}
// PDF files (typically official)
else if (url.endsWith('.pdf')) {
  score = 80;
}
// Financial news sites
else if (['bloomberg.com', 'reuters.com', 'wsj.com'].some(d => domain.includes(d))) {
  score = 75;
}
// etc...

// Category bonus
if (category === 'investorPresentation' && isPDF) {
  score += 10; // Max 100
}
```

### Depth Score Calculation

```javascript
// If content fetched
if (source.content && source.contentLength) {
  if (length > 50000) score = 100;      // Very comprehensive
  else if (length > 20000) score = 90;
  else if (length > 10000) score = 75;
  else if (length > 5000) score = 60;
  // etc...

  // Check for financial depth indicators
  const depthIndicators = [
    'earnings per share', 'net interest margin', 'efficiency ratio',
    'return on equity', 'operating leverage', 'tangible book value'
  ];
  const matches = depthIndicators.filter(ind => content.includes(ind)).length;
  score += matches * 3; // Up to +27
}
// If no content yet, estimate from URL/type
else {
  if (isPDF) score = 80;
  if (category === 'investorPresentation') score = 85;
  // etc...
}
```

### Freshness Score Calculation

```javascript
// Parse date from source.date or URL
const sourceDate = parseSourceDate(source.date) || extractDateFromUrl(source.url);

if (sourceDate) {
  const ageInDays = (now - sourceDate) / (1000 * 60 * 60 * 24);

  if (ageInDays < 90) score = 100;      // <3 months: extremely fresh
  else if (ageInDays < 180) score = 90; // <6 months: very fresh
  else if (ageInDays < 365) score = 75; // <1 year: fresh
  else if (ageInDays < 730) score = 50; // <2 years: moderate
  // etc...
}
```

### Final Score

```javascript
const weights = {
  authority: 0.4,  // 40%
  depth: 0.3,      // 30%
  freshness: 0.3   // 30%
};

finalScore = (
  authorityScore * 0.4 +
  depthScore * 0.3 +
  freshnessScore * 0.3
);
```

---

## Configuration Options

### Source Scoring Options

```javascript
const options = {
  minScoreThreshold: 60,  // Minimum score to be "recommended"
  topNPerCategory: 3      // Top N per category to recommend
};
```

**Recommendations:**
- `minScoreThreshold: 60` - Good balance of quality and quantity
- `minScoreThreshold: 70` - Higher quality, fewer sources
- `topNPerCategory: 3` - Ensures diversity within categories
- `topNPerCategory: 5` - More sources, but may include lower quality

---

## Database Schema Updates

### Source Model

New fields added to support intelligent selection:

```javascript
{
  // Existing fields...
  url: String,
  title: String,
  category: String,
  content: String,

  // NEW FIELDS
  score: Number,              // 0-100 calculated score
  recommended: Boolean,       // True if top N in category
  confidence: Number          // 0-1 confidence level (score/100)
}
```

---

## Testing the System

### 1. Test Phase 1 with Automatic Scoring

```bash
# Run Phase 1 for a single bank
node server/scripts/cli/batchResearch.js --count 1 --force

# Check logs for scoring output:
# [Batch] Scoring and ranking sources...
# [Batch] Source scoring completed: {...}
```

### 2. Test Manual Scoring

```bash
# Using curl
curl -X POST http://localhost:5001/api/research/504713/score-sources \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "batch-1732024800000-504713",
    "options": {
      "minScoreThreshold": 60,
      "topNPerCategory": 3
    }
  }'
```

### 3. Test Quality Assessment

```bash
# Assess Phase 2 quality
curl -X POST http://localhost:5001/api/research/504713/assess-phase2-quality \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "batch-1732024800000-504713"
  }'
```

### 4. View Recommendations

```bash
# Get recommended sources
curl http://localhost:5001/api/research/504713/source-recommendations
```

---

## Future Enhancements

### Phase 2A: Fully Autonomous Source Selection

**Next Step:** Automatically select all `recommended: true` sources for RAG upload without human review.

```javascript
// Pseudo-code for fully autonomous Phase 2
async function autonomousPhase2(idrssd, sessionId) {
  // 1. Get all recommended sources
  const recommended = await Source.find({
    idrssd,
    sessionId,
    recommended: true
  });

  // 2. Auto-select and upload to RAG
  for (const source of recommended) {
    await uploadToRAG(source);
  }

  // 3. Run quality assessment
  const assessment = await assessPhase2Quality(idrssd, sessionId);

  // 4. Make autonomous decision
  if (assessment.decision === 'approve' && assessment.confidence >= 0.75) {
    // Proceed to Phase 3 automatically
    return { action: 'proceed_to_phase3', assessment };
  } else {
    // Re-gather with expanded criteria
    return { action: 're_gather_sources', assessment };
  }
}
```

### Phase 3: Learning from Feedback

Track which sources were most referenced in high-quality reports, and use that to refine scoring weights over time.

---

## Troubleshooting

### Issue: All sources scored very low

**Possible causes:**
- Sources are from unknown/untrusted domains
- Content hasn't been fetched yet (depth scoring relies on content)
- Sources are very old

**Solutions:**
- Fetch content for sources first (improves depth scoring)
- Adjust `minScoreThreshold` lower (e.g., 50 instead of 60)
- Expand search criteria to find official IR sources

### Issue: Quality assessment always rejects

**Possible causes:**
- Not enough sources found in Phase 1
- Sources lack diversity (only one type)
- Sources are too old or low authority

**Solutions:**
- Check source recommendations: `GET /api/research/:idrssd/source-recommendations`
- Review scoring breakdown to understand why scores are low
- Manually search for official investor relations site
- Expand search queries to find more source types

### Issue: Scoring seems incorrect

**Debug steps:**
1. Check individual source scores: Query MongoDB `sources` collection
2. Review scoring breakdown: `{ authority: 85, depth: 60, freshness: 40 }`
3. Verify date parsing: Check if `source.date` is being parsed correctly
4. Check domain authority: Is domain being recognized?

---

## Summary

The intelligent source selection system enables the path toward fully autonomous research by:

1. **Automatically scoring** all sources discovered in Phase 1
2. **Recommending** the best sources based on authority, depth, and freshness
3. **Assessing quality** of selected sources before Phase 3
4. **Making decisions** about whether to proceed or re-gather

This removes the manual bottleneck and sets the foundation for fully autonomous research pipelines.

**Status:** ✅ Ready for testing
**Next Step:** Test with real banks and iterate on scoring weights based on results
