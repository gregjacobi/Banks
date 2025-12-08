const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs').promises;
const path = require('path');
const modelResolver = require('./modelResolver');
const BankMetadata = require('../models/BankMetadata');
const { createCanvas } = require('canvas');
const { Chart, registerables } = require('chart.js');

// Register Chart.js components
Chart.register(...registerables);

/**
 * PresentationService (McKinsey-Style)
 *
 * Generates McKinsey-style HTML presentations from research reports.
 * Uses topic-based chart selection and action titles to communicate insights clearly.
 */
class PresentationService {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    this.model = null;
    this.initializeModel();
  }

  async initializeModel() {
    try {
      this.model = await modelResolver.getLatestKitModel();
      console.log(`PresentationService initialized with model: ${this.model}`);
    } catch (error) {
      console.error('Error initializing model:', error.message);
      this.model = modelResolver.getModelSync();
    }
  }

  /**
   * Convert image file to base64 data URL for embedding in HTML
   */
  async imageToBase64(filePath) {
    try {
      const imageBuffer = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();

      const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp'
      };

      const mimeType = mimeTypes[ext] || 'image/png';
      return `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
    } catch (error) {
      console.error(`[Presentation] Error converting image to base64:`, error.message);
      return null;
    }
  }

  /**
   * Generate chart image as base64 data URL
   */
  async generateChart(type, periodsData, config = {}) {
    try {
      const canvas = createCanvas(900, 450);
      const ctx = canvas.getContext('2d');

      // Sort by date (oldest first)
      const sorted = [...periodsData].sort((a, b) => new Date(a.date) - new Date(b.date));
      const labels = sorted.map(d => d.period);

      let chartConfig = null;

      switch (type) {
        case 'net-income':
          chartConfig = {
            type: 'line',
            data: {
              labels,
              datasets: [{
                label: 'Net Income ($M)',
                data: sorted.map(d => d.income?.netIncome ? d.income.netIncome / 1000 : null),
                borderColor: '#D97757',
                backgroundColor: 'rgba(217, 119, 87, 0.1)',
                tension: 0.3,
                fill: true,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#D97757'
              }]
            },
            options: {
              responsive: true,
              plugins: {
                title: { display: true, text: 'Net Income Trend', font: { size: 18, weight: '600' } },
                legend: { display: false }
              },
              scales: {
                y: { beginAtZero: false, title: { display: true, text: 'Net Income ($M)' } }
              }
            }
          };
          break;

        case 'efficiency-ratio':
          chartConfig = {
            type: 'line',
            data: {
              labels,
              datasets: [{
                label: 'Efficiency Ratio (%)',
                data: sorted.map(d => d.ratios?.efficiencyRatio),
                borderColor: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.3,
                fill: true,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#10B981'
              }]
            },
            options: {
              responsive: true,
              plugins: {
                title: { display: true, text: 'Efficiency Ratio (Lower is Better)', font: { size: 18, weight: '600' } },
                legend: { display: false }
              },
              scales: {
                y: { beginAtZero: false, title: { display: true, text: 'Efficiency Ratio (%)' } }
              }
            }
          };
          break;

        case 'operating-leverage':
          const olData = sorted.map(d => d.ratios?.operatingLeverage || null).filter(v => v !== null);
          chartConfig = {
            type: 'bar',
            data: {
              labels: sorted.filter((d, i) => sorted[i].ratios?.operatingLeverage !== null).map(d => d.period),
              datasets: [{
                label: 'Operating Leverage',
                data: olData,
                backgroundColor: olData.map(v => v >= 1.0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
                borderColor: olData.map(v => v >= 1.0 ? '#10B981' : '#EF4444'),
                borderWidth: 2
              }]
            },
            options: {
              responsive: true,
              plugins: {
                title: { display: true, text: 'Operating Leverage (Higher is Better)', font: { size: 18, weight: '600' } },
                legend: { display: false }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: { display: true, text: 'Operating Leverage Ratio' },
                  ticks: {
                    callback: function(value) {
                      return value.toFixed(2) + 'x';
                    }
                  }
                }
              }
            }
          };
          break;

        case 'roe':
          chartConfig = {
            type: 'line',
            data: {
              labels,
              datasets: [{
                label: 'Return on Equity (%)',
                data: sorted.map(d => d.ratios?.roe),
                borderColor: '#D97757',
                backgroundColor: 'rgba(217, 119, 87, 0.1)',
                tension: 0.3,
                fill: true,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#D97757'
              }]
            },
            options: {
              responsive: true,
              plugins: {
                title: { display: true, text: 'Return on Equity (ROE)', font: { size: 18, weight: '600' } },
                legend: { display: false }
              },
              scales: {
                y: { beginAtZero: false, title: { display: true, text: 'ROE (%)' } }
              }
            }
          };
          break;

        case 'nim':
          chartConfig = {
            type: 'line',
            data: {
              labels,
              datasets: [{
                label: 'Net Interest Margin (%)',
                data: sorted.map(d => d.ratios?.nim),
                borderColor: '#8B5CF6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.3,
                fill: true,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#8B5CF6'
              }]
            },
            options: {
              responsive: true,
              plugins: {
                title: { display: true, text: 'Net Interest Margin (NIM)', font: { size: 18, weight: '600' } },
                legend: { display: false }
              },
              scales: {
                y: { beginAtZero: false, title: { display: true, text: 'NIM (%)' } }
              }
            }
          };
          break;

        case 'roe-roa':
          chartConfig = {
            type: 'line',
            data: {
              labels,
              datasets: [
                {
                  label: 'ROE (%)',
                  data: sorted.map(d => d.ratios?.roe),
                  borderColor: '#D97757',
                  backgroundColor: 'rgba(217, 119, 87, 0.1)',
                  tension: 0.3,
                  borderWidth: 3,
                  pointRadius: 4,
                  pointBackgroundColor: '#D97757',
                  yAxisID: 'y'
                },
                {
                  label: 'ROA (%)',
                  data: sorted.map(d => d.ratios?.roa),
                  borderColor: '#6B7280',
                  backgroundColor: 'rgba(107, 114, 128, 0.1)',
                  tension: 0.3,
                  borderWidth: 3,
                  pointRadius: 4,
                  pointBackgroundColor: '#6B7280',
                  yAxisID: 'y'
                }
              ]
            },
            options: {
              responsive: true,
              interaction: {
                mode: 'index',
                intersect: false
              },
              plugins: {
                title: { display: true, text: 'Profitability Metrics (ROE & ROA)', font: { size: 18, weight: '600' } },
                legend: { display: true, position: 'bottom' }
              },
              scales: {
                y: {
                  type: 'linear',
                  display: true,
                  position: 'left',
                  title: { display: true, text: 'Percentage (%)' },
                  beginAtZero: false
                }
              }
            }
          };
          break;

        case 'asset-growth':
          chartConfig = {
            type: 'bar',
            data: {
              labels,
              datasets: [{
                label: 'Total Assets ($B)',
                data: sorted.map(d => d.assets?.total ? d.assets.total / 1000000 : null),
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: '#3B82F6',
                borderWidth: 2
              }]
            },
            options: {
              responsive: true,
              plugins: {
                title: { display: true, text: 'Total Assets Growth', font: { size: 18, weight: '600' } },
                legend: { display: false }
              },
              scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Total Assets ($B)' } }
              }
            }
          };
          break;

        case 'loan-growth':
          const totalLoans = sorted.map(d => {
            const assets = d.assets || {};
            return (assets.consumerLending || 0) + (assets.businessLending || 0);
          });

          chartConfig = {
            type: 'bar',
            data: {
              labels,
              datasets: [{
                label: 'Total Loans ($B)',
                data: totalLoans.map(v => v / 1000000),
                backgroundColor: 'rgba(217, 119, 87, 0.7)',
                borderColor: '#D97757',
                borderWidth: 2
              }]
            },
            options: {
              responsive: true,
              plugins: {
                title: { display: true, text: 'Loan Portfolio Growth', font: { size: 18, weight: '600' } },
                legend: { display: false }
              },
              scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Total Loans ($B)' } }
              }
            }
          };
          break;

        case 'revenue-composition':
          // Calculate averages for pie chart
          const avgNetInterestIncome = sorted.reduce((sum, d) => sum + (d.income?.netInterestIncome || 0), 0) / sorted.length;
          const avgNoninterestIncome = sorted.reduce((sum, d) => sum + (d.income?.totalNoninterestIncome || 0), 0) / sorted.length;

          chartConfig = {
            type: 'pie',
            data: {
              labels: ['Net Interest Income', 'Non-Interest Income'],
              datasets: [{
                data: [avgNetInterestIncome / 1000, avgNoninterestIncome / 1000],
                backgroundColor: ['#D97757', '#6B7280'],
                borderWidth: 2,
                borderColor: '#fff'
              }]
            },
            options: {
              responsive: true,
              plugins: {
                title: { display: true, text: 'Revenue Composition', font: { size: 18, weight: '600' } },
                legend: { display: true, position: 'bottom' },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      const label = context.label || '';
                      const value = context.parsed;
                      const total = context.dataset.data.reduce((a, b) => a + b, 0);
                      const percentage = ((value / total) * 100).toFixed(1);
                      return `${label}: $${value.toFixed(1)}M (${percentage}%)`;
                    }
                  }
                }
              }
            }
          };
          break;

        case 'fte-trends':
          chartConfig = {
            type: 'line',
            data: {
              labels,
              datasets: [{
                label: 'Full-Time Employees',
                data: sorted.map(d => d.fte),
                borderColor: '#6366F1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                tension: 0.3,
                fill: true,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#6366F1'
              }]
            },
            options: {
              responsive: true,
              plugins: {
                title: { display: true, text: 'Employee Count Trends', font: { size: 18, weight: '600' } },
                legend: { display: false }
              },
              scales: {
                y: { beginAtZero: false, title: { display: true, text: 'Full-Time Employees' } }
              }
            }
          };
          break;

        default:
          console.warn(`[Presentation] Unknown chart type: ${type}`);
          return null;
      }

      if (chartConfig) {
        new Chart(ctx, chartConfig);
        return canvas.toDataURL('image/png');
      }

      return null;
    } catch (error) {
      console.error(`[Presentation] Error generating ${type} chart:`, error.message);
      return null;
    }
  }

  /**
   * Generate HTML presentation from report
   */
  async generatePresentation(idrssd, reportData, options = {}) {
    console.log(`[Presentation] Generating McKinsey-style presentation for bank ${idrssd}...`);

    // Step 1: Analyze report and get McKinsey-style findings with chart recommendations
    console.log('[Presentation] Extracting key findings with chart recommendations...');
    const summary = await this.summarizeReportMcKinsey(reportData);

    // Step 2: Build slide data structure
    console.log('[Presentation] Building slide data...');
    const slides = [];

    // Title slide
    slides.push({
      type: 'title',
      title: summary.mainInsight || `${reportData.bankName} Financial Analysis`,
      subtitle: `Q4 2022 - Q2 2025 | Generated ${new Date().toLocaleDateString()}`
    });

    // Executive summary slide - punchy 3-section structure
    const execSummary = summary.execSummary;

    if (execSummary && typeof execSummary === 'object' && !Array.isArray(execSummary)) {
      // New structured format: about, keyInsights, whyMeet
      if (execSummary.about || execSummary.keyInsights) {
        slides.push({
          type: 'executive-summary',
          headline: execSummary.headline || 'Executive Summary',
          about: execSummary.about || '',
          keyInsights: execSummary.keyInsights || [],
          whyMeet: execSummary.whyMeet || '',
          chartType: execSummary.chartType || 'efficiency-ratio-peer'
        });
      } else {
        // Legacy format: headline + bullets
        slides.push({
          type: 'executive-summary',
          headline: execSummary.headline || 'Executive Summary',
          about: '',
          keyInsights: execSummary.bullets || [],
          whyMeet: '',
          chartType: execSummary.chartType || 'efficiency-ratio-peer'
        });
      }
    } else if (Array.isArray(execSummary)) {
      // Legacy format fallback
      slides.push({
        type: 'executive-summary',
        headline: 'Executive Summary',
        about: '',
        keyInsights: execSummary,
        whyMeet: '',
        chartType: 'efficiency-ratio-peer'
      });
    }

    // Finding slides - map Claude's "bullets" to our "bullets"
    summary.keyFindings.forEach((finding, idx) => {
      slides.push({
        type: 'content',
        title: finding.actionTitle,
        bullets: finding.bullets || finding.supportingPoints || [],
        keyMetric: finding.metric || finding.keyMetric || null,
        chartType: finding.chartType || null
      });
    });

    // Closing slide - Action-oriented "Tell them what you told them"
    slides.push({
      type: 'summary',
      title: 'Recommended Actions',
      bullets: summary.keyFindings.slice(-3).map(f => f.actionTitle) // Use last 3 findings (should be actionClosing items)
    });

    // Step 3: Build presentation JSON
    const presentationData = {
      idrssd,
      bankName: reportData.bankName,
      title: summary.mainInsight || `${reportData.bankName} Financial Analysis`,
      subtitle: `Q4 2022 - Q2 2025`,
      generatedAt: new Date().toISOString(),
      slides,
      trendsData: reportData.trendsData // Include trends data for client-side chart rendering
    };

    // Step 4: Save to GridFS documentBucket
    const gridfs = require('../config/gridfs');
    const { saveJsonToGridFS } = require('../utils/gridfsHelpers');

    const timestamp = Date.now();
    const filename = `${idrssd}_presentation_${timestamp}.json`;

    await saveJsonToGridFS(gridfs.documentBucket, filename, presentationData, {
      idrssd,
      type: 'presentation',
      reportingPeriod: reportData.statements?.[0]?.reportingPeriod
    });

    console.log(`[Presentation] Saved to GridFS: ${filename}`);

    return {
      filename,
      url: `/presentations/${idrssd}/${filename}`,
      timestamp,
      slideCount: slides.length,
      data: presentationData // Include data in response for immediate use
    };
  }

  /**
   * Use Claude to extract findings in McKinsey style with topic-based chart selection
   */
  async summarizeReportMcKinsey(reportData) {
    // Extract strategic priorities from metadata if available
    const strategicPriorities = reportData.peerData?.strategicInsights?.priorities || [];
    const strategicPrioritiesText = strategicPriorities.length > 0
      ? `\n\n**STRATEGIC PRIORITIES (from management docs):**\n${strategicPriorities.map(p => `- ${p.title}: ${p.description}`).join('\n')}`
      : '';

    const prompt = `You are a McKinsey consultant creating a slide presentation. Create a clear story arc.

**STORYTELLING STRUCTURE (3 parts):**
1. "Tell them what you'll tell them" → Executive Summary (punchy, distilled)
2. "Tell them" → Detail slides (one topic per slide)
3. "Tell them what you told them" → Recommended Actions (what to DO next)

**SLIDE STRUCTURE:**

**Slide 1: EXECUTIVE SUMMARY** - This is the most important slide! Make it PUNCHY and SCANNABLE:

The executive summary has 3 sections:
1. **ABOUT** (who is this bank?):
   - One line: "$XXB [bank type] headquartered in [city], [key differentiator]"
   - Include: Leadership (CEO name if mentioned), employee count, market focus

2. **KEY INSIGHTS** (what did we find?):
   - 2-3 bullet points, each ONE line (max 15 words)
   - Format: "[Metric] [vs peer comparison] - [so what]"
   - Example: "52.6% efficiency ratio (294bp better than peers) - best in class"
   - Example: "Operating leverage 0.99x vs 1.03x peers - room to improve"
   - NO fluffy language - just data and implications

3. **WHY MEET** (what's the opportunity?):
   - One line connecting their challenge to Anthropic's value prop
   - Format: "[Their priority/challenge] → [Anthropic solution] → [Business outcome]"

HEADLINE: Short punchy title (max 10 words) that states THE bottom line:
- Good: "Strong profitability but lagging on operating leverage"
- Good: "Efficiency leader seeking automation to extend advantage"
- Bad: "$3.81T national bank leading U.S. banking with 300bp efficiency advantage..." (too long!)

Include a chart that reinforces the main point (efficiency-ratio-peer is usually best for exec summary)

**Slides 2-5: DETAIL SLIDES** - One topic per slide:
- Strategic Priorities (what management is focused on)
- Key Ratios (efficiency, profitability vs peers)
- Balance Sheet (asset/loan composition)
- Income Statement (revenue trends)

**Slide 6: RECOMMENDED ACTIONS** - What should we DO?
- 2-3 specific actions starting with verbs (Engage, Explore, Propose)
- Connect each action to a finding from the analysis
- Frame as business outcomes

**McKinsey Principles:**
1. **Action Titles**: Each slide title should be an insight/conclusion (like a news headline), NOT a descriptive label
   - Good: "Operating efficiency improved 680bp through technology investments"
   - Bad: "Operating Efficiency Analysis"

2. **MECE Framework**: Findings should be Mutually Exclusive and Collectively Exhaustive
   - No overlap between findings
   - Together they tell the complete story

3. **Data-Driven**: Only include data that directly supports your point

4. **Topic-Based Charts**: ALWAYS choose a chart type for EVERY finding (charts are essential for McKinsey presentations)

**AVAILABLE CHART TYPES:**

*Peer Comparison Charts (PREFERRED - use these when possible):*
- "efficiency-ratio-peer" - Efficiency ratio vs peer average (dual line chart with performance indicator) - LOWER IS BETTER
- "operating-leverage-peer" - Operating leverage vs peer average (dual line chart) - HIGHER IS BETTER
- "roe-peer" - ROE vs peer average (dual line chart with ranking)
- "roa-peer" - ROA vs peer average (dual line chart with ranking)
- "nim-peer" - NIM vs peer average (dual line chart with ranking)

*Ranking Charts (use when highlighting competitive position):*
- "efficiency-ratio-ranking" - Efficiency ratio stack ranking among all peers (horizontal bar chart, bank highlighted)
- "roe-ranking" - ROE stack ranking among all peers (horizontal bar chart, bank highlighted)
- "roa-ranking" - ROA stack ranking among all peers (horizontal bar chart, bank highlighted)
- "nim-ranking" - NIM stack ranking among all peers (horizontal bar chart, bank highlighted)

*Trend Charts:*
- "net-income" - Net income trend over time (line chart)
- "efficiency-ratio" - Efficiency ratio trend (line chart, lower is better)
- "operating-leverage" - Operating leverage by quarter (bar chart, higher is better)
- "roe" - Return on equity trend (line chart)
- "nim" - Net interest margin trend (line chart)
- "roe-roa" - Both ROE and ROA together (dual line chart)

*Balance Sheet Charts:*
- "asset-growth" - Total assets composition over time (stacked column: Consumer, Business, Securities, Cash)
- "loan-growth" - Loan portfolio growth (bar chart)
- "loan-mix" - Detailed loan portfolio breakdown over time (stacked column: Residential, Cards, Auto, CRE, C&I, Other)

*Income Statement Charts:*
- "revenue-composition" - Interest vs non-interest income over time (stacked column chart)
- "fte-trends" - Employee count over time (bar chart)

**Chart Selection Rules (CRITICAL - READ CAREFULLY):**

1. **NO CHART REPETITION**: Each chart type may only be used ONCE across all slides. Track which charts you've assigned and choose alternatives if needed.

2. **PREFER PEER CHARTS**: Always prefer "-peer" variants over standalone trends:
   - Use "efficiency-ratio-peer" instead of "efficiency-ratio"
   - Use "operating-leverage-peer" instead of "operating-leverage"
   - Use "roe-peer" instead of "roe"
   - Use "nim-peer" instead of "nim"
   - Peer charts show competitive context which is more valuable

3. **Topic-Based Selection:**
   - Profitability/earnings → "roe-peer" or "net-income"
   - Operational efficiency → "efficiency-ratio-peer" (PREFERRED) or "efficiency-ratio-ranking"
   - Operating leverage/scalability → "operating-leverage-peer" (PREFERRED) or "operating-leverage"
   - Balance sheet growth → "asset-growth" or "loan-growth"
   - Loan portfolio composition → "loan-mix" (shows 7 loan categories)
   - Revenue mix → "revenue-composition"
   - Headcount/staffing → "fte-trends"
   - Competitive ranking → USE "-ranking" variants

4. **ONE chart per slide** - choose the MOST relevant
5. **EVERY slide MUST have a chart** - non-negotiable for McKinsey-style presentations

For each finding within each chapter:
- **Action title** (8-12 words, states the key insight/conclusion)
- **3-5 supporting bullet points** that provide DEEPER INSIGHTS:
  * Each bullet should explain WHY this matters or WHAT the implications are
  * Include specific numbers, trends, or comparisons (e.g., "680bp improvement vs 200bp peer avg")
  * **CRITICAL: ALWAYS include peer comparison context** - Never present absolute improvement alone
  * Example: "Efficiency improved 250bp (68% to 65.5%) but peers improved 400bp (65% to 61%), losing competitive ground"
  * Example: "ROE grew 400bp vs peer average 250bp, outperforming the peer group"
  * Focus on drivers, causes, competitive positioning, or strategic implications
  * Avoid simple observations - provide analysis and context with peer-relative performance
  * Each bullet: 12-20 words (enough depth to be meaningful)
- **One key metric** with specific numbers from the data (include peer comparison where possible)
- **Chart type** (REQUIRED - choose from list above, NEVER use null)

**STRATEGIC PRIORITIES Chapter (Special Instructions):**
- Create visually punchy slides for the bank's top strategic priorities
- If strategic priorities are available in management docs, use those${strategicPrioritiesText}
- Otherwise, infer the top 2-3 priorities from the financial data and trends
- Each priority should have concrete metrics and progress indicators
- Use visual chart types that show progress (e.g., efficiency-ratio-peer, roe-peer, loan-growth)

Report Summary:
${reportData.analysis.substring(0, 20000)}

Return ONLY valid JSON in this exact format:
{
  "execSummary": {
    "headline": "Short punchy title (max 10 words) - the bottom line",
    "about": "$XXB [bank type] in [city] | CEO: [name] | [employee count] employees | [key differentiator]",
    "keyInsights": [
      "[Metric] [vs peer comparison] - [implication]",
      "[Metric] [vs peer comparison] - [implication]"
    ],
    "whyMeet": "[Their challenge] → [Anthropic solution] → [Business outcome]",
    "chartType": "efficiency-ratio-peer"
  },
  "chapters": {
    "strategicPriorities": [
      {
        "actionTitle": "Action-oriented title stating the insight",
        "bullets": ["Point 1", "Point 2", "Point 3"],
        "metric": "XX.X%",
        "chartType": "roe-peer"
      }
    ],
    "keyRatios": [
      {
        "actionTitle": "Action-oriented title about efficiency/profitability",
        "bullets": ["Point 1 with peer comparison", "Point 2", "Point 3"],
        "metric": "XX.X% vs XX.X% peer avg",
        "chartType": "efficiency-ratio-peer"
      }
    ],
    "balanceSheet": [
      {
        "actionTitle": "Action-oriented title about assets/loans",
        "bullets": ["Point 1", "Point 2", "Point 3"],
        "metric": "$XXB",
        "chartType": "loan-mix"
      }
    ],
    "incomeStatement": [
      {
        "actionTitle": "Action-oriented title about revenue",
        "bullets": ["Point 1", "Point 2", "Point 3"],
        "metric": "$XXM",
        "chartType": "revenue-composition"
      }
    ],
    "actionClosing": [
      {
        "actionTitle": "Engage on [specific area] to address [finding]",
        "bullets": ["Why this matters", "Next step", "Expected outcome"],
        "chartType": "efficiency-ratio-peer"
      }
    ]
  }
}

REMEMBER: chartType is MANDATORY for every finding. McKinsey presentations always include visual data. Each chapter should have 1-2 findings (not more).`;

    const response = await this.anthropic.messages.create({
      model: this.model || 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;

    // Extract JSON from response with robust parsing
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from Claude response');
    }

    let jsonString = jsonMatch[0];
    let result;

    try {
      result = JSON.parse(jsonString);
    } catch (parseError) {
      console.log('[Presentation] Initial JSON parse failed, attempting cleanup...');
      console.log('[Presentation] Parse error:', parseError.message);

      // Try to fix common JSON issues
      try {
        // Remove trailing commas before ] or }
        jsonString = jsonString.replace(/,\s*([}\]])/g, '$1');
        // Fix unescaped quotes in strings (very basic)
        jsonString = jsonString.replace(/([^\\])\\n/g, '$1\\\\n');
        // Remove any control characters
        jsonString = jsonString.replace(/[\x00-\x1F\x7F]/g, ' ');

        result = JSON.parse(jsonString);
        console.log('[Presentation] JSON cleanup successful');
      } catch (cleanupError) {
        console.error('[Presentation] JSON cleanup also failed:', cleanupError.message);
        console.error('[Presentation] Raw JSON (first 2000 chars):', jsonString.substring(0, 2000));

        // Return a minimal valid structure as fallback
        console.log('[Presentation] Using fallback structure');
        result = {
          execSummary: {
            headline: 'Financial Analysis Summary',
            chartType: 'efficiency-ratio-peer',
            about: { size: 'See report for details', location: '', positioning: '' },
            keyInsights: ['Review full report for detailed insights'],
            anthropicEngagement: { foundation: 'Claude Code + Claude for Enterprise' }
          },
          chapters: {
            keyRatios: [{
              actionTitle: 'Key Financial Metrics Analysis',
              bullets: ['See full report for detailed analysis'],
              metric: 'N/A',
              chartType: 'efficiency-ratio-peer'
            }]
          }
        };
      }
    }

    // Auto-assign chart types if missing for any findings
    const autoAssignChartType = (finding, idx, chapterName) => {
      if (!finding.chartType || finding.chartType === 'null' || finding.chartType.includes('REQUIRED')) {
        const title = (finding.actionTitle || '').toLowerCase();

        // Chapter-specific defaults
        if (chapterName === 'strategicPriorities') {
          finding.chartType = 'roe-peer'; // Default to showing performance vs peers
        } else if (chapterName === 'keyRatios') {
          const defaults = ['efficiency-ratio-peer', 'roe-peer', 'nim-peer', 'operating-leverage-peer'];
          finding.chartType = defaults[idx % defaults.length];
        } else if (chapterName === 'balanceSheet') {
          finding.chartType = title.includes('loan') ? 'loan-growth' : 'asset-growth';
        } else if (chapterName === 'incomeStatement') {
          finding.chartType = title.includes('revenue') || title.includes('composition') ? 'revenue-composition' : 'net-income';
        } else if (chapterName === 'recommendations') {
          finding.chartType = 'efficiency-ratio-peer'; // Show opportunities vs peers
        } else {
          // Keyword-based fallback
          if (title.includes('efficiency')) {
            finding.chartType = 'efficiency-ratio-peer';
          } else if (title.includes('operating leverage')) {
            finding.chartType = 'operating-leverage-peer';
          } else if (title.includes('profitability') || title.includes('roe') || title.includes('roa')) {
            finding.chartType = 'roe-peer';
          } else {
            finding.chartType = 'net-income';
          }
        }

        console.log(`[Presentation] Auto-assigned chart type "${finding.chartType}" for ${chapterName} finding ${idx+1}`);
      }

      return finding;
    };

    // Process chapters structure
    if (result.chapters) {
      Object.keys(result.chapters).forEach(chapterName => {
        if (Array.isArray(result.chapters[chapterName])) {
          result.chapters[chapterName] = result.chapters[chapterName].map((finding, idx) =>
            autoAssignChartType(finding, idx, chapterName)
          );
        }
      });

      // Log chart selections for debugging
      console.log('[Presentation] Chart selections by chapter:');
      Object.keys(result.chapters).forEach(chapterName => {
        console.log(`  ${chapterName}:`);
        result.chapters[chapterName].forEach((f, i) => {
          console.log(`    ${i+1}. "${f.actionTitle}" → ${f.chartType}`);
        });
      });
    }

    // Convert chapter structure to flat keyFindings for backward compatibility
    result.keyFindings = [];
    if (result.chapters) {
      // Include actionClosing (new) or recommendations (legacy) for the closing slide
      const chapterOrder = ['strategicPriorities', 'keyRatios', 'balanceSheet', 'incomeStatement', 'actionClosing', 'recommendations'];
      chapterOrder.forEach(chapterName => {
        if (result.chapters[chapterName]) {
          result.keyFindings.push(...result.chapters[chapterName]);
        }
      });
    }

    return result;
  }

  /**
   * Generate HTML with McKinsey-style branding and layouts
   */
  generateHTML(bankName, summary, trendsData, options = {}) {
    const colors = {
      primary: '#D97757',      // Anthropic coral
      text: '#1A1A1A',
      textLight: '#666666',
      background: '#FAFAFA',
      cardBg: '#FFFFFF',
      border: '#E0E0E0',
      chartBg: '#F9FAFB'
    };

    const slides = [
      // Slide 1: Title
      {
        title: bankName,
        subtitle: 'Strategic Financial Analysis',
        type: 'title',
        footer: `Generated ${new Date().toLocaleDateString()}`
      },
      // Slide 2: Executive Summary
      {
        title: 'Executive Summary',
        content: summary.execSummary,
        type: 'summary'
      },
      // Slides 3-N: Key Findings
      ...summary.keyFindings.map(finding => ({
        title: finding.actionTitle,
        bullets: finding.bullets,
        metric: finding.metric,
        chartType: finding.chartType,
        type: 'finding'
      })),
      // Final Slide: Conclusion
      {
        title: 'Key Takeaways',
        bullets: summary.keyFindings.slice(0, 4).map(f => f.actionTitle),
        footer: 'Powered by Claude',
        type: 'conclusion'
      }
    ];

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${bankName} - Research Presentation</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      background: ${colors.background};
      color: ${colors.text};
      overflow: hidden;
    }

    .presentation {
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    /* Bank Logo - Upper Right Corner */
    .bank-logo-container {
      position: fixed;
      top: 30px;
      right: 100px;
      z-index: 101;
      max-width: 80px;
      max-height: 50px;
    }

    .bank-logo {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .bank-logo-container.hidden {
      display: none;
    }

    .slide {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 90vw;
      max-width: 1200px;
      height: 85vh;
      max-height: 675px;
      background: ${colors.cardBg};
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      padding: 60px 80px;
      display: none;
      flex-direction: column;
    }

    .slide.active {
      display: flex;
      animation: fadeIn 0.5s ease-in-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Title Slide */
    .slide-title {
      justify-content: center;
      text-align: center;
    }

    .slide-title .title-logo {
      max-width: 300px;
      max-height: 150px;
      object-fit: contain;
      margin-bottom: 40px;
    }

    .slide-title h1 {
      font-size: 3.5rem;
      font-weight: 600;
      color: ${colors.text};
      margin-bottom: 20px;
      line-height: 1.2;
    }

    .slide-title .subtitle {
      font-size: 1.5rem;
      color: ${colors.textLight};
      font-weight: 400;
    }

    .slide-title .footer-text {
      position: absolute;
      bottom: 40px;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 0.9rem;
      color: ${colors.textLight};
    }

    /* Content Slides - McKinsey Style */
    .slide h2 {
      font-size: 2rem;
      font-weight: 600;
      color: ${colors.text};
      margin-bottom: 30px;
      padding-bottom: 15px;
      border-bottom: 3px solid ${colors.primary};
      line-height: 1.3;
    }

    .slide-summary .content {
      font-size: 1.3rem;
      line-height: 1.8;
      color: ${colors.text};
    }

    /* Finding Slides - McKinsey Two-Column Layout */
    .slide-finding {
      display: grid;
      grid-template-columns: 1fr;
      grid-template-rows: auto auto 1fr;
      gap: 20px;
    }

    .slide-finding h2 {
      grid-column: 1;
    }

    .slide-finding .content-section {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .slide-finding ul {
      list-style: none;
      margin: 0;
    }

    .slide-finding li {
      font-size: 1.15rem;
      line-height: 1.5;
      color: ${colors.text};
      margin-bottom: 15px;
      padding-left: 35px;
      position: relative;
    }

    .slide-finding li:before {
      content: "•";
      position: absolute;
      left: 0;
      color: ${colors.primary};
      font-weight: 600;
      font-size: 1.8rem;
      line-height: 1.3;
    }

    .metric {
      display: inline-block;
      background: linear-gradient(135deg, ${colors.primary}15, ${colors.primary}25);
      color: ${colors.primary};
      padding: 12px 25px;
      border-radius: 6px;
      font-size: 1.2rem;
      font-weight: 600;
      border: 2px solid ${colors.primary};
      margin-top: 10px;
    }

    .chart-container {
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${colors.chartBg};
      border-radius: 8px;
      padding: 20px;
      margin-top: 20px;
      border: 1px solid ${colors.border};
    }

    .chart-container img {
      max-width: 100%;
      max-height: 350px;
      object-fit: contain;
      border-radius: 6px;
    }

    .slide-conclusion ul {
      list-style: none;
    }

    .slide-conclusion li {
      font-size: 1.25rem;
      line-height: 1.5;
      color: ${colors.text};
      margin-bottom: 25px;
      padding-left: 45px;
      position: relative;
    }

    .slide-conclusion li:before {
      content: "✓";
      position: absolute;
      left: 0;
      color: ${colors.primary};
      font-weight: 600;
      font-size: 1.8rem;
    }

    /* Navigation */
    .nav {
      position: fixed;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 15px;
      z-index: 100;
    }

    .nav button {
      background: ${colors.primary};
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.2s;
      font-weight: 500;
    }

    .nav button:hover {
      background: #c25a39;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(217, 119, 87, 0.3);
    }

    .nav button:disabled {
      background: #ccc;
      cursor: not-allowed;
      transform: none;
    }

    .slide-counter {
      position: fixed;
      top: 30px;
      right: 40px;
      font-size: 0.9rem;
      color: ${colors.textLight};
      background: ${colors.cardBg};
      padding: 8px 16px;
      border-radius: 20px;
      border: 1px solid ${colors.border};
      z-index: 100;
    }

    .logo {
      position: fixed;
      top: 30px;
      left: 40px;
      font-size: 0.9rem;
      color: ${colors.textLight};
      display: flex;
      align-items: center;
      gap: 8px;
      z-index: 100;
    }

    .logo img {
      width: 24px;
      height: 24px;
    }

    /* Banking terms - clickable */
    .banking-term {
      color: ${colors.primary};
      text-decoration: underline;
      text-decoration-style: dotted;
      cursor: help;
      transition: background-color 0.2s;
    }

    .banking-term:hover {
      background-color: rgba(217, 119, 87, 0.1);
      text-decoration-style: solid;
    }

    /* Term definition modal */
    .term-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }

    .term-modal.active {
      display: flex;
    }

    .term-modal-content {
      background: ${colors.cardBg};
      padding: 30px;
      border-radius: 12px;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      position: relative;
    }

    .term-modal-header {
      font-size: 1.8rem;
      font-weight: 600;
      color: ${colors.primary};
      margin-bottom: 15px;
    }

    .term-modal-body {
      font-size: 1.1rem;
      line-height: 1.6;
      color: ${colors.text};
    }

    .term-modal-loading {
      text-align: center;
      padding: 40px;
      color: ${colors.textLight};
    }

    .term-modal-close {
      position: absolute;
      top: 15px;
      right: 15px;
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: ${colors.textLight};
      padding: 5px 10px;
      border-radius: 4px;
    }

    .term-modal-close:hover {
      background: ${colors.background};
      color: ${colors.text};
    }

    /* Print styles */
    @media print {
      body {
        overflow: visible;
      }

      .slide {
        display: flex !important;
        page-break-after: always;
        width: 100%;
        height: 100vh;
        max-width: none;
        max-height: none;
        box-shadow: none;
      }

      .nav, .slide-counter, .logo, .keyboard-hint {
        display: none;
      }
    }

    /* Keyboard hint */
    .keyboard-hint {
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.85rem;
      color: ${colors.textLight};
      opacity: 0.6;
    }
  </style>
</head>
<body>
  ${options.symbolLogo ? `
  <div class="bank-logo-container">
    <img src="${options.symbolLogo}" alt="Bank Logo" class="bank-logo">
  </div>
  ` : ''}

  <div class="logo">
    <span>Powered by Claude</span>
  </div>

  <div class="slide-counter">
    <span id="current">1</span> / <span id="total">${slides.length}</span>
  </div>

  <div class="presentation">
    ${slides.map((slide, index) => this.renderSlide(slide, index, options)).join('\n')}
  </div>

  <div class="nav">
    <button id="prev" onclick="previousSlide()">← Previous</button>
    <button id="next" onclick="nextSlide()">Next →</button>
  </div>

  <div class="keyboard-hint">
    Use arrow keys or click buttons to navigate • Click underlined terms for definitions
  </div>

  <!-- Term Definition Modal -->
  <div class="term-modal" id="termModal">
    <div class="term-modal-content">
      <button class="term-modal-close" onclick="closeTermModal()">×</button>
      <div class="term-modal-header" id="termHeader"></div>
      <div class="term-modal-body" id="termBody"></div>
    </div>
  </div>

  <script>
    let currentSlide = 0;
    const slides = document.querySelectorAll('.slide');
    const totalSlides = slides.length;

    // Cache for term definitions
    const termDefinitions = {};

    function showSlide(n) {
      slides.forEach(slide => slide.classList.remove('active'));

      currentSlide = Math.max(0, Math.min(n, totalSlides - 1));
      slides[currentSlide].classList.add('active');

      // Hide bank logo on title slide (slide 0)
      const bankLogoContainer = document.querySelector('.bank-logo-container');
      if (bankLogoContainer) {
        if (currentSlide === 0) {
          bankLogoContainer.classList.add('hidden');
        } else {
          bankLogoContainer.classList.remove('hidden');
        }
      }

      document.getElementById('current').textContent = currentSlide + 1;
      document.getElementById('prev').disabled = currentSlide === 0;
      document.getElementById('next').disabled = currentSlide === totalSlides - 1;
    }

    function nextSlide() {
      if (currentSlide < totalSlides - 1) {
        showSlide(currentSlide + 1);
      }
    }

    function previousSlide() {
      if (currentSlide > 0) {
        showSlide(currentSlide - 1);
      }
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        previousSlide();
      } else if (e.key === 'Home') {
        e.preventDefault();
        showSlide(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        showSlide(totalSlides - 1);
      }
    });

    // Initialize
    showSlide(0);

    // Banking Terms - Make clickable and add definitions
    function wrapBankingTerms() {
      const bankingTerms = [
        'efficiency ratio', 'operating leverage', 'return on equity', 'ROE', 'return on assets', 'ROA',
        'net interest margin', 'NIM', 'loan-to-deposit ratio', 'LTD', 'non-performing loans', 'NPL',
        'tier 1 capital', 'capital adequacy', 'risk-weighted assets', 'RWA', 'charge-offs',
        'provision for credit losses', 'PCL', 'net interest income', 'NII', 'noninterest income',
        'pre-provision net revenue', 'PPNR', 'cost of funds', 'yield on assets',
        'deposits', 'loan portfolio', 'asset quality', 'liquidity', 'profitability'
      ];

      document.querySelectorAll('.slide li, .slide .content, .slide .metric').forEach(element => {
        let html = element.innerHTML;

        bankingTerms.forEach(term => {
          const regex = new RegExp(\`\\\\b(\${term})\\\\b\`, 'gi');
          html = html.replace(regex, (match) => {
            const normalized = match.toLowerCase().replace(/\\s+/g, '_');
            return \`<span class="banking-term" data-term="\${normalized}" onclick="showTermDefinition('\${normalized}', '\${match}')">\${match}</span>\`;
          });
        });

        element.innerHTML = html;
      });
    }

    async function showTermDefinition(termKey, termDisplay) {
      const modal = document.getElementById('termModal');
      const header = document.getElementById('termHeader');
      const body = document.getElementById('termBody');

      header.textContent = termDisplay;
      body.innerHTML = '<div class="term-modal-loading">Loading definition...</div>';
      modal.classList.add('active');

      if (termDefinitions[termKey]) {
        body.innerHTML = termDefinitions[termKey];
        return;
      }

      try {
        const response = await fetch(\`/api/research/term-definition?term=\${encodeURIComponent(termDisplay)}\`);
        const data = await response.json();

        if (data.definition) {
          termDefinitions[termKey] = data.definition;
          body.innerHTML = data.definition;
        } else {
          body.innerHTML = '<p>Definition not available.</p>';
        }
      } catch (error) {
        console.error('Error fetching term definition:', error);
        body.innerHTML = '<p>Error loading definition. Please try again.</p>';
      }
    }

    function closeTermModal() {
      document.getElementById('termModal').classList.remove('active');
    }

    // Close modal on outside click
    document.getElementById('termModal').addEventListener('click', (e) => {
      if (e.target.id === 'termModal') {
        closeTermModal();
      }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeTermModal();
      }
    });

    // Wrap banking terms after page loads
    wrapBankingTerms();
  </script>
</body>
</html>`;
  }

  renderSlide(slide, index, options = {}) {
    if (slide.type === 'title') {
      return `
    <div class="slide slide-title ${index === 0 ? 'active' : ''}">
      ${options.fullLogo ? `<img src="${options.fullLogo}" alt="Bank Logo" class="title-logo">` : ''}
      <h1>${slide.title}</h1>
      <div class="subtitle">${slide.subtitle}</div>
      <div class="footer-text">${slide.footer}</div>
    </div>`;
    }

    if (slide.type === 'summary') {
      return `
    <div class="slide slide-summary">
      <h2>${slide.title}</h2>
      <div class="content">${slide.content}</div>
    </div>`;
    }

    if (slide.type === 'finding') {
      const chartHtml = slide.chartType && options.charts && options.charts[slide.chartType]
        ? `<div class="chart-container"><img src="${options.charts[slide.chartType]}" alt="${slide.chartType} chart"></div>`
        : '';

      return `
    <div class="slide slide-finding">
      <h2>${slide.title}</h2>
      <div class="content-section">
        <ul>
          ${slide.bullets.map(bullet => `<li>${bullet}</li>`).join('\n          ')}
        </ul>
        ${slide.metric ? `<div class="metric">${slide.metric}</div>` : ''}
      </div>
      ${chartHtml}
    </div>`;
    }

    if (slide.type === 'conclusion') {
      return `
    <div class="slide slide-conclusion">
      <h2>${slide.title}</h2>
      <ul>
        ${slide.bullets.map(bullet => `<li>${bullet}</li>`).join('\n        ')}
      </ul>
      ${slide.footer ? `<div class="footer-text" style="position: absolute; bottom: 40px;">${slide.footer}</div>` : ''}
    </div>`;
    }

    return '';
  }
}

module.exports = PresentationService;
