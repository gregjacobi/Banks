const Anthropic = require('@anthropic-ai/sdk');
const PDF = require('../models/PDF');
const PDFMetricsCache = require('../models/PDFMetricsCache');
const modelResolver = require('./modelResolver');
const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * PDF Metrics Extraction Agent
 * Reads bank PDF reports (investor presentations, annual reports) and extracts financial metrics
 * for comparison with calculated and UBPR metrics
 */
class PDFMetricsAgent {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 180000 // 3 minutes
    });
    this.model = modelResolver.getModelSync();
    this.initializeModel();
  }

  async initializeModel() {
    try {
      const latestModel = await modelResolver.getLatestSonnetModel();
      this.model = latestModel;
      console.log(`PDFMetricsAgent initialized with model: ${this.model}`);
    } catch (error) {
      console.error('Error initializing model:', error.message);
    }
  }

  /**
   * Compute hash of PDF file(s) for cache key
   */
  async computePDFHash(pdfs) {
    const hashes = [];
    for (const pdf of pdfs) {
      try {
        const pdfPath = pdf.getFilePath();
        const stats = await fs.stat(pdfPath);
        // Use file size + modification time + PDF ID as hash components
        const hashInput = `${pdf.pdfId}-${stats.size}-${stats.mtimeMs}`;
        const hash = crypto.createHash('md5').update(hashInput).digest('hex');
        hashes.push(hash);
      } catch (error) {
        console.error(`Error computing hash for PDF ${pdf.pdfId}:`, error.message);
      }
    }
    // Combine all PDF hashes
    return crypto.createHash('md5').update(hashes.sort().join('-')).digest('hex');
  }

  /**
   * Extract financial metrics from bank PDFs
   * @param {string} idrssd - Bank ID
   * @param {string} reportingPeriod - Reporting period to match (YYYY-MM-DD)
   * @returns {Promise<Object>} Extracted metrics with source information
   */
  async extractMetricsFromPDFs(idrssd, reportingPeriod) {
    console.log(`\nExtracting metrics from PDFs for bank ${idrssd}, period ${reportingPeriod}`);

    try {
      // Get all PDFs for this bank
      const pdfs = await PDF.getByBank(idrssd);

      if (!pdfs || pdfs.length === 0) {
        console.log(`No PDFs found for bank ${idrssd}`);
        return {
          hasData: false,
          metrics: null,
          sources: [],
          note: 'No PDFs available for this bank'
        };
      }

      console.log(`Found ${pdfs.length} PDFs for bank ${idrssd}`);

      // Filter to recent PDFs (within 6 months of reporting period)
      const reportDate = new Date(reportingPeriod);
      const sixMonthsAgo = new Date(reportDate);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixMonthsAfter = new Date(reportDate);
      sixMonthsAfter.setMonth(sixMonthsAfter.getMonth() + 6);

      const recentPDFs = pdfs.filter(pdf => {
        const uploadDate = new Date(pdf.uploadedAt);
        return uploadDate >= sixMonthsAgo && uploadDate <= sixMonthsAfter;
      });

      if (recentPDFs.length === 0) {
        console.log(`No recent PDFs found for period ${reportingPeriod}`);
        return {
          hasData: false,
          metrics: null,
          sources: [],
          note: `No PDFs within 6 months of ${reportingPeriod}`
        };
      }

      // Take only the most recent PDF to avoid token limits and memory issues
      const pdfsToAnalyze = recentPDFs.slice(0, 1);

      console.log(`Using ${pdfsToAnalyze.length} PDF(s) out of ${recentPDFs.length} found`);

      // Compute hash of PDFs to check cache
      const pdfHash = await this.computePDFHash(pdfsToAnalyze);
      
      // Check cache first
      const cached = await PDFMetricsCache.findByBankAndPeriod(idrssd, reportingPeriod, pdfHash);
      if (cached) {
        console.log(`Using cached PDF metrics for ${idrssd} - ${reportingPeriod} (cached at ${cached.extractedAt})`);
        return {
          hasData: cached.metrics !== null,
          metrics: cached.metrics,
          balanceSheet: cached.balanceSheet,
          incomeStatement: cached.incomeStatement,
          sources: cached.sources,
          confidence: cached.confidence,
          note: cached.note,
          warnings: cached.warnings || [],
          period: cached.period,
          quarter: cached.quarter,
          incomeStatementBasis: cached.incomeStatementBasis,
          metricsBasis: cached.metricsBasis
        };
      }

      console.log(`No cache found, extracting metrics from PDFs...`);

      // Build prompt and attach PDFs
      const messageContent = [];

      // Attach PDFs
      for (const pdf of pdfsToAnalyze) {
        try {
          const pdfPath = pdf.getFilePath();
          const pdfData = await fs.readFile(pdfPath);
          const base64Data = pdfData.toString('base64');

          messageContent.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Data
            },
            cache_control: { type: 'ephemeral' }
          });

          console.log(`Attached PDF: ${pdf.originalFilename} (${Math.round(pdf.fileSize / 1024)}KB, base64: ${Math.round(base64Data.length / 1024)}KB)`);
        } catch (error) {
          console.error(`Failed to attach PDF ${pdf.originalFilename}:`, error.message);
        }
      }

      // Add extraction prompt
      messageContent.push({
        type: 'text',
        text: this.buildExtractionPrompt(reportingPeriod)
      });

      // Call Claude API
      console.log(`Calling Claude API for PDF extraction (bank ${idrssd})...`);

      try {
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 12000,  // Must be greater than budget_tokens (10000)
          thinking: {
            type: 'enabled',
            budget_tokens: 10000
          },
          messages: [{
            role: 'user',
            content: messageContent
          }]
        });

        console.log(`Claude API call successful for bank ${idrssd}`);

        // Extract metrics from response
        const responseText = response.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n');

        const extracted = this.parseExtractedMetrics(responseText, pdfsToAnalyze);

        console.log(`PDF metrics extracted for bank ${idrssd}: ${extracted.metrics ? 'Success' : 'No data'}`);

        // Cache the results
        try {
          await PDFMetricsCache.findOneAndUpdate(
            {
              idrssd,
              reportingPeriod: new Date(reportingPeriod),
              pdfHash
            },
            {
              idrssd,
              reportingPeriod: new Date(reportingPeriod),
              pdfHash,
              pdfIds: pdfsToAnalyze.map(p => p.pdfId),
              metrics: extracted.metrics,
              balanceSheet: extracted.balanceSheet,
              incomeStatement: extracted.incomeStatement,
              sources: extracted.sources,
              confidence: extracted.confidence,
              note: extracted.note,
              warnings: extracted.warnings || [],
              period: extracted.period,
              quarter: extracted.quarter,
              incomeStatementBasis: extracted.incomeStatementBasis,
              metricsBasis: extracted.metricsBasis,
              extractedAt: new Date()
            },
            { upsert: true, new: true }
          );
          console.log(`Cached PDF metrics for ${idrssd} - ${reportingPeriod}`);
        } catch (cacheError) {
          console.error(`Error caching PDF metrics:`, cacheError.message);
          // Don't fail the request if caching fails
        }

        return {
          hasData: extracted.metrics !== null,
          metrics: extracted.metrics,
          balanceSheet: extracted.balanceSheet,
          incomeStatement: extracted.incomeStatement,
          sources: extracted.sources,
          confidence: extracted.confidence,
          note: extracted.note,
          warnings: extracted.warnings || [],
          period: extracted.period,
          quarter: extracted.quarter,
          incomeStatementBasis: extracted.incomeStatementBasis,
          metricsBasis: extracted.metricsBasis,
          rawResponse: responseText
        };

      } catch (apiError) {
        console.error(`Claude API error for bank ${idrssd}:`, apiError.message);
        console.error(`Error type: ${apiError.constructor.name}`);
        throw apiError; // Re-throw to be caught by outer catch
      }

    } catch (error) {
      console.error(`Error extracting metrics from PDFs for bank ${idrssd}:`, error.message);
      console.error(`Error stack:`, error.stack);
      return {
        hasData: false,
        metrics: null,
        balanceSheet: null,
        incomeStatement: null,
        sources: [],
        confidence: null,
        note: `Error: ${error.message}`
      };
    }
  }

  /**
   * Build prompt for metrics extraction
   */
  buildExtractionPrompt(reportingPeriod) {
    const period = new Date(reportingPeriod);
    const quarter = Math.ceil((period.getMonth() + 1) / 3);
    const quarterLabel = `Q${quarter}`;
    const year = period.getFullYear();

    return `You are a financial data extraction specialist. Review the provided PDF documents (investor presentations, annual reports, earnings supplements) and extract the following financial metrics for ${quarterLabel} ${year} or the closest available period.

## Metrics to Extract

### Performance Ratios (%)
1. **ROA** (Return on Assets) - expressed as a percentage
2. **ROE** (Return on Equity) - expressed as a percentage
3. **NIM** (Net Interest Margin) - expressed as a percentage
4. **Efficiency Ratio** - expressed as a percentage
5. **Tier 1 Leverage Ratio** - expressed as a percentage

### Balance Sheet Items ($ in thousands or millions - note the unit)
6. **Total Assets**
7. **Total Loans** (Net Loans and Leases)
8. **Total Securities**
9. **Total Deposits**
10. **Total Equity** (Total Stockholders' Equity / Total Equity Capital)
11. **Cash and Due from Banks**
12. **Average Total Assets** (if shown separately from point-in-time)
13. **Average Total Equity** (if shown separately from point-in-time)
14. **Average Earning Assets** (if available)

### Income Statement Items ($ in thousands or millions - note the unit)
15. **Interest Income** (Total Interest Income)
16. **Interest Expense** (Total Interest Expense)
17. **Net Interest Income**
18. **Provision for Loan/Credit Losses**
19. **Noninterest Income**
20. **Noninterest Expense**
21. **Net Income** (Net Income Available to Common Stockholders)

## Response Format

Return your findings in this JSON format:

\`\`\`json
{
  "metrics": {
    "roa": <number or null>,
    "roe": <number or null>,
    "nim": <number or null>,
    "efficiencyRatio": <number or null>,
    "tier1LeverageRatio": <number or null>
  },
  "balanceSheet": {
    "totalAssets": <number or null>,
    "totalLoans": <number or null>,
    "totalSecurities": <number or null>,
    "totalDeposits": <number or null>,
    "totalEquity": <number or null>,
    "cashAndDue": <number or null>,
    "avgTotalAssets": <number or null>,
    "avgTotalEquity": <number or null>,
    "avgEarningAssets": <number or null>
  },
  "incomeStatement": {
    "interestIncome": <number or null>,
    "interestExpense": <number or null>,
    "netInterestIncome": <number or null>,
    "provisionForLosses": <number or null>,
    "noninterestIncome": <number or null>,
    "noninterestExpense": <number or null>,
    "netIncome": <number or null>
  },
  "notes": {
    "period": "Q# YYYY or date found",
    "quarter": <1, 2, 3, or 4>,
    "balanceSheetUnit": "thousands" or "millions",
    "incomeStatementUnit": "thousands" or "millions",
    "incomeStatementBasis": "ytd" or "annualized" or "quarterly",
    "metricsBasis": "annualized" or "ttm" or "quarterly",
    "sources": ["filename1.pdf page X", "filename2.pdf page Y"],
    "confidence": "high|medium|low",
    "warnings": ["Any caveats, e.g., 'Income values are YTD and need annualization'", "Period is Q3 2024, not Q4 2024"]
  }
}
\`\`\`

## Important Instructions

1. **Units**: All financial values should be in THOUSANDS (not millions, not dollars). If the document shows millions, multiply by 1000. If it shows billions, multiply by 1,000,000.

2. **Percentages**: Return ratios as percentages (e.g., 1.25 for 1.25%, not 0.0125)

3. **Period Matching**: Try to find data for ${quarterLabel} ${year}. If not available, use the closest period and note it in warnings.

4. **YTD vs Annualized**: CRITICAL - Identify whether income statement values and performance ratios are:
   - "ytd" = Year-to-date (cumulative from start of year)
   - "annualized" = Already annualized by the bank
   - "quarterly" = Single quarter only
   - Set "incomeStatementBasis" for income/expense items
   - Set "metricsBasis" for performance ratios (ROA, ROE, NIM, etc.)
   - If unclear, examine headers, footnotes, and context clues in the PDF
   - Note in warnings if you had to infer the basis

5. **Quarter Identification**: Extract which quarter this data is for (1, 2, 3, or 4) and set the "quarter" field. This is needed for annualization.

6. **Source Attribution**: In the notes.sources array, specify which PDF and page number each metric came from.

7. **Confidence**: Rate your confidence based on:
   - "high": Found explicit values in clear tables/charts for the target period
   - "medium": Found values but for a nearby period, or values required calculation
   - "low": Had to estimate or infer values

6. **Missing Data**: Use null for any metrics you cannot find. Do NOT guess or estimate.

7. **Averages vs Point-in-Time**: If the document shows both "Average Total Assets" and "Total Assets", extract both. The average values are typically used in ratio calculations.

8. **DO NOT Annualize**: Return the values EXACTLY as shown in the PDF. Do NOT apply any annualization yourself - just accurately identify whether they are YTD, annualized, or quarterly in the "incomeStatementBasis" and "metricsBasis" fields. The system will handle annualization if needed.

Please analyze the PDFs now and return ONLY the JSON object, no other text.`;
  }

  /**
   * Parse Claude's response to extract structured metrics
   */
  parseExtractedMetrics(responseText, pdfs) {
    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in response');
        return {
          metrics: null,
          sources: pdfs.map(pdf => pdf.originalFilename),
          note: 'Unable to parse response'
        };
      }

      const data = JSON.parse(jsonMatch[0]);

      // Convert to our comparison format (all values in thousands)
      const metrics = {
        roa: data.metrics?.roa,
        roe: data.metrics?.roe,
        nim: data.metrics?.nim,
        efficiencyRatio: data.metrics?.efficiencyRatio,
        tier1LeverageRatio: data.metrics?.tier1LeverageRatio
      };

      const balanceSheet = data.balanceSheet || {};
      const incomeStatement = data.incomeStatement || {};

      // Convert from millions to thousands if needed
      const balanceSheetUnit = data.notes?.balanceSheetUnit || 'thousands';
      const incomeStatementUnit = data.notes?.incomeStatementUnit || 'thousands';

      const bsMultiplier = balanceSheetUnit === 'millions' ? 1000 : 1;
      const isMultiplier = incomeStatementUnit === 'millions' ? 1000 : 1;

      const normalizedBalanceSheet = {};
      Object.keys(balanceSheet).forEach(key => {
        normalizedBalanceSheet[key] = balanceSheet[key] !== null
          ? balanceSheet[key] * bsMultiplier
          : null;
      });

      const normalizedIncomeStatement = {};
      Object.keys(incomeStatement).forEach(key => {
        normalizedIncomeStatement[key] = incomeStatement[key] !== null
          ? incomeStatement[key] * isMultiplier
          : null;
      });

      // Apply annualization if values are YTD
      const incomeStatementBasis = data.notes?.incomeStatementBasis;
      const metricsBasis = data.notes?.metricsBasis;
      const quarter = data.notes?.quarter;
      const warnings = data.notes?.warnings || [];

      let annualizationFactor = 1;

      if (incomeStatementBasis === 'ytd' && quarter) {
        // YTD values need to be annualized: multiply by (4 / current quarter)
        annualizationFactor = 4 / quarter;
        console.log(`Annualizing YTD income statement values by factor ${annualizationFactor.toFixed(2)} (Q${quarter})`);
        warnings.push(`Income statement values were YTD and have been annualized (x${annualizationFactor.toFixed(2)})`);

        // Apply annualization to income statement items
        Object.keys(normalizedIncomeStatement).forEach(key => {
          if (normalizedIncomeStatement[key] !== null) {
            normalizedIncomeStatement[key] *= annualizationFactor;
          }
        });
      }

      // Apply annualization to metrics if they're not already annualized
      let finalMetrics = { ...metrics };
      if (metricsBasis === 'ytd' || metricsBasis === 'quarterly') {
        console.log(`Metrics were reported as ${metricsBasis}, assuming already correct for comparison`);
        warnings.push(`Metrics were reported as ${metricsBasis}`);
      } else if (metricsBasis !== 'annualized' && metricsBasis !== 'ttm') {
        console.log(`Metrics basis unclear (${metricsBasis}), using as-is`);
        warnings.push(`Metrics basis was unclear: ${metricsBasis}`);
      }

      return {
        metrics: finalMetrics,
        balanceSheet: normalizedBalanceSheet,
        incomeStatement: normalizedIncomeStatement,
        sources: data.notes?.sources || pdfs.map(pdf => pdf.originalFilename),
        period: data.notes?.period,
        quarter: quarter,
        confidence: data.notes?.confidence,
        warnings: warnings,
        incomeStatementBasis: incomeStatementBasis,
        metricsBasis: metricsBasis,
        note: data.notes?.confidence ? `Extracted with ${data.notes.confidence} confidence` : 'Metrics extracted'
      };

    } catch (error) {
      console.error('Error parsing extracted metrics:', error);
      return {
        metrics: null,
        sources: pdfs.map(pdf => pdf.originalFilename),
        note: `Parse error: ${error.message}`
      };
    }
  }
}

module.exports = new PDFMetricsAgent();
