const puppeteer = require('puppeteer');
const { marked } = require('marked');
const fs = require('fs').promises;
const path = require('path');

/**
 * Generate a PDF from markdown content
 * @param {string} markdown - The markdown content to convert
 * @param {string} title - The document title
 * @param {string} bankName - Bank name for header
 * @param {string} logoPath - Optional path to bank logo file
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generatePDFFromMarkdown(markdown, title = 'Bank Analysis Report', bankName = '', logoPath = null) {
  let browser;
  try {
    // Convert markdown to HTML
    const htmlContent = marked.parse(markdown);

    // Read and encode logo if provided
    let logoDataUrl = null;
    if (logoPath) {
      try {
        const logoBuffer = await fs.readFile(logoPath);
        const ext = path.extname(logoPath).toLowerCase();
        const mimeTypes = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.svg': 'image/svg+xml'
        };
        const mimeType = mimeTypes[ext] || 'image/png';
        logoDataUrl = `data:${mimeType};base64,${logoBuffer.toString('base64')}`;
      } catch (err) {
        console.error('Error reading logo file:', err);
        // Continue without logo if it fails to read
      }
    }

    // Create HTML document with styling
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${title}</title>
          <style>
            @page {
              margin: 1in;
            }
            body {
              font-family: 'Inter', 'Helvetica', 'Arial', sans-serif;
              line-height: 1.6;
              color: #1A1A1A;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            h1, h2, h3, h4, h5, h6 {
              color: #d97757;
              margin-top: 24px;
              margin-bottom: 16px;
            }
            h1 {
              font-size: 2.5em;
              border-bottom: 2px solid #d97757;
              padding-bottom: 10px;
            }
            h2 {
              font-size: 2em;
              border-bottom: 1px solid #e8e6dc;
              padding-bottom: 8px;
            }
            h3 {
              font-size: 1.5em;
            }
            p {
              margin: 12px 0;
            }
            ul, ol {
              margin: 12px 0;
              padding-left: 30px;
            }
            li {
              margin: 6px 0;
            }
            code {
              background-color: #f5f5f5;
              padding: 2px 6px;
              border-radius: 3px;
              font-family: 'Courier New', monospace;
              font-size: 0.9em;
            }
            pre {
              background-color: #f5f5f5;
              padding: 12px;
              border-radius: 5px;
              overflow-x: auto;
            }
            pre code {
              background-color: transparent;
              padding: 0;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 16px 0;
            }
            th, td {
              border: 1px solid #e0e0e0;
              padding: 8px 12px;
              text-align: left;
            }
            th {
              background-color: #d97757;
              color: white;
              font-weight: 600;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            blockquote {
              border-left: 4px solid #d97757;
              margin: 16px 0;
              padding: 12px 20px;
              background-color: #faf9f5;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 3px solid #d97757;
            }
            .header-content {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 15px;
              margin-bottom: 10px;
            }
            .bank-logo {
              height: 50px;
              max-width: 150px;
              object-fit: contain;
            }
            .bank-name {
              font-size: 1.8em;
              color: #d97757;
              margin: 0;
            }
            .report-title {
              font-size: 1.2em;
              color: #666;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e0e0e0;
              text-align: center;
              font-size: 0.9em;
              color: #888;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${(logoDataUrl || bankName) ? `
              <div class="header-content">
                ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Bank Logo" class="bank-logo" />` : ''}
                ${bankName ? `<div class="bank-name">${bankName}</div>` : ''}
              </div>
            ` : ''}
            <div class="report-title">${title}</div>
            <div style="font-size: 0.9em; color: #888; margin-top: 10px;">
              Generated: ${new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
          ${htmlContent}
          <div class="footer">
            Generated with Bank Explorer • Powered by Claude AI
          </div>
        </body>
      </html>
    `;

    // Launch puppeteer - use system Chrome on macOS if available
    const executablePath = process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : undefined;

    browser = await puppeteer.launch({
      headless: 'new',
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      }
    });

    await browser.close();
    return pdfBuffer;

  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
}

/**
 * Generate a professional, consultant-style PDF report
 * @param {object} options - Configuration options
 * @param {string} options.markdown - The markdown content
 * @param {string} options.title - Document title
 * @param {string} options.bankName - Bank name
 * @param {string} options.bankLogoPath - Path to bank logo
 * @param {string} options.generatedAt - Generation timestamp
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generateProfessionalPDF(options) {
  const {
    markdown,
    title = 'Bank Analysis Report',
    bankName = '',
    bankLogoPath = null,
    generatedAt = new Date().toISOString()
  } = options;

  let browser;
  try {
    // Convert markdown to HTML
    const htmlContent = marked.parse(markdown);

    // Read bank logo if provided
    let bankLogoDataUrl = null;
    if (bankLogoPath) {
      try {
        const logoBuffer = await fs.readFile(bankLogoPath);
        const ext = path.extname(bankLogoPath).toLowerCase();
        const mimeTypes = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.svg': 'image/svg+xml'
        };
        const mimeType = mimeTypes[ext] || 'image/png';
        bankLogoDataUrl = `data:${mimeType};base64,${logoBuffer.toString('base64')}`;
      } catch (err) {
        console.error('[PDF] Error reading bank logo:', err.message);
      }
    }

    // Read Claude logo
    let claudeLogoDataUrl = null;
    try {
      const claudeLogoPath = path.join(__dirname, '../../client/public/claude-icon.svg');
      const claudeLogoBuffer = await fs.readFile(claudeLogoPath);
      claudeLogoDataUrl = `data:image/svg+xml;base64,${claudeLogoBuffer.toString('base64')}`;
    } catch (err) {
      console.error('[PDF] Claude logo not found:', err.message);
    }

    const formattedDate = new Date(generatedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create professional HTML document
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${title}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

            @page {
              size: Letter;
              margin: 0.75in 0.75in 1in 0.75in;
            }

            @page:first {
              margin: 0;
            }

            * {
              box-sizing: border-box;
            }

            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              line-height: 1.6;
              color: #1A1A1A;
              font-size: 11pt;
              margin: 0;
              padding: 0;
            }

            /* Cover Page */
            .cover-page {
              page-break-after: always;
              height: 100vh;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%);
              padding: 60px;
              text-align: center;
            }

            .cover-logo {
              max-width: 200px;
              max-height: 120px;
              margin-bottom: 40px;
            }

            .cover-title {
              font-size: 36pt;
              font-weight: 700;
              color: #1A1A1A;
              margin: 0 0 10px 0;
              letter-spacing: -1px;
            }

            .cover-subtitle {
              font-size: 18pt;
              color: #D97757;
              font-weight: 500;
              margin: 0 0 40px 0;
            }

            .cover-date {
              font-size: 12pt;
              color: #666;
              margin-bottom: 60px;
            }

            .cover-powered-by {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 12px;
              padding: 16px 24px;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            }

            .cover-powered-by img {
              height: 28px;
              width: 28px;
            }

            .cover-powered-by span {
              font-size: 11pt;
              color: #666;
              font-weight: 500;
            }

            /* Content Styling */
            .content {
              padding: 0;
            }

            /* Page Header */
            .page-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding-bottom: 12px;
              margin-bottom: 24px;
              border-bottom: 2px solid #D97757;
            }

            .page-header-left {
              font-size: 10pt;
              color: #666;
              font-weight: 500;
            }

            .page-header-right img {
              height: 24px;
              opacity: 0.8;
            }

            h1 {
              font-size: 22pt;
              font-weight: 700;
              color: #D97757;
              margin: 32px 0 16px 0;
              padding-bottom: 8px;
              border-bottom: 2px solid #D97757;
              page-break-after: avoid;
            }

            h2 {
              font-size: 16pt;
              font-weight: 600;
              color: #1A1A1A;
              margin: 28px 0 12px 0;
              padding-bottom: 6px;
              border-bottom: 1px solid #e0e0e0;
              page-break-after: avoid;
            }

            h3 {
              font-size: 13pt;
              font-weight: 600;
              color: #333;
              margin: 20px 0 10px 0;
              page-break-after: avoid;
            }

            h4 {
              font-size: 11pt;
              font-weight: 600;
              color: #444;
              margin: 16px 0 8px 0;
            }

            p {
              margin: 10px 0;
              text-align: justify;
            }

            ul, ol {
              margin: 10px 0;
              padding-left: 24px;
            }

            li {
              margin: 6px 0;
            }

            /* Highlight boxes for key insights */
            blockquote {
              background: #fff8f6;
              border-left: 4px solid #D97757;
              margin: 20px 0;
              padding: 16px 20px;
              border-radius: 0 8px 8px 0;
            }

            blockquote p {
              margin: 0;
              color: #333;
            }

            /* Tables */
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
              font-size: 10pt;
            }

            th {
              background: #D97757;
              color: white;
              padding: 10px 12px;
              text-align: left;
              font-weight: 600;
            }

            td {
              padding: 10px 12px;
              border-bottom: 1px solid #e0e0e0;
            }

            tr:nth-child(even) {
              background: #fafafa;
            }

            /* Code/data blocks */
            code {
              background: #f5f5f5;
              padding: 2px 6px;
              border-radius: 3px;
              font-family: 'Monaco', 'Consolas', monospace;
              font-size: 9pt;
            }

            pre {
              background: #f5f5f5;
              padding: 16px;
              border-radius: 6px;
              overflow-x: auto;
              font-size: 9pt;
            }

            /* Links */
            a {
              color: #D97757;
              text-decoration: none;
            }

            a:hover {
              text-decoration: underline;
            }

            /* Strong emphasis */
            strong {
              font-weight: 600;
              color: #1A1A1A;
            }

            /* Citations */
            .citation {
              color: #666;
              font-size: 9pt;
            }

            /* Page footer */
            .page-footer {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              height: 40px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 0 60px;
              font-size: 9pt;
              color: #888;
              border-top: 1px solid #e0e0e0;
              background: white;
            }

            /* Ensure charts/images don't break across pages */
            img {
              max-width: 100%;
              page-break-inside: avoid;
            }

            /* Section breaks */
            hr {
              border: none;
              border-top: 1px solid #e0e0e0;
              margin: 30px 0;
            }

            /* Print-specific */
            @media print {
              .cover-page {
                page-break-after: always;
              }

              h1, h2, h3 {
                page-break-after: avoid;
              }

              ul, ol, blockquote {
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <!-- Cover Page -->
          <div class="cover-page">
            ${bankLogoDataUrl ? `<img src="${bankLogoDataUrl}" alt="Bank Logo" class="cover-logo" />` : ''}
            <h1 class="cover-title">${bankName || 'Bank'}</h1>
            <p class="cover-subtitle">Research Analysis Report</p>
            <p class="cover-date">${formattedDate}</p>
            <div class="cover-powered-by">
              ${claudeLogoDataUrl ? `<img src="${claudeLogoDataUrl}" alt="Claude" />` : ''}
              <span>Powered by Claude</span>
            </div>
          </div>

          <!-- Content -->
          <div class="content">
            <div class="page-header">
              <div class="page-header-left">${bankName} Research Report</div>
              ${bankLogoDataUrl ? `<div class="page-header-right"><img src="${bankLogoDataUrl}" alt="${bankName}" /></div>` : ''}
            </div>

            ${htmlContent}
          </div>
        </body>
      </html>
    `;

    // Launch puppeteer - use system Chrome on macOS if available
    const executablePath = process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : undefined;

    browser = await puppeteer.launch({
      headless: 'new',
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="width: 100%; font-size: 9px; padding: 10px 40px; display: flex; justify-content: space-between; color: #888;">
          <span>${bankName} Research Report</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
      margin: {
        top: '0.5in',
        right: '0.75in',
        bottom: '0.75in',
        left: '0.75in'
      }
    });

    await browser.close();
    console.log(`[PDF] Generated professional PDF for ${bankName}`);
    return pdfBuffer;

  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw new Error(`Failed to generate professional PDF: ${error.message}`);
  }
}

module.exports = {
  generatePDFFromMarkdown,
  generateProfessionalPDF
};
