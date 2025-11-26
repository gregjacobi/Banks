# Peer Comparison Analysis - Prompt Updates

## Overview
Updated all research and content generation prompts to always include peer group comparisons when analyzing trends. This addresses the critical insight that **absolute improvement is meaningless without peer context**.

## Key Principle
**If a bank's efficiency ratio improved 250bp but peers improved 400bp, the bank is actually UNDERPERFORMING despite absolute improvement.**

## Files Updated

### 1. Research Constitution (`server/prompts/researchConstitution.js`)
**Added Section: "CRITICAL: ALWAYS COMPARE TRENDS TO PEER GROUP PERFORMANCE"**
- Mandates peer comparison for ALL metric analyses
- Provides clear examples (250bp vs 400bp scenario)
- Requires both absolute and relative performance framing
- Applies to: Efficiency ratio, operating leverage, ROE, ROA, NIM, asset growth, loan growth

**Example guidance:**
```
- Always state both:
  1. The bank's absolute change (e.g., "Efficiency ratio improved 250bp from 68% to 65.5%")
  2. The peer comparison (e.g., "However, peer average improved 400bp from 65% to 61%, meaning the bank lost ground relatively")
```

### 2. Podcast Generation (`server/prompts/podcastGeneration.js`)
**Updated BOTH main and solo podcast prompts**

**Added Section: "CRITICAL: ALWAYS COMPARE TO PEER GROUP PERFORMANCE"**
- Conversational examples for podcast hosts
- Emphasizes calling out common banking analysis mistakes
- Makes peer comparison natural and engaging

**Example dialogue guidance:**
```
"Their efficiency ratio improved 250 basis points over the last 5 years, dropping from 68% to 65.5%. 
Now here's the critical part - the peer group average improved 400 basis points over that same period, 
from 65% down to 61%. So while they got better in absolute terms, they actually LOST GROUND 
relative to their competitors. That tells you they're being outmanaged."
```

### 3. Agent Report Service (`server/services/agentReportService.js`)
**Updated TWO locations:**

**A. Agent Prompt (buildAgentPrompt function)**
- Added peer comparison mandate for agent research
- Requires generate_insight calls to include peer context
- Applies to all trend analysis

**B. Report Synthesis Prompt (synthesizeReport function)**
- Added "CRITICAL INSTRUCTION: PEER COMPARISON ANALYSIS" section
- Mandates peer comparison in Executive Summary
- Requires comparative language: "outperformed peers", "lagged peer group", "lost competitive ground"

### 4. Presentation Service (`server/services/presentationService.js`)
**Updated McKinsey-style presentation prompt**

**Modified bullet point guidance:**
- Added: "CRITICAL: ALWAYS include peer comparison context"
- Provides clear examples for presentation slides
- Requires peer-relative performance in key metrics

**Example format:**
```
"Efficiency improved 250bp (68% to 65.5%) but peers improved 400bp (65% to 61%), 
losing competitive ground"
```

## Impact

### Research Reports
- Executive summaries now include peer-relative performance
- Financial analysis sections require peer comparisons for all metrics
- Insights generated during research must include peer context

### Podcasts
- Hosts will naturally discuss peer comparisons in conversational style
- Common banking analysis mistakes are called out
- AEs get proper context for customer conversations

### Presentations
- McKinsey-style slides include peer comparisons in bullet points
- Action titles can reference competitive positioning
- Charts preferably use "-peer" variants for richer context

### Agent Research
- Agent insights automatically capture peer-relative performance
- Web searches and document queries informed by peer comparison needs
- Constitution guides agent to always seek peer context

## Metrics Affected
All trend analyses now require peer comparison for:
- **Efficiency Ratio** (lower is better)
- **Operating Leverage** (higher is better, >1.0 is excellent)
- **ROE** (Return on Equity)
- **ROA** (Return on Assets)
- **NIM** (Net Interest Margin)
- **Asset Growth**
- **Loan Growth**
- Any other performance metrics

## Example Outputs

### Before Update
"The bank's efficiency ratio improved from 68% to 65.5% over 5 years, a 250 basis point improvement showing strong operational discipline."

### After Update
"The bank's efficiency ratio improved 250 basis points from 68% to 65.5% over 5 years. However, the peer group average improved 400 basis points from 65% to 61% over the same period, indicating the bank underperformed peers despite absolute improvement. While operational metrics moved in the right direction, the bank lost competitive ground relative to similar institutions."

## Testing
Server restarted successfully with all updated prompts loaded. All services initialized correctly:
- ✓ Claude Service
- ✓ Constitution Service  
- ✓ Agent Orchestrator
- ✓ PDF Metrics Agent
- ✓ UBPR Analysis Agent

## Next Steps
1. Generate new reports/podcasts/presentations to verify peer comparison is consistently included
2. Monitor for proper framing of peer-relative performance
3. Ensure agents are capturing peer context in insights
4. Validate that absolute improvements are always contextualized

## Date
2025-01-20

## Author
Updated via Claude Code based on user feedback about the importance of peer-relative performance analysis.
