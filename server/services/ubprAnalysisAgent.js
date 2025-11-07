const Anthropic = require('@anthropic-ai/sdk');

/**
 * UBPR Analysis Agent
 * Analyzes UBPR validation results across multiple banks to identify systematic calculation issues
 */
class UBPRAnalysisAgent {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 120000 // 2 minutes
    });
    this.model = 'claude-sonnet-4-20250514';
  }

  /**
   * Analyze UBPR validation results to detect systematic calculation issues
   * @param {Array} comparisons - Array of comparison results from batch validation
   * @param {string} period - Reporting period
   * @returns {Promise<Object>} Analysis results with identified issues
   */
  async analyzeSystematicIssues(comparisons, period) {
    console.log(`Analyzing ${comparisons.length} bank comparisons for systematic issues...`);

    // Prepare data for analysis
    const analysisData = this.prepareAnalysisData(comparisons, period);

    // Build prompt
    const prompt = this.buildAnalysisPrompt(analysisData);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const analysisText = response.content[0].text;

      // Parse the analysis into structured format
      const parsedAnalysis = this.parseAnalysis(analysisText, comparisons);

      return parsedAnalysis;

    } catch (error) {
      console.error('Error in UBPR analysis:', error);
      throw new Error(`Analysis failed: ${error.message}`);
    }
  }

  /**
   * Prepare data for analysis
   */
  prepareAnalysisData(comparisons, period) {
    const successful = comparisons.filter(c => c.status === 'success');

    // Calculate statistics for each metric
    const metrics = ['roa', 'roe', 'nim', 'efficiencyRatio', 'tier1LeverageRatio'];

    const metricStats = {};
    metrics.forEach(metric => {
      const differences = successful
        .map(c => c.differences?.[metric])
        .filter(d => d && d.percent !== null && !isNaN(d.percent));

      if (differences.length > 0) {
        const percents = differences.map(d => Math.abs(d.percent));
        metricStats[metric] = {
          count: differences.length,
          avgDifference: percents.reduce((a, b) => a + b, 0) / percents.length,
          maxDifference: Math.max(...percents),
          minDifference: Math.min(...percents),
          banksWithIssues: differences.filter(d => d.status === 'significant' || d.status === 'warning').length,
          issuesByStatus: {
            significant: differences.filter(d => d.status === 'significant').length,
            warning: differences.filter(d => d.status === 'warning').length,
            acceptable: differences.filter(d => d.status === 'acceptable').length,
            match: differences.filter(d => d.status === 'match').length
          }
        };
      }
    });

    // Analyze balance sheet and income statement item differences
    const balanceSheetStats = this.analyzeComponentDifferences(successful, 'balanceSheetItems');
    const incomeStatementStats = this.analyzeComponentDifferences(successful, 'incomeStatementItems');

    return {
      period,
      totalBanks: comparisons.length,
      successfulComparisons: successful.length,
      metricStats,
      balanceSheetStats,
      incomeStatementStats,
      comparisons: successful.map(c => ({
        bankName: c.bankName,
        idrssd: c.idrssd,
        differences: c.differences,
        ourMetrics: c.ourMetrics,
        ubprMetrics: c.ubprMetrics,
        balanceSheetItems: c.balanceSheetItems,
        incomeStatementItems: c.incomeStatementItems,
        formulaBreakdown: c.formulaBreakdown
      }))
    };
  }

  /**
   * Analyze differences in balance sheet or income statement components
   */
  analyzeComponentDifferences(comparisons, itemType) {
    const stats = {};

    // Get all unique component keys across all comparisons
    const allKeys = new Set();
    comparisons.forEach(c => {
      if (c[itemType]?.our) {
        Object.keys(c[itemType].our).forEach(key => allKeys.add(key));
      }
    });

    // Calculate statistics for each component
    allKeys.forEach(key => {
      const differences = [];
      comparisons.forEach(c => {
        const ourValue = c[itemType]?.our?.[key];
        const ubprValue = c[itemType]?.ubpr?.[key];

        if (ourValue != null && ubprValue != null && ourValue !== 0 && ubprValue !== 0) {
          const diff = ourValue - ubprValue;
          const percentDiff = (diff / ubprValue) * 100;
          differences.push({
            bankName: c.bankName,
            ourValue,
            ubprValue,
            absolute: diff,
            percent: percentDiff
          });
        }
      });

      if (differences.length >= 2) { // Only include if we have data from at least 2 banks
        const percents = differences.map(d => Math.abs(d.percent));
        const avgDiff = percents.reduce((a, b) => a + b, 0) / percents.length;

        stats[key] = {
          count: differences.length,
          avgAbsDifference: avgDiff,
          maxAbsDifference: Math.max(...percents),
          significant: differences.filter(d => Math.abs(d.percent) > 5).length,
          warning: differences.filter(d => Math.abs(d.percent) > 2 && Math.abs(d.percent) <= 5).length
        };
      }
    });

    return stats;
  }

  /**
   * Build analysis prompt
   */
  buildAnalysisPrompt(data) {
    // Check how many banks have PDF data
    const banksWithPDFData = data.comparisons.filter(c => c.pdfMetrics && Object.values(c.pdfMetrics).some(v => v !== null)).length;

    const metricSummaries = Object.entries(data.metricStats).map(([metric, stats]) => `
### ${metric.toUpperCase()}
- Total banks compared: ${stats.count}
- Average absolute difference: ${stats.avgDifference.toFixed(2)}%
- Max difference: ${stats.maxDifference.toFixed(2)}%
- Banks with significant issues: ${stats.issuesByStatus.significant}
- Banks with warnings: ${stats.issuesByStatus.warning}
- Banks with acceptable variance: ${stats.issuesByStatus.acceptable}
- Banks matching: ${stats.issuesByStatus.match}
`).join('\n');

    // Balance sheet component analysis
    const balanceSheetSummary = Object.entries(data.balanceSheetStats || {})
      .filter(([_, stats]) => stats.avgAbsDifference > 2)
      .sort(([_, a], [__, b]) => b.avgAbsDifference - a.avgAbsDifference)
      .slice(0, 10)
      .map(([item, stats]) =>
        `- ${item}: Avg ${stats.avgAbsDifference.toFixed(2)}% diff (${stats.count} banks, ${stats.significant} significant)`
      ).join('\n');

    // Income statement component analysis
    const incomeStatementSummary = Object.entries(data.incomeStatementStats || {})
      .filter(([_, stats]) => stats.avgAbsDifference > 2)
      .sort(([_, a], [__, b]) => b.avgAbsDifference - a.avgAbsDifference)
      .slice(0, 10)
      .map(([item, stats]) =>
        `- ${item}: Avg ${stats.avgAbsDifference.toFixed(2)}% diff (${stats.count} banks, ${stats.significant} significant)`
      ).join('\n');

    const bankDetails = data.comparisons.slice(0, 10).map((c, i) => {
      const metricLines = Object.entries(c.differences || {}).map(([metric, diff]) =>
        `  ${metric}: Our=${c.ourMetrics?.[metric]?.toFixed(2) || 'N/A'}, UBPR=${c.ubprMetrics?.[metric]?.toFixed(2) || 'N/A'}, Diff=${diff.percent?.toFixed(2) || 'N/A'}% [${diff.status}]`
      ).join('\n');

      return `Bank ${i + 1}: ${c.bankName} (${c.idrssd})\n${metricLines}`;
    }).join('\n\n');

    return `You are a financial regulatory compliance analyst reviewing UBPR (Uniform Bank Performance Report) validation results across ${data.successfulComparisons} banks for the period ${data.period}.

Your task is to identify SYSTEMATIC calculation issues - problems that affect multiple banks or indicate incorrect formula implementation, not just one-off data issues.

**IMPORTANT: PDF Data Available**
${banksWithPDFData > 0
    ? `${banksWithPDFData} of ${data.successfulComparisons} banks have PDF metrics from investor presentations and annual reports. These provide a THIRD SOURCE OF TRUTH that can help identify which calculations are correct.`
    : 'No PDF data available for these banks.'}

## Validation Results Summary

${metricSummaries}

## Balance Sheet Component Differences (Top Issues)

${balanceSheetSummary || 'No significant balance sheet differences detected.'}

## Income Statement Component Differences (Top Issues)

${incomeStatementSummary || 'No significant income statement differences detected.'}

## Individual Bank Details

${bankDetails}

## Analysis Instructions

1. **USE PDF DATA AS TIE-BREAKER**: When Our calculations and UBPR values differ significantly, check if PDF metrics are available:
   - If PDF matches Our value → Our calculation is likely correct
   - If PDF matches UBPR value → UBPR is likely correct, investigate our formula
   - If PDF differs from both → May indicate timing differences or presentation format differences

2. Look for PATTERNS across multiple banks:
   - Are specific metrics consistently off (e.g., ROE always significantly different)?
   - Do all banks show similar direction of error (e.g., all overestimated)?
   - Are errors clustered around certain bank sizes or types?

2. Analyze ROOT CAUSES using component data AND PDF metrics:
   - If ROA is off, check if netIncome or totalAssets components are the issue
   - Compare component values across all three sources (Our, UBPR, PDF) when available
   - If ROE is off, check if netIncome or totalEquity components are the issue
   - If NIM is off, check interestIncome, interestExpense, or avgEarningAssets
   - Look at balance sheet and income statement differences to pinpoint the source
   - Use PDF data to validate which source has the correct component values

3. Consider possible FORMULA ISSUES:
   - Incorrect denominator (e.g., using point-in-time vs average assets)
   - Missing annualization factors
   - YTD vs quarterly conversion errors
   - Wrong components in numerator or denominator
   - Incorrect aggregation of sub-components

4. Distinguish between:
   - SYSTEMATIC issues (formula/calculation bugs affecting multiple banks)
   - DATA issues (one bank has bad data)
   - EXPECTED variances (due to different calculation timing, rounding, etc.)

## Response Format

Provide your analysis in this JSON format:

{
  "issues": [
    {
      "title": "Brief title of the issue",
      "description": "Detailed description of what's wrong and why",
      "severity": "critical|high|medium|low",
      "affectedMetrics": ["roa", "roe", etc.],
      "affectedBanks": ["Bank Name 1", "Bank Name 2"],
      "likelyCause": "Hypothesis about what's causing this",
      "recommendation": "What should be fixed"
    }
  ],
  "summary": "Overall assessment of calculation accuracy",
  "confidence": "high|medium|low"
}

If NO systematic issues are found, return:
{
  "issues": [],
  "summary": "No systematic calculation issues detected. All differences are within expected variance.",
  "confidence": "high"
}`;
  }

  /**
   * Parse Claude's analysis response
   */
  parseAnalysis(analysisText, comparisons) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          ...parsed,
          rawAnalysis: analysisText
        };
      }

      // If no JSON found, create a structured response from the text
      return {
        issues: [{
          title: 'Analysis Results',
          description: analysisText,
          severity: 'info',
          affectedMetrics: [],
          affectedBanks: [],
          likelyCause: 'See description',
          recommendation: 'Review analysis text'
        }],
        summary: 'Analysis completed. See raw analysis for details.',
        confidence: 'medium',
        rawAnalysis: analysisText
      };

    } catch (error) {
      console.error('Error parsing analysis:', error);
      return {
        issues: [{
          title: 'Parsing Error',
          description: analysisText,
          severity: 'info',
          affectedMetrics: [],
          affectedBanks: [],
          likelyCause: 'Unable to parse structured response',
          recommendation: 'Review raw analysis'
        }],
        summary: 'Analysis completed but response format was unexpected',
        confidence: 'low',
        rawAnalysis: analysisText
      };
    }
  }
}

module.exports = new UBPRAnalysisAgent();
