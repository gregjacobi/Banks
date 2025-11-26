#!/usr/bin/env node

/**
 * Test CloudFront PDF download with proper session handling
 */

const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

const PDF_URL = 'https://d1io3yog0oux5.cloudfront.net/_deba4b0fb17dcf0d113c2ab6060b3d50/bankofamerica/db/968/10447/file_upload/BofAInvestorDay_FullPresentation_Final.pdf';
const IR_PAGE = 'https://investor.bankofamerica.com';

async function testDownload() {
  console.log('\n' + '='.repeat(80));
  console.log('TESTING CLOUDFRONT PDF DOWNLOAD');
  console.log('='.repeat(80));
  console.log('');

  // Create cookie jar for session management
  const cookieJar = new tough.CookieJar();
  const client = wrapper(axios.create({ jar: cookieJar }));

  try {
    // Step 1: Visit IR page first to establish session
    console.log('Step 1: Visiting IR page to establish session...');
    console.log(`  URL: ${IR_PAGE}`);

    const irResponse = await client.get(IR_PAGE, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 30000,
      maxRedirects: 5
    });

    console.log(`  ✓ Status: ${irResponse.status}`);
    const cookies = await cookieJar.getCookies(IR_PAGE);
    console.log(`  ✓ Cookies received: ${cookies.length}`);
    if (cookies.length > 0) {
      cookies.forEach(cookie => {
        console.log(`    - ${cookie.key}`);
      });
    }
    console.log('');

    // Step 2: Try downloading PDF with session cookies
    console.log('Step 2: Attempting PDF download with session...');
    console.log(`  URL: ${PDF_URL}`);

    const pdfResponse = await client.get(PDF_URL, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/pdf,application/octet-stream,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': IR_PAGE,
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 60000,
      maxRedirects: 5
    });

    console.log(`  ✓ Status: ${pdfResponse.status}`);
    console.log(`  ✓ Content-Type: ${pdfResponse.headers['content-type']}`);
    console.log(`  ✓ Content-Length: ${pdfResponse.data.length} bytes (${(pdfResponse.data.length / 1024 / 1024).toFixed(2)} MB)`);
    console.log('');

    // Verify it's actually a PDF
    const pdfHeader = Buffer.from(pdfResponse.data).toString('ascii', 0, 4);
    if (pdfHeader === '%PDF') {
      console.log('  ✅ SUCCESS: Downloaded valid PDF file');
    } else {
      console.log(`  ❌ ERROR: File doesn't appear to be a PDF (header: ${pdfHeader})`);
      console.log(`  First 200 bytes: ${Buffer.from(pdfResponse.data).toString('utf8', 0, 200)}`);
    }

  } catch (error) {
    console.log(`  ❌ ERROR: ${error.message}`);

    if (error.response) {
      console.log(`  Status: ${error.response.status}`);
      console.log(`  Status Text: ${error.response.statusText}`);
      console.log(`  Headers:`, error.response.headers);

      if (error.response.data) {
        const dataStr = Buffer.isBuffer(error.response.data)
          ? error.response.data.toString('utf8', 0, 500)
          : JSON.stringify(error.response.data).substring(0, 500);
        console.log(`  Response: ${dataStr}`);
      }
    }
  }

  console.log('');
  console.log('='.repeat(80));
}

testDownload().catch(console.error);
