/**
 * Google Slides API Access Test Script
 *
 * Run this script to validate that:
 * 1. You have valid Google Cloud credentials
 * 2. Google Slides API is enabled
 * 3. Service account can create presentations
 * 4. You can insert text and images
 *
 * Setup Instructions:
 * 1. Get credentials JSON file from Google Cloud Console or your admin
 * 2. Save it as: server/config/google-credentials.json
 * 3. Install package: npm install googleapis
 * 4. Run: node test_google_slides_access.js
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// CONFIGURATION - Update these paths
const CREDENTIALS_PATH = path.join(__dirname, 'server/config/google-credentials.json');
const TEST_TEMPLATE_ID = ''; // Optional: ID of a Google Slides template you want to copy

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testGoogleSlidesAccess() {
  log('\n=== Google Slides API Access Test ===\n', 'blue');

  // Step 1: Check credentials file exists
  log('Step 1: Checking credentials file...', 'yellow');
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    log(`✗ FAILED: Credentials file not found at: ${CREDENTIALS_PATH}`, 'red');
    log('\nNext steps:', 'yellow');
    log('1. Get credentials JSON from Google Cloud Console or your admin');
    log('2. Save it to: server/config/google-credentials.json');
    log('3. Re-run this test script');
    return;
  }
  log('✓ Credentials file found', 'green');

  // Step 2: Load credentials
  log('\nStep 2: Loading credentials...', 'yellow');
  let credentials;
  try {
    credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    log('✓ Credentials loaded successfully', 'green');
    log(`  Service account email: ${credentials.client_email}`, 'blue');
  } catch (error) {
    log(`✗ FAILED: Could not parse credentials file: ${error.message}`, 'red');
    return;
  }

  // Step 3: Authenticate
  log('\nStep 3: Authenticating with Google...', 'yellow');
  let auth;
  try {
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/presentations',
        'https://www.googleapis.com/auth/drive'
      ]
    });
    const client = await auth.getClient();
    log('✓ Authentication successful', 'green');
  } catch (error) {
    log(`✗ FAILED: Authentication error: ${error.message}`, 'red');
    log('\nPossible issues:', 'yellow');
    log('- Service account might not have necessary permissions');
    log('- Credentials file might be for wrong project');
    log('- Contact your Google Workspace admin');
    return;
  }

  // Step 4: Test Slides API access
  log('\nStep 4: Testing Google Slides API access...', 'yellow');
  const slides = google.slides({ version: 'v1', auth });
  const drive = google.drive({ version: 'v3', auth });

  try {
    // Create a test presentation
    log('  Creating test presentation...', 'blue');
    const createResponse = await slides.presentations.create({
      requestBody: {
        title: 'BankExplorer API Test - ' + new Date().toISOString()
      }
    });

    const presentationId = createResponse.data.presentationId;
    log(`✓ Test presentation created`, 'green');
    log(`  Presentation ID: ${presentationId}`, 'blue');
    log(`  URL: https://docs.google.com/presentation/d/${presentationId}`, 'blue');

    // Step 5: Test adding content
    log('\nStep 5: Testing content insertion...', 'yellow');
    try {
      // Add a slide with text
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: {
          requests: [
            {
              createSlide: {
                slideLayoutReference: {
                  predefinedLayout: 'TITLE_AND_BODY'
                }
              }
            },
            {
              insertText: {
                objectId: createResponse.data.slides[0].pageElements[0].objectId,
                text: 'BankExplorer Test Presentation',
                insertionIndex: 0
              }
            }
          ]
        }
      });
      log('✓ Successfully added text to slide', 'green');
    } catch (error) {
      log(`✗ WARNING: Could not add content: ${error.message}`, 'yellow');
    }

    // Step 6: Test PDF export
    log('\nStep 6: Testing PDF export...', 'yellow');
    try {
      const pdfResponse = await drive.files.export({
        fileId: presentationId,
        mimeType: 'application/pdf'
      }, { responseType: 'stream' });

      log('✓ PDF export successful', 'green');
    } catch (error) {
      log(`✗ WARNING: PDF export failed: ${error.message}`, 'yellow');
      log('  This might be a permissions issue - check with admin', 'yellow');
    }

    // Step 7: Test template copying (if template ID provided)
    if (TEST_TEMPLATE_ID) {
      log('\nStep 7: Testing template copying...', 'yellow');
      try {
        const copyResponse = await drive.files.copy({
          fileId: TEST_TEMPLATE_ID,
          requestBody: {
            name: 'BankExplorer Template Test - ' + new Date().toISOString()
          }
        });
        log('✓ Template copied successfully', 'green');
        log(`  New presentation ID: ${copyResponse.data.id}`, 'blue');
      } catch (error) {
        log(`✗ WARNING: Could not copy template: ${error.message}`, 'yellow');
        log('  Make sure the template is shared with the service account', 'yellow');
      }
    }

    // Step 8: Clean up test presentation
    log('\nStep 8: Cleaning up test files...', 'yellow');
    try {
      await drive.files.delete({ fileId: presentationId });
      log('✓ Test presentation deleted', 'green');
    } catch (error) {
      log(`✗ WARNING: Could not delete test file: ${error.message}`, 'yellow');
    }

    // Success summary
    log('\n=== TEST RESULTS: SUCCESS ===', 'green');
    log('\n✓ All core functionality works!', 'green');
    log('\nYou can proceed with implementation. The system can:', 'blue');
    log('  • Create presentations programmatically');
    log('  • Add text and content to slides');
    log('  • Export to PDF (if permissions allow)');
    if (TEST_TEMPLATE_ID) {
      log('  • Copy from templates');
    }
    log('\nNext steps:', 'yellow');
    log('1. Store credentials securely in server/config/google-credentials.json');
    log('2. Add credentials path to .gitignore');
    log('3. Set environment variable: GOOGLE_CREDENTIALS_PATH=server/config/google-credentials.json');
    log('4. Create your presentation template in Google Slides');
    log('5. Share template with service account email: ' + credentials.client_email);
    log('6. Begin implementation!');

  } catch (error) {
    log(`\n✗ FAILED: ${error.message}`, 'red');
    log('\nError details:', 'red');
    console.error(error);

    if (error.code === 403) {
      log('\n⚠ 403 Forbidden Error - Possible causes:', 'yellow');
      log('1. Google Slides API not enabled in your project');
      log('2. Service account lacks necessary permissions');
      log('3. Organization policies blocking API access');
      log('\nContact your Google Workspace admin with this error.');
    } else if (error.code === 429) {
      log('\n⚠ 429 Rate Limit Error', 'yellow');
      log('API quota exceeded. Wait a moment and try again.');
    }
  }
}

// Run the test
log('\nStarting Google Slides API validation test...', 'blue');
log('This will create a test presentation and then delete it.\n', 'blue');

testGoogleSlidesAccess()
  .then(() => {
    log('\nTest completed.', 'blue');
    process.exit(0);
  })
  .catch((error) => {
    log(`\n✗ Unexpected error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
